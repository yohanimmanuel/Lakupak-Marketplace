export interface MapCoordinates {
  longitude: number;
  latitude: number;
}

export type GeocodePrecision = 'exact' | 'approximate' | 'area';

export interface GeocodeResult {
  coordinates: MapCoordinates | null;
  address: string;
  precision?: GeocodePrecision;
}

/**
 * Get map marker color based on order status
 * Colors match the UI badge color scheme
 */
export function getOrderStatusMarkerColor(status: string): string {
  switch (status) {
    case 'Pending':
      return '#fbbf24';
    case 'Confirmed':
      return '#3b82f6';
    case 'Packed':
      return '#a855f7';
    case 'Shipped':
      return '#6366f1';
    case 'Delivered':
      return '#22c55e';
    case 'Cancelled':
      return '#ef4444';
    case 'Returned':
      return '#f97316';
    default:
      return '#6b7280';
  }
}
