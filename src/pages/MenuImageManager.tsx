import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Camera, Check, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import PageTransition from "@/components/PageTransition";
import BottomNav from "@/components/BottomNav";

interface MenuItemImage {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
}

const MenuImageManager = () => {
  const navigate = useNavigate();
  const { storeId } = useParams<{ storeId: string }>();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<MenuItemImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeName, setStoreName] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

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

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth"); return; }
    if (!storeId) return;
    fetchData();
  }, [storeId, user, authLoading, isAdmin]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [storeRes, menuRes] = await Promise.all([
        supabase.from("stores").select("name, user_id").eq("id", storeId!).single(),
        supabase.from("menu_items").select("id, name, price, image_url").eq("store_id", storeId!).order("name"),
      ]);

      if (storeRes.data) {
        setStoreName(storeRes.data.name);
        if (storeRes.data.user_id !== user?.id && !isAdmin) {
          toast({ title: "ไม่มีสิทธิ์เข้าถึง", variant: "destructive" });
          navigate("/discover");
          return;
        }
      }
      setItems(menuRes.data || []);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadClick = (itemId: string) => {
    setActiveItemId(itemId);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeItemId || !user) return;

    setUploading(activeItemId);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${activeItemId}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("menu-images")
        .upload(path, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("menu-images").getPublicUrl(path);
      const imageUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateErr } = await supabase
        .from("menu_items")
        .update({ image_url: imageUrl })
        .eq("id", activeItemId);

      if (updateErr) throw updateErr;

      setItems((prev) =>
        prev.map((item) => (item.id === activeItemId ? { ...item, image_url: imageUrl } : item))
      );
      toast({ title: "อัปโหลดสำเร็จ", description: "รูปเมนูถูกบันทึกแล้ว" });
    } catch (err: any) {
      console.error("Upload error:", err);
      toast({ title: "อัปโหลดไม่สำเร็จ", description: err.message, variant: "destructive" });
    } finally {
      setUploading(null);
      setActiveItemId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveImage = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from("menu_items")
        .update({ image_url: null })
        .eq("id", itemId);

      if (error) throw error;

      setItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, image_url: null } : item))
      );
      toast({ title: "ลบรูปแล้ว" });
    } catch (err: any) {
      toast({ title: "ลบไม่สำเร็จ", description: err.message, variant: "destructive" });
    }
  };

  const uploadedCount = items.filter((i) => i.image_url).length;

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
              <h1 className="text-base font-semibold tracking-tight text-foreground truncate">{storeName || "จัดการรูปเมนู"}</h1>
              <p className="text-[9px] text-muted-foreground uppercase tracking-[0.2em] mt-0.5">menu photos</p>
            </div>
            {items.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-score-emerald/10">
                <Camera size={12} className="text-score-emerald" />
                <span className="text-[10px] font-semibold text-score-emerald tabular-nums">
                  {uploadedCount}/{items.length}
                </span>
              </div>
            )}
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />

        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 gap-4">
            <div className="w-12 h-12 rounded-full border-[3px] border-border border-t-score-emerald animate-spin" />
            <p className="text-xs text-muted-foreground">กำลังโหลด...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center text-3xl">🍽️</div>
            <p className="text-sm font-medium text-foreground">ยังไม่มีเมนูในร้านนี้</p>
          </div>
        ) : (
          <div className="px-4 pt-4 space-y-3">
            <p className="text-[11px] text-muted-foreground px-1">
              📷 ถ่ายรูป Close-up อาหารแต่ละจาน เพื่อแสดงในการ์ดเมนู
            </p>

            {items.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.4 }}
                className="flex gap-3 p-3 rounded-2xl bg-surface-elevated shadow-luxury border border-border/40"
              >
                {/* Image area */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleUploadClick(item.id)}
                  disabled={uploading === item.id}
                  className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-secondary relative"
                >
                  {item.image_url ? (
                    <>
                      <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center">
                        <Camera size={16} className="text-white opacity-0 hover:opacity-100 transition-opacity" />
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
                      {uploading === item.id ? (
                        <Loader2 size={20} className="text-score-emerald animate-spin" />
                      ) : (
                        <>
                          <Camera size={18} strokeWidth={1.5} className="text-muted-foreground" />
                          <span className="text-[8px] text-muted-foreground font-medium">ถ่ายรูป</span>
                        </>
                      )}
                    </div>
                  )}

                  {uploading === item.id && item.image_url && (
                    <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                      <Loader2 size={20} className="text-score-emerald animate-spin" />
                    </div>
                  )}
                </motion.button>

                {/* Info */}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                  <div>
                    <h3 className="text-[14px] font-bold text-foreground truncate">{item.name}</h3>
                    <span className="text-xs font-light text-muted-foreground">฿{item.price}</span>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    {item.image_url ? (
                      <>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-score-emerald/10 text-[9px] font-semibold text-score-emerald">
                          <Check size={10} /> มีรูปแล้ว
                        </span>
                        <button
                          onClick={() => handleRemoveImage(item.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-score-ruby/10 text-[9px] font-semibold text-score-ruby hover:bg-score-ruby/20 transition-colors"
                        >
                          <X size={10} /> ลบรูป
                        </button>
                      </>
                    ) : (
                      <span className="text-[9px] text-muted-foreground font-light">ยังไม่มีรูป</span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <BottomNav />
      </div>
    </PageTransition>
  );
};

export default MenuImageManager;
