use crate::{GameY, PieChoice, YEN, check_api_version, error::ErrorResponse, state::AppState};
use axum::{
    Json,
    extract::{Path, State},
};
use serde::{Deserialize, Serialize};

/// Path parameters for the pie-decide endpoint.
#[derive(Deserialize)]
pub struct PieDecideParams {
    api_version: String,
    bot_id: String,
}

/// Response returned by the pie-decide endpoint.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct PieDecideResponse {
    pub api_version: String,
    pub bot_id: String,
    pub decision: PieChoice,
}

/// Handler for the Pie Rule decision endpoint.
///
/// Given a board with exactly one stone placed by the opponent, the bot
/// evaluates both futures (keep vs swap) and returns its choice.
///
/// # Route
/// `POST /{api_version}/ybot/pie-decide/{bot_id}`
///
/// # Request Body
/// A JSON object in YEN format. The board should contain one stone and
/// indicate that it is the bot's turn (the deciding side).
///
/// # Response
/// On success, returns a [`PieDecideResponse`] with the bot's decision.
#[axum::debug_handler]
pub async fn pie_decide(
    State(state): State<AppState>,
    Path(params): Path<PieDecideParams>,
    Json(yen): Json<YEN>,
) -> Result<Json<PieDecideResponse>, Json<ErrorResponse>> {
    check_api_version(&params.api_version)?;

    let game_y = match GameY::try_from(yen) {
        Ok(game) => game,
        Err(err) => {
            return Err(Json(ErrorResponse::error(
                &format!("Invalid YEN format: {}", err),
                Some(params.api_version),
                Some(params.bot_id),
            )));
        }
    };

    let bot = match state.bots().find(&params.bot_id) {
        Some(bot) => bot,
        None => {
            let available = state.bots().names().join(", ");
            return Err(Json(ErrorResponse::error(
                &format!(
                    "Bot not found: {}, available bots: [{}]",
                    params.bot_id, available
                ),
                Some(params.api_version),
                Some(params.bot_id),
            )));
        }
    };

    let decision = bot.decide_pie(&game_y);

    Ok(Json(PieDecideResponse {
        api_version: params.api_version,
        bot_id: params.bot_id,
        decision,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pie_decide_response_serialize() {
        let resp = PieDecideResponse {
            api_version: "v1".to_string(),
            bot_id: "fast_bot".to_string(),
            decision: PieChoice::Swap,
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"decision\":\"swap\""));
    }

    #[test]
    fn test_pie_decide_response_deserialize() {
        let json = r#"{"api_version":"v1","bot_id":"test","decision":"keep"}"#;
        let resp: PieDecideResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.decision, PieChoice::Keep);
    }
}
