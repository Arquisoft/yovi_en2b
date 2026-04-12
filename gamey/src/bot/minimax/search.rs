//! Negamax search with alpha-beta pruning, PVS, and iterative deepening.

use crate::{Coordinates, GameY};
use smallvec::SmallVec;
use std::time::{Duration, Instant};

use super::{ABORTED, INFINITY, WIN_SCORE};
use super::eval::evaluate_state;
use super::state::MinimaxState;
use super::tables::{
    ASPIRATION_DELTA, KILLER_SLOTS, HistoryTable, KillerTable, TranspositionTable, TtFlag,
};

// ============================================================================
// Move ordering
// ============================================================================

/// Sorts `moves` in-place with a three-tier priority:
///
/// 1. TT move placed first.
/// 2. Killer moves placed next in slot order.
/// 3. Remaining moves sorted by a blended key: `history_score * 8 + neighbors`.
pub(super) fn order_moves(
    moves: &mut SmallVec<[usize; 128]>,
    state: &MinimaxState,
    player: u8,
    tt_move: Option<usize>,
    killers: [Option<usize>; KILLER_SLOTS],
    history: &HistoryTable,
) {
    let p_idx = state.player_idx(player);
    let mut priority_front: SmallVec<[usize; 4]> = SmallVec::new();
    let mut rest: SmallVec<[(usize, u64); 128]> = SmallVec::new();

    for &idx in moves.iter() {
        if tt_move == Some(idx) {
            priority_front.insert(0, idx);
            continue;
        }
        if killers.iter().any(|&k| k == Some(idx)) {
            priority_front.push(idx);
            continue;
        }
        let neighbor_count = state.neighbors_cache[idx]
            .iter()
            .filter(|&&n| state.board[n] == player)
            .count() as u64;
        let hist = history.score(idx, p_idx) as u64;
        let key = hist * 8 + neighbor_count;
        rest.push((idx, key));
    }

    rest.sort_unstable_by(|a, b| b.1.cmp(&a.1));

    let mut out = 0;
    for &m in &priority_front {
        moves[out] = m;
        out += 1;
    }
    for &(idx, _) in &rest {
        moves[out] = idx;
        out += 1;
    }
}

// ============================================================================
// Search helpers
// ============================================================================

/// Probes the transposition table and updates the alpha-beta window.
fn apply_tt_probe(
    tt: &TranspositionTable,
    hash: u64,
    depth: u8,
    alpha: &mut i32,
    beta: &mut i32,
) -> Option<i32> {
    let entry = tt.probe(hash, depth)?;
    match entry.flag {
        TtFlag::Exact => return Some(entry.score),
        TtFlag::LowerBound => *alpha = (*alpha).max(entry.score),
        TtFlag::UpperBound => *beta = (*beta).min(entry.score),
    }
    if *alpha >= *beta {
        Some(entry.score)
    } else {
        None
    }
}

/// Principal Variation Search child evaluation.
fn pvs_child_score(
    state: &mut MinimaxState,
    depth: u8,
    alpha: i32,
    beta: i32,
    opponent: u8,
    searched: u32,
    killers: &mut KillerTable,
    tt: &mut TranspositionTable,
    history: &mut HistoryTable,
    start_time: Instant,
    max_limit: Duration,
) -> i32 {
    if searched == 0 {
        let child = negamax(
            state,
            depth - 1,
            -beta,
            -alpha,
            opponent,
            killers,
            tt,
            history,
            start_time,
            max_limit,
        );
        if child == ABORTED {
            return ABORTED;
        }
        -child
    } else {
        let child = negamax(
            state,
            depth - 1,
            -(alpha + 1),
            -alpha,
            opponent,
            killers,
            tt,
            history,
            start_time,
            max_limit,
        );
        if child == ABORTED {
            return ABORTED;
        }
        let s = -child;
        if s > alpha && s < beta {
            let child2 = negamax(
                state,
                depth - 1,
                -beta,
                -alpha,
                opponent,
                killers,
                tt,
                history,
                start_time,
                max_limit,
            );
            if child2 == ABORTED {
                return ABORTED;
            }
            -child2
        } else {
            s
        }
    }
}

/// Updates alpha, best score/move, and killer/history tables after evaluating
/// a move. Returns `true` when a beta cutoff is detected.
fn update_search_state(
    score: i32,
    move_idx: usize,
    depth_idx: usize,
    p_idx: usize,
    depth: u8,
    beta: i32,
    alpha: &mut i32,
    best_score: &mut i32,
    best_move: &mut Option<usize>,
    killers: &mut KillerTable,
    history: &mut HistoryTable,
) -> bool {
    if score > *best_score {
        *best_score = score;
        *best_move = Some(move_idx);
    }
    if score > *alpha {
        *alpha = score;
    }
    if *alpha >= beta {
        killers.store(depth_idx, move_idx);
        history.record_cutoff(move_idx, p_idx, depth);
        return true;
    }
    false
}

/// Determines the transposition-table bound flag from the search result.
fn compute_tt_flag(best_score: i32, alpha_orig: i32, beta: i32) -> TtFlag {
    if best_score <= alpha_orig {
        TtFlag::UpperBound
    } else if best_score >= beta {
        TtFlag::LowerBound
    } else {
        TtFlag::Exact
    }
}

// ============================================================================
// Public helper
// ============================================================================

/// Runs the minimax engine for `game` and returns the chosen [`Coordinates`].
pub fn choose_move_with_minimax(
    game: &GameY,
    min_time_ms: u64,
    max_time_ms: u64,
) -> Option<Coordinates> {
    let bot_player = game.next_player()?;
    let mut state = MinimaxState::new(game, bot_player);

    if let Some(coords) = greedy_search(&mut state) {
        return Some(coords);
    }

    let (best_move, _) = iterative_deepening_search(&mut state, min_time_ms, max_time_ms);
    Some(Coordinates::from_index(best_move as u32, game.board_size()))
}

// ============================================================================
// Search
// ============================================================================

/// Checks every available cell for an immediate bot win or an immediate threat
/// that must be blocked.
pub(super) fn greedy_search(state: &mut MinimaxState) -> Option<Coordinates> {
    let moves: SmallVec<[usize; 128]> = state.available_cells().collect();

    for move_idx in moves {
        state.make_move(move_idx, state.bot_id);
        if state.check_win(state.bot_id) {
            println!(">>> INSTANT WIN FOUND at {}", move_idx);
            return Some(Coordinates::from_index(move_idx as u32, state.size));
        }
        state.undo_move(move_idx);

        state.make_move(move_idx, state.human_id);
        if state.check_win(state.human_id) {
            println!(">>> BLOCKING IMMEDIATE THREAT at {}", move_idx);
            return Some(Coordinates::from_index(move_idx as u32, state.size));
        }
        state.undo_move(move_idx);
    }

    None
}

/// Runs iterative deepening with aspiration windows and two time gates.
pub(super) fn iterative_deepening_search(
    state: &mut MinimaxState,
    min_time_ms: u64,
    max_time_ms: u64,
) -> (usize, i32) {
    let start_time = Instant::now();
    let min_limit = Duration::from_millis(min_time_ms);
    let max_limit = Duration::from_millis(max_time_ms);

    let mut tt = TranspositionTable::new();
    let mut history = HistoryTable::new(state.board.len());
    let mut best_move = state.available_cells().next().expect("no available moves");
    let mut best_score = 0i32;
    let mut prev_score: Option<i32> = None;

    for depth in 1..=100u8 {
        if start_time.elapsed() >= min_limit {
            println!("Min time reached, stopping after depth {}", depth - 1);
            break;
        }

        println!("Searching at depth {}...", depth);

        let mut killers = KillerTable::new(depth as usize);

        let (move_found, score) = if let Some(ps) = prev_score {
            aspiration_search(
                state,
                depth,
                ps,
                &mut killers,
                &mut tt,
                &mut history,
                start_time,
                max_limit,
            )
        } else {
            search_best_move(
                state,
                depth,
                -INFINITY,
                INFINITY,
                &mut killers,
                &mut tt,
                &mut history,
                start_time,
                max_limit,
            )
        };

        if score == ABORTED {
            println!(
                "Max time exceeded mid-depth {}, keeping result from depth {}",
                depth,
                depth - 1
            );
            break;
        }

        best_move = move_found;
        best_score = score;
        prev_score = Some(score);

        println!("Depth {}: best_move={} score={}", depth, move_found, score);

        history.age();

        if score >= WIN_SCORE - 100 {
            println!("Winning move found at depth {}", depth);
            break;
        }
    }

    (best_move, best_score)
}

/// Aspiration window wrapper: tries a narrow window first, widens on fail.
pub(super) fn aspiration_search(
    state: &mut MinimaxState,
    depth: u8,
    prev_score: i32,
    killers: &mut KillerTable,
    tt: &mut TranspositionTable,
    history: &mut HistoryTable,
    start_time: Instant,
    max_limit: Duration,
) -> (usize, i32) {
    let mut delta = ASPIRATION_DELTA;

    loop {
        let alpha = (prev_score - delta).max(-INFINITY);
        let beta = (prev_score + delta).min(INFINITY);

        let (mv, score) = search_best_move(
            state, depth, alpha, beta, killers, tt, history, start_time, max_limit,
        );

        if score == ABORTED {
            return (mv, ABORTED);
        }

        if score > alpha && score < beta {
            return (mv, score);
        }

        delta *= 4;
        if delta >= INFINITY / 2 {
            return search_best_move(
                state, depth, -INFINITY, INFINITY, killers, tt, history, start_time, max_limit,
            );
        }
    }
}

/// Root search: generates moves ordered by shortest-path delta, then searches
/// each with negamax+PVS under the given `[alpha, beta]` window.
pub(super) fn search_best_move(
    state: &mut MinimaxState,
    depth: u8,
    mut alpha: i32,
    beta: i32,
    killers: &mut KillerTable,
    tt: &mut TranspositionTable,
    history: &mut HistoryTable,
    start_time: Instant,
    max_limit: Duration,
) -> (usize, i32) {
    let ordered = state.shortest_path_deltas(state.bot_id);
    let mut moves: Vec<usize> = ordered.into_iter().map(|(idx, _)| idx).collect();

    if let Some(tt_mv) = tt.best_move(state.hash) {
        if let Some(pos) = moves.iter().position(|&m| m == tt_mv) {
            moves.swap(0, pos);
        }
    }

    let player = state.bot_id;
    let opponent = state.human_id;
    let alpha_orig = alpha;
    let mut best_score = -INFINITY;
    let mut best_move = moves[0];
    let mut searched: u32 = 0;

    for &move_idx in &moves {
        state.make_move(move_idx, player);

        if state.check_win(player) {
            state.undo_move(move_idx);
            tt.store(state.hash, depth, WIN_SCORE, TtFlag::Exact, Some(move_idx));
            return (move_idx, WIN_SCORE);
        }

        let score = pvs_child_score(
            state, depth, alpha, beta, opponent, searched, killers, tt, history, start_time,
            max_limit,
        );
        state.undo_move(move_idx);

        if score == ABORTED {
            return (best_move, ABORTED);
        }

        searched += 1;
        if score > best_score {
            best_score = score;
            best_move = move_idx;
        }
        if score > alpha {
            alpha = score;
        }
        if alpha >= beta {
            break;
        }
    }

    let flag = compute_tt_flag(best_score, alpha_orig, beta);
    tt.store(state.hash, depth, best_score, flag, Some(best_move));
    (best_move, best_score)
}

/// Negamax with alpha-beta, PVS, transposition table, killer moves, and
/// history heuristic.
pub(super) fn negamax(
    state: &mut MinimaxState,
    depth: u8,
    mut alpha: i32,
    mut beta: i32,
    player: u8,
    killers: &mut KillerTable,
    tt: &mut TranspositionTable,
    history: &mut HistoryTable,
    start_time: Instant,
    max_limit: Duration,
) -> i32 {
    if start_time.elapsed() >= max_limit {
        return ABORTED;
    }

    let alpha_orig = alpha;
    let position_hash = state.hash;

    if let Some(score) = apply_tt_probe(&tt, position_hash, depth, &mut alpha, &mut beta) {
        return score;
    }

    if depth == 0 {
        let score = evaluate_state(state, player);
        tt.store(position_hash, 0, score, TtFlag::Exact, None);
        return score;
    }

    let opponent = state.opponent_of(player);
    let depth_idx = depth as usize;
    let killer_moves = killers.get(depth_idx);
    let tt_move = tt.best_move(position_hash);
    let mut moves: SmallVec<[usize; 128]> = state.available_cells().collect();
    order_moves(&mut moves, state, player, tt_move, killer_moves, history);

    let mut best_score = -INFINITY;
    let mut best_move_found: Option<usize> = None;
    let mut searched: u32 = 0;
    let p_idx = state.player_idx(player);

    for move_idx in moves {
        state.make_move(move_idx, player);

        if state.check_win(player) {
            state.undo_move(move_idx);
            killers.store(depth_idx, move_idx);
            tt.store(
                position_hash,
                depth,
                WIN_SCORE,
                TtFlag::Exact,
                Some(move_idx),
            );
            return WIN_SCORE;
        }

        let score = pvs_child_score(
            state, depth, alpha, beta, opponent, searched, killers, tt, history, start_time,
            max_limit,
        );
        state.undo_move(move_idx);

        if score == ABORTED {
            return ABORTED;
        }

        searched += 1;
        if update_search_state(
            score,
            move_idx,
            depth_idx,
            p_idx,
            depth,
            beta,
            &mut alpha,
            &mut best_score,
            &mut best_move_found,
            killers,
            history,
        ) {
            break;
        }
    }

    let flag = compute_tt_flag(best_score, alpha_orig, beta);
    tt.store(position_hash, depth, best_score, flag, best_move_found);
    best_score
}
