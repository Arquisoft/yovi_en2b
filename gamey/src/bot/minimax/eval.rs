//! Heuristic evaluation function.

use super::BLOCKED;
use super::LOSE_SCORE;
use super::WIN_SCORE;
use super::state::MinimaxState;

/// Heuristic evaluation from `player`'s perspective.
///
/// Primary component: BFS-based connection cost difference.
///     opponent_cost - own_cost  (positive = good for player)
///
/// Secondary component: incremental score (well-connected pieces, edge touches,
/// centrality) as a tiebreaker.
pub(super) fn evaluate_state(state: &mut MinimaxState, player: u8) -> i32 {
    let opponent = state.opponent_of(player);

    let own_cost = state.connection_cost(player);
    let opp_cost = state.connection_cost(opponent);

    let bfs_score = match (own_cost == BLOCKED, opp_cost == BLOCKED) {
        (true, true) => 0,
        (true, false) => LOSE_SCORE / 2,
        (false, true) => WIN_SCORE / 2,
        (false, false) => (opp_cost as i32 - own_cost as i32) * 150,
    };

    let p_idx = state.player_idx(player);
    let o_idx = 1 - p_idx;
    let game_progress = state.occupied_count as f32 / state.board.len() as f32;
    let incr =
        state.scores[p_idx].evaluate(game_progress) - state.scores[o_idx].evaluate(game_progress);

    bfs_score + incr
}
