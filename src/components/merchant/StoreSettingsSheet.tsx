import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Save, Loader2, Navigation, Camera, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCategories } from "@/hooks/use-categories";
import { useLanguage } from "@/lib/language-context";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface StoreSettingsSheetProps {
  open: boolean;
  onClose: () => void;
  store: { id: string; name: string; category_id: string | null; verified: boolean };
  onUpdated: () => void;
}

const StoreSettingsSheet = ({ open, onClose, store, onUpdated }: StoreSettingsSheetProps) => {
  const { language } = useLanguage();
  const { categories } = useCategories();
  const { toast } = useToast();
  const isTh = language === "th";

  const [name, setName] = useState(store.name);
  const [categoryId, setCategoryId] = useState(store.category_id || "");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [menuPhoto, setMenuPhoto] = useState<string | null>(null);
  const [coverPhoto, setCoverPhoto] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [openingHours, setOpeningHours] = useState("");
  const [phone, setPhone] = useState("");
  const [lineId, setLineId] = useState("");
  const [address, setAddress] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [loadingGeo, setLoadingGeo] = useState(true);

  // Load current lat/lng
  useEffect(() => {
    if (!open) return;
    setName(store.name);
    setCategoryId(store.category_id || "");
    supabase.from("stores").select("pin_lat, pin_lng, menu_photo, cover_photo, description, opening_hours, phone, line_id, address").eq("id", store.id).single()
      .then(({ data }) => {
        setLat(data?.pin_lat ?? null);
        setLng(data?.pin_lng ?? null);
        setMenuPhoto(data?.menu_photo ?? null);
        setCoverPhoto((data as any)?.cover_photo ?? null);
        setDescription((data as any)?.description ?? "");
        setOpeningHours((data as any)?.opening_hours ?? "");
        setPhone((data as any)?.phone ?? "");
        setLineId((data as any)?.line_id ?? "");
        setAddress((data as any)?.address ?? "");
        setPreviewUrl(null);
        setCoverPreviewUrl(null);
        setLoadingGeo(false);
      });
  }, [open, store.id]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${store.id}/menu-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("menu-images").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("menu-images").getPublicUrl(path);
      setMenuPhoto(urlData.publicUrl);
      toast({ title: isTh ? "📸 อัปโหลดสำเร็จ" : "📸 Uploaded" });
    } catch (err: any) {
      toast({ title: isTh ? "อัปโหลดล้มเหลว" : "Upload failed", description: err.message, variant: "destructive" });
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const handleLocate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    if (navigator.vibrate) navigator.vibrate(8);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(parseFloat(pos.coords.latitude.toFixed(6)));
        setLng(parseFloat(pos.coords.longitude.toFixed(6)));
        setLocating(false);
        toast({ title: isTh ? "📍 ได้ตำแหน่งแล้ว" : "📍 Location set" });
      },
      () => {
        setLocating(false);
        toast({ title: isTh ? "ไม่สามารถระบุตำแหน่งได้" : "Location unavailable", variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    if (navigator.vibrate) navigator.vibrate(8);
    try {
      const { error } = await supabase
        .from("stores")
        .update({
          name: name.trim(),
          category_id: categoryId || null,
          pin_lat: lat,
          pin_lng: lng,
          menu_photo: menuPhoto,
          description: description.trim() || null,
          opening_hours: openingHours.trim() || null,
          phone: phone.trim() || null,
          line_id: lineId.trim() || null,
          address: address.trim() || null,
        } as any)
        .eq("id", store.id);
      if (error) throw error;
      toast({ title: isTh ? "✅ บันทึกแล้ว" : "✅ Saved" });
      onUpdated();
      onClose();
    } catch (err: any) {
      toast({ title: isTh ? "เกิดข้อผิดพลาด" : "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 z-50 bg-black/40" />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl max-h-[85vh] overflow-y-auto pb-safe-bottom"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3">
              <h2 className="text-base font-bold text-foreground">
                {isTh ? "ตั้งค่าร้าน" : "Store Settings"}
              </h2>
              <button onClick={onClose} className="p-2 -mr-2 rounded-xl hover:bg-secondary">
                <X size={18} className="text-muted-foreground" />
              </button>
            </div>

            <div className="px-5 pb-8 space-y-5">
              {/* Store Name */}
              <div>
                <label className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1.5">
                  {isTh ? "ชื่อร้าน" : "Store Name"}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground text-sm border border-border/50 outline-none focus:ring-2 focus:ring-score-emerald/30"
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1.5">
                  {isTh ? "ประเภทร้าน" : "Category"}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {categories.map((cat) => (
                    <button key={cat.id} onClick={() => setCategoryId(cat.id)}
                      className={cn(
                        "flex flex-col items-center gap-1 py-3 px-2 rounded-xl border text-center transition-all",
                        categoryId === cat.id
                          ? "border-score-emerald/50 bg-score-emerald/10 ring-2 ring-score-emerald/20"
                          : "border-border/50 bg-card hover:bg-secondary"
                      )}>
                      <span className="text-lg">{cat.icon}</span>
                      <span className="text-[10px] font-medium text-foreground leading-tight">
                        {isTh ? cat.labelTh : cat.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1.5">
                  <MapPin size={10} className="inline mr-1" />
                  {isTh ? "ตำแหน่งร้าน" : "Store Location"}
                </label>

                {loadingGeo ? (
                  <div className="flex items-center gap-2 py-3">
                    <Loader2 size={14} className="animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{isTh ? "กำลังโหลด..." : "Loading..."}</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lat !== null && lng !== null ? (
                      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-score-emerald/10 border border-score-emerald/20">
                        <MapPin size={14} className="text-score-emerald shrink-0" />
                        <span className="text-xs text-foreground font-mono">
                          {lat.toFixed(6)}, {lng.toFixed(6)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-secondary border border-border/50">
                        <MapPin size={14} className="text-muted-foreground shrink-0" />
                        <span className="text-xs text-muted-foreground">
                          {isTh ? "ยังไม่ได้ตั้งตำแหน่ง" : "No location set"}
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground mb-1 block">Lat</label>
                        <input type="number" step="0.000001" value={lat ?? ""} onChange={(e) => setLat(e.target.value ? parseFloat(e.target.value) : null)}
                          placeholder="13.7563"
                          className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground text-xs border border-border/50 outline-none focus:ring-2 focus:ring-score-emerald/30 font-mono" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground mb-1 block">Lng</label>
                        <input type="number" step="0.000001" value={lng ?? ""} onChange={(e) => setLng(e.target.value ? parseFloat(e.target.value) : null)}
                          placeholder="100.5018"
                          className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground text-xs border border-border/50 outline-none focus:ring-2 focus:ring-score-emerald/30 font-mono" />
                      </div>
                    </div>

                    <motion.button whileTap={{ scale: 0.97 }} onClick={handleLocate} disabled={locating}
                      className="w-full py-2.5 rounded-xl bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                      {locating ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
                      {isTh ? "ใช้ตำแหน่งปัจจุบัน" : "Use Current Location"}
                    </motion.button>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1.5">
                  📝 {isTh ? "คำอธิบายร้าน" : "Description"}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={isTh ? "เช่น ก๋วยเตี๋ยวต้นตำรับ 30 ปี" : "e.g. Traditional noodles for 30 years"}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground text-sm border border-border/50 outline-none focus:ring-2 focus:ring-score-emerald/30 resize-none"
                />
              </div>

              {/* Opening Hours */}
              <div>
                <label className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1.5">
                  🕐 {isTh ? "เวลาเปิด-ปิด" : "Opening Hours"}
                </label>
                <input
                  type="text"
                  value={openingHours}
                  onChange={(e) => setOpeningHours(e.target.value)}
                  placeholder={isTh ? "เช่น 08:00 - 20:00 (หยุดวันจันทร์)" : "e.g. 08:00 - 20:00 (Closed Monday)"}
                  className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground text-sm border border-border/50 outline-none focus:ring-2 focus:ring-score-emerald/30"
                />
              </div>

              {/* Phone & Line */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1.5">
                    📞 {isTh ? "เบอร์โทร" : "Phone"}
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="08X-XXX-XXXX"
                    className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground text-sm border border-border/50 outline-none focus:ring-2 focus:ring-score-emerald/30"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1.5">
                    💬 Line ID
                  </label>
                  <input
                    type="text"
                    value={lineId}
                    onChange={(e) => setLineId(e.target.value)}
                    placeholder="@storename"
                    className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground text-sm border border-border/50 outline-none focus:ring-2 focus:ring-score-emerald/30"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1.5">
                  📍 {isTh ? "ที่อยู่ร้าน" : "Address"}
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={isTh ? "เช่น ซอยอารีย์ 1 ใกล้ BTS อารีย์" : "e.g. Soi Ari 1, near BTS Ari"}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground text-sm border border-border/50 outline-none focus:ring-2 focus:ring-score-emerald/30 resize-none"
                />
              </div>

              {/* Menu Photo */}
              <div>
                <label className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1.5">
                  <Camera size={10} className="inline mr-1" />
                  {isTh ? "รูปเมนู" : "Menu Photo"}
                </label>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />

                {(previewUrl || menuPhoto) ? (
                  <div className="relative rounded-xl overflow-hidden border border-border/50">
                    <img src={previewUrl || menuPhoto!} alt="Menu" className="w-full h-40 object-cover" />
                    {uploading && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 size={24} className="animate-spin text-white" />
                      </div>
                    )}
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => fileRef.current?.click()} disabled={uploading}
                      className="absolute bottom-2 right-2 px-3 py-1.5 rounded-lg bg-black/60 text-white text-[10px] font-semibold flex items-center gap-1">
                      <Camera size={12} /> {isTh ? "เปลี่ยน" : "Change"}
                    </motion.button>
                  </div>
                ) : (
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="w-full py-8 rounded-xl border-2 border-dashed border-border/50 bg-secondary/50 flex flex-col items-center gap-2 text-muted-foreground hover:bg-secondary transition-colors">
                    <ImageIcon size={24} />
                    <span className="text-xs font-medium">{isTh ? "อัปโหลดรูปเมนู" : "Upload Menu Photo"}</span>
                  </motion.button>
                )}
              </div>

              {/* Save */}
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave} disabled={saving || !name.trim()}
                className="w-full py-3.5 rounded-xl bg-score-emerald text-white text-sm font-bold shadow-md flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {isTh ? "บันทึก" : "Save"}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default StoreSettingsSheet;
