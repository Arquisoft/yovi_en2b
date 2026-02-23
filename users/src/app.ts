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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CROSS-ORIGIN RESOURCE SHARING
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? ['https://micrati.com', 'https://www.micrati.com']
        : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// JSON PARSING
app.use(express.json({ limit: '10mb' }));

// SECURITY 
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

// PROMETHEUS METRICS
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

// SWAGGER DOCUMENTATION
try {
    const swaggerPath = path.join(__dirname, '../openapi.yaml');
    const swaggerDocument = YAML.load(fs.readFileSync(swaggerPath, 'utf8')) as object;
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    console.log('Swagger UI available at /api-docs');
} catch (error) {
    console.warn('Could not load openapi.yaml:', error);
}

// JSON ERROR HANDLING
app.use(jsonErrorHandler);

// API ROUTES
app.use('/api/auth', authRoutes);

// HEALTH CHECK
app.get('/health', (_, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date(),
        uptime: process.uptime()
    });
});

// 404 HANDLING
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.path}`,
        path: req.path
    });
});

// GLOBAL ERROR HANDLING
app.use(globalErrorHandler);

// SERVER START
const startServer = async () => {
    try {
        await AppDataSource.initialize();
        console.log('MariaDB database connected');

        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
            console.log(`Prometheus metrics: http://localhost:${PORT}/metrics`);
            console.log(`Swagger documentation: http://localhost:${PORT}/api-docs`);
            console.log(`Health check: http://localhost:${PORT}/health`);
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