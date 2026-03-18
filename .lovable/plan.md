

## Plan: Add Two-Tab Layout to Store Page (Menu + Posts)

### Overview
Split the StoreOrder page into two tabs using the existing Tabs component:
1. **เมนู (Menu)** — Current menu items list (existing content)
2. **โพสจากลูกค้า (Posts)** — All posts tagged to this store (`posts` table where `store_id` matches)

### Changes in `src/pages/StoreOrder.tsx`

1. **Add Tabs UI** below the header using `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from `@/components/ui/tabs`
2. **Move existing menu content** into `<TabsContent value="menu">`
3. **Create new Posts tab** in `<TabsContent value="posts">`:
   - Fetch posts from `posts` table where `store_id = storeId` (joined with `profiles` for author info and `post_likes` for like counts)
   - Display as a grid/list of user-posted food photos with caption, author avatar/name, like count, and timestamp
   - Show empty state when no posts exist
4. **Data fetching**: Add a new `fetchStorePosts` function that queries:
   - `posts` (where `store_id = storeId`, `hidden = false`)
   - `profiles` (for display_name, avatar_url)
   - `post_likes` count
   - `post_images` for additional images
5. **Keep the floating order button and options popup** visible across both tabs (they sit outside TabsContent)

### UI Design
- Tabs styled to match the app's existing glass/luxury aesthetic
- Posts displayed as image-first cards (similar to Instagram-style grid or feed)
- Each post card shows: main image, caption preview, author info, like count, time ago

### Technical Details
- No database changes needed — `posts` table already has `store_id` column
- Imports: Add `Tabs` components, `Heart` icon, date formatting utility
- State: Add `storePosts` array state, `postsLoading` boolean

