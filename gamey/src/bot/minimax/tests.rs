//! Tests for the minimax search engine.

use super::eval::evaluate_state;
use super::search::{
    aspiration_search, greedy_search, iterative_deepening_search, negamax, order_moves,
    search_best_move,
};
use super::state::MinimaxState;
use super::tables::{HistoryTable, KillerTable, TranspositionTable};
use super::{ABORTED, INFINITY, LOSE_SCORE, WIN_SCORE};
use crate::{GameY, PlayerId};
use smallvec::SmallVec;
use std::time::{Duration, Instant};

fn create_empty_state(size: u32) -> MinimaxState {
    MinimaxState::new(&GameY::new(size), PlayerId::new(0))
}

fn get_valid_cells(state: &MinimaxState, count: usize) -> Vec<usize> {
    state.available_cells().take(count).collect()
}

fn make_search_context(
    max_depth: u8,
    total_cells: usize,
) -> (
    Instant,
    Duration,
    KillerTable,
    TranspositionTable,
    HistoryTable,
) {
    (
        Instant::now(),
        Duration::from_secs(60),
        KillerTable::new(max_depth as usize),
        TranspositionTable::new(),
        HistoryTable::new(total_cells),
    )
}

// ============================================================================
// State and board mutation
// ============================================================================

#[test]
fn test_state_initializes_correctly() {
    let game = GameY::new(3);
    let state = MinimaxState::new(&game, PlayerId::new(0));

    assert_eq!(state.size, 3);
    assert_eq!(state.bot_id, 1);
    assert_eq!(state.human_id, 2);

    for idx in state.available_cells() {
        assert_eq!(state.board[idx], 0);
    }

    assert!(state.available_mask.count_ones(..) > 0);
    assert_eq!(state.occupied_count, 0);
    assert_eq!(state.hash, 0, "empty board must have hash 0");
}

#[test]
fn test_make_move_updates_hash() {
    let mut state = create_empty_state(3);
    let idx = state.available_cells().next().unwrap();

    let hash_before = state.hash;
    state.make_move(idx, state.bot_id);
    assert_ne!(state.hash, hash_before);
}

#[test]
fn test_undo_move_restores_hash() {
    let mut state = create_empty_state(3);
    let idx = state.available_cells().next().unwrap();

    let hash_before = state.hash;
    state.make_move(idx, state.bot_id);
    state.undo_move(idx);

    assert_eq!(state.hash, hash_before);
}

#[test]
fn test_make_undo_restores_incremental_score() {
    let mut state = create_empty_state(3);
    let idx = state.available_cells().next().unwrap();
    let scores_before = state.scores.clone();

    state.make_move(idx, state.bot_id);
    state.undo_move(idx);

    let s0 = &state.scores[0];
    let s1 = &state.scores[1];
    let b0 = &scores_before[0];
    let b1 = &scores_before[1];

    assert_eq!(s0.connections, b0.connections);
    assert_eq!(s0.well_connected, b0.well_connected);
    assert_eq!(s0.center_sum, b0.center_sum);
    assert_eq!(s0.edge_refs, b0.edge_refs);
    assert_eq!(s1.connections, b1.connections);
}

#[test]
fn test_occupied_count_tracks_moves() {
    let mut state = create_empty_state(3);
    let cells = get_valid_cells(&state, 3);

    state.make_move(cells[0], state.bot_id);
    assert_eq!(state.occupied_count, 1);
    state.make_move(cells[1], state.human_id);
    assert_eq!(state.occupied_count, 2);
    state.undo_move(cells[1]);
    assert_eq!(state.occupied_count, 1);
}

// ============================================================================
// Win detection
// ============================================================================

#[test]
fn test_check_win_empty_board_returns_false() {
    let mut state = create_empty_state(3);
    assert!(!state.check_win(state.bot_id));
    assert!(!state.check_win(state.human_id));
}

#[test]
fn test_check_win_single_piece_returns_false() {
    let mut state = create_empty_state(3);
    let cell = state.available_cells().next().unwrap();

    state.make_move(cell, state.bot_id);
    assert!(!state.check_win(state.bot_id));
}

#[test]
fn test_check_win_does_not_crash_on_full_scan() {
    let mut state = create_empty_state(4);
    let cells: Vec<_> = state.available_cells().collect();
    let mut player = state.bot_id;
    for cell in cells {
        state.make_move(cell, player);
        player = state.opponent_of(player);
    }

    let _ = state.check_win(state.bot_id);
    let _ = state.check_win(state.human_id);
}

// ============================================================================
// Connection cost
// ============================================================================

#[test]
fn test_connection_cost_empty_board_is_finite() {
    let mut state = create_empty_state(4);
    let cost = state.connection_cost(state.bot_id);
    assert_ne!(
        cost,
        super::BLOCKED,
        "empty board should have a finite connection cost"
    );
    assert!(cost > 0, "empty board connection cost should be positive");
}

#[test]
fn test_connection_cost_symmetric_on_empty_board() {
    let mut state = create_empty_state(4);
    let cost_bot = state.connection_cost(state.bot_id);
    let cost_human = state.connection_cost(state.human_id);
    assert_eq!(cost_bot, cost_human, "empty board should have equal costs");
}

#[test]
fn test_connection_cost_decreases_with_own_piece() {
    let mut state = create_empty_state(4);
    let baseline = state.connection_cost(state.bot_id);

    let cells: Vec<_> = state.available_cells().collect();
    let mid = cells[cells.len() / 2];
    state.make_move(mid, state.bot_id);
    let after = state.connection_cost(state.bot_id);

    assert!(
        after <= baseline,
        "placing own piece should not increase connection cost"
    );
}

// ============================================================================
// Move ordering
// ============================================================================

#[test]
fn test_order_moves_places_tt_move_first() {
    let state = create_empty_state(4);
    let history = HistoryTable::new(state.board.len());
    let mut moves: SmallVec<[usize; 128]> = state.available_cells().take(8).collect();
    let tt_mv = moves[5];

    order_moves(
        &mut moves,
        &state,
        state.bot_id,
        Some(tt_mv),
        [None, None],
        &history,
    );

    assert_eq!(moves[0], tt_mv);
}

#[test]
fn test_order_moves_tt_before_killer() {
    let state = create_empty_state(4);
    let history = HistoryTable::new(state.board.len());
    let mut moves: SmallVec<[usize; 128]> = state.available_cells().take(10).collect();
    let tt_mv = moves[7];
    let killer = moves[3];

    order_moves(
        &mut moves,
        &state,
        state.bot_id,
        Some(tt_mv),
        [Some(killer), None],
        &history,
    );

    assert_eq!(moves[0], tt_mv, "TT move must be first");
    assert_eq!(moves[1], killer, "killer must be second");
}

#[test]
fn test_order_moves_preserves_all_moves() {
    let state = create_empty_state(4);
    let history = HistoryTable::new(state.board.len());
    let mut moves: SmallVec<[usize; 128]> = state.available_cells().take(10).collect();
    let original: std::collections::HashSet<usize> = moves.iter().copied().collect();

    order_moves(
        &mut moves,
        &state,
        state.bot_id,
        None,
        [None, None],
        &history,
    );

    let after: std::collections::HashSet<usize> = moves.iter().copied().collect();
    assert_eq!(original, after);
}

// ============================================================================
// Negamax
// ============================================================================

#[test]
fn test_negamax_depth_zero_matches_evaluate() {
    let mut state = create_empty_state(3);
    let cell = state.available_cells().next().unwrap();
    state.make_move(cell, state.bot_id);

    let bot = state.bot_id;
    let total = state.board.len();
    let (start, limit, mut killers, mut tt, mut hist) = make_search_context(0, total);
    let score = negamax(
        &mut state,
        0,
        -INFINITY,
        INFINITY,
        bot,
        &mut killers,
        &mut tt,
        &mut hist,
        start,
        limit,
    );
    assert_eq!(score, evaluate_state(&mut state, bot));
}

#[test]
fn test_negamax_score_in_valid_range() {
    let mut state = create_empty_state(3);
    let cell = state.available_cells().next().unwrap();
    state.make_move(cell, state.bot_id);

    let human = state.human_id;
    let total = state.board.len();
    let (start, limit, mut killers, mut tt, mut hist) = make_search_context(1, total);
    let score = negamax(
        &mut state,
        1,
        -INFINITY,
        INFINITY,
        human,
        &mut killers,
        &mut tt,
        &mut hist,
        start,
        limit,
    );

    assert!(score >= LOSE_SCORE && score <= WIN_SCORE);
}

#[test]
fn test_negamax_aborts_when_time_exceeded() {
    let mut state = create_empty_state(3);
    let start = Instant::now() - Duration::from_secs(100);
    let limit = Duration::from_millis(1);
    let mut killers = KillerTable::new(5);
    let mut tt = TranspositionTable::new();
    let mut hist = HistoryTable::new(state.board.len());
    let bot = state.bot_id;

    let score = negamax(
        &mut state,
        5,
        -INFINITY,
        INFINITY,
        bot,
        &mut killers,
        &mut tt,
        &mut hist,
        start,
        limit,
    );

    assert_eq!(score, ABORTED);
}

#[test]
fn test_negamax_with_tt_returns_same_result_twice() {
    let mut state = create_empty_state(3);
    let total = state.board.len();
    let (start, limit, mut killers, mut tt, mut hist) = make_search_context(3, total);
    let bot = state.bot_id;

    let score1 = negamax(
        &mut state,
        3,
        -INFINITY,
        INFINITY,
        bot,
        &mut killers,
        &mut tt,
        &mut hist,
        start,
        limit,
    );

    let score2 = negamax(
        &mut state,
        3,
        -INFINITY,
        INFINITY,
        bot,
        &mut killers,
        &mut tt,
        &mut hist,
        start,
        limit,
    );

    assert_eq!(score1, score2);
}

// ============================================================================
// Integration
// ============================================================================

#[test]
fn test_greedy_search_empty_board_returns_none() {
    let mut state = create_empty_state(3);
    assert!(greedy_search(&mut state).is_none());
}

#[test]
fn test_search_best_move_returns_valid_index() {
    let mut state = create_empty_state(3);
    let start = Instant::now();
    let limit = Duration::from_secs(60);
    let mut killers = KillerTable::new(2);
    let mut tt = TranspositionTable::new();
    let mut hist = HistoryTable::new(state.board.len());

    let (best_move, score) = search_best_move(
        &mut state,
        2,
        -INFINITY,
        INFINITY,
        &mut killers,
        &mut tt,
        &mut hist,
        start,
        limit,
    );

    assert!(best_move < state.board.len());
    assert!(state.available_mask.contains(best_move));
    assert!(score > LOSE_SCORE);
}

#[test]
fn test_iterative_deepening_returns_valid_move() {
    let mut state = create_empty_state(3);
    let (best_move, _score) = iterative_deepening_search(&mut state, 50, 200);
    assert!(best_move < state.board.len());
}

#[test]
fn test_choose_move_with_minimax_returns_valid_coords() {
    use super::search::choose_move_with_minimax;
    let game = GameY::new(3);
    let coords = choose_move_with_minimax(&game, 50, 200);

    assert!(coords.is_some());
    assert!(coords.unwrap().is_valid(3));
}

#[test]
fn test_constants_are_consistent() {
    assert_eq!(WIN_SCORE, 100_000);
    assert_eq!(LOSE_SCORE, -100_000);
    assert!(INFINITY > WIN_SCORE);
    assert!(ABORTED < LOSE_SCORE);
}

#[test]
fn test_complete_flow_make_evaluate_undo() {
    let mut state = create_empty_state(3);
    let initial_available = state.available_cells().count();
    let idx = state.available_cells().next().unwrap();
    let bot = state.bot_id;

    state.make_move(idx, state.bot_id);
    assert_ne!(evaluate_state(&mut state, bot), 0);
    state.undo_move(idx);

    assert_eq!(state.available_cells().count(), initial_available);
    assert_eq!(state.board[idx], 0);
    assert_eq!(state.occupied_count, 0);
    assert_eq!(state.hash, 0);
}

#[test]
fn test_alternating_moves_and_undo_restores_board() {
    let mut state = create_empty_state(4);
    let moves = get_valid_cells(&state, 4);
    let bot = state.bot_id;

    state.make_move(moves[0], state.bot_id);
    state.make_move(moves[1], state.human_id);
    state.make_move(moves[2], state.bot_id);
    state.make_move(moves[3], state.human_id);

    let hash_mid = state.hash;
    assert!(evaluate_state(&mut state, bot).abs() < WIN_SCORE);

    for &m in moves.iter().rev() {
        state.undo_move(m);
    }

    assert_eq!(state.occupied_count, 0);
    assert_ne!(hash_mid, state.hash, "hash must change as moves are undone");
}

// ============================================================================
// History heuristic
// ============================================================================

#[test]
fn test_history_starts_at_zero() {
    let hist = HistoryTable::new(10);
    assert_eq!(hist.score(0, 0), 0);
    assert_eq!(hist.score(5, 1), 0);
}

#[test]
fn test_history_records_and_ages() {
    let mut hist = HistoryTable::new(10);
    hist.record_cutoff(3, 0, 4); // bonus = 16
    assert_eq!(hist.score(3, 0), 16);

    hist.age();
    assert_eq!(hist.score(3, 0), 8);
}

// ============================================================================
// Aspiration windows
// ============================================================================

#[test]
fn test_aspiration_search_same_as_full_window() {
    let mut state = create_empty_state(3);
    let start = Instant::now();
    let limit = Duration::from_secs(60);
    let mut killers = KillerTable::new(2);
    let mut tt = TranspositionTable::new();
    let mut hist = HistoryTable::new(state.board.len());

    let (mv_full, score_full) = search_best_move(
        &mut state,
        2,
        -INFINITY,
        INFINITY,
        &mut killers,
        &mut tt,
        &mut hist,
        start,
        limit,
    );

    tt = TranspositionTable::new();
    hist = HistoryTable::new(state.board.len());
    killers = KillerTable::new(2);

    let (mv_asp, score_asp) = aspiration_search(
        &mut state,
        2,
        score_full,
        &mut killers,
        &mut tt,
        &mut hist,
        start,
        limit,
    );

    assert_eq!(
        score_full, score_asp,
        "aspiration must converge to same score"
    );
    assert_eq!(mv_full, mv_asp, "aspiration must find same best move");
}
