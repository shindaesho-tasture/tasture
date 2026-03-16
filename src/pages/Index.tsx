import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import PageTransition from "@/components/PageTransition";
import TastureHeader from "@/components/TastureHeader";
import KingSwitcher from "@/components/KingSwitcher";
import SensorySearch from "@/components/SensorySearch";
import HeroFoodCard from "@/components/HeroFoodCard";
import BottomNav from "@/components/BottomNav";

const Index = () => {
  const navigate = useNavigate();

  return (
    <PageTransition>
    <div className="min-h-screen bg-background pb-24">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <TastureHeader />

        {/* Large Title */}
        <div className="px-6 pt-2 pb-1">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            สำรวจ
          </h1>
          <p className="text-sm font-light text-muted-foreground mt-1">
            สัมผัสรสชาติผ่านประสาทสัมผัสของคุณ
          </p>
        </div>

        <KingSwitcher />
        <SensorySearch />
        <HeroFoodCard />

        {/* Quick Actions */}
        <div className="px-6 pt-4 grid grid-cols-2 gap-3">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate("/register")}
            className="flex items-center gap-2 p-4 rounded-2xl bg-surface-elevated shadow-luxury border border-border/50 text-left"
          >
            <span className="text-xl">📝</span>
            <div>
              <span className="text-xs font-medium text-foreground block">เพิ่มร้านใหม่</span>
              <span className="text-[10px] font-light text-muted-foreground">ลงทะเบียนร้าน</span>
            </div>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate("/my-stores")}
            className="flex items-center gap-2 p-4 rounded-2xl bg-surface-elevated shadow-luxury border border-border/50 text-left"
          >
            <span className="text-xl">🏪</span>
            <div>
              <span className="text-xs font-medium text-foreground block">ร้านของฉัน</span>
              <span className="text-[10px] font-light text-muted-foreground">ดูร้าน & ฟีดแบค</span>
            </div>
          </motion.button>
        </div>
      </motion.div>

      <BottomNav />
    </div>
    </PageTransition>
  );
};

export default Index;
