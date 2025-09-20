/**
 * API Configuration for Human Activity Recognition Frontend
 * ========================================================
 * 
 * Handles connection to the backend API with environment-based URLs.
 * Supports both development (localhost) and production (Render) deployments.
 */

// Backend API URL configuration
const getApiUrl = (): string => {
  // Check for environment variable first (set by Vercel)
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // For Expo web builds, check for NODE_ENV
  if (process.env.NODE_ENV === 'production') {
    // Replace with your actual Render backend URL once deployed
    return 'https://human-activity-api.onrender.com';
  }
  
  // Development fallback
  return 'http://localhost:8000';
};

export const API_CONFIG = {
  BASE_URL: getApiUrl(),
  ENDPOINTS: {
    HEALTH: '/health',
    PREDICT_VIDEO: '/predict/video',
    WEBSOCKET: '/ws/frames',
  },
  TIMEOUT: 30000, // 30 seconds
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
} as const;

// WebSocket URL (convert http/https to ws/wss)
export const getWebSocketUrl = (): string => {
  const baseUrl = API_CONFIG.BASE_URL;
  const wsUrl = baseUrl.replace('http://', 'ws://').replace('https://', 'wss://');
  return `${wsUrl}${API_CONFIG.ENDPOINTS.WEBSOCKET}`;
};

// API Client class for making requests
export class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL;
  }

  async checkHealth(): Promise<{ status: string; model_loaded: boolean }> {
    const response = await fetch(`${this.baseUrl}${API_CONFIG.ENDPOINTS.HEALTH}`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    return response.json();
  }

  async predictVideo(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseUrl}${API_CONFIG.ENDPOINTS.PREDICT_VIDEO}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Prediction failed: ${response.status}`);
    }

    return response.json();
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Log configuration in development
if (process.env.NODE_ENV === 'development') {
  console.log('🔧 API Configuration:', {
    baseUrl: API_CONFIG.BASE_URL,
    environment: process.env.NODE_ENV,
    reactAppApiUrl: process.env.REACT_APP_API_URL,
  });
}