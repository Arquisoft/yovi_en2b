import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import promBundle from 'express-prom-bundle';
import swaggerUi from 'swagger-ui-express';
import helmet from 'helmet';
import YAML from 'js-yaml';
import fs from 'fs';
import path from 'path';
import { AppDataSource } from './config/database';
import authRoutes from './routes/authRoutes';
import { jsonErrorHandler, globalErrorHandler } from './middleware/errorHandler';
import statsRoutes from './routes/statsRoutes';
import rankingRoutes from './routes/rankingRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

console.log(`Starting nodejs server with env: ` + process.env.APP_ENV);

app.use(cors());
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

const metricsMiddleware = promBundle({
    includeMethod: true,
    includePath: true,
    includeStatusCode: true,
    includeUp: true,
    customLabels: { project: 'YOVI' },
    promClient: {
        collectDefaultMetrics: {}
    }
});
app.use(metricsMiddleware);

try {
    const swaggerPath = path.join(__dirname, '../openapi.yaml');
    const swaggerDocument = YAML.load(fs.readFileSync(swaggerPath, 'utf8')) as object;
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    console.log('Swagger UI running');
} catch (error) {
    console.warn('Could not load openapi.yaml:', error);
}

app.use(jsonErrorHandler);

app.use('/api/auth', authRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/ranking', rankingRoutes);

app.get('/health', (_, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date(),
        uptime: process.uptime()
    });
});

app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.path}`,
        path: req.path
    });
});

app.use(globalErrorHandler);

const startServer = async () => {
    try {
        await AppDataSource.initialize();
        console.log('MariaDB database connected');

        app.listen(PORT, () => {
            const base = process.env.PUBLIC_URL
            console.log(`Server API at ${base}/api`);
            console.log(`Swagger documentation: ${base}/api-docs`);
            console.log(`Health check: ${base}/health`);
        });
    } catch (error) {
        console.error('Error starting server:', error);
        process.exit(1);
    }
};

if (require.main === module) {
    startServer();
}

export default app;