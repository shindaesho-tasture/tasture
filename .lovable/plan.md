

## Performance Optimization Plan for Mobile

### Overview
Optimize the app for mobile by adding lazy-loaded images, skeleton loaders everywhere, React Query caching for store/menu data, conditional data fetching, and ensuring tree-shakable icon imports.

### 1. Create a `LazyImage` Component
**File**: `src/components/ui/lazy-image.tsx`

- Wrapper around `<img>` with `loading="lazy"` and `decoding="async"`
- Shows a `<Skeleton>` placeholder while the image loads (using `onLoad` state)
- Accepts optional Supabase image transform params (width, height, quality) — appends `?width=X&height=Y&quality=Q` to Supabase storage URLs
- Fallback slot for when there's no image URL

### 2. Replace `<img>` Tags with `<LazyImage>`
**Files**: ~15 files including `SovereignMenuCard`, `DishDetailSheet`, `HomeFeed`, `Profile`, `StoreOrder`, `AdminDashboard`, `FollowList`, `SuggestedUsers`, `MenuImageManager`, etc.

- Replace all raw `<img src=...>` with `<LazyImage>` 
- Pass appropriate dimensions (e.g. menu card: width=160, avatar: width=80)
- This adds skeleton shimmer while images load + native lazy loading

### 3. Add Skeleton Loaders to All Loading States
**Files**: `StoreOrder.tsx`, `MenuFeedback.tsx`, `PostOrderReview.tsx`, `MenuManager.tsx`, `MenuImageManager.tsx`, `KitchenDashboard.tsx`, `Profile.tsx`, `StoreList.tsx`

Currently most pages show a spinner during loading. Replace with contextual skeleton layouts:
- **StoreOrder**: Skeleton cards mimicking menu card layout (image + text + tags)
- **KitchenDashboard**: Skeleton order cards
- **Profile**: Skeleton avatar + stats + grid
- **StoreList**: Skeleton store cards
- **MenuManager**: Skeleton list items

### 4. Convert StoreOrder to React Query
**File**: `src/pages/StoreOrder.tsx`

Currently uses `useState` + `useEffect` + manual `fetchData()`. Convert to:
- `useQuery(["store-order", storeId])` for the main data fetch
- `staleTime: 5 * 60 * 1000` (5 min cache, matching existing pattern from Index.tsx)
- Posts tab already uses conditional fetch — keep that pattern but wrap in `useQuery` with `enabled: activeTab === "posts"`

### 5. Conditional Data Fetching for Detail Sheets
**File**: `src/components/menu/DishDetailSheet.tsx`

- Only fetch detailed dish data (DNA, descriptions, user photos) when the sheet is opened (`enabled: isOpen`)
- Use `useQuery` with `enabled` flag tied to sheet open state

### 6. Verify Tree-Shakable Icon Imports
**All files** — audit existing imports. Current pattern is already correct:
```tsx
import { Camera, Check } from "lucide-react";
```
This is the tree-shakable named import pattern. Verify no file uses `import * from 'lucide-react'` or the generic `icons` object.

### Technical Details

**LazyImage Supabase transform**: Supabase storage supports URL-based transforms via `/render/image/public/bucket/path?width=X&height=Y&quality=Q`. The component will detect Supabase storage URLs and append transform params.

**React Query config**: Use the existing `queryClient` instance. Add `staleTime` and `gcTime` for menu data queries to avoid re-fetching on navigation back.

**Skeleton patterns**: Use the existing `<Skeleton>` component from `src/components/ui/skeleton.tsx` with layout-specific arrangements.

### Files to Create
- `src/components/ui/lazy-image.tsx`

### Files to Modify
- `src/pages/StoreOrder.tsx` — React Query + skeleton loader
- `src/pages/KitchenDashboard.tsx` — skeleton loader
- `src/pages/Profile.tsx` — skeleton loader
- `src/pages/MenuManager.tsx` — skeleton loader
- `src/pages/MenuImageManager.tsx` — skeleton loader
- `src/pages/StoreList.tsx` — skeleton loader
- `src/components/menu/SovereignMenuCard.tsx` — LazyImage
- `src/components/menu/DishDetailSheet.tsx` — LazyImage + conditional fetch
- `src/components/menu/NoodleCard.tsx` — LazyImage
- `src/pages/HomeFeed.tsx` — LazyImage for post images/avatars
- `src/pages/FollowList.tsx` — LazyImage for avatars
- `src/components/SuggestedUsers.tsx` — LazyImage for avatars

