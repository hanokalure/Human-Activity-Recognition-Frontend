import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Platform, Dimensions } from 'react-native';
import { ActivityPrediction, ACTIVITY_CATEGORIES, ActivityCategory } from '../types';

interface ResultsDisplayProps {
  prediction: ActivityPrediction | null;
  loading?: boolean;
  compact?: boolean;
}

const { width, height } = Dimensions.get('window');

export default function ResultsDisplay({ prediction, loading, compact }: ResultsDisplayProps) {
  const barAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const emojiScale = useRef(new Animated.Value(0.9)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Continuous animations
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 10000,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    ).start();

    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    ).start();

    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }

    if (!loading && prediction) {
      barAnim.setValue(0);
      fadeAnim.setValue(0);
      emojiScale.setValue(0.9);

      Animated.parallel([
        Animated.timing(barAnim, {
          toValue: prediction.confidence,
          duration: 1200,
          useNativeDriver: false,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.sequence([
          Animated.timing(emojiScale, {
            toValue: 1.3,
            duration: 400,
            useNativeDriver: false,
            easing: Easing.out(Easing.back(2)),
          }),
          Animated.spring(emojiScale, {
            toValue: 1,
            useNativeDriver: false,
            friction: 3,
            tension: 100,
          }),
        ]),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: false,
          easing: Easing.out(Easing.ease),
        })
      ]).start();
    }
  }, [prediction, loading]);

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });

  if (loading) {
    return (
      <Animated.View style={[styles.container, { transform: [{ scale: pulseAnim }] }]}>
        <View style={styles.loadingContainer}>
          <Animated.View style={[styles.loadingSpinner, { transform: [{ rotate: rotateInterpolate }] }]} />
          <Text style={styles.loadingText}>
            Analyzing video...
          </Text>
        </View>
      </Animated.View>
    );
  }

  if (!prediction) {
    return (
      <Animated.View style={[styles.container, { opacity: glowOpacity }]}>
        <View style={styles.placeholderContainer}>
          <Text style={styles.placeholderText}>
            Results will appear here
          </Text>
        </View>
      </Animated.View>
    );
  }

  const getActivityEmoji = (activity: string): string => {
    const emojiMap: Record<string, string> = {
      'walking': '🚶',
      'running': '🏃',
      'climbing_stairs': '🪜',
      'biking_ucf': '🚴',
      'pullups_ucf': '💪',
      'pushups_ucf': '🏋️',
      'yoga': '🧘',
      'weight_lifting': '🏋️‍♀️',
      'brushing_teeth': '🦷',
      'brushing_hair': '💇',
      'eating': '🍽️',
      'drinking': '🥤',
      'typing': '⌨️',
      'writing': '✍️',
      'talking': '💬',
      'cooking_ucf': '👨‍🍳',
      'cleaning': '🧹',
      'pouring': '🫖',
      'hugging': '🤗',
      'waving': '👋',
      'laughing': '😂',
      'walking_dog': '🐕‍🦺',
      'breast_stroke': '🏊',
      'front_crawl': '🏊‍♀️',
      'sitting': '🪑',
    };
    return emojiMap[activity] || '🎭';
  };

  const getActivityCategory = (activity: string): ActivityCategory | null => {
    for (const [category, activities] of Object.entries(ACTIVITY_CATEGORIES)) {
      if (activities.includes(activity as any)) {
        return category as ActivityCategory;
      }
    }
    return null;
  };

  const formatActivityName = (activity: string): string => {
    return activity
      .replace(/_/g, ' ')
      .replace(/ucf$/, '')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return '#4CAF50';
    if (confidence >= 0.6) return '#FF9800';
    return '#F44336';
  };

  const getConfidenceGradient = (confidence: number): string[] => {
    if (confidence >= 0.8) {
      return ['rgba(76,175,80,0.9)', 'rgba(139,195,74,0.9)', 'rgba(205,220,57,0.9)'];
    }
    if (confidence >= 0.6) {
      return ['rgba(255,152,0,0.9)', 'rgba(255,193,7,0.9)', 'rgba(255,235,59,0.9)'];
    }
    return ['rgba(244,67,54,0.9)', 'rgba(255,87,34,0.9)', 'rgba(255,152,0,0.9)'];
  };

  const sortedProbabilities = prediction && prediction.all_probabilities
    ? Object.entries(prediction.all_probabilities)
        .sort(([,a], [,b]) => b - a)
    : [];

  // Top result only
  const [topClass, topProb] = sortedProbabilities.length > 0
    ? sortedProbabilities[0]
    : [prediction.predicted_class, prediction.confidence];

  const category = getActivityCategory(topClass as string);
  const emoji = getActivityEmoji(topClass as string);
  const formattedName = formatActivityName(topClass as string);
  const confidenceColor = getConfidenceColor(topProb as number);

  const barWidth = barAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%']
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.resultContainer}>
        <Animated.Text style={[styles.emojiText, { opacity: fadeAnim }]}>
          {emoji}
        </Animated.Text>
        <Animated.Text style={[styles.activityText, { opacity: fadeAnim }]}>
          {formattedName}
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative' as const,
    minHeight: Math.min(Math.floor(height * 0.5), 480),
    width: Platform.OS === 'web' ? '100%' : undefined,
    maxWidth: Platform.OS === 'web' ? 600 : undefined,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginTop: Platform.OS === 'web' ? 20 : 24,
    marginHorizontal: Platform.OS === 'web' ? 0 : 20,
    marginBottom: Platform.OS === 'web' ? 60 : 40,
    alignSelf: 'center',
    overflow: 'hidden' as const,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  
  loadingContainer: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#FFFFFF',
  },
  
  loadingSpinner: {
    width: 40,
    height: 40,
    backgroundColor: '#FFFFFF',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#000000',
  },
  
  loadingText: {
    color: '#666666',
    fontSize: 16,
    fontWeight: '400' as const,
    textAlign: 'center' as const,
    fontFamily: Platform.OS === 'web' ? 'system-ui, sans-serif' : 'System',
  },
  
  placeholderContainer: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    backgroundColor: '#FFFFFF',
  },
  
  placeholderText: {
    color: '#999999',
    fontSize: 18,
    fontWeight: '300' as const,
    textAlign: 'center' as const,
    fontFamily: Platform.OS === 'web' ? 'system-ui, sans-serif' : 'System',
  },
  
  resultContainer: {
    flex: 1,
    width: '100%',
    padding: 40,
    paddingBottom: 80,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    backgroundColor: '#FFFFFF',
  },
  
  emojiText: {
    fontSize: 64,
    textAlign: 'center' as const,
    marginBottom: 16,
  },
  
  activityText: {
    color: '#000000',
    fontSize: Platform.OS === 'web' ? 36 : 32,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
    lineHeight: Platform.OS === 'web' ? 44 : 40,
    fontFamily: Platform.OS === 'web' ? 'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' : 'System',
    letterSpacing: -0.5,
  },
});
