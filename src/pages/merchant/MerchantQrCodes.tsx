import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Download, Plus, Minus, QrCode } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMerchant } from "@/lib/merchant-context";
import { useLanguage } from "@/lib/language-context";
import PageTransition from "@/components/PageTransition";
import MerchantBottomNav from "@/components/merchant/MerchantBottomNav";

const MerchantQrCodes = () => {
  const navigate = useNavigate();
  const { activeStore } = useMerchant();
  const { language } = useLanguage();
  const isTh = language === "th";
  const [tableCount, setTableCount] = useState(10);
  const printRef = useRef<HTMLDivElement>(null);

  const baseUrl = window.location.origin;

  const getQrUrl = (storeId: string, table: number) =>
    `${baseUrl}/qr/${storeId}/${table}`;

  const getQrImageUrl = (text: string, size = 200) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&margin=8`;

  const handlePrint = () => {
    if (printRef.current) {
      const w = window.open("", "_blank");
      if (!w) return;
      w.document.write(`
        <html><head><title>QR Codes - ${activeStore?.name}</title>
        <style>
          body { font-family: sans-serif; margin: 0; padding: 20px; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
          .card { border: 2px solid #e5e7eb; border-radius: 16px; padding: 20px; text-align: center; page-break-inside: avoid; }
          .card img { width: 160px; height: 160px; margin: 0 auto 12px; }
          .store-name { font-size: 14px; color: #6b7280; margin-bottom: 4px; }
          .table-num { font-size: 28px; font-weight: 800; color: #111; }
          .table-label { font-size: 12px; color: #9ca3af; }
          @media print { body { padding: 10px; } .grid { gap: 16px; } }
        </style></head><body>
        ${printRef.current.innerHTML}
        <script>setTimeout(()=>window.print(),500)<\/script>
        </body></html>
      `);
      w.document.close();
    }
  };

  if (!activeStore) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background flex items-center justify-center pb-20">
          <p className="text-muted-foreground">{isTh ? "กรุณาเลือกร้านก่อน" : "Please select a store"}</p>
        </div>
        <MerchantBottomNav />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-24">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/30">
          <div className="flex items-center gap-3 px-4 py-3">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors">
              <ChevronLeft size={22} strokeWidth={1.5} className="text-foreground" />
            </button>
            <div className="flex-1">
              <h1 className="text-base font-bold text-foreground flex items-center gap-2">
                <QrCode size={18} className="text-score-emerald" />
                {isTh ? "QR Code ตามโต๊ะ" : "Table QR Codes"}
              </h1>
              <p className="text-[10px] text-muted-foreground">{activeStore.name}</p>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-score-emerald text-primary-foreground text-xs font-bold"
            >
              <Download size={14} />
              {isTh ? "พิมพ์ทั้งหมด" : "Print All"}
            </motion.button>
          </div>
        </div>

        {/* Table Count Selector */}
        <div className="px-4 py-4">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border/40">
            <span className="text-sm font-medium text-foreground">
              {isTh ? "จำนวนโต๊ะ" : "Number of tables"}
            </span>
            <div className="flex items-center gap-3">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setTableCount((c) => Math.max(1, c - 1))}
                className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center"
              >
                <Minus size={16} className="text-foreground" />
              </motion.button>
              <span className="text-xl font-bold text-foreground w-8 text-center">{tableCount}</span>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setTableCount((c) => Math.min(50, c + 1))}
                className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center"
              >
                <Plus size={16} className="text-foreground" />
              </motion.button>
            </div>
          </div>
        </div>

        {/* QR Cards Grid */}
        <div ref={printRef} className="grid grid-cols-2 gap-3 px-4">
          {Array.from({ length: tableCount }, (_, i) => i + 1).map((table) => {
            const qrData = getQrUrl(activeStore.id, table);
            return (
              <motion.div
                key={table}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: table * 0.02 }}
                className="rounded-2xl border border-border/40 bg-card p-4 flex flex-col items-center gap-2"
              >
                <img
                  src={getQrImageUrl(qrData)}
                  alt={`Table ${table} QR`}
                  className="w-32 h-32 rounded-lg"
                  loading="lazy"
                />
                <p className="text-[10px] text-muted-foreground">{activeStore.name}</p>
                <p className="text-2xl font-black text-foreground">โต๊ะ {table}</p>
                <p className="text-[9px] text-muted-foreground break-all text-center leading-tight max-w-full">
                  {isTh ? "สแกนเพื่อสั่งอาหาร" : "Scan to order"}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
      <MerchantBottomNav />
    </PageTransition>
  );
};

export default MerchantQrCodes;
