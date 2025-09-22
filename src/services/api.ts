/**
 * Phase 5 API Service
 * Handles communication with FastAPI backend
 */

import { ActivityPrediction, VideoUploadResponse, WSMessage, UploadProgress } from '../types';

// Configuration - Local backend for development
const API_BASE_URL = 'http://127.0.0.1:8000';
const WS_BASE_URL = 'ws://127.0.0.1:8000';

console.log('🌐 Using Local Backend:', API_BASE_URL);

export class ApiService {
  /**
   * Upload video file for analysis
   */
  static async uploadVideo(
    fileUri: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<VideoUploadResponse> {
    // Local FastAPI expects multipart/form-data with 'file'
    const formData = new FormData();

    const isWeb = typeof document !== 'undefined';
    if (isWeb) {
      const res = await fetch(fileUri);
      const blob = await res.blob();
      const fileName = 'upload.' + (blob.type?.split('/')[1] || 'mp4');
      const file = new File([blob], fileName, { type: blob.type || 'video/mp4' });
      formData.append('file', file);
    } else {
      formData.append('file', {
        uri: fileUri,
        type: 'video/mp4',
        name: 'upload.mp4',
      } as any);
    }

    console.log('[ApiService] Uploading to', `${API_BASE_URL}/predict`);
    const response = await fetch(`${API_BASE_URL}/predict`, {
      method: 'POST',
      body: formData,
      // Let fetch set the multipart boundary automatically
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[ApiService] Upload failed', response.status, text);
      throw new Error(`Upload failed (${response.status}): ${text}`);
    }

    const json = await response.json();
    console.log('[ApiService] Upload success', json);
    return json;
  }

  /**
   * Check API health
   */
  static async healthCheck(): Promise<{ status: string; model_loaded: boolean }> {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
      throw new Error('API health check failed');
    }
    return response.json();
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