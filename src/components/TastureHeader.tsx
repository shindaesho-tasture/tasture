import { User } from "lucide-react";

const TastureHeader = () => {
  return (
    <header className="flex items-center justify-between px-6 pt-4 pb-2">
      <div>
        <span className="text-lg font-semibold tracking-tight text-foreground">
          tasture
        </span>
      </div>
      <button className="relative flex items-center justify-center w-10 h-10 rounded-full bg-secondary gold-ring">
        <User size={18} className="text-muted-foreground" />
      </button>
    </header>
  );
};

export default TastureHeader;
