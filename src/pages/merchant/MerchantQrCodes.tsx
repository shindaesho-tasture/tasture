import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Download, Plus, Minus, QrCode, Printer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMerchant } from "@/lib/merchant-context";
import { useLanguage } from "@/lib/language-context";
import PageTransition from "@/components/PageTransition";
import MerchantBottomNav from "@/components/merchant/MerchantBottomNav";
import { StyledQrCode } from "@/components/ui/StyledQrCode";

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

  // Export single card as PNG via canvas
  const downloadSingleQr = useCallback(async (table: number) => {
    if (!activeStore) return;
    const svgEl = document.getElementById(`qr-svg-${table}`);
    if (!svgEl) return;

    const svgString = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 600;
      canvas.height = 720;
      const ctx = canvas.getContext("2d")!;

      // Card background gradient
      const bg = ctx.createLinearGradient(0, 0, 0, 720);
      bg.addColorStop(0, "#0f1a14");
      bg.addColorStop(1, "#0a1410");
      ctx.fillStyle = bg;
      ctx.roundRect(0, 0, 600, 720, 32);
      ctx.fill();

      // Accent line top
      const accent = ctx.createLinearGradient(0, 0, 600, 0);
      accent.addColorStop(0, "#059669");
      accent.addColorStop(1, "#34d399");
      ctx.fillStyle = accent;
      ctx.roundRect(60, 0, 480, 4, 2);
      ctx.fill();

      // QR image centered
      const qrSize = 320;
      const qrX = (600 - qrSize) / 2;
      const qrY = 80;
      ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

      // Table text
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 64px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`โต๊ะ ${table}`, 300, 460);

      // Store name
      ctx.fillStyle = "#6ee7b7";
      ctx.font = "500 28px system-ui, -apple-system, sans-serif";
      ctx.fillText(activeStore.name, 300, 510);

      // Scan prompt
      ctx.fillStyle = "#4b5563";
      ctx.font = "22px system-ui, -apple-system, sans-serif";
      ctx.fillText(isTh ? "สแกนเพื่อสั่งอาหาร" : "Scan to order", 300, 568);

      // Tasture branding
      ctx.fillStyle = "#374151";
      ctx.font = "18px system-ui, -apple-system, sans-serif";
      ctx.fillText("powered by Tasture", 300, 650);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${activeStore.name}_table_${table}.png`;
        a.click();
      }, "image/png");
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [activeStore, isTh]);

  const handlePrint = () => {
    if (!printRef.current || !activeStore) return;
    const w = window.open("", "_blank");
    if (!w) return;

    // Collect all SVG strings for each table
    const cards = Array.from({ length: tableCount }, (_, i) => i + 1).map((table) => {
      const svgEl = document.getElementById(`qr-svg-${table}`);
      const svgStr = svgEl ? new XMLSerializer().serializeToString(svgEl) : "";
      return { table, svgStr };
    });

    const cardsHtml = cards.map(({ table, svgStr }) => `
      <div class="card">
        <div class="qr-wrap">${svgStr}</div>
        <p class="store">${activeStore.name}</p>
        <p class="table">โต๊ะ ${table}</p>
        <p class="scan">${isTh ? "สแกนเพื่อสั่งอาหาร" : "Scan to order"}</p>
      </div>
    `).join("");

    w.document.write(`
      <html><head><title>QR Codes – ${activeStore.name}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, sans-serif; margin: 0; padding: 16px; background: #f3f4f6; }
        .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
        .card { background: #0f1a14; border-radius: 20px; padding: 24px 20px 20px; text-align: center; page-break-inside: avoid; border-top: 3px solid #059669; }
        .qr-wrap { display: flex; justify-content: center; margin-bottom: 12px; }
        .qr-wrap svg { border-radius: 12px; }
        .store { color: #6ee7b7; font-size: 13px; margin: 0 0 4px; font-weight: 500; }
        .table { color: #fff; font-size: 32px; font-weight: 900; margin: 0 0 4px; }
        .scan { color: #6b7280; font-size: 11px; margin: 0; }
        @media print { body { background: white; padding: 8px; } .grid { gap: 12px; } }
      </style></head><body>
      <div class="grid">${cardsHtml}</div>
      <script>setTimeout(()=>window.print(),600)<\/script>
      </body></html>
    `);
    w.document.close();
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
              <Printer size={14} />
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
            const qrUrl = getQrUrl(activeStore.id, table);
            return (
              <motion.div
                key={table}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(table * 0.03, 0.4), duration: 0.25 }}
                className="rounded-2xl overflow-hidden border border-score-emerald/20"
                style={{ background: "linear-gradient(160deg, #0f1a14 0%, #0a1410 100%)" }}
              >
                {/* Top accent bar */}
                <div
                  className="h-[3px] w-full"
                  style={{ background: "linear-gradient(90deg, #059669, #34d399)" }}
                />

                <div className="p-4 flex flex-col items-center gap-2">
                  {/* Styled QR code */}
                  <div className="rounded-xl overflow-hidden bg-white p-2 shadow-lg">
                    <div id={`qr-svg-${table}`}>
                      <StyledQrCode
                        data={qrUrl}
                        size={140}
                        color="#059669"
                        colorSecondary="#34d399"
                        logo={activeStore.logo_url ?? undefined}
                        logoLetter={activeStore.name.charAt(0).toUpperCase()}
                      />
                    </div>
                  </div>

                  {/* Store name */}
                  <p className="text-[10px] font-medium text-emerald-400/80 mt-1 text-center leading-tight">
                    {activeStore.name}
                  </p>

                  {/* Table number */}
                  <p className="text-2xl font-black text-white leading-none">
                    โต๊ะ {table}
                  </p>

                  {/* Scan prompt */}
                  <p className="text-[9px] text-gray-500 text-center">
                    {isTh ? "สแกนเพื่อสั่งอาหาร" : "Scan to order"}
                  </p>

                  {/* Branding */}
                  <p className="text-[8px] text-gray-600 tracking-wider uppercase mt-0.5">
                    Tasture
                  </p>

                  {/* Download button */}
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => downloadSingleQr(table)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold mt-1 transition-colors"
                    style={{ background: "rgba(5,150,105,0.15)", color: "#34d399" }}
                  >
                    <Download size={11} />
                    {isTh ? "ดาวน์โหลด" : "Download"}
                  </motion.button>
                </div>
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
