import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register push service worker globally so merchant receives push notifications
// on any page (not just kitchen/merchant pages)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw-push.js", { scope: "/" }).catch(() => {});
}

createRoot(document.getElementById("root")!).render(<App />);
