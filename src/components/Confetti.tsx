import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const COLORS = [
  "hsl(163 78% 40%)", // emerald
  "hsl(43 74% 49%)",  // gold
  "hsl(340 82% 52%)", // pink
  "hsl(200 90% 50%)", // blue
  "hsl(280 70% 55%)", // purple
  "hsl(25 95% 53%)",  // orange
];

const SHAPES = ["●", "■", "▲", "★", "◆"];

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  shape: string;
  size: number;
  rotation: number;
  delay: number;
}

const Confetti = ({ show, onDone }: { show: boolean; onDone?: () => void }) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!show) { setParticles([]); return; }
    const p: Particle[] = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: -10 - Math.random() * 20,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
      size: 8 + Math.random() * 10,
      rotation: Math.random() * 360,
      delay: Math.random() * 0.4,
    }));
    setParticles(p);
    const timer = setTimeout(() => { setParticles([]); onDone?.(); }, 2000);
    return () => clearTimeout(timer);
  }, [show]);

  return (
    <AnimatePresence>
      {particles.length > 0 && (
        <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden">
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ x: `${p.x}vw`, y: `${p.y}vh`, rotate: 0, opacity: 1 }}
              animate={{
                y: "110vh",
                rotate: p.rotation + 720,
                x: `${p.x + (Math.random() - 0.5) * 30}vw`,
                opacity: [1, 1, 0.8, 0],
              }}
              transition={{ duration: 1.6 + Math.random() * 0.8, delay: p.delay, ease: "easeIn" }}
              className="absolute"
              style={{ color: p.color, fontSize: p.size }}
            >
              {p.shape}
            </motion.div>
          ))}
        </div>
      )}
    </AnimatePresence>
  );
};

export default Confetti;
