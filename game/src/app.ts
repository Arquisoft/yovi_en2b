import 'reflect-metadata';
import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import YAML from 'js-yaml';
import fs from 'fs';
import path from 'path';
import { AppDataSource } from './config/database';
import gameRoutes from './routes/gameRoutes';
import { jsonErrorHandler, globalErrorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

console.log(`Starting game service with env: ${process.env.NODE_ENV}`);

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

// SWAGGER DOCUMENTATION
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

    app.listen(PORT, () => {
      console.log(`Game service running at http://api.localhost/game`);
      console.log(`Swagger documentation: http://api.localhost/game/api-docs`);
      console.log(`Health check: http://api.localhost/game/health`);
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
