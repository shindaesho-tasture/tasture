import { motion } from "framer-motion";

const ScanningOverlay = () => (
  <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
    {/* Dark overlay */}
    <div className="absolute inset-0 bg-foreground/10" />

    {/* Emerald scanning line */}
    <motion.div
      className="absolute left-0 right-0 h-0.5"
      style={{
        background: "linear-gradient(90deg, transparent 0%, hsl(var(--score-emerald)) 20%, hsl(var(--score-emerald)) 80%, transparent 100%)",
        boxShadow: "0 0 20px 4px hsl(var(--score-emerald) / 0.5), 0 0 60px 8px hsl(var(--score-emerald) / 0.2)",
      }}
      initial={{ top: "0%" }}
      animate={{ top: ["0%", "100%", "0%"] }}
      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
    />

    {/* Corner brackets */}
    {[
      "top-3 left-3 border-t-2 border-l-2",
      "top-3 right-3 border-t-2 border-r-2",
      "bottom-3 left-3 border-b-2 border-l-2",
      "bottom-3 right-3 border-b-2 border-r-2",
    ].map((pos) => (
      <motion.div
        key={pos}
        className={`absolute w-5 h-5 ${pos} border-score-emerald rounded-sm`}
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
    ))}

    {/* Status text */}
    <motion.div
      className="absolute bottom-5 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-foreground/60 backdrop-blur-md"
      animate={{ opacity: [0.7, 1, 0.7] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    >
      <span className="text-[10px] font-medium text-primary-foreground tracking-wider uppercase">
        Scanning Menu...
      </span>
    </motion.div>
  </div>
);

export default ScanningOverlay;
