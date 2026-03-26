import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ShoppingBag, Plus, Minus, X, Check, Heart, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrder } from "@/lib/order-context";
import PageTransition from "@/components/PageTransition";
import { getPopularityTier, getPopularityTierInfo } from "@/lib/popularity-tier";
import SovereignMenuCard from "@/components/menu/SovereignMenuCard";
import DishDetailSheet from "@/components/menu/DishDetailSheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";
import { useLanguage } from "@/lib/language-context";
import { t } from "@/lib/i18n";

interface MenuItemRow {
  id: string;
  name: string;
  price: number;
  price_special: number | null;
  type: string;
  noodle_types: string[] | null;
  noodle_styles: string[] | null;
  toppings: string[] | null;
  image_url: string | null;
}

interface DnaTag {
  component_icon: string;
  component_name: string;
  selected_tag: string;
  selected_score: number;
  count: number;
}

interface StorePost {
  id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
  user_id: string;
  profile: { display_name: string | null; avatar_url: string | null } | null;
  likes_count: number;
  comments_count: number;
}

const StoreOrder = () => {
  const navigate = useNavigate();
  const { storeId } = useParams<{ storeId: string }>();
  const { items, addItem, updateQuantity, removeItem, setOrderStore, totalItems, totalPrice } = useOrder();
  const [menuItems, setMenuItems] = useState<MenuItemRow[]>([]);
  const [storeName, setStoreName] = useState("");
  const [loading, setLoading] = useState(true);
  const [dnaByItem, setDnaByItem] = useState<Map<string, DnaTag[]>>(new Map());
  const [menuReviewCounts, setMenuReviewCounts] = useState<Map<string, number>>(new Map());
  const [dnaCounts, setDnaCounts] = useState<Map<string, number>>(new Map());
  const [topPhotoByItem, setTopPhotoByItem] = useState<Map<string, string[]>>(new Map());

  // Store posts state
  const [storePosts, setStorePosts] = useState<StorePost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("menu");

  // Noodle options popup state
  const [optionsItem, setOptionsItem] = useState<MenuItemRow | null>(null);
  const [selectedNoodleType, setSelectedNoodleType] = useState<string>("");
  const [selectedNoodleStyle, setSelectedNoodleStyle] = useState<string>("");
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);
  const [selectedSize, setSelectedSize] = useState<"ธรรมดา" | "พิเศษ">("ธรรมดา");

  // Detail sheet state
  const [detailItem, setDetailItem] = useState<MenuItemRow | null>(null);

  useEffect(() => {
    if (!storeId) return;
    fetchData();
  }, [storeId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [storeRes, menuRes] = await Promise.all([
        supabase.from("stores").select("name").eq("id", storeId!).single(),
        supabase
          .from("menu_items")
          .select("id, name, price, price_special, type, noodle_types, noodle_styles, toppings, image_url")
          .eq("store_id", storeId!)
          .order("name"),
      ]);

      if (storeRes.data) {
        setStoreName(storeRes.data.name);
        setOrderStore(storeId!, storeRes.data.name);
      }
      const menuData = menuRes.data || [];
      setMenuItems(menuData);

      // Fetch Dish DNA for these menu items
      if (menuData.length > 0) {
        const menuIds = menuData.map((m) => m.id);
        const [dnaRes, menuRevRes] = await Promise.all([
          supabase
            .from("dish_dna")
            .select("menu_item_id, component_icon, component_name, selected_tag, selected_score")
            .in("menu_item_id", menuIds),
          supabase
            .from("menu_reviews")
            .select("id, menu_item_id")
            .in("menu_item_id", menuIds),
        ]);

        // Menu review counts
        const revCounts = new Map<string, number>();
        const reviewIdToMenuItem = new Map<string, string>();
        (menuRevRes.data || []).forEach((r) => {
          revCounts.set(r.menu_item_id, (revCounts.get(r.menu_item_id) || 0) + 1);
          reviewIdToMenuItem.set(r.id, r.menu_item_id);
        });
        setMenuReviewCounts(revCounts);

        // Fetch most-liked user photos per menu item
        const reviewIds = (menuRevRes.data || []).map((r) => r.id);
        if (reviewIds.length > 0) {
          const { data: postImages } = await supabase
            .from("post_images")
            .select("image_url, post_id, menu_review_id")
            .in("menu_review_id", reviewIds);

          if (postImages && postImages.length > 0) {
            const postIds = [...new Set(postImages.map((pi) => pi.post_id))];
            const { data: likes } = await supabase
              .from("post_likes")
              .select("ref_id")
              .in("ref_id", postIds);

            const likesMap = new Map<string, number>();
            (likes || []).forEach((l) => likesMap.set(l.ref_id, (likesMap.get(l.ref_id) || 0) + 1));

            // Group images by menu_item_id, sorted by likes desc
            const itemPhotos = new Map<string, { url: string; likes: number }[]>();
            postImages.forEach((pi) => {
              if (!pi.menu_review_id) return;
              const menuItemId = reviewIdToMenuItem.get(pi.menu_review_id);
              if (!menuItemId) return;
              const lc = likesMap.get(pi.post_id) || 0;
              if (!itemPhotos.has(menuItemId)) itemPhotos.set(menuItemId, []);
              itemPhotos.get(menuItemId)!.push({ url: pi.image_url, likes: lc });
            });

            const photoMap = new Map<string, string[]>();
            itemPhotos.forEach((photos, k) => {
              photos.sort((a, b) => b.likes - a.likes);
              photoMap.set(k, photos.slice(0, 4).map((p) => p.url));
            });
            setTopPhotoByItem(photoMap);
          }
        }

        // DNA counts per item
        const dnaCountMap = new Map<string, number>();
        const dnaRows = dnaRes.data || [];
        dnaRows.forEach((r) => {
          dnaCountMap.set(r.menu_item_id, (dnaCountMap.get(r.menu_item_id) || 0) + 1);
        });
        setDnaCounts(dnaCountMap);

        // Aggregate DNA tags
        if (dnaRows.length > 0) {
          const tagMap = new Map<string, Map<string, DnaTag>>();
          dnaRows.forEach((r) => {
            if (!tagMap.has(r.menu_item_id)) tagMap.set(r.menu_item_id, new Map());
            const itemMap = tagMap.get(r.menu_item_id)!;
            const key = `${r.component_name}::${r.selected_tag}`;
            if (!itemMap.has(key)) {
              itemMap.set(key, {
                component_icon: r.component_icon,
                component_name: r.component_name,
                selected_tag: r.selected_tag,
                selected_score: 0, // will hold sum, then averaged
                count: 0,
              });
            }
            const entry = itemMap.get(key)!;
            entry.selected_score += r.selected_score;
            entry.count++;
          });

          const result = new Map<string, DnaTag[]>();
          tagMap.forEach((itemMap, menuItemId) => {
            const tags = Array.from(itemMap.values()).map((t) => ({
              ...t,
              selected_score: t.count > 0 ? t.selected_score / t.count : 0, // average
            }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 3);
            result.set(menuItemId, tags);
          });
          setDnaByItem(result);
        }
      }
    } catch (err) {
      console.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStorePosts = async () => {
    if (!storeId) return;
    setPostsLoading(true);
    try {
      const { data: postsData } = await supabase
        .from("posts")
        .select("id, image_url, caption, created_at, user_id")
        .eq("store_id", storeId)
        .eq("hidden", false)
        .order("created_at", { ascending: false });

      if (!postsData || postsData.length === 0) {
        setStorePosts([]);
        return;
      }

      const userIds = [...new Set(postsData.map((p) => p.user_id))];
      const postIds = postsData.map((p) => p.id);

      const [profilesRes, likesRes, commentsRes] = await Promise.all([
        supabase.from("profiles").select("id, display_name, avatar_url").in("id", userIds),
        supabase.from("post_likes").select("ref_id").in("ref_id", postIds),
        supabase.from("feed_comments").select("ref_id").in("ref_id", postIds),
      ]);

      const profileMap = new Map<string, { display_name: string | null; avatar_url: string | null }>();
      (profilesRes.data || []).forEach((p) => profileMap.set(p.id, p));

      const likesMap = new Map<string, number>();
      (likesRes.data || []).forEach((l) => likesMap.set(l.ref_id, (likesMap.get(l.ref_id) || 0) + 1));

      const commentsMap = new Map<string, number>();
      (commentsRes.data || []).forEach((c) => commentsMap.set(c.ref_id, (commentsMap.get(c.ref_id) || 0) + 1));

      setStorePosts(
        postsData.map((p) => ({
          ...p,
          profile: profileMap.get(p.user_id) || null,
          likes_count: likesMap.get(p.id) || 0,
          comments_count: commentsMap.get(p.id) || 0,
        }))
      );
    } catch (err) {
      console.error("Failed to fetch store posts:", err);
    } finally {
      setPostsLoading(false);
    }
  };

  const getItemQuantity = (menuItemId: string) => {
    return items.find((i) => i.menuItemId === menuItemId)?.quantity || 0;
  };

  const hasOptions = (item: MenuItemRow) => {
    return (
      (item.price_special != null) ||
      (item.noodle_types && item.noodle_types.length > 0) ||
      (item.noodle_styles && item.noodle_styles.length > 0) ||
      (item.toppings && item.toppings.length > 0)
    );
  };

  const openOptionsPopup = (item: MenuItemRow) => {
    setOptionsItem(item);
    setSelectedNoodleType(item.noodle_types?.[0] || "");
    setSelectedNoodleStyle(item.noodle_styles?.[0] || "");
    setSelectedToppings([]);
    setSelectedSize("ธรรมดา");
  };

  const handleAddWithOptions = () => {
    if (!optionsItem) return;
    if (navigator.vibrate) navigator.vibrate(8);
    const useSpecial = selectedSize === "พิเศษ" && optionsItem.price_special != null;
    addItem({
      menuItemId: optionsItem.id,
      name: optionsItem.name,
      price: useSpecial ? optionsItem.price_special! : optionsItem.price,
      quantity: 1,
      type: optionsItem.type,
      selectedOptions: {
        size: optionsItem.price_special != null ? selectedSize : undefined,
        noodleType: selectedNoodleType || undefined,
        noodleStyle: selectedNoodleStyle || undefined,
        toppings: selectedToppings.length > 0 ? selectedToppings : undefined,
      },
    });
    setOptionsItem(null);
  };

  const handleAddSimple = (item: MenuItemRow) => {
    if (item.price_special != null) {
      openOptionsPopup(item);
      return;
    }
    if (navigator.vibrate) navigator.vibrate(8);
    addItem({
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
      type: item.type,
    });
  };

  const handleMinus = (menuItemId: string) => {
    if (navigator.vibrate) navigator.vibrate(8);
    const qty = getItemQuantity(menuItemId);
    if (qty <= 1) {
      removeItem(menuItemId);
    } else {
      updateQuantity(menuItemId, qty - 1);
    }
  };

  const toggleTopping = (t: string) => {
    setSelectedToppings((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  // typeEmoji not needed anymore with SovereignMenuCard

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-32">
        {/* Header */}
        <div className="sticky top-0 z-10 glass-effect glass-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => navigate("/store-list")}
              className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors"
            >
              <ChevronLeft size={22} strokeWidth={1.5} className="text-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-medium tracking-tight text-foreground truncate">
                {storeName || "ร้านอาหาร"}
              </h1>
            </div>
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v);
            if (v === "posts" && storePosts.length === 0 && !postsLoading) {
              fetchStorePosts();
            }
          }}
          className="w-full"
        >
          <TabsList className="w-full rounded-none bg-secondary/50 h-11 p-0 border-b border-border/30">
            <TabsTrigger
              value="menu"
              className="flex-1 rounded-none h-full data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-score-emerald data-[state=active]:text-foreground text-muted-foreground text-sm font-medium"
            >
              🍽️ เมนู
            </TabsTrigger>
            <TabsTrigger
              value="posts"
              className="flex-1 rounded-none h-full data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-score-emerald data-[state=active]:text-foreground text-muted-foreground text-sm font-medium"
            >
              📸 โพสจากลูกค้า
            </TabsTrigger>
          </TabsList>

          <TabsContent value="menu" className="mt-0">
            <div className="px-4 pt-4 space-y-2">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-10 h-10 rounded-full border-2 border-score-emerald border-t-transparent animate-spin" />
                  <span className="text-xs text-muted-foreground">กำลังโหลดเมนู...</span>
                </div>
              ) : menuItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <p className="text-sm text-muted-foreground">ยังไม่มีเมนูในร้านนี้</p>
                </div>
              ) : (
                <AnimatePresence>
                  {menuItems.map((item, i) => {
                    const qty = getItemQuantity(item.id);
                    const tags = (dnaByItem.get(item.id) || [])
                      .sort((a, b) => b.count - a.count)
                      .map((t) => ({
                        icon: t.component_icon,
                        label: t.selected_tag,
                        score: t.selected_score, // average sentiment from community
                        count: t.count,
                        type: "texture" as const,
                      }));
                    const totalRevs = (menuReviewCounts.get(item.id) || 0) + (dnaCounts.get(item.id) || 0);

                    return (
                      <div key={item.id} className="relative">
                        <SovereignMenuCard
                          name={item.name}
                          price={item.price}
                          priceSpecial={item.price_special}
                          imageUrl={topPhotoByItem.get(item.id)?.[0] || item.image_url || undefined}
                          tags={tags}
                          totalReviews={totalRevs}
                          onPress={() => setDetailItem(item)}
                          index={i}
                          userPhotos={topPhotoByItem.get(item.id)}
                        />

                        {/* Quantity overlay */}
                        <div className="absolute top-2 right-2 z-10">
                          {qty === 0 ? (
                            <motion.button
                              whileTap={{ scale: 0.85 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                hasOptions(item) ? openOptionsPopup(item) : handleAddSimple(item);
                              }}
                              className="w-9 h-9 rounded-xl bg-score-emerald flex items-center justify-center shadow-sm"
                            >
                              <Plus size={16} strokeWidth={2.5} className="text-primary-foreground" />
                            </motion.button>
                          ) : (
                            <div className="flex items-center gap-1.5 bg-background/90 rounded-xl px-1.5 py-1 shadow-sm border border-border/40">
                              <motion.button
                                whileTap={{ scale: 0.85 }}
                                onClick={(e) => { e.stopPropagation(); handleMinus(item.id); }}
                                className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center"
                              >
                                <Minus size={12} strokeWidth={2} className="text-foreground" />
                              </motion.button>
                              <span className="text-xs font-bold text-foreground w-4 text-center">{qty}</span>
                              <motion.button
                                whileTap={{ scale: 0.85 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  hasOptions(item) ? openOptionsPopup(item) : handleAddSimple(item);
                                }}
                                className="w-7 h-7 rounded-lg bg-score-emerald flex items-center justify-center"
                              >
                                <Plus size={12} strokeWidth={2} className="text-primary-foreground" />
                              </motion.button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </TabsContent>

          <TabsContent value="posts" className="mt-0">
            <div className="px-4 pt-4">
              {postsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-10 h-10 rounded-full border-2 border-score-emerald border-t-transparent animate-spin" />
                  <span className="text-xs text-muted-foreground">กำลังโหลดโพส...</span>
                </div>
              ) : storePosts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <span className="text-4xl">📸</span>
                  <p className="text-sm text-muted-foreground">ยังไม่มีโพสจากลูกค้า</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {storePosts.map((post) => (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl overflow-hidden border border-border/40 bg-card"
                    >
                      {/* Post image */}
                      <div className="aspect-[4/3] overflow-hidden">
                        <img
                          src={post.image_url}
                          alt={post.caption || "โพสจากลูกค้า"}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>

                      <div className="p-3 space-y-2">
                        {/* Author row */}
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-secondary overflow-hidden flex-shrink-0">
                            {post.profile?.avatar_url ? (
                              <img src={post.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">👤</div>
                            )}
                          </div>
                          <span className="text-xs font-medium text-foreground truncate">
                            {post.profile?.display_name || "ผู้ใช้"}
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">
                            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: th })}
                          </span>
                        </div>

                        {/* Caption */}
                        {post.caption && (
                          <p className="text-xs text-foreground/80 line-clamp-2">{post.caption}</p>
                        )}

                        {/* Likes & Comments */}
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Heart size={14} strokeWidth={1.5} />
                            <span className="text-[11px]">{post.likes_count}</span>
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <MessageCircle size={14} strokeWidth={1.5} />
                            <span className="text-[11px]">{post.comments_count}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Options Popup */}
        <AnimatePresence>
          {optionsItem && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-foreground/40 flex items-end justify-center"
              onClick={() => setOptionsItem(null)}
            >
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 380, damping: 34 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg bg-background rounded-t-3xl shadow-luxury overflow-hidden"
              >
                {/* Popup Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-foreground">{optionsItem.name}</h3>
                    <p className="text-xs text-score-emerald font-semibold mt-0.5">
                      ฿{selectedSize === "พิเศษ" && optionsItem.price_special ? optionsItem.price_special : optionsItem.price}
                    </p>
                  </div>
                  <button
                    onClick={() => setOptionsItem(null)}
                    className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center"
                  >
                    <X size={16} strokeWidth={2} className="text-muted-foreground" />
                  </button>
                </div>

                <div className="px-5 pb-6 space-y-5 max-h-[60vh] overflow-y-auto">
                  {/* Size Selection (ธรรมดา / พิเศษ) */}
                  {optionsItem.price_special != null && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        💰 เลือกขนาด
                      </p>
                      <div className="flex gap-2">
                        <motion.button
                          whileTap={{ scale: 0.93 }}
                          onClick={() => setSelectedSize("ธรรมดา")}
                          className={`flex-1 px-3 py-3 rounded-xl text-xs font-medium border transition-all text-center ${
                            selectedSize === "ธรรมดา"
                              ? "bg-score-emerald text-primary-foreground border-score-emerald shadow-sm"
                              : "bg-surface-elevated text-foreground border-border/50"
                          }`}
                        >
                          <span className="block font-bold">ธรรมดา</span>
                          <span className="block text-[10px] mt-0.5 opacity-80">฿{optionsItem.price}</span>
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.93 }}
                          onClick={() => setSelectedSize("พิเศษ")}
                          className={`flex-1 px-3 py-3 rounded-xl text-xs font-medium border transition-all text-center ${
                            selectedSize === "พิเศษ"
                              ? "bg-score-emerald text-primary-foreground border-score-emerald shadow-sm"
                              : "bg-surface-elevated text-foreground border-border/50"
                          }`}
                        >
                          <span className="block font-bold">พิเศษ</span>
                          <span className="block text-[10px] mt-0.5 opacity-80">฿{optionsItem.price_special}</span>
                        </motion.button>
                      </div>
                    </div>
                  )}
                  {/* Noodle Types */}
                  {optionsItem.noodle_types && optionsItem.noodle_types.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        🍜 เลือกเส้น
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {optionsItem.noodle_types.map((nt) => (
                          <motion.button
                            key={nt}
                            whileTap={{ scale: 0.93 }}
                            onClick={() => setSelectedNoodleType(nt)}
                            className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                              selectedNoodleType === nt
                                ? "bg-score-emerald text-primary-foreground border-score-emerald shadow-sm"
                                : "bg-surface-elevated text-foreground border-border/50"
                            }`}
                          >
                            {nt}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Noodle Styles */}
                  {optionsItem.noodle_styles && optionsItem.noodle_styles.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        🍲 เลือกแบบ
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {optionsItem.noodle_styles.map((ns) => (
                          <motion.button
                            key={ns}
                            whileTap={{ scale: 0.93 }}
                            onClick={() => setSelectedNoodleStyle(ns)}
                            className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                              selectedNoodleStyle === ns
                                ? "bg-score-emerald text-primary-foreground border-score-emerald shadow-sm"
                                : "bg-surface-elevated text-foreground border-border/50"
                            }`}
                          >
                            {ns}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Toppings */}
                  {optionsItem.toppings && optionsItem.toppings.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        🥩 เลือกท็อปปิ้ง (เลือกได้หลายอย่าง)
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {optionsItem.toppings.map((t) => {
                          const selected = selectedToppings.includes(t);
                          return (
                            <motion.button
                              key={t}
                              whileTap={{ scale: 0.93 }}
                              onClick={() => toggleTopping(t)}
                              className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 ${
                                selected
                                  ? "bg-score-emerald text-primary-foreground border-score-emerald shadow-sm"
                                  : "bg-surface-elevated text-foreground border-border/50"
                              }`}
                            >
                              {selected && <Check size={12} strokeWidth={2.5} />}
                              {t}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm */}
                <div className="px-5 pb-8 pt-2">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleAddWithOptions}
                    className="w-full py-3.5 rounded-2xl bg-score-emerald text-primary-foreground text-sm font-bold shadow-luxury"
                  >
                    เพิ่มลงออเดอร์
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating order button */}
        <AnimatePresence>
          {totalItems > 0 && !optionsItem && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              className="fixed bottom-6 left-4 right-4 z-40"
            >
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate("/order-summary")}
                className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-score-emerald text-primary-foreground shadow-luxury"
              >
                <div className="flex items-center gap-3">
                  <ShoppingBag size={20} strokeWidth={2} />
                  <span className="text-sm font-bold">ดูออเดอร์</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs opacity-80">{totalItems} รายการ</span>
                  <span className="text-sm font-bold">฿{totalPrice.toLocaleString()}</span>
                </div>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dish Detail Sheet */}
        {detailItem && (
          <DishDetailSheet
            open={!!detailItem}
            onClose={() => setDetailItem(null)}
            menuItemId={detailItem.id}
            dishName={detailItem.name}
            price={detailItem.price}
            priceSpecial={detailItem.price_special}
            dnaTags={dnaByItem.get(detailItem.id) || []}
            totalReviews={(menuReviewCounts.get(detailItem.id) || 0) + (dnaCounts.get(detailItem.id) || 0)}
          />
        )}
      </div>
    </PageTransition>
  );
};

export default StoreOrder;
