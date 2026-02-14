import React, { useState, useRef } from 'react';
import { View, Text, Pressable, Image, StyleSheet, ScrollView, Dimensions, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SvgXml } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Slide {
  /** require() asset id (number) in Metro, or ImageSourcePropType for URI */
  image: number;
  title: string;
  description: string;
}

const slides: Slide[] = [
  {
    image: require('../../assets/images/teamonlinework.jpg'),
    title: 'Connect with Distributors',
    description: 'Browse thousands of products from verified sellers. Chat directly with sellers, negotiate prices, and build lasting business relationships.',
  },
  {
    image: require('../../assets/images/transitwarehouse.jpg'),
    title: 'Fast & Reliable Delivery',
    description: 'Get your orders delivered quickly and safely. Our marketplace connects you with sellers who ensure fast shipping and secure packaging.',
  },
  {
    image: require('../../assets/images/marketplace.jpg'),
    title: 'Trusted Marketplace',
    description: 'Shop with confidence from our verified sellers. Our marketplace provides secure transactions, quality products, and excellent customer support.',
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slideSize = SCREEN_WIDTH;
    const index = Math.round(event.nativeEvent.contentOffset.x / slideSize);
    setCurrentIndex(index);
  };

  const scrollToSlide = (index: number) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: index * SCREEN_WIDTH,
        animated: true,
      });
    }
  };

  return (
    <>
      <Stack.Screen options={{
        headerShown: false,
      }} />
      
      <View style={styles.container}>
        <View style={styles.contentContainer}>

          {/* Image Carousel */}
          <View style={styles.carouselContainer}>
            <ScrollView
              ref={scrollViewRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleScroll}
              scrollEventThrottle={16}
              style={styles.carousel}
            >
              {slides.map((slide, index) => (
                <View key={index} style={styles.slide}>
                  <Image 
                    source={slide.image} 
                    style={styles.slideImage}
                    resizeMode="cover"
                  />
                  <View style={styles.slideContent}>
                    <Text style={styles.slideTitle}>{slide.title}</Text>
                    <Text style={styles.slideDescription}>{slide.description}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* Bullet Indicators */}
            <View style={styles.paginationContainer}>
              {slides.map((_, index) => (
                <Pressable
                  key={index}
                  onPress={() => scrollToSlide(index)}
                  style={[
                    styles.paginationDot,
                    currentIndex === index && styles.paginationDotActive,
                  ]}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Action Buttons - Side by Side */}
        <View style={styles.buttonContainer}>
          <Pressable
            onPress={() => router.push('/useraccounts/loginsignup/loginmodal')}
            style={[styles.button, styles.loginButton]}
          >
            <Text style={styles.loginButtonText}>Login</Text>
          </Pressable>
          
          <Pressable
            onPress={() => router.push('/useraccounts/loginsignup/signupmodal')}
            style={[styles.button, styles.registerButton]}
          >
            <Text style={styles.registerButtonText}>Register</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  contentContainer: {
    flex: 1,
    paddingTop: 60,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
    paddingHorizontal: 24,
  },
  logoImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoImage: {
    width: 60,
    height: 60,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0a61d7',
    letterSpacing: 1,
  },
  carouselContainer: {
    marginBottom: 0,
  },
  carousel: {
    flexGrow: 0,
  },
  slide: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  slideImage: {
    width: SCREEN_WIDTH - 100,
    height: 250,
    borderRadius: 0,
    marginBottom: 50,
    backgroundColor: '#ffffff',
  },
  slideContent: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  slideTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  slideDescription: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  paginationDotActive: {
    width: 24,
    backgroundColor: '#0a61d7',
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButton: {
    backgroundColor: '#0a61d7',
    borderWidth: 2,
    borderColor: '#0a61d7',
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  registerButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#0a61d7',
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0a61d7',
  },
});

