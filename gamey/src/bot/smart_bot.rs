//! Smart minimax bot strategy.
//!
//! Uses the minimax engine with a wider time window (1 000 ms min, 3 000 ms max)
//! allowing deeper search at the cost of slower responses.

use crate::{Coordinates, GameY, YBot};

use super::minimax::{choose_move_with_minimax, choose_pie_opening_with_minimax, decide_pie_with_minimax};
use super::ybot::PieChoice;

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

    fn choose_pie_opening(&self, game: &GameY) -> Option<Coordinates> {
        choose_pie_opening_with_minimax(game, 2000)
    }

    fn decide_pie(&self, game: &GameY) -> PieChoice {
        decide_pie_with_minimax(game, 2000)
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

    #[test]
    fn test_smart_bot_pie_opening_returns_valid_move() {
        let game = GameY::new(3);
        let coords = SmartBot.choose_pie_opening(&game);
        assert!(coords.is_some());
        assert!(coords.unwrap().is_valid(3));
    }

    #[test]
    fn test_smart_bot_decide_pie_returns_a_choice() {
        use crate::{Coordinates, Movement, PlayerId};

        let mut game = GameY::new(5);
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(2, 1, 1),
        })
        .unwrap();

        let choice = SmartBot.decide_pie(&game);
        assert!(choice == PieChoice::Keep || choice == PieChoice::Swap);
    }
}
