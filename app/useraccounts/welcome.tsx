import React from 'react';
import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{
        headerShown: false,
      }} />
      
      <View
        style={styles.container}
      >
        <View style={styles.contentContainer}>
          {/* Logo Section */}
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../assets/images/LakuMobileLogoWhite.png')} 
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.logoText}>Laku-Laku</Text>
          </View>

          {/* Title Section */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Welcome to Laku-Laku Marketplace</Text>
            <Text style={styles.subtitle}>
              Your trusted marketplace for buying and selling. Discover amazing products, connect with sellers, and grow your business all in one place.
            </Text>
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
    backgroundColor: '#0a61d7',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoImage: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 1,
  },
  titleContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 16,
    color: '#e0e7ff',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
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
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#0a61d7',
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0a61d7',
  },
  registerButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

