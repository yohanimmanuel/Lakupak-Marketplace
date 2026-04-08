import { create } from 'zustand';
import type { PlatformAnnouncement } from '../services/latestUpdatesService';

type State = {
  version: number;
  lastIncoming: PlatformAnnouncement | null;
  lastUnpublishedId: number | null;
  pushIncoming: (a: PlatformAnnouncement) => void;
  pushUnpublished: (id: number) => void;
};

/**
 * Real-time platform announcements from WebSocket (published from Laku Admin).
 */
export const usePlatformAnnouncementsRealtimeStore = create<State>((set, get) => ({
  version: 0,
  lastIncoming: null,
  lastUnpublishedId: null,
  pushIncoming: (a) =>
    set({
      version: get().version + 1,
      lastIncoming: a,
      lastUnpublishedId: null,
    }),
  pushUnpublished: (id) =>
    set({
      version: get().version + 1,
      lastIncoming: null,
      lastUnpublishedId: id,
    }),
}));
