import {
  normalizeProofFileName,
  type PaymentProofAttachment,
} from '../services/paymentReceiptUpload';

export type OrderPaymentProofFields = {
  paymentProofUrls?: string[] | null;
  paymentProofFileNames?: string[] | null;
  paymentProofSubmittedAt?: string | Date | null;
};

export function hasPaymentIntentSubmitted(order: OrderPaymentProofFields | null | undefined): boolean {
  if (!order) return false;
  if (order.paymentProofSubmittedAt) return true;
  const urls = order.paymentProofUrls ?? [];
  return urls.some((u) => typeof u === 'string' && u.trim().length > 0);
}

export function paymentProofFromOrder(
  order: OrderPaymentProofFields | null | undefined,
): PaymentProofAttachment | null {
  if (!order) return null;
  const url = (order.paymentProofUrls ?? []).find((u) => typeof u === 'string' && u.trim().length > 0);
  if (!url) return null;
  const rawName = order.paymentProofFileNames?.[0];
  return {
    url: url.trim(),
    fileName: rawName?.trim() ? normalizeProofFileName(rawName) : undefined,
  };
}
