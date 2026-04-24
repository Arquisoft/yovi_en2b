package yovi;

import java.time.Duration;

import io.gatling.javaapi.core.*;
import io.gatling.javaapi.http.*;

import static io.gatling.javaapi.core.CoreDsl.*;
import static io.gatling.javaapi.http.HttpDsl.*;

/**
 * ════════════════════════════════════════════════════════════════════════════
 * InteropSimulation  —  YOVI Interop Module Load Test
 * ════════════════════════════════════════════════════════════════════════════
 *
 * WHAT THE INTEROP MODULE IS
 * ──────────────────────────
 * The interop service (Node.js/Express, port 3001) is a stateless REST bridge
 * between external bot clients and the internal Rust gamey engine.
 * External callers POST a board state in YEN notation and receive the bot's
 * chosen move. No authentication is required.
 *
 *
 * YEN NOTATION RULES
 * ──────────────────
 *   "size":   N           triangle board with N rows
 *   "turn":   0 or 1      0 = Blue (B), 1 = Red (R)   ← INTEGER, not string
 *   "players":["B","R"]   player identifiers
 *   "layout": "..."       rows joined by "/"; row i has exactly (i+1) chars
 *                         "." = empty, "B" = Blue piece, "R" = Red piece
 *
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * NEW IN THIS VERSION — FIX for "503 Camouflage"
 * ═══════════════════════════════════════════════════════════════════════════
 * Previous version used `.check(status().in(200, 503))`, which counted both
 * a valid ~3 000 ms engine response and a fast ~5 ms "overloaded" rejection
 * as OK. Gatling averaged them together and hid the real 200 latency.
 *
 * Now every play request:
 *   1. Saves the HTTP status with `.saveAs("httpStatus")`
 *   2. Is wrapped in a Gatling `group(session -> "<Label>_" + status)` whose
 *      name carries the status code.
 *
 * Result in the HTML report:
 *   ▸ SmartBot_200   → percentiles for REAL engine-compute responses
 *   ▸ SmartBot_503   → percentiles for fast overload rejections
 *   ▸ SmartBot_init  → first iteration per virtual user (no prior status yet)
 *
 * Caveat — one-iteration "lag":
 *   Gatling resolves a group's name when entering the group, i.e. BEFORE the
 *   request inside runs. So iteration N of a request is labelled using the
 *   status saved by iteration N-1 of THAT SAME REQUEST. Each request uses its
 *   own session key (c1Status, c2Status, …) to avoid cross-contamination.
 *   Over a 3-minute forever-loop the "init" bucket is a tiny minority; the
 *   200 and 503 buckets faithfully reflect the two populations.
 *
 *
 * CONCURRENT USERS
 * ────────────────
 * Scenario A  (random_bot)    5 virtual users
 * Scenario B  (fast_bot)      3 virtual users
 * Scenario C  (smart_bot)     2 virtual users
 * Scenario D  (no bot_id)     3 virtual users
 * Scenario E  (health probe)  1 virtual user
 *                             ───────────────
 * Peak total:                14 virtual users
 */
public class InteropSimulation extends Simulation {

    // ── URL configuration ─────────────────────────────────────────────────────
    // Production (via Nginx reverse proxy):
    private static final String BASE_URL    = "https://api.micrati.com";
    private static final String PLAY_PATH   = "/interop/games/play";
    private static final String HEALTH_PATH = "/interop/health";
    //
    // Local Docker (direct to interop container):
    // private static final String BASE_URL    = "http://localhost:3001";
    // private static final String PLAY_PATH   = "/games/play";
    // private static final String HEALTH_PATH = "/health";

    // ── HTTP protocol ─────────────────────────────────────────────────────────
    private final HttpProtocolBuilder httpProtocol = http
        .baseUrl(BASE_URL)
        .acceptHeader("application/json")
        .contentTypeHeader("application/json")
        .userAgentHeader("YOVI-BotClient/1.0");

    // ── Helper — Gatling 3.10-compatible null-safe session read ───────────────
    // Gatling 3.10's Session.getString(String) returns null when the attribute
    // is missing and does NOT accept a default-value overload (that exists only
    // in 3.11+). We therefore ternary-fallback to "init" so the group label is
    // always a valid non-null string, especially on the first iteration per VU.
    private static String statusOrInit(Session session, String key) {
        String s = session.getString(key);
        return s == null ? "init" : s;
    }


    // ═════════════════════════════════════════════════════════════════════════
    // SCENARIO A — InteropOverhead  (random_bot)
    // random_bot picks a random empty cell with no minimax computation.
    // ═════════════════════════════════════════════════════════════════════════

    /** A1 — random_bot · empty size-4 board · Blue's turn (turn: 0). */
    private final ChainBuilder reqA1 =
        group(session -> "RandomBot_" + statusOrInit(session, "a1Status")).on(
            exec(
                http("A1 · random_bot · empty size-4 · Blue (turn 0)")
                    .post(PLAY_PATH)
                    .body(StringBody("{\"position\":{\"size\":4,\"turn\":0,\"players\":[\"B\",\"R\"],\"layout\":\"./../.../....\"},\"bot_id\":\"random_bot\"}"))
                    .check(status().in(200, 503).saveAs("a1Status"))
            )
        );

    /** A2 — random_bot · mid-game size-4 board · Blue's turn. */
    private final ChainBuilder reqA2 =
        group(session -> "RandomBot_" + statusOrInit(session, "a2Status")).on(
            exec(
                http("A2 · random_bot · mid-game size-4 · Blue (turn 0)")
                    .post(PLAY_PATH)
                    .body(StringBody("{\"position\":{\"size\":4,\"turn\":0,\"players\":[\"B\",\"R\"],\"layout\":\"B/B./R../R...\"},\"bot_id\":\"random_bot\"}"))
                    .check(status().in(200, 503).saveAs("a2Status"))
            )
        );

    private final ScenarioBuilder scnOverhead = scenario("A · InteropOverhead (random_bot)")
        .forever().on(
            exec(reqA1)
            .pause(Duration.ofMillis(300))
            .exec(reqA2)
            .pause(Duration.ofMillis(300))
        );


    // ═════════════════════════════════════════════════════════════════════════
    // SCENARIO B — FastBot  (fast_bot, 500 ms minimax budget)
    // ═════════════════════════════════════════════════════════════════════════

    /** B1 — fast_bot · empty size-5 board · Blue. */
    private final ChainBuilder reqB1 =
        group(session -> "FastBot_" + statusOrInit(session, "b1Status")).on(
            exec(
                http("B1 · fast_bot · empty size-5 · Blue (turn 0)")
                    .post(PLAY_PATH)
                    .body(StringBody("{\"position\":{\"size\":5,\"turn\":0,\"players\":[\"B\",\"R\"],\"layout\":\"./../.../..../.....\"},\"bot_id\":\"fast_bot\"}"))
                    .check(status().in(200, 503).saveAs("b1Status"))
            )
        );

    /** B2 — fast_bot · mid-game size-5 · Red's turn. */
    private final ChainBuilder reqB2 =
        group(session -> "FastBot_" + statusOrInit(session, "b2Status")).on(
            exec(
                http("B2 · fast_bot · mid-game size-5 · Red (turn 1)")
                    .post(PLAY_PATH)
                    .body(StringBody("{\"position\":{\"size\":5,\"turn\":1,\"players\":[\"B\",\"R\"],\"layout\":\"B/B./B.R/R.../R....\"},\"bot_id\":\"fast_bot\"}"))
                    .check(status().in(200, 503).saveAs("b2Status"))
            )
        );

    /** B3 — fast_bot · empty size-6 · Red's turn. */
    private final ChainBuilder reqB3 =
        group(session -> "FastBot_" + statusOrInit(session, "b3Status")).on(
            exec(
                http("B3 · fast_bot · empty size-6 · Red (turn 1)")
                    .post(PLAY_PATH)
                    .body(StringBody("{\"position\":{\"size\":6,\"turn\":1,\"players\":[\"B\",\"R\"],\"layout\":\"./../.../..../...../......\"},\"bot_id\":\"fast_bot\"}"))
                    .check(status().in(200, 503).saveAs("b3Status"))
            )
        );

    private final ScenarioBuilder scnFastBot = scenario("B · FastBot (fast_bot, 500 ms)")
        .forever().on(
            exec(reqB1)
            .pause(Duration.ofMillis(500))
            .exec(reqB2)
            .pause(Duration.ofMillis(500))
            .exec(reqB3)
            .pause(Duration.ofMillis(500))
        );


    // ═════════════════════════════════════════════════════════════════════════
    // SCENARIO C — SmartBot  (smart_bot, up to 3 000 ms budget)
    // 2 virtual users · this is the scenario most likely to saturate gamey.
    // ═════════════════════════════════════════════════════════════════════════

    /** C1 — smart_bot · empty size-4 board · Blue. */
    private final ChainBuilder reqC1 =
        group(session -> "SmartBot_" + statusOrInit(session, "c1Status")).on(
            exec(
                http("C1 · smart_bot · empty size-4 · Blue (turn 0)")
                    .post(PLAY_PATH)
                    .body(StringBody("{\"position\":{\"size\":4,\"turn\":0,\"players\":[\"B\",\"R\"],\"layout\":\"./../.../....\"},\"bot_id\":\"smart_bot\"}"))
                    .check(status().in(200, 503).saveAs("c1Status"))
            )
        );

    /** C2 — smart_bot · near-win size-4 · Red must block. */
    private final ChainBuilder reqC2 =
        group(session -> "SmartBot_" + statusOrInit(session, "c2Status")).on(
            exec(
                http("C2 · smart_bot · near-win size-4 · Red must block (turn 1)")
                    .post(PLAY_PATH)
                    .body(StringBody("{\"position\":{\"size\":4,\"turn\":1,\"players\":[\"B\",\"R\"],\"layout\":\"B/B./BB./....\"},\"bot_id\":\"smart_bot\"}"))
                    .check(status().in(200, 503).saveAs("c2Status"))
            )
        );

    /** C3 — smart_bot · balanced mid-game size-6 · Blue. */
    private final ChainBuilder reqC3 =
        group(session -> "SmartBot_" + statusOrInit(session, "c3Status")).on(
            exec(
                http("C3 · smart_bot · balanced mid-game size-6 · Blue (turn 0)")
                    .post(PLAY_PATH)
                    .body(StringBody("{\"position\":{\"size\":6,\"turn\":0,\"players\":[\"B\",\"R\"],\"layout\":\"B/B./B.R/B..R/R..../R.....\"},\"bot_id\":\"smart_bot\"}"))
                    .check(status().in(200, 503).saveAs("c3Status"))
            )
        );

    /** C4 — smart_bot · empty size-9 · absolute worst-case compute. */
    private final ChainBuilder reqC4 =
        group(session -> "SmartBot_" + statusOrInit(session, "c4Status")).on(
            exec(
                http("C4 · smart_bot · empty size-9 · maximum compute (turn 0)")
                    .post(PLAY_PATH)
                    .body(StringBody("{\"position\":{\"size\":9,\"turn\":0,\"players\":[\"B\",\"R\"],\"layout\":\"./../.../..../...../....../......./......../.........\"},\"bot_id\":\"smart_bot\"}"))
                    .check(status().in(200, 503).saveAs("c4Status"))
            )
        );

    private final ScenarioBuilder scnSmartBot = scenario("C · SmartBot (smart_bot, 3 000 ms)")
        .forever().on(
            exec(reqC1)
            .pause(Duration.ofMillis(500))
            .exec(reqC2)
            .pause(Duration.ofMillis(500))
            .exec(reqC3)
            .pause(Duration.ofMillis(500))
            .exec(reqC4)
            .pause(Duration.ofMillis(1000))
        );


    // ═════════════════════════════════════════════════════════════════════════
    // SCENARIO D — DefaultFallback  (no bot_id in request body)
    // Acceptable responses: 200, 400 (bot_id required), 503 (overload).
    // ═════════════════════════════════════════════════════════════════════════

    /** D1 — no bot_id · empty size-4 · Blue. */
    private final ChainBuilder reqD1 =
        group(session -> "Default_" + statusOrInit(session, "d1Status")).on(
            exec(
                http("D1 · no bot_id · empty size-4 · Blue (turn 0)")
                    .post(PLAY_PATH)
                    .body(StringBody("{\"position\":{\"size\":4,\"turn\":0,\"players\":[\"B\",\"R\"],\"layout\":\"./../.../....\"}}"))
                    .check(status().in(200, 400, 503).saveAs("d1Status"))
            )
        );

    /** D2 — no bot_id · early-game size-9 · Red. */
    private final ChainBuilder reqD2 =
        group(session -> "Default_" + statusOrInit(session, "d2Status")).on(
            exec(
                http("D2 · no bot_id · early-game size-9 · Red (turn 1)")
                    .post(PLAY_PATH)
                    .body(StringBody("{\"position\":{\"size\":9,\"turn\":1,\"players\":[\"B\",\"R\"],\"layout\":\"B/B./.../..../...../....../......./R......./R........\"}}"))
                    .check(status().in(200, 400, 503).saveAs("d2Status"))
            )
        );

    private final ScenarioBuilder scnDefault = scenario("D · DefaultFallback (no bot_id)")
        .forever().on(
            exec(reqD1)
            .pause(Duration.ofMillis(400))
            .exec(reqD2)
            .pause(Duration.ofMillis(400))
        );


    // ═════════════════════════════════════════════════════════════════════════
    // SCENARIO E — HealthProbe  (GET /health, every 2 seconds)
    // Health must always be fast & 200 — no grouping needed here.
    // ═════════════════════════════════════════════════════════════════════════

    private final ScenarioBuilder scnHealth = scenario("E · HealthProbe (GET /health)")
        .forever().on(
            exec(
                http("E1 · GET /health")
                    .get(HEALTH_PATH)
                    .check(status().is(200))
            )
            .pause(Duration.ofSeconds(2))
        );


    // ═════════════════════════════════════════════════════════════════════════
    // setUp
    // ═════════════════════════════════════════════════════════════════════════
    {
        setUp(
            scnOverhead.injectOpen(
                rampUsers(5).during(Duration.ofSeconds(20))
            ),
            scnFastBot.injectOpen(
                nothingFor(Duration.ofSeconds(5)),
                rampUsers(3).during(Duration.ofSeconds(30))
            ),
            scnSmartBot.injectOpen(
                nothingFor(Duration.ofSeconds(10)),
                rampUsers(2).during(Duration.ofSeconds(45))
            ),
            scnDefault.injectOpen(
                nothingFor(Duration.ofSeconds(15)),
                rampUsers(3).during(Duration.ofSeconds(20))
            ),
            scnHealth.injectOpen(
                atOnceUsers(1)
            )
        )
        .protocols(httpProtocol)
        .maxDuration(Duration.ofMinutes(3))
        .assertions(
            // Health must never fail — it does not involve gamey computation.
            forAll().failedRequests().percent().is(0.0)
            // 503 on play requests is still accepted via status().in(200, 503);
            // the status-grouped metrics in the HTML report (e.g. SmartBot_503)
            // are the main finding for gamey capacity.
        );
    }
}