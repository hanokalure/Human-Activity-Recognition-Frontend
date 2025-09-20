import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, Platform, Animated, Easing, Dimensions } from 'react-native';
import { ApiService } from './src/services/api';
import VideoUpload from './src/components/VideoUpload';

const { width, height } = Dimensions.get('window');

export default function App() {
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkApiHealth();
    
    // Start entrance animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: false,
    }).start();
    
    // Continuous pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
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
    
    // Continuous rotation animation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 20000,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    ).start();
  }, []);

  const checkApiHealth = async () => {
    try {
      const health = await ApiService.healthCheck();
      setApiHealthy(health.model_loaded);
    } catch (error) {
      setApiHealthy(false);
    }
  };

  if (apiHealthy === null) {
    const spin = rotateAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });
    
    return (
      <View style={styles.loadingContainer}>
        <Animated.View style={[styles.loadingSpinner, { transform: [{ rotate: spin }, { scale: pulseAnim }] }]}>
          <View style={styles.loadingSpinnerInner} />
        </Animated.View>
        <Animated.Text style={[styles.loadingText, { opacity: fadeAnim }]}>Connecting to server...</Animated.Text>
      </View>
    );
  }

  if (apiHealthy === false) {
    return (
      <View style={styles.errorContainer}>
        <Animated.View style={[styles.errorContent, { opacity: fadeAnim }]}>
          <Text style={styles.errorTitle}>Server Unavailable</Text>
          <Text style={styles.errorMessage}>
            Cannot connect to the backend server. Please check your connection.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={checkApiHealth}>
            <Text style={styles.retryButtonText}>Retry Connection</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Content */}
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <VideoUpload />
      </Animated.View>
      
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingSpinner: {
    width: 40,
    height: 40,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#000000',
    marginBottom: 20,
  },
  loadingSpinnerInner: {
    width: 36,
    height: 36,
    backgroundColor: '#ffffff',
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '400',
    textAlign: 'center',
    fontFamily: Platform.OS === 'web' ? 'system-ui, sans-serif' : 'System',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#ffffff',
  },
  errorContent: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 40,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: Platform.OS === 'web' ? 'system-ui, sans-serif' : 'System',
  },
  errorMessage: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
    fontFamily: Platform.OS === 'web' ? 'system-ui, sans-serif' : 'System',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 6,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Platform.OS === 'web' ? 'system-ui, sans-serif' : 'System',
  },
  content: {
    flex: 1,
  },
});
