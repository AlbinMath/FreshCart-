import { useState, useEffect } from "react";
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, CreditCard, Truck, MapPin, Package, Smartphone, Wallet } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import { orderService } from '../../../backend/services/orderService';
import { useAuth } from '../contexts/AuthContext';

export default function PaymentPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedAddress, cartItems, total, deliveryFee, subtotal } = location.state || {};

  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!selectedAddress || !cartItems) {
      navigate('/address-confirmation');
    }
  }, [selectedAddress, cartItems, navigate]);

  const handlePlaceOrder = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      setError(null);

      const storeDetails = cartItems.length > 0 ? {
        sellerId: cartItems[0].sellerUid,
        sellerCollection: cartItems[0].sellerCollection
      } : {};

      // Map cart items to match Order model schema
      const mappedProducts = cartItems.map(item => ({
        id: item._id || item.id,
        name: item.productName,
        price: item.price,
        quantity: item.quantity,
        image: item.productImage,
        isVeg: item.isVeg || false
      }));

      const orderData = {
        userId: currentUser.uid,
        products: mappedProducts,
        subtotal,
        deliveryFee,
        totalAmount: total,
        paymentMethod,
        deliveryAddress: selectedAddress,
        storeDetails,
        cartItems: cartItems // Keep original for payment record
      };

      if (paymentMethod === 'COD') {
        const result = await orderService.createOrder(orderData);
        navigate('/processing', {
          state: {
            orderId: result.orderId,
            paymentMethod: 'COD'
          }
        });
      } else if (paymentMethod === 'Razorpay' || paymentMethod === 'UPI' || paymentMethod === 'Wallet') {
        const result = await orderService.createOrder(orderData);

        // Load Razorpay script
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => {
          const options = {
            key: 'rzp_test_RL7iTlLIMH8nZY', // Test key
            amount: result.order.amount,
            currency: result.order.currency,
            name: 'FreshCart',
            description: 'Fresh Product Delivery',
            order_id: result.order.id,
            handler: async (response) => {
              try {
                const verifyResult = await orderService.verifyPayment({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  orderId: result.order.orderId
                });

                navigate('/processing', {
                  state: {
                    orderId: verifyResult.orderId,
                    paymentMethod: paymentMethod
                  }
                });
              } catch (err) {
                console.error('Payment verification failed:', err);
                setError('Payment verification failed. Please contact support.');
              }
            },
            prefill: {
              name: selectedAddress.name,
              email: currentUser.email,
              contact: selectedAddress.phone
            },
            theme: {
              color: '#16a34a'
            },
            // Configure payment methods based on selection
            method: {
              upi: paymentMethod === 'UPI' || paymentMethod === 'Razorpay',
              wallet: paymentMethod === 'Wallet' || paymentMethod === 'Razorpay',
              card: paymentMethod === 'Razorpay',
              netbanking: paymentMethod === 'Razorpay'
            },
            // Add UPI configuration for Razorpay
            config: {
              display: {
                blocks: {
                  utib: { // UPI block
                    name: 'Pay using UPI',
                    instruments: [
                      {
                        method: 'upi',
                        flows: ['collect', 'intent', 'qr']
                      }
                    ]
                  },
                  other: { // Other payment methods
                    name: 'Other Payment Methods',
                    instruments: [
                      {
                        method: 'card'
                      },
                      {
                        method: 'netbanking'
                      },
                      {
                        method: 'wallet'
                      }
                    ]
                  }
                },
                sequence: ['utib', 'other'],
                preferences: {
                  show_default_blocks: true
                }
              }
            },
            // UPI specific configuration
            upi: {
              flow: 'collect',
              vpa: '',
              apps: ['googlepay', 'paytm', 'phonepe', 'amazonpay']
            },
            // Wallet specific configuration
            wallet: {
              paytm: true,
              amazonpay: true,
              mobikwik: true
            }
          };

          const rzp = new window.Razorpay(options);
          rzp.open();
        };
        document.body.appendChild(script);
      }
    } catch (err) {
      console.error('Error placing order:', err);
      setError('Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!selectedAddress || !cartItems) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" onClick={() => navigate(-1)} className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <h1 className="text-3xl font-bold text-gray-800">Payment</h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Order Summary */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Order Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {cartItems.map((item) => (
                      <div key={item._id || item.id} className="flex items-center gap-4 p-3 border rounded-lg">
                        <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                          {item.productImage ? (
                            <img
                              src={item.productImage}
                              alt={item.productName}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <span className="text-gray-400 text-lg">📦</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{item.productName}</p>
                          <p className="text-sm text-gray-500">{item.category}</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-sm text-gray-600">Qty: {item.quantity} × ₹{item.price}</span>
                            <span className="font-medium text-green-600">₹{item.price * item.quantity}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>₹{subtotal}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Delivery Fee</span>
                      <span className={deliveryFee === 0 ? "text-green-600 font-medium" : ""}>
                        {deliveryFee === 0 ? "FREE" : `₹${deliveryFee}`}
                      </span>
                    </div>
                    {deliveryFee > 0 && subtotal < 500 && (
                      <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                        Add ₹{500 - subtotal} more for free delivery
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-semibold text-lg">
                      <span>Total</span>
                      <span className="text-green-600">₹{total}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Delivery Address */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Delivery Address
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-medium">{selectedAddress.name}</p>
                    <p className="text-gray-600">{selectedAddress.address}</p>
                    {selectedAddress.landmark && <p className="text-gray-600">Landmark: {selectedAddress.landmark}</p>}
                    <p className="text-gray-600">{selectedAddress.city}, {selectedAddress.state} - {selectedAddress.pincode}</p>
                    <p className="text-gray-600">{selectedAddress.phone}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Payment Method */}
            <div className="space-y-6">
              {/* Test Section - Total Price Display */}
              <Card className="border-2 border-green-500 bg-gradient-to-r from-green-50 to-blue-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-center text-green-700">💰 Payment Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center space-y-3">
                    <div className="bg-white p-4 rounded-lg shadow-sm border">
                      <p className="text-sm text-gray-600 mb-1">Total Amount to Pay</p>
                      <p className="text-4xl font-bold text-green-600">₹{total}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-white p-2 rounded">
                        <p className="text-gray-500">Subtotal</p>
                        <p className="font-semibold">₹{subtotal}</p>
                      </div>
                      <div className="bg-white p-2 rounded">
                        <p className="text-gray-500">Delivery</p>
                        <p className="font-semibold text-green-600">{deliveryFee === 0 ? "FREE" : `₹${deliveryFee}`}</p>
                      </div>
                      <div className="bg-white p-2 rounded">
                        <p className="text-gray-500">Total</p>
                        <p className="font-semibold text-green-600">₹{total}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Choose Payment Method</CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-4">
                    <div className={`flex items-center space-x-3 p-4 border-2 rounded-lg hover:bg-orange-50 transition-all duration-200 ${paymentMethod === 'COD' ? 'border-orange-500 bg-orange-50 shadow-md' : 'border-gray-200'}`}>
                      <RadioGroupItem value="COD" id="cod" />
                      <Label htmlFor="cod" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-orange-100 rounded-full">
                            <Truck className="h-6 w-6 text-orange-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900">Cash on Delivery</p>
                              <span className="text-xs bg-orange-500 text-white px-2 py-1 rounded-full font-medium">NO ADVANCE</span>
                            </div>
                            <p className="text-sm text-gray-600">Pay when you receive your order</p>
                            <p className="text-xs text-orange-600 mt-1">✓ No online payment required • ✓ Pay at doorstep</p>
                          </div>
                        </div>
                      </Label>
                    </div>

                    <div className={`flex items-center space-x-3 p-4 border-2 rounded-lg hover:bg-blue-50 transition-all duration-200 ${paymentMethod === 'Razorpay' ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-200'}`}>
                      <RadioGroupItem value="Razorpay" id="razorpay" />
                      <Label htmlFor="razorpay" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-full">
                            <CreditCard className="h-6 w-6 text-blue-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900">Online Payment</p>
                              <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full font-medium">SECURE</span>
                            </div>
                            <p className="text-sm text-gray-600">Credit/Debit Card, Net Banking</p>
                            <p className="text-xs text-blue-600 mt-1">✓ 256-bit SSL encryption • ✓ All major cards accepted</p>
                          </div>
                        </div>
                      </Label>
                    </div>
                    </RadioGroup>
                    

                    

                    

                  {error && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-red-600 text-sm">{error}</p>
                    </div>
                  )}

                  {/* Enhanced Total Price Display */}
                  <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-300 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-green-800">Total Amount:</span>
                      <span className="text-3xl font-bold text-green-600">₹{total}</span>
                    </div>
                    <p className="text-sm text-green-700 mt-1">
                      {paymentMethod === 'COD' ? '💵 Pay when you receive your order' : 
                       paymentMethod === 'UPI' ? '📱 Quick UPI payment' :
                       paymentMethod === 'Wallet' ? '💳 Pay from wallet balance' :
                       '🔒 Secure online payment'}
                    </p>
                    {deliveryFee === 0 && (
                      <p className="text-xs text-green-600 mt-1">🎉 You saved ₹{Math.ceil(subtotal * 0.1)} on delivery!</p>
                    )}
                  </div>

                  <Button
                    onClick={handlePlaceOrder}
                    disabled={loading}
                    className="w-full mt-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white text-lg py-4 font-semibold shadow-lg"
                    size="lg"
                  >
                    {loading ? '⏳ Processing...' : 
                     paymentMethod === 'COD' ? `🛒 Place Order - ₹${total}` :
                     paymentMethod === 'UPI' ? `📱 Pay via UPI - ₹${total}` :
                     paymentMethod === 'Wallet' ? `💳 Pay from Wallet - ₹${total}` :
                     `💳 Pay Now - ₹${total}`}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
);}