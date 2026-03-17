import { useCallback, useRef } from "react";
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import { Globe } from "lucide-react";
import { GOOGLE_MAPS_API_KEY, MAPS_LIBRARIES, MAPS_SILVER_STYLE, DEFAULT_CENTER } from "@/lib/maps-config";
import PageTransition from "@/components/PageTransition";
import BottomNav from "@/components/BottomNav";

const mapContainerStyle = { width: "100%", height: "100%" };

const WorldMap = () => {
  const mapRef = useRef<google.maps.Map | null>(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-24">
        {/* Header */}
        <div className="sticky top-0 z-10 glass-effect glass-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center">
              <Globe size={16} strokeWidth={1.5} className="text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-medium tracking-tight text-foreground">World Map</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">ร้านอาหารที่คุณรีวิว</p>
            </div>
          </div>
        </div>

        <div className="h-[calc(100vh-140px)]">
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={DEFAULT_CENTER}
              zoom={12}
              onLoad={onMapLoad}
              options={{
                styles: MAPS_SILVER_STYLE,
                disableDefaultUI: true,
                zoomControl: true,
                gestureHandling: "greedy",
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-sm font-light text-muted-foreground">กำลังโหลดแผนที่...</p>
            </div>
          )}
        </div>

        <BottomNav />
      </div>
    </PageTransition>
  );
};

export default WorldMap;
