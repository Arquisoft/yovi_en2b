use crate::{Coordinates, GameY, YEN, check_api_version, error::ErrorResponse, state::AppState};
use axum::{
    Json,
    extract::{Path, State},
};
use serde::{Deserialize, Serialize};

/// Path parameters for the pie-opening endpoint.
#[derive(Deserialize)]
pub struct PieOpeningParams {
    api_version: String,
    bot_id: String,
}

/// Response returned by the pie-opening endpoint on success.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct PieOpeningResponse {
    pub api_version: String,
    pub bot_id: String,
    pub coords: Coordinates,
}

/// Handler for the Pie Rule opening-move endpoint.
///
/// When a bot goes first and the Pie Rule is active, it should choose a
/// *balanced* opening rather than the strongest possible move (which the
/// opponent would simply swap). This endpoint calls
/// [`YBot::choose_pie_opening`] instead of [`YBot::choose_move`].
///
/// # Route
/// `POST /{api_version}/ybot/pie-opening/{bot_id}`
///
/// # Request Body
/// A JSON object in YEN format representing the (empty) board.
///
/// # Response
/// On success, returns a [`PieOpeningResponse`] with the chosen coordinates.
#[axum::debug_handler]
pub async fn pie_opening(
    State(state): State<AppState>,
    Path(params): Path<PieOpeningParams>,
    Json(yen): Json<YEN>,
) -> Result<Json<PieOpeningResponse>, Json<ErrorResponse>> {
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

    let coords = match bot.choose_pie_opening(&game_y) {
        Some(coords) => coords,
        None => {
            return Err(Json(ErrorResponse::error(
                "No valid moves available for the bot",
                Some(params.api_version),
                Some(params.bot_id),
            )));
        }
    };

    Ok(Json(PieOpeningResponse {
        api_version: params.api_version,
        bot_id: params.bot_id,
        coords,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pie_opening_response_serialize() {
        let resp = PieOpeningResponse {
            api_version: "v1".to_string(),
            bot_id: "fast_bot".to_string(),
            coords: Coordinates::new(1, 2, 3),
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"api_version\":\"v1\""));
        assert!(json.contains("\"bot_id\":\"fast_bot\""));
    }

    #[test]
    fn test_pie_opening_response_deserialize() {
        let json = r#"{"api_version":"v1","bot_id":"test","coords":{"x":0,"y":1,"z":2}}"#;
        let resp: PieOpeningResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.api_version, "v1");
        assert_eq!(resp.bot_id, "test");
    }
}
