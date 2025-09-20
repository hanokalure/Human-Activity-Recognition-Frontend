/**
 * Phase 5 Activity Recognition - Type Definitions
 */

export interface ActivityPrediction {
  predicted_class: string;
  confidence: number;
  all_probabilities?: Record<string, number>;
}

export interface VideoUploadResponse extends ActivityPrediction {
  video_path: string;
}

export interface WSMessage {
  type: 'prediction' | 'error' | 'ack' | 'final';
  message?: string;
  data?: ActivityPrediction;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface CameraStreamState {
  isRecording: boolean;
  isConnected: boolean;
  frameCount: number;
  lastPrediction?: ActivityPrediction;
}

// Activity categories for better UX
export const ACTIVITY_CATEGORIES = {
  'Movement': ['walking', 'running', 'climbing_stairs', 'biking_ucf'],
  'Exercise': ['pullups_ucf', 'pushups_ucf', 'yoga', 'weight_lifting'],
  'Daily Care': ['brushing_teeth', 'brushing_hair', 'eating', 'drinking'],
  'Work': ['typing', 'writing', 'talking'],
  'Home': ['cooking_ucf', 'cleaning', 'pouring'],
  'Social': ['hugging', 'waving', 'laughing'],
  'Recreation': ['walking_dog', 'breast_stroke', 'front_crawl'],
  'Rest': ['sitting']
} as const;

export type ActivityCategory = keyof typeof ACTIVITY_CATEGORIES;
export type ActivityName = typeof ACTIVITY_CATEGORIES[ActivityCategory][number];