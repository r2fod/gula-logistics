import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.routes.js';
import clockRoutes from './routes/clock.routes.js';
import logisticsRoutes from './routes/logistics.routes.js';
import balancesRoutes from './routes/balances.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Conexión a MongoDB Atlas mediante variable de entorno MONGODB_URI
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB Atlas conectado correctamente (Saldos y Fichajes sincronizados)'))
    .catch((err) => console.error('Error al conectar con MongoDB Atlas:', err.message));
} else {
  console.log('Modo backend local sin MONGODB_URI (Respaldo en memoria local activo)');
}

// Rutas de API para datos sensibles
app.use('/api/auth', authRoutes);
app.use('/api/logistics', logisticsRoutes);
app.use('/api/clock', clockRoutes);
app.use('/api/balances', balancesRoutes);
app.use('/api/notifications', notificationsRoutes);

// Endpoint de verificación de salud
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mongoConnected: mongoose.connection.readyState === 1,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => console.log(`Servidor de Gula Logistics en puerto ${PORT}`));
