import axios from 'axios';

// In development this stays '/api' and Vite's proxy forwards it to the local server.
// In production (frontend on Vercel, backend on Render) set VITE_API_URL to the
// backend's URL, e.g. https://url-chat-api.onrender.com/api
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

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
