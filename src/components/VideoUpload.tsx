import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Animated, Easing, Platform, Dimensions, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { ApiService } from '../services/api';
import { VideoUploadResponse } from '../types';
import ResultsDisplay from './ResultsDisplay';
import QuickStartLottie from './QuickStartLottie';
import { Audio, Video } from 'expo-av';

const { width, height } = Dimensions.get('window');
const isMobileSmall = width < 400 && Platform.OS !== 'web';
const panelHeight = Platform.OS === 'web' ? 315 : (isMobileSmall ? 200 : 240);

export default function VideoUpload() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<VideoUploadResponse | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [showPlayButton, setShowPlayButton] = useState(false);
  const [muted, setMuted] = useState(Platform.OS !== 'web');
  const videoRef = useRef<Video | null>(null);
  const [videoStatus, setVideoStatus] = useState<string>('loading');
  const [debugInfo, setDebugInfo] = useState<string>('');

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
    // Auto-play attempt when video URI changes
    if (videoUri && videoRef.current) {
      const attemptAutoPlay = async () => {
        try {
          console.log('🎬 useEffect: Attempting immediate play...');
          await videoRef.current?.playAsync();
          console.log('🎬 useEffect: Immediate play SUCCESS');
          setVideoPlaying(true);
          setVideoStatus('playing-muted');
          setShowPlayButton(Platform.OS !== 'web');
        } catch (error) {
          console.log('🎬 useEffect: Immediate play FAILED:', error);
          setVideoStatus('loaded-paused');
          setShowPlayButton(true);
        }
      };
      
      // Small delay to ensure video is ready
      setTimeout(attemptAutoPlay, 100);
    }
    
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
  }, [uploading, videoUri]);

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
            setVideoPlaying(false);
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
        
        // Normalize file URI for mobile video preview
        let normalizedUri = res.assets[0].uri;
        if (Platform.OS !== 'web') {
          try {
            // Ensure proper file:// protocol for mobile
            if (!normalizedUri.startsWith('file://') && !normalizedUri.startsWith('content://')) {
              normalizedUri = `file://${normalizedUri}`;
            }
            console.log('Original URI:', res.assets[0].uri);
            console.log('Normalized URI:', normalizedUri);
          } catch (error) {
            console.log('URI normalization error:', error);
          }
        }
        
        setVideoUri(normalizedUri); // Store for video preview
        setVideoPlaying(false);
        await uploadVideo(res.assets[0].uri); // Use original URI for upload
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select video file');
      console.error('Video selection error:', error);
    }
  };

  const handlePlayVideo = async () => {
    try {
      console.log('🎬 Handle play video called');
      if (videoRef.current) {
        console.log('🎬 Video ref exists, attempting to play...');
        
        // First try to play
        const playResult = await videoRef.current.playAsync();
        console.log('🎬 Play result:', playResult);
        
        // Then unmute
        await videoRef.current.setIsMutedAsync(false);
        console.log('🎬 Video unmuted');
        
        setMuted(false);
        setVideoPlaying(true);
        setShowPlayButton(false);
        setVideoStatus('playing');
      } else {
        console.log('🎬 Video ref is null!');
        setError('Video player not ready. Please try again.');
      }
    } catch (error) {
      console.log('🎬 Manual play error:', error);
      setError(`Unable to play video: ${error}`);
      setDebugInfo(`Play error: ${JSON.stringify(error)}`);
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

        {/* Quick Start Guide - Show when no video selected and not analyzing */}
        <QuickStartLottie visible={!videoUri && !uploading} />

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
                  <Video
                    ref={(r) => (videoRef.current = r)}
                    source={{ uri: videoUri }}
                    style={styles.videoPlayer}
                    useNativeControls
                    resizeMode="contain"
                    shouldPlay={true}
                    isLooping
                    usePoster={false}
                    onError={(error) => {
                      console.error('Video error:', error);
                      setError('Failed to load video preview');
                    }}
                    onLoadStart={() => console.log('Video loading started')}
                    onLoad={async (status) => {
                      console.log('Video loaded successfully:', status);
                      if (Platform.OS === 'web') {
                        // Auto-play only on web
                        try {
                          await videoRef.current?.setIsLoopingAsync(true);
                          await videoRef.current?.playAsync();
                          setVideoPlaying(true);
                        } catch (e) {
                          console.log('Auto-play error:', e);
                        }
                      } else {
                        // Mobile: wait for user interaction
                        setShowPlayButton(true);
                      }
                    }}
                    onPlaybackStatusUpdate={(status) => {
                      if ('error' in status && status.error) {
                        console.error('Playback error:', status.error);
                        setError('Video playback error');
                      }
                    }}
                  />
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
                  <View style={styles.videoContainer}>
                    <Video
                      ref={(r) => (videoRef.current = r)}
                      source={{ uri: videoUri }}
                      style={styles.videoPlayer}
                      useNativeControls
                      resizeMode="contain"
                      shouldPlay={true}
                      isLooping
                      isMuted={muted}
                      usePoster={false}
                      onError={(error) => {
                        console.error('🎬 Video error:', error);
                        setError('Failed to load video preview');
                        setVideoStatus('error');
                        setDebugInfo(`Video error: ${JSON.stringify(error)}`);
                      }}
                      onLoadStart={() => {
                        console.log('🎬 Video loading started');
                        setVideoStatus('loading');
                      }}
                      onLoad={async (status) => {
                        console.log('🎬 Video loaded successfully:', status);
                        setVideoStatus('loaded');
                        setDebugInfo(`Load status: ${JSON.stringify(status)}`);
                        
                        // Multi-attempt auto-play strategy
                        if (Platform.OS !== 'web' && videoRef.current) {
                          const attemptPlay = async (attempt = 1) => {
                            try {
                              console.log(`🎬 Auto-play attempt #${attempt}...`);
                              
                              // Try different strategies
                              if (attempt === 1) {
                                // First attempt: just play
                                await videoRef.current?.playAsync();
                              } else if (attempt === 2) {
                                // Second attempt: ensure muted first
                                await videoRef.current?.setIsMutedAsync(true);
                                await videoRef.current?.playAsync();
                              } else {
                                // Third attempt: set volume to 0 and play
                                await videoRef.current?.setVolumeAsync(0);
                                await videoRef.current?.playAsync();
                              }
                              
                              console.log(`🎬 Auto-play attempt #${attempt} SUCCESS!`);
                              setVideoPlaying(true);
                              setVideoStatus('playing-muted');
                              setShowPlayButton(true); // Show unmute button
                              
                            } catch (autoPlayError) {
                              console.log(`🎬 Auto-play attempt #${attempt} failed:`, autoPlayError);
                              
                              if (attempt < 3) {
                                // Try again after a short delay
                                setTimeout(() => attemptPlay(attempt + 1), 200 * attempt);
                              } else {
                                console.log('🎬 All auto-play attempts failed');
                                setVideoStatus('loaded-paused');
                                setShowPlayButton(true); // Show play button instead
                              }
                            }
                          };
                          
                          attemptPlay();
                        } else {
                          setShowPlayButton(Platform.OS !== 'web' && muted);
                        }
                      }}
                      onPlaybackStatusUpdate={(status) => {
                        if ('error' in status && status.error) {
                          console.error('🎬 Playback error:', status.error);
                          setError('Video playback error');
                          setVideoStatus('error');
                        } else if ('isPlaying' in status) {
                          setVideoPlaying(status.isPlaying || false);
                          setVideoStatus(status.isPlaying ? 'playing' : 'paused');
                        }
                        
                        // Log detailed status for debugging
                        if ('positionMillis' in status) {
                          setDebugInfo(`Status: ${JSON.stringify({
                            isLoaded: status.isLoaded,
                            isPlaying: status.isPlaying,
                            position: status.positionMillis,
                            duration: status.durationMillis || 0
                          })}`);
                        }
                      }}
                    />
                    {showPlayButton && (
                      <TouchableOpacity 
                        style={styles.playButton} 
                        onPress={handlePlayVideo}
                        activeOpacity={0.8}
                      >
                        <View style={styles.playIcon}>
                          <Text style={styles.playText}>
                            {videoStatus === 'playing-muted' ? '🔈' : '▶️'}
                          </Text>
                        </View>
                        <Text style={styles.playButtonText}>
                          {videoStatus === 'playing-muted' ? 'Tap to Unmute' : 'Tap to Play'}
                        </Text>
                        <Text style={styles.debugText}>
                          Status: {videoStatus}
                        </Text>
                      </TouchableOpacity>
                    )}
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
    paddingHorizontal: Platform.OS === 'web' ? 40 : 16,
    paddingBottom: Platform.OS === 'web' ? 60 : 20,
    minHeight: Platform.OS === 'web' ? '100vh' : 'auto',
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
    paddingBottom: Platform.OS === 'web' ? 40 : 20,
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
  videoContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  playButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  playIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  playText: {
    fontSize: 32,
    marginLeft: 4,
  },
  playButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : 'System',
  },
  debugText: {
    color: '#ffffff',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.8,
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : 'System',
  },
});
