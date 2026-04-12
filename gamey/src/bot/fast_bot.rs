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
    use crate::{Coordinates, Movement, PlayerId, YBotRegistry};
    use std::sync::Arc;

    // The bot name is used as the HTTP route parameter and as the registry key.
    // A mismatch silently breaks all PvE games at medium difficulty.
    #[test]
    fn test_fast_bot_is_findable_in_registry() {
        let registry = YBotRegistry::new().with_bot(Arc::new(FastBot));
        assert!(
            registry.find("fast_bot").is_some(),
            "FastBot must be retrievable by its own name — name/key mismatch breaks the HTTP API"
        );
    }

    // choose_move must return a cell that actually exists on the board and has
    // not been played yet; returning an occupied or out-of-bounds index would
    // crash the game service when it tries to apply the move.
    #[test]
    fn test_fast_bot_choose_move_returns_available_cell() {
        let game = GameY::new(3);
        let coords = FastBot.choose_move(&game).expect("bot must return a move on a non-empty board");
        let idx = coords.to_index(game.board_size());
        assert!(
            game.available_cells().contains(&idx),
            "chosen cell index {idx} is not in available_cells"
        );
    }

    // After a stone is placed, the bot must not choose the occupied cell.
    // This verifies it reads the live available_cells set, not a stale copy.
    #[test]
    fn test_fast_bot_choose_move_avoids_occupied_cell() {
        let mut game = GameY::new(4);
        let occupied = Coordinates::new(1, 1, 1); // sole interior cell on size-4
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: occupied,
        })
        .unwrap();

        let chosen = FastBot.choose_move(&game).expect("bot must return a move");
        assert_ne!(chosen, occupied, "bot must not choose the already-occupied cell");
        let idx = chosen.to_index(game.board_size());
        assert!(game.available_cells().contains(&idx));
    }

    // choose_pie_opening must also respect the available cells constraint.
    #[test]
    fn test_fast_bot_pie_opening_returns_available_cell() {
        let game = GameY::new(5);
        let coords = FastBot
            .choose_pie_opening(&game)
            .expect("pie opening must return a move on a fresh board");
        let idx = coords.to_index(game.board_size());
        assert!(
            game.available_cells().contains(&idx),
            "pie-opening cell index {idx} is not in available_cells"
        );
    }

    // On a size-4 board, (1,1,1) is the unique interior cell: it touches no
    // side directly, is maximally connected, and has the lowest connection cost
    // to all three sides.  The rational second player should always swap it
    // because owning that stone is better than playing next without it.
    #[test]
    fn test_fast_bot_swaps_strong_center_opening() {
        let mut game = GameY::new(4);
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(1, 1, 1),
        })
        .unwrap();

        let choice = FastBot.decide_pie(&game);
        assert_eq!(
            choice,
            PieChoice::Swap,
            "the unique interior cell on a size-4 board is too strong to keep for the opponent"
        );
    }

    // A corner cell like (4,0,0) on a size-5 board touches sides B and C
    // simultaneously (y=0 and z=0).  FastBot runs minimax with a 500 ms budget
    // and concludes the corner is worth swapping.  Note that SmartBot (2 000 ms)
    // reaches the opposite conclusion — deeper search reveals it is counterable.
    #[test]
    fn test_fast_bot_swaps_corner_touching_two_sides() {
        let mut game = GameY::new(5);
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(4, 0, 0), // corner: touches sides B and C
        })
        .unwrap();

        let choice = FastBot.decide_pie(&game);
        assert_eq!(
            choice,
            PieChoice::Swap,
            "a corner touching 2 sides already covers 2/3 of the win condition — worth swapping"
        );
    }
}
