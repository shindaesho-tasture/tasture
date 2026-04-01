import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Store, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/lib/language-context";
import PageTransition from "@/components/PageTransition";

const MerchantLogin = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isTh = language === "th";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");

  // Auto-redirect if already logged in with stores
  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { count } = await supabase
          .from("stores")
          .select("id", { count: "exact", head: true })
          .eq("user_id", session.user.id);
        if ((count ?? 0) > 0) {
          navigate("/m", { replace: true });
          return;
        }
      }
      setChecking(false);
    };
    check();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error: signUpErr } = await supabase.auth.signUp({ email, password });
        if (signUpErr) throw signUpErr;
        setError(isTh ? "📧 กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ" : "📧 Please verify your email before signing in");
        setMode("login");
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) throw signInErr;
        // Check if user has stores
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { count } = await supabase
            .from("stores")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id);
          if ((count ?? 0) === 0) {
            // No stores yet, go to registration
            navigate("/register");
            return;
          }
        }
        navigate("/m");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        {/* Logo area */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="flex flex-col items-center gap-3 mb-10"
        >
          <div className="w-16 h-16 rounded-2xl bg-score-emerald/15 flex items-center justify-center">
            <Store size={32} className="text-score-emerald" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground tracking-tight">Tastûre Merchant</h1>
            <p className="text-xs text-muted-foreground mt-1">
              {isTh ? "ศูนย์บริหารร้านอาหาร" : "Restaurant Management Hub"}
            </p>
          </div>
        </motion.div>

        {/* Form */}
        <motion.form
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          onSubmit={handleSubmit}
          className="w-full max-w-sm space-y-4"
        >
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={isTh ? "อีเมล" : "Email"}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary text-foreground text-sm border border-border/50 outline-none focus:ring-2 focus:ring-score-emerald/30 placeholder:text-muted-foreground/60"
            />
          </div>

          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type={showPw ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isTh ? "รหัสผ่าน" : "Password"}
              minLength={6}
              className="w-full pl-10 pr-10 py-3 rounded-xl bg-secondary text-foreground text-sm border border-border/50 outline-none focus:ring-2 focus:ring-score-emerald/30 placeholder:text-muted-foreground/60"
            />
            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <p className={`text-xs text-center ${error.includes("📧") ? "text-score-emerald" : "text-score-ruby"}`}>{error}</p>
          )}

          <motion.button
            type="submit"
            disabled={loading}
            whileTap={{ scale: 0.97 }}
            className="w-full py-3 rounded-xl bg-score-emerald text-white text-sm font-semibold shadow-luxury disabled:opacity-50"
          >
            {loading
              ? "..."
              : mode === "login"
                ? (isTh ? "เข้าสู่ระบบ" : "Sign In")
                : (isTh ? "สมัครสมาชิก" : "Sign Up")}
          </motion.button>

          <p className="text-center text-xs text-muted-foreground">
            {mode === "login" ? (isTh ? "ยังไม่มีบัญชี?" : "Don't have an account?") : (isTh ? "มีบัญชีแล้ว?" : "Already have an account?")}
            <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
              className="ml-1 text-score-emerald font-semibold">
              {mode === "login" ? (isTh ? "สมัคร" : "Sign Up") : (isTh ? "เข้าสู่ระบบ" : "Sign In")}
            </button>
          </p>

          {/* Link to consumer app */}
          <div className="text-center pt-4">
            <button type="button" onClick={() => navigate("/")} className="text-[11px] text-muted-foreground underline">
              {isTh ? "← กลับไปแอปลูกค้า" : "← Back to consumer app"}
            </button>
          </div>
        </motion.form>
      </div>
    </PageTransition>
  );
};

export default MerchantLogin;
