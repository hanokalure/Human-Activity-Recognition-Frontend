import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Animated, Easing, Platform, Dimensions, ScrollView, Image } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { ApiService } from '../services/api';
import { VideoUploadResponse } from '../types';
import ResultsDisplay from './ResultsDisplay';
import { Audio, Video } from 'expo-av';

const { width, height } = Dimensions.get('window');
const isMobileSmall = width < 400 && Platform.OS !== 'web';
const panelHeight = Platform.OS === 'web' ? 315 : (isMobileSmall ? 200 : 240);

const collegeLogo = require('../../assets/Guru_Nanak_Dev_Engineering_College,_Bidar_logo.jpg');

type VideoUploadProps = {
  apiHealthy?: boolean | null;
};

export default function VideoUpload({ apiHealthy }: VideoUploadProps) {
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
  const [showInfoModal, setShowInfoModal] = useState(false);

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

  const currentStep = uploading ? 2 : result ? 3 : 1;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.maxWidthContainer}>
        <View style={styles.header}>
          <View style={styles.heroBackground}>
            <Image source={collegeLogo} style={styles.collegeLogo} resizeMode="contain" />
            <Text style={styles.collegeName}>
              GURU NANAK DEV ENGINEERING COLLEGE, BIDAR
            </Text>
            <Text style={styles.departmentName}>
              DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING
            </Text>

            <Text style={styles.title}>
              Human Activity Recognition
            </Text>
            <Text style={styles.subtitle}>
              Upload video to detect human activities
            </Text>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.infoButton}
                onPress={() => setShowInfoModal(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.infoButtonText}>View Team &amp; Guide</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Error */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Stepper */}
        <View style={styles.stepperContainer}>
          <View style={styles.stepperItem}>
            <View
              style={[
                styles.stepCircle,
                currentStep === 1 && styles.stepCircleActive,
                currentStep > 1 && styles.stepCircleCompleted,
              ]}
            >
              <Text
                style={[
                  styles.stepNumber,
                  (currentStep === 1 || currentStep > 1) && styles.stepNumberActive,
                ]}
              >
                1
              </Text>
            </View>
            <Text
              style={[
                styles.stepLabel,
                currentStep >= 1 && styles.stepLabelActive,
              ]}
            >
              Select Video
            </Text>
          </View>

          <View style={styles.stepperConnector} />

          <View style={styles.stepperItem}>
            <View
              style={[
                styles.stepCircle,
                currentStep === 2 && styles.stepCircleActive,
                currentStep > 2 && styles.stepCircleCompleted,
              ]}
            >
              <Text
                style={[
                  styles.stepNumber,
                  (currentStep === 2 || currentStep > 2) && styles.stepNumberActive,
                ]}
              >
                2
              </Text>
            </View>
            <Text
              style={[
                styles.stepLabel,
                currentStep >= 2 && styles.stepLabelActive,
              ]}
            >
              Analyze
            </Text>
          </View>

          <View style={styles.stepperConnector} />

          <View style={styles.stepperItem}>
            <View
              style={[
                styles.stepCircle,
                currentStep === 3 && styles.stepCircleActive,
                currentStep > 3 && styles.stepCircleCompleted,
              ]}
            >
              <Text
                style={[
                  styles.stepNumber,
                  (currentStep === 3 || currentStep > 3) && styles.stepNumberActive,
                ]}
              >
                3
              </Text>
            </View>
            <Text
              style={[
                styles.stepLabel,
                currentStep >= 3 && styles.stepLabelActive,
              ]}
            >
              View Results
            </Text>
          </View>
        </View>

        {/* Step 1: Select Video */}
        <View style={styles.stepCard}>
          <Text style={styles.stepCardTitle}>Step 1 — Select Video</Text>
          <Text style={styles.stepCardSubtitle}>
            Choose a short clip where the person and their activity are clearly visible.
          </Text>

          <TouchableOpacity
            style={[styles.button, uploading && styles.buttonDisabled]}
            onPress={selectVideo}
            disabled={uploading}
          >
            {uploading && (
              <Animated.View
                style={[
                  styles.loadingSquare,
                  { transform: [{ rotate: rotateInterpolate }] },
                ]}
              />
            )}
            <Text style={[styles.buttonText, uploading && styles.buttonTextDisabled]}>
              {uploading ? 'Analyzing...' : 'Select Video'}
            </Text>
          </TouchableOpacity>

          {selectedFile && (
            <Text style={styles.fileSelected}>Selected: {selectedFile}</Text>
          )}

          {typeof apiHealthy === 'boolean' && (
            <View style={styles.apiStatusContainer}>
              <View
                style={[
                  styles.apiStatusDot,
                  apiHealthy ? styles.apiStatusDotOnline : styles.apiStatusDotOffline,
                ]}
              />
              <Text style={styles.apiStatusText}>
                Backend: {apiHealthy ? 'Online' : 'Offline'}
              </Text>
            </View>
          )}

        </View>
        {/* Step 2: Analyze */}
        <View style={styles.stepCard}>
          <Text style={styles.stepCardTitle}>Step 2 — Analyze Activities</Text>
          <Text style={styles.stepCardSubtitle}>
            Once your video is uploaded, the model will automatically start analyzing it.
          </Text>

          <Text style={styles.stepStatusText}>
            {uploading
              ? 'Status: Analyzing video...'
              : result
              ? 'Status: Analysis completed.'
              : 'Status: Waiting for a video to be uploaded.'}
          </Text>
        </View>

        {/* Step 3: View Results */}
        <View style={styles.stepCard}>
          <Text style={styles.stepCardTitle}>Step 3 — View Results</Text>
          <Text style={styles.stepCardSubtitle}>
            Preview your video and inspect the predicted activities and confidence scores.
          </Text>

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

        {/* Project information card */}
        <View style={styles.projectCard}>
          <Text style={styles.projectCardTitle}>Project Information</Text>
          <View style={styles.projectCardColumn}>
            <View style={styles.projectSection}>
              <Text style={styles.projectSectionTitle}>Overview</Text>
              <Text style={styles.projectText}>
                Human Activity Recognition system that classifies 25 different daily-life activities from video clips and provides confidence scores.
              </Text>
            </View>

            <View style={styles.projectSection}>
              <Text style={styles.projectSectionTitle}>Model</Text>
              <Text style={styles.projectText}>
                R(2+1)D Convolutional Neural Network (r2plus1d_18 backbone) optimized for video analysis.
              </Text>
              <Text style={styles.projectText}>
                Input: 16 frames at 112x112 resolution per clip; Output: probabilities over 25 activity classes.
              </Text>
            </View>

            <View style={styles.projectSection}>
              <Text style={styles.projectSectionTitle}>Training</Text>
              <Text style={styles.projectText}>
                Trained on a combined subset of UCF-101 and HMDB-51 datasets for 25 activities over 60 epochs.
              </Text>
              <Text style={styles.projectText}>
                Achieved 87.34% validation accuracy using PyTorch-based training.
              </Text>
            </View>
          </View>
        </View>

        {showInfoModal && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                GURU NANAK DEV ENGINEERING COLLEGE, BIDAR
              </Text>
              <Text style={styles.modalSubtitle}>
                DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING
              </Text>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>HOD</Text>
                <Text style={styles.modalText}>DR. Anuradha</Text>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Guide</Text>
                <Text style={styles.modalText}>Prof. John</Text>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Project Team</Text>
                <Text style={styles.modalText}>Aishwarya Walankar</Text>
                <Text style={styles.modalText}>Aishwarya</Text>
                <Text style={styles.modalText}>Akshata Yenkapalli</Text>
              </View>

              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowInfoModal(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
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
  heroBackground: {
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: Platform.OS === 'web' ? 32 : 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  collegeLogo: {
    width: Platform.OS === 'web' ? 80 : 72,
    height: Platform.OS === 'web' ? 80 : 72,
    borderRadius: 40,
    alignSelf: 'center',
    marginBottom: 8,
  },
  collegeName: {
    fontSize: Platform.OS === 'web' ? 14 : 13,
    fontWeight: '600',
    letterSpacing: 1,
    color: '#4b5563',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 4,
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : 'System',
  },
  departmentName: {
    fontSize: Platform.OS === 'web' ? 13 : 12,
    fontWeight: '500',
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : 'System',
  },
  title: {
    fontSize: Platform.OS === 'web' ? 32 : 28,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : 'System',
  },
  subtitle: {
    fontSize: Platform.OS === 'web' ? 18 : 16,
    fontWeight: '400',
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : 'System',
  },
  buttonContainer: {
    marginTop: 32,
    alignItems: 'center',
  },
  heroActions: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoButton: {
    marginTop: Platform.OS === 'web' ? 0 : 12,
    marginLeft: Platform.OS === 'web' ? 12 : 0,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: 'transparent',
  },
  infoButtonText: {
    color: '#1d4ed8',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : 'System',
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
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 12,
  },
  stepperItem: {
    flex: 1,
    alignItems: 'center',
  },
  stepperConnector: {
    width: 32,
    height: 2,
    backgroundColor: '#e5e7eb',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepCircleActive: {
    borderColor: '#1d4ed8',
    backgroundColor: '#dbeafe',
  },
  stepCircleCompleted: {
    borderColor: '#16a34a',
    backgroundColor: '#dcfce7',
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  stepNumberActive: {
    color: '#111827',
  },
  stepLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : 'System',
  },
  stepLabelActive: {
    color: '#111827',
    fontWeight: '600',
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
  infoCard: {
    marginTop: 12,
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  infoCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
    textAlign: 'left',
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : 'System',
  },
  infoCardSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
    textAlign: 'left',
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : 'System',
  },
  stepCard: {
    marginTop: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  stepCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 6,
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : 'System',
  },
  stepCardSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : 'System',
  },
  stepStatusText: {
    fontSize: 14,
    color: '#111827',
    marginTop: 4,
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : 'System',
  },
  apiStatusContainer: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#dbeafe',
  },
  apiStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  apiStatusDotOnline: {
    backgroundColor: '#16a34a',
  },
  apiStatusDotOffline: {
    backgroundColor: '#dc2626',
  },
  apiStatusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#0f172a',
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : 'System',
  },
  projectCard: {
    marginTop: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 18,
    paddingHorizontal: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  projectCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 10,
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : 'System',
  },
  projectCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 24,
  },
  projectCardColumn: {
    flexDirection: 'column',
    gap: 16,
  },
  projectSection: {
    flex: 1,
  },
  projectSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : 'System',
  },
  projectText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : 'System',
  },
  panelBox: {
    width: '100%',
    height: panelHeight,
    minHeight: panelHeight,
    maxHeight: panelHeight,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: Platform.OS === 'web' ? 1 : 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  panelBoxWeb: {
    flex: 1,
    maxWidth: 560,
    width: '100%',
    height: panelHeight,
    minHeight: panelHeight,
    maxHeight: panelHeight,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
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
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Platform.OS === 'web' ? 'transparent' : 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Platform.OS === 'web' ? 48 : 16,
    zIndex: 50,
  },
  modalCard: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 800 : 560,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 28,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : 'System',
  },
  modalSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : 'System',
  },
  modalSection: {
    marginBottom: 14,
  },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : 'System',
  },
  modalText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : 'System',
  },
  modalCloseButton: {
    marginTop: 16,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#1d4ed8',
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : 'System',
  },
});
