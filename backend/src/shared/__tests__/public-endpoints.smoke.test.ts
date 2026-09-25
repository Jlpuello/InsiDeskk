import request from 'supertest';
import { createApp } from '../../app.js';
import { disconnectPrisma } from '../prisma/client.js';
import { closeRedisClient } from '../../config/redis.js';
import { env } from '../../config/env.js';

describe('endpoints operativos y públicos', () => {
  const app = createApp();

  afterAll(async () => {
    await disconnectPrisma();
    await closeRedisClient();
  });

  it('/health y /health/db responden ok', async () => {
    expect((await request(app).get('/health')).status).toBe(200);
    const db = await request(app).get('/health/db');
    expect(db.status).toBe(200);
    expect(db.body.database).toBe('connected');
  });

  it('/metrics nunca es público: 503 sin METRICS_TOKEN configurado, 401 con token incorrecto', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(env.metricsToken ? 401 : 503);

    if (env.metricsToken) {
      expect((await request(app).get('/metrics').set('x-metrics-token', env.metricsToken)).status).toBe(200);
    }
  });

  it('/api/public/ai-chat/status responde un booleano sin exponer configuración', async () => {
    const res = await request(app).get('/api/public/ai-chat/status');
    expect(res.status).toBe(200);
    expect(typeof res.body.data.enabled).toBe('boolean');
    expect(Object.keys(res.body.data)).toEqual(['enabled']);
  });

  it('/api/public/ai-chat exige mensajes válidos (422 con body vacío)', async () => {
    const res = await request(app).post('/api/public/ai-chat').send({});
    expect(res.status).toBe(422);
  });
});
