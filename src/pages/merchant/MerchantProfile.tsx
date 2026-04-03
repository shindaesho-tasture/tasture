import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogOut, Globe, Store, ChevronRight, Plus, Settings2, Camera, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMerchant } from "@/lib/merchant-context";
import { useLanguage, LANGUAGES } from "@/lib/language-context";
import { useCategories } from "@/hooks/use-categories";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import PageTransition from "@/components/PageTransition";
import MerchantBottomNav from "@/components/merchant/MerchantBottomNav";
import StoreSettingsSheet from "@/components/merchant/StoreSettingsSheet";
import StoreTeamManager from "@/components/merchant/StoreTeamManager";
import { Skeleton } from "@/components/ui/skeleton";
import { useMerchantNotifications } from "@/hooks/use-merchant-notifications";

const MerchantProfile = () => {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const { stores, activeStore, setActiveStoreId, loading } = useMerchant();
  const { categories } = useCategories();
  const { toast } = useToast();
  const isTh = language === "th";

  const [profile, setProfile] = useState<{ display_name: string | null; email: string | null; avatar_url: string | null } | null>(null);
  const [editingStore, setEditingStore] = useState<typeof stores[0] | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/m/login");
  }, [user, authLoading]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name, email, avatar_url").eq("id", user.id).single()
      .then(({ data }) => {
        setProfile(data);
        setDisplayName(data?.display_name || "");
      });
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/m/login");
  };

  const handleSaveProfile = async () => {
    if (!user || !displayName.trim()) return;
    setSavingProfile(true);
    if (navigator.vibrate) navigator.vibrate(8);
    const { error } = await supabase.from("profiles").update({ display_name: displayName.trim() }).eq("id", user.id);
    if (!error) {
      setProfile((p) => p ? { ...p, display_name: displayName.trim() } : p);
      toast({ title: isTh ? "✅ บันทึกแล้ว" : "✅ Saved" });
      setEditingProfile(false);
    }
    setSavingProfile(false);
  };

  // Force re-render stores after settings change
  const handleStoreUpdated = () => {
    // Trigger merchant context reload by navigating in-place
    window.location.reload();
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
      <div className="min-h-screen bg-background pb-28">
        {/* Header — Profile Card */}
        <div className="px-4 pt-safe-top">
          <div className="py-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-score-emerald/15 flex items-center justify-center shrink-0">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} className="w-full h-full rounded-2xl object-cover" alt="" />
                ) : (
                  <Store size={28} className="text-score-emerald" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                {editingProfile ? (
                  <div className="flex items-center gap-2">
                    <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-secondary text-sm text-foreground border border-border/50 outline-none focus:ring-2 focus:ring-score-emerald/30" />
                    <motion.button whileTap={{ scale: 0.9 }} onClick={handleSaveProfile} disabled={savingProfile}
                      className="px-3 py-1.5 rounded-lg bg-score-emerald text-white text-xs font-semibold disabled:opacity-50">
                      {savingProfile ? <Loader2 size={12} className="animate-spin" /> : (isTh ? "บันทึก" : "Save")}
                    </motion.button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-bold text-foreground truncate">
                      {profile?.display_name || profile?.email?.split("@")[0] || "Merchant"}
                    </h1>
                    <button onClick={() => setEditingProfile(true)} className="text-muted-foreground hover:text-foreground">
                      <Settings2 size={14} />
                    </button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{profile?.email}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Language */}
        <div className="px-4 mb-5">
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
        <div className="px-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
              {isTh ? "ร้านของฉัน" : "My Stores"} ({stores.length})
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate("/m/claim")} className="text-[10px] text-primary font-semibold flex items-center gap-0.5">
                🔗 {isTh ? "เชื่อมร้าน" : "Claim"}
              </button>
              <button onClick={() => navigate("/register")} className="text-[10px] text-score-emerald font-semibold flex items-center gap-0.5">
                <Plus size={12} /> {isTh ? "เพิ่มร้าน" : "Add"}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {stores.map((s) => {
              const cat = categories.find((c) => c.id === s.category_id);
              const isActive = activeStore?.id === s.id;
              return (
                <motion.div key={s.id} whileTap={{ scale: 0.98 }}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl border transition-all",
                    isActive ? "border-score-emerald/40 bg-score-emerald/5" : "border-border/50 bg-card"
                  )}>
                  {/* Tap left side to set active */}
                  <button onClick={() => { setActiveStoreId(s.id); if (navigator.vibrate) navigator.vibrate(8); }}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <span className="text-xl">{cat?.icon ?? "🏪"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {isTh ? cat?.labelTh : cat?.label ?? "Store"}
                        {s.verified && <span className="ml-1 text-score-emerald">✓</span>}
                        {s.role !== "owner" && (
                          <span className="ml-1 text-primary">
                            ({s.role === "manager" ? (isTh ? "ผู้จัดการ" : "Manager") : (isTh ? "พนักงาน" : "Staff")})
                          </span>
                        )}
                      </p>
                    </div>
                    {isActive && (
                      <span className="text-[9px] text-score-emerald font-bold uppercase shrink-0">
                        {isTh ? "ใช้งาน" : "Active"}
                      </span>
                    )}
                  </button>
                  {/* Settings button */}
                  <button onClick={() => setEditingStore(s)}
                    className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 hover:bg-muted transition-colors">
                    <Settings2 size={14} className="text-muted-foreground" />
                  </button>
                </motion.div>
              );
            })}

            {stores.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-3">{isTh ? "ยังไม่มีร้าน" : "No stores yet"}</p>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate("/register")}
                  className="px-6 py-2.5 rounded-xl bg-score-emerald text-white text-sm font-semibold">
                  {isTh ? "สร้างร้านแรก" : "Create First Store"}
                </motion.button>
              </div>
            )}
          </div>
        </div>

        {/* Team Management */}
        {activeStore && (
          <div className="px-4 mb-5">
            <StoreTeamManager />
          </div>
        )}

        {/* Logout */}
        <div className="px-4 pt-2">
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-score-ruby/10 text-score-ruby text-sm font-semibold">
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

        {/* Store Settings Sheet */}
        {editingStore && (
          <StoreSettingsSheet
            open={!!editingStore}
            onClose={() => setEditingStore(null)}
            store={editingStore}
            onUpdated={handleStoreUpdated}
          />
        )}
      </div>
    </PageTransition>
  );
};

export default MerchantProfile;
