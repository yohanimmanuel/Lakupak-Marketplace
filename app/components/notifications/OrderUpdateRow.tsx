import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import type { Notification } from '../../../services/notificationService';

type Props = {
  notification: Notification;
  onPress: () => void;
  /** Omit bottom divider on the last row inside a grouped list. */
  isLast?: boolean;
};

/**
 * Shared order-update row: text on the left, square product thumbnail on the right only.
 * Unread state uses a blue dot only (no full-row tint).
 */
export function OrderUpdateRow({ notification, onPress, isLast = false }: Props) {
  return (
    <TouchableOpacity
      style={[
        styles.orderUpdateCard,
        isLast && styles.orderUpdateCardLast,
      ]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={styles.row}>
        <View style={styles.updateTitleContainer}>
          <View style={styles.titleRow}>
            {!notification.isRead ? <View style={styles.unreadDotBlue} /> : null}
            <Text style={styles.updateTitle} numberOfLines={1}>
              {notification.title}
            </Text>
          </View>
          <Text style={styles.updateMessage}>{notification.message}</Text>
          <Text style={styles.updateTime}>{notification.timestamp}</Text>
        </View>
        {notification.productImage ? (
          <Image source={{ uri: notification.productImage }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={styles.thumbPlaceholder} />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  orderUpdateCard: {
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  orderUpdateCardLast: {
    borderBottomWidth: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
  },
  updateTitleContainer: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    minWidth: 0,
  },
  unreadDotBlue: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0a61d7',
  },
  updateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  updateMessage: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 4,
  },
  updateTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  thumbPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
});
