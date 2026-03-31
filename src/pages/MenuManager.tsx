import { useState, useCallback, useRef } from "react";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { ChevronLeft, Plus, Pencil, Trash2, Save, X, GripVertical, Camera, ImageIcon, Loader2, Search, Globe } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/lib/language-context";
import { toast } from "sonner";
import PageTransition from "@/components/PageTransition";
import BottomNav from "@/components/BottomNav";
import TagInput from "@/components/menu/TagInput";
import AddOnManager from "@/components/menu/AddOnManager";
import MenuTranslationSheet from "@/components/menu/MenuTranslationSheet";

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
  menu_category: string | null;
};

const DEFAULT_MENU_CATEGORIES = ["แนะนำ", "ต้ม", "ผัด", "กับข้าว", "ราดข้าว", "ทอด", "ยำ", "อื่นๆ"];

const emptyForm = {
  name: "",
  original_name: "",
  description: "",
  type: "standard" as string,
  price: 0,
  price_special: null as number | null,
  noodle_types: [] as string[],
  noodle_styles: [] as string[],
  toppings: [] as string[],
  textures: [] as string[],
  noodle_type_prices: {} as Record<string, number>,
  noodle_style_prices: {} as Record<string, number>,
  menu_category: "" as string,
};

const MenuManager = () => {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [orderedItems, setOrderedItems] = useState<MenuItemRow[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [translateItem, setTranslateItem] = useState<{ id: string; name: string; description?: string | null } | null>(null);
  const inlineFileRef = useRef<HTMLInputElement>(null);
  const inlineTargetId = useRef<string | null>(null);

  // Check if current user is admin
  const { data: adminRole } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", user!.id).eq("role", "admin").maybeSingle();
      return data;
    },
    enabled: !!user,
  });
  const isAdmin = !!adminRole;

  // Fetch store name + menu items
  const { data, isLoading } = useQuery({
    queryKey: ["menu-manager", storeId],
    queryFn: async () => {
      const [storeRes, menuRes] = await Promise.all([
        supabase.from("stores").select("name, user_id").eq("id", storeId!).single(),
        supabase
          .from("menu_items")
          .select("id, name, original_name, description, type, price, price_special, noodle_types, noodle_styles, toppings, textures, sort_order, image_url, noodle_type_prices, noodle_style_prices, menu_category")
          .eq("store_id", storeId!)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
      ]);
      const items = (menuRes.data || []) as (MenuItemRow & { sort_order: number })[];
      setOrderedItems(items);
      return { store: storeRes.data, items };
    },
    enabled: !!storeId && !authLoading,
  });

  const isOwner = data?.store?.user_id === user?.id || isAdmin;

  const [isSaving, setIsSaving] = useState(false);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("menu_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-manager", storeId] });
      toast.success(t("common.delete") + " ✓");
      setDeleteConfirm(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowAdd(false);
    setImageFile(null);
    setImagePreview(null);
  };

  // Upload image to storage and update menu_item
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

  // Inline image upload for existing items (from list)
  const handleInlineUpload = async (file: File, itemId: string) => {
    setUploadingImage(itemId);
    try {
      await uploadImage(file, itemId);
      queryClient.invalidateQueries({ queryKey: ["menu-manager", storeId] });
      toast.success("📸 ✓");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploadingImage(null);
    }
  };

  // Handle form image pick
  const handleFormImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Reorder handler — save new order to DB
  const handleReorder = useCallback(
    async (newOrder: MenuItemRow[]) => {
      setOrderedItems(newOrder);
      const updates = newOrder.map((item, idx) => ({ id: item.id, sort_order: idx }));
      await Promise.all(
        updates.map(({ id, sort_order }) =>
          supabase.from("menu_items").update({ sort_order } as any).eq("id", id)
        )
      );
    },
    []
  );

  const startEdit = (item: MenuItemRow) => {
    setEditingId(item.id);
    setShowAdd(true);
    setForm({
      name: item.name,
      original_name: item.original_name || "",
      description: item.description || "",
      type: item.type,
      price: item.price,
      price_special: item.price_special,
      noodle_types: item.noodle_types || [],
      noodle_styles: item.noodle_styles || [],
      toppings: item.toppings || [],
      textures: item.textures || [],
      noodle_type_prices: (item.noodle_type_prices as Record<string, number>) || {},
      noodle_style_prices: (item.noodle_style_prices as Record<string, number>) || {},
      menu_category: item.menu_category || "",
    });
  };

  const handleSubmit = async () => {
    console.log("[MenuManager] handleSubmit called, form:", form.name, "isOwner:", isOwner, "editingId:", editingId);
    if (!form.name.trim()) return toast.error("Name required");
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      original_name: form.original_name.trim() || null,
      description: form.description.trim() || null,
      type: form.type,
      price: form.price,
      price_special: form.price_special,
      noodle_types: form.noodle_types,
      noodle_styles: form.noodle_styles,
      toppings: form.toppings,
      textures: form.textures,
      noodle_type_prices: form.noodle_type_prices,
      noodle_style_prices: form.noodle_style_prices,
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
          .from("menu_items")
          .insert([{ ...payload, store_id: storeId! } as any])
          .select("id")
          .single();
        if (error) throw error;
        itemId = inserted.id;
      }

      if (imageFile && itemId) {
        await uploadImage(imageFile, itemId);
      }

      queryClient.invalidateQueries({ queryKey: ["menu-manager", storeId] });
      toast.success(t("common.save") + " ✓");
      resetForm();
    } catch (e: any) {
      console.error("[MenuManager] save error:", e);
      toast.error(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const typeLabel: Record<string, string> = {
    standard: "🍽️ Standard",
    noodle: "🍜 Noodle",
    dual_price: "💰 Dual Price",
  };

  if (!authLoading && !user) {
    navigate("/auth");
    return null;
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-24">
        {/* Header */}
        <div className="sticky top-0 z-10 glass-effect glass-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors">
              <ChevronLeft size={22} strokeWidth={1.5} className="text-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-medium tracking-tight text-foreground truncate">
                {t("menuMgr.title")}
              </h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                {data?.store?.name || "..."}
              </p>
            </div>
            {isOwner && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => { resetForm(); setShowAdd(true); }}
                className="w-9 h-9 rounded-xl bg-score-emerald flex items-center justify-center shadow-luxury"
              >
                <Plus size={18} strokeWidth={2} className="text-primary-foreground" />
              </motion.button>
            )}
          </div>
        </div>

        {/* Not owner warning */}
        {!isLoading && !isOwner && (
          <div className="mx-4 mt-4 p-3 rounded-xl bg-score-amber/10 border border-score-amber/30 text-center">
            <p className="text-xs text-score-amber font-medium">{t("menuMgr.notOwner")}</p>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-score-emerald border-t-transparent animate-spin" />
          </div>
        )}

        {/* Search */}
        {!isLoading && data && orderedItems.length > 0 && (
          <div className="px-4 pt-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาเมนู..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-secondary text-sm text-foreground outline-none focus:ring-1 focus:ring-score-emerald transition-all placeholder:text-muted-foreground/60"
              />
            </div>
          </div>
        )}

        {/* Menu List */}
        {!isLoading && data && (
          <div className="px-4 pt-3 space-y-2">
            {orderedItems.length === 0 && !showAdd && (
              <div className="text-center py-16">
                <p className="text-sm text-muted-foreground">{t("feedback.noMenu")}</p>
              </div>
            )}
            <Reorder.Group
              axis="y"
              values={orderedItems}
              onReorder={handleReorder}
              className="space-y-2"
            >
              {orderedItems
                .filter((item) => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase();
                  return item.name.toLowerCase().includes(q) || (item.original_name || "").toLowerCase().includes(q) || (item.menu_category || "").toLowerCase().includes(q);
                })
                .map((item) => (
                <Reorder.Item
                  key={item.id}
                  value={item}
                  className="bg-surface-elevated rounded-2xl border border-border/40 p-3 shadow-luxury list-none touch-none"
                  whileDrag={{ scale: 1.03, boxShadow: "0 8px 30px rgba(0,0,0,0.18)", zIndex: 50 }}
                >
                  <div className="flex items-center gap-3">
                    {isOwner && (
                      <GripVertical size={14} className="text-muted-foreground/40 shrink-0 cursor-grab active:cursor-grabbing" />
                    )}

                    {/* Thumbnail / upload button */}
                    <div className="relative shrink-0">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                          <ImageIcon size={14} className="text-muted-foreground/40" />
                        </div>
                      )}
                      {isOwner && (
                        <button
                          onClick={() => {
                            inlineTargetId.current = item.id;
                            inlineFileRef.current?.click();
                          }}
                          disabled={uploadingImage === item.id}
                          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-score-emerald flex items-center justify-center shadow-sm"
                        >
                          {uploadingImage === item.id ? (
                            <Loader2 size={10} className="text-primary-foreground animate-spin" />
                          ) : (
                            <Camera size={10} className="text-primary-foreground" />
                          )}
                        </button>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{typeLabel[item.type] || item.type}</span>
                        {item.menu_category && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-score-emerald/15 text-score-emerald font-medium">{item.menu_category}</span>
                        )}
                        <span className="text-sm font-medium text-foreground truncate">{item.name}</span>
                      </div>
                      {item.original_name && (
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">{item.original_name}</p>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-foreground shrink-0">฿{item.price}</span>
                    {isOwner && (
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => setTranslateItem({ id: item.id, name: item.name, description: item.description })} className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors">
                          <Globe size={14} className="text-primary" />
                        </button>
                        <button onClick={() => startEdit(item)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
                          <Pencil size={14} className="text-muted-foreground" />
                        </button>
                        <button onClick={() => setDeleteConfirm(item.id)} className="p-1.5 rounded-lg hover:bg-score-ruby/10 transition-colors">
                          <Trash2 size={14} className="text-score-ruby/70" />
                        </button>
                      </div>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-[10px] text-muted-foreground mt-1.5 line-clamp-2 ml-7">{item.description}</p>
                  )}
                  {/* Add-on manager per item */}
                  {isOwner && (
                    <div className="ml-7 mt-1">
                      <AddOnManager menuItemId={item.id} />
                    </div>
                  )}
                </Reorder.Item>
              ))}
            </Reorder.Group>
          </div>
        )}

        {/* Add/Edit Form (Bottom Sheet style) */}
        <AnimatePresence>
          {showAdd && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] bg-black/40 flex items-end justify-center"
              onClick={(e) => { if (e.target === e.currentTarget) resetForm(); }}
            >
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                className="w-full max-w-lg bg-background rounded-t-3xl max-h-[85vh] flex flex-col"
              >
                <div className="flex items-center justify-between p-5 pb-2">
                  <h2 className="text-base font-semibold text-foreground">
                    {editingId ? t("common.edit") : t("menuMgr.addItem")}
                  </h2>
                  <button onClick={resetForm} className="p-1.5 rounded-lg hover:bg-secondary">
                    <X size={18} className="text-muted-foreground" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 space-y-3">
                  {/* Type */}
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{t("menuMgr.type")}</label>
                    <div className="flex gap-2 mt-1">
                      {(["standard", "noodle", "dual_price"] as const).map((tp) => (
                        <button
                          key={tp}
                          onClick={() => setForm((f) => ({ ...f, type: tp }))}
                          className={`flex-1 py-2 rounded-xl text-[11px] font-medium transition-all ${
                            form.type === tp ? "bg-score-emerald text-primary-foreground shadow-sm" : "bg-secondary text-foreground"
                          }`}
                        >
                          {typeLabel[tp]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Name */}
                  <Field label={t("menuMgr.name")} value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />

                  {/* Original Name */}
                  <Field label={t("menuMgr.originalName")} value={form.original_name} onChange={(v) => setForm((f) => ({ ...f, original_name: v }))} placeholder="Original language name" />

                  {/* Price */}
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{t("menuMgr.price")}</label>
                      <input
                        type="number"
                        value={form.price}
                        onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) || 0 }))}
                        className="w-full mt-1 px-3 py-2.5 rounded-xl bg-secondary text-sm text-foreground outline-none focus:ring-1 focus:ring-score-emerald transition-all"
                      />
                    </div>
                    {form.type === "dual_price" && (
                      <div className="flex-1">
                        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{t("menuMgr.priceSpecial")}</label>
                        <input
                          type="number"
                          value={form.price_special ?? ""}
                          onChange={(e) => setForm((f) => ({ ...f, price_special: e.target.value ? Number(e.target.value) : null }))}
                          className="w-full mt-1 px-3 py-2.5 rounded-xl bg-secondary text-sm text-foreground outline-none focus:ring-1 focus:ring-score-emerald transition-all"
                        />
                      </div>
                    )}
                  </div>

                  {/* Menu Category */}
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">หมวดหมู่</label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {MENU_CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, menu_category: f.menu_category === cat ? "" : cat }))}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all ${
                            form.menu_category === cat ? "bg-score-emerald text-primary-foreground shadow-sm" : "bg-secondary text-foreground"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Description */}
                  <Field label={t("menuMgr.desc")} value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} multiline />

                  {/* Noodle-specific fields */}
                  {form.type === "noodle" && (
                    <>
                      <TagInput label={t("menuMgr.noodleTypes")} tags={form.noodle_types} onChange={(v) => {
                        setForm((f) => {
                          // Clean up prices for removed noodle types
                          const newPrices = { ...f.noodle_type_prices };
                          Object.keys(newPrices).forEach((k) => {
                            if (!v.includes(k)) delete newPrices[k];
                          });
                          return { ...f, noodle_types: v, noodle_type_prices: newPrices };
                        });
                      }} placeholder="พิมพ์ชนิดเส้น" suggestions={["เส้นเล็ก", "เส้นใหญ่", "บะหมี่", "เส้นหมี่", "วุ้นเส้น", "มาม่า"]} />

                      {/* Noodle type price overrides */}
                      {form.noodle_types.length > 0 && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">💰 ราคาเพิ่มต่อเส้น</label>
                          <div className="grid grid-cols-2 gap-2">
                            {form.noodle_types.map((nt) => (
                              <div key={nt} className="flex items-center gap-2 rounded-xl bg-surface-elevated border border-border/50 px-3 py-2">
                                <span className="text-xs text-foreground flex-1 truncate">{nt}</span>
                                <span className="text-[10px] text-muted-foreground">+฿</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="5"
                                  value={form.noodle_type_prices[nt] || 0}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    setForm((f) => ({
                                      ...f,
                                      noodle_type_prices: { ...f.noodle_type_prices, [nt]: val },
                                    }));
                                  }}
                                  className="w-14 text-right text-xs font-bold bg-transparent text-foreground outline-none border-b border-border/50 focus:border-score-emerald transition-colors"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <TagInput label={t("menuMgr.noodleStyles")} tags={form.noodle_styles} onChange={(v) => {
                        setForm((f) => {
                          const newPrices = { ...f.noodle_style_prices };
                          Object.keys(newPrices).forEach((k) => {
                            if (!v.includes(k)) delete newPrices[k];
                          });
                          return { ...f, noodle_styles: v, noodle_style_prices: newPrices };
                        });
                      }} placeholder="พิมพ์ชนิดน้ำ" suggestions={["น้ำใส", "น้ำตก", "ต้มยำ", "แห้ง", "เย็นตาโฟ", "น้ำข้น"]} />

                      {/* Noodle style price overrides */}
                      {form.noodle_styles.length > 0 && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">💰 ราคาเพิ่มต่อน้ำซุป</label>
                          <div className="grid grid-cols-2 gap-2">
                            {form.noodle_styles.map((ns) => (
                              <div key={ns} className="flex items-center gap-2 rounded-xl bg-surface-elevated border border-border/50 px-3 py-2">
                                <span className="text-xs text-foreground flex-1 truncate">{ns}</span>
                                <span className="text-[10px] text-muted-foreground">+฿</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="5"
                                  value={form.noodle_style_prices[ns] || 0}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    setForm((f) => ({
                                      ...f,
                                      noodle_style_prices: { ...f.noodle_style_prices, [ns]: val },
                                    }));
                                  }}
                                  className="w-14 text-right text-xs font-bold bg-transparent text-foreground outline-none border-b border-border/50 focus:border-score-emerald transition-colors"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <TagInput label={t("menuMgr.toppings")} tags={form.toppings} onChange={(v) => setForm((f) => ({ ...f, toppings: v }))} placeholder="พิมพ์ท็อปปิ้ง" suggestions={["ลูกชิ้น", "เนื้อ", "หมู", "ไก่", "หมูกรอบ", "หมูสับ", "เครื่องใน"]} />
                    </>
                  )}

                  {/* Textures */}
                  <TagInput label={t("menuMgr.textures")} tags={form.textures} onChange={(v) => setForm((f) => ({ ...f, textures: v }))} placeholder="พิมพ์เนื้อสัมผัส" suggestions={["กรอบ", "นุ่ม", "เหนียว", "ฉ่ำ", "เนียน", "แน่น"]} />

                  {/* Image upload */}
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">📸 รูปอาหาร</label>
                    <div className="mt-1 flex items-center gap-3">
                      {imagePreview ? (
                        <div className="relative">
                          <img src={imagePreview} alt="preview" className="w-16 h-16 rounded-xl object-cover" />
                          <button
                            onClick={() => { setImageFile(null); setImagePreview(null); }}
                            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-score-ruby flex items-center justify-center"
                          >
                            <X size={10} className="text-white" />
                          </button>
                        </div>
                      ) : editingId && orderedItems.find(i => i.id === editingId)?.image_url ? (
                        <img
                          src={orderedItems.find(i => i.id === editingId)!.image_url!}
                          alt="current"
                          className="w-16 h-16 rounded-xl object-cover"
                        />
                      ) : null}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 py-2.5 rounded-xl bg-secondary text-sm text-muted-foreground flex items-center justify-center gap-2 hover:bg-secondary/80 transition-colors"
                      >
                        <Camera size={14} />
                        {imagePreview ? "เปลี่ยนรูป" : "เลือกรูป"}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFormImagePick}
                        className="hidden"
                      />
                    </div>
                  </div>

                </div>

                {/* Sticky submit button */}
                <div className="shrink-0 p-5 pt-3 border-t border-border/30 bg-background">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleSubmit(); }}
                    disabled={isSaving}
                    className="w-full py-3 rounded-2xl bg-score-emerald text-primary-foreground text-sm font-semibold shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.97] transition-transform"
                  >
                    <Save size={16} />
                    {isSaving ? "..." : editingId ? t("common.save") : t("menuMgr.addItem")}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden file input for inline image uploads */}
        <input
          ref={inlineFileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && inlineTargetId.current) {
              handleInlineUpload(file, inlineTargetId.current);
            }
            e.target.value = "";
          }}
        />

        {!showAdd && <BottomNav />}

        <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
          <AlertDialogContent className="max-w-xs rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>{t("common.delete")}?</AlertDialogTitle>
              <AlertDialogDescription>
                {t("menuMgr.deleteConfirmMsg") || "ลบเมนูนี้แล้วจะไม่สามารถกู้คืนได้"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-score-ruby hover:bg-score-ruby/90 text-white"
                onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
              >
                {t("common.delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Translation Sheet */}
        {translateItem && (
          <MenuTranslationSheet
            open={!!translateItem}
            onClose={() => setTranslateItem(null)}
            menuItemId={translateItem.id}
            menuItemName={translateItem.name}
            menuItemDescription={translateItem.description}
          />
        )}
      </div>
    </PageTransition>
  );
};

// Reusable field component
const Field = ({ label, value, onChange, placeholder, multiline }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean;
}) => (
  <div>
    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
    {multiline ? (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full mt-1 px-3 py-2.5 rounded-xl bg-secondary text-sm text-foreground outline-none focus:ring-1 focus:ring-score-emerald transition-all resize-none"
      />
    ) : (
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full mt-1 px-3 py-2.5 rounded-xl bg-secondary text-sm text-foreground outline-none focus:ring-1 focus:ring-score-emerald transition-all"
      />
    )}
  </div>
);

export default MenuManager;
