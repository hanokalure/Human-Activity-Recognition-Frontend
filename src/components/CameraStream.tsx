import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { FrameStreamClient } from '../services/api';
import { ActivityPrediction, CameraStreamState } from '../types';
import ResultsDisplay from './ResultsDisplay';

export default function CameraStream() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [streamState, setStreamState] = useState<CameraStreamState>({
    isRecording: false,
    isConnected: false,
    frameCount: 0,
    lastPrediction: undefined,
  });
  
  const streamClient = useRef<FrameStreamClient | null>(null);
  const frameInterval = useRef<NodeJS.Timeout | null>(null);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      stopStreaming();
    };
  }, []);

  const initializeStream = async () => {
    try {
      streamClient.current = new FrameStreamClient({
        onPrediction: (prediction: ActivityPrediction) => {
          setStreamState(prev => ({ 
            ...prev, 
            lastPrediction: prediction 
          }));
        },
        onError: (error: string) => {
          Alert.alert('Stream Error', error);
          stopStreaming();
        },
        onConnected: () => {
          setStreamState(prev => ({ ...prev, isConnected: true }));
        },
        onDisconnected: () => {
          setStreamState(prev => ({ 
            ...prev, 
            isConnected: false, 
            isRecording: false 
          }));
        },
      });

      await streamClient.current.connect();
      return true;
    } catch (error) {
      Alert.alert('Connection Error', 'Failed to connect to server');
      return false;
    }
  };

  const startStreaming = async () => {
    if (!permission?.granted) {
      Alert.alert('Camera Permission', 'Camera access is required for live streaming');
      return;
    }

    const connected = await initializeStream();
    if (!connected) return;

    streamClient.current?.sendControl('start');
    setStreamState(prev => ({ 
      ...prev, 
      isRecording: true, 
      frameCount: 0,
      lastPrediction: undefined 
    }));

    // Start capturing frames every 500ms (2 fps to match model's 16-frame requirement)
    frameInterval.current = setInterval(captureFrame, 500);
  };

  const stopStreaming = () => {
    if (frameInterval.current) {
      clearInterval(frameInterval.current);
      frameInterval.current = null;
    }

    streamClient.current?.sendControl('end');
    streamClient.current?.disconnect();
    streamClient.current = null;

    setStreamState({
      isRecording: false,
      isConnected: false,
      frameCount: 0,
      lastPrediction: streamState.lastPrediction, // Keep last prediction
    });
  };

  const captureFrame = async () => {
    if (!cameraRef.current || !streamClient.current?.isConnected) {
      return;
    }

    try {
      // Take a picture and convert to JPEG bytes
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.3, // Lower quality for faster processing
        base64: false,
        skipProcessing: true,
      });

      // Convert URI to blob and then to ArrayBuffer
      const response = await fetch(photo.uri);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      streamClient.current.sendFrame(arrayBuffer);
      
      setStreamState(prev => ({ 
        ...prev, 
        frameCount: prev.frameCount + 1 
      }));

    } catch (error) {
      console.error('Frame capture error:', error);
    }
  };

  const toggleCamera = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  if (!permission) {
    return <View style={styles.container}><Text>Loading camera...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>📷</Text>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionMessage}>
            To use live activity recognition, please grant camera permission.
          </Text>
          <TouchableOpacity 
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📷 Live Camera</Text>
        <Text style={styles.subtitle}>Real-time activity recognition</Text>
      </View>

      <View style={styles.cameraContainer}>
        <CameraView 
          ref={cameraRef}
          style={styles.camera} 
          facing={facing}
        >
          <View style={styles.cameraOverlay}>
            {/* Connection Status */}
            <View style={styles.statusContainer}>
              <View style={[
                styles.statusDot, 
                { backgroundColor: streamState.isConnected ? '#4CAF50' : '#F44336' }
              ]} />
              <Text style={styles.statusText}>
                {streamState.isConnected ? 'Connected' : 'Disconnected'}
              </Text>
            </View>

            {/* Frame Counter */}
            {streamState.isRecording && (
              <View style={styles.frameCounter}>
                <Text style={styles.frameCountText}>
                  Frames: {streamState.frameCount}
                </Text>
              </View>
            )}

            {/* Camera Controls */}
            <View style={styles.controlsContainer}>
              <TouchableOpacity 
                style={styles.controlButton}
                onPress={toggleCamera}
              >
                <Text style={styles.controlButtonText}>🔄</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.recordButton, 
                  streamState.isRecording && styles.recordButtonActive
                ]}
                onPress={streamState.isRecording ? stopStreaming : startStreaming}
              >
                <Text style={styles.recordButtonText}>
                  {streamState.isRecording ? '⏹️' : '▶️'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </CameraView>
      </View>

      {/* Live Results */}
      <View style={styles.resultsContainer}>
        <ResultsDisplay 
          prediction={streamState.lastPrediction}
          loading={streamState.isRecording && streamState.frameCount < 16}
          compact={true}
        />
        
        {streamState.isRecording && streamState.frameCount < 16 && (
          <View style={styles.warmupContainer}>
            <Text style={styles.warmupText}>
              Collecting frames... {streamState.frameCount}/16
            </Text>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { width: `${(streamState.frameCount / 16) * 100}%` }
                ]} 
              />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 40,
  },
  permissionText: {
    fontSize: 64,
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    margin: 16,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  frameCounter: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  frameCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  controlButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonText: {
    fontSize: 24,
  },
  recordButton: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 40,
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  recordButtonActive: {
    backgroundColor: 'rgba(244,67,54,0.8)',
  },
  recordButtonText: {
    fontSize: 32,
  },
  resultsContainer: {
    backgroundColor: '#f5f5f5',
    minHeight: 120,
  },
  warmupContainer: {
    padding: 16,
    alignItems: 'center',
  },
  warmupText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  progressBar: {
    width: '80%',
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 2,
  },
});