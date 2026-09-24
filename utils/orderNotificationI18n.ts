import type { TFunction } from 'i18next';
import i18n from '../i18n';

/** Local notification + OS banner copy for an order status (buyer marketplace).
 * Matches `orderUpdates.status.*` in locales — keep aligned with server `translateMarketplaceBuyerOrderStatus` meanings.
 */
export function getBuyerOrderNotificationStrings(
  orderId: string,
  orderStatusRaw: string,
): { title: string; body: string } {
  const status = (orderStatusRaw || '').toLowerCase();

  const title = (key: string, opts?: Record<string, string>) => i18n.t(key, opts ?? {});
  const body = (key: string, opts?: Record<string, string>) => i18n.t(key, opts ?? {});

  switch (status) {
    case 'pending':
      // "Order Placed" copy is reserved for the checkout banner (see checkout.tsx custom strings).
      // Server `translateMarketplaceBuyerOrderStatus` also returns generic Order Update for Pending,
      // so the in-app banner matches the OS push when an order is reverted to Pending.
      return {
        title: title('orderUpdates.status.orderUpdatedTitle'),
        body: body('orderUpdates.status.orderUpdatedBody', { orderId }),
      };
    case 'confirmed':
      return {
        title: title('orderUpdates.status.orderConfirmedTitle'),
        body: body('orderUpdates.status.orderConfirmedBody', { orderId }),
      };
    case 'packed':
      return {
        title: title('orderUpdates.status.orderPackedTitle'),
        body: body('orderUpdates.status.orderPackedBody', { orderId }),
      };
    case 'shipped':
      return {
        title: title('orderUpdates.status.orderShippedTitle'),
        body: body('orderUpdates.status.orderShippedBody', { orderId }),
      };
    case 'delivered':
      return {
        title: title('orderUpdates.status.orderDeliveredTitle'),
        body: body('orderUpdates.status.orderDeliveredBody', { orderId }),
      };
    case 'received':
      return {
        title: title('orderUpdates.status.orderReceivedTitle'),
        body: body('orderUpdates.status.orderReceivedBody', { orderId }),
      };
    case 'cancelled':
      return {
        title: title('orderUpdates.status.orderCancelledTitle'),
        body: body('orderUpdates.status.orderCancelledBody', { orderId }),
      };
    case 'returned':
      return {
        title: title('orderUpdates.status.orderReturnedTitle'),
        body: body('orderUpdates.status.orderReturnedBody', { orderId }),
      };
    case 'failed':
      return {
        title: title('orderUpdates.status.deliveryFailedTitle'),
        body: body('orderUpdates.status.deliveryFailedBody', { orderId }),
      };
    case 'pricing_sent':
      return getPricingSentNotificationStrings(orderId);
    default:
      return {
        title: title('orderUpdates.status.orderUpdatedTitle'),
        body: body('orderUpdates.status.orderUpdatedBody', { orderId }),
      };
  }
}

export type OrderPreviewInput = {
  orderId: string;
  orderStatus?: string;
  paymentStatus?: string;
  totalAmount?: number | null;
  returnItemsReceivedAt?: string | null;
  returnRequests?: Array<{ status?: string }>;
  trackingNumber?: string | null;
  assignedLogistics?: string | null;
};

/** Distributor sent confirmed PO pricing — buyer can review amounts on the order. */
export function getPricingSentNotificationStrings(orderId: string): { title: string; body: string } {
  return {
    title: i18n.t('orderUpdates.status.pricingReadyTitle'),
    body: i18n.t('orderUpdates.status.pricingReadyBody', { orderId }),
  };
}

/** Local notification copy when a distributor fleet is assigned to the buyer's order. */
export function getFleetAssignedNotificationStrings(orderId: string): { title: string; body: string } {
  return {
    title: i18n.t('orderUpdates.status.fleetAssignedTitle'),
    body: i18n.t('orderUpdates.status.fleetAssignedBody', { orderId }),
  };
}

/** Preview rows on Notifications tab + Order notifications screen — same rules as prior English branches. */
export function getOrderPreviewStrings(order: OrderPreviewInput, t: TFunction): { title: string; message: string } {
  const orderId = order.orderId;

  const hasFleetAssignment = Boolean((order.trackingNumber || order.assignedLogistics || '').trim());
  const fleetAssignableStatuses = new Set(['Pending', 'Confirmed', 'Packed']);
  if (hasFleetAssignment && fleetAssignableStatuses.has(order.orderStatus ?? '')) {
    return {
      title: t('orderUpdates.status.fleetAssignedTitle'),
      message: t('orderUpdates.status.fleetAssignedBody', { orderId }),
    };
  }

  if (order.orderStatus === 'Pending') {
    const total = Number(order.totalAmount ?? 0);
    if (!(total > 0)) {
      return {
        title: t('orderUpdates.status.pricingAwaitingTitle'),
        message: t('orderUpdates.status.pricingAwaitingBody', { orderId }),
      };
    }
  }

  if (order.paymentStatus === 'Unpaid' && order.orderStatus === 'Pending') {
    return {
      title: t('orderUpdates.status.pricingReadyTitle'),
      message: t('orderUpdates.status.pricingReadyBody', { orderId }),
    };
  }

  if (
    order.orderStatus === 'Returned' &&
    order.returnItemsReceivedAt &&
    Array.isArray(order.returnRequests) &&
    order.returnRequests.some((rr) => rr.status === 'Accepted')
  ) {
    return {
      title: t('orderUpdates.status.returnItemsReceivedTitle'),
      message: t('orderUpdates.status.returnItemsReceivedBody', { orderId }),
    };
  }

  if (
    (order.orderStatus === 'Delivered' || order.orderStatus === 'Received') &&
    Array.isArray(order.returnRequests) &&
    order.returnRequests.some((rr) => rr.status === 'Pending')
  ) {
    return {
      title: t('orderUpdates.status.returnSubmittedTitle'),
      message: t('orderUpdates.status.returnSubmittedBody', { orderId }),
    };
  }

  if (
    (order.orderStatus === 'Delivered' || order.orderStatus === 'Received') &&
    Array.isArray(order.returnRequests) &&
    order.returnRequests.some((rr) => rr.status === 'Rejected')
  ) {
    return {
      title: t('orderUpdates.status.returnRejectedTitle'),
      message: t('orderUpdates.status.returnRejectedBody', { orderId }),
    };
  }

  const status = order.orderStatus ?? '';
  switch (status) {
    case 'Confirmed':
      return {
        title: t('orderUpdates.status.orderConfirmedTitle'),
        message: t('orderUpdates.status.orderConfirmedBody', { orderId }),
      };
    case 'Packed':
      return {
        title: t('orderUpdates.status.orderPackedTitle'),
        message: t('orderUpdates.status.orderPackedBody', { orderId }),
      };
    case 'Shipped':
      return {
        title: t('orderUpdates.status.orderShippedTitle'),
        message: t('orderUpdates.status.orderShippedBody', { orderId }),
      };
    case 'Delivered':
      return {
        title: t('orderUpdates.status.orderDeliveredTitle'),
        message: t('orderUpdates.status.orderDeliveredBody', { orderId }),
      };
    case 'Received':
      return {
        title: t('orderUpdates.status.orderReceivedTitle'),
        message: t('orderUpdates.status.orderReceivedBody', { orderId }),
      };
    case 'Cancelled':
      return {
        title: t('orderUpdates.status.orderCancelledTitle'),
        message: t('orderUpdates.status.orderCancelledBody', { orderId }),
      };
    case 'Returned':
      return {
        title: t('orderUpdates.status.orderReturnedTitle'),
        message: t('orderUpdates.status.orderReturnedBody', { orderId }),
      };
    case 'Failed':
      return {
        title: t('orderUpdates.status.deliveryFailedTitle'),
        message: t('orderUpdates.status.deliveryFailedBody', { orderId }),
      };
    default:
      return {
        title: t('orderUpdates.status.orderUpdatedTitle'),
        message: t('orderUpdates.status.orderUpdatedBody', { orderId }),
      };
  }
}
