import { Search } from "lucide-react";
import { useState, useMemo } from "react";

interface SensorySearchProps {
  items?: string[];
  onResults?: (filtered: string[]) => void;
}

const normalizeThaiSearch = (query: string, target: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return target.toLowerCase().includes(q);
};

const SensorySearch = ({ items, onResults }: SensorySearchProps) => {
  const [query, setQuery] = useState("");

  const handleChange = (value: string) => {
    setQuery(value);
    if (items && onResults) {
      const filtered = items.filter((item) => normalizeThaiSearch(value, item));
      onResults(filtered);
    }
  };

  return (
    <section className="px-6 pb-4">
      <div className="flex items-center gap-3 px-5 py-3.5 bg-secondary rounded-xl">
        <Search size={18} strokeWidth={1.5} className="text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="ค้นหาร้านอาหารหรือเมนู..."
          className="flex-1 bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground outline-none"
          lang="th"
          inputMode="text"
          autoComplete="off"
        />
      </div>
    </section>
  );
};

export { normalizeThaiSearch };
export default SensorySearch;
