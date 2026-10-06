import axios from 'axios';

// In development this stays '/api' and Vite's proxy forwards it to the local server.
// In production (frontend on Vercel, backend on Render) set VITE_API_URL to the
// backend's URL, e.g. https://url-chat-api.onrender.com/api
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const TOKEN_KEY = 'urlchat:token';

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // localStorage unavailable (e.g. private browsing) — the user will just
    // need to log in again on next load
  }
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Attach the logged-in user's token to every request that has one.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If the token is rejected (expired or invalid), clear it so the app falls
// back to the login screen instead of silently failing every request.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      setToken(null);
    }
    return Promise.reject(error);
  }
);

/**
 * Create a new account
 */
export const registerUser = async (email, password) => {
  const response = await api.post('/auth/register', { email, password });
  return response.data;
};

/**
 * Log in to an existing account
 */
export const loginUser = async (email, password) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
};

/**
 * Validate the stored token and fetch the current user
 */
export const getCurrentUser = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

/**
 * Ingest and index a webpage URL
 */
export const ingestUrl = async (url) => {
  const response = await api.post('/ingest', { url });
  return response.data;
};

/**
 * Send a chat question about an indexed URL
 */
export const sendChatMessage = async (url, question) => {
  const response = await api.post('/chat', { url, question });
  return response.data;
};

/**
 * Retrieve list of all indexed document records
 */
export const getDocuments = async () => {
  const response = await api.get('/documents');
  return response.data;
};

/**
 * Delete indexed document record by ID
 */
export const deleteDocument = async (id) => {
  const response = await api.delete(`/documents/${id}`);
  return response.data;
};

/**
 * Fetch chat message history for a specific URL
 */
export const getChatHistory = async (url) => {
  const response = await api.get('/chat/history', {
    params: { url }
  });
  return response.data;
};

export default api;
