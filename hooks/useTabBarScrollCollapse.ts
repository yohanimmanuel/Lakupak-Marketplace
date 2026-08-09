import { useCallback } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useTabBarScrollStore } from '../stores/tabBarScrollStore';

/** Attach to a tab screen's primary vertical ScrollView / FlatList `onScroll`. */
export function useTabBarScrollCollapse() {
  const reportScrollY = useTabBarScrollStore((s) => s.reportScrollY);

  return useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      reportScrollY(e.nativeEvent.contentOffset.y);
    },
    [reportScrollY],
  );
}
