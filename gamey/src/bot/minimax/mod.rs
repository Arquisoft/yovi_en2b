//! Minimax search engine for the Game of Y.
//!
//! Provides the core alpha-beta search with iterative deepening, transposition
//! tables, killer moves, history heuristic, and Pie Rule support.
//!
//! The engine is parameterised by a [`Goal`] that interprets terminal positions:
//! standard Y (connecting all three sides wins) and misère / WhY Not?
//! (connecting all three sides loses) reuse the same search machinery and only
//! differ in how a completed connection is scored.

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

/// Goal that the minimax search optimises for.
///
/// Both variants share the same search tree, move generation, and incremental
/// state updates. The only differences are how a completed three-side
/// connection is scored at terminal nodes and how the heuristic evaluation is
/// signed at non-terminal nodes.
///
/// Add a new variant here to plug in a new family of objectives — the search
/// engine itself does not need to change.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Goal {
    /// Standard Y: connecting all three sides is a **win** for the connector.
    Standard,
    /// WhY Not? (misère): connecting all three sides is a **loss** for the
    /// connector. The bot's objective is therefore to avoid completing its own
    /// connection while forcing the opponent to complete theirs.
    Misere,
}

impl Goal {
    /// Score returned when the side-to-move just completed a three-side
    /// connection — viewed from that player's perspective.
    #[inline]
    pub(crate) fn terminal_on_connection(self) -> i32 {
        match self {
            Goal::Standard => WIN_SCORE,
            Goal::Misere => LOSE_SCORE,
        }
    }

    /// Sign multiplier applied to the heuristic evaluation. In misère the
    /// heuristic — which favours short connection paths and well-connected
    /// pieces — must be negated because being close to connecting is bad.
    #[inline]
    pub(crate) fn heuristic_sign(self) -> i32 {
        match self {
            Goal::Standard => 1,
            Goal::Misere => -1,
        }
    }
}

// Public API re-exports.
pub use pie::{choose_pie_opening_with_minimax, decide_pie_with_minimax};
pub use search::choose_move_with_minimax;
