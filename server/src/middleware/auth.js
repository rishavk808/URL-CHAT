import jwt from 'jsonwebtoken';

/**
 * Verifies the `Authorization: Bearer <token>` header and attaches the
 * authenticated user's id as req.userId. Applied to every /api route except
 * /api/auth/register and /api/auth/login, which must stay reachable while
 * logged out.
 */
export const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated. Please log in.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Please log in again.' });
  }
};
