import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as FS from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  Text,
  Image,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  useColorScheme,
  Alert,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import ViewShot from 'react-native-view-shot';
import { X, FileDown, Image as ImageIcon, Share2, MoreHorizontal } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  buildOrderInvoiceHtml,
  buildOrderInvoicePlainText,
  buildInvoiceSnapshot,
  getInvoiceLegalFooter,
  type OrderLike,
} from '../../../utils/orderInvoice';

const { width: screenWidth } = Dimensions.get('window');

type Props = {
  visible: boolean;
  onClose: () => void;
  order: OrderLike | null;
};

async function saveToDeviceAndroidSaf(args: { uri: string; filename: string; mimeType: string }) {
  const SAF = (FS as any).StorageAccessFramework as
    | undefined
    | {
        requestDirectoryPermissionsAsync: () => Promise<{ granted: boolean; directoryUri: string }>;
        createFileAsync: (directoryUri: string, filename: string, mimeType: string) => Promise<string>;
      };
  if (!SAF) return null;

  const perm = await SAF.requestDirectoryPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Permission denied. Please allow access to save the file.');
  }
  const destUri = await SAF.createFileAsync(perm.directoryUri, args.filename, args.mimeType);
  const b64 = await FS.readAsStringAsync(args.uri, { encoding: 'base64' as any });
  await FS.writeAsStringAsync(destUri, b64, { encoding: 'base64' as any });
  return destUri;
}

async function ensureNamedCacheFile(args: { srcUri: string; filename: string }): Promise<string> {
  const base = (FS as any).cacheDirectory as string | undefined;
  if (!base) return args.srcUri;
  const safeName = args.filename.replace(/[^\w.\-() ]+/g, '_');
  const dst = `${base}${safeName}`;
  try {
    await FS.deleteAsync(dst, { idempotent: true } as any);
  } catch {
    // ignore
  }
  try {
    await FS.copyAsync({ from: args.srcUri, to: dst });
    return dst;
  } catch {
    return args.srcUri;
  }
}

function InvoiceRasterBody({ order }: { order: OrderLike }) {
  const s = buildInvoiceSnapshot(order);
  return (
    <View style={rasterStyles.sheet} collapsable={false}>
      <View style={rasterStyles.logoWrap}>
        <Image
          source={require('../../../assets/images/LakuMobile.png')}
          style={rasterStyles.logo}
          resizeMode="contain"
        />
      </View>
      <Text style={rasterStyles.brand}>{s.storeName}</Text>
      <Text style={rasterStyles.sub}>Tax invoice / Receipt</Text>
      <Text style={rasterStyles.line}>
        <Text style={rasterStyles.bold}>Order ID</Text> · {s.orderId}
      </Text>
      <Text style={rasterStyles.line}>
        <Text style={rasterStyles.bold}>Date</Text> · {s.issuedAt}
      </Text>
      <Text style={rasterStyles.line}>
        <Text style={rasterStyles.bold}>Status</Text> · {s.orderStatus}
      </Text>
      <Text style={rasterStyles.line}>
        <Text style={rasterStyles.bold}>Payment</Text> · {s.paymentStatus}
      </Text>
      <View style={rasterStyles.box}>
        <Text style={rasterStyles.line}>
          <Text style={rasterStyles.bold}>Bill to</Text> · {s.billToName} · {s.billToPhone}
        </Text>
        <Text style={[rasterStyles.bold, { marginTop: 8 }]}>Ship to</Text>
        <Text style={rasterStyles.ship}>{s.shipTo}</Text>
      </View>
      {s.lines.map((l, i) => (
        <View key={i} style={rasterStyles.item}>
          <View style={rasterStyles.itemTop}>
            <View style={rasterStyles.itemLeft}>
              <Text style={rasterStyles.itemTitle}>{l.title}</Text>
              {l.subtitle ? <Text style={rasterStyles.itemSub}>{l.subtitle}</Text> : null}
              <Text style={rasterStyles.itemQty}>{l.qtyLine}</Text>
            </View>
            <Text style={rasterStyles.itemAmt}>{l.amount}</Text>
          </View>
        </View>
      ))}
      <View style={rasterStyles.totals}>
        <View style={rasterStyles.totRow}>
          <Text style={rasterStyles.totText}>Subtotal</Text>
          <Text style={rasterStyles.totText}>{s.subtotal}</Text>
        </View>
        <View style={rasterStyles.totRow}>
          <Text style={rasterStyles.totText}>Discounts</Text>
          <Text style={rasterStyles.totText}>− {s.discounts}</Text>
        </View>
        <View style={rasterStyles.totRow}>
          <Text style={rasterStyles.totText}>Shipping</Text>
          <Text style={rasterStyles.totText}>{s.shipping}</Text>
        </View>
        <View style={[rasterStyles.totRow, rasterStyles.grand]}>
          <Text style={rasterStyles.grandText}>Total</Text>
          <Text style={rasterStyles.grandText}>{s.total}</Text>
        </View>
      </View>
      <Text style={rasterStyles.footerLegal}>{getInvoiceLegalFooter()}</Text>
    </View>
  );
}

const rasterStyles = StyleSheet.create({
  sheet: {
    width: Math.min(360, screenWidth - 32),
    backgroundColor: '#ffffff',
    padding: 20,
  },
  logoWrap: { alignItems: 'flex-start', marginBottom: 10 },
  logo: { width: 104, height: 56 },
  brand: { fontSize: 20, fontWeight: '800', color: '#0a61d7', textAlign: 'left', marginBottom: 4 },
  sub: { fontSize: 13, color: '#6b7280', marginBottom: 10, textAlign: 'left' },
  line: { fontSize: 12, color: '#111827', marginBottom: 4 },
  bold: { fontWeight: '700' },
  box: {
    backgroundColor: '#f9fafb',
    padding: 10,
    borderRadius: 8,
    marginVertical: 10,
  },
  ship: { fontSize: 12, color: '#374151', marginTop: 4 },
  item: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 8,
  },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  itemLeft: { flex: 1, minWidth: 0 },
  itemTitle: { fontSize: 13, fontWeight: '600', color: '#111827' },
  itemSub: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  itemQty: { fontSize: 11, color: '#6b7280', marginTop: 4 },
  itemAmt: { fontSize: 13, fontWeight: '700', color: '#111827' },
  totals: { marginTop: 8 },
  totRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  totText: { fontSize: 12, color: '#374151' },
  grand: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#e5e7eb',
  },
  grandText: { fontSize: 15, fontWeight: '800', color: '#0a61d7' },
  footerLegal: {
    fontSize: 9,
    color: '#6b7280',
    marginTop: 14,
    textAlign: 'center',
    lineHeight: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
  },
});

export default function OrderInvoiceModal({ visible, onClose, order }: Props) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const backgroundColor = isDark ? '#000000' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#000000';
  const iconColor = isDark ? '#ffffff' : '#000000';
  const borderColor = isDark ? '#333333' : '#e5e5e5';

  const [busy, setBusy] = useState(false);
  const [logoDataUri, setLogoDataUri] = useState<string | null>(null);
  const rasterRef = useRef<ViewShot>(null);

  const logoUri = useMemo(
    () =>
      Image.resolveAssetSource(require('../../../assets/images/LakuMobile.png'))?.uri ?? null,
    []
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const asset = Asset.fromModule(require('../../../assets/images/LakuMobile.png'));
        await asset.downloadAsync();
        if (!asset.localUri || cancelled) return;
        const b64 = await FileSystem.readAsStringAsync(asset.localUri, {
          encoding: 'base64',
        });
        if (!cancelled) setLogoDataUri(`data:image/png;base64,${b64}`);
      } catch {
        if (!cancelled) setLogoDataUri(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const html = useMemo(
    () => (order ? buildOrderInvoiceHtml(order, { logoUri, logoDataUri }) : ''),
    [order, logoUri, logoDataUri]
  );

  const runPdf = useCallback(async () => {
    if (!order) return;
    setBusy(true);
    try {
      const { uri } = await Print.printToFileAsync({
        html: buildOrderInvoiceHtml(order, { logoUri, logoDataUri }),
        base64: false,
      });
      const filename = `invoice_${order.orderId}.pdf`;
      const namedUri = await ensureNamedCacheFile({ srcUri: uri, filename });
      if (Platform.OS === 'android') {
        const savedUri = await saveToDeviceAndroidSaf({
          uri: namedUri,
          filename,
          mimeType: 'application/pdf',
        });
        if (savedUri) {
          Alert.alert('Saved', 'Invoice PDF saved to your selected folder.');
        } else {
          // Fallback: some runtimes don't expose StorageAccessFramework. Use system sheet so user can "Save to Files".
          const can = await Sharing.isAvailableAsync();
          if (can) {
            await Sharing.shareAsync(namedUri, {
              mimeType: 'application/pdf',
              dialogTitle: 'Save Invoice PDF',
              UTI: 'com.adobe.pdf',
            });
          } else {
            Alert.alert('Save unavailable', 'Could not open the system file saver on this device.');
          }
        }
      } else {
        // iOS: "Save to Files" lives in the share sheet.
        const can = await Sharing.isAvailableAsync();
        if (can) {
          await Sharing.shareAsync(namedUri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Save Invoice PDF',
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('Save unavailable', 'Could not open the system file saver on this device.');
        }
      }
    } catch (e) {
      Alert.alert('PDF', e instanceof Error ? e.message : 'Could not create PDF');
    } finally {
      setBusy(false);
    }
  }, [order, logoUri, logoDataUri]);

  const runImage = useCallback(async () => {
    if (!order) return;
    const shot = rasterRef.current;
    if (!shot?.capture) return;
    setBusy(true);
    try {
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      const uri = await shot.capture();
      if (!uri) throw new Error('Capture failed');
      const filename = `invoice_${order.orderId}.png`;
      const namedUri = await ensureNamedCacheFile({ srcUri: uri, filename });
      if (Platform.OS === 'android') {
        const savedUri = await saveToDeviceAndroidSaf({
          uri: namedUri,
          filename,
          mimeType: 'image/png',
        });
        if (savedUri) {
          Alert.alert('Saved', 'Invoice image saved to your selected folder.');
        } else {
          // Fallback: some runtimes don't expose StorageAccessFramework. Use system sheet so user can "Save".
          const can = await Sharing.isAvailableAsync();
          if (can) {
            await Sharing.shareAsync(namedUri, {
              mimeType: 'image/png',
              dialogTitle: 'Save Invoice Image',
              UTI: 'public.png',
            });
          } else {
            Alert.alert('Save unavailable', 'Could not open the system file saver on this device.');
          }
        }
      } else {
        // iOS: "Save Image" / "Save to Files" lives in the share sheet.
        const can = await Sharing.isAvailableAsync();
        if (can) {
          await Sharing.shareAsync(namedUri, {
            mimeType: 'image/png',
            dialogTitle: 'Save Invoice Image',
            UTI: 'public.png',
          });
        } else {
          Alert.alert('Save unavailable', 'Could not open the system file saver on this device.');
        }
      }
    } catch (e) {
      Alert.alert('Image', e instanceof Error ? e.message : 'Could not export image');
    } finally {
      setBusy(false);
    }
  }, [order]);

  const runShareText = useCallback(async () => {
    if (!order) return;
    const body = buildOrderInvoicePlainText(order);
    try {
      await Share.share({
        title: `Invoice ${order.orderId}`,
        message: body,
      });
    } catch {
      /* dismissed */
    }
  }, [order]);

  const runPrint = useCallback(async () => {
    if (!order) return;
    setBusy(true);
    try {
      await Print.printAsync({ html: buildOrderInvoiceHtml(order, { logoUri, logoDataUri }) });
    } catch (e) {
      Alert.alert('Print', e instanceof Error ? e.message : 'Print failed');
    } finally {
      setBusy(false);
    }
  }, [order, logoUri, logoDataUri]);

  const showMore = useCallback(() => {
    Alert.alert('More options', undefined, [
      { text: 'Print (system)', onPress: () => void runPrint() },
      { text: 'Share text summary', onPress: () => void runShareText() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [runPrint, runShareText]);

  if (!visible || !order) {
    return null;
  }

  const dotColor = isDark ? '#ffffff' : '#000000';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
      presentationStyle="fullScreen"
    >
      <StatusBar
        backgroundColor={backgroundColor}
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />
      <View style={[styles.container, { backgroundColor }]}>
        {/* Same chrome as ProductImageModal */}
        <View style={[styles.header, { borderBottomColor: borderColor, paddingTop: Math.max(insets.top, 50) }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close">
            <X size={24} color={iconColor} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: textColor }]}>Invoice</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.imageContainer}>
          <WebView
            originWhitelist={['*']}
            source={{ html, baseUrl: 'https://laku.app' }}
            style={styles.web}
            scrollEnabled
            nestedScrollEnabled
            showsVerticalScrollIndicator
            setBuiltInZoomControls={Platform.OS === 'android'}
          />
        </View>

        {/* Off-screen raster for PNG export (matches invoice content). */}
        <View style={styles.hiddenRaster} pointerEvents="none" collapsable={false}>
          <ViewShot
            ref={rasterRef}
            options={{ format: 'png', quality: 0.92, result: 'tmpfile' }}
            style={styles.viewShotWrap}
          >
            <InvoiceRasterBody order={order} />
          </ViewShot>
        </View>

        <View style={[styles.paginationContainer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={[styles.paginationLine, { backgroundColor: dotColor }]} />
          <View style={styles.toolbar}>
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={runPdf}
              disabled={busy}
              accessibilityLabel="Download PDF"
            >
              {busy ? <ActivityIndicator color="#0a61d7" /> : <FileDown size={22} color="#0a61d7" />}
              <Text style={styles.toolLabel}>PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={runImage}
              disabled={busy}
              accessibilityLabel="Save as image"
            >
              <ImageIcon size={22} color="#0a61d7" />
              <Text style={styles.toolLabel}>Image</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolBtn} onPress={runShareText} disabled={busy}>
              <Share2 size={22} color="#0a61d7" />
              <Text style={styles.toolLabel}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolBtn} onPress={showMore} disabled={busy}>
              <MoreHorizontal size={22} color="#0a61d7" />
              <Text style={styles.toolLabel}>More</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    backgroundColor: '#f9fafb',
  },
  web: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  paginationContainer: {
    paddingTop: 12,
    alignItems: 'center',
  },
  paginationLine: {
    width: 30,
    height: 2,
    borderRadius: 1,
    marginBottom: 8,
  },
  hiddenRaster: {
    position: 'absolute',
    left: -9999,
    top: 0,
    opacity: 0.02,
    zIndex: -1,
  },
  viewShotWrap: { backgroundColor: '#fff' },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  toolBtn: { alignItems: 'center', minWidth: 64 },
  toolLabel: { marginTop: 4, fontSize: 11, fontWeight: '600', color: '#0a61d7' },
});
