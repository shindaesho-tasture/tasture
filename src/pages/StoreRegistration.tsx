import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, MapPin, Camera, Check, Loader2, Search, X } from "lucide-react";
import { GoogleMap, useJsApiLoader, MarkerF } from "@react-google-maps/api";
import { supabase } from "@/integrations/supabase/client";
import { useCategories } from "@/hooks/use-categories";
import { useStore } from "@/lib/store-context";
import { useAuth } from "@/hooks/use-auth";
import type { MenuItem } from "@/lib/menu-types";
import { GOOGLE_MAPS_API_KEY, MAPS_LIBRARIES, MAPS_SILVER_STYLE, DEFAULT_CENTER, DEFAULT_ZOOM } from "@/lib/maps-config";
import PageTransition from "@/components/PageTransition";
import BottomNav from "@/components/BottomNav";
import ScanningOverlay from "@/components/menu/ScanningOverlay";
import MenuCardList from "@/components/menu/MenuCardList";
import { useToast } from "@/hooks/use-toast";
import Confetti from "@/components/Confetti";

const mapContainerStyle = { width: "100%", height: "100%" };

const StoreRegistration = () => {
  const navigate = useNavigate();
  const { store, setStore } = useStore();
  const { user } = useAuth();
  const { toast } = useToast();
  const { categories } = useCategories();
  const [saving, setSaving] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const [name, setName] = useState(store.name);
  const [pinned, setPinned] = useState(!!store.pinLocation);
  const [pinLocation, setPinLocation] = useState(store.pinLocation);
  const [menuPhotos, setMenuPhotos] = useState<string[]>(store.menuPhoto ? [store.menuPhoto] : []);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [scanningIndex, setScanningIndex] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(store.menuItems);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(store.categoryId);

  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<google.maps.places.PlaceResult[]>([]);
  const [searchingPlace, setSearchingPlace] = useState(false);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);

  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY, libraries: MAPS_LIBRARIES });

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
    placesServiceRef.current = new google.maps.places.PlacesService(map);
  }, []);

  // Place search
  const searchPlaces = useCallback((query: string) => {
    if (!query.trim() || !autocompleteServiceRef.current) {
      setPlaceResults([]);
      return;
    }
    setSearchingPlace(true);
    autocompleteServiceRef.current.getPlacePredictions(
      { input: query, types: ["establishment"], componentRestrictions: { country: "th" } },
      (predictions, status) => {
        setSearchingPlace(false);
        if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
          setPlaceResults([]);
          return;
        }
        // Get details for top 5
        const results: google.maps.places.PlaceResult[] = [];
        let pending = Math.min(predictions.length, 5);
        predictions.slice(0, 5).forEach((p) => {
          placesServiceRef.current?.getDetails(
            { placeId: p.place_id!, fields: ["name", "geometry", "formatted_address", "place_id"] },
            (place, detailStatus) => {
              if (detailStatus === google.maps.places.PlacesServiceStatus.OK && place) {
                results.push(place);
              }
              pending--;
              if (pending === 0) setPlaceResults([...results]);
            }
          );
        });
      }
    );
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchPlaces(placeQuery), 400);
    return () => clearTimeout(timer);
  }, [placeQuery, searchPlaces]);

  const handleSelectPlace = (place: google.maps.places.PlaceResult) => {
    if (place.geometry?.location) {
      const loc = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
      setPinLocation(loc);
      setPinned(true);
      mapRef.current?.panTo(loc);
      mapRef.current?.setZoom(17);
      if (place.name && !name.trim()) setName(place.name);
    }
    setPlaceQuery("");
    setPlaceResults([]);
  };

  const handleDropPin = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setPinLocation(loc); setPinned(true);
          mapRef.current?.panTo(loc); mapRef.current?.setZoom(17);
        },
        () => { setPinLocation(DEFAULT_CENTER); setPinned(true); }
      );
    } else { setPinLocation(DEFAULT_CENTER); setPinned(true); }
  };

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) { setPinLocation({ lat: e.latLng.lat(), lng: e.latLng.lng() }); setPinned(true); }
  };

  const handlePhotoCapture = () => fileInputRef.current?.click();

  const scanMenuWithAI = async (base64: string) => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("scan-menu", {
        body: { imageBase64: base64 },
      });

      if (error) throw error;

      const items: MenuItem[] = (data.items || []).map((item: any, idx: number) => ({
        id: `item-${idx}-${Date.now()}`,
        name: item.name || "",
        original_name: item.original_name || undefined,
        description: item.description || undefined,
        textures: item.textures || [],
        type: item.type || "standard",
        price: item.price || 0,
        price_special: item.price_special || undefined,
        noodle_types: item.noodle_types || [],
        noodle_styles: item.noodle_styles || [],
        toppings: item.toppings || [],
      }));

      // Merge with existing items instead of replacing
      setMenuItems((prev) => [...prev, ...items]);
      toast({ title: `สแกนสำเร็จ`, description: `พบ ${items.length} รายการ` });
    } catch (err: any) {
      console.error("Scan error:", err);
      toast({ title: "สแกนไม่สำเร็จ", description: err.message || "กรุณาลองใหม่อีกครั้ง", variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setMenuPhotos((prev) => [...prev, base64]);
      setPhotoLoading(false);
      // Auto-trigger OCR scan
      scanMenuWithAI(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleItemChange = (index: number, updated: MenuItem) => {
    setMenuItems((prev) => prev.map((item, i) => (i === index ? updated : item)));
  };

  const canProceed = name.trim().length > 0 && selectedCategory;

  const saveToDatabase = async () => {
    if (!user) {
      toast({ title: "กรุณาเข้าสู่ระบบ", description: "ต้องเข้าสู่ระบบก่อนบันทึกร้าน", variant: "destructive" });
      navigate("/auth");
      return false;
    }
    setSaving(true);
    try {
      const { data: storeData, error: storeError } = await supabase
        .from("stores")
        .insert({
          user_id: user.id,
          name: name.trim(),
          category_id: selectedCategory,
          pin_lat: pinLocation?.lat ?? null,
          pin_lng: pinLocation?.lng ?? null,
          menu_photo: menuPhotos[0] || null,
        })
        .select()
        .single();

      if (storeError) throw storeError;

      if (menuItems.length > 0) {
        const itemsToInsert = menuItems.map((item) => ({
          store_id: storeData.id,
          name: item.name,
          type: item.type,
          price: item.price,
          price_special: item.price_special ?? null,
          noodle_types: item.noodle_types ?? [],
          noodle_styles: item.noodle_styles ?? [],
          toppings: item.toppings ?? [],
          rating: item.rating ?? 0,
        }));

        const { error: itemsError } = await supabase.from("menu_items").insert(itemsToInsert);
        if (itemsError) throw itemsError;

        // Auto-analyze dishes in background (don't block save)
        const dishNames = menuItems.map((item) => item.name.trim()).filter(Boolean);
        if (dishNames.length > 0) {
          supabase.functions.invoke("batch-analyze", {
            body: { dishNames },
          }).then(({ data, error }) => {
            if (error) console.error("Batch analyze error:", error);
            else console.log("Dish templates cached:", Object.keys(data?.templates || {}).length);
          });
        }
      }

      toast({ title: "บันทึกสำเร็จ", description: `ร้าน "${name.trim()}" ถูกบันทึกแล้ว` });
      return true;
    } catch (err: any) {
      console.error("Save error:", err);
      toast({ title: "บันทึกไม่สำเร็จ", description: err.message, variant: "destructive" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleProceed = async () => {
    if (!canProceed) return;
    setStore({ name: name.trim(), pinLocation, menuPhoto: menuPhotos[0] || null, categoryId: selectedCategory, menuItems });
    const saved = await saveToDatabase();
    if (saved) {
      toast({ title: "เพิ่มร้านสำเร็จ! 🎉", description: "ร้านของคุณลงระบบเรียบร้อยแล้ว" });
      setShowConfetti(true);
      setTimeout(() => navigate("/discover"), 1800);
    }
  };

  return (
    <PageTransition>
      <Confetti show={showConfetti} />
      <div className="min-h-screen bg-background pb-36">
        {/* Header */}
        <div className="sticky top-0 z-10 glass-effect glass-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <button onClick={() => navigate("/")} className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors">
              <ChevronLeft size={22} strokeWidth={1.5} className="text-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-medium tracking-tight text-foreground">ลงทะเบียนร้านอาหาร</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Store Registration</p>
            </div>
          </div>
        </div>

        <div className="px-5 pt-5 space-y-6">
          {/* Input 1: Restaurant Name */}
          <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}>
            <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">ชื่อร้านอาหาร</label>
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

          {/* Input 2: Map with Pin + Search */}
          <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}>
            <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">ปักหมุดตำแหน่ง</label>

            {/* Place Search */}
            <div className="relative mb-2">
              <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-surface-elevated shadow-luxury border border-border/30 focus-within:ring-2 focus-within:ring-score-emerald/30 transition-shadow">
                <Search size={16} strokeWidth={1.5} className="text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={placeQuery}
                  onChange={(e) => setPlaceQuery(e.target.value)}
                  placeholder="ค้นหาชื่อร้านหรือสถานที่..."
                  lang="th"
                  autoComplete="off"
                  className="flex-1 bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/60 outline-none"
                />
                {placeQuery && (
                  <button onClick={() => { setPlaceQuery(""); setPlaceResults([]); }} className="p-1 rounded-full hover:bg-secondary">
                    <X size={14} className="text-muted-foreground" />
                  </button>
                )}
                {searchingPlace && <Loader2 size={14} className="text-score-emerald animate-spin" />}
              </div>

              {/* Search results dropdown */}
              <AnimatePresence>
                {placeResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute left-0 right-0 top-full mt-1 z-20 rounded-2xl bg-surface-elevated shadow-luxury border border-border/50 overflow-hidden"
                  >
                    {placeResults.map((place) => (
                      <button
                        key={place.place_id}
                        onClick={() => handleSelectPlace(place)}
                        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-secondary/60 transition-colors border-b border-border/20 last:border-0"
                      >
                        <MapPin size={14} strokeWidth={1.5} className="text-score-emerald shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{place.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{place.formatted_address}</p>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative overflow-hidden rounded-2xl shadow-luxury">
              <div className="relative h-64 bg-secondary overflow-hidden rounded-t-2xl">
                {isLoaded ? (
                  <GoogleMap
                    mapContainerStyle={mapContainerStyle}
                    center={pinLocation || DEFAULT_CENTER}
                    zoom={DEFAULT_ZOOM}
                    onLoad={onMapLoad}
                    onClick={handleMapClick}
                    options={{
                      styles: MAPS_SILVER_STYLE,
                      disableDefaultUI: true,
                      zoomControl: true,
                      zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER },
                      gestureHandling: "greedy",
                    }}
                  >
                    {pinned && pinLocation && (
                      <MarkerF
                        position={pinLocation}
                        icon={{
                          path: google.maps.SymbolPath.CIRCLE,
                          scale: 10,
                          fillColor: "#065F46",
                          fillOpacity: 1,
                          strokeColor: "#ffffff",
                          strokeWeight: 3,
                        }}
                      />
                    )}
                  </GoogleMap>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Loader2 size={24} className="text-muted-foreground animate-spin" />
                  </div>
                )}

                {/* Tap-to-pin hint */}
                {!pinned && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="flex flex-col items-center gap-1.5">
                      <MapPin size={28} className="text-score-emerald drop-shadow-lg animate-bounce" />
                      <span className="text-[10px] font-medium text-foreground bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full shadow">
                        แตะแผนที่เพื่อปักหมุด
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleDropPin}
                className={`w-full flex items-center justify-center gap-2.5 py-3.5 text-sm font-medium transition-colors ${
                  pinned ? "bg-score-emerald/10 text-score-emerald" : "bg-surface-elevated text-foreground"
                }`}
              >
                {pinned ? (
                  <>
                    <Check size={16} strokeWidth={2} />
                    ปักหมุดแล้ว
                    {pinLocation && (
                      <span className="text-[10px] font-light ml-1 opacity-60">
                        {pinLocation.lat.toFixed(4)}, {pinLocation.lng.toFixed(4)}
                      </span>
                    )}
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

          {/* Input 3: Menu Photo + Smart Digitizer */}
          <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}>
            <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">📷 Smart Menu Digitizer</label>
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />

            {/* Photo grid */}
            {menuPhotos.length > 0 && (
              <div className="space-y-3 mb-3">
                <div className="grid grid-cols-2 gap-2">
                  {menuPhotos.map((photo, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="relative rounded-xl overflow-hidden shadow-luxury aspect-[4/3]"
                    >
                      <img src={photo} alt={`เมนู ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => setMenuPhotos((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-foreground/60 backdrop-blur-sm flex items-center justify-center"
                      >
                        <X size={12} className="text-background" />
                      </button>
                      <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-full bg-score-emerald/90">
                        <span className="text-[8px] font-medium text-primary-foreground">รูปที่ {idx + 1}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {scanning && (
                  <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-elevated">
                    <Loader2 size={14} className="text-score-emerald animate-spin" />
                    <span className="text-xs text-muted-foreground">กำลังสแกนเมนู...</span>
                  </div>
                )}

                {!scanning && menuItems.length > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-score-emerald/10">
                    <Check size={14} className="text-score-emerald" />
                    <span className="text-[11px] font-medium text-score-emerald">{menuItems.length} รายการจาก {menuPhotos.length} รูป</span>
                  </div>
                )}
              </div>
            )}

            {/* Add photo button */}
            {!photoLoading && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handlePhotoCapture}
                className={`w-full flex ${menuPhotos.length > 0 ? "flex-row gap-2.5 py-3.5" : "flex-col gap-3 py-10"} items-center justify-center rounded-2xl bg-surface-elevated shadow-luxury border border-dashed border-border/60 transition-colors hover:border-score-emerald/30`}
              >
                <div className={`${menuPhotos.length > 0 ? "w-8 h-8 rounded-xl" : "w-14 h-14 rounded-2xl"} bg-secondary flex items-center justify-center`}>
                  <Camera size={menuPhotos.length > 0 ? 16 : 24} strokeWidth={1.5} className="text-muted-foreground" />
                </div>
                <div className={menuPhotos.length > 0 ? "" : "text-center"}>
                  <span className="text-xs font-medium text-foreground tracking-wide block uppercase">
                    {menuPhotos.length > 0 ? "เพิ่มรูปเมนู" : "Capture Full Menu"}
                  </span>
                  {menuPhotos.length === 0 && (
                    <span className="text-[10px] font-light text-muted-foreground mt-0.5 block">ถ่ายรูปเมนูเพื่อสแกนอัตโนมัติ</span>
                  )}
                </div>
              </motion.button>
            )}

            {photoLoading && (
              <div className="w-full flex flex-col items-center justify-center gap-3 py-10 rounded-2xl bg-surface-elevated shadow-luxury">
                <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-14 h-14 rounded-2xl bg-score-emerald/10 flex items-center justify-center">
                  <Loader2 size={24} className="text-score-emerald animate-spin" />
                </motion.div>
                <span className="text-xs font-light text-muted-foreground">กำลังโหลดภาพ...</span>
              </div>
            )}
          </motion.section>

          {/* Menu Cards */}
          <AnimatePresence>
            {menuItems.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <MenuCardList items={menuItems} onItemChange={handleItemChange} />
              </motion.section>
            )}
          </AnimatePresence>

          {/* Category Selector */}
          <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}>
            <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">เลือกหมวดหมู่</label>
            <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide">
              {categories.map((cat) => {
                const isActive = selectedCategory === cat.id;
                return (
                  <motion.button
                    key={cat.id}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex flex-col items-center gap-2 min-w-[80px] px-3 py-3.5 rounded-2xl transition-all duration-300 ${
                      isActive ? "bg-score-emerald shadow-luxury" : "bg-surface-elevated shadow-luxury border border-border/30"
                    }`}
                  >
                    <span className="text-2xl">{cat.icon}</span>
                    <span className={`text-[10px] font-medium leading-tight text-center transition-colors ${isActive ? "text-primary-foreground" : "text-foreground"}`}>
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
              background: canProceed ? "hsl(var(--score-emerald))" : undefined,
              color: canProceed ? "hsl(var(--primary-foreground))" : undefined,
            }}
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : null}
            <span className="uppercase tracking-wider">{saving ? "กำลังบันทึก..." : "บันทึกร้าน"}</span>
          </motion.button>
        </div>

        <BottomNav />
      </div>
    </PageTransition>
  );
};

export default StoreRegistration;
