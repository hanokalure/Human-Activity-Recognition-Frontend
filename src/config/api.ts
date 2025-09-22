/**
 * API Configuration
 * 
 * Configured to use local backend on localhost:8000
 */

export const API_CONFIG = {
  BASE_URL: "http://127.0.0.1:8000",
  ENDPOINTS: {
    HEALTH: "/health",
    PREDICT: "/predict/video",
    UPLOAD: "/upload"
  },
  TIMEOUT: 30000, // 30 seconds for video processing
};

/**
 * Simple API client with error handling
 */
export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_CONFIG.BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async post(endpoint: string, formData: FormData): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        body: formData,
        headers: {
          // Don't set Content-Type for FormData - browser sets it with boundary
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async get(endpoint: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }
}

// Default API client instance
export const apiClient = new ApiClient();