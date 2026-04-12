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
    use crate::{Coordinates, Movement, PlayerId, YBotRegistry};
    use std::sync::Arc;

    // The bot name is the registry key used in HTTP routes.
    // A mismatch silently breaks all PvE games at hard difficulty.
    #[test]
    fn test_smart_bot_is_findable_in_registry() {
        let registry = YBotRegistry::new().with_bot(Arc::new(SmartBot));
        assert!(
            registry.find("smart_bot").is_some(),
            "SmartBot must be retrievable by its own name — name/key mismatch breaks the HTTP API"
        );
    }

    // choose_move must return a cell that actually exists in available_cells;
    // returning an occupied or out-of-bounds index would crash the game service.
    #[test]
    fn test_smart_bot_choose_move_returns_available_cell() {
        let game = GameY::new(3);
        let coords = SmartBot.choose_move(&game).expect("bot must return a move on a non-empty board");
        let idx = coords.to_index(game.board_size());
        assert!(
            game.available_cells().contains(&idx),
            "chosen cell index {idx} is not in available_cells"
        );
    }

    // After an opponent stone is placed, the bot must not select that cell.
    #[test]
    fn test_smart_bot_choose_move_avoids_occupied_cell() {
        let mut game = GameY::new(4);
        let occupied = Coordinates::new(1, 1, 1);
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: occupied,
        })
        .unwrap();

        let chosen = SmartBot.choose_move(&game).expect("bot must return a move");
        assert_ne!(chosen, occupied, "bot must not choose the already-occupied cell");
        let idx = chosen.to_index(game.board_size());
        assert!(game.available_cells().contains(&idx));
    }

    // choose_pie_opening must also respect the available cells constraint.
    #[test]
    fn test_smart_bot_pie_opening_returns_available_cell() {
        let game = GameY::new(3);
        let coords = SmartBot
            .choose_pie_opening(&game)
            .expect("pie opening must return a move on a fresh board");
        let idx = coords.to_index(game.board_size());
        assert!(
            game.available_cells().contains(&idx),
            "pie-opening cell index {idx} is not in available_cells"
        );
    }

    // The unique interior cell of a size-4 board is strongly dominant.
    // A deeper search (SmartBot uses 2 000 ms per scenario) should confidently
    // identify this as a swap.
    #[test]
    fn test_smart_bot_swaps_strong_center_opening() {
        let mut game = GameY::new(4);
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(1, 1, 1),
        })
        .unwrap();

        let choice = SmartBot.decide_pie(&game);
        assert_eq!(
            choice,
            PieChoice::Swap,
            "the unique interior cell on a size-4 board is too strong to keep for the opponent"
        );
    }

    // A corner cell like (4,0,0) touches sides B and C simultaneously.
    // Two sides covered from a single stone is a strong head-start in Y;
    // SmartBot with a deeper search should also swap it.
    #[test]
    fn test_smart_bot_swaps_corner_touching_two_sides() {
        let mut game = GameY::new(5);
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(4, 0, 0), // corner: touches sides B and C
        })
        .unwrap();

        let choice = SmartBot.decide_pie(&game);
        assert_eq!(
            choice,
            PieChoice::Swap,
            "a corner touching 2 sides already covers 2/3 of the win condition — worth swapping"
        );
    }
}
