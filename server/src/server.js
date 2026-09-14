import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import logisticsRoutes from './routes/logistics.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Conexión opcional a MongoDB Atlas mediante variable de entorno segura MONGODB_URI
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB Atlas conectado correctamente'))
    .catch((err) => console.error('Error al conectar con MongoDB:', err.message));
} else {
  console.log('Modo backend local sin MONGODB_URI (Servicio con fallback)');
}

app.use('/api/logistics', logisticsRoutes);

app.listen(PORT, () => console.log(`Servidor de Gula Logistics en puerto ${PORT}`));
