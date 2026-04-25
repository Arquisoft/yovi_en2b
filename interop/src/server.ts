import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import gameRoutes from './routes/gameRoutes';

const openApiSpec = yaml.load(fs.readFileSync(path.join(__dirname, '../openapi.yaml'), 'utf8')) as object;

const app = express();
const PORT = parseInt(process.env.WEBAPP_PORT ?? '3001', 10);

console.log(`Starting interop service with env: ${process.env.APP_ENV}`);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'"],
      "style-src": ["'self'", "'unsafe-inline'", "https:"],
      "img-src": ["'self'", "data:", "validator.swagger.io"]
    }
  },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginEmbedderPolicy: false
}));
app.use(express.json());

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
app.use('/games', gameRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date(), uptime: process.uptime() });
});

// 404 fallback
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  const base = process.env.PUBLIC_URL;
  console.log(`Interop service API at ${base}/interop`);
  console.log(`Health check: ${base}/health`);
});

export default app;
