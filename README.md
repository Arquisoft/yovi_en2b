# yovi_en2b — Game Y at UniOvi · [micrati.com](https://micrati.com)

[![Release — Test, Build, Publish, Deploy](https://github.com/arquisoft/yovi_en2b/actions/workflows/release-deploy.yml/badge.svg)](https://github.com/arquisoft/yovi_en2b/actions/workflows/release-deploy.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=Arquisoft_yovi_en2b&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=Arquisoft_yovi_en2b)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=Arquisoft_yovi_en2b&metric=coverage)](https://sonarcloud.io/summary/new_code?id=Arquisoft_yovi_en2b)

## Group Members

Developed by the following group members as part of the ASW labs at Uniovi:

| Name | GitHub |
|------|--------|
| Marcos Losada García | [@losadgm](https://github.com/losadgm) |
| Rafael Álvarez Iglesias | [@XBotYT](https://github.com/XBotYT) |
| Marcos Rodríguez Fernández | [@Cuitoss](https://github.com/Cuitoss) |
| Sergio Fernández-Miranda Longo | [@clubserg](https://github.com/clubserg) |

---

## Architecture Overview

YOVI EN2B is a polyglot microservices monorepo. All services are coordinated via Docker Compose and exposed through an Nginx reverse proxy.

```
Browser
   │
   ▼
Nginx (reverse proxy)
   ├── /          → webapp      (React SPA,       port 80)
   ├── /users/    → users       (Node.js/Express,  port 3000)
   └── /game/     → game        (Node.js/Express,  port 5000)
                                      │
                                      └──► gamey  (Rust/Axum, port 4000 — internal only)
```

### Services

| Service | Language | Port | Purpose |
|---------|----------|------|---------|
| `webapp` | TypeScript / React 18 | 80 | Single-page application |
| `users` | TypeScript / Node.js 22 | 3000 | Auth, user profiles, stats, ranking |
| `game` | TypeScript / Node.js 22 | 5000 | Game sessions, move validation, bot orchestration |
| `gamey` | Rust (Axum) | 4000 | Bot AI engine — internal only, not browser-accessible |

**Key architectural constraints:**
- The browser never calls `gamey` directly. All bot requests go through the `game` service.
- Match records are written server-side by the `game` service when a game ends.
- `game` and `users` share the same MariaDB instance (`users_db`) and JWT secret.

---

## Project Structure

```
yovi_en2b/
├── webapp/          # React SPA (Vite, TypeScript, Tailwind, Radix UI)
├── users/           # Users microservice (Express, TypeORM, MariaDB)
├── game/            # Game microservice (Express, TypeORM, MariaDB)
├── gamey/           # Rust bot engine (Axum, minimax AI)
└── docs/            # Arc42 architecture documentation
```

---

## Features

- **User accounts**: Registration, login (JWT), profile management, password change
- **Game Y**: Full server-side game logic — move validation, triangular board, win detection
- **Bot AI**: Three difficulty levels backed by a Rust minimax engine
  - Easy → `random_bot`
  - Medium → `fast_bot` (minimax, 500 ms)
  - Hard → `smart_bot` (minimax, up to 3 000 ms)
- **Game modes**: PvE (vs bot), PvP local (two players, one device)
- **Guest play**: Play without an account using a client-generated ID
- **Timers**: Per-player countdown, server-side enforcement
- **Match history & ranking**: Stats persisted automatically when games end
- **Monitoring**: Prometheus + Grafana dashboards

---

## Running the Project

### With Docker (recommended)

Requires [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/).

```bash
docker compose up --build
```

| URL | Service |
|-----|---------|
| http://localhost | Web application |
| http://localhost/users/api-docs | Users API (Swagger) |
| http://localhost/game/api-docs | Game API (Swagger) |
| http://localhost/grafana | Grafana (admin / admin) |
| http://localhost/prometheus | Prometheus metrics |

### Without Docker

You need Node.js 22, Rust (stable), and a running MariaDB 11.4 instance.

**1. Users service**
```bash
cd users && npm install && npm run dev
# Available at http://localhost:3000
```

**2. Game service**
```bash
cd game && npm install && npm run dev
# Available at http://localhost:5000
# Requires: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, JWT_SECRET, RUST_INTERNAL_URL
```

**3. Bot engine**
```bash
cd gamey && cargo run -- --mode server --port 4000
# Available at http://localhost:4000 (internal only)
```

**4. Web application**
```bash
cd webapp && npm install && npm run dev
# Available at http://localhost:3000 (Vite dev server)
```

---

## Testing

Each service has its own test suite. Backend services require MariaDB — use the test compose file:

```bash
# Start test database
docker compose -f docker-compose.test.yml up -d

# Run tests
npm --prefix users run test:ci
npm --prefix game  run test:ci
npm --prefix webapp run test:ci
cd gamey && cargo test

# Tear down
docker compose -f docker-compose.test.yml down -v
```

Or use the per-service `npm test` which spins up and tears down the DB automatically:

```bash
cd users && npm test
cd game  && npm test
```

### Coverage

```bash
npm --prefix users  run test:coverage:ci
npm --prefix game   run test:coverage:ci
npm --prefix webapp run test:coverage:ci
cd gamey && cargo llvm-cov --lcov --output-path lcov.info
```

---

## Available Scripts

### Webapp
| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm test` | Unit tests (Vitest + RTL) |
| `npm run test:e2e` | End-to-end tests (Playwright + Cucumber) |
| `npm run test:coverage` | Coverage report |

### Users service
| Command | Description |
|---------|-------------|
| `npm run dev` | Start with nodemon |
| `npm run build` | Compile TypeScript |
| `npm test` | Tests (spins up/down DB) |
| `npm run test:coverage` | Coverage report |

### Game service
| Command | Description |
|---------|-------------|
| `npm run dev` | Start with nodemon |
| `npm run build` | Compile TypeScript |
| `npm test` | Tests (spins up/down DB) |
| `npm run test:coverage` | Coverage report |

### Bot engine (gamey)
| Command | Description |
|---------|-------------|
| `cargo build` | Compile |
| `cargo test` | Unit + doc tests |
| `cargo run -- --mode server --port 4000` | Run HTTP server |
| `cargo bench` | Run benchmarks |
| `cargo doc` | Generate documentation |

---

## Environment Variables

### Env file structure

| File | Committed | Purpose |
|------|-----------|---------|
| `.env` | No (gitignored) | Local dev — single source of truth. Copy from `.env.example` |
| `.env.example` | Yes | Template with safe placeholder values |
| `.env.shared` | Yes | Production API URLs baked into the webapp bundle at CI build time |

**Development** (`npm run dev` or `docker compose up`): copy `.env.example` to `.env` and fill in secrets.

**Production (CI)**: `.env.shared` is copied to `.env` before the Docker image build, so Vite bakes prod URLs into the bundle. MariaDB credentials and JWT secret come from GitHub Secrets.

### Root `.env` / `.env.example`

| Variable | Example value | Description |
|----------|---------------|-------------|
| `APP_ENV` | `development` | Runtime environment (`development` / `production`) |
| `VITE_USERS_API_URL` | `http://api.localhost/users` | Webapp build-time URL for the users service |
| `VITE_GAME_API_URL` | `http://api.localhost/game` | Webapp build-time URL for the game service |
| `MARIADB_ROOT_PASSWORD` | — | MariaDB root password |
| `MARIADB_USER` | `yovi_user` | Application DB user |
| `MARIADB_PASSWORD` | — | Application DB password |
| `JWT_SECRET` | — | Shared JWT signing key (users + game) |

### Webapp — build-time only

`VITE_USERS_API_URL` and `VITE_GAME_API_URL` are read by Vite at build time via `loadEnv` in `vite.config.ts` (pointing to the root directory). They are baked into the JS bundle — not available at runtime. The single entry point is `webapp/src/config/api.ts`.

### Users service

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_ENV` | `production` | Runtime environment; gates TypeORM `synchronize` |
| `PORT` | `3000` | HTTP port |
| `DB_HOST` | — | MariaDB host |
| `DB_PORT` | `3306` | MariaDB port |
| `DB_NAME` | — | Database name |
| `DB_USER` | — | Database user |
| `DB_PASSWORD` | — | Database password |
| `JWT_SECRET` | — | Shared JWT signing key |
| `PUBLIC_URL` | — | Public base URL (e.g. `http://api.localhost/users`) — used in startup logs |

### Game service

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_ENV` | `production` | Runtime environment; gates TypeORM `synchronize` |
| `PORT` | `5000` | HTTP port |
| `DB_*` | — | Same MariaDB instance as users |
| `JWT_SECRET` | — | Must match users service |
| `RUST_INTERNAL_URL` | `http://gamey:4000` | Internal Docker hostname of the bot engine |
| `USERS_PUBLIC_URL` | — | Users service URL via Nginx (for recording match results) |
| `PUBLIC_URL` | — | Public base URL for the game service — used in startup logs |
