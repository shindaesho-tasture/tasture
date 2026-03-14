import { Search } from "lucide-react";

const SensorySearch = () => {
  return (
    <section className="px-6 pb-4">
      <div className="flex items-center gap-3 px-5 py-3.5 bg-secondary rounded-xl">
        <Search size={18} strokeWidth={1.5} className="text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by Sensory DNA..."
          className="flex-1 bg-transparent text-sm font-normal text-foreground placeholder:text-muted-foreground outline-none"
        />
      </div>
    </section>
  );
};

export default SensorySearch;
