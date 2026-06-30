import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth } = Dimensions.get('window');

const SKELETON_BASE = '#e5e7eb';
const SKELETON_HIGHLIGHT = '#f3f4f6';
const SHIMMER_DURATION_MS = 1600;

type ShimmerTranslateX = Animated.AnimatedInterpolation<number>;

const ShimmerContext = createContext<ShimmerTranslateX | null>(null);

/** One shimmer loop per skeleton screen/tree. */
export function ShimmerProvider({ children }: { children: React.ReactNode }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: SHIMMER_DURATION_MS,
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [progress]);

  const translateX = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 1],
        outputRange: [-screenWidth, screenWidth],
      }),
    [progress],
  );

  return <ShimmerContext.Provider value={translateX}>{children}</ShimmerContext.Provider>;
}

function ShimmerBoneView({
  style,
  translateX,
}: {
  style?: StyleProp<ViewStyle>;
  translateX: ShimmerTranslateX;
}) {
  return (
    <View style={[styles.bone, style]}>
      <Animated.View style={[styles.shimmerLayer, { transform: [{ translateX }] }]}>
        <LinearGradient
          colors={[SKELETON_BASE, SKELETON_HIGHLIGHT, SKELETON_BASE]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.shimmerGradient}
        />
      </Animated.View>
    </View>
  );
}

/** Leaf shimmer block; uses shared progress from the nearest ShimmerProvider. */
export function ShimmerBone({ style }: { style?: StyleProp<ViewStyle> }) {
  const translateX = useContext(ShimmerContext);
  if (!translateX) {
    return (
      <ShimmerProvider>
        <ShimmerBone style={style} />
      </ShimmerProvider>
    );
  }
  return <ShimmerBoneView style={style} translateX={translateX} />;
}

function SkeletonTree({ children }: { children: React.ReactNode }) {
  return <ShimmerProvider>{children}</ShimmerProvider>;
}

/** Two-column product grid skeleton (home / categories / search). */
export function ProductGridSkeleton({
  rowsPerColumn = 3,
  style,
}: {
  rowsPerColumn?: number;
  style?: object;
}) {
  const indices = Array.from({ length: rowsPerColumn }, (_, i) => i);
  return (
    <SkeletonTree>
      <View style={[styles.productGrid, style]}>
      <View style={styles.productColumn}>
        {indices.map((i) => (
          <View key={`l-${i}`} style={styles.productItem}>
            <ProductSkeleton />
          </View>
        ))}
      </View>
      <View style={styles.productColumn}>
        {indices.map((i) => (
          <View key={`r-${i}`} style={styles.productItem}>
            <ProductSkeleton />
          </View>
        ))}
      </View>
      </View>
    </SkeletonTree>
  );
}

/** Single marketplace product card skeleton. */
export function ProductSkeleton() {
  return (
    <View style={styles.productSkeleton}>
      <ShimmerBone style={styles.productImageSkeleton} />
      <View style={styles.productContentSkeleton}>
        <ShimmerBone style={styles.productTitleSkeleton} />
        <ShimmerBone style={styles.productTitleSkeletonShort} />
        <ShimmerBone style={styles.productPriceSkeleton} />
        <View style={styles.productMetaRow}>
          <ShimmerBone style={styles.productRatingBone} />
          <ShimmerBone style={styles.productSoldBone} />
        </View>
        <ShimmerBone style={styles.productShippingBone} />
      </View>
    </View>
  );
}

/** Order card skeleton matching the Orders tab layout. */
export function OrderCardSkeleton() {
  return (
    <View style={styles.orderCard}>
      <View style={styles.orderCardMain}>
        <ShimmerBone style={styles.orderThumb} />
        <View style={styles.orderCardBody}>
          <View style={styles.orderHeaderRow}>
            <ShimmerBone style={styles.orderDistributorLine} />
            <ShimmerBone style={styles.orderSeeDetailsLine} />
          </View>
          <ShimmerBone style={styles.orderDateLine} />
          <ShimmerBone style={styles.orderProductsLine} />
          <ShimmerBone style={styles.orderProductsLineShort} />
          <ShimmerBone style={styles.orderStatusPill} />
        </View>
      </View>
      <View style={styles.orderCardFooter}>
        <ShimmerBone style={styles.orderSummaryLine} />
        <ShimmerBone style={styles.reorderButton} />
      </View>
    </View>
  );
}

/** Full orders tab initial loading state. */
export function OrdersListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <SkeletonTree>
      <View style={styles.ordersList}>
        {Array.from({ length: count }, (_, i) => (
          <OrderCardSkeleton key={i} />
        ))}
      </View>
    </SkeletonTree>
  );
}

/** Order notifications full list skeleton. */
export function OrderNotificationsListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <SkeletonTree>
      <View style={styles.orderNotificationsBox}>
        {Array.from({ length: count }, (_, i) => (
          <OrderUpdateRowSkeleton key={i} />
        ))}
      </View>
    </SkeletonTree>
  );
}

/** My Purchases order card skeleton. */
export function MyPurchaseOrderCardSkeleton() {
  return (
    <View style={styles.myPurchaseCard}>
      <View style={styles.myPurchaseSellerRow}>
        <ShimmerBone style={styles.myPurchaseSellerName} />
        <ShimmerBone style={styles.myPurchaseStatus} />
      </View>
      <View style={styles.myPurchaseProductRow}>
        <ShimmerBone style={styles.myPurchaseThumb} />
        <View style={styles.myPurchaseProductCol}>
          <ShimmerBone style={styles.myPurchaseProductTitle} />
          <ShimmerBone style={styles.myPurchaseProductVariant} />
          <ShimmerBone style={styles.myPurchaseProductQty} />
          <ShimmerBone style={styles.myPurchaseProductPrice} />
        </View>
      </View>
      <ShimmerBone style={styles.myPurchaseSummary} />
      <View style={styles.myPurchaseActions}>
        <ShimmerBone style={styles.myPurchaseActionBtn} />
        <ShimmerBone style={styles.myPurchaseActionBtn} />
      </View>
    </View>
  );
}

export function MyPurchasesListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <SkeletonTree>
      <View style={styles.myPurchasesList}>
        {Array.from({ length: count }, (_, i) => (
          <MyPurchaseOrderCardSkeleton key={i} />
        ))}
      </View>
    </SkeletonTree>
  );
}

function OrderFlowCardSkeleton({
  titleWidth = 160,
  rows = 3,
  tallRows = false,
}: {
  titleWidth?: number;
  rows?: number;
  tallRows?: boolean;
}) {
  return (
    <View style={styles.orderFlowSection}>
      <View style={styles.orderFlowCard}>
        <ShimmerBone style={[styles.orderFlowSectionTitle, { width: titleWidth }]} />
        {Array.from({ length: rows }, (_, i) => (
          <View key={i} style={styles.orderFlowInfoRow}>
            <ShimmerBone style={styles.orderFlowLabel} />
            <ShimmerBone style={[styles.orderFlowValue, tallRows && i === 1 && styles.orderFlowValueTall]} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** Order details screen skeleton. */
export function OrderDetailsSkeleton() {
  return (
    <SkeletonTree>
      <View style={styles.orderFlowPage}>
      <OrderFlowCardSkeleton titleWidth={180} rows={4} />
      <OrderFlowCardSkeleton titleWidth={150} rows={3} />
      <View style={styles.orderFlowSection}>
        <View style={styles.orderFlowCard}>
          <ShimmerBone style={[styles.orderFlowSectionTitle, { width: 170 }]} />
          <View style={styles.orderFlowProductRow}>
            <ShimmerBone style={styles.orderFlowProductThumb} />
            <View style={styles.orderFlowProductCol}>
              <ShimmerBone style={styles.orderFlowProductTitle} />
              <ShimmerBone style={styles.orderFlowProductMeta} />
              <ShimmerBone style={styles.orderFlowProductPrice} />
            </View>
          </View>
        </View>
      </View>
      <OrderFlowCardSkeleton titleWidth={120} rows={2} />
      <OrderFlowCardSkeleton titleWidth={140} rows={2} />
      </View>
    </SkeletonTree>
  );
}

/** Pay order screen skeleton. */
export function PayOrderSkeleton() {
  return (
    <SkeletonTree>
      <View style={styles.orderFlowPage}>
      <OrderFlowCardSkeleton titleWidth={150} rows={3} tallRows />
      <View style={styles.orderFlowSection}>
        <View style={styles.orderFlowCard}>
          <ShimmerBone style={[styles.orderFlowSectionTitle, { width: 140 }]} />
          {Array.from({ length: 4 }, (_, i) => (
            <View key={i} style={styles.orderFlowInfoRow}>
              <ShimmerBone style={styles.orderFlowLabel} />
              <ShimmerBone style={styles.orderFlowValue} />
            </View>
          ))}
          <ShimmerBone style={styles.payProofBlock} />
        </View>
      </View>
      <ShimmerBone style={styles.payBottomButton} />
      </View>
    </SkeletonTree>
  );
}

/** Delivery information screen skeleton. */
export function DeliveryInformationSkeleton() {
  return (
    <SkeletonTree>
      <View style={styles.orderFlowPage}>
      <View style={styles.orderFlowSection}>
        <View style={styles.orderFlowCard}>
          <ShimmerBone style={[styles.orderFlowSectionTitle, { width: 200 }]} />
          <View style={styles.deliveryProgressRow}>
            {Array.from({ length: 4 }, (_, i) => (
              <View key={i} style={styles.deliveryProgressStep}>
                <ShimmerBone style={styles.deliveryProgressDot} />
                <ShimmerBone style={styles.deliveryProgressLabel} />
              </View>
            ))}
          </View>
        </View>
      </View>
      <OrderFlowCardSkeleton titleWidth={160} rows={4} tallRows />
      <View style={styles.orderFlowSection}>
        <View style={styles.orderFlowCard}>
          <ShimmerBone style={[styles.orderFlowSectionTitle, { width: 130 }]} />
          {Array.from({ length: 3 }, (_, i) => (
            <View key={i} style={styles.deliveryTimelineRow}>
              <View style={styles.deliveryTimelineLeft}>
                <ShimmerBone style={styles.deliveryTimelineDate} />
                <ShimmerBone style={styles.deliveryTimelineTime} />
              </View>
              <View style={styles.deliveryTimelineRight}>
                <ShimmerBone style={styles.deliveryTimelineDot} />
                <ShimmerBone style={styles.deliveryTimelineStatus} />
              </View>
            </View>
          ))}
        </View>
      </View>
      </View>
    </SkeletonTree>
  );
}

const OFFER_BANNER_HEIGHT = 180;

/** Product detail (full view) skeleton. */
export function ProductDetailSkeleton() {
  return (
    <SkeletonTree>
      <View style={styles.productDetailPage}>
      <ShimmerBone style={styles.productDetailImage} />
      <View style={styles.productDetailBody}>
        <ShimmerBone style={styles.productDetailTitle} />
        <ShimmerBone style={styles.productDetailTitleShort} />
        <View style={styles.productDetailPriceRow}>
          <ShimmerBone style={styles.productDetailPrice} />
          <ShimmerBone style={styles.productDetailPriceOld} />
        </View>
        <ShimmerBone style={styles.productDetailSectionTitle} />
        <ShimmerBone style={styles.productDetailLine} />
        <ShimmerBone style={styles.productDetailLine} />
        <ShimmerBone style={styles.productDetailLineShort} />
        <ShimmerBone style={styles.productDetailSectionTitle} />
        <ShimmerBone style={styles.productDetailLine} />
        <ShimmerBone style={styles.productDetailLineShort} />
      </View>
      <View style={styles.productDetailActions}>
        <ShimmerBone style={styles.productDetailActionBtn} />
        <ShimmerBone style={styles.productDetailActionBtn} />
        <ShimmerBone style={styles.productDetailActionBtnWide} />
      </View>
      </View>
    </SkeletonTree>
  );
}

/** Latest update / article detail skeleton. */
export function ArticleDetailSkeleton() {
  return (
    <SkeletonTree>
      <View style={styles.articleDetailPage}>
      <View style={styles.articleDetailCard}>
        <ShimmerBone style={styles.articleTitle} />
        <ShimmerBone style={styles.articleMeta} />
        <ShimmerBone style={styles.articlePill} />
        <ShimmerBone style={styles.articleBodyLine} />
        <ShimmerBone style={styles.articleBodyLine} />
        <ShimmerBone style={styles.articleBodyLine} />
        <ShimmerBone style={styles.articleBodyLineShort} />
        <ShimmerBone style={styles.articleHero} />
        <ShimmerBone style={styles.articleLinkBtn} />
      </View>
      </View>
    </SkeletonTree>
  );
}

/** Special offers list skeleton. */
export function OffersListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <SkeletonTree>
      <View style={styles.offersListPage}>
      <ShimmerBone style={styles.offersIntro} />
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.offerBannerWrap}>
          <ShimmerBone style={styles.offerBannerBone} />
        </View>
      ))}
      </View>
    </SkeletonTree>
  );
}

/** Single offer detail skeleton. */
export function OfferDetailSkeleton() {
  return (
    <SkeletonTree>
      <View style={styles.offerDetailPage}>
      <View style={styles.offerDetailCard}>
        <ShimmerBone style={styles.offerDetailHero} />
        <View style={styles.offerDetailInfo}>
          <ShimmerBone style={styles.offerDetailTitle} />
          <ShimmerBone style={styles.offerDetailSub} />
          <View style={styles.offerDetailMetaRow}>
            <ShimmerBone style={styles.offerDetailPill} />
            <ShimmerBone style={styles.offerDetailDate} />
          </View>
        </View>
        <View style={styles.offerDetailBody}>
          <ShimmerBone style={styles.offerDetailBodyLine} />
          <ShimmerBone style={styles.offerDetailBodyLine} />
          <ShimmerBone style={styles.offerDetailBodyLineShort} />
        </View>
      </View>
      </View>
    </SkeletonTree>
  );
}

/** Distributor network card skeleton (My Networks list). */
export function DistributorCardSkeleton() {
  return (
    <View style={styles.distributorCard}>
      <ShimmerBone style={styles.distributorCardBanner} />
      <View style={styles.distributorCardRow}>
        <ShimmerBone style={styles.distributorCardAvatar} />
        <View style={styles.distributorCardInfo}>
          <ShimmerBone style={styles.distributorCardName} />
          <ShimmerBone style={styles.distributorCardAddress} />
          <ShimmerBone style={styles.distributorCardOrders} />
        </View>
      </View>
    </View>
  );
}

export function MyNetworksListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <SkeletonTree>
      <View style={styles.myNetworksList}>
        {Array.from({ length: count }, (_, i) => (
          <DistributorCardSkeleton key={i} />
        ))}
      </View>
    </SkeletonTree>
  );
}

/** Distributor detail page skeleton. */
export function DistributorDetailSkeleton() {
  return (
    <SkeletonTree>
      <View style={styles.distributorDetailPage}>
      <ShimmerBone style={styles.distributorDetailBanner} />
      <View style={styles.distributorDetailInfoCard}>
        <View style={styles.distributorDetailTopRow}>
          <ShimmerBone style={styles.distributorDetailAvatar} />
          <View style={styles.distributorDetailTitleCol}>
            <ShimmerBone style={styles.distributorDetailName} />
            <ShimmerBone style={styles.distributorDetailRating} />
          </View>
        </View>
        <ShimmerBone style={styles.distributorDetailContactLine} />
        <ShimmerBone style={styles.distributorDetailContactLine} />
        <ShimmerBone style={styles.distributorDetailContactLineShort} />
      </View>
      <View style={styles.distributorDetailHistory}>
        <ShimmerBone style={styles.distributorDetailHistoryTitle} />
        <ShimmerBone style={styles.distributorDetailOrderCard} />
        <ShimmerBone style={styles.distributorDetailOrderCard} />
      </View>
      <ShimmerBone style={styles.distributorDetailCta} />
      </View>
    </SkeletonTree>
  );
}

/** Messages conversation row skeleton. */
export function MessageRowSkeleton() {
  return (
    <View style={styles.messageRow}>
      <ShimmerBone style={styles.messageAvatar} />
      <View style={styles.messageTextCol}>
        <ShimmerBone style={styles.messageTitle} />
        <ShimmerBone style={styles.messageSub} />
      </View>
      <ShimmerBone style={styles.messageChevron} />
    </View>
  );
}

export function MessagesListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <SkeletonTree>
      <View style={styles.messagesList}>
        {Array.from({ length: count }, (_, i) => (
          <MessageRowSkeleton key={i} />
        ))}
      </View>
    </SkeletonTree>
  );
}

function ReviewCardRowSkeleton() {
  return (
    <View style={styles.reviewCardRow}>
      <ShimmerBone style={styles.reviewCardAvatar} />
      <View style={styles.reviewCardBody}>
        <ShimmerBone style={styles.reviewCardName} />
        <ShimmerBone style={styles.reviewCardStars} />
        <ShimmerBone style={styles.reviewCardComment} />
        <ShimmerBone style={styles.reviewCardCommentShort} />
      </View>
    </View>
  );
}

/** Product detail inline reviews block skeleton. */
export function ProductReviewsInlineSkeleton() {
  return (
    <SkeletonTree>
      <View style={styles.productReviewsInline}>
      <View style={styles.productReviewsBreakdown}>
        <View style={styles.productReviewsOverallCol}>
          <ShimmerBone style={styles.productReviewsOverallNum} />
          <ShimmerBone style={styles.productReviewsOverallStars} />
          <ShimmerBone style={styles.productReviewsOverallCount} />
        </View>
        <View style={styles.productReviewsBarsCol}>
          {Array.from({ length: 5 }, (_, i) => (
            <View key={i} style={styles.productReviewsBarRow}>
              <ShimmerBone style={styles.productReviewsBarLabel} />
              <ShimmerBone style={styles.productReviewsBarTrack} />
            </View>
          ))}
        </View>
      </View>
      <ReviewCardRowSkeleton />
      <ReviewCardRowSkeleton />
      </View>
    </SkeletonTree>
  );
}

/** Full product reviews list page skeleton. */
export function ProductReviewsListSkeleton({ reviewCount = 3 }: { reviewCount?: number }) {
  return (
    <SkeletonTree>
      <View style={styles.productReviewsListPage}>
      <View style={styles.productReviewsSummaryCard}>
        <ShimmerBone style={styles.productReviewsSummaryTitle} />
        <View style={styles.productReviewsSummaryOverall}>
          <ShimmerBone style={styles.productReviewsSummaryNum} />
          <View style={styles.productReviewsSummaryRight}>
            <ShimmerBone style={styles.productReviewsSummaryStars} />
            <ShimmerBone style={styles.productReviewsSummaryCount} />
          </View>
        </View>
        {Array.from({ length: 5 }, (_, i) => (
          <View key={i} style={styles.productReviewsSummaryBarRow}>
            <ShimmerBone style={styles.productReviewsBarLabel} />
            <ShimmerBone style={styles.productReviewsBarTrack} />
            <ShimmerBone style={styles.productReviewsBarCount} />
          </View>
        ))}
      </View>
      <View style={styles.productReviewsLatestHeader}>
        <ShimmerBone style={styles.productReviewsLatestTitle} />
      </View>
      {Array.from({ length: reviewCount }, (_, i) => (
        <View key={i} style={styles.productReviewsListRow}>
          <ReviewCardRowSkeleton />
        </View>
      ))}
      </View>
    </SkeletonTree>
  );
}

/** Seller / distributor information page skeleton. */
export function SellerInformationSkeleton() {
  return (
    <SkeletonTree>
      <View style={styles.sellerInfoPage}>
      <View style={styles.sellerInfoSection}>
        <View style={styles.sellerInfoSectionHeader}>
          <ShimmerBone style={styles.sellerInfoSectionIcon} />
          <ShimmerBone style={styles.sellerInfoSectionTitle} />
        </View>
        <ShimmerBone style={styles.sellerInfoLogo} />
        <ShimmerBone style={styles.sellerInfoBanner} />
        <ShimmerBone style={styles.sellerInfoFieldLabel} />
        <ShimmerBone style={styles.sellerInfoFieldValue} />
        <ShimmerBone style={styles.sellerInfoFieldLabel} />
        <ShimmerBone style={styles.sellerInfoFieldValue} />
        <ShimmerBone style={styles.sellerInfoFieldLabel} />
        <ShimmerBone style={styles.sellerInfoFieldValueShort} />
      </View>
      <View style={styles.sellerInfoSection}>
        <View style={styles.sellerInfoSectionHeader}>
          <ShimmerBone style={styles.sellerInfoSectionIcon} />
          <ShimmerBone style={styles.sellerInfoSectionTitle} />
        </View>
        <ShimmerBone style={styles.sellerInfoSubLabel} />
        {Array.from({ length: 3 }, (_, i) => (
          <View key={i} style={styles.sellerInfoCheckRow}>
            <ShimmerBone style={styles.sellerInfoCheckBox} />
            <ShimmerBone style={styles.sellerInfoCheckLabel} />
          </View>
        ))}
      </View>
      <View style={styles.sellerInfoSection}>
        <View style={styles.sellerInfoSectionHeader}>
          <ShimmerBone style={styles.sellerInfoSectionIcon} />
          <ShimmerBone style={styles.sellerInfoSectionTitle} />
        </View>
        <View style={styles.sellerInfoRatingRow}>
          <ShimmerBone style={styles.sellerInfoRatingNum} />
          <ShimmerBone style={styles.sellerInfoRatingMeta} />
        </View>
        <ShimmerBone style={styles.sellerInfoReviewCard} />
        <ShimmerBone style={styles.sellerInfoReviewCard} />
      </View>
      </View>
    </SkeletonTree>
  );
}

/** Small icon placeholder for modal photo-upload buttons. */
export function ShimmerIcon({ size = 22 }: { size?: number }) {
  return (
    <SkeletonTree>
      <ShimmerBone style={{ width: size, height: size, borderRadius: Math.round(size / 2) }} />
    </SkeletonTree>
  );
}

/** Map / geocode loading overlay. */
export function MapShimmerOverlay() {
  return (
    <SkeletonTree>
      <View style={styles.mapShimmerOverlay} pointerEvents="none">
        <ShimmerBone style={styles.mapShimmerFill} />
      </View>
    </SkeletonTree>
  );
}

/** Invoice preview loading placeholder. */
export function InvoicePreviewSkeleton() {
  return (
    <SkeletonTree>
      <View style={styles.invoicePreviewSkeleton}>
      <ShimmerBone style={styles.invoicePreviewLine} />
      <ShimmerBone style={styles.invoicePreviewLine} />
      <ShimmerBone style={styles.invoicePreviewLineShort} />
      <ShimmerBone style={styles.invoicePreviewBlock} />
      <ShimmerBone style={styles.invoicePreviewLine} />
      <ShimmerBone style={styles.invoicePreviewLineShort} />
      </View>
    </SkeletonTree>
  );
}

/** Recent search rows skeleton (header/title rendered by RecentSearches). */
export function RecentSearchesSkeleton({ count = 4 }: { count?: number }) {
  return (
    <SkeletonTree>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.recentSearchRow}>
          <ShimmerBone style={styles.recentSearchIcon} />
          <ShimmerBone style={styles.recentSearchText} />
          <ShimmerBone style={styles.recentSearchRemove} />
        </View>
      ))}
    </SkeletonTree>
  );
}

/** Edit profile screen skeleton. */
export function EditProfileSkeleton() {
  return (
    <SkeletonTree>
      <View style={styles.editProfilePage}>
      <ShimmerBone style={styles.editProfileBanner} />
      <View style={styles.editProfileAvatarWrap}>
        <ShimmerBone style={styles.editProfileAvatar} />
      </View>
      {Array.from({ length: 8 }, (_, i) => (
        <View key={i} style={styles.editProfileRow}>
          <View style={styles.editProfileRowText}>
            <ShimmerBone style={styles.editProfileRowTitle} />
            <ShimmerBone style={styles.editProfileRowValue} />
          </View>
          <ShimmerBone style={styles.editProfileChevron} />
        </View>
      ))}
      </View>
    </SkeletonTree>
  );
}

function CheckoutSectionSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <View style={styles.checkoutSection}>
      <View style={styles.checkoutCard}>
        <View style={styles.checkoutSectionHeader}>
          <ShimmerBone style={styles.checkoutSectionIcon} />
          <ShimmerBone style={styles.checkoutSectionTitle} />
        </View>
        {Array.from({ length: lines }, (_, i) => (
          <ShimmerBone
            key={i}
            style={[styles.checkoutLine, i === lines - 1 && styles.checkoutLineShort]}
          />
        ))}
      </View>
    </View>
  );
}

/** Checkout screen skeleton. */
export function CheckoutSkeleton() {
  return (
    <SkeletonTree>
      <View style={styles.checkoutPage}>
      <CheckoutSectionSkeleton lines={3} />
      <CheckoutSectionSkeleton lines={4} />
      <View style={styles.checkoutSection}>
        <View style={styles.checkoutCard}>
          <View style={styles.checkoutSectionHeader}>
            <ShimmerBone style={styles.checkoutSectionIcon} />
            <ShimmerBone style={styles.checkoutSectionTitle} />
          </View>
          <View style={styles.checkoutProductRow}>
            <ShimmerBone style={styles.checkoutProductThumb} />
            <View style={styles.checkoutProductCol}>
              <ShimmerBone style={styles.checkoutLine} />
              <ShimmerBone style={styles.checkoutLineShort} />
              <ShimmerBone style={styles.checkoutPriceLine} />
            </View>
          </View>
          <ShimmerBone style={styles.checkoutShippingOption} />
          <ShimmerBone style={styles.checkoutShippingOption} />
        </View>
      </View>
      <CheckoutSectionSkeleton lines={2} />
      <CheckoutSectionSkeleton lines={4} />
      </View>
    </SkeletonTree>
  );
}

/** Order update row skeleton (Notifications tab — order updates section). */
export function OrderUpdateRowSkeleton() {
  return (
    <View style={styles.orderUpdateRow}>
      <View style={styles.orderUpdateTextCol}>
        <ShimmerBone style={styles.orderUpdateTitle} />
        <ShimmerBone style={styles.orderUpdateMessage} />
        <ShimmerBone style={styles.orderUpdateTime} />
      </View>
      <ShimmerBone style={styles.orderUpdateThumb} />
    </View>
  );
}

/** Full Notifications tab skeleton (Foodpanda-style reload). */
export function NotificationsTabSkeleton() {
  return (
    <SkeletonTree>
      <View style={styles.notificationsTab}>
      <View style={styles.notifSectionWrap}>
        <View style={styles.notifSectionHeader}>
          <ShimmerBone style={styles.sectionTitleBone} />
          <ShimmerBone style={styles.sectionActionBone} />
        </View>
        <View style={styles.orderUpdatesBox}>
          <OrderUpdateRowSkeleton />
          <OrderUpdateRowSkeleton />
          <OrderUpdateRowSkeleton />
        </View>
      </View>

      <View style={[styles.notifSectionWrap, styles.notifSectionGap]}>
        <View style={styles.notifSectionHeader}>
          <ShimmerBone style={styles.sectionTitleBone} />
          <ShimmerBone style={styles.sectionActionBone} />
        </View>
        <LatestUpdateTabsSkeleton />
        <LatestUpdatesListSkeleton rowCount={4} />
      </View>
      </View>
    </SkeletonTree>
  );
}

/** Account tab profile header skeleton (optional, for future use). */
export function AccountProfileSkeleton() {
  return (
    <View style={styles.accountProfileSection}>
      <UserInfoSkeleton />
    </View>
  );
}

/** Latest update row skeleton (Notifications tab). */
export function LatestUpdateRowSkeleton({ showThumb = false }: { showThumb?: boolean }) {
  return (
    <View style={styles.latestRow}>
      <ShimmerBone style={styles.latestIcon} />
      <View style={styles.latestTextCol}>
        <ShimmerBone style={styles.latestTitleLine} />
        <ShimmerBone style={styles.latestTimeLine} />
      </View>
      {showThumb ? <ShimmerBone style={styles.latestThumb} /> : null}
    </View>
  );
}

/** Category filter tabs skeleton above latest updates list. */
export function LatestUpdateTabsSkeleton() {
  return (
    <View style={styles.tabRow}>
      {Array.from({ length: 5 }, (_, i) => (
        <View key={i} style={styles.tabItem}>
          <ShimmerBone style={styles.tabIcon} />
          <ShimmerBone style={styles.tabLabel} />
        </View>
      ))}
    </View>
  );
}

/** Latest updates list rows only (tabs stay visible in the screen). */
export function LatestUpdatesListSkeleton({ rowCount = 4 }: { rowCount?: number }) {
  return (
    <View style={styles.latestLoadingBlock}>
      {Array.from({ length: rowCount }, (_, i) => (
        <LatestUpdateRowSkeleton key={i} showThumb={i % 2 === 0} />
      ))}
    </View>
  );
}

/** Full latest updates block including tab placeholders. */
export function LatestUpdatesLoadingSkeleton({ rowCount = 4 }: { rowCount?: number }) {
  return (
    <View style={styles.latestLoadingBlock}>
      <LatestUpdateTabsSkeleton />
      <LatestUpdatesListSkeleton rowCount={rowCount} />
    </View>
  );
}

export const UserInfoSkeleton = () => (
  <View style={styles.userSkeleton}>
    <ShimmerBone style={styles.avatarSkeleton} />
    <View style={styles.userInfoCol}>
      <ShimmerBone style={styles.nameSkeleton} />
      <ShimmerBone style={styles.emailSkeleton} />
    </View>
  </View>
);

export const SkeletonLoader = ({ children, style }: { children: React.ReactNode; style?: object }) => (
  <View style={[styles.container, style]}>{children}</View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f3f4f6',
  },
  bone: {
    backgroundColor: SKELETON_BASE,
    overflow: 'hidden',
    borderRadius: 4,
  },
  shimmerLayer: {
    ...StyleSheet.absoluteFillObject,
    width: '200%',
  },
  shimmerGradient: {
    flex: 1,
    width: '100%',
  },
  productGrid: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    gap: 14,
    backgroundColor: '#f9fafb',
  },
  productColumn: {
    flex: 1,
  },
  productItem: {
    marginBottom: 4,
  },
  productSkeleton: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 6,
    overflow: 'hidden',
  },
  productImageSkeleton: {
    width: '100%',
    height: 140,
    borderRadius: 0,
  },
  productContentSkeleton: {
    padding: 8,
    gap: 4,
  },
  productTitleSkeleton: {
    height: 14,
    width: '95%',
  },
  productTitleSkeletonShort: {
    height: 14,
    width: '68%',
  },
  productPriceSkeleton: {
    height: 16,
    width: '55%',
    marginTop: 2,
  },
  productMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  productRatingBone: {
    height: 22,
    width: 52,
    borderRadius: 4,
  },
  productSoldBone: {
    height: 12,
    flex: 1,
    maxWidth: 72,
  },
  productShippingBone: {
    height: 12,
    width: '88%',
    marginTop: 2,
  },
  ordersList: {
    paddingBottom: 16,
  },
  orderCard: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  orderCardMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  orderThumb: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 14,
    marginTop: 2,
  },
  orderCardBody: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  orderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  orderDistributorLine: {
    flex: 1,
    height: 16,
  },
  orderSeeDetailsLine: {
    width: 72,
    height: 14,
  },
  orderDateLine: {
    height: 12,
    width: '75%',
  },
  orderProductsLine: {
    height: 13,
    width: '100%',
  },
  orderProductsLineShort: {
    height: 13,
    width: '65%',
  },
  orderStatusPill: {
    height: 24,
    width: 88,
    borderRadius: 999,
    marginTop: 2,
  },
  orderCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    gap: 12,
  },
  orderSummaryLine: {
    flex: 1,
    height: 14,
  },
  reorderButton: {
    width: 96,
    height: 34,
    borderRadius: 8,
  },
  latestLoadingBlock: {
    paddingBottom: 8,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 15,
    paddingBottom: 12,
    gap: 12,
  },
  tabItem: {
    alignItems: 'center',
    minWidth: 56,
    gap: 6,
  },
  tabIcon: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  tabLabel: {
    width: 44,
    height: 10,
    borderRadius: 4,
  },
  latestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
    backgroundColor: '#ffffff',
  },
  latestIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  latestTextCol: {
    flex: 1,
    gap: 6,
  },
  latestTitleLine: {
    height: 15,
    width: '85%',
  },
  latestTimeLine: {
    height: 12,
    width: '45%',
  },
  latestThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  userSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginBottom: 8,
  },
  avatarSkeleton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userInfoCol: {
    flex: 1,
    gap: 6,
  },
  nameSkeleton: {
    height: 16,
    width: '70%',
  },
  emailSkeleton: {
    height: 12,
    width: '50%',
  },
  notificationsTab: {
    paddingBottom: 24,
  },
  notifSectionWrap: {
    backgroundColor: '#ffffff',
  },
  notifSectionGap: {
    marginTop: 8,
  },
  notifSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  sectionTitleBone: {
    height: 16,
    width: 120,
  },
  sectionActionBone: {
    height: 14,
    width: 64,
  },
  orderUpdatesBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#ffffff',
  },
  orderUpdateRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
    backgroundColor: '#ffffff',
  },
  orderUpdateTextCol: {
    flex: 1,
    gap: 6,
  },
  orderUpdateTitle: {
    height: 16,
    width: '75%',
  },
  orderUpdateMessage: {
    height: 14,
    width: '90%',
  },
  orderUpdateTime: {
    height: 12,
    width: '40%',
  },
  orderUpdateThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  accountProfileSection: {
    backgroundColor: '#ffffff',
    padding: 26,
    marginBottom: 10,
  },
  orderNotificationsBox: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 12,
  },
  myPurchasesList: {
    paddingVertical: 8,
  },
  myPurchaseCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 10,
    marginVertical: 5,
    borderRadius: 12,
    padding: 16,
  },
  myPurchaseSellerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  myPurchaseSellerName: {
    height: 14,
    width: '45%',
  },
  myPurchaseStatus: {
    height: 14,
    width: 72,
  },
  myPurchaseProductRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  myPurchaseThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  myPurchaseProductCol: {
    flex: 1,
    gap: 6,
  },
  myPurchaseProductTitle: {
    height: 14,
    width: '90%',
  },
  myPurchaseProductVariant: {
    height: 12,
    width: '70%',
  },
  myPurchaseProductQty: {
    height: 12,
    width: 40,
  },
  myPurchaseProductPrice: {
    height: 16,
    width: 88,
  },
  myPurchaseSummary: {
    height: 14,
    width: '75%',
    marginBottom: 12,
  },
  myPurchaseActions: {
    flexDirection: 'row',
    gap: 8,
  },
  myPurchaseActionBtn: {
    flex: 1,
    height: 36,
    borderRadius: 8,
  },
  orderFlowPage: {
    paddingBottom: 24,
    backgroundColor: '#F5F5F5',
  },
  orderFlowSection: {
    marginTop: 8,
    paddingHorizontal: 8,
  },
  orderFlowCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
  },
  orderFlowSectionTitle: {
    height: 18,
    marginBottom: 14,
  },
  orderFlowInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 12,
  },
  orderFlowLabel: {
    height: 14,
    width: 88,
  },
  orderFlowValue: {
    flex: 1,
    height: 14,
    maxWidth: '62%',
  },
  orderFlowValueTall: {
    height: 36,
  },
  orderFlowProductRow: {
    flexDirection: 'row',
    gap: 12,
  },
  orderFlowProductThumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
  },
  orderFlowProductCol: {
    flex: 1,
    gap: 6,
  },
  orderFlowProductTitle: {
    height: 14,
    width: '85%',
  },
  orderFlowProductMeta: {
    height: 12,
    width: '60%',
  },
  orderFlowProductPrice: {
    height: 16,
    width: 80,
  },
  payProofBlock: {
    height: 120,
    borderRadius: 8,
    marginTop: 12,
  },
  payBottomButton: {
    height: 48,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 8,
  },
  deliveryProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  deliveryProgressStep: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  deliveryProgressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  deliveryProgressLabel: {
    height: 10,
    width: 48,
  },
  deliveryTimelineRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  deliveryTimelineLeft: {
    width: 72,
    gap: 4,
  },
  deliveryTimelineDate: {
    height: 12,
    width: '100%',
  },
  deliveryTimelineTime: {
    height: 10,
    width: '70%',
  },
  deliveryTimelineRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deliveryTimelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  deliveryTimelineStatus: {
    flex: 1,
    height: 14,
  },
  productDetailPage: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  productDetailImage: {
    width: '100%',
    height: 340,
  },
  productDetailBody: {
    padding: 16,
    gap: 10,
  },
  productDetailTitle: {
    height: 20,
    width: '92%',
  },
  productDetailTitleShort: {
    height: 20,
    width: '65%',
  },
  productDetailPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  productDetailPrice: {
    height: 28,
    width: 120,
  },
  productDetailPriceOld: {
    height: 16,
    width: 72,
  },
  productDetailSectionTitle: {
    height: 16,
    width: 100,
    marginTop: 8,
  },
  productDetailLine: {
    height: 14,
    width: '100%',
  },
  productDetailLineShort: {
    height: 14,
    width: '72%',
  },
  productDetailActions: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: '#ffffff',
  },
  productDetailActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  productDetailActionBtnWide: {
    flex: 1,
    height: 44,
    borderRadius: 8,
  },
  articleDetailPage: {
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 56,
  },
  articleDetailCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    paddingBottom: 28,
    gap: 10,
  },
  articleTitle: {
    height: 24,
    width: '90%',
  },
  articleMeta: {
    height: 14,
    width: 160,
  },
  articlePill: {
    height: 28,
    width: 88,
    borderRadius: 8,
    marginBottom: 6,
  },
  articleBodyLine: {
    height: 14,
    width: '100%',
  },
  articleBodyLineShort: {
    height: 14,
    width: '78%',
  },
  articleHero: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    marginTop: 6,
  },
  articleLinkBtn: {
    height: 48,
    borderRadius: 12,
    marginTop: 6,
  },
  offersListPage: {
    paddingTop: 8,
    paddingBottom: 32,
  },
  offersIntro: {
    height: 14,
    width: '70%',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  offerBannerWrap: {
    marginBottom: 4,
  },
  offerBannerBone: {
    height: OFFER_BANNER_HEIGHT,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
  },
  offerDetailPage: {
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 56,
  },
  offerDetailCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  offerDetailHero: {
    width: '100%',
    height: OFFER_BANNER_HEIGHT,
  },
  offerDetailInfo: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 8,
  },
  offerDetailTitle: {
    height: 24,
    width: '85%',
  },
  offerDetailSub: {
    height: 16,
    width: '70%',
  },
  offerDetailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  offerDetailPill: {
    height: 28,
    width: 72,
    borderRadius: 8,
  },
  offerDetailDate: {
    height: 14,
    width: 100,
  },
  offerDetailBody: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 10,
  },
  offerDetailBodyLine: {
    height: 14,
    width: '100%',
  },
  offerDetailBodyLineShort: {
    height: 14,
    width: '65%',
  },
  distributorCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  distributorCardBanner: {
    width: '100%',
    height: 80,
  },
  distributorCardRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    marginTop: -24,
  },
  distributorCardAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  distributorCardInfo: {
    flex: 1,
    paddingTop: 28,
    gap: 6,
  },
  distributorCardName: {
    height: 16,
    width: '70%',
  },
  distributorCardAddress: {
    height: 12,
    width: '90%',
  },
  distributorCardOrders: {
    height: 12,
    width: 100,
  },
  myNetworksList: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  distributorDetailPage: {
    flex: 1,
    backgroundColor: '#f9fafb',
    paddingBottom: 24,
  },
  distributorDetailBanner: {
    width: '100%',
    height: 140,
  },
  distributorDetailInfoCard: {
    marginHorizontal: 16,
    marginTop: -32,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  distributorDetailTopRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  distributorDetailAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  distributorDetailTitleCol: {
    flex: 1,
    gap: 6,
  },
  distributorDetailName: {
    height: 18,
    width: '75%',
  },
  distributorDetailRating: {
    height: 14,
    width: 100,
  },
  distributorDetailContactLine: {
    height: 14,
    width: '90%',
  },
  distributorDetailContactLineShort: {
    height: 14,
    width: '55%',
  },
  distributorDetailHistory: {
    marginHorizontal: 16,
    marginTop: 16,
    gap: 10,
  },
  distributorDetailHistoryTitle: {
    height: 18,
    width: 140,
    marginBottom: 4,
  },
  distributorDetailOrderCard: {
    height: 88,
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  distributorDetailCta: {
    height: 48,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
  },
  messagesList: {
    paddingHorizontal: 16,
    gap: 10,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  messageAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  messageTextCol: {
    flex: 1,
    gap: 6,
  },
  messageTitle: {
    height: 14,
    width: '60%',
  },
  messageSub: {
    height: 12,
    width: '45%',
  },
  messageChevron: {
    width: 18,
    height: 18,
    borderRadius: 4,
  },
  reviewCardRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
  },
  reviewCardAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  reviewCardBody: {
    flex: 1,
    gap: 6,
  },
  reviewCardName: {
    height: 12,
    width: '45%',
  },
  reviewCardStars: {
    height: 12,
    width: 72,
  },
  reviewCardComment: {
    height: 12,
    width: '95%',
  },
  reviewCardCommentShort: {
    height: 12,
    width: '70%',
  },
  productReviewsInline: {
    gap: 0,
  },
  productReviewsBreakdown: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  productReviewsOverallCol: {
    alignItems: 'center',
    gap: 6,
    width: 72,
  },
  productReviewsOverallNum: {
    height: 28,
    width: 48,
  },
  productReviewsOverallStars: {
    height: 14,
    width: 72,
  },
  productReviewsOverallCount: {
    height: 12,
    width: 56,
  },
  productReviewsBarsCol: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
  },
  productReviewsBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  productReviewsBarLabel: {
    height: 10,
    width: 24,
  },
  productReviewsBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
  },
  productReviewsBarCount: {
    height: 10,
    width: 24,
  },
  productReviewsListPage: {
    paddingHorizontal: 8,
    paddingTop: 16,
    paddingBottom: 24,
  },
  productReviewsSummaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    gap: 10,
  },
  productReviewsSummaryTitle: {
    height: 14,
    width: 120,
  },
  productReviewsSummaryOverall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  productReviewsSummaryNum: {
    height: 36,
    width: 56,
  },
  productReviewsSummaryRight: {
    gap: 6,
  },
  productReviewsSummaryStars: {
    height: 14,
    width: 80,
  },
  productReviewsSummaryCount: {
    height: 12,
    width: 72,
  },
  productReviewsSummaryBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  productReviewsLatestHeader: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  productReviewsLatestTitle: {
    height: 14,
    width: 100,
  },
  productReviewsListRow: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  sellerInfoPage: {
    backgroundColor: '#ffffff',
  },
  sellerInfoSection: {
    padding: 20,
    backgroundColor: '#ffffff',
    gap: 10,
  },
  sellerInfoSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sellerInfoSectionIcon: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  sellerInfoSectionTitle: {
    height: 18,
    width: 180,
  },
  sellerInfoLogo: {
    width: 120,
    height: 120,
    borderRadius: 8,
    alignSelf: 'center',
    marginBottom: 6,
  },
  sellerInfoBanner: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    marginBottom: 6,
  },
  sellerInfoFieldLabel: {
    height: 12,
    width: 140,
  },
  sellerInfoFieldValue: {
    height: 16,
    width: '85%',
  },
  sellerInfoFieldValueShort: {
    height: 16,
    width: '55%',
  },
  sellerInfoSubLabel: {
    height: 14,
    width: 160,
    marginBottom: 4,
  },
  sellerInfoCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  sellerInfoCheckBox: {
    width: 18,
    height: 18,
    borderRadius: 2,
  },
  sellerInfoCheckLabel: {
    height: 14,
    flex: 1,
    maxWidth: '75%',
  },
  sellerInfoRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sellerInfoRatingNum: {
    height: 24,
    width: 36,
  },
  sellerInfoRatingMeta: {
    height: 14,
    width: 100,
  },
  sellerInfoReviewCard: {
    height: 96,
    borderRadius: 12,
    marginBottom: 8,
  },
  mapShimmerOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
  },
  mapShimmerFill: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
  },
  invoicePreviewSkeleton: {
    flex: 1,
    padding: 24,
    gap: 12,
    backgroundColor: '#ffffff',
  },
  invoicePreviewLine: {
    height: 14,
    width: '92%',
  },
  invoicePreviewLineShort: {
    height: 14,
    width: '58%',
  },
  invoicePreviewBlock: {
    height: 120,
    width: '100%',
    borderRadius: 8,
    marginVertical: 8,
  },
  recentSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  recentSearchIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  recentSearchText: {
    flex: 1,
    height: 14,
  },
  recentSearchRemove: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  editProfilePage: {
    backgroundColor: '#ffffff',
  },
  editProfileBanner: {
    width: '100%',
    height: 160,
    borderRadius: 0,
  },
  editProfileAvatarWrap: {
    alignItems: 'center',
    marginTop: -40,
    marginBottom: 24,
  },
  editProfileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  editProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginTop: 0,
  },
  editProfileRowText: {
    flex: 1,
    gap: 6,
  },
  editProfileRowTitle: {
    height: 14,
    width: 100,
  },
  editProfileRowValue: {
    height: 14,
    width: '70%',
  },
  editProfileChevron: {
    width: 18,
    height: 18,
    borderRadius: 4,
  },
  checkoutPage: {
    paddingBottom: 100,
    backgroundColor: '#F5F5F5',
  },
  checkoutSection: {
    marginTop: 8,
    paddingHorizontal: 8,
  },
  checkoutCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
  },
  checkoutSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  checkoutSectionIcon: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  checkoutSectionTitle: {
    height: 16,
    width: 160,
  },
  checkoutLine: {
    height: 14,
    width: '88%',
    marginBottom: 8,
  },
  checkoutLineShort: {
    width: '62%',
  },
  checkoutProductRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 16,
  },
  checkoutProductThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  checkoutProductCol: {
    flex: 1,
    gap: 6,
    paddingTop: 4,
  },
  checkoutPriceLine: {
    height: 16,
    width: 88,
    marginTop: 4,
  },
  checkoutShippingOption: {
    height: 72,
    borderRadius: 12,
    marginBottom: 8,
  },
});

export default function SkeletonLoaderComponent() {
  return null;
}
