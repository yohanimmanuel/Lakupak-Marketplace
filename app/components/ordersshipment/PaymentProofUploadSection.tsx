import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { Camera, FileText, ImagePlus, X } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useTranslation } from 'react-i18next';
import { pickImage, takePhoto } from '../../../services/imagePicker';
import {
  uploadPaymentReceiptPdf,
  isPaymentProofPdfUrl,
  normalizeProofFileName,
  paymentProofPdfLabel,
  type PaymentProofAttachment,
} from '../../../services/paymentReceiptUpload';
import { useAuthStore } from '../../../stores/authStore';

const primaryBlue = '#0a61d7';

type Props = {
  proof: PaymentProofAttachment | null;
  onChange: (proof: PaymentProofAttachment | null) => void;
  uploading: boolean;
  onUploadingChange: (value: boolean) => void;
};

export default function PaymentProofUploadSection({
  proof,
  onChange,
  uploading,
  onUploadingChange,
}: Props) {
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.token);

  const handleAddFromGallery = async () => {
    if (proof) return;
    try {
      onUploadingChange(true);
      const url = await pickImage({ folder: 'payment-proofs', allowsEditing: false });
      if (url) onChange({ url });
    } catch {
      Alert.alert(
        t('ordersFlow.paymentProof.alerts.uploadFailedTitle'),
        t('ordersFlow.paymentProof.alerts.uploadFailedBody'),
      );
    } finally {
      onUploadingChange(false);
    }
  };

  const handleTakePhoto = async () => {
    if (proof) return;
    try {
      onUploadingChange(true);
      const url = await takePhoto({ folder: 'payment-proofs', allowsEditing: false });
      if (url) onChange({ url });
    } catch {
      Alert.alert(
        t('ordersFlow.paymentProof.alerts.uploadFailedTitle'),
        t('ordersFlow.paymentProof.alerts.uploadFailedBody'),
      );
    } finally {
      onUploadingChange(false);
    }
  };

  const handlePickPdf = async () => {
    if (proof) return;
    if (!token) {
      Alert.alert(
        t('ordersFlow.common.errors.sessionExpiredTitle'),
        t('ordersFlow.common.errors.sessionExpiredBody'),
      );
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;

      onUploadingChange(true);
      const asset = result.assets[0];
      const fileName = normalizeProofFileName(asset.name?.trim() || 'receipt.pdf');
      const uploadResult = await uploadPaymentReceiptPdf(asset.uri, fileName, token);
      if (uploadResult.success && uploadResult.url) {
        onChange({
          url: uploadResult.url,
          fileName: normalizeProofFileName(uploadResult.fileName ?? fileName),
        });
      } else {
        throw new Error(uploadResult.error || 'Upload failed');
      }
    } catch {
      Alert.alert(
        t('ordersFlow.paymentProof.alerts.uploadFailedTitle'),
        t('ordersFlow.paymentProof.alerts.uploadFailedBody'),
      );
    } finally {
      onUploadingChange(false);
    }
  };

  const isPdf = proof ? isPaymentProofPdfUrl(proof.url) : false;
  const pdfDisplayName = proof && isPdf ? paymentProofPdfLabel(proof) : '';

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {proof ? (
          <View style={[styles.thumbWrap, isPdf && styles.thumbWrapPdf]}>
            {isPdf ? (
              <View style={styles.pdfCard}>
                <View style={styles.pdfIcon}>
                  <FileText size={18} color="#6b7280" />
                </View>
                <Text style={styles.pdfFileName} numberOfLines={3} ellipsizeMode="middle">
                  {pdfDisplayName}
                </Text>
              </View>
            ) : (
              <Image source={{ uri: proof.url }} style={styles.thumb} />
            )}
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => onChange(null)}
              accessibilityLabel={t('ordersFlow.paymentProof.a11y.remove')}
              accessibilityRole="button"
            >
              <X size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={handleTakePhoto}
              disabled={uploading}
              accessibilityLabel={t('ordersFlow.paymentProof.a11y.camera')}
              accessibilityRole="button"
            >
              {uploading ? (
                <ActivityIndicator size="small" color={primaryBlue} />
              ) : (
                <Camera size={22} color="#6b7280" />
              )}
              <Text style={styles.addText}>{t('ordersFlow.paymentProof.camera')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={handleAddFromGallery}
              disabled={uploading}
              accessibilityLabel={t('ordersFlow.paymentProof.a11y.gallery')}
              accessibilityRole="button"
            >
              {uploading ? (
                <ActivityIndicator size="small" color={primaryBlue} />
              ) : (
                <ImagePlus size={22} color="#6b7280" />
              )}
              <Text style={styles.addText}>{t('ordersFlow.paymentProof.gallery')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={handlePickPdf}
              disabled={uploading}
              accessibilityLabel={t('ordersFlow.paymentProof.a11y.pdf')}
              accessibilityRole="button"
            >
              {uploading ? (
                <ActivityIndicator size="small" color={primaryBlue} />
              ) : (
                <FileText size={22} color="#6b7280" />
              )}
              <Text style={styles.addText}>{t('ordersFlow.paymentProof.pdf')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
    alignSelf: 'stretch',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'stretch',
  },
  thumbWrap: {
    position: 'relative',
  },
  thumbWrapPdf: {
    alignSelf: 'stretch',
    width: '100%',
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  pdfCard: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    width: '100%',
    minHeight: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    paddingVertical: 12,
    paddingHorizontal: 14,
    paddingRight: 36,
    gap: 12,
  },
  pdfIcon: {
    flexShrink: 0,
  },
  pdfFileName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
    lineHeight: 18,
  },
  removeBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  addBtn: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
});
