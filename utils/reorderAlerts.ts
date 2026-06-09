import { Alert } from 'react-native';
import type { TFunction } from 'i18next';

export function showReorderUnavailableAlert(t: TFunction): void {
  Alert.alert(
    t('ordersFlow.orderDetails.reorder.noneAddedTitle'),
    t('ordersFlow.orderDetails.reorder.noneAddedBody'),
  );
}
