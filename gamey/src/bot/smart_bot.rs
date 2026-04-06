//! Smart minimax bot strategy.
//!
//! Uses the minimax engine with a wider time window (1 000 ms min, 3 000 ms max)
//! allowing deeper search at the cost of slower responses.

use crate::{Coordinates, GameY, YBot};

use super::minimax::choose_move_with_minimax;

/// A bot that runs minimax with a 1 000–3 000 ms time budget.
///
/// Corresponds to the `HARD` difficulty level in the game service.
pub struct SmartBot;

impl YBot for SmartBot {
    fn name(&self) -> &str {
        "smart_bot"
    }

    fn choose_move(&self, game: &GameY) -> Option<Coordinates> {
        choose_move_with_minimax(game, 1000, 3000)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_smart_bot_name() {
        assert_eq!(SmartBot.name(), "smart_bot");
    }

    #[test]
    fn test_smart_bot_returns_valid_move() {
        let game = GameY::new(3);
        let coords = SmartBot.choose_move(&game);
        assert!(coords.is_some());
        assert!(coords.unwrap().is_valid(3));
    }
}
