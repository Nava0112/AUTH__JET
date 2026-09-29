const nodeCrypto = require('crypto');
const database = require('../utils/database');
const passwordCrypto = require('../utils/crypto');
const ApplicationKeyService = require('../services/applicationKey.service');
const User = require('../models/User');

const DEFAULT_SCOPES = ['openid', 'profile', 'email'];
const REQUEST_TTL = 10 * 60 * 1000;

function randomToken(bytes = 32) {
  return nodeCrypto.randomBytes(bytes).toString('base64url');
}

function hash(value) {
  return nodeCrypto.createHash('sha256').update(value).digest('hex');
}

function oauthError(res, error, description, status = 400) {
  return res.status(status).json({ error, error_description: description });
}

class OAuthController {
  async loadClient(clientId) {
    const result = await database.query(`
      SELECT id, name, redirect_url, oauth_application_id, oauth_application_secret,
             oauth_allowed_scopes, oauth_jwt_claims
      FROM client_applications
      WHERE oauth_application_id = $1 AND is_active = true
    `, [clientId]);
    return result.rows[0] || null;
  }

  normalizeClient(client) {
    return {
      ...client,
      redirectUris: client.redirect_url ? [client.redirect_url] : [],
      allowedScopes: Array.isArray(client.oauth_allowed_scopes)
        ? client.oauth_allowed_scopes
        : JSON.parse(client.oauth_allowed_scopes || JSON.stringify(DEFAULT_SCOPES))
    };
  }

  validateRequest(query, client) {
    const requestedScopes = (query.scope || '').split(' ').filter(Boolean);
    if (query.response_type !== 'code') return 'Only response_type=code is supported';
    if (!query.redirect_uri || !client.redirectUris.includes(query.redirect_uri)) return 'redirect_uri is not registered';
    if (!requestedScopes.includes('openid')) return 'The openid scope is required';
    if (requestedScopes.some(scope => !client.allowedScopes.includes(scope))) return 'One or more scopes are not allowed';
    if (!query.code_challenge || query.code_challenge_method !== 'S256') return 'S256 PKCE is required';
    return null;
  }

  async authorize(req, res, next) {
    try {
      const { client_id, redirect_uri, response_type, scope, state, nonce, code_challenge, code_challenge_method } = req.query;
      if (!client_id || !redirect_uri || !response_type || !scope || !code_challenge || !code_challenge_method) {
        return oauthError(res, 'invalid_request', 'client_id, redirect_uri, response_type, scope, code_challenge, and code_challenge_method are required');
      }
      const client = await this.loadClient(client_id);
      if (!client) return oauthError(res, 'invalid_client', 'Unknown or inactive client');
      const normalized = this.normalizeClient(client);
      const validationError = this.validateRequest(req.query, normalized);
      if (validationError) return oauthError(res, 'invalid_request', validationError);

      const requestId = randomToken(18);
      req.session.oauthRequest = {
        id: requestId,
        clientId: client_id,
        clientName: client.name,
        clientDbId: client.id,
        redirectUri: redirect_uri,
        scopes: scope.split(' ').filter(Boolean),
        state: state || null,
        nonce: nonce || null,
        codeChallenge: code_challenge,
        expiresAt: Date.now() + REQUEST_TTL
      };
      const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
      const page = req.session.authUserId ? '/oauth/consent' : '/auth/login';
      return res.redirect(`${frontend}${page}?request_id=${encodeURIComponent(requestId)}`);
    } catch (error) {
      return next(error);
    }
  }

  getRequest(req, res) {
    const request = req.session.oauthRequest;
    if (!request || request.id !== req.params.request_id || request.expiresAt < Date.now()) {
      return oauthError(res, 'invalid_request', 'Authorization request is missing or expired');
    }
    return res.json({ client_name: request.clientName, scopes: request.scopes });
  }

  async login(req, res, next) {
    try {
      const { request_id, email, password } = req.body;
      const request = req.session.oauthRequest;
      if (!request || request.id !== request_id || request.expiresAt < Date.now()) {
        return oauthError(res, 'invalid_request', 'Authorization request is missing or expired');
      }
      const result = await database.query(`
        SELECT id, password_hash FROM users
        WHERE lower(email) = lower($1) AND is_active = true
        ORDER BY created_at ASC LIMIT 1
      `, [email]);
      const user = result.rows[0];
      if (!user || !(await passwordCrypto.verifyPassword(password, user.password_hash))) {
        return oauthError(res, 'access_denied', 'Invalid email or password', 401);
      }
      req.session.authUserId = user.id;
      return res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  }

  async signup(req, res, next) {
    try {
      const { request_id, email, password, name } = req.body;
      const request = req.session.oauthRequest;
      if (!request || request.id !== request_id || request.expiresAt < Date.now()) {
        return oauthError(res, 'invalid_request', 'Authorization request is missing or expired');
      }
      if (!email || !password) {
        return oauthError(res, 'invalid_request', 'Email and password are required');
      }
      if (password.length < 8) {
        return oauthError(res, 'invalid_request', 'Password must be at least 8 characters long');
      }

      const applicationResult = await database.query(`
        SELECT client_id FROM client_applications
        WHERE id = $1 AND is_active = true
      `, [request.clientDbId]);
      const application = applicationResult.rows[0];
      if (!application) return oauthError(res, 'invalid_request', 'Application is inactive or unavailable');

      const existingUser = await User.findByEmail(email, request.clientDbId);
      if (existingUser) return oauthError(res, 'account_exists', 'An account with this email already exists', 409);

      const user = await User.create({
        email,
        password,
        name: name || email.split('@')[0],
        client_id: application.client_id,
        application_id: request.clientDbId,
        email_verified: false
      });

      req.session.authUserId = user.id;
      return res.status(201).json({ success: true });
    } catch (error) {
      return next(error);
    }
  }

  async consent(req, res) {
    return this.getRequest(req, res);
  }

  async decideConsent(req, res, next) {
    try {
      const request = req.session.oauthRequest;
      if (!request || request.id !== req.body.request_id || request.expiresAt < Date.now() || !req.session.authUserId) {
        return oauthError(res, 'invalid_request', 'Authorization request is missing, expired, or unauthenticated');
      }
      const callback = new URL(request.redirectUri);
      if (req.body.decision !== 'allow') {
        callback.searchParams.set('error', 'access_denied');
        callback.searchParams.set('error_description', 'The user denied access');
      } else {
        const rawCode = randomToken(32);
        await database.query(`
          INSERT INTO oauth_authorization_codes
            (code_hash, user_id, application_id, redirect_uri, scopes, nonce, code_challenge, expires_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + interval '60 seconds')
        `, [hash(rawCode), req.session.authUserId, request.clientDbId, request.redirectUri,
          JSON.stringify(request.scopes), request.nonce, request.codeChallenge]);
        callback.searchParams.set('code', rawCode);
      }
      if (request.state) callback.searchParams.set('state', request.state);
      delete req.session.oauthRequest;
      return res.json({ redirect_uri: callback.toString() });
    } catch (error) {
      return next(error);
    }
  }

  async token(req, res, next) {
    try {
      const { grant_type, code, redirect_uri, client_id, client_secret, code_verifier, refresh_token } = req.body;
      const client = await this.loadClient(client_id);
      if (!client) return oauthError(res, 'invalid_client', 'Unknown or inactive client', 401);
      const normalized = this.normalizeClient(client);
      if (client_secret !== client.oauth_application_secret) {
        return oauthError(res, 'invalid_client', 'Client authentication failed', 401);
      }
      if (grant_type === 'refresh_token') return this.refresh(res, client, refresh_token);
      if (grant_type !== 'authorization_code' || !code || !redirect_uri || !code_verifier) {
        return oauthError(res, 'invalid_request', 'authorization_code requires code, redirect_uri, and code_verifier');
      }

      const result = await database.query(`
        UPDATE oauth_authorization_codes SET used_at = NOW()
        WHERE code_hash = $1 AND application_id = $2 AND redirect_uri = $3
          AND used_at IS NULL AND expires_at > NOW()
        RETURNING user_id, scopes, nonce, code_challenge
      `, [hash(code), client.id, redirect_uri]);
      const authorizationCode = result.rows[0];
      if (!authorizationCode) return oauthError(res, 'invalid_grant', 'Authorization code is invalid, expired, or already used');
      const expectedChallenge = nodeCrypto.createHash('sha256').update(code_verifier).digest('base64url');
      if (expectedChallenge !== authorizationCode.code_challenge) return oauthError(res, 'invalid_grant', 'PKCE verification failed');
      return this.issueTokens(res, client, authorizationCode.user_id, authorizationCode.scopes, authorizationCode.nonce);
    } catch (error) {
      return next(error);
    }
  }

  async issueTokens(res, client, userId, scopesValue, nonce) {
    const scopes = Array.isArray(scopesValue) ? scopesValue : JSON.parse(scopesValue);
    const userResult = await database.query('SELECT id, email, name, email_verified FROM users WHERE id = $1 AND is_active = true', [userId]);
    const user = userResult.rows[0];
    if (!user) return oauthError(res, 'invalid_grant', 'User is no longer active');
    const audience = client.oauth_application_id;
    const jwtClaims = client.oauth_jwt_claims && typeof client.oauth_jwt_claims === 'object'
      ? client.oauth_jwt_claims
      : JSON.parse(client.oauth_jwt_claims || '{}');
    const accessToken = await ApplicationKeyService.signJwt(client.id, { sub: String(user.id), aud: audience, scope: scopes.join(' '), token_use: 'access' });
    const idToken = await ApplicationKeyService.signJwt(client.id, {
      sub: String(user.id), aud: audience,
      ...jwtClaims,
      nonce, token_use: 'id'
    });
    const rawRefresh = randomToken(40);
    await database.query(`
      INSERT INTO oauth_refresh_tokens (token_hash, user_id, application_id, scopes, expires_at)
      VALUES ($1, $2, $3, $4, NOW() + interval '30 days')
    `, [hash(rawRefresh), user.id, client.id, JSON.stringify(scopes)]);
    return res.json({ access_token: accessToken, id_token: idToken, refresh_token: rawRefresh, token_type: 'Bearer', expires_in: 900, scope: scopes.join(' ') });
  }

  async refresh(res, client, rawRefresh) {
    if (!rawRefresh) return oauthError(res, 'invalid_request', 'refresh_token is required');
    const result = await database.query(`
      UPDATE oauth_refresh_tokens SET revoked_at = NOW()
      WHERE token_hash = $1 AND application_id = $2 AND revoked_at IS NULL AND expires_at > NOW()
      RETURNING user_id, scopes
    `, [hash(rawRefresh), client.id]);
    if (!result.rows[0]) return oauthError(res, 'invalid_grant', 'Refresh token is invalid or expired');
    return this.issueTokens(res, client, result.rows[0].user_id, result.rows[0].scopes, null);
  }
}

module.exports = new OAuthController();
