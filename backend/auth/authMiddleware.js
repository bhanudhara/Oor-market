import jwt from 'jsonwebtoken';

export function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('Set a private JWT_SECRET of at least 32 characters in .env before starting the API.');
  }
  return secret;
}

export function authenticate(request, response, next) {
  const token = request.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return response.status(401).json({ error: 'Sign in to continue.' });

  try {
    request.user = jwt.verify(token, jwtSecret());
    next();
  } catch {
    response.status(401).json({ error: 'Your session has expired. Sign in again.' });
  }
}

export function authorize(...roles) {
  return (request, response, next) => {
    if (!roles.includes(request.user.role)) {
      return response.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    next();
  };
}