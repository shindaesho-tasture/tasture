import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useOrder } from "@/lib/order-context";

const QrRedirect = () => {
  const navigate = useNavigate();
  const { storeId, tableNumber } = useParams<{ storeId: string; tableNumber: string }>();
  const { setTableNumber } = useOrder();

  useEffect(() => {
    if (storeId) {
      const table = tableNumber ? parseInt(tableNumber, 10) : null;
      if (table && !isNaN(table)) {
        setTableNumber(table);
      }
      navigate(`/store/${storeId}/order`, { replace: true });
    } else {
      navigate("/store-list", { replace: true });
    }
  }, [storeId, tableNumber]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-score-emerald border-t-transparent animate-spin" />
    </div>
  );
};

export default QrRedirect;
