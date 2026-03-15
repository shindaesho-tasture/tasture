import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, MapPin, Camera, Check, Loader2 } from "lucide-react";
import { categories } from "@/lib/categories";
import { useStore } from "@/lib/store-context";
import PageTransition from "@/components/PageTransition";
import BottomNav from "@/components/BottomNav";

const StoreRegistration = () => {
  const navigate = useNavigate();
  const { store, setStore } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(store.name);
  const [pinned, setPinned] = useState(!!store.pinLocation);
  const [pinLocation, setPinLocation] = useState(store.pinLocation);
  const [menuPhoto, setMenuPhoto] = useState<string | null>(store.menuPhoto);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(store.categoryId);

  const handleDropPin = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setPinLocation(loc);
          setPinned(true);
        },
        () => {
          // Fallback: Bangkok center
          const loc = { lat: 13.7563, lng: 100.5018 };
          setPinLocation(loc);
          setPinned(true);
        }
      );
    } else {
      const loc = { lat: 13.7563, lng: 100.5018 };
      setPinLocation(loc);
      setPinned(true);
    }
  };

  const handlePhotoCapture = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setTimeout(() => {
        setMenuPhoto(reader.result as string);
        setPhotoLoading(false);
      }, 1200);
    };
    reader.readAsDataURL(file);
  };

  const canProceed = name.trim().length > 0 && selectedCategory;

  const handleProceed = () => {
    if (!canProceed) return;
    setStore({
      name: name.trim(),
      pinLocation,
      menuPhoto,
      categoryId: selectedCategory,
    });
    navigate(`/review/${selectedCategory}`);
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-36">
        {/* Header */}
        <div className="sticky top-0 z-10 glass-effect glass-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => navigate("/")}
              className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors"
            >
              <ChevronLeft size={22} strokeWidth={1.5} className="text-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-medium tracking-tight text-foreground">
                ลงทะเบียนร้านอาหาร
              </h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                Store Registration
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 pt-5 space-y-6">
          {/* Input 1: Restaurant Name */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
              ชื่อร้านอาหาร
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ระบุชื่อร้านอาหาร..."
              lang="th"
              autoComplete="off"
              className="w-full px-5 py-4 rounded-2xl bg-surface-elevated shadow-luxury text-base font-light text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-score-emerald/30 transition-shadow border-0"
            />
          </motion.section>

          {/* Input 2: The Sovereign Pin */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
              ปักหมุดตำแหน่ง
            </label>
            <div className="relative overflow-hidden rounded-2xl shadow-luxury">
              {/* Minimalist Map Placeholder */}
              <div className="relative h-44 bg-gradient-to-br from-secondary via-surface to-secondary overflow-hidden">
                {/* Grid lines to simulate map */}
                <div className="absolute inset-0 opacity-[0.08]">
                  {[...Array(8)].map((_, i) => (
                    <div key={`h-${i}`} className="absolute w-full h-px bg-foreground" style={{ top: `${(i + 1) * 12.5}%` }} />
                  ))}
                  {[...Array(8)].map((_, i) => (
                    <div key={`v-${i}`} className="absolute h-full w-px bg-foreground" style={{ left: `${(i + 1) * 12.5}%` }} />
                  ))}
                </div>

                {/* Pin indicator */}
                <AnimatePresence>
                  {pinned && (
                    <motion.div
                      initial={{ scale: 0, y: -20 }}
                      animate={{ scale: 1, y: 0 }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-10 h-10 rounded-full bg-score-emerald flex items-center justify-center shadow-lg">
                          <MapPin size={20} strokeWidth={2} className="text-primary-foreground" />
                        </div>
                        <div className="w-2 h-2 rounded-full bg-score-emerald/40" />
                        {pinLocation && (
                          <span className="text-[10px] font-light text-muted-foreground mt-1">
                            {pinLocation.lat.toFixed(4)}, {pinLocation.lng.toFixed(4)}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {!pinned && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-xs font-light text-muted-foreground/60">แตะปุ่มด้านล่างเพื่อปักหมุด</p>
                  </div>
                )}
              </div>

              {/* Drop Pin Button */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleDropPin}
                className={`w-full flex items-center justify-center gap-2.5 py-3.5 text-sm font-medium transition-colors ${
                  pinned
                    ? "bg-score-emerald/10 text-score-emerald"
                    : "bg-surface-elevated text-foreground"
                }`}
              >
                {pinned ? (
                  <>
                    <Check size={16} strokeWidth={2} />
                    ปักหมุดแล้ว
                  </>
                ) : (
                  <>
                    <MapPin size={16} strokeWidth={1.5} />
                    ปักหมุดตำแหน่งปัจจุบัน
                  </>
                )}
              </motion.button>
            </div>
          </motion.section>

          {/* Input 3: Menu Photo */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
              ถ่ายรูปเมนู
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />

            {!menuPhoto && !photoLoading && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handlePhotoCapture}
                className="w-full flex flex-col items-center justify-center gap-3 py-10 rounded-2xl bg-surface-elevated shadow-luxury border border-dashed border-border/60 transition-colors hover:border-score-emerald/30"
              >
                <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
                  <Camera size={24} strokeWidth={1.5} className="text-muted-foreground" />
                </div>
                <div className="text-center">
                  <span className="text-xs font-medium text-foreground tracking-wide block uppercase">
                    Capture Full Menu
                  </span>
                  <span className="text-[10px] font-light text-muted-foreground mt-0.5 block">
                    ถ่ายรูปเมนูภาษาไทยที่นี่
                  </span>
                </div>
              </motion.button>
            )}

            {photoLoading && (
              <div className="w-full flex flex-col items-center justify-center gap-3 py-10 rounded-2xl bg-surface-elevated shadow-luxury">
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-14 h-14 rounded-2xl bg-score-emerald/10 flex items-center justify-center"
                >
                  <Loader2 size={24} className="text-score-emerald animate-spin" />
                </motion.div>
                <span className="text-xs font-light text-muted-foreground">
                  กำลังประมวลผลภาพ...
                </span>
              </div>
            )}

            {menuPhoto && !photoLoading && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative rounded-2xl overflow-hidden shadow-luxury"
              >
                <img
                  src={menuPhoto}
                  alt="เมนูอาหาร"
                  className="w-full h-40 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/20 to-transparent" />
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-score-emerald/90">
                  <Check size={12} className="text-primary-foreground" />
                  <span className="text-[10px] font-medium text-primary-foreground">ถ่ายรูปแล้ว</span>
                </div>
                <button
                  onClick={handlePhotoCapture}
                  className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-background/80 backdrop-blur-sm text-[10px] font-medium text-foreground"
                >
                  ถ่ายใหม่
                </button>
              </motion.div>
            )}
          </motion.section>

          {/* Category Selector */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
              เลือกหมวดหมู่
            </label>
            <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide">
              {categories.map((cat) => {
                const isActive = selectedCategory === cat.id;
                return (
                  <motion.button
                    key={cat.id}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex flex-col items-center gap-2 min-w-[80px] px-3 py-3.5 rounded-2xl transition-all duration-300 ${
                      isActive
                        ? "bg-score-emerald shadow-luxury"
                        : "bg-surface-elevated shadow-luxury border border-border/30"
                    }`}
                  >
                    <span className="text-2xl">{cat.icon}</span>
                    <span
                      className={`text-[10px] font-medium leading-tight text-center transition-colors ${
                        isActive ? "text-primary-foreground" : "text-foreground"
                      }`}
                    >
                      {cat.labelTh}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </motion.section>
        </div>

        {/* Fixed Bottom: Proceed Button */}
        <div className="fixed bottom-20 left-0 right-0 px-5 z-10">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleProceed}
            disabled={!canProceed}
            className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl glass-effect glass-border shadow-luxury text-sm font-medium transition-all disabled:opacity-30"
            style={{
              background: canProceed
                ? "hsl(var(--score-emerald))"
                : undefined,
              color: canProceed ? "hsl(var(--primary-foreground))" : undefined,
            }}
          >
            <span className="uppercase tracking-wider">Proceed to Verdict</span>
          </motion.button>
        </div>

        <BottomNav />
      </div>
    </PageTransition>
  );
};

export default StoreRegistration;
