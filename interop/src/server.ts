// ──────────────────────────────────────────────────────────────────────────────
// server.ts
//
// Express entry point for the webapp backend (Game API / BFF).
//
// Port: read from WEBAPP_PORT env var, defaults to 3001.
//       (The users service occupies 3000; see docker-compose.yml)
// ──────────────────────────────────────────────────────────────────────────────

import express from 'express';
import cors from 'cors';
import gameRoutes from './routes/gameRoutes';

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Routes ───────────────────────────────────────────────────────────────────

// Game API — all endpoints are under /games (matches webapp/openapi.yaml paths)
app.use('/games', gameRoutes);

// Health check endpoint — used by Docker Compose healthcheck and monitoring
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// 404 fallback
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.WEBAPP_PORT ?? '3001', 10);

app.listen(PORT, () => {
  console.log(`YOVI Game API running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

export default app;