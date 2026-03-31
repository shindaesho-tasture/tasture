import PageTransition from "@/components/PageTransition";
import BottomNav from "@/components/BottomNav";
import { Split } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { t } from "@/lib/i18n";

const SmartSplit = () => {
  const { language } = useLanguage();
  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-24">
        <div className="flex flex-col items-center justify-center h-[70vh] gap-4 px-6">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
            <Split size={28} strokeWidth={1.5} className="text-muted-foreground" />
          </div>
          <h1 className="text-xl font-medium text-foreground">{t("split.title", language)}</h1>
          <p className="text-sm font-light text-muted-foreground text-center">
            {t("split.desc", language)}
          </p>
        </div>
        <BottomNav />
      </div>
    </PageTransition>
  );
};

export default SmartSplit;
