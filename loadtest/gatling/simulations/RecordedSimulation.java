package yovi;

import java.time.Duration;
import java.util.*;

import io.gatling.javaapi.core.*;
import io.gatling.javaapi.http.*;

import static io.gatling.javaapi.core.CoreDsl.*;
import static io.gatling.javaapi.http.HttpDsl.*;

/**
 * ════════════════════════════════════════════════════════════════════════════
 * RecordedSimulation  —  YOVI Web App End-to-End Load Test
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Recorded with the Gatling recorder from a real browser session on
 * https://micrati.com, then trimmed and re-shaped for load testing.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CHANGES vs PREVIOUS VERSION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * FIX 1 — "409 Cascade" removed (moves 2-12 deleted).
 *   The Rust engine's choice of move varies with CPU load (minimax depth
 *   depends on available time). Hard-coded move coordinates past move 1 were
 *   therefore stale more often than not: after the first desync, the next
 *   11 moves all returned 409 Conflict without ever reaching the engine.
 *   The scenario now only plays Move 1, which is guaranteed valid on an
 *   empty board, so every virtual user lands REAL compute on gamey.
 *
 * FIX 2 — Open workload replaced by stepped closed workload.
 *   The previous `rampUsers(50).during(30 s)` (open model) queued requests
 *   faster than the system could drain them; response times spiked to 23 s
 *   and the "breaking point" was invisible behind the queue.
 *   We now use `constantConcurrentUsers` in steps of 10 / 20 / 30 for one
 *   minute each. In closed model, a new user starts only when an existing
 *   one finishes, so the server dictates throughput and the response time
 *   at each plateau is the honest capacity reading for that concurrency.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */
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
  // Flow (trimmed from the original 12-move recording):
  //   1. Login               → obtain JWT
  //   2. Create Game         → obtain gameId
  //   3. Move 1              → always valid on an empty board → REAL engine work
  //   4. Fetch Stats         → exercises the users service read path
  //
  // Static-asset GETs (vite.svg, thumbnails) are left in because they were part
  // of the recorded browser flow; Nginx handles them cheaply, and keeping them
  // preserves realistic header/TLS overhead. They are flagged in the README as
  // a candidate for removal if they start to distort aggregate metrics.
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
    .pause(2)                    // trimmed from 11 s
    .exec(http("request_5")
      .get(uri2 + "/vite.svg")
      .headers(headers_2))
    .pause(2)                    // trimmed from 7 s
    .exec(http("request_6")
      .get(uri2 + "/vite.svg")
      .headers(headers_2))
    .pause(2)                    // trimmed from 10 s

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
    .pause(2)                    // trimmed from 10 s

    // ── MOVE 1 (only move kept) ────────────────────────────────────────────
    // An empty board has no occupied cells, so the coordinate recorded in
    // 0012_request.json cannot produce a 409. Any 409 here would be a real
    // bug, so we tighten the check to 200/201 only.
    .exec(http("request_11")
      .options("/game/api/games/#{gameId}/move")
      .headers(headers_7)
      .resources(
        http("request_12")
          .post("/game/api/games/#{gameId}/move")
          .headers(headers_1)
          .header("Authorization", "Bearer #{token}")
          .body(RawFileBody("yovi/recordedsimulation/0012_request.json"))
          .check(status().in(200, 201))
      ))
    .pause(1)

    // ── STATS ──────────────────────────────────────────────────────────────
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
    .pause(2)                    // trimmed from 5 s
    .exec(http("request_40")
      .get(uri2 + "/vite.svg")
      .headers(headers_2));


  // ── Injection (stepped closed workload) ────────────────────────────────────
  //
  // Three 60-second plateaus at 10 / 20 / 30 concurrent users.
  // Closed model => Gatling keeps the specified number of users running at all
  // times. When a user completes the scenario, a replacement is started. The
  // server's own throughput determines request rate, so response time at each
  // plateau is an honest capacity reading rather than a queue backlog.
  //
  // Read the HTML report by looking at the three equal-width plateaus on the
  // "Active Users over Time" chart; compare their p95 latency to identify the
  // concurrency level at which the system degrades.
  //
  {
    setUp(
      scn.injectClosed(
        constantConcurrentUsers(10).during(Duration.ofSeconds(60)),
        constantConcurrentUsers(20).during(Duration.ofSeconds(60)),
        constantConcurrentUsers(30).during(Duration.ofSeconds(60))
      )
    ).protocols(httpProtocol);
  }
}