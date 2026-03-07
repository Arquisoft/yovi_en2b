import express from 'express';
import cors from 'cors';
import gameRoutes from './routes/gameRoutes';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/games', gameRoutes);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`YOVI Backend API compliant with OpenAPI running on port ${PORT}`);
});