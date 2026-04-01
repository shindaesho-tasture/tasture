import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useOrder } from "@/lib/order-context";
import { useLanguage, LANGUAGES, type AppLanguage } from "@/lib/language-context";
import { motion } from "framer-motion";

const QrRedirect = () => {
  const navigate = useNavigate();
  const { storeId, tableNumber } = useParams<{ storeId: string; tableNumber: string }>();
  const { setTableNumber } = useOrder();
  const { setLanguage } = useLanguage();
  const [showPicker, setShowPicker] = useState(true);

  const handleSelectLanguage = (lang: AppLanguage) => {
    setLanguage(lang);
    if (storeId) {
      const table = tableNumber ? parseInt(tableNumber, 10) : null;
      if (table && !isNaN(table)) {
        setTableNumber(table);
      }
      navigate(`/store/${storeId}/order`, { replace: true });
    } else {
      navigate("/store-list", { replace: true });
    }
  };

  if (!showPicker) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm bg-card rounded-2xl shadow-xl border p-6 space-y-6"
      >
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">🌐</h1>
          <p className="text-lg font-semibold text-foreground">เลือกภาษา / Select Language</p>
        </div>

        <div className="space-y-3">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelectLanguage(lang.code)}
              className="w-full flex items-center gap-4 p-4 rounded-xl border bg-background hover:bg-accent transition-colors text-left"
            >
              <span className="text-3xl">{lang.flag}</span>
              <div>
                <p className="font-semibold text-foreground">{lang.nativeLabel}</p>
                <p className="text-sm text-muted-foreground">{lang.label}</p>
              </div>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default QrRedirect;
