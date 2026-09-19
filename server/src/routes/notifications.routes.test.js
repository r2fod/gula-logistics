import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';

// Mocking dependencies
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue(true)
  }
}));

vi.mock('../models/PushSubscription.js', () => ({
  default: {
    findOneAndUpdate: vi.fn(),
    find: vi.fn(),
    deleteOne: vi.fn()
  }
}));

const notificationsRoutes = (await import('./notifications.routes.js')).default;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/notifications', notificationsRoutes);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/notifications/subscribe', () => {
  it('returns 400 if workerName or subscription is missing', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/notifications/subscribe')
      .send({ workerName: 'Irene' }); // missing subscription

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Faltan datos de suscripción');
    expect(PushSubscription.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('saves subscription successfully', async () => {
    PushSubscription.findOneAndUpdate.mockResolvedValue({});
    const app = buildApp();
    const res = await request(app)
      .post('/api/notifications/subscribe')
      .send({
        workerName: 'Irene',
        subscription: { endpoint: 'https://push.example.com/xyz', keys: { p256dh: 'a', auth: 'b' } }
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Suscripción guardada correctamente');
    expect(PushSubscription.findOneAndUpdate).toHaveBeenCalledWith(
      { 'subscription.endpoint': 'https://push.example.com/xyz' },
      expect.objectContaining({ workerName: 'Irene' }),
      { upsert: true, new: true }
    );
  });
});

describe('POST /api/notifications/notify', () => {
  it('returns 401 if admin token is missing', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/notifications/notify')
      .send({ title: 'T', body: 'B' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Unauthorized/);
  });

  it('sends notifications to all subscribers', async () => {
    PushSubscription.find.mockResolvedValue([
      { _id: '1', workerName: 'Irene', subscription: { endpoint: 'ep1' } },
      { _id: '2', workerName: 'Juan', subscription: { endpoint: 'ep2' } }
    ]);
    const app = buildApp();
    const res = await request(app)
      .post('/api/notifications/notify')
      .set('Authorization', `Bearer ${process.env.ADMIN_TOKEN || 'gula_admin_secret_2024'}`)
      .send({ title: 'Alerta', body: 'Turnos' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Notificación enviada a 2 dispositivo(s).');
    expect(PushSubscription.find).toHaveBeenCalled();
    expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
  });

  it('handles empty subscribers gracefully', async () => {
    PushSubscription.find.mockResolvedValue([]);
    const app = buildApp();
    const res = await request(app)
      .post('/api/notifications/notify')
      .set('Authorization', `Bearer ${process.env.ADMIN_TOKEN || 'gula_admin_secret_2024'}`)
      .send({ title: 'Alerta', body: 'Turnos' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/No hay usuarios suscritos/);
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });
});
