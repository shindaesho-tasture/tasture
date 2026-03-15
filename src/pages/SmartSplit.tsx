import PageTransition from "@/components/PageTransition";
import BottomNav from "@/components/BottomNav";
import { Split } from "lucide-react";

const SmartSplit = () => (
  <PageTransition>
    <div className="min-h-screen bg-background pb-24">
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4 px-6">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
          <Split size={28} strokeWidth={1.5} className="text-muted-foreground" />
        </div>
        <h1 className="text-xl font-medium text-foreground">Smart Split</h1>
        <p className="text-sm font-light text-muted-foreground text-center">
          แบ่งบิลอัจฉริยะ คำนวณค่าใช้จ่ายต่อหัว — เร็วๆ นี้
        </p>
      </div>
      <BottomNav />
    </div>
  </PageTransition>
);

export default SmartSplit;
