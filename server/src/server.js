import express from 'express';
import cors from 'cors';
import logisticsRoutes from './routes/logistics.routes.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/logistics', logisticsRoutes);

app.listen(5000, () => console.log('Servidor en puerto 5000'));
