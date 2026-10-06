import express from 'express';
import { register, login, getMe } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Public — no token required yet
router.post('/register', register);
router.post('/login', login);

// Requires a valid token — lets the client verify a stored token on load
router.get('/me', requireAuth, getMe);

export default router;
