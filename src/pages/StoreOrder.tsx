import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ShoppingBag, Plus, Minus, X, Check, Heart, MessageCircle, Users } from "lucide-react";
import KaraokeName from "@/components/KaraokeName";
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
import LiveQueueCard from "@/components/queue/LiveQueueCard";
import { useTagTranslations } from "@/hooks/use-tag-translations";
import StoreDetailsTab from "@/components/store/StoreDetailsTab";

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
  noodle_type_prices: Record<string, number> | null;
  noodle_style_prices: Record<string, number> | null;
  menu_category: string | null;
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
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { storeId } = useParams<{ storeId: string }>();
  const { items, addItem, updateQuantity, removeItem, setOrderStore, totalItems, totalPrice } = useOrder();

  // Store posts state
  const [storePosts, setStorePosts] = useState<StorePost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("menu");
  const [activeCat, setActiveCat] = useState("ทั้งหมด");

  // Noodle options popup state
  const [optionsItem, setOptionsItem] = useState<MenuItemRow | null>(null);
  const [selectedNoodleType, setSelectedNoodleType] = useState<string>("");
  const [selectedNoodleStyle, setSelectedNoodleStyle] = useState<string>("");
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);
  const [selectedSize, setSelectedSize] = useState<"ธรรมดา" | "พิเศษ">("ธรรมดา");
  const [selectedAddOns, setSelectedAddOns] = useState<{ name: string; price: number }[]>([]);

  // Detail sheet state
  const [detailItem, setDetailItem] = useState<MenuItemRow | null>(null);

  const {
    data: storeData,
    isLoading: loading,
  } = useQuery({
    queryKey: ["store-order", storeId, language],
    queryFn: async () => {
      const [storeRes, menuRes] = await Promise.all([
        supabase.from("stores").select("name, category_id").eq("id", storeId!).single(),
        supabase
          .from("menu_items")
          .select("id, name, price, price_special, type, noodle_types, noodle_styles, toppings, image_url, noodle_type_prices, noodle_style_prices, menu_category")
          .eq("store_id", storeId!)
          .order("sort_order", { ascending: true }),
      ]);

      const store = storeRes.data;
      const menuData = (menuRes.data || []).map((m: any) => ({
        ...m,
        noodle_type_prices: (m.noodle_type_prices as Record<string, number>) || {},
        noodle_style_prices: (m.noodle_style_prices as Record<string, number>) || {},
      })) as MenuItemRow[];

      // Fetch add-ons, DNA, reviews, photos in parallel
      let addOnsMap = new Map<string, { id: string; name: string; price: number; category: string }[]>();
      let dnaMap = new Map<string, DnaTag[]>();
      let revCounts = new Map<string, number>();
      let dnaCountMap = new Map<string, number>();
      let photoMap = new Map<string, string[]>();
      let tMap = new Map<string, { name: string; description?: string }>();

      if (menuData.length > 0) {
        const menuIds = menuData.map((m) => m.id);

        const baseFetches = [
          supabase.from("menu_addons").select("id, menu_item_id, name, price, category").in("menu_item_id", menuIds).order("category").order("sort_order"),
          supabase.from("dish_dna").select("menu_item_id, component_icon, component_name, selected_tag, selected_score").in("menu_item_id", menuIds),
          supabase.from("menu_reviews").select("id, menu_item_id").in("menu_item_id", menuIds),
        ] as const;

        const transFetch = language !== "th"
          ? supabase.from("menu_translations").select("menu_item_id, name, description").eq("language", language).in("menu_item_id", menuIds)
          : null;

        const [addOnsRes, dnaRes, menuRevRes] = await Promise.all(baseFetches);
        const transRes = transFetch ? await transFetch : null;

        // Add-ons
        (addOnsRes.data || []).forEach((a: any) => {
          if (!addOnsMap.has(a.menu_item_id)) addOnsMap.set(a.menu_item_id, []);
          addOnsMap.get(a.menu_item_id)!.push({ id: a.id, name: a.name, price: a.price, category: a.category });
        });

        // Review counts
        const reviewIdToMenuItem = new Map<string, string>();
        (menuRevRes.data || []).forEach((r: any) => {
          revCounts.set(r.menu_item_id, (revCounts.get(r.menu_item_id) || 0) + 1);
          reviewIdToMenuItem.set(r.id, r.menu_item_id);
        });

        // Top photos
        const reviewIds = (menuRevRes.data || []).map((r: any) => r.id);
        if (reviewIds.length > 0) {
          const { data: postImages } = await supabase.from("post_images").select("image_url, post_id, menu_review_id").in("menu_review_id", reviewIds);
          if (postImages && postImages.length > 0) {
            const postIds = [...new Set(postImages.map((pi) => pi.post_id))];
            const { data: likes } = await supabase.from("post_likes").select("ref_id").in("ref_id", postIds);
            const likesMap = new Map<string, number>();
            (likes || []).forEach((l) => likesMap.set(l.ref_id, (likesMap.get(l.ref_id) || 0) + 1));
            const itemPhotos = new Map<string, { url: string; likes: number }[]>();
            postImages.forEach((pi) => {
              if (!pi.menu_review_id) return;
              const menuItemId = reviewIdToMenuItem.get(pi.menu_review_id);
              if (!menuItemId) return;
              if (!itemPhotos.has(menuItemId)) itemPhotos.set(menuItemId, []);
              itemPhotos.get(menuItemId)!.push({ url: pi.image_url, likes: likesMap.get(pi.post_id) || 0 });
            });
            itemPhotos.forEach((photos, k) => {
              photos.sort((a, b) => b.likes - a.likes);
              photoMap.set(k, photos.slice(0, 4).map((p) => p.url));
            });
          }
        }

        // DNA
        const dnaRows = dnaRes.data || [];
        dnaRows.forEach((r: any) => dnaCountMap.set(r.menu_item_id, (dnaCountMap.get(r.menu_item_id) || 0) + 1));
        if (dnaRows.length > 0) {
          const tagMap = new Map<string, Map<string, DnaTag>>();
          dnaRows.forEach((r: any) => {
            if (!tagMap.has(r.menu_item_id)) tagMap.set(r.menu_item_id, new Map());
            const itemMap = tagMap.get(r.menu_item_id)!;
            const key = `${r.component_name}::${r.selected_tag}`;
            if (!itemMap.has(key)) {
              itemMap.set(key, { component_icon: r.component_icon, component_name: r.component_name, selected_tag: r.selected_tag, selected_score: 0, count: 0 });
            }
            const entry = itemMap.get(key)!;
            entry.selected_score += r.selected_score;
            entry.count++;
          });
          tagMap.forEach((itemMap, menuItemId) => {
            const tags = Array.from(itemMap.values()).map((t) => ({ ...t, selected_score: t.count > 0 ? t.selected_score / t.count : 0 })).sort((a, b) => b.count - a.count).slice(0, 3);
            dnaMap.set(menuItemId, tags);
          });
        }

        // Translations
        if (transRes?.data) {
          (transRes.data as any[]).forEach((row: any) => {
            tMap.set(row.menu_item_id, { name: row.name, description: row.description || undefined });
          });
        }
      }

      return {
        storeName: store?.name || "",
        storeCategoryId: store?.category_id || null,
        menuItems: menuData,
        itemAddOns: addOnsMap,
        dnaByItem: dnaMap,
        menuReviewCounts: revCounts,
        dnaCounts: dnaCountMap,
        topPhotoByItem: photoMap,
        translationMap: tMap,
      };
    },
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Extract data from query result
  const storeName = storeData?.storeName || "";
  const storeCategoryId = storeData?.storeCategoryId || null;
  const menuItems = storeData?.menuItems || [];
  const itemAddOns = storeData?.itemAddOns || new Map();
  const dnaByItem = storeData?.dnaByItem || new Map();
  const menuReviewCounts = storeData?.menuReviewCounts || new Map();
  const dnaCounts = storeData?.dnaCounts || new Map();
  const topPhotoByItem = storeData?.topPhotoByItem || new Map();
  const translationMap = storeData?.translationMap || new Map();

  // Collect all DNA tag texts for translation
  const allTagTexts = useMemo(() => {
    const tags = new Set<string>();
    dnaByItem.forEach((dnaTags: DnaTag[]) => {
      dnaTags.forEach((t) => {
        tags.add(t.selected_tag);
        tags.add(t.component_name);
      });
    });
    menuItems.forEach((m: MenuItemRow) => {
      m.noodle_types?.forEach((nt) => tags.add(nt));
      m.noodle_styles?.forEach((ns) => tags.add(ns));
      m.toppings?.forEach((tp) => tags.add(tp));
      if (m.menu_category) tags.add(m.menu_category);
    });
    if (storeName) tags.add(storeName);
    itemAddOns.forEach((addOns: any[]) => {
      addOns.forEach((a: any) => tags.add(a.category));
    });
    return Array.from(tags);
  }, [dnaByItem, menuItems, itemAddOns, storeName]);

  const { translateTag } = useTagTranslations(allTagTexts);


  // Set order store when data loads
  useEffect(() => {
    if (storeData && storeId) {
      setOrderStore(storeId, storeData.storeName);
    }
  }, [storeData, storeId]);

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
      (item.toppings && item.toppings.length > 0) ||
      (itemAddOns.get(item.id)?.length ?? 0) > 0
    );
  };

  const openOptionsPopup = (item: MenuItemRow) => {
    setOptionsItem(item);
    setSelectedNoodleType(item.noodle_types?.[0] || "");
    setSelectedNoodleStyle(item.noodle_styles?.[0] || "");
    setSelectedToppings([]);
    setSelectedAddOns([]);
    setSelectedSize("ธรรมดา");
  };

  const handleAddWithOptions = () => {
    if (!optionsItem) return;
    if (navigator.vibrate) navigator.vibrate(8);
    const useSpecial = selectedSize === "พิเศษ" && optionsItem.price_special != null;
    const basePrice = useSpecial ? optionsItem.price_special! : optionsItem.price;
    const addOnTotal = selectedAddOns.reduce((s, a) => s + a.price, 0);
    const noodleExtra = selectedNoodleType && optionsItem.noodle_type_prices
      ? (optionsItem.noodle_type_prices[selectedNoodleType] || 0)
      : 0;
    const styleExtra = selectedNoodleStyle && optionsItem.noodle_style_prices
      ? (optionsItem.noodle_style_prices[selectedNoodleStyle] || 0)
      : 0;
    addItem({
      menuItemId: optionsItem.id,
      name: optionsItem.name,
      price: basePrice + addOnTotal + noodleExtra + styleExtra,
      quantity: 1,
      type: optionsItem.type,
      selectedOptions: {
        size: optionsItem.price_special != null ? selectedSize : undefined,
        noodleType: selectedNoodleType || undefined,
        noodleTypePrice: noodleExtra > 0 ? noodleExtra : undefined,
        noodleStyle: selectedNoodleStyle || undefined,
        noodleStylePrice: styleExtra > 0 ? styleExtra : undefined,
        toppings: selectedToppings.length > 0 ? selectedToppings : undefined,
        addOns: selectedAddOns.length > 0 ? selectedAddOns.map(a => a.name) : undefined,
      },
    });
    setOptionsItem(null);
  };

  const toggleAddOn = (addon: { name: string; price: number }) => {
    setSelectedAddOns((prev) => {
      const exists = prev.find((a) => a.name === addon.name);
      if (exists) return prev.filter((a) => a.name !== addon.name);
      if (prev.length >= MAX_TOPPINGS) return prev;
      return [...prev, addon];
    });
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

  const MAX_TOPPINGS = 3;
  const toggleTopping = (tp: string) => {
    setSelectedToppings((prev) => {
      if (prev.includes(tp)) return prev.filter((x) => x !== tp);
      if (prev.length >= MAX_TOPPINGS) return prev;
      return [...prev, tp];
    });
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
              <KaraokeName
                original={storeName || t("order.restaurant", language)}
                translated={storeName && translateTag(storeName) !== storeName ? translateTag(storeName) : undefined}
                className="text-lg font-medium tracking-tight text-foreground leading-tight"
                subClassName="text-[10px] text-muted-foreground leading-tight"
              />
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
              🍽️ {t("order.menu", language)}
            </TabsTrigger>
            <TabsTrigger
              value="queue"
              className="flex-1 rounded-none h-full data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-score-emerald data-[state=active]:text-foreground text-muted-foreground text-sm font-medium"
            >
              🎫 {t("queue.title", language)}
            </TabsTrigger>
            <TabsTrigger
              value="details"
              className="flex-1 rounded-none h-full data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-score-emerald data-[state=active]:text-foreground text-muted-foreground text-sm font-medium"
            >
              📋 {t("storeDetail.details", language)}
            </TabsTrigger>
            <TabsTrigger
              value="posts"
              className="flex-1 rounded-none h-full data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-score-emerald data-[state=active]:text-foreground text-muted-foreground text-sm font-medium"
            >
              📸 {t("order.customerPosts", language)}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="menu" className="mt-0">
            {/* Category filter chips */}
            {(() => {
              const cats = Array.from(new Set(menuItems.map((m) => m.menu_category).filter(Boolean))) as string[];
              if (cats.length === 0) return null;
              const allLabel = t("queueMgr.filterAll", language);
              const allCats = [allLabel, ...cats];
              const countMap = new Map<string, number>();
              menuItems.forEach((m) => {
                if (m.menu_category) countMap.set(m.menu_category, (countMap.get(m.menu_category) || 0) + 1);
              });
              return (
                <div className="px-4 pt-3 pb-1 flex gap-2 overflow-x-auto no-scrollbar">
                  {allCats.map((cat, idx) => {
                    const isAll = idx === 0;
                    const rawCat = isAll ? "ทั้งหมด" : cat;
                    const count = isAll ? menuItems.length : (countMap.get(cat) || 0);
                    return (
                      <button
                        key={cat}
                        onClick={() => setActiveCat(rawCat)}
                        className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                          activeCat === rawCat ? "bg-score-emerald text-primary-foreground shadow-sm" : "bg-secondary text-foreground"
                        }`}
                      >
                        {isAll ? allLabel : translateTag(cat)}
                        <span className={`text-[10px] ${activeCat === cat ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
            <div className="px-4 pt-4 space-y-2">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-10 h-10 rounded-full border-2 border-score-emerald border-t-transparent animate-spin" />
                  <span className="text-xs text-muted-foreground">{t("order.loadingMenu", language)}</span>
                </div>
              ) : menuItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <p className="text-sm text-muted-foreground">{t("order.noMenu", language)}</p>
                </div>
              ) : (
                <AnimatePresence>
                  {menuItems
                    .filter((item) => activeCat === "ทั้งหมด" || item.menu_category === activeCat)
                    .map((item, i) => {
                    const qty = getItemQuantity(item.id);
                    const tags = (dnaByItem.get(item.id) || [])
                      .sort((a, b) => b.count - a.count)
                      .map((t) => ({
                        icon: t.component_icon,
                        label: translateTag(t.selected_tag),
                        score: t.selected_score,
                        count: t.count,
                        type: "texture" as const,
                      }));
                    const totalRevs = (menuReviewCounts.get(item.id) || 0) + (dnaCounts.get(item.id) || 0);
                    const tr = translationMap.get(item.id);
                    const displayName = tr?.name || item.name;
                    const originalName = tr ? item.name : undefined;

                    return (
                      <div key={item.id} className="relative">
                        <SovereignMenuCard
                          name={displayName}
                          originalName={originalName}
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

          <TabsContent value="queue" className="mt-0">
            {storeId && <LiveQueueCard storeId={storeId} storeLat={null} storeLng={null} />}
          </TabsContent>

          <TabsContent value="posts" className="mt-0">
            <div className="px-4 pt-4">
              {postsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-10 h-10 rounded-full border-2 border-score-emerald border-t-transparent animate-spin" />
                  <span className="text-xs text-muted-foreground">{t("order.loadingPosts", language)}</span>
                </div>
              ) : storePosts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <span className="text-4xl">📸</span>
                  <p className="text-sm text-muted-foreground">{t("order.noPosts", language)}</p>
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
                          alt={post.caption || t("order.customerPost", language)}
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
                            {post.profile?.display_name || t("order.user", language)}
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

          <TabsContent value="details" className="mt-0">
            {storeId && <StoreDetailsTab storeId={storeId} storeName={storeName} categoryId={storeCategoryId} />}
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
                        💰 {t("order.selectSize", language)}
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
                          <span className="block font-bold">{t("order.regular", language)}</span>
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
                          <span className="block font-bold">{t("order.special", language)}</span>
                          <span className="block text-[10px] mt-0.5 opacity-80">฿{optionsItem.price_special}</span>
                        </motion.button>
                      </div>
                    </div>
                  )}
                  {/* Noodle Types */}
                  {optionsItem.noodle_types && optionsItem.noodle_types.length > 0 && (
                    <div>
                       <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        🍜 {t("order.selectNoodle", language)}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {optionsItem.noodle_types.map((nt) => {
                          const extraPrice = optionsItem.noodle_type_prices?.[nt] || 0;
                          return (
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
                            <span className="flex flex-col items-start leading-tight">
                              <span>{translateTag(nt)}</span>
                              {language !== "th" && translateTag(nt) !== nt && (
                                <span className="text-[8px] opacity-60">{nt}</span>
                              )}
                            </span>
                            {extraPrice > 0 && <span className="ml-1 opacity-80">(+฿{extraPrice})</span>}
                          </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Noodle Styles */}
                  {optionsItem.noodle_styles && optionsItem.noodle_styles.length > 0 && (
                    <div>
                       <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        🍲 {t("order.selectStyle", language)}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {optionsItem.noodle_styles.map((ns) => {
                          const extraPrice = optionsItem.noodle_style_prices?.[ns] || 0;
                          return (
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
                            <span className="flex flex-col items-start leading-tight">
                              <span>{translateTag(ns)}</span>
                              {language !== "th" && translateTag(ns) !== ns && (
                                <span className="text-[8px] opacity-60">{ns}</span>
                              )}
                            </span>
                            {extraPrice > 0 && <span className="ml-1 opacity-80">(+฿{extraPrice})</span>}
                          </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Toppings */}
                  {optionsItem.toppings && optionsItem.toppings.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        🥩 {t("order.selectToppings", language)} <span className="text-muted-foreground/60">({selectedToppings.length}/{MAX_TOPPINGS})</span>
                       </p>
                      <div className="flex flex-wrap gap-2">
                        {optionsItem.toppings.map((tp) => {
                          const selected = selectedToppings.includes(tp);
                          const disabled = !selected && selectedToppings.length >= MAX_TOPPINGS;
                          return (
                            <motion.button
                              key={tp}
                              whileTap={{ scale: 0.93 }}
                              onClick={() => !disabled && toggleTopping(tp)}
                              className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 ${
                                selected
                                  ? "bg-score-emerald text-primary-foreground border-score-emerald shadow-sm"
                                  : disabled
                                    ? "bg-secondary/50 text-muted-foreground border-border/30 opacity-50 cursor-not-allowed"
                                    : "bg-surface-elevated text-foreground border-border/50"
                              }`}
                            >
                              {selected && <Check size={12} strokeWidth={2.5} />}
                              <span className="flex flex-col items-start leading-tight">
                                <span>{translateTag(tp)}</span>
                                {language !== "th" && translateTag(tp) !== tp && (
                                  <span className="text-[8px] opacity-60">{tp}</span>
                                )}
                              </span>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Add-ons grouped by category */}
                  {(() => {
                    const addOns = itemAddOns.get(optionsItem.id) as { id: string; name: string; price: number; category: string }[] | undefined;
                    if (!addOns || addOns.length === 0) return null;
                    const grouped = addOns.reduce<Record<string, typeof addOns>>((acc, a) => {
                      (acc[a.category] = acc[a.category] || []).push(a);
                      return acc;
                    }, {});
                    const catEmoji: Record<string, string> = { "เนื้อสัตว์": "🥩", "ผัก": "🥬", "ซอส": "🫙", "อื่นๆ": "➕" };
                    return Object.entries(grouped).map(([cat, catItems]) => (
                      <div key={cat}>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                          {catEmoji[cat] || "📦"} {translateTag(cat)} <span className="text-muted-foreground/60">(เพิ่มเงิน)</span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {catItems.map((a) => {
                            const selected = selectedAddOns.some((sa) => sa.name === a.name);
                            return (
                              <motion.button
                                key={a.id}
                                whileTap={{ scale: 0.93 }}
                                onClick={() => toggleAddOn({ name: a.name, price: a.price })}
                                className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 ${
                                  selected
                                    ? "bg-score-amber text-primary-foreground border-score-amber shadow-sm"
                                    : "bg-surface-elevated text-foreground border-border/50"
                                }`}
                              >
                                {selected && <Check size={12} strokeWidth={2.5} />}
                                <span className="flex flex-col items-start leading-tight">
                                  <span>{translateTag(a.name)}</span>
                                  {language !== "th" && translateTag(a.name) !== a.name && (
                                    <span className="text-[8px] opacity-60">{a.name}</span>
                                  )}
                                </span>
                                <span className="opacity-70">+฿{a.price}</span>
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>

                <div className="px-5 pb-8 pt-2">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleAddWithOptions}
                    className="w-full py-3.5 rounded-2xl bg-score-emerald text-primary-foreground text-sm font-bold shadow-luxury"
                  >
                    {t("order.addToOrder", language)}
                    {(() => {
                      const noodleExtra = selectedNoodleType && optionsItem?.noodle_type_prices?.[selectedNoodleType] || 0;
                      const styleExtra = selectedNoodleStyle && optionsItem?.noodle_style_prices?.[selectedNoodleStyle] || 0;
                      const addOnExtra = selectedAddOns.reduce((s, a) => s + a.price, 0);
                      const total = noodleExtra + styleExtra + addOnExtra;
                      return total > 0 ? <span className="ml-1 opacity-80">(+฿{total})</span> : null;
                    })()}
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
                   <span className="text-sm font-bold">{t("order.viewOrder", language)}</span>
                 </div>
                 <div className="flex items-center gap-2">
                   <span className="text-xs opacity-80">{t("order.items", language, { count: totalItems })}</span>
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
            dishName={translationMap.get(detailItem.id)?.name || detailItem.name}
            originalDishName={translationMap.get(detailItem.id) ? detailItem.name : undefined}
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
