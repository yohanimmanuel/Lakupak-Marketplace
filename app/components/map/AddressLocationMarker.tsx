import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { MapPin } from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LakuTheme } from '@/constants/Colors';

/** Pulsing delivery-style pin used on address maps (matches Laku-Driver marker language). */
export default function AddressLocationMarker() {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(2.2, { duration: 900 }),
        withTiming(1, { duration: 900 }),
      ),
      -1,
      false,
    );
  }, [scale]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: Math.max(0, (2.2 - scale.value) * 0.2),
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.ring, ringStyle]} />
      <View style={styles.pin}>
        <MapPin size={14} color="#ffffff" fill="#ffffff" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: LakuTheme.primary,
  },
  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: LakuTheme.primary,
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
});
