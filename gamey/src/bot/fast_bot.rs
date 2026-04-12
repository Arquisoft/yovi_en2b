//! Fast minimax bot strategy.
//!
//! Uses the minimax engine with tight time limits (500 ms min/max) for quick
//! responses at the cost of shallower search depth.

use crate::{Coordinates, GameY, YBot};

use super::minimax::{
    choose_move_with_minimax, choose_pie_opening_with_minimax, decide_pie_with_minimax,
};
use super::ybot::PieChoice;

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

    fn choose_pie_opening(&self, game: &GameY) -> Option<Coordinates> {
        choose_pie_opening_with_minimax(game, 500)
    }

    fn decide_pie(&self, game: &GameY) -> PieChoice {
        decide_pie_with_minimax(game, 500)
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

    #[test]
    fn test_fast_bot_pie_opening_returns_valid_move() {
        let game = GameY::new(3);
        let coords = FastBot.choose_pie_opening(&game);
        assert!(coords.is_some());
        assert!(coords.unwrap().is_valid(3));
    }

    #[test]
    fn test_fast_bot_decide_pie_returns_a_choice() {
        use crate::{Coordinates, Movement, PlayerId};

        let mut game = GameY::new(5);
        // Place one stone for player 0 (the opponent).
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(2, 1, 1),
        })
        .unwrap();

        let choice = FastBot.decide_pie(&game);
        assert!(choice == PieChoice::Keep || choice == PieChoice::Swap);
    }
}
