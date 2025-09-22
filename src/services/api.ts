/**
 * Phase 5 API Service
 * Handles communication with FastAPI backend
 */

import { ActivityPrediction, VideoUploadResponse, WSMessage, UploadProgress } from '../types';

// Configuration - Hardcoded Hugging Face Spaces Backend (Gradio API)
const API_BASE_URL = 'https://hanokalure-human-activity-backend.hf.space';
const WS_BASE_URL = 'wss://hanokalure-human-activity-backend.hf.space';

// Gradio API endpoints
const GRADIO_API = {
  PREDICT: `${API_BASE_URL}/api/predict`,
  HEALTH: `${API_BASE_URL}/api/health`
};

console.log('🌐 Using Hugging Face Spaces Backend (Gradio API):', API_BASE_URL);

export class ApiService {
  /**
   * Upload video file for analysis
   */
  static async uploadVideo(
    fileUri: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<VideoUploadResponse> {
    // Convert video file to base64 for Gradio API
    console.log('[ApiService] Preparing video for Gradio API...');
    
    let videoBase64: string;
    const isWeb = typeof document !== 'undefined';

    if (isWeb) {
      // Convert blob URL to base64
      const res = await fetch(fileUri);
      const blob = await res.blob();
      
      // Convert blob to base64
      videoBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          // Remove data:video/mp4;base64, prefix if present
          resolve(base64.split(',')[1] || base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } else {
      // For native, we'd need to handle file reading differently
      // For now, pass the URI as string (Gradio might handle file paths)
      videoBase64 = fileUri;
    }

    // Gradio API expects specific JSON format
    const gradioPayload = {
      data: [videoBase64],
      event_data: null,
      fn_index: 0,
      session_hash: Math.random().toString(36).substring(7)
    };

    console.log('[ApiService] Uploading to Gradio API:', GRADIO_API.PREDICT);
    const response = await fetch(GRADIO_API.PREDICT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(gradioPayload)
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[ApiService] Gradio API upload failed', response.status, text);
      throw new Error(`Upload failed (${response.status}): ${text}`);
    }

    const gradioResponse = await response.json();
    console.log('[ApiService] Gradio API response:', gradioResponse);
    
    // Parse Gradio response format
    if (gradioResponse.data && gradioResponse.data.length > 0) {
      const resultText = gradioResponse.data[0];
      
      // Parse the formatted text response to extract prediction data
      try {
        // Extract activity, confidence, and class_id from the formatted string
        const activityMatch = resultText.match(/\*\*Predicted Activity\*\*: ([^\n]+)/);
        const confidenceMatch = resultText.match(/\*\*Confidence\*\*: ([\d.]+%)/);
        const classIdMatch = resultText.match(/\*\*Class ID\*\*: (\d+)/);
        
        if (activityMatch && confidenceMatch && classIdMatch) {
          return {
            activity: activityMatch[1].trim(),
            confidence: parseFloat(confidenceMatch[1].replace('%', '')) / 100,
            class_id: parseInt(classIdMatch[1])
          };
        }
      } catch (parseError) {
        console.warn('[ApiService] Failed to parse structured data, returning raw response');
      }
      
      // Fallback: return raw response
      return {
        activity: 'Unknown',
        confidence: 0.5,
        class_id: 0,
        raw_response: resultText
      };
    }
    
    throw new Error('Invalid response format from Gradio API');
  }

  /**
   * Check API health
   */
  static async healthCheck(): Promise<{ status: string; model_loaded: boolean }> {
    // Use Gradio health API endpoint
    const gradioPayload = {
      data: [],
      event_data: null,
      fn_index: 1, // Health function index
      session_hash: Math.random().toString(36).substring(7)
    };

    console.log('[ApiService] Checking health via Gradio API:', GRADIO_API.HEALTH);
    const response = await fetch(GRADIO_API.HEALTH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(gradioPayload)
    });
    
    if (!response.ok) {
      throw new Error(`Health check failed (${response.status})`);
    }
    
    const gradioResponse = await response.json();
    console.log('[ApiService] Health check response:', gradioResponse);
    
    // Parse health response
    if (gradioResponse.data && gradioResponse.data.length > 0) {
      const healthText = gradioResponse.data[0];
      
      // Parse "Status: healthy, Model loaded: true" format
      const isHealthy = healthText.includes('healthy');
      const modelLoaded = healthText.includes('Model loaded: true');
      
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        model_loaded: modelLoaded
      };
    }
    
    return {
      status: 'unknown',
      model_loaded: false
    };
  }
}

/**
 * WebSocket client for real-time frame streaming
 */
export class FrameStreamClient {
  private ws: WebSocket | null = null;
  private onPrediction?: (prediction: ActivityPrediction) => void;
  private onError?: (error: string) => void;
  private onConnected?: () => void;
  private onDisconnected?: () => void;

  constructor(callbacks: {
    onPrediction?: (prediction: ActivityPrediction) => void;
    onError?: (error: string) => void;
    onConnected?: () => void;
    onDisconnected?: () => void;
  }) {
    this.onPrediction = callbacks.onPrediction;
    this.onError = callbacks.onError;
    this.onConnected = callbacks.onConnected;
    this.onDisconnected = callbacks.onDisconnected;
  }

  /**
   * Connect to WebSocket endpoint
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(`${WS_BASE_URL}/ws/frames`);
        
        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.onConnected?.();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WSMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
            this.onError?.('Failed to parse server message');
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.onError?.('Connection error');
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.onDisconnected?.();
          this.ws = null;
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Send frame as JPEG bytes
   */
  sendFrame(jpegBytes: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(jpegBytes);
    }
  }

  /**
   * Send control message
   */
  sendControl(type: 'start' | 'end'): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type }));
    }
  }

  /**
   * Close connection
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Get connection status
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private handleMessage(message: WSMessage): void {
    switch (message.type) {
      case 'prediction':
        if (message.data) {
          this.onPrediction?.(message.data);
        }
        break;
      case 'error':
        this.onError?.(message.message || 'Unknown error');
        break;
      case 'final':
        if (message.data) {
          this.onPrediction?.(message.data);
        }
        break;
      case 'ack':
        // Acknowledgment, no action needed
        break;
    }
  }
}