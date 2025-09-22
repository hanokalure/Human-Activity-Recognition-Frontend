import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, Easing } from 'react-native';

const { width, height } = Dimensions.get('window');

interface QuickStartLottieProps {
  visible: boolean; // Show when no video selected AND not analyzing
}

export default function QuickStartLottie({ visible }: QuickStartLottieProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
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

  useEffect(() => {
    if (visible) {
      // Entrance animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: false,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: false,
        }),
      ]).start();

      // Continuous pulse animation for web icons
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
        ])
      ).start();
    } else {
      // Exit animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(slideAnim, {
          toValue: -30,
          duration: 300,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [visible]);

  // Check backend status
  useEffect(() => {
    let cancelled = false;
    const checkStatus = async () => {
      try {
        const response = await fetch('https://hanokalure-human-activity-backend.hf.space/health');
        if (!cancelled) {
          setBackendStatus(response.ok ? 'online' : 'offline');
        }
      } catch (error) {
        if (!cancelled) {
          setBackendStatus('offline');
        }
      }
    };

    checkStatus();
    return () => { cancelled = true; };
  }, []);

  if (!visible) return null;

  const StatusDot = () => {
    const color = backendStatus === 'online' ? '#16a34a' : backendStatus === 'offline' ? '#dc2626' : '#6b7280';
    return (
      <View style={styles.statusContainer}>
        <View style={[styles.statusDot, { backgroundColor: color }]} />
        <Text style={styles.statusText}>
          Backend: {backendStatus === 'checking' ? 'Checking...' : backendStatus === 'online' ? 'Online' : 'Offline'}
        </Text>
      </View>
    );
  };

  return (
    <Animated.View style={[
      styles.container,
      {
        opacity: fadeAnim,
        transform: [
          { translateY: slideAnim },
          { scale: scaleAnim }
        ]
      }
    ]}>
      <View style={[
        styles.contentContainer,
        isSmallScreen ? styles.contentMobile : styles.contentDesktop
      ]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Get Started with AI Activity Recognition</Text>
          <StatusDot />
        </View>

        {/* Steps Section */}
        <View style={[styles.stepsContainer, isSmallScreen ? styles.stepsMobile : styles.stepsDesktop]}>
          {/* Steps */}
          <View style={styles.stepsList}>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Upload MP4 Video</Text>
                <Text style={styles.stepDescription}>Select a 2-30 second video clip</Text>
              </View>
            </View>

            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Video Analysis</Text>
                <Text style={styles.stepDescription}>Our model processes your video</Text>
              </View>
            </View>

            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>View Results</Text>
                <Text style={styles.stepDescription}>Get activity prediction with confidence</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tips */}
        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>💡 Tips for Best Results</Text>
          <View style={styles.tipsList}>
            <Text style={styles.tip}>• Use good lighting and stable camera</Text>
            <Text style={styles.tip}>• Focus on one main activity per video</Text>
            <Text style={styles.tip}>• MP4 format works best</Text>
            <Text style={styles.tip}>• Include full body view when possible</Text>
          </View>
        </View>

        {/* Privacy Note */}
        <Text style={styles.privacyNote}>
          🔒 Your videos are processed for analysis only - never stored or shared
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  contentContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    maxWidth: 800,
    alignSelf: 'center',
  },
  contentMobile: {
    gap: 20,
  },
  contentDesktop: {
    gap: 24,
  },
  header: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    fontFamily: 'system-ui, sans-serif',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: 'system-ui, sans-serif',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'system-ui, sans-serif',
  },
  stepsContainer: {
    gap: 16,
    alignItems: 'center',
  },
  stepsMobile: {
    flexDirection: 'column',
  },
  stepsDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepsList: {
    flex: 1,
    gap: 16,
    alignItems: 'center',
    width: '100%',
  },
  step: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'system-ui, sans-serif',
  },
  stepContent: {
    flex: 1,
    gap: 2,
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    fontFamily: 'system-ui, sans-serif',
    textAlign: 'center',
    maxWidth: 640,
  },
  stepDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 18,
    fontFamily: 'system-ui, sans-serif',
    textAlign: 'center',
    maxWidth: 640,
  },
  tipsContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
    fontFamily: 'system-ui, sans-serif',
    textAlign: 'center',
    maxWidth: 640,
  },
  tipsList: {
    gap: 6,
    alignItems: 'center',
    width: '100%',
  },
  tip: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 18,
    fontFamily: 'system-ui, sans-serif',
    textAlign: 'center',
    maxWidth: 640,
  },
  privacyNote: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    fontStyle: 'italic',
    fontFamily: 'system-ui, sans-serif',
  },
});