import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import UserModel from '../models/User.js';

const SALT_ROUNDS = 10;
const TOKEN_TTL = '7d';

const signToken = (user) =>
  jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/**
 * @desc Register a new account
 * @route POST /api/auth/register
 */
export const register = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || typeof email !== 'string' || !isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await UserModel.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await UserModel.create({ email: normalizedEmail, passwordHash });

    return res.status(201).json({
      token: signToken(user),
      user: { id: user._id, email: user.email }
    });
  } catch (error) {
    console.error('[Register Error]:', error);
    return res.status(500).json({ error: 'Failed to register. Please try again.' });
  }
};

/**
 * @desc Log in to an existing account
 * @route POST /api/auth/login
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await UserModel.findOne({ email: normalizedEmail });

    // Same generic message whether the email doesn't exist or the password is
    // wrong — don't let a caller discover which emails are registered.
    const invalid = () => res.status(401).json({ error: 'Invalid email or password.' });

    if (!user) return invalid();
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) return invalid();

    return res.status(200).json({
      token: signToken(user),
      user: { id: user._id, email: user.email }
    });
  } catch (error) {
    console.error('[Login Error]:', error);
    return res.status(500).json({ error: 'Failed to log in. Please try again.' });
  }
};

/**
 * @desc Return the currently authenticated user (used by the client on load
 *       to check whether a stored token is still valid)
 * @route GET /api/auth/me
 */
export const getMe = async (req, res) => {
  try {
    const user = await UserModel.findById(req.userId).select('email createdAt');
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }
    return res.status(200).json({ user: { id: user._id, email: user.email } });
  } catch (error) {
    console.error('[GetMe Error]:', error);
    return res.status(500).json({ error: 'Failed to fetch account.' });
  }
};
