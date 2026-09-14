import crypto from 'crypto';

// Lightweight signed bearer token (HMAC-SHA256), so we don't need an extra
// JWT dependency. The secret lives only in the server's environment
// (AUTH_TOKEN_SECRET), never in the repo or in client code.
function getSecret() {
  const secret = process.env.AUTH_TOKEN_SECRET;
  if (!secret) {
    throw new Error('AUTH_TOKEN_SECRET no está configurado en el entorno del servidor');
  }
  return secret;
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

export function signToken(payload, ttlSeconds = 60 * 60 * 24 * 30) {
  const body = { ...payload, exp: Date.now() + ttlSeconds * 1000 };
  const encodedBody = base64url(JSON.stringify(body));
  const signature = crypto.createHmac('sha256', getSecret()).update(encodedBody).digest('base64url');
  return `${encodedBody}.${signature}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;

  const [encodedBody, signature] = token.split('.');
  const expectedSignature = crypto.createHmac('sha256', getSecret()).update(encodedBody).digest('base64url');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const body = JSON.parse(Buffer.from(encodedBody, 'base64url').toString('utf8'));
    if (!body.exp || Date.now() > body.exp) return null;
    return body;
  } catch {
    return null;
  }
}

export function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
