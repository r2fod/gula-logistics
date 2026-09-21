import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.routes.js';
import clockRoutes from './routes/clock.routes.js';
import logisticsRoutes from './routes/logistics.routes.js';
import balancesRoutes from './routes/balances.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import calendarioRoutes from './routes/calendario.routes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Render reenvía las peticiones con la IP real del cliente en
// X-Forwarded-For — sin esto, req.ip siempre devolvería la IP del propio
// proxy, y el rate-limiting de /api/auth/login por IP (ver auth.routes.js)
// trataría a todo el mundo como una sola IP.
// Se confía en UN salto (1) y no en `true`: con `true` Express toma la IP
// más a la izquierda de X-Forwarded-For, que el propio cliente puede
// falsificar mandando esa cabecera — bastaría rotarla en cada intento para
// saltarse el límite. Con 1 se usa la que añade el proxy de Render, que el
// cliente no controla.
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
app.use('/api/calendario', calendarioRoutes);

// Endpoint de verificación de salud
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mongoConnected: mongoose.connection.readyState === 1,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => console.log(`Servidor de Gula Logistics en puerto ${PORT}`));
