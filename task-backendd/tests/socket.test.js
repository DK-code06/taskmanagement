const request = require('supertest');
const { app, server } = require('../server');
const ioClient = require('socket.io-client');
const jwt = require('jsonwebtoken');

require('./setup');

let port;
let serverInstance;

beforeAll((done) => {
  serverInstance = server.listen(0, () => {
    port = serverInstance.address().port;
    done();
  });
});

afterAll((done) => {
  if (serverInstance) {
    serverInstance.close(done);
  } else {
    done();
  }
});

describe('Socket.IO Security & Room Authorization Tests', () => {
  let userAToken, userAId, userBToken, userBId;

  beforeEach(async () => {
    const resA = await request(app)
      .post('/api/auth/register')
      .send({ username: 'socketusera', password: 'password123' });
    userAToken = resA.body.token;
    userAId = resA.body.user.id;

    const resB = await request(app)
      .post('/api/auth/register')
      .send({ username: 'socketuserb', password: 'password123' });
    userBToken = resB.body.token;
    userBId = resB.body.user.id;
  });

  it('should accept socket connection with valid JWT token', (done) => {
    const socket = ioClient(`http://localhost:${port}`, {
      auth: { token: userAToken },
      transports: ['websocket'],
      forceNew: true
    });

    socket.on('connect', () => {
      expect(socket.connected).toBe(true);
      socket.disconnect();
      done();
    });

    socket.on('connect_error', (err) => {
      done(err);
    });
  });

  it('should reject socket connection with invalid JWT token', (done) => {
    const socket = ioClient(`http://localhost:${port}`, {
      auth: { token: 'invalid.jwt.token' },
      transports: ['websocket'],
      forceNew: true
    });

    socket.on('connect', () => {
      socket.disconnect();
      done(new Error('Should not have connected with invalid token'));
    });

    socket.on('connect_error', (err) => {
      expect(err.message).toContain('Authentication error');
      socket.disconnect();
      done();
    });
  });

  it('should reject socket connection with expired JWT token', (done) => {
    const expiredToken = jwt.sign(
      { id: userAId, username: 'socketusera', sessionVersion: 1 },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' }
    );

    const socket = ioClient(`http://localhost:${port}`, {
      auth: { token: expiredToken },
      transports: ['websocket'],
      forceNew: true
    });

    socket.on('connect', () => {
      socket.disconnect();
      done(new Error('Should not have connected with expired token'));
    });

    socket.on('connect_error', (err) => {
      expect(err.message).toContain('Authentication error');
      socket.disconnect();
      done();
    });
  });

  it('should support multiple simultaneous sockets for the same user joining user:{id} room', (done) => {
    const socket1 = ioClient(`http://localhost:${port}`, {
      auth: { token: userAToken },
      transports: ['websocket'],
      forceNew: true
    });

    const socket2 = ioClient(`http://localhost:${port}`, {
      auth: { token: userAToken },
      transports: ['websocket'],
      forceNew: true
    });

    let connectedCount = 0;
    const checkDone = () => {
      connectedCount++;
      if (connectedCount === 2) {
        expect(socket1.connected).toBe(true);
        expect(socket2.connected).toBe(true);
        socket1.disconnect();
        socket2.disconnect();
        done();
      }
    };

    socket1.on('connect', checkDone);
    socket2.on('connect', checkDone);
  });

  it('should isolate task events to user:{id} room and NOT broadcast globally to unrelated users', (done) => {
    const socketA = ioClient(`http://localhost:${port}`, {
      auth: { token: userAToken },
      transports: ['websocket'],
      forceNew: true
    });

    const socketB = ioClient(`http://localhost:${port}`, {
      auth: { token: userBToken },
      transports: ['websocket'],
      forceNew: true
    });

    let receivedByB = false;

    socketB.on('taskCreated', () => {
      receivedByB = true;
    });

    socketB.on('tasksUpdated', () => {
      receivedByB = true;
    });

    socketA.on('connect', async () => {
      socketB.on('connect', async () => {
        // Create category for User A
        const catRes = await request(app)
          .post('/api/categories')
          .set('Authorization', `Bearer ${userAToken}`)
          .send({ name: 'User A Category', ownerType: 'User', ownerId: userAId });

        // User A creates a task -> triggers event for User A only
        await request(app)
          .post('/api/tasks')
          .set('Authorization', `Bearer ${userAToken}`)
          .send({ title: 'Private Task for A', categoryId: catRes.body._id });

        setTimeout(() => {
          expect(receivedByB).toBe(false); // User B receives 0 events
          socketA.disconnect();
          socketB.disconnect();
          done();
        }, 300);
      });
    });
  });
});
