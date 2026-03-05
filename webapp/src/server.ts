import express from 'express';
import cors from 'cors';
import gameRoutes from './routes/gameRoutes';

const app = express();

// Middleware
app.use(cors());          // Requirement: Allows Frontend to talk to Backend
app.use(express.json()); // Requirement: To read JSON in YEN notation

// Routing - This connects your Routes layer
app.use('/games', gameRoutes); 

// The Process
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ YOVI Game API is running on http://localhost:${PORT}`);
});