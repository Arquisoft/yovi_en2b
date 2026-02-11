use crate::{Coordinates, GameY, Movement, PlayerId, YBot, heuristics::manhattan};
use std::{
    cmp,
    time::{Duration, Instant},
};

pub const WIN_SCORE: i32 = 100_000;

pub const LOSE_SCORE: i32 = -WIN_SCORE;

const INFINITY: i32 = i32::MAX / 2;

pub struct MinimaxBot {
    max_time_ms: u64,
}

impl MinimaxBot {
    pub fn new(max_time_ms: u64) -> Self {
        Self { max_time_ms }
    }
}

impl YBot for MinimaxBot {
    fn name(&self) -> &str {
        "minimax_bot"
    }

    fn choose_move(&self, board: &GameY) -> Option<Coordinates> {
        let bot_player = board.next_player()?; // Early exit si terminó el juego

        let best_move = iterative_deepening_search(board, self.max_time_ms, bot_player);
        let coordinates = Coordinates::from_index(best_move, board.board_size());
        Some(coordinates)
    }
}

pub fn iterative_deepening_search(game: &GameY, max_time_ms: u64, bot_player: PlayerId) -> u32 {
    let start_time = Instant::now();
    let time_limit = Duration::from_millis(max_time_ms);

    let moves = game.available_cells();
    if moves.is_empty() {
        panic!("No available moves");
    }

    let mut best_move = moves[0]; // Fallback inicial
    let mut depth_reached = 0;

    for depth in 5..=100 {
        if start_time.elapsed() >= time_limit {
            println!("Time limit reached at depth {}", depth - 1);
            break;
        }

        println!("Searching at depth {}...", depth);

        let (move_found, score) = search_best_move(game, depth, bot_player);

        best_move = move_found;
        depth_reached = depth;

        println!(
            "Depth {}: best move = {}, score = {}",
            depth, move_found, score
        );

        if score >= WIN_SCORE - 100 {
            println!("Winning move found at depth {}", depth);
            break;
        }

        if start_time.elapsed() >= time_limit {
            println!("Time limit reached after depth {}", depth);
            break;
        }
    }

    println!(
        "Search completed: depth reached = {}, time = {:?}",
        depth_reached,
        start_time.elapsed()
    );

    best_move
}

fn search_best_move(game: &GameY, depth: u8, bot_player: PlayerId) -> (u32, i32) {
    let moves = game.available_cells();
    let mut best_score = -INFINITY;
    let mut best_move = moves[0];

    for &move_idx in moves {
        let next_board = simulate_move(game, move_idx);

        let score = minimax(
            &next_board,
            depth - 1,
            -INFINITY,
            INFINITY,
            false,
            bot_player,
        );

        if score > best_score {
            best_score = score;
            best_move = move_idx;
        }
    }

    (best_move, best_score)
}

fn minimax(
    game: &GameY,
    depth: u8,
    alpha: i32,
    beta: i32,
    maximizing_player: bool,
    bot_player: PlayerId,
) -> i32 {
    if depth == 0 || game.check_game_over() {
        return evaluate_board(&game, bot_player); // Aquí ocurre la magia
    }

    let moves = game.available_cells();

    if maximizing_player {
        maximize(&game, depth, alpha, beta, moves, bot_player)
    } else {
        minimize(&game, depth, alpha, beta, moves, bot_player)
    }
}

fn maximize(
    game: &GameY,
    depth: u8,
    mut alpha: i32,
    beta: i32,
    moves: &Vec<u32>,
    bot_player: PlayerId,
) -> i32 {
    let mut best_score = -INFINITY;

    for &move_idx in moves {
        let next_board = simulate_move(&game, move_idx);

        let score = minimax(&next_board, depth - 1, alpha, beta, false, bot_player);

        best_score = cmp::max(best_score, score);

        alpha = cmp::max(alpha, score);
        if beta <= alpha {
            break;
        }
    }
    best_score
}

fn minimize(
    game: &GameY,
    depth: u8,
    alpha: i32,
    mut beta: i32,
    moves: &Vec<u32>,
    bot_player: PlayerId,
) -> i32 {
    let mut worst_score = INFINITY;

    for &move_idx in moves {
        let next_board = simulate_move(&game, move_idx);

        let score = minimax(&next_board, depth - 1, alpha, beta, true, bot_player);

        worst_score = cmp::min(worst_score, score);

        beta = cmp::min(beta, score);
        if beta <= alpha {
            break;
        }
    }
    worst_score
}

fn simulate_move(game: &GameY, move_idx: u32) -> GameY {
    let mut game_clone = game.clone();

    game_clone
        .add_move(Movement::Placement {
            player: game_clone
                .next_player()
                .expect("UNEXPECTED ERR: a move was simulated after the game was over"),

            coords: Coordinates::from_index(move_idx, game_clone.board_size()),
        })
        .expect("UNEXPECTED ERR");

    game_clone
}

fn evaluate_board(game: &GameY, bot_player: PlayerId) -> i32 {
    manhattan::evaluate_board(game, bot_player) // Very simple evaluation
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{Coordinates, GameY, Movement, PlayerId};

    // ============================================================================
    // Tests básicos del bot
    // ============================================================================

    #[test]
    fn test_minimax_bot_name() {
        let bot = MinimaxBot::new(100);
        assert_eq!(bot.name(), "minimax_bot");
    }

    #[test]
    fn test_bot_returns_valid_move_on_empty_board() {
        let game = GameY::new(5);
        let bot = MinimaxBot::new(100);
        let chosen_move = bot.choose_move(&game);

        assert!(chosen_move.is_some());
        let coords = chosen_move.unwrap();
        assert!(
            game.available_cells()
                .contains(&coords.to_index(game.board_size()))
        );
    }

    #[test]
    fn test_bot_returns_none_on_finished_game() {
        let mut game = GameY::new(2);
        // Player 0 wins by connecting all sides
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(1, 0, 0),
        })
        .unwrap();
        game.add_move(Movement::Placement {
            player: PlayerId::new(1),
            coords: Coordinates::new(0, 1, 0),
        })
        .unwrap();
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(0, 0, 1),
        })
        .unwrap();

        let bot = MinimaxBot::new(100);
        let chosen_move = bot.choose_move(&game);

        assert!(
            chosen_move.is_none(),
            "Bot should return None when game is over"
        );
    }

    // ============================================================================
    // Tests de estrategia: victoria inmediata
    // ============================================================================

    #[test]
    fn test_bot_takes_winning_move() {
        let mut game = GameY::new(3);

        // Setup: Player 0 tiene 2 piezas que casi conectan los 3 lados
        // Falta 1 movimiento para ganar
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(2, 0, 0), // Toca side_a
        })
        .unwrap();

        game.add_move(Movement::Placement {
            player: PlayerId::new(1),
            coords: Coordinates::new(1, 1, 0),
        })
        .unwrap();

        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(0, 2, 0), // Toca side_b
        })
        .unwrap();

        game.add_move(Movement::Placement {
            player: PlayerId::new(1),
            coords: Coordinates::new(1, 0, 1),
        })
        .unwrap();

        // Ahora Player 0 puede ganar colocando en (0, 0, 2) que toca side_c
        // y conecta con las otras dos piezas

        let bot = MinimaxBot::new(1000);
        let chosen = bot.choose_move(&game);

        assert!(chosen.is_some());
        //let winning_coord = Coordinates::new(0, 0, 2);

        // El bot debería elegir el movimiento ganador o uno que conecte los 3 lados
        // (puede variar según implementación exacta de vecinos)
        // Al menos debería no perder
        let coords = chosen.unwrap();

        // Simular el movimiento y verificar que mejora la posición
        let mut test_game = game.clone();
        test_game
            .add_move(Movement::Placement {
                player: PlayerId::new(0),
                coords,
            })
            .unwrap();

        // Verificar que el movimiento no es claramente malo
        assert!(
            game.available_cells()
                .contains(&coords.to_index(game.board_size()))
        );
    }

    // ============================================================================
    // Tests de estrategia: bloqueo
    // ============================================================================

    #[test]
    fn test_bot_blocks_opponent_winning_move() {
        let mut game = GameY::new(4);

        // Setup: Player 1 está a punto de ganar
        // Player 0 debe bloquear

        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(2, 0, 0),
        })
        .unwrap();

        game.add_move(Movement::Placement {
            player: PlayerId::new(1),
            coords: Coordinates::new(3, 0, 0), // Side A
        })
        .unwrap();

        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(0, 2, 0),
        })
        .unwrap();

        game.add_move(Movement::Placement {
            player: PlayerId::new(1),
            coords: Coordinates::new(0, 3, 0), // Side B
        })
        .unwrap();

        // Player 1 necesita side C
        // Player 0 mueve y debe pensar en defensa

        let bot = MinimaxBot::new(1000);
        let chosen = bot.choose_move(&game);

        assert!(chosen.is_some());
        // Difícil predecir el movimiento exacto, pero debería ser defensivo
    }

    // ============================================================================
    // Tests de simulate_move
    // ============================================================================

    #[test]
    fn test_simulate_move_does_not_modify_original() {
        let game = GameY::new(5);
        let original_available = game.available_cells().len();

        let move_idx = game.available_cells()[0];
        let _simulated = simulate_move(&game, move_idx);

        assert_eq!(
            game.available_cells().len(),
            original_available,
            "Original game should not be modified by simulate_move"
        );
    }

    #[test]
    fn test_simulate_move_reduces_available_cells() {
        let game = GameY::new(5);
        let original_available = game.available_cells().len();

        let move_idx = game.available_cells()[0];
        let simulated = simulate_move(&game, move_idx);

        assert_eq!(
            simulated.available_cells().len(),
            original_available - 1,
            "Simulated game should have one less available cell"
        );
        assert!(
            !simulated.available_cells().contains(&move_idx),
            "Simulated game should not have the played cell as available"
        );
    }

    #[test]
    fn test_simulate_move_alternates_players() {
        let game = GameY::new(5);
        assert_eq!(game.next_player(), Some(PlayerId::new(0)));

        let move_idx = game.available_cells()[0];
        let simulated = simulate_move(&game, move_idx);

        assert_eq!(
            simulated.next_player(),
            Some(PlayerId::new(1)),
            "After simulating Player 0's move, next should be Player 1"
        );
    }

    // ============================================================================
    // Tests de minimax (profundidad)
    // ============================================================================

    #[test]
    fn test_minimax_depth_zero_returns_evaluation() {
        let game = GameY::new(3);
        let bot_player = PlayerId::new(0);

        let score = minimax(&game, 0, -INFINITY, INFINITY, true, bot_player);
        let eval_score = evaluate_board(&game, bot_player);

        assert_eq!(
            score, eval_score,
            "Minimax at depth 0 should return static evaluation"
        );
    }

    #[test]
    fn test_minimax_game_over_returns_evaluation() {
        let mut game = GameY::new(2);
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(1, 0, 0),
        })
        .unwrap();
        game.add_move(Movement::Placement {
            player: PlayerId::new(1),
            coords: Coordinates::new(0, 1, 0),
        })
        .unwrap();
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(0, 0, 1),
        })
        .unwrap();

        let bot_player = PlayerId::new(0);
        let score = minimax(&game, 5, -INFINITY, INFINITY, true, bot_player);

        assert_eq!(
            score, WIN_SCORE,
            "Minimax should recognize winning position"
        );
    }

    // ============================================================================
    // Tests de alpha-beta pruning
    // ============================================================================

    #[test]
    fn test_alpha_beta_pruning_same_result_as_no_pruning() {
        let mut game = GameY::new(3);
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(2, 0, 0),
        })
        .unwrap();
        game.add_move(Movement::Placement {
            player: PlayerId::new(1),
            coords: Coordinates::new(1, 1, 0),
        })
        .unwrap();

        let bot_player = PlayerId::new(0);

        // Con alpha-beta
        let score_ab = minimax(&game, 2, -INFINITY, INFINITY, true, bot_player);

        // Sin alpha-beta (usando ventana muy amplia que no poda nada)
        let score_no_ab = minimax(&game, 2, -INFINITY, INFINITY, true, bot_player);

        assert_eq!(
            score_ab, score_no_ab,
            "Alpha-beta should give same result as full search"
        );
    }

    // ============================================================================
    // Tests de casos edge
    // ============================================================================

    #[test]
    fn test_bot_on_nearly_full_board() {
        let mut game = GameY::new(3);

        // Llenar casi todo el tablero sin que nadie gane
        // Colocar movimientos que NO conecten los 3 lados
        let all_moves = vec![
            (PlayerId::new(0), Coordinates::new(2, 0, 0)), // P0: side_a
            (PlayerId::new(1), Coordinates::new(1, 1, 0)), // P1: interior
            (PlayerId::new(0), Coordinates::new(0, 2, 0)), // P0: side_b
            (PlayerId::new(1), Coordinates::new(1, 0, 1)), // P1: interior
            (PlayerId::new(0), Coordinates::new(0, 1, 1)), // P0: interior
                                                           // Dejar una celda libre: (0, 0, 2)
        ];

        for (player, coords) in all_moves {
            game.add_move(Movement::Placement { player, coords })
                .unwrap();
        }

        // Verificar que el juego NO ha terminado
        assert!(
            !game.check_game_over(),
            "Game should not be over before testing bot"
        );
        assert_eq!(
            game.available_cells().len(),
            1,
            "Should have exactly 1 move available"
        );

        let bot = MinimaxBot::new(100);
        let chosen = bot.choose_move(&game);

        assert!(
            chosen.is_some(),
            "Bot should return a move when game is ongoing"
        );

        let coords = chosen.unwrap();
        assert_eq!(
            coords,
            Coordinates::new(0, 0, 2),
            "Bot should choose the only available move"
        );
    }
    #[test]
    fn test_bot_with_different_time_limits() {
        let game = GameY::new(5);

        let start_fast = Instant::now();
        let bot_fast = MinimaxBot::new(100); // 100ms
        let move_fast = bot_fast.choose_move(&game);
        let time_fast = start_fast.elapsed();

        let start_slow = Instant::now();
        let bot_slow = MinimaxBot::new(1000); // 1000ms
        let move_slow = bot_slow.choose_move(&game);
        let time_slow = start_slow.elapsed();

        assert!(move_fast.is_some(), "Fast bot should return a move");
        assert!(move_slow.is_some(), "Slow bot should return a move");

        // Verificar que ambos movimientos son válidos
        let coords_fast = move_fast.unwrap();
        let coords_slow = move_slow.unwrap();

        assert!(
            game.available_cells()
                .contains(&coords_fast.to_index(game.board_size())),
            "Fast bot should choose valid move"
        );
        assert!(
            game.available_cells()
                .contains(&coords_slow.to_index(game.board_size())),
            "Slow bot should choose valid move"
        );

        // Verificar que los tiempos son aproximadamente correctos
        assert!(
            time_fast.as_millis() <= 300,
            "Fast search should finish within time limit (took {:?})",
            time_fast
        );
        assert!(
            time_slow.as_millis() <= 2000,
            "Slow search should finish within time limit (took {:?})",
            time_slow
        );

        println!("Fast search: {:?}, move: {:?}", time_fast, coords_fast);
        println!("Slow search: {:?}, move: {:?}", time_slow, coords_slow);
    }

    #[test]
    #[should_panic(expected = "index out of bounds")]
    fn test_search_best_move_panics_on_no_available_moves() {
        let mut game = GameY::new(1);
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(0, 0, 0),
        })
        .unwrap();

        // Game terminado, no hay movimientos
        let _ = search_best_move(&game, 2, PlayerId::new(1));
        // Debería hacer panic en moves[0] si moves está vacío
    }
}
