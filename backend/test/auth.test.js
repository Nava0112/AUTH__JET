const request = require('supertest');
const AuthJetApp = require('../src/app');
const database = require('../src/utils/database');
const bcrypt = require('bcryptjs');

// We'll assume we have a way to create a client and user for testing
// For simplicity, we'll use direct database queries to set up the test data

describe('User Authorization via Client Application', () => {
  let server;
  let testClient;
  let testUser;
  let testApplication;
  let accessToken;
  let refreshToken;
  const SALT_ROUNDS = 10;

  beforeAll(async () => {
    // Create an instance of the app
    const authJetApp = new AuthJetApp();
    // Start the server
    server = await authJetApp.start();
    
    // Connect to the test database (ensure .env.test is set)
    await database.connect();

    // Create a test client
    const clientRes = await database.query(
      `INSERT INTO clients (name, domain, is_active) 
       VALUES ($1, $2, $3) 
       RETURNING id, name, domain, is_active`,
      ['Test Client', 'testclient.example.com', true]
    );
    testClient = clientRes.rows[0];

    // Create a test application for the client
    const appRes = await database.query(
      `INSERT INTO applications (client_id, name, allowed_redirect_uris) 
       VALUES ($1, $2, $3) 
       RETURNING id, client_id, name, allowed_redirect_uris`,
      [testClient.id, 'Test Application', '{http://localhost:3000/callback}']
    );
    testApplication = appRes.rows[0];

    // Hash the password
    const password = 'password';
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create a test user
    const userRes = await database.query(
      `INSERT INTO users (client_id, application_id, email, password_hash, name, is_active) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, email, name, is_active`,
      [testClient.id, testApplication.id, 'testuser@example.com', passwordHash, 'Test User', true]
    );
    testUser = userRes.rows[0];
  });

  afterAll(async () => {
    try {
      // Clean up test data
      await database.query('DELETE FROM user_sessions WHERE user_id = $1', [testUser.id]);
      await database.query('DELETE FROM applications WHERE client_id = $1', [testClient.id]);
      await database.query('DELETE FROM clients WHERE id = $1', [testClient.id]);
      await database.query('DELETE FROM users WHERE id = $1', [testUser.id]);
    } finally {
      // Stop the server and disconnect
      await authJetApp.stop();
      await database.disconnect();
    }
  });

  test('User login and token generation', async () => {
    const response = await request(server)
      .post('/api/client/login')
      .send({
        email: testUser.email,
        password: 'password',
        client_id: testClient.id,
        application_id: testApplication.id,
      })
      .expect(200);

    // Validate token structure
    expect(response.body).toHaveProperty('access_token');
    expect(response.body).toHaveProperty('refresh_token');
    expect(response.body).toHaveProperty('token_type', 'Bearer');

    // Save tokens for subsequent tests
    accessToken = response.body.access_token;
    refreshToken = response.body.refresh_token;
  });

  test('Access protected route with valid token', async () => {
    const response = await request(server)
      .get('/api/client/protected-route')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    // Validate session creation in database
    const sessionRes = await database.query(
      'SELECT * FROM user_sessions WHERE user_id = $1',
      [testUser.id]
    );
    expect(sessionRes.rows.length).toBe(1);
    expect(sessionRes.rows[0].refresh_token).toBe(refreshToken);
  });

  test('Refresh tokens', async () => {
    const response = await request(server)
      .post('/api/client/refresh')
      .send({
        refresh_token: refreshToken,
      })
      .expect(200);

    expect(response.body).toHaveProperty('access_token');
    expect(response.body).toHaveProperty('refresh_token');
    expect(response.body).toHaveProperty('token_type', 'Bearer');

    // Update tokens for revocation test
    accessToken = response.body.access_token;
    refreshToken = response.body.refresh_token;
  });

  test('Revoke refresh token', async () => {
    await request(server)
      .post('/api/client/revoke')
      .send({
        refresh_token: refreshToken,
      })
      .expect(200);

    // Attempt to use the revoked token should fail
    const response = await request(server)
      .post('/api/client/refresh')
      .send({
        refresh_token: refreshToken,
      })
      .expect(401);

    expect(response.body).toHaveProperty('error', 'Invalid or expired refresh token');
  });
});