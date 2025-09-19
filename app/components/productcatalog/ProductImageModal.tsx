import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Dimensions,
  StyleSheet,
  Modal,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useColorScheme } from 'react-native';
import { X, ChevronLeft, ChevronRight } from 'lucide-react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ProductImageModalProps {
  visible: boolean;
  images: string[];
  onClose: () => void;
  initialIndex?: number;
}

export default function ProductImageModal({
  visible,
  images,
  onClose,
  initialIndex = 0,
}: ProductImageModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  
  const backgroundColor = isDark ? '#000000' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#000000';
  const iconColor = isDark ? '#ffffff' : '#000000';
  const dotColor = isDark ? '#ffffff' : '#000000';
  const dotInactiveColor = isDark ? '#666666' : '#cccccc';
  
  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };
  
  const handleNext = () => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };
  
  const handleImagePress = () => {
    // Toggle between full screen and normal view
    // This could be expanded to show/hide controls
  };
  
  if (!visible || images.length === 0) {
    return null;
  }
  
  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <StatusBar backgroundColor={backgroundColor} barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.container, { backgroundColor }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: isDark ? '#333333' : '#e5e5e5' }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={iconColor} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: textColor }]}>
            {currentIndex + 1} of {images.length}
          </Text>
          <View style={styles.placeholder} />
        </View>
        
        {/* Image Container */}
        <View style={styles.imageContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
              setCurrentIndex(index);
            }}
            style={styles.scrollView}
          >
            {images.map((image, index) => (
              <TouchableOpacity
                key={index}
                style={styles.imageWrapper}
                onPress={handleImagePress}
                activeOpacity={1}
              >
                <Image
                  source={{ uri: image }}
                  style={styles.image}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          {/* Navigation Arrows */}
          {images.length > 1 && (
            <>
              <TouchableOpacity
                style={[styles.navButton, styles.prevButton]}
                onPress={handlePrevious}
              >
                <ChevronLeft size={24} color={iconColor} />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.navButton, styles.nextButton]}
                onPress={handleNext}
              >
                <ChevronRight size={24} color={iconColor} />
              </TouchableOpacity>
            </>
          )}
        </View>
        
        {/* Pagination Dots */}
        {images.length > 1 && (
          <View style={styles.paginationContainer}>
            <View style={styles.paginationDots}>
              {images.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: index === currentIndex ? dotColor : dotInactiveColor,
                    },
                  ]}
                />
              ))}
            </View>
            <View style={[styles.paginationLine, { backgroundColor: dotColor }]} />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  imageContainer: {
    flex: 1,
    position: 'relative',
  },
  scrollView: {
    flex: 1,
  },
  imageWrapper: {
    width: screenWidth,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: screenWidth,
    height: screenHeight * 0.7,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -20 }],
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 20,
    padding: 8,
  },
  prevButton: {
    left: 16,
  },
  nextButton: {
    right: 16,
  },
  paginationContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  paginationLine: {
    width: 30,
    height: 2,
    borderRadius: 1,
  },
});
