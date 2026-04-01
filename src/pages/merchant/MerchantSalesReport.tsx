import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { TrendingUp, CalendarDays, ShoppingBag, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMerchant } from "@/lib/merchant-context";
import { useLanguage } from "@/lib/language-context";
import PageTransition from "@/components/PageTransition";
import MerchantBottomNav from "@/components/merchant/MerchantBottomNav";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface DayData {
  date: string;
  label: string;
  revenue: number;
  orders: number;
}

interface TopMenuItem {
  name: string;
  qty: number;
  revenue: number;
}

const MerchantSalesReport = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const { activeStore, loading: storesLoading } = useMerchant();
  const isTh = language === "th";

  const [range, setRange] = useState<"7d" | "30d">("7d");
  const [dayData, setDayData] = useState<DayData[]>([]);
  const [topMenus, setTopMenus] = useState<TopMenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/m/login");
  }, [user, authLoading]);

  useEffect(() => {
    if (!activeStore) return;
    const fetchOrders = async () => {
      setLoading(true);
      const days = range === "7d" ? 7 : 30;
      const since = new Date();
      since.setDate(since.getDate() - days + 1);
      since.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from("orders")
        .select("total_price, created_at")
        .eq("store_id", activeStore.id)
        .gte("created_at", since.toISOString())
        .neq("status", "rejected");

      // Build day map
      const map: Record<string, { revenue: number; orders: number }> = {};
      for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(d.getDate() - days + 1 + i);
        const key = d.toISOString().split("T")[0];
        map[key] = { revenue: 0, orders: 0 };
      }
      (data || []).forEach((o) => {
        const key = o.created_at.split("T")[0];
        if (map[key]) {
          map[key].revenue += Number(o.total_price || 0);
          map[key].orders += 1;
        }
      });

      const weekdaysTh = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
      const weekdaysEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

      const result: DayData[] = Object.entries(map).map(([date, v]) => {
        const d = new Date(date + "T00:00:00");
        const label = days <= 7
          ? (isTh ? weekdaysTh[d.getDay()] : weekdaysEn[d.getDay()])
          : `${d.getDate()}/${d.getMonth() + 1}`;
        return { date, label, ...v };
      });

      setDayData(result);
      setLoading(false);
    };
    fetchOrders();
  }, [activeStore, range, isTh]);

  const totals = useMemo(() => {
    const totalRevenue = dayData.reduce((s, d) => s + d.revenue, 0);
    const totalOrders = dayData.reduce((s, d) => s + d.orders, 0);
    const avg = dayData.length > 0 ? totalRevenue / dayData.length : 0;

    // Compare first half vs second half for trend
    const mid = Math.floor(dayData.length / 2);
    const firstHalf = dayData.slice(0, mid).reduce((s, d) => s + d.revenue, 0);
    const secondHalf = dayData.slice(mid).reduce((s, d) => s + d.revenue, 0);
    const trendUp = secondHalf >= firstHalf;

    return { totalRevenue, totalOrders, avg, trendUp };
  }, [dayData]);

  const isPageLoading = authLoading || storesLoading || loading;

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-28">
        {/* Header */}
        <div className="sticky top-0 z-10 glass-effect glass-border">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <h1 className="text-base font-bold text-foreground">
                {isTh ? "สรุปยอดขาย" : "Sales Report"}
              </h1>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {activeStore?.name || ""}
              </p>
            </div>
            {/* Range toggle */}
            <div className="flex bg-secondary rounded-lg p-0.5 gap-0.5">
              {(["7d", "30d"] as const).map((r) => (
                <button key={r} onClick={() => setRange(r)}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                    range === r ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                  }`}>
                  {r === "7d" ? (isTh ? "7 วัน" : "7 Days") : (isTh ? "30 วัน" : "30 Days")}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isPageLoading ? (
          <div className="px-4 pt-4 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
            <Skeleton className="h-52 rounded-xl" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="px-4 pt-4">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-score-emerald/10 border border-score-emerald/20 p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <TrendingUp size={12} className="text-score-emerald" />
                    <span className="text-[8px] text-score-emerald uppercase tracking-wider font-semibold">
                      {isTh ? "รายได้รวม" : "Revenue"}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-foreground">฿{totals.totalRevenue.toLocaleString()}</p>
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {totals.trendUp ? (
                      <ArrowUpRight size={10} className="text-score-emerald" />
                    ) : (
                      <ArrowDownRight size={10} className="text-score-ruby" />
                    )}
                    <span className={`text-[9px] font-medium ${totals.trendUp ? "text-score-emerald" : "text-score-ruby"}`}>
                      {isTh ? (totals.trendUp ? "ขาขึ้น" : "ขาลง") : (totals.trendUp ? "Up" : "Down")}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl bg-surface-elevated border border-border/50 p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <ShoppingBag size={12} className="text-primary" />
                    <span className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold">
                      {isTh ? "ออเดอร์" : "Orders"}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-foreground">{totals.totalOrders}</p>
                </div>

                <div className="rounded-xl bg-surface-elevated border border-border/50 p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <CalendarDays size={12} className="text-amber-500" />
                    <span className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold">
                      {isTh ? "เฉลี่ย/วัน" : "Avg/Day"}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-foreground">฿{Math.round(totals.avg).toLocaleString()}</p>
                </div>
              </motion.div>
            </div>

            {/* Chart */}
            <div className="px-4 pt-5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-3">
                {isTh ? "รายได้รายวัน" : "Daily Revenue"}
              </p>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="rounded-xl bg-surface-elevated border border-border/50 p-3">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dayData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => `฿${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                      formatter={(value: number) => [`฿${value.toLocaleString()}`, isTh ? "รายได้" : "Revenue"]}
                      labelFormatter={(label) => label}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--score-emerald))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
            </div>

            {/* Orders chart */}
            <div className="px-4 pt-5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-3">
                {isTh ? "จำนวนออเดอร์รายวัน" : "Daily Orders"}
              </p>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="rounded-xl bg-surface-elevated border border-border/50 p-3">
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={dayData} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                      formatter={(value: number) => [value, isTh ? "ออเดอร์" : "Orders"]}
                    />
                    <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
            </div>

            {/* Daily breakdown table */}
            <div className="px-4 pt-5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-3">
                {isTh ? "รายละเอียดรายวัน" : "Daily Breakdown"}
              </p>
              <div className="rounded-xl bg-surface-elevated border border-border/50 overflow-hidden">
                <div className="grid grid-cols-3 gap-0 px-3 py-2 border-b border-border/30">
                  <span className="text-[9px] text-muted-foreground font-semibold uppercase">{isTh ? "วัน" : "Date"}</span>
                  <span className="text-[9px] text-muted-foreground font-semibold uppercase text-right">{isTh ? "รายได้" : "Revenue"}</span>
                  <span className="text-[9px] text-muted-foreground font-semibold uppercase text-right">{isTh ? "ออเดอร์" : "Orders"}</span>
                </div>
                {[...dayData].reverse().map((d) => (
                  <div key={d.date} className="grid grid-cols-3 gap-0 px-3 py-2.5 border-b border-border/10 last:border-b-0">
                    <span className="text-xs text-foreground">{d.date.slice(5)}</span>
                    <span className="text-xs text-foreground font-semibold text-right">฿{d.revenue.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground text-right">{d.orders}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <MerchantBottomNav />
      </div>
    </PageTransition>
  );
};

export default MerchantSalesReport;
