import { getCurrencyConfig, formatCurrencyWithLocale } from '../config/currencyConfig';

// Currency formatting utility
export const formatCurrency = (amount: number, currency?: string): string => {
  // Use provided currency or default to IDR if not specified
  const currencyCode = currency || 'IDR';
  return formatCurrencyWithLocale(amount, currencyCode);
};

// Format currency without symbol (just the number)
export const formatCurrencyAmount = (amount: number, currency?: string): string => {
  const config = getCurrencyConfig(currency);
  
  try {
    return new Intl.NumberFormat(config.locale, {
      minimumFractionDigits: config.formatOptions.minimumFractionDigits,
      maximumFractionDigits: config.formatOptions.maximumFractionDigits
    }).format(amount);
  } catch (error) {
    // Fallback to simple formatting
    return amount.toLocaleString(config.locale);
  }
};

// Get the default currency (IDR as fallback)
export const getDefaultCurrency = (): string => {
  return 'IDR';
};

// Get currency symbol
export const getCurrencySymbol = (currency?: string): string => {
  const config = getCurrencyConfig(currency);
  return config.symbol;
};

// Parse formatted currency amount back to number (handles both formatted and raw numbers)
export const parseCurrencyAmount = (value: string | number, currency?: string): number => {
  // If it's already a number, return it
  if (typeof value === 'number') {
    return value;
  }
  
  // If it's a string, try to parse it
  if (typeof value === 'string') {
    // First try to parse as a number directly
    const directParse = parseFloat(value);
    if (!isNaN(directParse)) {
      return directParse;
    }
    
    // If that fails, try currency-specific parsing
    const config = getCurrencyConfig(currency);
    
    // For IDR (Indonesian), dots are thousands separators, commas are decimals
    if (config.locale === 'id-ID') {
      // Remove dots (thousands separators) and replace commas with dots (decimal separators)
      const cleaned = value.replace(/\./g, '').replace(/,/g, '.');
      return parseFloat(cleaned) || 0;
    }
    
    // For other currencies, use standard parsing (commas for thousands, dots for decimals)
    const cleaned = value.replace(/[^\d.-]/g, '');
    return parseFloat(cleaned) || 0;
  }
  
  return 0;
};