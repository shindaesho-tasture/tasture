import { useState, useEffect, useRef } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import { GOOGLE_MAPS_API_KEY, MAPS_LIBRARIES } from "@/lib/maps-config";
import { supabase } from "@/integrations/supabase/client";

export interface PlaceRestaurant {
  placeId: string;
  storeId: string | null; // Supabase store id (after sync)
  name: string;
  lat: number;
  lng: number;
  imageUrl: string | null;
  isOpen: boolean | null; // realtime from Google Places
  vicinity: string | null;
  zone: string; // which zone this restaurant belongs to
  hasTastureContent: boolean;
}

// 3 focus zones in Chiang Mai
const ZONES = [
  { name: "สันติธรรม", lat: 18.8030, lng: 98.9760 },
  { name: "คูเมือง",   lat: 18.7883, lng: 98.9878 },
  { name: "นิมมาน",   lat: 18.7997, lng: 98.9681 },
] as const;

const ZONE_RADIUS = 1500; // meters per zone
const CACHE_KEY = "places_chiangmai_v4";
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/** Wrap PlacesService.nearbySearch in a Promise */
function searchZone(
  service: google.maps.places.PlacesService,
  zone: (typeof ZONES)[number]
): Promise<google.maps.places.PlaceResult[]> {
  return new Promise((resolve) => {
    service.nearbySearch(
      {
        location: { lat: zone.lat, lng: zone.lng },
        radius: ZONE_RADIUS,
        type: "restaurant",
        rankBy: google.maps.places.RankBy.PROMINENCE,
      },
      (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          resolve(results);
        } else {
          resolve([]); // zone failed — skip, don't block others
        }
      }
    );
  });
}

export const usePlacesRestaurants = () => {
  const [restaurants, setRestaurants] = useState<PlaceRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dummyDivRef = useRef<HTMLDivElement | null>(null);
  const fetchedRef = useRef(false);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: MAPS_LIBRARIES,
  });

  useEffect(() => {
    if (!isLoaded || fetchedRef.current) return;
    fetchedRef.current = true;

    // Serve from cache if fresh
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const { data, ts } = JSON.parse(raw) as { data: PlaceRestaurant[]; ts: number };
        if (Date.now() - ts < CACHE_TTL) {
          setRestaurants(data);
          setLoading(false);
          return;
        }
      }
    } catch {
      // ignore corrupt cache
    }

    if (!dummyDivRef.current) {
      dummyDivRef.current = document.createElement("div");
    }
    const service = new google.maps.places.PlacesService(dummyDivRef.current);

    (async () => {
      try {
        // Search all 3 zones in parallel
        const zoneResults = await Promise.all(
          ZONES.map((zone) => searchZone(service, zone).then((results) => ({ zone, results })))
        );

        // Deduplicate by placeId — first zone wins
        const seen = new Set<string>();
        const places: PlaceRestaurant[] = [];

        for (const { zone, results } of zoneResults) {
          for (const p of results) {
            const pid = p.place_id ?? "";
            if (!pid || seen.has(pid)) continue;
            seen.add(pid);
            places.push({
              placeId: pid,
              storeId: null,
              name: p.name ?? "",
              lat: p.geometry?.location?.lat() ?? 0,
              lng: p.geometry?.location?.lng() ?? 0,
              imageUrl: p.photos?.[0]?.getUrl({ maxWidth: 400 }) ?? null,
              isOpen: p.opening_hours?.isOpen() ?? null,
              vicinity: p.vicinity ?? null,
              zone: zone.name,
              hasTastureContent: false,
            });
          }
        }

        if (places.length === 0) {
          setError("ไม่พบร้านอาหารในโซนที่เลือก");
          setLoading(false);
          return;
        }

        // Sync to Supabase stores
        const placeIds = places.map((p) => p.placeId);
        const { data: existing } = await supabase
          .from("stores")
          .select("id, google_place_id, has_tasture_content")
          .in("google_place_id", placeIds);

        const existingMap = new Map<string, string>(
          (existing ?? []).map((s: any) => [s.google_place_id as string, s.id as string])
        );
        const contentMap = new Map<string, boolean>(
          (existing ?? []).map((s: any) => [s.google_place_id as string, s.has_tasture_content as boolean])
        );

        const toInsert = places
          .filter((p) => !existingMap.has(p.placeId))
          .map((p) => ({
            name: p.name,
            pin_lat: p.lat,
            pin_lng: p.lng,
            google_place_id: p.placeId,
            verified: false,
          }));

        if (toInsert.length > 0) {
          const { data: inserted } = await supabase
            .from("stores")
            .insert(toInsert)
            .select("id, google_place_id, has_tasture_content");
          (inserted ?? []).forEach((s: any) => {
            existingMap.set(s.google_place_id as string, s.id as string);
            contentMap.set(s.google_place_id as string, s.has_tasture_content as boolean);
          });
        }

        const placesWithIds = places.map((p) => ({
          ...p,
          storeId: existingMap.get(p.placeId) ?? null,
          hasTastureContent: contentMap.get(p.placeId) ?? false,
        }));

        try {
          sessionStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ data: placesWithIds, ts: Date.now() })
          );
        } catch {
          // storage full — skip cache
        }

        setRestaurants(placesWithIds);
      } catch (err) {
        console.error("Places fetch error:", err);
        setError("ไม่สามารถดึงข้อมูลร้านอาหารได้");
      } finally {
        setLoading(false);
      }
    })();
  }, [isLoaded]);

  return { restaurants, loading, error };
};
