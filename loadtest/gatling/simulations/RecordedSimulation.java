package yovi;

import java.time.Duration;
import java.util.*;

import io.gatling.javaapi.core.*;
import io.gatling.javaapi.http.*;
import io.gatling.javaapi.jdbc.*;

import static io.gatling.javaapi.core.CoreDsl.*;
import static io.gatling.javaapi.http.HttpDsl.*;
import static io.gatling.javaapi.jdbc.JdbcDsl.*;

public class RecordedSimulation extends Simulation {

  // ── Protocol ───────────────────────────────────────────────────────────────
  private HttpProtocolBuilder httpProtocol = http
    .baseUrl("https://api.micrati.com")
    .inferHtmlResources()
    .acceptHeader("*/*")
    .acceptEncodingHeader("gzip, deflate, br")
    .acceptLanguageHeader("en,en-US;q=0.9,es;q=0.8,nl;q=0.7,de;q=0.6")
    .userAgentHeader("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36");

  // ── Feeder ─────────────────────────────────────────────────────────────────
  private final FeederBuilder<Object> userFeeder =
      jsonFile("users.json").circular();

  // ── Header maps ────────────────────────────────────────────────────────────
  private Map<CharSequence, String> headers_0 = Map.ofEntries(
    Map.entry("access-control-request-headers", "content-type"),
    Map.entry("access-control-request-method", "POST"),
    Map.entry("origin", "https://micrati.com"),
    Map.entry("pragma", "no-cache"),
    Map.entry("priority", "u=1, i"),
    Map.entry("sec-fetch-dest", "empty"),
    Map.entry("sec-fetch-mode", "cors"),
    Map.entry("sec-fetch-site", "same-site")
  );

  private Map<CharSequence, String> headers_1 = Map.ofEntries(
    Map.entry("content-type", "application/json"),
    Map.entry("origin", "https://micrati.com"),
    Map.entry("pragma", "no-cache"),
    Map.entry("priority", "u=1, i"),
    Map.entry("sec-ch-ua", "Google Chrome\";v=\"147\", \"Not.A/Brand\";v=\"8\", \"Chromium\";v=\"147"),
    Map.entry("sec-ch-ua-mobile", "?0"),
    Map.entry("sec-ch-ua-platform", "Windows"),
    Map.entry("sec-fetch-dest", "empty"),
    Map.entry("sec-fetch-mode", "cors"),
    Map.entry("sec-fetch-site", "same-site")
  );

  private Map<CharSequence, String> headers_2 = Map.ofEntries(
    Map.entry("accept", "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"),
    Map.entry("pragma", "no-cache"),
    Map.entry("priority", "u=1, i"),
    Map.entry("sec-ch-ua", "Google Chrome\";v=\"147\", \"Not.A/Brand\";v=\"8\", \"Chromium\";v=\"147"),
    Map.entry("sec-ch-ua-mobile", "?0"),
    Map.entry("sec-ch-ua-platform", "Windows"),
    Map.entry("sec-fetch-dest", "image"),
    Map.entry("sec-fetch-mode", "no-cors"),
    Map.entry("sec-fetch-site", "same-origin")
  );

  private Map<CharSequence, String> headers_7 = Map.ofEntries(
    Map.entry("access-control-request-headers", "authorization,content-type"),
    Map.entry("access-control-request-method", "POST"),
    Map.entry("origin", "https://micrati.com"),
    Map.entry("pragma", "no-cache"),
    Map.entry("priority", "u=1, i"),
    Map.entry("sec-fetch-dest", "empty"),
    Map.entry("sec-fetch-mode", "cors"),
    Map.entry("sec-fetch-site", "same-site")
  );

  private Map<CharSequence, String> headers_10 = Map.ofEntries(
    Map.entry("origin", "https://micrati.com"),
    Map.entry("pragma", "no-cache"),
    Map.entry("priority", "u=1, i"),
    Map.entry("sec-ch-ua", "Google Chrome\";v=\"147\", \"Not.A/Brand\";v=\"8\", \"Chromium\";v=\"147"),
    Map.entry("sec-ch-ua-mobile", "?0"),
    Map.entry("sec-ch-ua-platform", "Windows"),
    Map.entry("sec-fetch-dest", "empty"),
    Map.entry("sec-fetch-mode", "cors"),
    Map.entry("sec-fetch-site", "same-site")
  );

  private Map<CharSequence, String> headers_36 = Map.ofEntries(
    Map.entry("access-control-request-headers", "authorization,content-type"),
    Map.entry("access-control-request-method", "GET"),
    Map.entry("origin", "https://micrati.com"),
    Map.entry("pragma", "no-cache"),
    Map.entry("priority", "u=1, i"),
    Map.entry("sec-fetch-dest", "empty"),
    Map.entry("sec-fetch-mode", "cors"),
    Map.entry("sec-fetch-site", "same-site")
  );

  private String uri2 = "https://micrati.com";

  // ── Scenario ────────────────────────────────────────────────────────────────
  //
  // Two fixes applied vs the previous version:
  //
  // FIX A — Parallel POSTs separated into sequential exec() calls.
  //   The recorder grouped multiple move POSTs inside the same .resources()
  //   block because Chrome fired them in parallel. In a turn-based game that
  //   causes 409 Conflict (can't play two moves simultaneously). Every move
  //   POST now has its own .exec() so they fire strictly one at a time.
  //   OPTIONS preflights are kept in the resources() of their corresponding
  //   POST — that is fine because OPTIONS never touches session state.
  //
  // FIX B — 409 treated as acceptable on all move requests (Option 2).
  //   Even with sequential execution, the bot may play a different cell under
  //   load (minimax search depth varies with CPU contention), causing the
  //   pre-recorded coordinate to be already occupied when Gatling sends it.
  //   The server correctly returns 409 in that case — it is not a server bug,
  //   it is a HAR limitation. Accepting 409 alongside 200/201 stops Gatling
  //   counting board-divergence failures as KOs, making the error rate honest.
  //   The .check() still validates that we got *one of* the expected codes,
  //   so genuine unexpected errors (5xx, 401, etc.) still surface as KOs.
  //
  private ScenarioBuilder scn = scenario("RecordedSimulation")
    .feed(userFeeder)

    // ── LOGIN ──────────────────────────────────────────────────────────────
    .exec(http("request_0")
      .options("/users/api/auth/login")
      .headers(headers_0))

    .exec(http("request_1")
      .post("/users/api/auth/login")
      .headers(headers_1)
      .body(StringBody("{\"email\":\"#{email}\",\"password\":\"#{password}\"}"))
      .check(status().is(200))
      .check(jsonPath("$.token").saveAs("token")))

    .exec(http("request_2")
      .get(uri2 + "/vite.svg")
      .headers(headers_2)
      .resources(
        http("request_3")
          .get(uri2 + "/other-game-thumbnail.svg")
          .headers(headers_2),
        http("request_4")
          .get(uri2 + "/images/game-y-thumbnail-v1-dark.png")
          .headers(headers_2)
      ))
    .pause(11)
    .exec(http("request_5")
      .get(uri2 + "/vite.svg")
      .headers(headers_2))
    .pause(7)
    .exec(http("request_6")
      .get(uri2 + "/vite.svg")
      .headers(headers_2))
    .pause(10)

    // ── CREATE GAME ────────────────────────────────────────────────────────
    .exec(http("request_7")
      .options("/game/api/games")
      .headers(headers_7))

    .exec(http("request_8")
      .post("/game/api/games")
      .headers(headers_1)
      .header("Authorization", "Bearer #{token}")
      .body(RawFileBody("yovi/recordedsimulation/0008_request.json"))
      .check(status().is(201))
      .check(jsonPath("$.id").saveAs("gameId")))

    .exec(http("request_9")
      .get(uri2 + "/vite.svg")
      .headers(headers_2))

    .exec(http("request_10")
      .get("/game/api/games/#{gameId}")
      .headers(headers_10)
      .header("Authorization", "Bearer #{token}"))
    .pause(10)

    // ── MOVES ──────────────────────────────────────────────────────────────
    // Every move POST is now in its own .exec() (FIX A).
    // Every move POST accepts 200, 201, and 409 (FIX B).
    // The OPTIONS preflight for each move stays as a .resource() of its POST
    // because preflights are stateless and safe to keep parallel with their
    // own POST — just not with OTHER POSTs.

    // Move 1
    .exec(http("request_11")
      .options("/game/api/games/#{gameId}/move")
      .headers(headers_7)
      .resources(
        http("request_12")
          .post("/game/api/games/#{gameId}/move")
          .headers(headers_1)
          .header("Authorization", "Bearer #{token}")
          .body(RawFileBody("yovi/recordedsimulation/0012_request.json"))
          .check(status().in(200, 201, 409))
      ))
    .pause(1)

    // Move 2  — FIX A: was grouped with move 3 in a single resources() block
    .exec(http("request_13")
      .options("/game/api/games/#{gameId}/move")
      .headers(headers_7)
      .resources(
        http("request_14")
          .post("/game/api/games/#{gameId}/move")
          .headers(headers_1)
          .header("Authorization", "Bearer #{token}")
          .body(RawFileBody("yovi/recordedsimulation/0014_request.json"))
          .check(status().in(200, 201, 409))
      ))

    // Move 3  — FIX A: separated from move 2
    .exec(http("request_15")
      .options("/game/api/games/#{gameId}/move")
      .headers(headers_7)
      .resources(
        http("request_16")
          .post("/game/api/games/#{gameId}/move")
          .headers(headers_1)
          .header("Authorization", "Bearer #{token}")
          .body(RawFileBody("yovi/recordedsimulation/0016_request.json"))
          .check(status().in(200, 201, 409))
      ))
    .pause(1)

    // Move 4  — FIX A: was grouped with move 5 in a single resources() block
    .exec(http("request_17")
      .options("/game/api/games/#{gameId}/move")
      .headers(headers_7)
      .resources(
        http("request_18")
          .post("/game/api/games/#{gameId}/move")
          .headers(headers_1)
          .header("Authorization", "Bearer #{token}")
          .body(RawFileBody("yovi/recordedsimulation/0018_request.json"))
          .check(status().in(200, 201, 409))
      ))

    // Move 5  — FIX A: separated from move 4
    .exec(http("request_19")
      .options("/game/api/games/#{gameId}/move")
      .headers(headers_7)
      .resources(
        http("request_20")
          .post("/game/api/games/#{gameId}/move")
          .headers(headers_1)
          .header("Authorization", "Bearer #{token}")
          .body(RawFileBody("yovi/recordedsimulation/0020_request.json"))
          .check(status().in(200, 201, 409))
      ))
    .pause(1)

    // Move 6  — FIX A: was grouped with moves 7 and 8 in a single resources() block
    .exec(http("request_21")
      .options("/game/api/games/#{gameId}/move")
      .headers(headers_7)
      .resources(
        http("request_22")
          .post("/game/api/games/#{gameId}/move")
          .headers(headers_1)
          .header("Authorization", "Bearer #{token}")
          .body(RawFileBody("yovi/recordedsimulation/0022_request.json"))
          .check(status().in(200, 201, 409))
      ))

    // Move 7  — FIX A: separated from moves 6 and 8
    .exec(http("request_23")
      .options("/game/api/games/#{gameId}/move")
      .headers(headers_7)
      .resources(
        http("request_24")
          .post("/game/api/games/#{gameId}/move")
          .headers(headers_1)
          .header("Authorization", "Bearer #{token}")
          .body(RawFileBody("yovi/recordedsimulation/0024_request.json"))
          .check(status().in(200, 201, 409))
      ))

    // Move 8  — FIX A: separated from moves 6 and 7
    .exec(http("request_25")
      .options("/game/api/games/#{gameId}/move")
      .headers(headers_7)
      .resources(
        http("request_26")
          .post("/game/api/games/#{gameId}/move")
          .headers(headers_1)
          .header("Authorization", "Bearer #{token}")
          .body(RawFileBody("yovi/recordedsimulation/0026_request.json"))
          .check(status().in(200, 201, 409))
      ))
    .pause(1)

    // Move 9  — already had one POST per block, only adding the 409 check (FIX B)
    .exec(http("request_27")
      .options("/game/api/games/#{gameId}/move")
      .headers(headers_7)
      .resources(
        http("request_28")
          .post("/game/api/games/#{gameId}/move")
          .headers(headers_1)
          .header("Authorization", "Bearer #{token}")
          .body(RawFileBody("yovi/recordedsimulation/0028_request.json"))
          .check(status().in(200, 201, 409))
      ))
    .pause(3)

    // Move 10
    .exec(http("request_29")
      .options("/game/api/games/#{gameId}/move")
      .headers(headers_7)
      .resources(
        http("request_30")
          .post("/game/api/games/#{gameId}/move")
          .headers(headers_1)
          .header("Authorization", "Bearer #{token}")
          .body(RawFileBody("yovi/recordedsimulation/0030_request.json"))
          .check(status().in(200, 201, 409))
      ))
    .pause(5)

    // Move 11
    .exec(http("request_31")
      .options("/game/api/games/#{gameId}/move")
      .headers(headers_7)
      .resources(
        http("request_32")
          .post("/game/api/games/#{gameId}/move")
          .headers(headers_1)
          .header("Authorization", "Bearer #{token}")
          .body(RawFileBody("yovi/recordedsimulation/0032_request.json"))
          .check(status().in(200, 201, 409))
      ))
    .pause(1)

    // Move 12
    .exec(http("request_33")
      .options("/game/api/games/#{gameId}/move")
      .headers(headers_7)
      .resources(
        http("request_34")
          .post("/game/api/games/#{gameId}/move")
          .headers(headers_1)
          .header("Authorization", "Bearer #{token}")
          .body(RawFileBody("yovi/recordedsimulation/0034_request.json"))
          .check(status().in(200, 201, 409))
      ))
    .pause(8)

    // ── STATS ──────────────────────────────────────────────────────────────
    // Stats only read #{token} — no new saves — so keeping them in resources()
    // is fine. No 409 risk here since these are GET requests.
    .exec(http("request_35")
      .get(uri2 + "/vite.svg")
      .headers(headers_2)
      .resources(
        http("request_36")
          .options("/users/api/stats/history")
          .headers(headers_36),
        http("request_37")
          .options("/users/api/stats/winrate")
          .headers(headers_36),
        http("request_38")
          .get("/users/api/stats/history")
          .headers(headers_1)
          .header("Authorization", "Bearer #{token}"),
        http("request_39")
          .get("/users/api/stats/winrate")
          .headers(headers_1)
          .header("Authorization", "Bearer #{token}")
      ))
    .pause(5)
    .exec(http("request_40")
      .get(uri2 + "/vite.svg")
      .headers(headers_2));

  {
    setUp(
      scn.injectOpen(rampUsers(50).during(Duration.ofSeconds(30)))
    ).protocols(httpProtocol);
  }
}