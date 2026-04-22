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

  // ── Protocol — unchanged from recorder output ──────────────────────────────
  private HttpProtocolBuilder httpProtocol = http
    .baseUrl("https://api.micrati.com")
    .inferHtmlResources()
    .acceptHeader("*/*")
    .acceptEncodingHeader("gzip, deflate, br")
    .acceptLanguageHeader("en,en-US;q=0.9,es;q=0.8,nl;q=0.7,de;q=0.6")
    .userAgentHeader("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36");

  // ── Feeder — reads user-files/resources/users.json ─────────────────────────
  // .circular() loops through the list endlessly so any number of virtual
  // users can be injected regardless of how many entries the file has.
  private final FeederBuilder<Object> userFeeder =
      jsonFile("users.json").circular();

  // ── Header maps — unchanged from recorder output ───────────────────────────
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
  private ScenarioBuilder scn = scenario("RecordedSimulation")
    // CHANGE 1: inject one bot user per virtual user from the feeder
    .feed(userFeeder)
    .exec(
      http("request_0")
        .options("/users/api/auth/login")
        .headers(headers_0)
        .resources(
          // CHANGE 2: replaced RawFileBody (hard-coded creds) with StringBody
          // using feeder variables #{email} / #{password}.
          // Added .check() to extract the JWT and store it as #{token}.
          http("request_1")
            .post("/users/api/auth/login")
            .headers(headers_1)
            .body(StringBody("{\"email\":\"#{email}\",\"password\":\"#{password}\"}"))
            .check(status().is(200))
            .check(jsonPath("$.token").saveAs("token")),
          http("request_2")
            .get(uri2 + "/vite.svg")
            .headers(headers_2),
          http("request_3")
            .get(uri2 + "/other-game-thumbnail.svg")
            .headers(headers_2),
          http("request_4")
            .get(uri2 + "/images/game-y-thumbnail-v1-dark.png")
            .headers(headers_2)
        ),
      pause(11),
      http("request_5")
        .get(uri2 + "/vite.svg")
        .headers(headers_2),
      pause(7),
      http("request_6")
        .get(uri2 + "/vite.svg")
        .headers(headers_2),
      pause(10),
      http("request_7")
        .options("/game/api/games")
        .headers(headers_7)
        .resources(
          // CHANGE 3: added Authorization header + saved gameId from response
          http("request_8")
            .post("/game/api/games")
            .headers(headers_1)
            .header("Authorization", "Bearer #{token}")
            .body(RawFileBody("yovi/recordedsimulation/0008_request.json"))
            .check(status().is(201))
            .check(jsonPath("$.id").saveAs("gameId")),
          http("request_9")
            .get(uri2 + "/vite.svg")
            .headers(headers_2),
          // CHANGE 4: replaced hard-coded UUID with #{gameId}
          // (applies to every URL that contained a4b8c792-dad8-42e9-8f30-e83c5494aa0d)
          http("request_10")
            .get("/game/api/games/#{gameId}")
            .headers(headers_10)
            .header("Authorization", "Bearer #{token}")
        ),
      pause(10),
      http("request_11")
        .options("/game/api/games/#{gameId}/move")
        .headers(headers_7)
        .resources(
          http("request_12")
            .post("/game/api/games/#{gameId}/move")
            .headers(headers_1)
            .header("Authorization", "Bearer #{token}")
            .body(RawFileBody("yovi/recordedsimulation/0012_request.json"))
        ),
      pause(1),
      http("request_13")
        .options("/game/api/games/#{gameId}/move")
        .headers(headers_7)
        .resources(
          http("request_14")
            .post("/game/api/games/#{gameId}/move")
            .headers(headers_1)
            .header("Authorization", "Bearer #{token}")
            .body(RawFileBody("yovi/recordedsimulation/0014_request.json")),
          http("request_15")
            .options("/game/api/games/#{gameId}/move")
            .headers(headers_7),
          http("request_16")
            .post("/game/api/games/#{gameId}/move")
            .headers(headers_1)
            .header("Authorization", "Bearer #{token}")
            .body(RawFileBody("yovi/recordedsimulation/0016_request.json"))
        ),
      pause(1),
      http("request_17")
        .options("/game/api/games/#{gameId}/move")
        .headers(headers_7)
        .resources(
          http("request_18")
            .post("/game/api/games/#{gameId}/move")
            .headers(headers_1)
            .header("Authorization", "Bearer #{token}")
            .body(RawFileBody("yovi/recordedsimulation/0018_request.json")),
          http("request_19")
            .options("/game/api/games/#{gameId}/move")
            .headers(headers_7),
          http("request_20")
            .post("/game/api/games/#{gameId}/move")
            .headers(headers_1)
            .header("Authorization", "Bearer #{token}")
            .body(RawFileBody("yovi/recordedsimulation/0020_request.json"))
        ),
      pause(1),
      http("request_21")
        .options("/game/api/games/#{gameId}/move")
        .headers(headers_7)
        .resources(
          http("request_22")
            .post("/game/api/games/#{gameId}/move")
            .headers(headers_1)
            .header("Authorization", "Bearer #{token}")
            .body(RawFileBody("yovi/recordedsimulation/0022_request.json")),
          http("request_23")
            .options("/game/api/games/#{gameId}/move")
            .headers(headers_7),
          http("request_24")
            .post("/game/api/games/#{gameId}/move")
            .headers(headers_1)
            .header("Authorization", "Bearer #{token}")
            .body(RawFileBody("yovi/recordedsimulation/0024_request.json")),
          http("request_25")
            .options("/game/api/games/#{gameId}/move")
            .headers(headers_7),
          http("request_26")
            .post("/game/api/games/#{gameId}/move")
            .headers(headers_1)
            .header("Authorization", "Bearer #{token}")
            .body(RawFileBody("yovi/recordedsimulation/0026_request.json"))
        ),
      pause(1),
      http("request_27")
        .options("/game/api/games/#{gameId}/move")
        .headers(headers_7)
        .resources(
          http("request_28")
            .post("/game/api/games/#{gameId}/move")
            .headers(headers_1)
            .header("Authorization", "Bearer #{token}")
            .body(RawFileBody("yovi/recordedsimulation/0028_request.json"))
        ),
      pause(3),
      http("request_29")
        .options("/game/api/games/#{gameId}/move")
        .headers(headers_7)
        .resources(
          http("request_30")
            .post("/game/api/games/#{gameId}/move")
            .headers(headers_1)
            .header("Authorization", "Bearer #{token}")
            .body(RawFileBody("yovi/recordedsimulation/0030_request.json"))
        ),
      pause(5),
      http("request_31")
        .options("/game/api/games/#{gameId}/move")
        .headers(headers_7)
        .resources(
          http("request_32")
            .post("/game/api/games/#{gameId}/move")
            .headers(headers_1)
            .header("Authorization", "Bearer #{token}")
            .body(RawFileBody("yovi/recordedsimulation/0032_request.json"))
        ),
      pause(1),
      http("request_33")
        .options("/game/api/games/#{gameId}/move")
        .headers(headers_7)
        .resources(
          http("request_34")
            .post("/game/api/games/#{gameId}/move")
            .headers(headers_1)
            .header("Authorization", "Bearer #{token}")
            .body(RawFileBody("yovi/recordedsimulation/0034_request.json"))
        ),
      pause(8),
      http("request_35")
        .get(uri2 + "/vite.svg")
        .headers(headers_2)
        .resources(
          http("request_36")
            .options("/users/api/stats/history")
            .headers(headers_36),
          http("request_37")
            .options("/users/api/stats/winrate")
            .headers(headers_36),
          // CHANGE 5: added Authorization to stats requests
          http("request_38")
            .get("/users/api/stats/history")
            .headers(headers_1)
            .header("Authorization", "Bearer #{token}"),
          http("request_39")
            .get("/users/api/stats/winrate")
            .headers(headers_1)
            .header("Authorization", "Bearer #{token}")
        ),
      pause(5),
      http("request_40")
        .get(uri2 + "/vite.svg")
        .headers(headers_2)
    );

  {
    // CHANGE 6: replaced atOnceUsers(1) with a realistic ramp
    setUp(
      scn.injectOpen(rampUsers(50).during(Duration.ofSeconds(30)))
    ).protocols(httpProtocol);
  }
}