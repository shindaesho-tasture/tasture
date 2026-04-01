import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, CheckCircle, XCircle, Users, Shield, ChefHat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/lib/language-context";
import PageTransition from "@/components/PageTransition";

const AcceptInvite = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  const isTh = language === "th";

  const [status, setStatus] = useState<"loading" | "preview" | "accepting" | "success" | "error" | "expired">("loading");
  const [invite, setInvite] = useState<any>(null);
  const [storeName, setStoreName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      // Clear any stale session before redirecting to login
      supabase.auth.signOut().finally(() => {
        navigate(`/m/login?redirect=/m/invite/${token}`, { replace: true });
      });
      return;
    }
    fetchInvite();
  }, [user, authLoading, token]);

  const fetchInvite = async () => {
    if (!token) return;
    setStatus("loading");

    const { data, error } = await supabase
      .from("store_invites")
      .select("id, store_id, token, role, expires_at, used_by")
      .eq("token", token)
      .single();

    if (error || !data) {
      setStatus("error");
      setErrorMsg(isTh ? "ลิงก์เชิญไม่ถูกต้อง" : "Invalid invite link");
      return;
    }

    if (data.used_by) {
      setStatus("error");
      setErrorMsg(isTh ? "ลิงก์นี้ถูกใช้แล้ว" : "This invite has been used");
      return;
    }

    if (new Date(data.expires_at) < new Date()) {
      setStatus("expired");
      return;
    }

    // Get store name
    const { data: store } = await supabase
      .from("stores")
      .select("name")
      .eq("id", data.store_id)
      .single();

    setStoreName(store?.name || "");
    setInvite(data);
    setStatus("preview");
  };

  const handleAccept = async () => {
    if (!invite || !user) return;
    setStatus("accepting");

    try {
      // Insert store member
      const { error: memberErr } = await supabase
        .from("store_members")
        .insert({
          store_id: invite.store_id,
          user_id: user.id,
          role: invite.role,
        });

      if (memberErr) {
        if (memberErr.message.includes("duplicate") || memberErr.message.includes("unique")) {
          setStatus("error");
          setErrorMsg(isTh ? "คุณเป็นสมาชิกร้านนี้อยู่แล้ว" : "You are already a member of this store");
          return;
        }
        throw memberErr;
      }

      // Mark invite as used
      await supabase
        .from("store_invites")
        .update({ used_by: user.id, used_at: new Date().toISOString() } as any)
        .eq("id", invite.id);

      setStatus("success");

      // Redirect to merchant dashboard after delay
      setTimeout(() => navigate("/m"), 2000);
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err.message);
    }
  };

  const RoleIcon = invite?.role === "manager" ? Shield : ChefHat;
  const roleLabel = invite?.role === "manager"
    ? (isTh ? "ผู้จัดการ" : "Manager")
    : (isTh ? "พนักงาน" : "Staff");

  return (
    <PageTransition>
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          {(status === "loading" || status === "accepting") && (
            <div className="flex flex-col items-center gap-4 py-12">
              <Loader2 size={32} className="animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {status === "loading" ? (isTh ? "กำลังโหลด..." : "Loading...") : (isTh ? "กำลังเข้าร่วม..." : "Joining...")}
              </p>
            </div>
          )}

          {status === "preview" && (
            <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-lg space-y-5 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Users size={28} className="text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  {isTh ? "คำเชิญเข้าร่วมร้าน" : "Store Invite"}
                </h2>
                <p className="text-2xl font-black text-foreground mt-2">{storeName}</p>
              </div>
              <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-secondary">
                <RoleIcon size={16} className={invite?.role === "manager" ? "text-blue-500" : "text-muted-foreground"} />
                <span className="text-sm font-semibold text-foreground">
                  {isTh ? `ตำแหน่ง: ${roleLabel}` : `Role: ${roleLabel}`}
                </span>
              </div>
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleAccept}
                className="w-full py-3.5 rounded-xl bg-score-emerald text-white text-sm font-bold shadow-md">
                {isTh ? "✅ ยอมรับคำเชิญ" : "✅ Accept Invite"}
              </motion.button>
              <button onClick={() => navigate("/m")} className="text-xs text-muted-foreground hover:text-foreground">
                {isTh ? "ยกเลิก" : "Cancel"}
              </button>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <CheckCircle size={48} className="text-score-emerald" />
              <h2 className="text-lg font-bold text-foreground">
                {isTh ? "เข้าร่วมสำเร็จ! 🎉" : "Joined Successfully! 🎉"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isTh ? `คุณเป็น${roleLabel}ของ ${storeName} แล้ว` : `You are now ${roleLabel} at ${storeName}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {isTh ? "กำลังพาไปหน้าร้าน..." : "Redirecting..."}
              </p>
            </div>
          )}

          {(status === "error" || status === "expired") && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <XCircle size={48} className="text-destructive" />
              <h2 className="text-lg font-bold text-foreground">
                {status === "expired"
                  ? (isTh ? "ลิงก์หมดอายุ" : "Link Expired")
                  : (isTh ? "เกิดข้อผิดพลาด" : "Error")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {status === "expired"
                  ? (isTh ? "ลิงก์เชิญนี้หมดอายุแล้ว กรุณาขอลิงก์ใหม่" : "This invite link has expired. Please request a new one.")
                  : errorMsg}
              </p>
              <button onClick={() => navigate("/m/login")} className="text-sm text-primary font-semibold">
                {isTh ? "ไปหน้าล็อกอิน" : "Go to Login"}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </PageTransition>
  );
};

export default AcceptInvite;
