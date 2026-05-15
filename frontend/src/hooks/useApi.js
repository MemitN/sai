import axios from 'axios';

// Dynamically get API URL based on current hostname for network access
const getApiBaseUrl = () => {
  // Check if we have a saved custom API URL (for manual override)
  const customApiUrl = localStorage.getItem('pos_api_url');
  if (customApiUrl) {
    return `${customApiUrl}/api`;
  }
  
  // In development mode (npm start), use localhost
  if (process.env.NODE_ENV === 'development') {
    return process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
  }
  
  // In production, use the same hostname that loaded the page, but port 3001
  // This allows access from any device on the network
  const hostname = window.location.hostname;
  
  // If we're on localhost or 127.0.0.1, keep using localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3001/api';
  }
  
  // Otherwise, use the network IP address that loaded the page
  return `http://${hostname}:3001/api`;
};

// Helper to get the base URL without /api for image serving
export const getBaseUrl = () => {
  const customApiUrl = localStorage.getItem('pos_api_url');
  if (customApiUrl) {
    return customApiUrl;
  }
  
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3001';
  }
  
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3001';
  }
  
  return `http://${hostname}:3001`;
};

// Helper to get full image URL (works from any device on the network)
export const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  
  // If it's already a full URL (http:// or https://)
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // If it's a data URL (base64 embedded image)
  if (imagePath.startsWith('data:')) {
    return imagePath;
  }
  
  // Ensure the path starts with /
  const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  
  // Use the base URL to construct the full image URL
  return `${getBaseUrl()}${cleanPath}`;
};

// Create axios instance
const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 30000, // 30 second timeout for network requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pos_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Add timestamp to prevent caching issues on network
  if (config.method === 'get') {
    config.params = {
      ...config.params,
      _t: Date.now()
    };
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Handle 401 — log out user
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('pos_token');
      localStorage.removeItem('pos_user');
      localStorage.removeItem('pos_api_url');
      window.location.href = '/login';
    }
    
    // Handle network errors (device might be offline)
    if (error.code === 'ECONNABORTED' || error.message === 'Network Error') {
      console.error('Network error - cannot reach server');
      // You could show a toast notification here
    }
    
    return Promise.reject(error);
  }
);

// Helper function to test network connection to server
export const testNetworkConnection = async () => {
  try {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/tables`, {
      method: 'HEAD',
      mode: 'no-cors'
    });
    return { success: true, url: baseUrl };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Helper function to manually set API URL (for advanced network config)
export const setApiUrl = (url) => {
  // Remove trailing slash and /api if present
  let cleanUrl = url.replace(/\/$/, '').replace(/\/api$/, '');
  localStorage.setItem('pos_api_url', cleanUrl);
  // Update the axios instance
  api.defaults.baseURL = `${cleanUrl}/api`;
  return api.defaults.baseURL;
};

// Helper to get current network info (for debugging)
export const getNetworkInfo = () => {
  return {
    apiUrl: api.defaults.baseURL,
    baseUrl: getBaseUrl(),
    hostname: window.location.hostname,
    port: window.location.port || '80',
    protocol: window.location.protocol,
    isLocalNetwork: !['localhost', '127.0.0.1'].includes(window.location.hostname),
  };
};

export default api;