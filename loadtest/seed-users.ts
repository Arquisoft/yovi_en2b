/**
 * loadtest/seed-users.ts
 *
 * Seeds the YOVI database with bot users for Gatling load testing.
 *
 * Usage:
 *   npx tsx seed-users.ts [options]
 *
 * Options (all optional, defaults shown):
 *   --count     Number of users to create       (default: 200)
 *   --prefix    Username prefix                  (default: "loadbot")
 *   --password  Shared password for all bots     (default: "Loadtest#1")
 *   --api       Base API URL                     (default: https://api.micrati.com/users)
 *   --out       Output JSON path for Gatling     (default: ./users.json)
 *   --concurrency  Parallel requests at a time   (default: 10)
 *
 * Example:
 *   npx tsx seed-users.ts --count 500 --prefix perf --out ./gatling/resources/users.json
 *
 * Output format (Gatling JSON feeder):
 *   [
 *     { "email": "loadbot_001@loadtest.yovi", "password": "Loadtest#1", "username": "loadbot_001", "token": "eyJ..." },
 *     ...
 *   ]
 *
 * The script is idempotent: if a user already exists (HTTP 400 with
 * "already exists"), it falls back to a login attempt and keeps going.
 *
 * Dependencies (dev-only, no extra install needed if you have tsx):
 *   npx tsx seed-users.ts   → runs directly with Node 18+ via tsx
 *   Or compile: npx tsc seed-users.ts --esModuleInterop --target ES2022 --module commonjs
 */

import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(): {
  count: number;
  prefix: string;
  password: string;
  api: string;
  out: string;
  concurrency: number;
} {
  const args = process.argv.slice(2);
  const get = (flag: string, fallback: string): string => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
  };

  return {
    count: parseInt(get("--count", "200"), 10),
    prefix: get("--prefix", "loadbot"),
    password: get("--password", "Loadtest#1"),
    api: get("--api", "https://api.micrati.com/users"),
    out: get("--out", "./users.json"),
    concurrency: parseInt(get("--concurrency", "10"), 10),
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BotUser {
  username: string;
  email: string;
  password: string;
  token: string;
}

interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

interface LoginPayload {
  email: string;
  password: string;
}

interface AuthResponse {
  token: string;
  user: { id: number; username: string; email: string };
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const message =
      (data.message as string) ||
      (data.error as string) ||
      `HTTP ${res.status}`;
    const err = new Error(message) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// Per-user seeding logic
// ---------------------------------------------------------------------------

async function seedOne(
  api: string,
  username: string,
  email: string,
  password: string
): Promise<BotUser> {
  const registerPayload: RegisterPayload = { username, email, password };

  try {
    // Happy path: register → we get back the user but NOT a token (your backend
    // returns 201 + { message, user } without a token on registration).
    await post<{ message: string; user: unknown }>(
      `${api}/api/auth/register`,
      registerPayload
    );
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    // 400 "already exists" → tolerated, fall through to login
    if (e.status === 400 && e.message.toLowerCase().includes("already")) {
      // fall through
    } else {
      throw err; // unexpected error — propagate
    }
  }

  // Obtain a JWT (needed whether we just registered or the user existed)
  const loginPayload: LoginPayload = { email, password };
  const auth = await post<AuthResponse>(`${api}/api/auth/login`, loginPayload);

  return { username, email, password, token: auth.token };
}

// ---------------------------------------------------------------------------
// Concurrency helper
// ---------------------------------------------------------------------------

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
  onProgress: (done: number, total: number) => void
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let idx = 0;
  let done = 0;

  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      try {
        results[i] = { status: "fulfilled", value: await tasks[i]() };
      } catch (e) {
        results[i] = {
          status: "rejected",
          reason: e instanceof Error ? e.message : String(e),
        };
      }
      onProgress(++done, tasks.length);
    }
  }

  const workers = Array.from({ length: concurrency }, worker);
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Progress bar (no external libs)
// ---------------------------------------------------------------------------

function renderProgress(done: number, total: number): void {
  const pct = Math.floor((done / total) * 100);
  const filled = Math.floor(pct / 2);
  const bar = "█".repeat(filled) + "░".repeat(50 - filled);
  process.stdout.write(`\r[${bar}] ${pct}% (${done}/${total})`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { count, prefix, password, api, out, concurrency } = parseArgs();

  console.log("╔══════════════════════════════════════════╗");
  console.log("║       YOVI Load Test — User Seeder       ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log(`  API     : ${api}`);
  console.log(`  Users   : ${count}`);
  console.log(`  Prefix  : ${prefix}`);
  console.log(`  Concurr.: ${concurrency}`);
  console.log(`  Output  : ${out}`);
  console.log("");

  // Build the list of users to create
  const users = Array.from({ length: count }, (_, i) => {
    // Zero-pad index so Gatling sorts / identifies users cleanly
    const idx = String(i + 1).padStart(4, "0");
    const username = `${prefix}_${idx}`;
    const email = `${username}@loadtest.yovi`;
    return { username, email };
  });

  const tasks = users.map(
    ({ username, email }) =>
      () =>
        seedOne(api, username, email, password)
  );

  console.log("Seeding users...\n");
  const results = await runWithConcurrency(tasks, concurrency, (done, total) =>
    renderProgress(done, total)
  );

  process.stdout.write("\n\n");

  // Partition results
  const successful: BotUser[] = [];
  const failed: { username: string; reason: string }[] = [];

  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      successful.push(result.value);
    } else {
      failed.push({
        username: users[i].username,
        reason: String((result as PromiseRejectedResult).reason),
      });
    }
  });

  // Write Gatling-compatible JSON feeder
  const outDir = path.dirname(out);
  if (outDir && outDir !== "." && !fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(out, JSON.stringify(successful, null, 2), "utf-8");

  // Summary
  console.log("═══════════════════════ Summary ═══════════════════════");
  console.log(`  Created / logged in : ${successful.length}`);
  console.log(`  Failed              : ${failed.length}`);
  console.log(`  Feeder written to   : ${path.resolve(out)}`);

  if (failed.length > 0) {
    console.log("\nFailed users (first 20):");
    failed.slice(0, 20).forEach(({ username, reason }) =>
      console.log(`  - ${username}: ${reason}`)
    );
  }

  console.log("\nDone.");

  // Exit with error code if more than 10 % failed
  if (failed.length / count > 0.1) {
    console.error(
      `\nMore than 10% of users failed to seed. Check the API and retry.`
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
