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
import rosterRoutes from './routes/roster.routes.js';

import aiMemoryRoutes from './routes/aiMemory.routes.js';
import iaRoutes from './routes/ia.routes.js';
import { usarCuerposJson, erroresDeCuerpo } from './middleware/cuerpoJson.js';

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

// No decir con qué está hecho el servidor, y cabeceras de protección: la API solo
// devuelve JSON (y los PDF de /uploads, que así no se pueden hacer pasar por una web).
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' });
  next();
});

app.use(cors());
// 2 MB: el prompt de Gemini lleva la semana entera y, aunque la app ya solo envía
// las semanas que cambian, el límite por defecto (100 KB) se quedaba corto. Lo público
// (fichar, avisos), mucho menos: ver cuerpoJson.js.
usarCuerposJson(app);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Conexión a MongoDB Atlas mediante variable de entorno MONGODB_URI
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    // Sin migraciones aquí: el servidor arranca muchas veces al día (Render lo duerme) y
    // una migración en el arranque se repite en cada uno. La del 03/10/2026 ya corrió
    // (renombrado de una ficha y fechas de apuntes antiguos; ver MEJORAS.md).
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
app.use('/api/roster', rosterRoutes);
app.use('/api/aimemory', aiMemoryRoutes);
app.use('/api/ia', iaRoutes);
app.use(erroresDeCuerpo);

// Endpoint de verificación de salud. `version`: el commit desplegado (Render lo da en
// RENDER_GIT_COMMIT; el repo es público): así se sabe si un despliegue ya está en marcha.
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: (process.env.RENDER_GIT_COMMIT || 'local').slice(0, 7),
    mongoConnected: mongoose.connection.readyState === 1,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => console.log(`Servidor de Gula Logistics en puerto ${PORT}`));
