import { API_BASE_URL } from './config';

export type PaymentReceiptUploadResult = {
  success: boolean;
  url?: string;
  downloadUrl?: string;
  fileName?: string;
  error?: string;
};

/**
 * Upload a PDF payment receipt via authenticated mobile endpoint.
 */
export async function uploadPaymentReceiptPdf(
  fileUri: string,
  fileName: string,
  token: string,
): Promise<PaymentReceiptUploadResult> {
  try {
    const formData = new FormData();
    // @ts-ignore React Native FormData file shape
    formData.append('file', {
      uri: fileUri,
      name: fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`,
      type: 'application/pdf',
    });

    const response = await fetch(`${API_BASE_URL}/api/mobile/upload/payment-receipt`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      return {
        success: false,
        error: (errBody as { error?: string })?.error || response.statusText || 'Upload failed',
      };
    }

    const data = await response.json();
    return {
      success: true,
      url: data.url as string,
      downloadUrl: typeof data.downloadUrl === 'string' ? data.downloadUrl : (data.url as string),
      fileName: typeof data.fileName === 'string' ? data.fileName : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

export function isPaymentProofPdfUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes('.pdf') || lower.includes('/raw/upload/');
}

export type PaymentProofAttachment = {
  url: string;
  /** Original PDF file name from the device picker (images omit this). */
  fileName?: string;
};

/** Decode percent-encoding once and show normal spaces (not literal %20). */
export function normalizeProofFileName(name: string): string {
  let s = String(name ?? '').trim();
  if (!s) return s;
  if (/%[0-9A-Fa-f]{2}/.test(s)) {
    try {
      s = decodeURIComponent(s);
    } catch {
      // keep original if malformed
    }
  }
  s = s.replace(/%20/gi, ' ').replace(/\s+/g, ' ').trim();
  return s;
}

/** Best-effort file name from a proof URL path segment (avoid for UI when picker name exists). */
export function pdfDisplayNameFromUrl(url: string): string | null {
  try {
    const segment = new URL(url).pathname.split('/').filter(Boolean).pop();
    if (!segment) return null;
    const normalized = normalizeProofFileName(segment);
    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
}

export function paymentProofPdfLabel(attachment: PaymentProofAttachment): string {
  const fromPicker = attachment.fileName?.trim();
  if (fromPicker) return normalizeProofFileName(fromPicker);
  const fromUrl = pdfDisplayNameFromUrl(attachment.url);
  if (fromUrl) return fromUrl;
  return 'receipt.pdf';
}
