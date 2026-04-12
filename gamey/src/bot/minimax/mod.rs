//! Minimax search engine for the Game of Y.
//!
//! Provides the core alpha-beta search with iterative deepening, transposition
//! tables, killer moves, history heuristic, and Pie Rule support.

mod eval;
mod pie;
mod search;
mod state;
mod tables;

#[cfg(test)]
mod tests;

// Shared constants used across submodules.
pub(crate) const WIN_SCORE: i32 = 100_000;
pub(crate) const LOSE_SCORE: i32 = -WIN_SCORE;
pub(crate) const INFINITY: i32 = i32::MAX / 2;

/// Sentinel returned by `negamax` when the hard time limit is exceeded.
pub(crate) const ABORTED: i32 = i32::MIN;

/// BFS distance assigned to cells owned by the opponent (impassable).
pub(crate) const BLOCKED: u32 = u32::MAX;

// Public API re-exports.
pub use pie::{choose_pie_opening_with_minimax, decide_pie_with_minimax};
pub use search::choose_move_with_minimax;
