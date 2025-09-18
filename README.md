# 🤗 Laku-Marketplace (Mobile) 🤗

## Overview
Laku-Marketplace is the buyer-facing mobile app for Laku-Laku. It enables verified retailers (warungs, kiosks, small shops) to browse products, place orders, track deliveries, and reorder quickly. Built with React Native (Expo) and connected to the existing Laku-Laku backend (Next.js + Prisma).

## Key Security & Trust Principles
- Verified buyer access; pricing and offers scoped to approved distributors.
- Role-based data isolation; buyers see only their own orders and eligible catalogs.
- Messaging/notifications respect opt-in consent.

## Why Laku-Marketplace
- Wholesale-first buyer UX (carton/box, quick reorder, low bandwidth).
- Tight integration with distributor dashboards (inventory, fulfillment, analytics).
- Remote-first confirmations and push updates reduce field visits.

## Core Features
- Browse/search marketplace (category, brand, region filters)
- Product details with variants and tiered pricing
- Cart and checkout (COD/bank transfer in MVP)
- Order tracking with status timeline and notifications
- Quick reorder from past orders and favorites
- Account management: addresses, contact info, notifications

## Business Model
- Seller-side commission on transactions
- Optional value-added services: logistics, financing, promotions

## Technical Architecture
- React Native + Expo Router (TypeScript)
- State: Zustand; Data: React Query + Axios; Validation: Zod
- Notifications: Expo Notifications; Secure Storage: Expo Secure Store
- SVG & Icons: react-native-svg + lucide-react-native
- Styling: NativeWind (Tailwind for React Native)

## Getting Started
1) Prerequisites: Node LTS, Git, Android Studio/Xcode (optional for emulators)
2) Install dependencies:
```
npm install
```
3) Start the app:
```
npx expo start
```
4) Open on device (Expo Go) or emulator via the Metro menu.

## Environment
Define API base URL and feature flags in `app.config.ts` (or via env):
```
export default ({ config }) => ({
  ...config,
  extra: {
    API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000',
  },
});
```

## Data & APIs
- Uses existing Laku-Laku endpoints (users, products, orders, buyers)
- Typed DTOs; Zod validation at request/response boundaries
- React Query for caching and mutations (cart, checkout, orders)

## Navigation
- Expo Router tabs: Home, Catalog, Cart, Orders, Account
- Stack screens for product details and checkout

## State Management
- `useAuthStore`: token, profile, login/logout
- `useCartStore`: items, add/update/remove, totals
- `useFiltersStore`: category/brand/price/region filters

## Styling
- NativeWind with Tailwind classnames
- Align colors/typography with Laku-Laku design system

## Testing
- Jest + jest-expo for unit tests
- (Optional) Detox for E2E

## Build & Release
- Dev: `npx expo start`
- Android: `npx expo prebuild && npx expo run:android` or EAS Build
- iOS (macOS): `npx expo prebuild && npx expo run:ios` or EAS Build
- OTA: `expo publish` (when using Expo Updates)

## Roadmap
- Payments SDK (Midtrans/Xendit) beyond COD/transfer
- Deep links (WhatsApp confirmations, order status)
- Offline catalog/cart with background sync
- Multi-language and accessibility

## Contributing
TypeScript strict (no `any`), consistent fetch/state patterns, and design tokens.

## License
MIT License
