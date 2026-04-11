import { useState, useCallback, useRef, useEffect } from "react";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import {
  UtensilsCrossed, Plus, Pencil, Trash2, Save, X, Camera, ImageIcon, Loader2,
  Search, Globe, ChevronUp, ChevronDown, ArrowUpDown, Sparkles,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMerchant } from "@/lib/merchant-context";
import { useLanguage } from "@/lib/language-context";
import { toast } from "sonner";
import PageTransition from "@/components/PageTransition";
import MerchantBottomNav from "@/components/merchant/MerchantBottomNav";
import TagInput from "@/components/menu/TagInput";
import AddOnManager from "@/components/menu/AddOnManager";
import MenuTranslationSheet from "@/components/menu/MenuTranslationSheet";
import { preTranslateTags } from "@/lib/pre-translate";
type MenuItemRow = {
  id: string;
  name: string;
  original_name: string | null;
  description: string | null;
  type: string;
  price: number;
  price_special: number | null;
  noodle_types: string[] | null;
  noodle_styles: string[] | null;
  toppings: string[] | null;
  textures: string[] | null;
  image_url: string | null;
  noodle_type_prices: Record<string, number> | null;
  noodle_style_prices: Record<string, number> | null;
  topping_prices: Record<string, number> | null;
  menu_category: string | null;
};

const DEFAULT_MENU_CATEGORIES = ["แนะนำ", "ต้ม", "ผัด", "กับข้าว", "ราดข้าว", "ทอด", "ยำ", "อื่นๆ"];

const emptyForm = {
  name: "", original_name: "", description: "", type: "standard" as string,
  price: 0, price_special: null as number | null,
  noodle_types: [] as string[], noodle_styles: [] as string[],
  toppings: [] as string[], textures: [] as string[],
  noodle_type_prices: {} as Record<string, number>,
  noodle_style_prices: {} as Record<string, number>,
  topping_prices: {} as Record<string, number>,
  menu_category: "" as string,
};

const typeLabel: Record<string, string> = {
  standard: "🍽️ Standard", noodle: "🍜 Noodle", dual_price: "💰 Dual Price",
};

const MerchantMenu = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { activeStore, loading: storeLoading } = useMerchant();
  const { language, t } = useLanguage();
  const isTh = language === "th";
  const queryClient = useQueryClient();
  const storeId = activeStore?.id;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [orderedItems, setOrderedItems] = useState<MenuItemRow[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [translateItem, setTranslateItem] = useState<{ id: string; name: string; description?: string | null } | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [translatingDesc, setTranslatingDesc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inlineFileRef = useRef<HTMLInputElement>(null);
  const inlineTargetId = useRef<string | null>(null);

  const { data: menuCategories } = useQuery({
    queryKey: ["menu-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("site_config").select("value").eq("key", "menu_categories").maybeSingle();
      if (data?.value && Array.isArray(data.value)) return data.value as string[];
      return DEFAULT_MENU_CATEGORIES;
    },
  });
  const MENU_CATEGORIES = menuCategories || DEFAULT_MENU_CATEGORIES;

  const { data, isLoading } = useQuery({
    queryKey: ["merchant-menu", storeId],
    queryFn: async () => {
      const { data: menuRes } = await supabase
        .from("menu_items")
        .select("id, name, original_name, description, type, price, price_special, noodle_types, noodle_styles, toppings, textures, sort_order, image_url, noodle_type_prices, noodle_style_prices, topping_prices, menu_category")
        .eq("store_id", storeId!)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      const items = (menuRes || []) as (MenuItemRow & { sort_order: number })[];
      return { items };
    },
    enabled: !!storeId,
  });

  useEffect(() => {
    if (data?.items) setOrderedItems(data.items);
  }, [data?.items]);


  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("menu_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant-menu", storeId] });
      toast.success(isTh ? "ลบแล้ว ✓" : "Deleted ✓");
      setDeleteConfirm(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleTranslateDescription = async (itemId: string, description: string) => {
    if (!description.trim() || translatingDesc) return;
    setTranslatingDesc(true);
    try {
      await supabase.from("menu_items").update({ description: description.trim() } as any).eq("id", itemId);
      const { error } = await supabase.functions.invoke("translate-menu", {
        body: { menu_item_ids: [itemId], target_languages: ["en", "ja", "zh", "ko"] },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["merchant-menu", storeId] });
      toast.success(isTh ? "แปลคำอธิบายสำเร็จ ✨" : "Description translated ✨");
    } catch (e: any) {
      toast.error(e.message || "Translation failed");
    } finally {
      setTranslatingDesc(false);
    }
  };

  const handleGenerateDescription = async (item: MenuItemRow) => {
    if (generatingId) return;
    setGeneratingId(item.id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-dish-intro", {
        body: { menu_item_id: item.id, dish_name: item.name },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["merchant-menu", storeId] });
      toast.success(isTh ? "สร้างคำอธิบายสำเร็จ ✨" : "Description generated ✨");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate description");
    } finally {
      setGeneratingId(null);
    }
  };

  const resetForm = () => {
    setForm(emptyForm); setEditingId(null); setShowAdd(false);
    setImageFile(null); setImagePreview(null);
  };

  const uploadImage = async (file: File, menuItemId: string) => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${storeId}/${menuItemId}.${ext}`;
    const { error: upErr } = await supabase.storage.from("menu-images").upload(path, file, { upsert: true });
    if (upErr) throw upErr;
    const { data: urlData } = supabase.storage.from("menu-images").getPublicUrl(path);
    const image_url = urlData.publicUrl + `?t=${Date.now()}`;
    await supabase.from("menu_items").update({ image_url } as any).eq("id", menuItemId);
    return image_url;
  };

  const handleInlineUpload = async (file: File, itemId: string) => {
    setUploadingImage(itemId);
    try {
      await uploadImage(file, itemId);
      queryClient.invalidateQueries({ queryKey: ["merchant-menu", storeId] });
      toast.success("📸 ✓");
    } catch (e: any) { toast.error(e.message); }
    finally { setUploadingImage(null); }
  };

  const handleFormImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleReorder = useCallback(async (newOrder: MenuItemRow[]) => {
    setOrderedItems(newOrder);
    await Promise.all(
      newOrder.map((item, idx) =>
        supabase.from("menu_items").update({ sort_order: idx } as any).eq("id", item.id)
      )
    );
  }, []);

  const moveItem = useCallback((itemId: string, direction: "up" | "down") => {
    setOrderedItems((prev) => {
      const idx = prev.findIndex((i) => i.id === itemId);
      if (idx < 0) return prev;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      Promise.all(next.map((item, i) =>
        supabase.from("menu_items").update({ sort_order: i } as any).eq("id", item.id)
      ));
      return next;
    });
  }, []);

  const sortByCategory = useCallback(async () => {
    const sorted = [...orderedItems].sort((a, b) => {
      let idxA = MENU_CATEGORIES.indexOf(a.menu_category || "");
      let idxB = MENU_CATEGORIES.indexOf(b.menu_category || "");
      if (idxA === -1) idxA = MENU_CATEGORIES.length;
      if (idxB === -1) idxB = MENU_CATEGORIES.length;
      return idxA - idxB;
    });
    setOrderedItems(sorted);
    await Promise.all(sorted.map((item, i) =>
      supabase.from("menu_items").update({ sort_order: i } as any).eq("id", item.id)
    ));
    toast.success(isTh ? "จัดลำดับตามหมวดหมู่แล้ว ✓" : "Sorted by category ✓");
  }, [orderedItems, MENU_CATEGORIES, isTh]);

  const startEdit = (item: MenuItemRow) => {
    setEditingId(item.id);
    setShowAdd(true);
    setForm({
      name: item.name, original_name: item.original_name || "", description: item.description || "",
      type: item.type, price: item.price, price_special: item.price_special,
      noodle_types: item.noodle_types || [], noodle_styles: item.noodle_styles || [],
      toppings: item.toppings || [], textures: item.textures || [],
      noodle_type_prices: (item.noodle_type_prices as Record<string, number>) || {},
      noodle_style_prices: (item.noodle_style_prices as Record<string, number>) || {},
      topping_prices: (item.topping_prices as Record<string, number>) || {},
      menu_category: item.menu_category || "",
    });
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast.error(isTh ? "กรุณาใส่ชื่อเมนู" : "Name required");
    const payload: Record<string, unknown> = {
      name: form.name.trim(), original_name: form.original_name.trim() || null,
      description: form.description.trim() || null, type: form.type,
      price: form.price, price_special: form.price_special,
      noodle_types: form.noodle_types, noodle_styles: form.noodle_styles,
      toppings: form.toppings, textures: form.textures,
      noodle_type_prices: form.noodle_type_prices, noodle_style_prices: form.noodle_style_prices,
      topping_prices: form.topping_prices,
      menu_category: form.menu_category || null,
    };

    setIsSaving(true);
    try {
      let itemId = editingId;
      if (itemId) {
        const { error } = await supabase.from("menu_items").update(payload as any).eq("id", itemId);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from("menu_items").insert([{ ...payload, store_id: storeId! } as any]).select("id").single();
        if (error) throw error;
        itemId = inserted.id;
      }
      if (imageFile && itemId) await uploadImage(imageFile, itemId);

      queryClient.invalidateQueries({ queryKey: ["merchant-menu", storeId] });
      toast.success(isTh ? "บันทึกแล้ว ✓" : "Saved ✓");

      // Auto-translate description to all languages in background
      if (form.description.trim() && itemId) {
        supabase.functions.invoke("translate-menu", {
          body: { menu_item_ids: [itemId], target_languages: ["en", "ja", "zh", "ko"] },
        }).catch(() => {});
      }

      const allTexts = [form.name.trim(), ...(form.noodle_types || []), ...(form.noodle_styles || []),
        ...(form.toppings || []), ...(form.textures || []), ...(form.menu_category ? [form.menu_category] : [])].filter(Boolean);
      if (allTexts.length > 0) preTranslateTags(allTexts);

      resetForm();
    } catch (e: any) { toast.error(e.message); }
    finally { setIsSaving(false); }
  };

  const loading = authLoading || storeLoading;

  // Auth guard (after all hooks)
  if (!authLoading && !user) { navigate("/m/login", { replace: true }); return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>; }

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-24">
        {/* Header */}
        <div className="sticky top-0 z-10 glass-effect glass-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <UtensilsCrossed size={18} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold tracking-tight text-foreground">
                {isTh ? "จัดการเมนู" : "Menu Manager"}
              </h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {activeStore?.name || ""} · {orderedItems.length} {isTh ? "รายการ" : "items"}
              </p>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => { resetForm(); setShowAdd(true); }}
              className="w-9 h-9 rounded-xl bg-score-emerald flex items-center justify-center shadow-luxury"
            >
              <Plus size={18} strokeWidth={2} className="text-primary-foreground" />
            </motion.button>
          </div>
        </div>

        {/* Search + Sort */}
        {!isLoading && !loading && orderedItems.length > 0 && (
          <div className="px-4 pt-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isTh ? "ค้นหาเมนู..." : "Search menu..."}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-secondary text-sm text-foreground outline-none focus:ring-1 focus:ring-score-emerald transition-all placeholder:text-muted-foreground/60"
              />
            </div>
            <motion.button whileTap={{ scale: 0.95 }} onClick={sortByCategory}
              className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors">
              <ArrowUpDown size={12} />
              {isTh ? "จัดลำดับตามหมวดหมู่" : "Sort by category"}
            </motion.button>
          </div>
        )}

        {/* Loading */}
        {(isLoading || loading) && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-score-emerald border-t-transparent animate-spin" />
          </div>
        )}

        {/* Menu List */}
        {!isLoading && !loading && (
          <div className="px-4 pt-3 space-y-2">
            {orderedItems.length === 0 && !showAdd && (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-3">
                  <UtensilsCrossed size={28} className="text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">{isTh ? "ยังไม่มีเมนู" : "No menu items yet"}</p>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => { resetForm(); setShowAdd(true); }}
                  className="mt-3 px-5 py-2.5 rounded-xl bg-score-emerald text-primary-foreground text-xs font-semibold shadow-luxury">
                  + {isTh ? "เพิ่มเมนูแรก" : "Add first item"}
                </motion.button>
              </div>
            )}
            <Reorder.Group axis="y" values={orderedItems} onReorder={handleReorder} className="space-y-2">
              {orderedItems
                .filter((item) => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase();
                  return item.name.toLowerCase().includes(q) || (item.original_name || "").toLowerCase().includes(q) || (item.menu_category || "").toLowerCase().includes(q);
                })
                .map((item) => (
                  <Reorder.Item key={item.id} value={item}
                    className="bg-card rounded-2xl border border-border p-3 list-none touch-none"
                    whileDrag={{ scale: 1.03, boxShadow: "0 8px 30px rgba(0,0,0,0.12)", zIndex: 50 }}>
                    <div className="flex items-center gap-3">
                      {/* Reorder arrows */}
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button onClick={() => moveItem(item.id, "up")} disabled={orderedItems.indexOf(item) === 0}
                          className="p-0.5 rounded hover:bg-secondary transition-colors disabled:opacity-20">
                          <ChevronUp size={13} className="text-muted-foreground" />
                        </button>
                        <button onClick={() => moveItem(item.id, "down")} disabled={orderedItems.indexOf(item) === orderedItems.length - 1}
                          className="p-0.5 rounded hover:bg-secondary transition-colors disabled:opacity-20">
                          <ChevronDown size={13} className="text-muted-foreground" />
                        </button>
                      </div>

                      {/* Thumbnail */}
                      <div className="relative shrink-0">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                            <ImageIcon size={14} className="text-muted-foreground/40" />
                          </div>
                        )}
                        <button onClick={() => { inlineTargetId.current = item.id; inlineFileRef.current?.click(); }}
                          disabled={uploadingImage === item.id}
                          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-score-emerald flex items-center justify-center shadow-sm">
                          {uploadingImage === item.id
                            ? <Loader2 size={10} className="text-primary-foreground animate-spin" />
                            : <Camera size={10} className="text-primary-foreground" />}
                        </button>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{typeLabel[item.type] || item.type}</span>
                          {item.menu_category && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-score-emerald/15 text-score-emerald font-medium">{item.menu_category}</span>
                          )}
                          <span className="text-sm font-medium text-foreground truncate">{item.name}</span>
                        </div>
                        {item.original_name && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{item.original_name}</p>}
                      </div>
                      <span className="text-sm font-semibold text-foreground shrink-0">฿{item.price}</span>

                      {/* Actions */}
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => handleGenerateDescription(item)}
                          disabled={generatingId === item.id}
                          className="p-1.5 rounded-lg hover:bg-violet-500/10 transition-colors disabled:opacity-50"
                          title={isTh ? "สร้างคำอธิบาย AI" : "Generate AI description"}
                        >
                          {generatingId === item.id
                            ? <Loader2 size={14} className="text-violet-500 animate-spin" />
                            : <Sparkles size={14} className="text-violet-500" />}
                        </button>
                        <button onClick={() => setTranslateItem({ id: item.id, name: item.name, description: item.description })}
                          className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors">
                          <Globe size={14} className="text-primary" />
                        </button>
                        <button onClick={() => startEdit(item)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
                          <Pencil size={14} className="text-muted-foreground" />
                        </button>
                        <button onClick={() => setDeleteConfirm(item.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
                          <Trash2 size={14} className="text-destructive/70" />
                        </button>
                      </div>
                    </div>
                    {item.description && <p className="text-[10px] text-muted-foreground mt-1.5 line-clamp-2 ml-7">{item.description}</p>}
                    <div className="ml-7 mt-1">
                      <AddOnManager menuItemId={item.id} />
                    </div>
                  </Reorder.Item>
                ))}
            </Reorder.Group>
          </div>
        )}

        {/* Add/Edit Form (Bottom Sheet) */}
        <AnimatePresence>
          {showAdd && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] bg-black/40 flex items-end justify-center"
              onClick={(e) => { if (e.target === e.currentTarget) resetForm(); }}>
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                className="w-full max-w-lg bg-background rounded-t-3xl max-h-[85vh] flex flex-col">
                <div className="flex items-center justify-between p-5 pb-2">
                  <h2 className="text-base font-semibold text-foreground">
                    {editingId ? (isTh ? "แก้ไขเมนู" : "Edit Item") : (isTh ? "เพิ่มเมนู" : "Add Item")}
                  </h2>
                  <button onClick={resetForm} className="p-1.5 rounded-lg hover:bg-secondary">
                    <X size={18} className="text-muted-foreground" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 space-y-3">
                  {/* Type */}
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{isTh ? "ประเภท" : "Type"}</label>
                    <div className="flex gap-2 mt-1">
                      {(["standard", "noodle", "dual_price"] as const).map((tp) => (
                        <button key={tp} onClick={() => setForm((f) => ({ ...f, type: tp }))}
                          className={`flex-1 py-2 rounded-xl text-[11px] font-medium transition-all ${
                            form.type === tp ? "bg-score-emerald text-primary-foreground shadow-sm" : "bg-secondary text-foreground"
                          }`}>
                          {typeLabel[tp]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Field label={isTh ? "ชื่อเมนู" : "Name"} value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
                  <Field label={isTh ? "ชื่อต้นฉบับ" : "Original Name"} value={form.original_name} onChange={(v) => setForm((f) => ({ ...f, original_name: v }))} placeholder="Original language name" />

                  {/* Price */}
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{isTh ? "ราคา" : "Price"}</label>
                      <input type="number" value={form.price}
                        onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) || 0 }))}
                        className="w-full mt-1 px-3 py-2.5 rounded-xl bg-secondary text-sm text-foreground outline-none focus:ring-1 focus:ring-score-emerald transition-all" />
                    </div>
                    {(form.type === "dual_price" || form.type === "noodle") && (
                      <div className="flex-1">
                        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{isTh ? "ราคาพิเศษ (ไซส์ใหญ่)" : "Special Price (Large)"}</label>
                        <input type="number" value={form.price_special ?? ""}
                          onChange={(e) => setForm((f) => ({ ...f, price_special: e.target.value ? Number(e.target.value) : null }))}
                          placeholder={isTh ? "ว่างไว้ถ้าไม่มี" : "Leave blank if none"}
                          className="w-full mt-1 px-3 py-2.5 rounded-xl bg-secondary text-sm text-foreground outline-none focus:ring-1 focus:ring-score-emerald transition-all" />
                      </div>
                    )}
                  </div>

                  {/* Menu Category */}
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{isTh ? "หมวดหมู่" : "Category"}</label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {MENU_CATEGORIES.map((cat) => (
                        <button key={cat} type="button"
                          onClick={() => setForm((f) => ({ ...f, menu_category: f.menu_category === cat ? "" : cat }))}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all ${
                            form.menu_category === cat ? "bg-score-emerald text-primary-foreground shadow-sm" : "bg-secondary text-foreground"
                          }`}>
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Field label={isTh ? "คำอธิบาย (ภาษาไทย)" : "Description (Thai)"} value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} multiline />
                    {editingId && form.description.trim() && (
                      <button
                        type="button"
                        onClick={() => handleTranslateDescription(editingId, form.description)}
                        disabled={translatingDesc}
                        className="mt-1.5 flex items-center gap-1.5 text-[11px] text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
                      >
                        {translatingDesc
                          ? <Loader2 size={12} className="animate-spin" />
                          : <Globe size={12} />}
                        {isTh ? "🌐 AI แปลทุกภาษา" : "🌐 AI translate all languages"}
                      </button>
                    )}
                  </div>

                  {/* Noodle-specific fields */}
                  {form.type === "noodle" && (
                    <>
                      <TagInput label={isTh ? "ชนิดเส้น" : "Noodle Types"} tags={form.noodle_types}
                        onChange={(v) => {
                          setForm((f) => {
                            const newPrices = { ...f.noodle_type_prices };
                            Object.keys(newPrices).forEach((k) => { if (!v.includes(k)) delete newPrices[k]; });
                            return { ...f, noodle_types: v, noodle_type_prices: newPrices };
                          });
                        }} placeholder={isTh ? "พิมพ์ชนิดเส้น" : "Type noodle"} suggestions={["เส้นเล็ก", "เส้นใหญ่", "บะหมี่", "เส้นหมี่", "วุ้นเส้น", "มาม่า"]} />

                      {form.noodle_types.length > 0 && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">💰 {isTh ? "ราคาเพิ่มต่อเส้น" : "Price per noodle"}</label>
                          <div className="grid grid-cols-2 gap-2">
                            {form.noodle_types.map((nt) => (
                              <div key={nt} className="flex items-center gap-2 rounded-xl bg-card border border-border px-3 py-2">
                                <span className="text-xs text-foreground flex-1 truncate">{nt}</span>
                                <span className="text-[10px] text-muted-foreground">+฿</span>
                                <input type="number" min="0" step="5" value={form.noodle_type_prices[nt] || 0}
                                  onChange={(e) => setForm((f) => ({ ...f, noodle_type_prices: { ...f.noodle_type_prices, [nt]: parseInt(e.target.value) || 0 } }))}
                                  className="w-14 text-right text-xs font-bold bg-transparent text-foreground outline-none border-b border-border focus:border-score-emerald transition-colors" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <TagInput label={isTh ? "ชนิดน้ำซุป" : "Noodle Styles"} tags={form.noodle_styles}
                        onChange={(v) => {
                          setForm((f) => {
                            const newPrices = { ...f.noodle_style_prices };
                            Object.keys(newPrices).forEach((k) => { if (!v.includes(k)) delete newPrices[k]; });
                            return { ...f, noodle_styles: v, noodle_style_prices: newPrices };
                          });
                        }} placeholder={isTh ? "พิมพ์ชนิดน้ำ" : "Type style"} suggestions={["น้ำใส", "น้ำตก", "ต้มยำ", "แห้ง", "เย็นตาโฟ", "น้ำข้น"]} />

                      {form.noodle_styles.length > 0 && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">💰 {isTh ? "ราคาเพิ่มต่อน้ำซุป" : "Price per style"}</label>
                          <div className="grid grid-cols-2 gap-2">
                            {form.noodle_styles.map((ns) => (
                              <div key={ns} className="flex items-center gap-2 rounded-xl bg-card border border-border px-3 py-2">
                                <span className="text-xs text-foreground flex-1 truncate">{ns}</span>
                                <span className="text-[10px] text-muted-foreground">+฿</span>
                                <input type="number" min="0" step="5" value={form.noodle_style_prices[ns] || 0}
                                  onChange={(e) => setForm((f) => ({ ...f, noodle_style_prices: { ...f.noodle_style_prices, [ns]: parseInt(e.target.value) || 0 } }))}
                                  className="w-14 text-right text-xs font-bold bg-transparent text-foreground outline-none border-b border-border focus:border-score-emerald transition-colors" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <TagInput label={isTh ? "ท็อปปิ้ง" : "Toppings"} tags={form.toppings}
                        onChange={(v) => {
                          setForm((f) => {
                            const newPrices = { ...f.topping_prices };
                            Object.keys(newPrices).forEach((k) => { if (!v.includes(k)) delete newPrices[k]; });
                            return { ...f, toppings: v, topping_prices: newPrices };
                          });
                        }}
                        placeholder={isTh ? "พิมพ์ท็อปปิ้ง" : "Type topping"}
                        suggestions={["ลูกชิ้น", "เนื้อ", "หมู", "ไก่", "หมูกรอบ", "หมูสับ", "เครื่องใน"]} />

                      {form.toppings.length > 0 && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">💰 {isTh ? "ราคาเพิ่มต่อท็อปปิ้ง" : "Price per topping"}</label>
                          <div className="grid grid-cols-2 gap-2">
                            {form.toppings.map((tp) => (
                              <div key={tp} className="flex items-center gap-2 rounded-xl bg-card border border-border px-3 py-2">
                                <span className="text-xs text-foreground flex-1 truncate">{tp}</span>
                                <span className="text-[10px] text-muted-foreground">+฿</span>
                                <input type="number" min="0" step="5" value={form.topping_prices[tp] || 0}
                                  onChange={(e) => setForm((f) => ({ ...f, topping_prices: { ...f.topping_prices, [tp]: parseInt(e.target.value) || 0 } }))}
                                  className="w-14 text-right text-xs font-bold bg-transparent text-foreground outline-none border-b border-border focus:border-score-emerald transition-colors" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <TagInput label={isTh ? "เนื้อสัมผัส" : "Textures"} tags={form.textures}
                    onChange={(v) => setForm((f) => ({ ...f, textures: v }))}
                    placeholder={isTh ? "พิมพ์เนื้อสัมผัส" : "Type texture"}
                    suggestions={["กรอบ", "นุ่ม", "เหนียว", "ฉ่ำ", "เนียน", "แน่น"]} />

                  {/* Image upload */}
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">📸 {isTh ? "รูปอาหาร" : "Photo"}</label>
                    <div className="mt-1 flex items-center gap-3">
                      {imagePreview ? (
                        <div className="relative">
                          <img src={imagePreview} alt="preview" className="w-16 h-16 rounded-xl object-cover" />
                          <button onClick={() => { setImageFile(null); setImagePreview(null); }}
                            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive flex items-center justify-center">
                            <X size={10} className="text-destructive-foreground" />
                          </button>
                        </div>
                      ) : editingId && orderedItems.find(i => i.id === editingId)?.image_url ? (
                        <img src={orderedItems.find(i => i.id === editingId)!.image_url!} alt="current" className="w-16 h-16 rounded-xl object-cover" />
                      ) : null}
                      <button type="button" onClick={() => fileInputRef.current?.click()}
                        className="flex-1 py-2.5 rounded-xl bg-secondary text-sm text-muted-foreground flex items-center justify-center gap-2 hover:bg-accent transition-colors">
                        <Camera size={14} />
                        {imagePreview ? (isTh ? "เปลี่ยนรูป" : "Change") : (isTh ? "เลือกรูป" : "Choose")}
                      </button>
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFormImagePick} className="hidden" />
                    </div>
                  </div>
                </div>

                {/* Submit */}
                <div className="shrink-0 p-5 pt-3 border-t border-border bg-background">
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleSubmit(); }} disabled={isSaving}
                    className="w-full py-3 rounded-2xl bg-score-emerald text-primary-foreground text-sm font-semibold shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.97] transition-transform">
                    <Save size={16} />
                    {isSaving ? "..." : editingId ? (isTh ? "บันทึก" : "Save") : (isTh ? "เพิ่มเมนู" : "Add Item")}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden file input for inline uploads */}
        <input ref={inlineFileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && inlineTargetId.current) handleInlineUpload(file, inlineTargetId.current);
            e.target.value = "";
          }} />

        {/* Delete confirmation */}
        <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
          <AlertDialogContent className="max-w-xs rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>{isTh ? "ลบเมนู?" : "Delete?"}</AlertDialogTitle>
              <AlertDialogDescription>
                {isTh ? "ลบเมนูนี้แล้วจะไม่สามารถกู้คืนได้" : "This item will be permanently deleted."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{isTh ? "ยกเลิก" : "Cancel"}</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}>
                {isTh ? "ลบ" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Translation Sheet */}
        {translateItem && (
          <MenuTranslationSheet open={!!translateItem} onClose={() => setTranslateItem(null)}
            menuItemId={translateItem.id} menuItemName={translateItem.name} menuItemDescription={translateItem.description} />
        )}

        {!showAdd && <MerchantBottomNav />}
      </div>
    </PageTransition>
  );
};

const Field = ({ label, value, onChange, placeholder, multiline }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean;
}) => (
  <div>
    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
    {multiline ? (
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={2}
        className="w-full mt-1 px-3 py-2.5 rounded-xl bg-secondary text-sm text-foreground outline-none focus:ring-1 focus:ring-score-emerald transition-all resize-none" />
    ) : (
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full mt-1 px-3 py-2.5 rounded-xl bg-secondary text-sm text-foreground outline-none focus:ring-1 focus:ring-score-emerald transition-all" />
    )}
  </div>
);

export default MerchantMenu;
