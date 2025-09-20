import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Platform, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function Footer() {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    ).start();

    // Glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  // Only render on web
  if (Platform.OS !== 'web') {
    return null;
  }

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  return (
    <Animated.View style={[styles.footerContainer, { transform: [{ scale: pulseAnim }] }]}>
      <View style={styles.footerGradient}>
        <Animated.View style={[styles.glowEffect, { opacity: glowOpacity }]} />
        
        <View style={styles.footerContent}>
          <Text style={styles.copyrightText}>
            © 2024 All Rights Reserved by ASH
          </Text>
          <View style={styles.separator} />
          <Text style={styles.tagline}>
            Developed by ASH
          </Text>
          <Text style={styles.version}>
            Deep Learning Project v1.0.0
          </Text>
        </View>

      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  footerContainer: {
    height: 120,
    position: 'relative',
    overflow: 'hidden',
  },
  footerGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  glowEffect: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#fff',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 10,
  },
  footerContent: {
    alignItems: 'center',
    zIndex: 2,
  },
  copyrightText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: Platform.OS === 'web' ? 'Poppins, system-ui, sans-serif' : 'System',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  separator: {
    width: 60,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.6)',
    marginVertical: 6,
    borderRadius: 1,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 4,
    textAlign: 'center',
    fontFamily: Platform.OS === 'web' ? 'Poppins, system-ui, sans-serif' : 'System',
  },
  version: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    fontFamily: Platform.OS === 'web' ? 'Poppins, system-ui, sans-serif' : 'System',
  },
});