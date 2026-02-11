use crate::{GameStatus, GameY, PlayerId, game, minimax};

pub fn evaluate_board(game: &GameY, bot_player: PlayerId) -> i32 {
    if let &GameStatus::Finished { winner } = game.status() {
        return if winner == bot_player {
            minimax::WIN_SCORE
        } else {
            minimax::LOSE_SCORE
        };
    }

    let opponent = game::other_player(bot_player);

    // En lugar de ir a los bordes, peleamos por el centro
    let my_center = center_control_score(game, bot_player);
    let opp_center = center_control_score(game, opponent);

    // Usa la resta CORRECTA, pero con la métrica CORRECTA
    my_center - opp_center
}

fn center_control_score(game: &GameY, player: PlayerId) -> i32 {
    let mut score = 0;

    for (coords, (_, owner)) in game.board_map().iter() {
        if *owner == player {
            let x = coords.x() as i32;
            let y = coords.y() as i32;
            let z = coords.z() as i32;

            let off_center = (x - y).abs() + (y - z).abs() + (z - x).abs();

            score += 300 - off_center;
        }
    }
    score
}
