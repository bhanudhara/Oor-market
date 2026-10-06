import jwt from 'jsonwebtoken';

export const jwtSecret = () => process.env.JWT_SECRET || 'local-development-secret-change-before-deploy';

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