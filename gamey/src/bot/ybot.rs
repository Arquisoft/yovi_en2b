use crate::{Coordinates, GameY};
use serde::{Deserialize, Serialize};

/// The outcome of a Pie Rule decision.
///
/// After the first stone is placed, the second player may either **keep** their
/// current side or **swap** (take ownership of the first stone, giving the
/// initiative back to the opponent).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PieChoice {
    /// Keep the current sides — the decider plays next as normal.
    Keep,
    /// Swap — the first stone changes ownership and the original player
    /// gets the next move.
    Swap,
}

/// Trait representing a Y game bot (YBot)
///
/// A YBot is an AI that can choose moves in the game of Y.
/// Implementors of this trait must provide a name and a method to choose a move
/// given the current game state.
///
/// Additional methods provide extension points for game rules like the Pie Rule.
/// Default implementations ensure backward compatibility: bots that don't
/// override these methods will fall back to sensible behaviour.
pub trait YBot: Send + Sync {
    /// Returns the name of the bot.
    fn name(&self) -> &str;

    /// Chooses a move based on the current game state.
    fn choose_move(&self, board: &GameY) -> Option<Coordinates>;

    /// Chooses a balanced opening move under the Pie Rule.
    ///
    /// When the bot goes first and the Pie Rule is active, the opponent will
    /// decide whether to keep or swap after seeing this move. An overly strong
    /// opening will be swapped; an overly weak one wastes the turn. This method
    /// should return a move that is resilient to either choice.
    ///
    /// The default implementation falls back to [`choose_move`](YBot::choose_move).
    fn choose_pie_opening(&self, board: &GameY) -> Option<Coordinates> {
        self.choose_move(board)
    }

    /// Decides whether to **keep** or **swap** under the Pie Rule.
    ///
    /// Called when the bot is the second player and the first stone has just
    /// been placed. The provided `board` contains exactly one stone owned by
    /// the opponent, and it is the bot's turn to move.
    ///
    /// The default implementation always keeps.
    fn decide_pie(&self, _board: &GameY) -> PieChoice {
        PieChoice::Keep
    }
}
