import { useEffect } from "react";
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, Clock } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";

export default function ProcessingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { orderId, paymentMethod } = location.state || {};

  useEffect(() => {
    if (!orderId) {
      navigate('/');
      return;
    }

    // Simulate processing time
    const timer = setTimeout(() => {
      navigate('/order-confirmation', {
        state: { orderId, paymentMethod }
      });
    }, 3000); // 3 seconds

    return () => clearTimeout(timer);
  }, [orderId, navigate]);

  if (!orderId) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Card className="max-w-md w-full mx-4">
        <CardContent className="p-8 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="h-8 w-8 text-green-600 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Processing Your Order</h2>
            <p className="text-gray-600">
              {paymentMethod === 'COD'
                ? 'Your order has been placed successfully!'
                : 'Payment verified! Your order is being processed.'
              }
            </p>
          </div>

          <div className="space-y-3 text-sm text-gray-500">
            <div className="flex items-center justify-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Order ID: {orderId}</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Payment: {paymentMethod === 'COD' ? 'Cash on Delivery' : 'Paid Online'}</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Clock className="h-4 w-4 text-blue-500 animate-pulse" />
              <span>Preparing your fresh products...</span>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-sm text-gray-500">Redirecting to order confirmation...</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}