import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, ChevronLeft } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { t } from "@/lib/i18n";
import PageTransition from "@/components/PageTransition";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { language } = useLanguage();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: t("auth.loginSuccess", language) });
        navigate("/register");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) {
          toast({ title: t("auth.signupSuccess", language) });
          navigate("/register");
        } else {
          toast({ title: t("auth.signupSuccess", language), description: t("auth.confirmEmail", language) });
        }
      }
    } catch (err: any) {
      toast({ title: t("auth.error", language), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background flex flex-col">
        <div className="sticky top-0 z-10 glass-effect glass-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <button onClick={() => navigate("/")} className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors">
              <ChevronLeft size={22} strokeWidth={1.5} className="text-foreground" />
            </button>
            <h1 className="text-lg font-medium tracking-tight text-foreground">
              {isLogin ? t("auth.login", language) : t("auth.signup", language)}
            </h1>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-5">
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit}
            className="w-full max-w-sm space-y-5"
          >
            <div className="space-y-3">
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("auth.email", language)}
                  required
                  className="w-full pl-11 pr-5 py-4 rounded-2xl bg-surface-elevated shadow-luxury text-base font-light text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-score-emerald/30 transition-shadow border-0"
                />
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("auth.password", language)}
                  required
                  minLength={6}
                  className="w-full pl-11 pr-5 py-4 rounded-2xl bg-surface-elevated shadow-luxury text-base font-light text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-score-emerald/30 transition-shadow border-0"
                />
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-score-emerald text-primary-foreground text-sm font-medium shadow-luxury disabled:opacity-50"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {isLogin ? t("auth.login", language) : t("auth.signup", language)}
            </motion.button>

            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              {isLogin ? t("auth.noAccount", language) : t("auth.hasAccount", language)}
            </button>

            <div className="pt-3 border-t border-border/30">
              <button
                type="button"
                onClick={() => navigate("/m/login")}
                className="w-full text-center text-xs text-score-emerald font-medium hover:underline py-2"
              >
                🏪 {language === "th" ? "เข้าสู่ระบบร้านค้า" : "Merchant Login"}
              </button>
            </div>
          </motion.form>
        </div>
      </div>
    </PageTransition>
  );
};

export default Auth;
