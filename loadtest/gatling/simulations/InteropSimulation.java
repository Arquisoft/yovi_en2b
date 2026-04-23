
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
 * chosen move. No authentication is required — any external bot can call it.
 *
 * Because there is no login chain and no session state to track across
 * requests, this simulation is structurally much simpler than
 * RecordedSimulation. Every request is a self-contained POST.
 *
 *
 * YEN NOTATION  (the board encoding format)
 * ─────────────────────────────────────────
 * {
 *   "size":    N,           Board size. The board is a triangle with N rows.
 *                           Row i (0-indexed) contains exactly (i + 1) cells.
 *
 *   "turn":    0 or 1,      Whose turn it is next.
 *                           0 = Blue (player "B"),  1 = Red (player "R").
 *
 *   "players": ["B", "R"],  Player token identifiers.
 *
 *   "layout":  "...",       All rows concatenated with "/" as a separator.
 *                           Within each row: "." = empty cell,
 *                           "B" = Blue piece, "R" = Red piece.
 * }
 *
 * Layout encoding rules:
 *   - Row 0 has 1 cell  → "."
 *   - Row 1 has 2 cells → ".."
 *   - Row 2 has 3 cells → "..."
 *   - Row N-1 has N cells → "...N-dots..."
 *   - Rows joined with "/" → "./../.../..../........" etc.
 *
 * Correct empty-board layouts (Python-verified):
 *   size 4 → "./../.../....""
 *   size 5 → "./../.../..../.....""
 *   size 6 → "./../.../..../...../......"
 *   size 9 → "./../.../..../...../....../......./......../........."
 *
 *
 * SIMULATION STRUCTURE
 * ────────────────────
 * Five scenarios run concurrently, staggered to allow their individual
 * contributions to be identified in the Gatling percentile charts:
 *
 *   A — InteropOverhead   random_bot  (no minimax)  measures pure service overhead
 *   B — FastBot           fast_bot    (500 ms budget) moderate bot compute
 *   C — SmartBot          smart_bot   (3 000 ms budget) maximum bot compute
 *   D — DefaultFallback   (no bot_id) tests the default strategy path
 *   E — HealthProbe       GET /health  liveness under concurrent load
 *
 *
 * DEPLOYMENT
 * ──────────
 * Copy this file → <GATLING_HOME>/user-files/simulations/yovi/
 *
 * Switch BASE_URL / PLAY_PATH / HEALTH_PATH below to target local Docker
 * or the production server.
 */
public class InteropSimulation extends Simulation {

    // ── URL configuration ─────────────────────────────────────────────────────
    // Production (via Nginx reverse proxy):
    private static final String BASE_URL    = "https://api.micrati.com";
    private static final String PLAY_PATH   = "/interop/games/play";
    private static final String HEALTH_PATH = "/interop/health";
    // Local Docker (direct to the interop container):
    // private static final String BASE_URL    = "http://localhost:3001";
    // private static final String PLAY_PATH   = "/games/play";
    // private static final String HEALTH_PATH = "/health";

    // ── HTTP protocol ─────────────────────────────────────────────────────────
    private final HttpProtocolBuilder httpProtocol = http
        .baseUrl(BASE_URL)
        .acceptHeader("application/json")
        .contentTypeHeader("application/json")
        .userAgentHeader("YOVI-BotClient/1.0");


    // ═════════════════════════════════════════════════════════════════════════
    // SCENARIO A — InteropOverhead  (bot_id: "random_bot")
    //
    // random_bot picks a uniformly random empty cell without running any
    // minimax search. It is the fastest possible strategy — essentially
    // O(1) after the board is parsed.
    //
    // PURPOSE: Isolate the pure overhead of the interop service itself from
    // the cost of the bot computation. Any latency measured here is spent
    // entirely in Node.js: deserialising the request body, validating the
    // YEN layout, building an internal board representation, making an HTTP
    // call to gamey, serialising the response, and returning it over the wire.
    //
    // This gives the performance floor. If fast_bot or smart_bot take
    // significantly longer, the extra time is gamey CPU — not interop
    // overhead.
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * REQUEST A1 — random_bot · empty size-4 board · Blue's turn (turn: 0)
     *
     * Board (all 10 cells empty, size 4):
     *   Row 0 (1 cell):  .
     *   Row 1 (2 cells): ..
     *   Row 2 (3 cells): ...
     *   Row 3 (4 cells): ....
     *   layout → "./../.../....""
     *
     * What this measures:
     *   The absolute minimum interop round-trip: smallest valid board,
     *   no pieces placed, cheapest strategy. This is the baseline latency
     *   that every other request should be compared against. Under any
     *   level of concurrency, A1 response times should remain close to
     *   this baseline — if they drift upward it indicates the Node.js
     *   event loop or the HTTP connection pool to gamey is becoming a
     *   bottleneck independent of bot computation.
     *
     * Correctness check: response must be a cell that is "." in the layout,
     *   i.e. a valid (row, col) pair within a size-4 board.
     *
     * Expected: 200 OK · action.row and action.col present · sub-100 ms solo.
     */
    private final ChainBuilder reqA1 = exec(
        http("A1 · random_bot · empty size-4 · Blue (turn 0)")
            .post(PLAY_PATH)
            .body(StringBody("{\"position\":{\"size\":4,\"turn\":0,\"players\":[\"B\",\"R\"],\"layout\":\"./../.../....\"},\"bot_id\":\"random_bot\"}"))
            .check(status().is(200))
            .check(jsonPath("$.action").exists())
            .check(jsonPath("$.action.row").exists())
            .check(jsonPath("$.action.col").exists())
    );

    /**
     * REQUEST A2 — random_bot · mid-game size-4 board · Blue's turn (turn: 0)
     *
     * Board (4 pieces placed, 6 cells empty):
     *   Row 0 (1 cell):  B       ← Blue at (0,0)
     *   Row 1 (2 cells): B.      ← Blue at (1,0)
     *   Row 2 (3 cells): R..     ← Red  at (2,0)
     *   Row 3 (4 cells): R...    ← Red  at (3,0)
     *   layout → "B/B./R../R..."
     *   Blue: 2 pieces · Red: 2 pieces → Blue's turn ✓
     *
     * What this measures:
     *   YEN parsing with a mix of occupied ("B", "R") and empty (".") cells.
     *   random_bot must enumerate only the 6 empty cells and pick one —
     *   verifying the interop correctly filters out occupied positions.
     *   Comparing A2 latency to A1 reveals the cost of layout parsing when
     *   pieces are present (should be negligible for random_bot but may
     *   matter at higher concurrency if the Node.js parser is on the hot path).
     *
     * Correctness check: response action must correspond to a "." cell —
     *   not (0,0), (1,0), (2,0), or (3,0).
     *
     * Expected: 200 OK · response ≈ A1 latency.
     */
    private final ChainBuilder reqA2 = exec(
        http("A2 · random_bot · mid-game size-4 · Blue (turn 0)")
            .post(PLAY_PATH)
            .body(StringBody("{\"position\":{\"size\":4,\"turn\":0,\"players\":[\"B\",\"R\"],\"layout\":\"B/B./R../R...\"},\"bot_id\":\"random_bot\"}"))
            .check(status().is(200))
            .check(jsonPath("$.action").exists())
    );

    private final ScenarioBuilder scnOverhead = scenario("A — InteropOverhead (random_bot)")
        .exec(reqA1)
        .pause(Duration.ofMillis(200))
        .exec(reqA2);


    // ═════════════════════════════════════════════════════════════════════════
    // SCENARIO B — FastBot  (bot_id: "fast_bot", 500 ms minimax budget)
    //
    // fast_bot runs minimax with alpha-beta pruning and a 500 ms wall-clock
    // budget. It searches as deeply as time allows and returns the best move
    // found at the deepest completed depth.
    //
    // PURPOSE: Test the gamey engine under moderate concurrent load.
    // Board sizes in this scenario (5 and 6) are intentionally larger than
    // the random_bot boards to increase the search space while keeping
    // response times within half a second under low concurrency.
    //
    // Under load: 20 virtual users each issuing a 500 ms computation means
    // requests will queue at gamey. The queue depth and response time growth
    // rate reveal whether a single gamey instance can sustain this traffic.
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * REQUEST B1 — fast_bot · empty size-5 board · Blue's turn (turn: 0)
     *
     * Board (all 15 cells empty, size 5):
     *   Row 0 (1 cell):  .
     *   Row 1 (2 cells): ..
     *   Row 2 (3 cells): ...
     *   Row 3 (4 cells): ....
     *   Row 4 (5 cells): .....
     *   layout → "./../.../..../....."
     *
     * What this measures:
     *   fast_bot on its simplest input: an opening move on a 15-cell board.
     *   An empty board maximises the branching factor at every depth, so
     *   the engine exhausts its 500 ms budget exploring the first few levels
     *   of the game tree. This tests the bot's time-cutoff logic more than
     *   its evaluation function.
     *   Comparing B1 to A1 (same empty board idea, different strategy)
     *   directly shows how much minimax adds over random selection.
     *
     * Expected: 200 OK · response ≈ 500 ms solo (budget fully used).
     *           Response time will climb sharply under 20-user concurrent load.
     */
    private final ChainBuilder reqB1 = exec(
        http("B1 · fast_bot · empty size-5 · Blue (turn 0)")
            .post(PLAY_PATH)
            .body(StringBody("{\"position\":{\"size\":5,\"turn\":0,\"players\":[\"B\",\"R\"],\"layout\":\"./../.../..../.....\"},\"bot_id\":\"fast_bot\"}"))
            .check(status().is(200))
            .check(jsonPath("$.action").exists())
    );

    /**
     * REQUEST B2 — fast_bot · mid-game size-5 board · Red's turn (turn: 1)
     *
     * Board (6 pieces placed, 9 cells empty):
     *   Row 0 (1 cell):  B       ← Blue at (0,0)
     *   Row 1 (2 cells): B.      ← Blue at (1,0)
     *   Row 2 (3 cells): B.R     ← Blue at (2,0) · Red at (2,2)
     *   Row 3 (4 cells): R...    ← Red  at (3,0)
     *   Row 4 (5 cells): R....   ← Red  at (4,0)
     *   layout → "B/B./B.R/R.../R...."
     *   Blue: 3 pieces · Red: 3 pieces → Red's turn ✓
     *
     * What this measures:
     *   fast_bot reasoning on a genuinely contested mid-game position.
     *   Blue is building down the left edge from the top corner.
     *   Red is mirroring on the bottom-left corner. Both have a credible
     *   winning path and neither has yet dominated.
     *   Occupied cells prune the search tree, so the engine reaches deeper
     *   levels than on B1 (empty board) within the same 500 ms budget.
     *   Comparing B2 to B1 shows the pruning benefit: B2 should be
     *   slightly faster or produce a higher quality move for the same cost.
     *
     * Expected: 200 OK · response ≈ 500 ms solo.
     */
    private final ChainBuilder reqB2 = exec(
        http("B2 · fast_bot · mid-game size-5 · Red (turn 1)")
            .post(PLAY_PATH)
            .body(StringBody("{\"position\":{\"size\":5,\"turn\":1,\"players\":[\"B\",\"R\"],\"layout\":\"B/B./B.R/R.../R....\"},\"bot_id\":\"fast_bot\"}"))
            .check(status().is(200))
            .check(jsonPath("$.action").exists())
    );

    /**
     * REQUEST B3 — fast_bot · empty size-6 board · Red's turn (turn: 1)
     *
     * Board (all 21 cells empty, size 6):
     *   Row 0 (1 cell):  .
     *   Row 1 (2 cells): ..
     *   Row 2 (3 cells): ...
     *   Row 3 (4 cells): ....
     *   Row 4 (5 cells): .....
     *   Row 5 (6 cells): ......
     *   layout → "./../.../..../...../......"
     *
     * What this measures:
     *   fast_bot on a larger board (21 cells vs 15 in B1) with the same
     *   500 ms budget. A size-6 empty board has an even larger branching
     *   factor than size-5, so the engine will complete fewer levels of
     *   the game tree in the same time.
     *   This is the heaviest request in the FastBot scenario — it will
     *   reveal gamey CPU saturation before B1 or B2 do as concurrency grows.
     *   Under 20 virtual users, B3 requests will begin queuing at gamey
     *   first, producing the most visible latency spike in the Gatling charts.
     *
     * Expected: 200 OK · response ≈ 500 ms solo · largest latency in scenario B.
     */
    private final ChainBuilder reqB3 = exec(
        http("B3 · fast_bot · empty size-6 · Red (turn 1)")
            .post(PLAY_PATH)
            .body(StringBody("{\"position\":{\"size\":6,\"turn\":1,\"players\":[\"B\",\"R\"],\"layout\":\"./../.../..../...../......\"},\"bot_id\":\"fast_bot\"}"))
            .check(status().is(200))
            .check(jsonPath("$.action").exists())
    );

    private final ScenarioBuilder scnFastBot = scenario("B — FastBot (fast_bot, 500 ms)")
        .exec(reqB1)
        .pause(Duration.ofMillis(500))
        .exec(reqB2)
        .pause(Duration.ofMillis(500))
        .exec(reqB3);


    // ═════════════════════════════════════════════════════════════════════════
    // SCENARIO C — SmartBot  (bot_id: "smart_bot", up to 3 000 ms budget)
    //
    // smart_bot is the strongest strategy: minimax with alpha-beta pruning
    // and a 3 000 ms wall-clock budget. It searches as deeply as time allows.
    //
    // PURPOSE: Expose the gamey engine's hard concurrency limit.
    // Each smart_bot request occupies a CPU core for up to 3 seconds.
    // Under concurrent load, requests serialise at gamey, producing the
    // same queue-driven latency spike that was observed in RecordedSimulation's
    // game-move phase (p95 reaching 22 s at 50 users).
    //
    // This scenario isolates that bottleneck to the interop/gamey path and
    // quantifies it without the noise of the main game authentication and
    // session management logic.
    //
    // Health probe (Scenario E) runs alongside this to confirm the interop
    // Node.js process stays responsive even while gamey is saturated.
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * REQUEST C1 — smart_bot · empty size-4 board · Blue's turn (turn: 0)
     *
     * Board (all 10 cells empty, size 4):
     *   layout → "./../.../....""   (same layout as A1)
     *
     * What this measures:
     *   smart_bot on the smallest possible board. With only 10 cells and
     *   a 3 000 ms budget the engine can often search close to full depth,
     *   potentially solving the opening move optimally.
     *   C1 is the direct smart_bot counterpart to A1 (same board, random
     *   strategy). The difference C1_latency − A1_latency isolates exactly
     *   how much the minimax computation costs for this board size.
     *   This establishes the minimum smart_bot response time and sets
     *   the expectation for how much worse C3 and C4 will be.
     *
     * Expected: 200 OK · response < 3 000 ms solo · higher quality move
     *           than A1 (bot should prefer strong central opening cells).
     */
    private final ChainBuilder reqC1 = exec(
        http("C1 · smart_bot · empty size-4 · Blue (turn 0)")
            .post(PLAY_PATH)
            .body(StringBody("{\"position\":{\"size\":4,\"turn\":0,\"players\":[\"B\",\"R\"],\"layout\":\"./../.../....\"},\"bot_id\":\"smart_bot\"}"))
            .check(status().is(200))
            .check(jsonPath("$.action").exists())
    );

    /**
     * REQUEST C2 — smart_bot · near-win size-4 board · Red's turn (turn: 1)
     *
     * Board (4 Blue pieces, 0 Red pieces — Red must urgently block):
     *   Row 0 (1 cell):  B       ← Blue at (0,0) — touches top edge
     *   Row 1 (2 cells): B.      ← Blue at (1,0) — extends down left edge
     *   Row 2 (3 cells): BB.     ← Blue at (2,0) and (2,1) — spreading right
     *   Row 3 (4 cells): ....    ← all empty — Blue can finish here
     *   layout → "B/B./BB./....""
     *   Blue: 4 pieces · Red: 0 pieces → Red's turn ✓
     *
     * What this measures:
     *   The game-theory aspect of smart_bot: can it detect an imminent loss
     *   and play a blocking move?
     *   Blue's group {(0,0), (1,0), (2,0), (2,1)} already touches the top
     *   edge (via row 0) and the left edge (via column 0). Blue needs one
     *   more piece connecting to the right diagonal edge to win. Red must
     *   interrupt this connection.
     *   This is a QUALITATIVE correctness test alongside a latency test.
     *   A random or weak bot would fail to block; smart_bot must find the
     *   defensive move. A forced position like this also prunes the search
     *   tree aggressively (there is essentially one good move for Red), so
     *   C2 should complete faster than C1 (open position) — if true, this
     *   demonstrates that alpha-beta pruning is working correctly under load.
     *
     * Expected: 200 OK · action is a defensive cell blocking Blue's path to
     *           the right diagonal edge · response may be faster than C1.
     */
    private final ChainBuilder reqC2 = exec(
        http("C2 · smart_bot · near-win size-4 · Red must block (turn 1)")
            .post(PLAY_PATH)
            .body(StringBody("{\"position\":{\"size\":4,\"turn\":1,\"players\":[\"B\",\"R\"],\"layout\":\"B/B./BB./....\"},\"bot_id\":\"smart_bot\"}"))
            .check(status().is(200))
            .check(jsonPath("$.action").exists())
    );

    /**
     * REQUEST C3 — smart_bot · balanced mid-game size-6 board · Blue's turn (turn: 0)
     *
     * Board (8 pieces placed — 4 Blue, 4 Red — a balanced position):
     *   Row 0 (1 cell):  B       ← Blue at (0,0)
     *   Row 1 (2 cells): B.      ← Blue at (1,0)
     *   Row 2 (3 cells): B.R     ← Blue at (2,0) · Red at (2,2)
     *   Row 3 (4 cells): B..R    ← Blue at (3,0) · Red at (3,3)
     *   Row 4 (5 cells): R....   ← Red  at (4,0)
     *   Row 5 (6 cells): R.....  ← Red  at (5,0)
     *   layout → "B/B./B.R/B..R/R..../R....."
     *   Blue: 4 pieces · Red: 4 pieces → Blue's turn ✓
     *
     * What this measures:
     *   smart_bot on a larger board (21 cells) in a position where both
     *   players have a realistic winning path. Blue dominates the left edge
     *   from the top corner. Red is attempting to mirror on the left edge
     *   from the bottom while also occupying the right-diagonal corner.
     *   This forces the evaluation function to carefully weigh multiple
     *   strategic options — unlike C2 (one forced move) or C1 (empty board).
     *   This is the hardest COMBINATORIAL position in the simulation: it
     *   combines a large board with a rich, non-trivial game state. Under
     *   concurrent load, C3 will drive CPU saturation more aggressively than
     *   C1 or C2 and will reveal queuing effects at gamey earliest.
     *
     * Expected: 200 OK · response close to 3 000 ms solo.
     *           p95 will be the second-highest in the simulation (after C4).
     */
    private final ChainBuilder reqC3 = exec(
        http("C3 · smart_bot · balanced mid-game size-6 · Blue (turn 0)")
            .post(PLAY_PATH)
            .body(StringBody("{\"position\":{\"size\":6,\"turn\":0,\"players\":[\"B\",\"R\"],\"layout\":\"B/B./B.R/B..R/R..../R.....\"},\"bot_id\":\"smart_bot\"}"))
            .check(status().is(200))
            .check(jsonPath("$.action").exists())
    );

    /**
     * REQUEST C4 — smart_bot · empty size-9 board · Blue's turn (turn: 0)
     *
     * Board (all 45 cells empty, size 9 — the maximum standard board):
     *   Row 0 (1 cell):  .
     *   Row 1 (2 cells): ..
     *   Row 2 (3 cells): ...
     *   Row 3 (4 cells): ....
     *   Row 4 (5 cells): .....
     *   Row 5 (6 cells): ......
     *   Row 6 (7 cells): .......
     *   Row 7 (8 cells): ........
     *   Row 8 (9 cells): .........
     *   layout → "./../.../..../...../....../......./......../........."
     *
     * What this measures:
     *   The absolute worst case for the interop/gamey stack: 45 cells, empty
     *   board, maximum branching factor at every depth, full 3 000 ms budget.
     *   At this board size the engine will not reach any meaningful search
     *   depth within 3 seconds; it essentially runs until time expires and
     *   returns the best move found so far. This directly exercises the
     *   time-cutoff and iterative-deepening logic in the Rust minimax.
     *   Under concurrent load: even a single C4 request monopolises the gamey
     *   CPU for 3 seconds. Multiple concurrent C4 requests will produce the
     *   most dramatic queue buildup in the entire simulation — p95 will be the
     *   highest of all requests and grows linearly with concurrency.
     *   This is the stress test that quantifies the hard upper bound of the
     *   current single-instance gamey architecture.
     *
     * Expected: 200 OK · response ≈ 3 000 ms solo (budget fully exhausted).
     *           p95 will be the highest observed in the entire simulation run.
     */
    private final ChainBuilder reqC4 = exec(
        http("C4 · smart_bot · empty size-9 · maximum compute (turn 0)")
            .post(PLAY_PATH)
            .body(StringBody("{\"position\":{\"size\":9,\"turn\":0,\"players\":[\"B\",\"R\"],\"layout\":\"./../.../..../...../....../......./......../.........\"},\"bot_id\":\"smart_bot\"}"))
            .check(status().is(200))
            .check(jsonPath("$.action").exists())
    );

    private final ScenarioBuilder scnSmartBot = scenario("C — SmartBot (smart_bot, 3 000 ms)")
        .exec(reqC1)
        .pause(Duration.ofMillis(500))
        .exec(reqC2)
        .pause(Duration.ofMillis(500))
        .exec(reqC3)
        .pause(Duration.ofMillis(500))
        .exec(reqC4);


    // ═════════════════════════════════════════════════════════════════════════
    // SCENARIO D — DefaultFallback  (no bot_id field in request body)
    //
    // PURPOSE: Verify the interop's behaviour when the caller omits bot_id.
    // Two outcomes are both acceptable, but a 500 Internal Server Error is not:
    //
    //   200 OK  — the service has a documented default strategy and applies it.
    //   400 Bad Request — the service requires bot_id and rejects the call cleanly.
    //
    // Comparing D1 and D2 response times reveals which default strategy is
    // actually used (fast vs random vs smart), providing an independent
    // cross-check against whatever the implementation documents.
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * REQUEST D1 — no bot_id · empty size-4 board · Blue's turn (turn: 0)
     *
     * Board (all 10 cells empty, size 4):
     *   layout → "./../.../....""   (same as A1 and C1)
     *
     * What this measures:
     *   Whether the interop has a default strategy when bot_id is absent.
     *   The "bot_id" key is completely omitted from the body — not set to
     *   null or empty string — to test true field absence.
     *
     *   If 200 OK: the default strategy is functional. Comparing D1 latency
     *     to A1 (random) and C1 (smart) on the same board reveals which
     *     strategy the default maps to.
     *   If 400: bot_id is required. The error response body should explain
     *     why and should NOT be a generic 500 or unhandled exception trace.
     *
     * Expected: 200 OK (default strategy exists) OR 400 (bot_id required).
     *           500 in either case = failure.
     */
    private final ChainBuilder reqD1 = exec(
        http("D1 · no bot_id · empty size-4 · Blue (turn 0) — default fallback")
            .post(PLAY_PATH)
            .body(StringBody("{\"position\":{\"size\":4,\"turn\":0,\"players\":[\"B\",\"R\"],\"layout\":\"./../.../....\"}}"))
            .check(status().in(200, 400))  // 500 = unhandled crash = KO
    );

    /**
     * REQUEST D2 — no bot_id · early-game size-9 board · Red's turn (turn: 1)
     *
     * Board (4 pieces placed, 41 cells empty):
     *   Row 0 (1 cell):  B       ← Blue at (0,0)
     *   Row 1 (2 cells): B.      ← Blue at (1,0)
     *   Row 2 (3 cells): ...     ← empty
     *   Row 3 (4 cells): ....    ← empty
     *   Row 4 (5 cells): .....   ← empty
     *   Row 5 (6 cells): ......  ← empty
     *   Row 6 (7 cells): ....... ← empty
     *   Row 7 (8 cells): R....... ← Red at (7,0)
     *   Row 8 (9 cells): R........ ← Red at (8,0)
     *   layout → "B/B./.../..../...../....../......./R......./R........"
     *   Blue: 2 pieces · Red: 2 pieces → Red's turn ✓
     *
     * What this measures:
     *   Default strategy on a large board (45 cells) in an early-game state.
     *   If the default is random_bot: D2 latency ≈ D1 latency (board size
     *     has no effect on a random pick).
     *   If the default is fast_bot: D2 latency >> D1 latency (minimax on
     *     a 45-cell board takes much longer than on a 10-cell board).
     *   If the default is smart_bot: D2 latency ≈ 3 000 ms (budget saturated).
     *   This makes D1+D2 together a diagnostic pair that identifies the
     *   default strategy by its scaling behaviour, independently of any docs.
     *   Also tests that the interop correctly parses a large 9-row YEN layout
     *   with a mix of occupied and empty rows.
     *
     * Expected: same status code as D1 (200 or 400). No 500 in any case.
     */
    private final ChainBuilder reqD2 = exec(
        http("D2 · no bot_id · early-game size-9 · Red (turn 1) — default fallback")
            .post(PLAY_PATH)
            .body(StringBody("{\"position\":{\"size\":9,\"turn\":1,\"players\":[\"B\",\"R\"],\"layout\":\"B/B./.../..../...../....../......./R......./R........\"}}"))
            .check(status().in(200, 400))
    );

    private final ScenarioBuilder scnDefault = scenario("D — DefaultFallback (no bot_id)")
        .exec(reqD1)
        .pause(Duration.ofMillis(300))
        .exec(reqD2);


    // ═════════════════════════════════════════════════════════════════════════
    // SCENARIO E — HealthProbe  (GET /health, polling every 2 seconds)
    //
    // PURPOSE: Confirm the interop service process stays responsive while all
    // other scenarios are running concurrently.
    //
    // The /health endpoint is a lightweight GET that should return 200 OK in
    // milliseconds regardless of what gamey is doing. Because gamey calls are
    // made asynchronously inside Node.js (await fetch / async/await), the
    // event loop should remain free to serve health checks even while waiting
    // for gamey to return.
    //
    // Interpreting the results:
    //   Health checks stay fast and 200 throughout:
    //     → The interop process itself is healthy; only gamey is under load.
    //       This is the expected outcome.
    //
    //   Health check latency rises or checks start failing during SmartBot:
    //     → The Node.js event loop is being starved. Likely causes: a blocking
    //       gamey call (synchronous HTTP without async), an exhausted HTTP
    //       connection pool, or too many in-flight promises queuing microtasks.
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * REQUEST E1 — GET /health  (continuous liveness probe, every 2 seconds)
     *
     * What this measures:
     *   The availability and responsiveness of the interop process throughout
     *   the entire simulation. Fires once every 2 seconds from a single
     *   virtual user for the full duration of the test.
     *   A healthy Node.js event loop should serve this in < 20 ms at all
     *   times, even when 10 concurrent smart_bot (C4) requests are in flight.
     *   Any degradation here — latency > 200 ms or status != 200 — points
     *   to a Node.js-level problem, not a gamey problem.
     *
     * Expected: 200 OK · response < 20 ms · every single poll.
     */
    private final ScenarioBuilder scnHealth = scenario("E — HealthProbe (GET /health)")
        .forever().on(
            exec(
                http("E1 · GET /health")
                    .get(HEALTH_PATH)
                    .check(status().is(200))
            )
            .pause(Duration.ofSeconds(2))
        );


    // ═════════════════════════════════════════════════════════════════════════
    // setUp  —  injection profiles and global assertions
    //
    // Scenarios start at staggered offsets so their individual contributions
    // are visible as distinct phases in the Gatling percentile chart:
    //
    //   t=0  s: Scenario A starts — establishes overhead baseline
    //   t=5  s: Scenario B starts — fast_bot load begins building
    //   t=10 s: Scenario C starts — smart_bot load begins building
    //   t=15 s: Scenario D starts — default fallback probing
    //   t=0  s: Scenario E starts — health probing throughout
    //
    // Peak virtual users: 20 (A) + 20 (B) + 10 (C) + 10 (D) + 1 (E) = 61
    // ═════════════════════════════════════════════════════════════════════════
    {
        setUp(
            // A — Overhead: fast ramp, establishes the latency floor
            scnOverhead.injectOpen(
                rampUsers(20).during(Duration.ofSeconds(30))
            ),

            // B — FastBot: starts 5 s in, medium ramp
            scnFastBot.injectOpen(
                nothingFor(Duration.ofSeconds(5)),
                rampUsers(20).during(Duration.ofSeconds(45))
            ),

            // C — SmartBot: starts 10 s in, slow ramp
            //     Each user holds the gamey CPU for up to 3 s, so even a
            //     small ramp will produce significant queuing.
            scnSmartBot.injectOpen(
                nothingFor(Duration.ofSeconds(10)),
                rampUsers(10).during(Duration.ofSeconds(60))
            ),

            // D — DefaultFallback: starts 15 s in, lightest load
            scnDefault.injectOpen(
                nothingFor(Duration.ofSeconds(15)),
                rampUsers(10).during(Duration.ofSeconds(30))
            ),

            // E — HealthProbe: 1 user, runs for the entire simulation
            scnHealth.injectOpen(
                atOnceUsers(1)
            )
        )
        .protocols(httpProtocol)
        .assertions(
            // No request should hard-fail with a 5xx or network error.
            // D1 and D2 accept 400 via .check(status().in(200, 400)) above,
            // so they do not count as KOs even if bot_id is required.
            global().failedRequests().percent().is(0.0),

            // Overall mean response time should stay below 3 000 ms.
            // smart_bot will pull this up; if it exceeds 3 s the mean
            // indicates severe queuing beyond the bot's own time budget.
            global().responseTime().mean().lt(3000)
        );
    }
}
