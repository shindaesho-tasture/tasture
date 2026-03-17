import { User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import NotificationBell from "@/components/NotificationBell";

const TastureHeader = () => {
  const navigate = useNavigate();

  return (
    <header className="relative flex items-center justify-center px-6 pt-4 pb-2">
      <span className="text-lg font-semibold tracking-tight text-foreground">
        tasture
      </span>
      <div className="absolute right-6 flex items-center gap-2">
        <NotificationBell />
        <button
          onClick={() => navigate("/profile")}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-secondary gold-ring"
        >
          <User size={18} className="text-muted-foreground" />
        </button>
      </div>
    </header>
  );
};

export default TastureHeader;
