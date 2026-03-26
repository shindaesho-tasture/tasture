import { useState, useRef, useCallback, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, MapPin, Camera, Check, Loader2, Search, X, ImagePlus } from "lucide-react";
import { GoogleMap, useJsApiLoader, MarkerF } from "@react-google-maps/api";
import { supabase } from "@/integrations/supabase/client";
import { useCategories } from "@/hooks/use-categories";
import { useStore } from "@/lib/store-context";
import { useAuth } from "@/hooks/use-auth";
import type { MenuItem } from "@/lib/menu-types";
import { useLanguage } from "@/lib/language-context";
import { t } from "@/lib/i18n";
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
  const { language } = useLanguage();
  const { toast } = useToast();
  const { categories } = useCategories();
  const [saving, setSaving] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const [name, setName] = useState(store.name);
  const [pinned, setPinned] = useState(!!store.pinLocation);
  const [pinLocation, setPinLocation] = useState(store.pinLocation);
  const [menuPhotos, setMenuPhotos] = useState<string[]>(store.menuPhoto ? [store.menuPhoto] : []);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [scanTotal, setScanTotal] = useState(0);
  const [scanDone, setScanDone] = useState(0);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateStoreId, setDuplicateStoreId] = useState<string | null>(null);
  const [mergeMode, setMergeMode] = useState<"merge" | "new" | null>(null);
  const [scanningIndex, setScanningIndex] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(store.menuItems);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(store.categoryId);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [checkingName, setCheckingName] = useState(false);

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

  // Real-time duplicate name check
  useEffect(() => {
    if (!user || !name.trim()) {
      setDuplicateWarning(null);
      return;
    }
    setCheckingName(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from("stores")
          .select("id, name")
          .eq("user_id", user.id)
          .ilike("name", name.trim());
        if (data && data.length > 0) {
          setDuplicateWarning(t("reg.duplicateWarning", language, { name: data[0].name }));
        } else {
          setDuplicateWarning(null);
        }
      } catch {
        setDuplicateWarning(null);
      } finally {
        setCheckingName(false);
      }
    }, 500);
    return () => { clearTimeout(timer); setCheckingName(false); };
  }, [name, user]);

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
  const handleGalleryPick = () => galleryInputRef.current?.click();

  const scanMenuWithAI = async (base64: string) => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("scan-menu", {
        body: { imageBase64: base64, language },
      });

      if (error) throw error;

      const items: MenuItem[] = (data.items || []).map((item: any, idx: number) => ({
        id: `item-${idx}-${Date.now()}`,
        name: item.name || "",
        original_name: item.original_name || undefined,
        description: item.description || undefined,
        textures: item.textures || [],
        original_price: item.original_price || undefined,
        original_currency: item.original_currency || undefined,
        type: item.type || "standard",
        price: Math.round(item.price || 0),
        price_special: item.price_special ? Math.round(item.price_special) : undefined,
        noodle_types: item.noodle_types || [],
        noodle_styles: item.noodle_styles || [],
        toppings: item.toppings || [],
      }));

      // Merge with existing items instead of replacing
      setMenuItems((prev) => [...prev, ...items]);
      toast({ title: t("reg.scanSuccess", language), description: t("reg.foundItems", language, { count: items.length }) });
    } catch (err: any) {
      console.error("Scan error:", err);
      toast({ title: t("reg.scanFailed", language), description: err.message || t("reg.tryAgain", language), variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  const processFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoLoading(true);
    processFile(file).then((base64) => {
      setMenuPhotos((prev) => [...prev, base64]);
      setPhotoLoading(false);
      scanMenuWithAI(base64);
    });
  };

  const handleMultiFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    setScanTotal(fileArray.length);
    setScanDone(0);
    setPhotoLoading(true);
    for (const file of fileArray) {
      try {
        const base64 = await processFile(file);
        setMenuPhotos((prev) => [...prev, base64]);
        await scanMenuWithAI(base64);
      } catch (err) {
        console.error("File read error:", err);
      }
      setScanDone((prev) => prev + 1);
    }
    setPhotoLoading(false);
    setScanTotal(0);
    setScanDone(0);
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  };

  const handleItemChange = (index: number, updated: MenuItem) => {
    setMenuItems((prev) => prev.map((item, i) => (i === index ? updated : item)));
  };

  const canProceed = name.trim().length > 0 && selectedCategory;

  const saveToDatabase = async (forceMode: "merge" | "new") => {
    if (!user) {
      toast({ title: t("reg.pleaseLogin", language), description: t("reg.loginToSave", language), variant: "destructive" });
      navigate("/auth");
      return false;
    }
    setSaving(true);
    try {
      const normalizedName = name.trim();
      let storeId: string;
      let isExisting = false;

      if (forceMode === "merge" && duplicateStoreId) {
        // Merge into existing store
        storeId = duplicateStoreId;
        isExisting = true;
        await supabase.from("stores").update({
          category_id: selectedCategory,
          pin_lat: pinLocation?.lat ?? null,
          pin_lng: pinLocation?.lng ?? null,
          menu_photo: menuPhotos[0] || null,
        }).eq("id", storeId);
      } else {
        // Create new store
        const { data: storeData, error: storeError } = await supabase
          .from("stores")
          .insert({
            user_id: user.id,
            name: normalizedName,
            category_id: selectedCategory,
            pin_lat: pinLocation?.lat ?? null,
            pin_lng: pinLocation?.lng ?? null,
            menu_photo: menuPhotos[0] || null,
          })
          .select()
          .single();
        if (storeError) throw storeError;
        storeId = storeData.id;
      }

      if (menuItems.length > 0) {
        const { data: existingMenuItems } = await supabase
          .from("menu_items")
          .select("name")
          .eq("store_id", storeId);

        const existingNames = new Set(
          (existingMenuItems || []).map((m) => m.name.trim().toLowerCase())
        );

        const newItems = menuItems.filter(
          (item) => !existingNames.has(item.name.trim().toLowerCase())
        );

        if (newItems.length > 0) {
          const itemsToInsert = newItems.map((item) => ({
            store_id: storeId,
            name: item.name,
            original_name: item.original_name ?? null,
            description: item.description ?? null,
            textures: item.textures ?? [],
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
        }

        const dishNames = menuItems.map((item) => item.name.trim()).filter(Boolean);
        if (dishNames.length > 0) {
          supabase.functions.invoke("batch-analyze", { body: { dishNames } }).then(({ data, error }) => {
            if (error) console.error("Batch analyze error:", error);
            else console.log("Dish templates cached:", Object.keys(data?.templates || {}).length);
          });
        }

        const skippedCount = menuItems.length - (newItems?.length ?? menuItems.length);
        if (isExisting && skippedCount > 0) {
          toast({
            title: t("reg.mergeSuccess", language),
            description: t("reg.mergeSuccessDesc", language, { added: newItems?.length ?? 0, skipped: skippedCount }),
          });
        }
      }

      const successMsg = isExisting
        ? t("reg.savedExisting", language, { name: normalizedName })
        : t("reg.savedNew", language, { name: normalizedName });
      toast({ title: t("reg.saveSuccess", language), description: successMsg });
      return true;
    } catch (err: any) {
      console.error("Save error:", err);
      toast({ title: t("reg.saveFailed", language), description: err.message, variant: "destructive" });
      return false;
    } finally {
      setSaving(false);
      setDuplicateStoreId(null);
      setMergeMode(null);
    }
  };

  const handleProceed = async () => {
    if (!canProceed || !user) return;
    setStore({ name: name.trim(), pinLocation, menuPhoto: menuPhotos[0] || null, categoryId: selectedCategory, menuItems });

    // Check for duplicate store before saving
    const normalizedName = name.trim();
    const { data: existingStores } = await supabase
      .from("stores")
      .select("id")
      .eq("user_id", user.id)
      .ilike("name", normalizedName);

    if (existingStores && existingStores.length > 0) {
      // Found duplicate — ask user what to do
      setDuplicateStoreId(existingStores[0].id);
      setDuplicateDialogOpen(true);
      return;
    }

    // No duplicate — save as new
    const saved = await saveToDatabase("new");
    if (saved) {
      toast({ title: t("reg.addSuccess", language), description: t("reg.addSuccessDesc", language) });
      setShowConfetti(true);
      setTimeout(() => navigate("/discover"), 1800);
    }
  };

  const handleDuplicateChoice = async (mode: "merge" | "new") => {
    setDuplicateDialogOpen(false);
    const saved = await saveToDatabase(mode);
    if (saved) {
      toast({ title: t("reg.addSuccess", language), description: t("reg.addSuccessDesc", language) });
      setShowConfetti(true);
      setTimeout(() => navigate("/discover"), 1800);
    }
  };

  return (
    <PageTransition>
      <Confetti show={showConfetti} />

      {/* Duplicate Store Dialog */}
      <AlertDialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("reg.duplicateTitle", language)}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("reg.duplicateDesc", language, { name: name.trim() })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              onClick={() => handleDuplicateChoice("merge")}
              className="bg-score-emerald hover:bg-score-emerald/90 text-primary-foreground"
            >
              {t("reg.mergeMenu", language)}
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => handleDuplicateChoice("new")}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              {t("reg.createNew", language)}
            </AlertDialogAction>
            <AlertDialogCancel>{t("common.cancel", language)}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="min-h-screen bg-background pb-36">
        {/* Header */}
        <div className="sticky top-0 z-10 glass-effect glass-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <button onClick={() => navigate("/")} className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors">
              <ChevronLeft size={22} strokeWidth={1.5} className="text-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-medium tracking-tight text-foreground">{t("reg.title", language)}</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{t("reg.subtitle", language)}</p>
            </div>
          </div>
        </div>

        <div className="px-5 pt-5 space-y-6">
          {/* Input 1: Restaurant Name */}
          <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}>
            <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">{t("reg.storeName", language)}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("reg.storeNamePlaceholder", language)}
              lang="th"
              autoComplete="off"
              className={`w-full px-5 py-4 rounded-2xl bg-surface-elevated shadow-luxury text-base font-light text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 transition-shadow border-0 ${duplicateWarning ? 'ring-2 ring-score-amber/50 focus:ring-score-amber/50' : 'focus:ring-score-emerald/30'}`}
            />
            <AnimatePresence>
              {duplicateWarning && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="mt-2 text-xs text-score-amber flex items-center gap-1.5"
                >
                  ⚠️ {duplicateWarning} — {t("reg.duplicateHint", language)}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.section>

          {/* Input 2: Map with Pin + Search */}
          <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}>
            <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">{t("reg.pinLocation", language)}</label>

            {/* Place Search */}
            <div className="relative mb-2">
              <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-surface-elevated shadow-luxury border border-border/30 focus-within:ring-2 focus-within:ring-score-emerald/30 transition-shadow">
                <Search size={16} strokeWidth={1.5} className="text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={placeQuery}
                  onChange={(e) => setPlaceQuery(e.target.value)}
                  placeholder={t("reg.searchPlace", language)}
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
                        {t("reg.tapToPin", language)}
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
                    {t("reg.pinned", language)}
                    {pinLocation && (
                      <span className="text-[10px] font-light ml-1 opacity-60">
                        {pinLocation.lat.toFixed(4)}, {pinLocation.lng.toFixed(4)}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <MapPin size={16} strokeWidth={1.5} />
                    {t("reg.pinCurrent", language)}
                  </>
                )}
              </motion.button>
            </div>
          </motion.section>

          {/* Input 3: Menu Photo + Smart Digitizer */}
          <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}>
            <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">{t("reg.smartDigitizer", language)}</label>
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
            <input ref={galleryInputRef} type="file" accept="image/*" multiple onChange={handleMultiFileChange} className="hidden" />

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
                        <span className="text-[8px] font-medium text-primary-foreground">{t("reg.photoNum", language, { num: idx + 1 })}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {scanning && (
                  <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-elevated">
                    <Loader2 size={14} className="text-score-emerald animate-spin" />
                    <span className="text-xs text-muted-foreground">{t("reg.scanning", language)}</span>
                  </div>
                )}

                {!scanning && menuItems.length > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-score-emerald/10">
                    <Check size={14} className="text-score-emerald" />
                    <span className="text-[11px] font-medium text-score-emerald">{t("reg.itemsFromPhotos", language, { items: menuItems.length, photos: menuPhotos.length })}</span>
                  </div>
                )}
              </div>
            )}

            {!photoLoading && menuPhotos.length === 0 && (
              <div className="flex gap-2">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handlePhotoCapture}
                  className="flex-1 flex flex-col gap-3 items-center justify-center py-10 rounded-2xl bg-surface-elevated shadow-luxury border border-dashed border-border/60 transition-colors hover:border-score-emerald/30"
                >
                  <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
                    <Camera size={24} strokeWidth={1.5} className="text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <span className="text-xs font-medium text-foreground tracking-wide block uppercase">ถ่ายรูปเมนู</span>
                    <span className="text-[10px] font-light text-muted-foreground mt-0.5 block">เปิดกล้อง</span>
                  </div>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleGalleryPick}
                  className="flex-1 flex flex-col gap-3 items-center justify-center py-10 rounded-2xl bg-surface-elevated shadow-luxury border border-dashed border-border/60 transition-colors hover:border-score-emerald/30"
                >
                  <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
                    <ImagePlus size={24} strokeWidth={1.5} className="text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <span className="text-xs font-medium text-foreground tracking-wide block uppercase">เลือกจากเครื่อง</span>
                    <span className="text-[10px] font-light text-muted-foreground mt-0.5 block">อัลบั้มรูป</span>
                  </div>
                </motion.button>
              </div>
            )}

            {!photoLoading && menuPhotos.length > 0 && !scanning && (
              <div className="flex gap-2">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handlePhotoCapture}
                  className="flex-1 flex flex-row gap-2.5 items-center justify-center py-3.5 rounded-2xl bg-surface-elevated shadow-luxury border border-dashed border-border/60 transition-colors hover:border-score-emerald/30"
                >
                  <div className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center">
                    <Camera size={16} strokeWidth={1.5} className="text-muted-foreground" />
                  </div>
                  <span className="text-xs font-medium text-foreground tracking-wide uppercase">ถ่ายเพิ่ม</span>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleGalleryPick}
                  className="flex-1 flex flex-row gap-2.5 items-center justify-center py-3.5 rounded-2xl bg-surface-elevated shadow-luxury border border-dashed border-border/60 transition-colors hover:border-score-emerald/30"
                >
                  <div className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center">
                    <ImagePlus size={16} strokeWidth={1.5} className="text-muted-foreground" />
                  </div>
                  <span className="text-xs font-medium text-foreground tracking-wide uppercase">เลือกรูป</span>
                </motion.button>
              </div>
            )}

            {photoLoading && (
              <div className="w-full flex flex-col items-center justify-center gap-3 py-10 rounded-2xl bg-surface-elevated shadow-luxury">
                <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-14 h-14 rounded-2xl bg-score-emerald/10 flex items-center justify-center">
                  <Loader2 size={24} className="text-score-emerald animate-spin" />
                </motion.div>
                {scanTotal > 1 ? (
                  <div className="w-full max-w-[200px] flex flex-col items-center gap-1.5">
                    <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                      <motion.div
                        className="h-full bg-score-emerald rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${(scanDone / scanTotal) * 100}%` }}
                        transition={{ duration: 0.4 }}
                      />
                    </div>
                    <span className="text-xs font-light text-muted-foreground">
                      สแกนรูปที่ {scanDone + 1 > scanTotal ? scanTotal : scanDone + 1}/{scanTotal}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs font-light text-muted-foreground">กำลังโหลดภาพ...</span>
                )}
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
