//! Pie Rule support: opening selection and keep/swap decision.

use crate::{Coordinates, GameY, Movement, PlayerId, YEN, game};
use smallvec::SmallVec;

use super::eval::evaluate_state;
use super::search::iterative_deepening_search;
use super::state::MinimaxState;
use crate::bot::ybot::PieChoice;

// ============================================================================
// Helpers
// ============================================================================

/// Creates a copy of `game` where every stone's ownership is swapped
/// (player 0 ↔ player 1) and the side-to-move is flipped.
fn make_swapped_game(game: &GameY) -> GameY {
    let yen: YEN = game.into();
    let swapped_layout: String = yen
        .layout()
        .chars()
        .map(|c| {
            let players = yen.players();
            if c == players[0] {
                players[1]
            } else if c == players[1] {
                players[0]
            } else {
                c
            }
        })
        .collect();
    let swapped_yen = YEN::new(
        yen.size(),
        1 - yen.turn(),
        yen.players().to_vec(),
        swapped_layout,
    );
    GameY::try_from(swapped_yen).expect("swapped YEN must be valid")
}

// ============================================================================
// Pie decision (second player)
// ============================================================================

/// Decides whether the bot should **keep** or **swap** under the Pie Rule.
///
/// The `game` must contain exactly one stone placed by the opponent with the
/// bot as the side-to-move (the one deciding). The function runs two short
/// searches — one for each scenario — and picks whichever is better for the
/// bot.
///
/// * **Keep**: the position stays as-is and the bot moves next.
/// * **Swap**: the stone changes ownership, the opponent moves next, and the
///   bot now owns the stone.
pub fn decide_pie_with_minimax(game: &GameY, time_ms: u64) -> PieChoice {
    let bot_player = match game.next_player() {
        Some(p) => p,
        None => return PieChoice::Keep,
    };

    let half = time_ms.max(2) / 2;

    // ── Keep scenario ──
    let keep_score = {
        let mut state = MinimaxState::new(game, bot_player);
        let (_, score) = iterative_deepening_search(&mut state, half, half);
        score
    };

    // ── Swap scenario ──
    let swap_score = {
        let swapped = make_swapped_game(game);
        let opponent = game::other_player(bot_player);
        let mut state = MinimaxState::new(&swapped, opponent);
        let (_, opp_score) = iterative_deepening_search(&mut state, half, half);
        -opp_score
    };

    println!(
        "Pie decision: keep_score={}, swap_score={} → {}",
        keep_score,
        swap_score,
        if swap_score > keep_score { "SWAP" } else { "KEEP" }
    );

    if swap_score > keep_score {
        PieChoice::Swap
    } else {
        PieChoice::Keep
    }
}

// ============================================================================
// Pie opening (first player)
// ============================================================================

/// Maximum number of candidate cells to evaluate with deep search.
/// Pre-filtering with static evaluation keeps the total time budget feasible.
const MAX_PIE_CANDIDATES: usize = 8;

/// Chooses a balanced opening move under the Pie Rule using minimax search.
///
/// The algorithm has two phases:
///
/// 1. **Static pre-filter**: evaluate every cell with the fast heuristic and
///    pick the top `MAX_PIE_CANDIDATES` cells that are most balanced (where the
///    opponent is roughly indifferent between keep and swap).
///
/// 2. **Deep evaluation**: for each candidate, run a short minimax search for
///    both keep and swap scenarios. The opponent will choose whichever is
///    better for them; the bot picks the cell that minimises that advantage.
pub fn choose_pie_opening_with_minimax(game: &GameY, time_ms: u64) -> Option<Coordinates> {
    let bot_player = game.next_player()?;
    let size = game.board_size();

    // ── Phase 1: static pre-filter ──
    let candidates = static_prefilter(game, bot_player);
    if candidates.is_empty() {
        return None;
    }

    // ── Phase 2: deep evaluation of each candidate ──
    // Split the time budget evenly: each candidate gets two mini-searches
    // (keep + swap), so per-search budget = time_ms / (candidates * 2).
    let per_search_ms = (time_ms / (candidates.len() as u64 * 2)).max(20);

    let mut best_cell = candidates[0];
    let mut best_score = i32::MIN;

    for &cell_idx in &candidates {
        let coords = Coordinates::from_index(cell_idx as u32, size);

        // ── Keep scenario ──
        // Bot owns the stone, opponent moves next.
        // Build game with one stone for bot_player, search from opponent's
        // perspective and negate → score for the bot.
        let keep_score = {
            let mut game_copy = game.clone();
            game_copy
                .add_move(Movement::Placement {
                    player: bot_player,
                    coords: coords.clone(),
                })
                .ok();
            // Opponent searches (they move next after keep)
            let opponent = game::other_player(bot_player);
            let mut state = MinimaxState::new(&game_copy, opponent);
            let (_, opp_score) = iterative_deepening_search(&mut state, per_search_ms, per_search_ms);
            -opp_score // negate: opponent's gain is bot's loss
        };

        // ── Swap scenario ──
        // Opponent takes the stone (it becomes theirs), bot moves next.
        let swap_score = {
            let mut game_copy = game.clone();
            let opponent = game::other_player(bot_player);
            game_copy
                .add_move(Movement::Placement {
                    player: opponent,
                    coords: coords.clone(),
                })
                .ok();
            // Bot searches (they move next after swap)
            let mut state = MinimaxState::new(&game_copy, bot_player);
            let (_, bot_score) = iterative_deepening_search(&mut state, per_search_ms, per_search_ms);
            bot_score
        };

        // The opponent picks whichever is worse for the bot.
        // keep_score = how good keeping is for the bot
        // swap_score = how good swapping is for the bot
        // Opponent chooses min(keep_score, swap_score) from bot's perspective.
        let guaranteed = keep_score.min(swap_score);

        println!(
            "Pie opening candidate cell={} keep={} swap={} guaranteed={}",
            cell_idx, keep_score, swap_score, guaranteed
        );

        if guaranteed > best_score {
            best_score = guaranteed;
            best_cell = cell_idx;
        }
    }

    println!("Pie opening chosen: cell={} score={}", best_cell, best_score);
    Some(Coordinates::from_index(best_cell as u32, size))
}

/// Pre-filters cells by static evaluation and returns the most balanced ones.
///
/// "Balanced" means the opponent's advantage from keep vs swap is smallest.
/// Among equally balanced cells, stronger ones are preferred.
fn static_prefilter(game: &GameY, bot_player: PlayerId) -> Vec<usize> {
    let mut state = MinimaxState::new(game, bot_player);
    let cells: SmallVec<[usize; 128]> = state.available_cells().collect();
    if cells.is_empty() {
        return vec![];
    }

    let bot_id = state.bot_id;
    let human_id = state.human_id;

    let mut scored: Vec<(usize, i32)> = cells
        .iter()
        .map(|&cell_idx| {
            // Keep: bot owns the stone
            state.make_move(cell_idx, bot_id);
            let keep_value = evaluate_state(&mut state, bot_id);
            state.undo_move(cell_idx);

            // Swap: opponent takes the stone
            state.make_move(cell_idx, human_id);
            let swap_value = evaluate_state(&mut state, human_id);
            state.undo_move(cell_idx);

            // Balance score: penalise imbalance, reward strength
            let imbalance = (keep_value - swap_value).abs();
            let score = keep_value - imbalance * 2;
            (cell_idx, score)
        })
        .collect();

    scored.sort_unstable_by(|a, b| b.1.cmp(&a.1));
    scored
        .into_iter()
        .take(MAX_PIE_CANDIDATES)
        .map(|(idx, _)| idx)
        .collect()
}
