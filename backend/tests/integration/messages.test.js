const request = require('supertest');
const app = require('../../src/app');

describe('Messages Endpoints', () => {
  let authToken;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@center.com', password: 'admin123' });
    authToken = loginRes.body.token;
  });

  test('GET /api/messages/conversations returns 200, not a SQL error', async () => {
    // Non-régression : la requête référençait l'alias contact_id dans ses
    // sous-requêtes, ce que SQLite refuse (SQLITE_ERROR: no such column).
    const res = await request(app)
      .get('/api/messages/conversations')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/messages sends a message', async () => {
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ receiverId: 2, content: 'Bonjour, test de conversation' });

    expect([200, 201]).toContain(res.statusCode);
  });

  test('conversations include the just-sent message', async () => {
    const content = `Vérification ${Date.now()}`;
    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ receiverId: 3, content });

    const res = await request(app)
      .get('/api/messages/conversations')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    const contact = res.body.find((c) => c.contact_id === 3);
    expect(contact).toBeDefined();
    expect(contact.last_message).toBe(content);
  });
});
