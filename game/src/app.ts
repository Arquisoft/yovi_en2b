import 'reflect-metadata';
import express from 'express';
import http from 'node:http';
import dotenv from 'dotenv';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import YAML from 'js-yaml';
import fs from 'node:fs';
import path from 'node:path';
import { AppDataSource } from './config/database';
import gameRoutes from './routes/gameRoutes';
import { jsonErrorHandler, globalErrorHandler } from './middleware/errorHandler';
import { WebSocketManager } from './websocket/WebSocketManager';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

console.log(`Starting game service with env: ${process.env.APP_ENV}`);

app.use(express.json({ limit: '10mb' }));

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

app.use(jsonErrorHandler);

try {
  const swaggerPath = path.join(__dirname, '../openapi.yaml');
  const swaggerDocument = YAML.load(fs.readFileSync(swaggerPath, 'utf8')) as object;
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  console.log('Swagger UI running');
} catch (error) {
  console.warn('Could not load openapi.yaml:', error);
}

app.use('/api/games', gameRoutes);

app.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date(), uptime: process.uptime() });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
  });
});

app.use(globalErrorHandler);

const startServer = async () => {
  try {
    await AppDataSource.initialize();
    console.log('MariaDB database connected');

    // Crear el servidor HTTP manualmente para poder pasárselo al WebSocketManager
    const server = http.createServer(app);

    // Instanciar el WebSocketManager — adjunta ws.Server en path '/ws'
    new WebSocketManager(server);
    console.log('WebSocket server attached at /ws');

    server.listen(PORT, () => {
      const base = process.env.PUBLIC_URL;
      console.log(`Game service API at ${base}/api`);
      console.log(`Swagger documentation: ${base}/api-docs`);
      console.log(`Health check: ${base}/health`);
    });
  } catch (error) {
    console.error('Error starting game service:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

export default app;