//! Fast minimax bot strategy.
//!
//! Uses the minimax engine with tight time limits (500 ms min/max) for quick
//! responses at the cost of shallower search depth.

use crate::{Coordinates, GameY, YBot};

use super::minimax::choose_move_with_minimax;

/// A bot that runs minimax with a 500 ms time budget on both gates.
///
/// Corresponds to the `MEDIUM` difficulty level in the game service.
pub struct FastBot;

impl YBot for FastBot {
    fn name(&self) -> &str {
        "fast_bot"
    }

    fn choose_move(&self, game: &GameY) -> Option<Coordinates> {
        choose_move_with_minimax(game, 500, 500)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fast_bot_name() {
        assert_eq!(FastBot.name(), "fast_bot");
    }

    #[test]
    fn test_fast_bot_returns_valid_move() {
        let game = GameY::new(3);
        let coords = FastBot.choose_move(&game);
        assert!(coords.is_some());
        assert!(coords.unwrap().is_valid(3));
    }
}
