import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Animated, Easing, Platform, Dimensions, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import { ApiService } from '../services/api';
import { VideoUploadResponse } from '../types';
import ResultsDisplay from './ResultsDisplay';

const { width, height } = Dimensions.get('window');
const isMobileSmall = width < 400 && Platform.OS !== 'web';
const panelHeight = Platform.OS === 'web' ? 315 : (isMobileSmall ? 200 : 240);

export default function VideoUpload() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<VideoUploadResponse | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Responsive width tracking for mobile vs web layout
  const [screenWidth, setScreenWidth] = useState(width);
  useEffect(() => {
    const sub: any = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => {
      if (sub && typeof sub.remove === 'function') sub.remove();
    };
  }, []);
  const isSmallScreen = screenWidth < 768;
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in animation on mount
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false,
    }).start();

    // Rotating square animation for loading
    if (uploading) {
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: false,
        })
      ).start();
    } else {
      rotateAnim.stopAnimation();
      rotateAnim.setValue(0);
    }
  }, [uploading]);

  const selectVideo = async () => {
    try {
      if (Platform.OS === 'web') {
        // Create a hidden file input for web
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/*';
        input.onchange = async () => {
          const file = input.files && input.files[0];
          if (file) {
            setSelectedFile(file.name);
            setResult(null);
            setError(null);
            // Create object URL for ApiService to fetch and convert to blob
            const url = URL.createObjectURL(file);
            setVideoUri(url); // Store for video preview
            await uploadVideo(url);
            // Don't revoke URL yet - we need it for video preview
          }
        };
        input.click();
        return;
      }

      const res = await DocumentPicker.getDocumentAsync({
        type: 'video/*',
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets[0]) {
        setSelectedFile(res.assets[0].name);
        setResult(null);
        setError(null);
        setVideoUri(res.assets[0].uri); // Store for video preview
        await uploadVideo(res.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select video file');
      console.error('Video selection error:', error);
    }
  };

  const uploadVideo = async (fileUri: string) => {
    setUploading(true);
    try {
      const response = await ApiService.uploadVideo(fileUri);
      setResult(response);
      setError(null);
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : 'Failed to analyze video. Please check your connection and try again.';
      setError(msg);
      console.error('Upload error:', e);
      // On web, Alert.alert renders a browser alert. Keep it minimal.
      if (typeof window !== 'undefined') {
        window.alert('Upload Error: ' + msg);
      }
    } finally {
      setUploading(false);
    }
  };

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.maxWidthContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>
            Human Activity Recognition
          </Text>
          <Text style={styles.subtitle}>
            Upload video to detect human activities
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, uploading && styles.buttonDisabled]}
              onPress={selectVideo}
              disabled={uploading}
            >
              {uploading && (
                <Animated.View style={[styles.loadingSquare, { transform: [{ rotate: rotateInterpolate }] }]} />
              )}
              <Text style={[styles.buttonText, uploading && styles.buttonTextDisabled]}>
                {uploading ? 'Analyzing...' : 'Select Video'}
              </Text>
            </TouchableOpacity>

            {selectedFile && !uploading && (
              <Text style={styles.fileSelected}>
                File selected
              </Text>
            )}
          </View>
        </View>

        {/* Error */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Video Preview & Results */}
        {videoUri && (
          isSmallScreen ? (
            <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
              {/* Video Preview */}
              <View style={[styles.panelBox, styles.panelSpacing]}>
                {Platform.OS === 'web' ? (
                  <video
                    src={videoUri}
                    controls
                    autoPlay
                    loop
                    muted
                    playsInline
                    style={styles.videoPlayer}
                    poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23f3f4f6'/%3E%3Ctext x='50' y='50' font-family='system-ui' font-size='14' fill='%23666' text-anchor='middle' dominant-baseline='middle'%3E▶️%3C/text%3E%3C/svg%3E"
                  />
                ) : (
                  <View style={styles.videoPlayerPlaceholder}>
                    <Text style={styles.videoPlayerText}>Video Preview</Text>
                    <Text style={styles.videoPlayerSubtext}>▶️ {selectedFile}</Text>
                  </View>
                )}
              </View>
              
              {/* Results */}
              <View style={styles.panelBox}>
                <ResultsDisplay 
                  prediction={result} 
                  loading={uploading}
                />
              </View>
            </ScrollView>
          ) : (
            <View style={styles.contentContainerWeb}>
              {/* Video Preview */}
              <View style={styles.panelBoxWeb}>
                {Platform.OS === 'web' ? (
                  <video
                    src={videoUri}
                    controls
                    autoPlay
                    loop
                    muted
                    playsInline
                    style={styles.videoPlayer}
                    poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23f3f4f6'/%3E%3Ctext x='50' y='50' font-family='system-ui' font-size='14' fill='%23666' text-anchor='middle' dominant-baseline='middle'%3E▶️%3C/text%3E%3C/svg%3E"
                  />
                ) : (
                  <View style={styles.videoPlayerPlaceholder}>
                    <Text style={styles.videoPlayerText}>Video Preview</Text>
                    <Text style={styles.videoPlayerSubtext}>▶️ {selectedFile}</Text>
                  </View>
                )}
              </View>
              
              {/* Results */}
              <View style={styles.panelBoxWeb}>
                <ResultsDisplay 
                  prediction={result} 
                  loading={uploading}
                />
              </View>
            </View>
          )
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  maxWidthContainer: {
    flex: 1,
    maxWidth: Platform.OS === 'web' ? 1200 : '100%',
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: Platform.OS === 'web' ? 40 : 20,
    paddingBottom: Platform.OS === 'web' ? 60 : 40,
  },
  header: {
    paddingTop: Platform.OS === 'web' ? 80 : 60,
    paddingBottom: 40,
  },
  title: {
    fontSize: Platform.OS === 'web' ? 32 : 28,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : 'System',
  },
  subtitle: {
    fontSize: Platform.OS === 'web' ? 18 : 16,
    fontWeight: '400',
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : 'System',
  },
  buttonContainer: {
    marginTop: 40,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonDisabled: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : 'System',
  },
  buttonTextDisabled: {
    color: '#ffffff',
  },
  loadingSquare: {
    width: 16,
    height: 16,
    backgroundColor: '#ffffff',
    marginRight: 12,
    borderRadius: 2,
  },
  fileSelected: {
    marginTop: 16,
    fontSize: 14,
    color: '#16a34a',
    fontWeight: '500',
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : 'System',
  },
  errorContainer: {
    marginTop: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : 'System',
  },
  contentContainer: {
    flexDirection: 'column',
    gap: 16,
    marginTop: 20,
    alignItems: 'stretch',
    width: '100%',
  },
  contentContainerWeb: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 20,
    alignItems: 'stretch',
    width: '100%',
  },
  scrollContainer: {
    flex: 1,
    marginTop: 20,
  },
  scrollContent: {
    width: '100%',
    alignItems: 'stretch',
    paddingBottom: 32,
  },
  panelSpacing: {
    marginBottom: 16,
  },
  panelBox: {
    width: '100%',
    height: panelHeight,
    minHeight: panelHeight,
    maxHeight: panelHeight,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: Platform.OS === 'web' ? 2 : 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    position: 'relative',
  },
  panelBoxWeb: {
    flex: 1,
    maxWidth: 560,
    width: '100%',
    height: panelHeight,
    minHeight: panelHeight,
    maxHeight: panelHeight,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    position: 'relative',
  },
  videoPlayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    objectFit: 'cover',
  },
  videoPlayerPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayerText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 4,
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : 'System',
  },
  videoPlayerSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : 'System',
  },
});
