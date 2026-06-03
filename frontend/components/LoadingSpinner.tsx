// components/LoadingSpinner.tsx
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';
import { Colors } from '../constants/colors';

interface LoadingSpinnerProps {
  size?: number;
  color?: string;
  style?: ViewStyle;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 20,
  color = Colors.primary,
  style,
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    pulseAnimation.start();

    return () => pulseAnimation.stop();
  }, []);

  const shadowScale = scaleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.5],
  });

  return (
    <View style={[styles.container, style]}>
      {/* Pulsing shadow/ring */}
      <Animated.View
        style={[
          styles.shadow,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            opacity: opacityAnim,
            transform: [{ scale: shadowScale }],
          },
        ]}
      />
      {/* Core circle */}
      <View
        style={[
          styles.core,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadow: {
    position: 'absolute',
  },
  core: {
    position: 'absolute',
  },
});

// FullScreenLoading.tsx - Full screen loading overlay
interface FullScreenLoadingProps {
  visible: boolean;
  message?: string;
  size?: number;
  color?: string;
}

export const FullScreenLoading: React.FC<FullScreenLoadingProps> = ({
  visible,
  message,
  size = 40,
  color = Colors.primary,
}) => {
  if (!visible) return null;

  return (
    <View style={overlayStyles.overlay}>
      <View style={overlayStyles.content}>
        <LoadingSpinner size={size} color={color} />
        {message && (
          <View style={overlayStyles.messageContainer}>
            <Animated.Text style={overlayStyles.message}>{message}</Animated.Text>
          </View>
        )}
      </View>
    </View>
  );
};

const overlayStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  content: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  messageContainer: {
    marginTop: 16,
  },
  message: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
});

// LoadingContext.tsx - Global loading state management
import { createContext, useContext, useState, ReactNode } from 'react';

interface LoadingContextType {
  isLoading: boolean;
  message: string;
  showLoading: (message?: string) => void;
  hideLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const LoadingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const showLoading = (msg: string = '') => {
    setMessage(msg);
    setIsLoading(true);
  };

  const hideLoading = () => {
    setIsLoading(false);
    setMessage('');
  };

  return (
    <LoadingContext.Provider value={{ isLoading, message, showLoading, hideLoading }}>
      {children}
      <FullScreenLoading visible={isLoading} message={message} />
    </LoadingContext.Provider>
  );
};

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within LoadingProvider');
  }
  return context;
};
