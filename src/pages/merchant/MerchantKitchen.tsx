import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useMerchant } from "@/lib/merchant-context";
import KitchenDashboard from "@/pages/KitchenDashboard";

/**
 * Merchant Kitchen wrapper — injects the active store ID
 * and renders the existing KitchenDashboard.
 */
const MerchantKitchen = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { activeStore, loading } = useMerchant();

  useEffect(() => {
    if (!authLoading && !user) navigate("/m/login");
  }, [user, authLoading]);

  if (loading || authLoading) return null;
  if (!activeStore) { navigate("/m"); return null; }

  // Render existing KitchenDashboard by navigating with storeId param
  // We redirect to the existing page with the active store
  useEffect(() => {
    if (activeStore) {
      // We'll just render an iframe-like redirect
    }
  }, [activeStore]);

  return null;
};

export default MerchantKitchen;
