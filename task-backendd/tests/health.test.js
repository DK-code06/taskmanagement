const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../server');

require('./setup');

describe('Health & Readiness Endpoints (M4.6-P0)', () => {
  it('GET /api/health - should return process liveness status without authentication', async () => {
    const res = await request(app).get('/api/health');

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.uptime).toBeDefined();
    expect(res.body.timestamp).toBeDefined();

    // Ensure no sensitive credentials or environment variables are leaked
    expect(res.body.env).toBeUndefined();
    expect(res.body.JWT_SECRET).toBeUndefined();
    expect(res.body.MONGO_URI).toBeUndefined();
    expect(res.body.password).toBeUndefined();
  });

  it('GET /api/ready - should return ready status when database is connected', async () => {
    const res = await request(app).get('/api/ready');

    expect(res.statusCode).toBe(200);
    expect(res.body.ready).toBe(true);
    expect(res.body.db).toBe('connected');

    // Ensure no sensitive connection URI is leaked
    expect(res.body.uri).toBeUndefined();
    expect(res.body.connectionString).toBeUndefined();
  });

  it('GET /api/ready - should return 503 when database connection is disconnected', async () => {
    const mongoUri = mongoose.connection._connectionString || process.env.MONGO_URI;

    // Disconnect mongoose temporarily
    await mongoose.disconnect();

    const res = await request(app).get('/api/ready');

    expect(res.statusCode).toBe(503);
    expect(res.body.ready).toBe(false);
    expect(res.body.db).toBe('disconnected');

    // Reconnect mongoose for subsequent test suites if needed
    if (mongoUri) {
      await mongoose.connect(mongoUri);
    }
  });
});
