// screens/auth/OnboardingScreen.tsx
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Animated,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../types/navigation';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../../constants/colors';

type OnboardingScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'Onboarding'
>;

interface Props {
  navigation: OnboardingScreenNavigationProp;
}

interface OnboardingSlide {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradient: string[];
  emoji: string;
  features: string[];
}

const { width } = Dimensions.get('window');

const slides: OnboardingSlide[] = [
  {
    id: '1',
    title: 'Welcome to Zuba',
    description: 'Where social commerce meets community. Buy, sell, and connect with trust.',
    icon: 'rocket-outline',
    gradient: [Colors.primary, Colors.primaryLight],
    emoji: '🚀',
    features: ['Safe & Secure', 'Verified Sellers', 'Fast Delivery'],
  },
  {
    id: '2',
    title: 'Shop Smart',
    description: 'Discover amazing products from trusted sellers. Enjoy buyer protection on every purchase.',
    icon: 'shield-checkmark-outline',
    gradient: [Colors.success, Colors.successLight],
    emoji: '🛍️',
    features: ['Best Prices', 'Quality Products', 'Easy Returns'],
  },
  {
    id: '3',
    title: 'Sell & Grow',
    description: 'Turn your passion into profit. Reach thousands of buyers and grow your business.',
    icon: 'trending-up-outline',
    gradient: [Colors.accent, Colors.accentLight],
    emoji: '📈',
    features: ['Easy Setup', 'Wide Reach', 'Business Tools'],
  },
  {
    id: '4',
    title: 'Join Our Community',
    description: 'Be part of a thriving marketplace built on trust, quality, and amazing experiences.',
    icon: 'people-outline',
    gradient: [Colors.primaryLight, Colors.primary],
    emoji: '🤝',
    features: ['Trusted Network', 'Active Community', 'Great Support'],
  },
];

const OnboardingScreen: React.FC<Props> = ({ navigation }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const slidesRef = useRef<FlatList>(null);

  const viewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const scrollTo = () => {
    if (currentIndex < slides.length - 1) {
      slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      handleGetStarted();
    }
  };

  const handleGetStarted = async () => {
    try {
      await AsyncStorage.setItem('hasSeenOnboarding', 'true');
      navigation.navigate('Signup');
    } catch (error) {
      console.error('Error saving onboarding status:', error);
      navigation.navigate('Signup');
    }
  };

  const handleSkip = async () => {
    try {
      await AsyncStorage.setItem('hasSeenOnboarding', 'true');
      navigation.navigate('Login');
    } catch (error) {
      console.error('Error saving onboarding status:', error);
      navigation.navigate('Login');
    }
  };

  const renderItem = ({ item, index }: { item: OnboardingSlide; index: number }) => (
    <View style={styles.slide}>
      {/* Animated Background Circles */}
      <View style={[styles.bgCircle1, { backgroundColor: item.gradient[0] + '15' }]} />
      <View style={[styles.bgCircle2, { backgroundColor: item.gradient[1] + '10' }]} />

      <View style={styles.slideContent}>
        {/* Icon Section */}
        <View style={styles.iconSection}>
          <View style={[styles.iconOuterCircle, { backgroundColor: item.gradient[0] + '15' }]}>
            <View style={[styles.iconMiddleCircle, { backgroundColor: item.gradient[0] + '25' }]}>
              <View style={[styles.iconInnerCircle, { backgroundColor: item.gradient[0] }]}>
                <Text style={styles.emoji}>{item.emoji}</Text>
              </View>
            </View>
          </View>

          {/* Floating particles */}
          <View style={[styles.particle, styles.particle1, { backgroundColor: item.gradient[1] }]} />
          <View style={[styles.particle, styles.particle2, { backgroundColor: item.gradient[0] }]} />
          <View style={[styles.particle, styles.particle3, { backgroundColor: item.gradient[1] }]} />
        </View>

        {/* Text Section */}
        <View style={styles.textSection}>
          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: item.gradient[0] }]}>{item.title}</Text>
            <View style={[styles.titleUnderline, { backgroundColor: item.gradient[0] }]} />
          </View>
          
          <Text style={styles.description}>{item.description}</Text>

          {/* Features */}
          <View style={styles.featuresContainer}>
            {item.features.map((feature, idx) => (
              <View key={idx} style={[styles.featureItem, { borderColor: item.gradient[0] + '30' }]}>
                <View style={[styles.featureDot, { backgroundColor: item.gradient[0] }]} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          {/* Progress indicator */}
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              {index + 1} / {slides.length}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  const Paginator = () => {
    return (
      <View style={styles.paginatorContainer}>
        {slides.map((slide, i) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];

          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [8, 32, 8],
            extrapolate: 'clamp',
          });

          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              style={[
                styles.dot,
                {
                  width: dotWidth,
                  opacity,
                  backgroundColor: slide.gradient[0],
                },
              ]}
              key={i.toString()}
            />
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.brandContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>Z</Text>
          </View>
          <View>
            <Text style={styles.brandName}>ZUBA</Text>
            <View style={styles.brandAccent} />
          </View>
        </View>
        
        {currentIndex < slides.length - 1 && (
          <TouchableOpacity 
            style={styles.skipButton} 
            onPress={handleSkip}
            activeOpacity={0.7}
          >
            <Text style={styles.skipText}>Skip</Text>
            <Ionicons name="arrow-forward" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Slides */}
      <View style={styles.slidesContainer}>
        <FlatList
          ref={slidesRef}
          data={slides}
          renderItem={renderItem}
          horizontal
          showsHorizontalScrollIndicator={false}
          pagingEnabled
          bounces={false}
          keyExtractor={(item) => item.id}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={32}
          onViewableItemsChanged={viewableItemsChanged}
          viewabilityConfig={viewConfig}
        />
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Paginator />

        <View style={styles.buttonsContainer}>
          {currentIndex === slides.length - 1 ? (
            <View style={styles.finalButtons}>
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.buttonPrimary,
                  { backgroundColor: slides[currentIndex].gradient[0] },
                ]}
                onPress={handleGetStarted}
                activeOpacity={0.8}
              >
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonTextPrimary}>Get Started</Text>
                  <Text style={styles.buttonArrow}><Ionicons name="arrow-forward" size={24} color={Colors.white} /></Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.button,
                  styles.buttonSecondary,
                  { borderColor: slides[currentIndex].gradient[0] },
                ]}
                onPress={() => navigation.navigate('Login')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.buttonTextSecondary,
                    { color: slides[currentIndex].gradient[0] },
                  ]}
                >
                  I Have an Account
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.nextButtonContainer}>
              <TouchableOpacity
                style={styles.swipeHint}
                onPress={scrollTo}
              >
                <Text style={styles.swipeHintText}>Swipe to continue</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.nextButton,
                  { backgroundColor: slides[currentIndex].gradient[0] },
                ]}
                onPress={scrollTo}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-forward" size={28} color={Colors.white} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.white,
  },
  brandName: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 2,
  },
  brandAccent: {
    width: 30,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.accent,
    marginTop: 2,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  skipText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  slidesContainer: {
    flex: 3,
  },
  slide: {
    width,
    position: 'relative',
  },
  bgCircle1: {
    position: 'absolute',
    top: 50,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  bgCircle2: {
    position: 'absolute',
    bottom: 100,
    left: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
  },
  slideContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconSection: {
    marginBottom: 40,
    position: 'relative',
  },
  iconOuterCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconMiddleCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInnerCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  emoji: {
    fontSize: 50,
  },
  particle: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    opacity: 0.6,
  },
  particle1: {
    top: 20,
    right: 20,
  },
  particle2: {
    bottom: 30,
    left: 15,
    width: 8,
    height: 8,
  },
  particle3: {
    top: 100,
    left: -10,
    width: 10,
    height: 10,
  },
  textSection: {
    alignItems: 'center',
    width: '100%',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  titleUnderline: {
    width: 60,
    height: 4,
    borderRadius: 2,
  },
  description: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  featureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  featureText: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  progressContainer: {
    marginTop: 10,
  },
  progressText: {
    fontSize: 14,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  footer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 40,
  },
  paginatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 64,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  buttonsContainer: {
    paddingHorizontal: 24,
  },
  finalButtons: {
    gap: 12,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonPrimary: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonSecondary: {
    backgroundColor: Colors.background,
    borderWidth: 2,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonTextPrimary: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  buttonArrow: {
    color: Colors.white,
    fontSize: 22,
    fontWeight: '700',
  },
  buttonTextSecondary: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  nextButtonContainer: {
    alignItems: 'flex-end',
  },
  swipeHint: {
    marginBottom: 12,
  },
  swipeHintText: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  nextButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
});

export default OnboardingScreen;