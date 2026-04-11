import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/** Must match server allowlist in Laku-Dashboard `marketplaceHomeOfferIcons`. */
const SAFE_ICONS = new Set([
  'gift',
  'flash',
  'flame',
  'pricetag',
  'cart',
  'star',
  'heart',
  'megaphone',
  'ribbon',
  'trophy',
  'rocket',
]);

function safeIconName(name: string | undefined, fallback: string): string {
  const n = (name || '').trim().toLowerCase();
  return SAFE_ICONS.has(n) ? n : fallback;
}

function overlayTintFromHex(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6 || !/^[0-9a-fA-F]+$/.test(h)) {
    return `rgba(10, 97, 215, ${alpha})`;
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

interface SaleBannerProps {
  title?: string;
  subtitle?: string;
  discountText?: string;
  endDate?: string;
  onPress?: () => void;
  backgroundColor?: string;
  textColor?: string;
  /** Optional HTTPS image; tinted with backgroundColor for readability */
  bannerImageUrl?: string | null;
  /** Full designed banner (e.g. Canva); when set, home shows this image only — text is for detail screen */
  customBannerImageUrl?: string | null;
  rightIconName?: string;
  discountIconName?: string;
  /** When true, removes horizontal margins so the banner can sit inside a horizontal carousel slide. */
  embeddedInCarousel?: boolean;
  /**
   * When set, all banner variants (custom image, hero image, solid) use this height so carousel + list tiles match.
   */
  fixedHeight?: number;
}

/** Use everywhere offers are shown in a row or list so every card is the same size. */
export const SALE_BANNER_UNIFORM_HEIGHT = 180;

export default function SaleBanner({
  title = 'Sale',
  subtitle = '',
  discountText = 'Promo',
  endDate = '',
  onPress,
  backgroundColor = '#0a61d7',
  textColor = '#FFFFFF',
  bannerImageUrl,
  customBannerImageUrl,
  rightIconName = 'gift',
  discountIconName = 'flash',
  embeddedInCarousel = false,
  fixedHeight,
}: SaleBannerProps) {
  const rightIcon = safeIconName(rightIconName, 'gift');
  const discountIcon = safeIconName(discountIconName, 'flash');

  const handlePress = () => {
    if (onPress) {
      onPress();
    }
  };

  const customArt =
    typeof customBannerImageUrl === 'string' && customBannerImageUrl.trim().length > 0;

  const outerStyle = embeddedInCarousel ? [styles.customOuter, styles.outerCarousel] : styles.customOuter;
  const containerStyle = embeddedInCarousel ? [styles.container, styles.outerCarousel] : styles.container;
  const fixedBox = fixedHeight != null ? { height: fixedHeight, overflow: 'hidden' as const } : null;

  if (customArt) {
    /**
     * Fixed slot uses `cover` so the frame is always full-bleed (no gray bars). Key art should stay
     * near the center; very wide/tall uploads may crop at the sides or top/bottom.
     */
    const shellDimensions =
      fixedHeight != null ? { height: fixedHeight } : { aspectRatio: 16 / 5 };

    return (
      <TouchableOpacity
        style={[outerStyle, fixedBox]}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <View style={[styles.customImageShell, shellDimensions]}>
          <Image
            source={{ uri: customBannerImageUrl!.trim() }}
            style={styles.customImageFill}
            resizeMode="cover"
            accessibilityRole="image"
          />
        </View>
      </TouchableOpacity>
    );
  }

  const hasImage = typeof bannerImageUrl === 'string' && bannerImageUrl.trim().length > 0;

  const contentInnerStyle =
    fixedHeight != null
      ? [
          styles.content,
          {
            minHeight: fixedHeight,
            height: fixedHeight,
            paddingVertical: 12,
            paddingHorizontal: 16,
            flexGrow: 1,
          },
        ]
      : styles.content;

  const content = (
    <>
      {!hasImage ? (
        <View style={styles.backgroundPattern}>
          <View style={[styles.circle, styles.circle1]} />
          <View style={[styles.circle, styles.circle2]} />
          <View style={[styles.circle, styles.circle3]} />
        </View>
      ) : null}

      <View style={contentInnerStyle}>
        <View style={styles.leftSection}>
          <Text
            style={[styles.title, { color: textColor }]}
            numberOfLines={fixedHeight != null ? 2 : undefined}
          >
            {title}
          </Text>
          {subtitle.trim() ? (
            <Text
              style={[styles.subtitle, { color: textColor }]}
              numberOfLines={fixedHeight != null ? 1 : undefined}
            >
              {subtitle}
            </Text>
          ) : null}
          <View style={styles.discountContainer}>
            <View style={styles.discountBadge}>
              <Ionicons name={discountIcon as 'flash'} size={16} color={backgroundColor} />
              <Text style={[styles.discountText, { color: backgroundColor }]}>{discountText}</Text>
            </View>
          </View>
        </View>

        <View style={styles.rightSection}>
          <View style={styles.iconContainer}>
            <Ionicons name={rightIcon as 'gift'} size={32} color={textColor} />
          </View>
          {endDate.trim() ? (
            <Text style={[styles.endDate, { color: textColor }]}>{endDate}</Text>
          ) : null}
        </View>
      </View>
    </>
  );

  return (
    <TouchableOpacity
      style={[
        containerStyle,
        fixedBox,
        { backgroundColor: hasImage ? 'transparent' : backgroundColor },
      ]}
      onPress={handlePress}
      activeOpacity={0.9}
    >
      {hasImage ? (
        <ImageBackground
          source={{ uri: bannerImageUrl!.trim() }}
          style={[styles.imageBg, fixedHeight != null ? { minHeight: fixedHeight, height: fixedHeight } : null]}
          imageStyle={styles.imageRadius}
        >
          <View style={[styles.imageTint, { backgroundColor: overlayTintFromHex(backgroundColor, 0.88) }]} />
          {content}
        </ImageBackground>
      ) : (
        content
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  outerCarousel: {
    marginHorizontal: 0,
  },
  customOuter: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  customImageShell: {
    width: '100%',
    backgroundColor: '#e5e7eb',
    borderRadius: 16,
    overflow: 'hidden',
  },
  customImageFill: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  imageBg: {
    width: '100%',
    minHeight: 100,
    borderRadius: 16,
    overflow: 'hidden',
  },
  imageRadius: {
    borderRadius: 16,
  },
  imageTint: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  backgroundPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.1,
  },
  circle: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 50,
  },
  circle1: {
    width: 80,
    height: 80,
    top: -20,
    right: -20,
  },
  circle2: {
    width: 60,
    height: 60,
    bottom: -15,
    left: -15,
  },
  circle3: {
    width: 40,
    height: 40,
    top: 20,
    right: 60,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    minHeight: 100,
    position: 'relative',
    zIndex: 1,
  },
  leftSection: {
    flex: 1,
    paddingRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    opacity: 0.9,
  },
  discountContainer: {
    marginTop: 4,
  },
  discountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  discountText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  rightSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  endDate: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.9,
  },
});
