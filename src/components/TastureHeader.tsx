import { User } from "lucide-react";

const TastureHeader = () => {
  return (
    <header className="relative flex items-center justify-center px-6 pt-4 pb-2">
      <span className="text-lg font-semibold tracking-tight text-foreground">
        tasture
      </span>
      <button className="absolute right-6 flex items-center justify-center w-10 h-10 rounded-full bg-secondary gold-ring">
        <User size={18} className="text-muted-foreground" />
      </button>
    </header>
  );
};

export default TastureHeader;
