import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useMerchant } from "@/lib/merchant-context";

/** Redirects /m/kitchen → /kitchen/:storeId */
const MerchantKitchen = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { activeStore, loading } = useMerchant();

  useEffect(() => {
    if (authLoading || loading) return;
    if (!user) { navigate("/m/login", { replace: true }); return; }
    if (!activeStore) { navigate("/m", { replace: true }); return; }
    navigate(`/kitchen/${activeStore.id}`, { replace: true });
  }, [user, authLoading, activeStore, loading]);

  return null;
};

export default MerchantKitchen;
