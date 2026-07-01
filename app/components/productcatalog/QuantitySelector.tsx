import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import {
  clampPiecesToStock,
  normalizeCommittedPieces,
  piecesToLivePackageQuantity,
} from '../../../utils/quantityInput';

type QuantitySelectorProps = {
  packageQuantity: number;
  piecesPerPackage: number;
  stockPieces: number;
  moq?: number | null;
  onPackageQuantityChange: (packages: number) => void;
  size?: 'default' | 'compact';
};

export default function QuantitySelector({
  packageQuantity,
  piecesPerPackage,
  stockPieces,
  moq = null,
  onPackageQuantityChange,
  size = 'default',
}: QuantitySelectorProps) {
  const pp = Math.max(1, piecesPerPackage);
  const stock = Math.max(0, stockPieces);
  const totalPieces = packageQuantity * pp;

  const [piecesInput, setPiecesInput] = useState(String(totalPieces));
  const [isEditingPieces, setIsEditingPieces] = useState(false);

  const longPressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isEditingPieces) {
      setPiecesInput(String(packageQuantity * pp));
    }
  }, [packageQuantity, pp, isEditingPieces]);

  useEffect(() => {
    const parsed = parseInt(piecesInput.replace(/\D/g, ''), 10);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed <= stock) return;

    const { packages, pieces } = normalizeCommittedPieces(stock, pp, stock, moq);
    onPackageQuantityChange(packages);
    setPiecesInput(String(pieces));
  }, [stock, pp, moq]);

  const stopLongPress = useCallback(() => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
      longPressTimeout.current = null;
    }
    if (longPressInterval.current) {
      clearInterval(longPressInterval.current);
      longPressInterval.current = null;
    }
  }, []);

  const changeQuantity = useCallback(
    (increment: boolean) => {
      const nextPackages = increment
        ? packageQuantity + 1
        : Math.max(1, packageQuantity - 1);
      const nextPieces = nextPackages * pp;
      if (nextPieces > stock) return;
      onPackageQuantityChange(nextPackages);
      setPiecesInput(String(nextPieces));
    },
    [packageQuantity, pp, stock, onPackageQuantityChange],
  );

  const startLongPress = useCallback(
    (increment: boolean) => {
      changeQuantity(increment);

      longPressTimeout.current = setTimeout(() => {
        longPressInterval.current = setInterval(() => changeQuantity(increment), 100);
      }, 500);
    },
    [changeQuantity],
  );

  const commitPiecesInput = useCallback(() => {
    setIsEditingPieces(false);

    const parsed = parseInt(piecesInput.replace(/\D/g, ''), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      const { packages, pieces } = normalizeCommittedPieces(0, pp, stock, moq);
      onPackageQuantityChange(packages);
      setPiecesInput(String(pieces));
      return;
    }

    const { packages, pieces } = normalizeCommittedPieces(parsed, pp, stock, moq);
    onPackageQuantityChange(packages);
    setPiecesInput(String(pieces));
  }, [piecesInput, pp, stock, moq, onPackageQuantityChange]);

  const handlePiecesInputChange = useCallback(
    (text: string) => {
      const { display, parsed } = clampPiecesToStock(text.replace(/\D/g, ''), stock);
      setPiecesInput(display);
      onPackageQuantityChange(piecesToLivePackageQuantity(parsed, pp, stock));
    },
    [pp, stock, onPackageQuantityChange],
  );

  const atMin = packageQuantity <= 1;
  const atMax = totalPieces >= stock;
  const compact = size === 'compact';
  const controlHeight = compact ? 26 : 32;
  const iconSize = compact ? 12 : 14;
  const inputFontSize = compact ? 12 : 14;
  const inputMinWidth = compact ? 28 : 36;
  const displayMinWidth = compact ? 36 : 48;

  return (
    <View style={[styles.quantitySelector, compact && styles.quantitySelectorCompact]}>
      <TouchableOpacity
        style={[
          styles.quantityButtonLeft,
          compact && styles.quantityButtonCompact,
          { height: controlHeight },
          atMin && styles.quantityButtonDisabled,
        ]}
        onPressIn={() => startLongPress(false)}
        onPressOut={stopLongPress}
        disabled={atMin}
      >
        <Minus size={iconSize} color={atMin ? '#D1D5DB' : '#6B7280'} />
      </TouchableOpacity>

      <View style={[styles.quantitySeparator, { height: controlHeight }]} />

      <View style={[styles.quantityDisplay, { height: controlHeight, minWidth: displayMinWidth }]}>
        <TextInput
          style={[styles.quantityInput, { fontSize: inputFontSize, minWidth: inputMinWidth }]}
          value={piecesInput}
          onChangeText={handlePiecesInputChange}
          onFocus={() => setIsEditingPieces(true)}
          onBlur={commitPiecesInput}
          onSubmitEditing={commitPiecesInput}
          keyboardType="number-pad"
          returnKeyType="done"
          selectTextOnFocus
          maxLength={6}
        />
      </View>

      <View style={[styles.quantitySeparator, { height: controlHeight }]} />

      <TouchableOpacity
        style={[
          styles.quantityButtonRight,
          compact && styles.quantityButtonCompact,
          { height: controlHeight },
          atMax && styles.quantityButtonDisabled,
        ]}
        onPressIn={() => startLongPress(true)}
        onPressOut={stopLongPress}
        disabled={atMax}
      >
        <Plus size={iconSize} color={atMax ? '#D1D5DB' : '#6B7280'} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  quantitySelectorCompact: {
    borderRadius: 6,
  },
  quantityButtonLeft: {
    width: 32,
    height: 32,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonRight: {
    width: 32,
    height: 32,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonCompact: {
    width: 26,
  },
  quantityButtonDisabled: {
    backgroundColor: '#F9FAFB',
  },
  quantitySeparator: {
    width: 1,
    height: 32,
    backgroundColor: '#E5E7EB',
  },
  quantityDisplay: {
    minWidth: 48,
    height: 32,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  quantityInput: {
    minWidth: 36,
    fontSize: 14,
    fontWeight: '600',
    color: '#0a61d7',
    textAlign: 'center',
    padding: 0,
  },
});
