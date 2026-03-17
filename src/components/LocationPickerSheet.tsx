import { useState, useCallback, useRef } from "react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { MapPin, Navigation, X, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GOOGLE_MAPS_API_KEY, MAPS_SILVER_STYLE, DEFAULT_CENTER } from "@/lib/maps-config";

interface LocationPickerSheetProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (pos: { lat: number; lng: number } | null) => void;
  currentPosition: { lat: number; lng: number } | null;
  gpsPosition: { lat: number; lng: number } | null;
}

const containerStyle = { width: "100%", height: "100%" };

const LocationPickerSheet = ({
  open,
  onClose,
  onConfirm,
  currentPosition,
  gpsPosition,
}: LocationPickerSheetProps) => {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    currentPosition
  );

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      setPin({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    }
  }, []);

  const handleUseGps = () => {
    if (gpsPosition) {
      setPin(gpsPosition);
      mapRef.current?.panTo(gpsPosition);
    }
  };

  const handleClearPin = () => {
    setPin(null);
    onConfirm(null);
    onClose();
  };

  const handleConfirm = () => {
    onConfirm(pin);
    onClose();
  };

  const center = pin || currentPosition || gpsPosition || DEFAULT_CENTER;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="absolute inset-x-0 bottom-0 top-12 bg-background rounded-t-3xl overflow-hidden flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <button onClick={onClose} className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors">
                <X size={20} strokeWidth={1.5} className="text-muted-foreground" />
              </button>
              <h2 className="text-sm font-semibold text-foreground">เลือกตำแหน่ง</h2>
              <button
                onClick={handleConfirm}
                disabled={!pin}
                className="p-2 -mr-2 rounded-xl hover:bg-secondary transition-colors disabled:opacity-30"
              >
                <Check size={20} strokeWidth={2} className="text-score-emerald" />
              </button>
            </div>

            {/* Map */}
            <div className="flex-1 relative">
              {isLoaded ? (
                <GoogleMap
                  mapContainerStyle={containerStyle}
                  center={center}
                  zoom={15}
                  onLoad={onMapLoad}
                  onClick={handleMapClick}
                  options={{
                    styles: MAPS_SILVER_STYLE,
                    disableDefaultUI: true,
                    zoomControl: true,
                    gestureHandling: "greedy",
                  }}
                >
                  {pin && <Marker position={pin} />}
                </GoogleMap>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full border-2 border-score-emerald border-t-transparent animate-spin" />
                </div>
              )}

              {/* Crosshair hint */}
              {!pin && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="flex flex-col items-center gap-2">
                    <MapPin size={32} className="text-score-emerald drop-shadow-lg" />
                    <span className="text-xs font-medium text-foreground bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-full shadow">
                      แตะเพื่อปักหมุด
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom actions */}
            <div className="px-4 py-4 space-y-2 border-t border-border/50 bg-background">
              {pin && (
                <p className="text-[11px] text-muted-foreground text-center mb-1">
                  📍 {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
                </p>
              )}
              <div className="flex gap-2">
                {gpsPosition && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleUseGps}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-secondary text-sm font-medium text-foreground"
                  >
                    <Navigation size={14} />
                    ใช้ GPS ปัจจุบัน
                  </motion.button>
                )}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleClearPin}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-secondary text-sm font-medium text-muted-foreground"
                >
                  <X size={14} />
                  ล้างตำแหน่ง
                </motion.button>
              </div>
              {pin && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleConfirm}
                  className="w-full py-3.5 rounded-2xl bg-score-emerald text-primary-foreground text-sm font-semibold shadow-luxury"
                >
                  ยืนยันตำแหน่งนี้
                </motion.button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LocationPickerSheet;
