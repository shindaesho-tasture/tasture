import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogOut, Globe, Store, ChevronRight, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMerchant } from "@/lib/merchant-context";
import { useLanguage, LANGUAGES } from "@/lib/language-context";
import { categories } from "@/lib/categories";
import { cn } from "@/lib/utils";
import PageTransition from "@/components/PageTransition";
import MerchantBottomNav from "@/components/merchant/MerchantBottomNav";
import { Skeleton } from "@/components/ui/skeleton";

const MerchantProfile = () => {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const { stores, activeStore, setActiveStoreId, loading } = useMerchant();
  const isTh = language === "th";

  const [profile, setProfile] = useState<{ display_name: string | null; email: string | null } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/m/login");
  }, [user, authLoading]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name, email").eq("id", user.id).single()
      .then(({ data }) => setProfile(data));
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/m/login");
  };

  if (authLoading || loading) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background pb-24 px-4 pt-16">
          <Skeleton className="h-20 w-full rounded-xl mb-4" />
          <Skeleton className="h-12 w-full rounded-xl mb-2" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <MerchantBottomNav />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-24">
        {/* Header */}
        <div className="px-4 pt-safe-top">
          <div className="py-6 text-center">
            <div className="w-16 h-16 rounded-full bg-score-emerald/15 flex items-center justify-center mx-auto mb-3">
              <Store size={28} className="text-score-emerald" />
            </div>
            <h1 className="text-lg font-bold text-foreground">{profile?.display_name || profile?.email?.split("@")[0] || "Merchant"}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{profile?.email}</p>
          </div>
        </div>

        {/* Language */}
        <div className="px-4 mb-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">
            <Globe size={10} className="inline mr-1" />
            {isTh ? "ภาษา" : "Language"}
          </p>
          <div className="flex gap-1.5">
            {LANGUAGES.map((lang) => (
              <button key={lang.code} onClick={() => setLanguage(lang.code)}
                className={cn("px-3 py-1.5 rounded-full text-[11px] font-medium transition-all",
                  language === lang.code ? "bg-score-emerald text-white" : "bg-secondary text-muted-foreground"
                )}>
                {lang.flag} {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* My Stores list */}
        <div className="px-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
              {isTh ? "ร้านของฉัน" : "My Stores"}
            </p>
            <button onClick={() => navigate("/register")} className="text-[10px] text-score-emerald font-semibold flex items-center gap-0.5">
              <Plus size={12} /> {isTh ? "เพิ่มร้าน" : "Add"}
            </button>
            <button onClick={() => navigate("/m/claim")} className="text-[10px] text-primary font-semibold flex items-center gap-0.5 ml-2">
              🔗 {isTh ? "เชื่อมร้าน" : "Claim"}
            </button>
          </div>
          <div className="space-y-2">
            {stores.map((s) => {
              const cat = categories.find((c) => c.id === s.category_id);
              const isActive = activeStore?.id === s.id;
              return (
                <motion.button
                  key={s.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveStoreId(s.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                    isActive ? "border-score-emerald/40 bg-score-emerald/5" : "border-border/50 bg-surface-elevated"
                  )}
                >
                  <span className="text-xl">{cat?.icon ?? "🏪"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground">{cat?.label ?? "Store"}</p>
                  </div>
                  {isActive && <span className="text-[9px] text-score-emerald font-bold uppercase">{isTh ? "ใช้งานอยู่" : "Active"}</span>}
                  <ChevronRight size={14} className="text-muted-foreground" />
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Logout */}
        <div className="px-4 pt-4">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-score-ruby/10 text-score-ruby text-sm font-semibold"
          >
            <LogOut size={16} />
            {isTh ? "ออกจากระบบ" : "Sign Out"}
          </motion.button>
        </div>

        {/* Back to consumer */}
        <div className="text-center pt-6">
          <button onClick={() => navigate("/")} className="text-[11px] text-muted-foreground underline">
            {isTh ? "← กลับไปแอปลูกค้า" : "← Back to consumer app"}
          </button>
        </div>

        <MerchantBottomNav />
      </div>
    </PageTransition>
  );
};

export default MerchantProfile;
