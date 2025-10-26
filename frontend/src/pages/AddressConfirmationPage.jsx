import { useState, useEffect } from "react";
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, MapPin, Edit3, Plus, Home, Building, Clock, Navigation } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Separator } from "../components/ui/separator";

import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { MapPicker } from "../components/MapPicker";
import { addressService } from '../../../backend/services/addressService';
import { useAuth } from '../contexts/AuthContext';
import { cartService } from '../../../backend/services/cartService';
import { calculateDeliveryFee, calculateTotal } from '../../../backend/utils/deliveryUtils';

export function AddressConfirmationPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedAddressId, setSelectedAddressId] = useState("");

  const [savedAddresses, setSavedAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [subtotal, setSubtotal] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [total, setTotal] = useState(0);
  const [newAddress, setNewAddress] = useState({type: 'home', name: '', phone: '', address: '', landmark: '', city: '', state: '', pincode: '', coordinates: null});
  const [isAddingAddress, setIsAddingAddress] = useState(false);


  // Fetch saved addresses and cart
  useEffect(() => {
    const fetchAddresses = async () => {
      if (!currentUser) return;

      try {
        setLoading(true);
        const addresses = await addressService.getAddresses(currentUser.uid);
        setSavedAddresses(addresses);
        if (addresses.length > 0) {
          const defaultAddr = addresses.find(addr => addr.isDefault);
          setSelectedAddressId(defaultAddr ? defaultAddr._id : addresses[0]._id);
        }
      } catch (err) {
        console.error('Error fetching addresses:', err);
        setError('Failed to load addresses');
      }
    };

    const fetchCart = async () => {
      if (!currentUser) return;

      try {
        const cartData = await cartService.getCart(currentUser.uid);
        const items = location.state?.cartItems || cartData.items;
        const calculatedSubtotal = location.state?.subtotal || cartData.subtotal || 0;
        
        setCartItems(items);
        setSubtotal(calculatedSubtotal);
        
        // Use backend delivery fee if available, otherwise calculate on frontend
        let backendDeliveryFee = location.state?.deliveryFee || cartData.deliveryFee;
        let backendTotal = location.state?.totalAmount || cartData.totalAmount;
        
        // If backend values are missing or incorrect, calculate on frontend
        if (backendDeliveryFee === undefined || backendDeliveryFee === null || 
            (calculatedSubtotal > 0 && backendDeliveryFee === 0 && calculatedSubtotal < 500)) {
          const frontendCalculation = calculateTotal(calculatedSubtotal);
          setDeliveryFee(frontendCalculation.deliveryFee);
          setTotal(frontendCalculation.totalAmount);
        } else {
          setDeliveryFee(backendDeliveryFee || 0);
          setTotal(backendTotal || (calculatedSubtotal + (backendDeliveryFee || 0)));
        }
      } catch (err) {
        console.error('Error fetching cart:', err);
        setError('Failed to load cart');
      } finally {
        setLoading(false);
      }
    };

    fetchAddresses();
    fetchCart();
  }, [currentUser]);



  const selectedAddress = savedAddresses.find(addr => addr._id === selectedAddressId);

  const handleProceed = () => {
    if (selectedAddress) {
      navigate('/payment', { state: { selectedAddress, cartItems, total, deliveryFee, subtotal } });
    }
  };

  const handleAddNewAddress = async () => {
    try {
      const result = await addressService.addAddress(currentUser.uid, newAddress);
      setSavedAddresses([...savedAddresses, result.address]);
      setSelectedAddressId(result.address._id);
      setNewAddress({type: 'home', name: '', phone: '', address: '', landmark: '', city: '', state: '', pincode: '', coordinates: null});
      setIsAddingAddress(false);
    } catch (err) {
      console.error('Error adding address:', err);
    }
  };

  const handleCancelAddAddress = () => {
    setIsAddingAddress(false);
    setNewAddress({type: 'home', name: '', phone: '', address: '', landmark: '', city: '', state: '', pincode: '', coordinates: null});
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" onClick={() => navigate(-1)} className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Cart
            </Button>
            <h1 className="text-3xl font-bold text-gray-800">Select Delivery Address</h1>
          </div>

          {loading && (
            <div className="text-center py-8">
              <p>Loading addresses...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Address Selection */}
              <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Select Address
                    </span>
                    <Button variant="outline" size="sm" className="flex items-center gap-2" onClick={() => setIsAddingAddress(!isAddingAddress)}>
                      <Plus className="h-4 w-4" />
                      Add New
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isAddingAddress && (
                    <div className="space-y-4 mb-6">
                      <div>
                        <Select value={newAddress.type} onValueChange={(value) => setNewAddress({...newAddress, type: value})}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="home">
                              <div className="flex items-center gap-2">
                                <Home className="h-4 w-4" />
                                Home
                              </div>
                            </SelectItem>
                            <SelectItem value="work">
                              <div className="flex items-center gap-2">
                                <Building className="h-4 w-4" />
                                Work
                              </div>
                            </SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                          id="name"
                          value={newAddress.name}
                          onChange={(e) => setNewAddress({...newAddress, name: e.target.value})}
                          placeholder="Enter full name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input
                          id="phone"
                          value={newAddress.phone}
                          onChange={(e) => setNewAddress({...newAddress, phone: e.target.value})}
                          placeholder="+91 9876543210"
                        />
                      </div>
                      <div>
                        <Label htmlFor="address">Address</Label>
                        <Textarea
                          id="address"
                          value={newAddress.address}
                          onChange={(e) => setNewAddress({...newAddress, address: e.target.value})}
                          placeholder="Enter complete address"
                        />
                      </div>
                      <div>
                        <Label htmlFor="landmark">Landmark (Optional)</Label>
                        <Input
                          id="landmark"
                          value={newAddress.landmark}
                          onChange={(e) => setNewAddress({...newAddress, landmark: e.target.value})}
                          placeholder="Near xyz building"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="city">City</Label>
                          <Input
                            id="city"
                            value={newAddress.city}
                            onChange={(e) => setNewAddress({...newAddress, city: e.target.value})}
                            placeholder="City"
                          />
                        </div>
                        <div>
                          <Label htmlFor="state">State</Label>
                          <Input
                            id="state"
                            value={newAddress.state}
                            onChange={(e) => setNewAddress({...newAddress, state: e.target.value})}
                            placeholder="State"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="pincode">Pincode</Label>
                        <Input
                          id="pincode"
                          value={newAddress.pincode}
                          onChange={(e) => setNewAddress({...newAddress, pincode: e.target.value})}
                          placeholder="110001"
                        />
                      </div>

                      {/* Coordinates Section */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Navigation className="h-4 w-4" />
                          <Label className="text-base font-medium">Location Coordinates</Label>
                        </div>
                        <MapPicker
                          onLocationSelect={(coordinates) => setNewAddress({...newAddress, coordinates})}
                          initialLocation={newAddress.coordinates}
                          className="border rounded-lg p-4"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={handleCancelAddAddress} variant="outline" className="flex-1">
                          Cancel
                        </Button>
                        <Button onClick={handleAddNewAddress} className="flex-1">
                          Add Address
                        </Button>
                      </div>
                    </div>
                  )}
                  <RadioGroup value={selectedAddressId} onValueChange={setSelectedAddressId} className="mt-6">
                    {savedAddresses.map((address) => (
                      <div key={address._id} className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50">
                        <RadioGroupItem value={address._id} id={address._id} className="mt-1" />
                        <Label htmlFor={address._id} className="flex-1 cursor-pointer">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="secondary">
                              {address.type === "home" && <Home className="h-3 w-3 mr-1" />}
                              {address.type === "work" && <Building className="h-3 w-3 mr-1" />}
                              {address.type}
                            </Badge>
                            {address.isDefault && <Badge variant="outline">Default</Badge>}
                          </div>
                          <p className="font-medium">{address.name}</p>
                          <p className="text-gray-600">{address.address}</p>
                          {address.landmark && <p className="text-gray-600">Landmark: {address.landmark}</p>}
                          <p className="text-gray-600">{address.city}, {address.state} - {address.pincode}</p>
                          <p className="text-gray-600">{address.phone}</p>
                          {address.coordinates && (
                            <div className="flex items-center gap-1 text-xs text-blue-600 mt-1">
                              <Navigation className="h-3 w-3" />
                              <span>{address.coordinates.lat.toFixed(6)}, {address.coordinates.lng.toFixed(6)}</span>
                            </div>
                          )}
                        </Label>
                        <Button variant="ghost" size="sm" onClick={() => navigate('/add-address', { state: { address } })}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </RadioGroup>
                </CardContent>
              </Card>
            </div>
          
            {/* Order Summary */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Items */}
                  <div className="space-y-4 mb-6">
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

                  <Separator />

                  {/* Pricing */}
                  <div className="space-y-3 mb-6">
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
                    <div className="flex justify-between text-lg font-semibold">
                      <span>Total</span>
                      <span className="text-green-600">₹{total}</span>
                    </div>
                  </div>

                  <Button onClick={handleProceed} className="w-full bg-green-600 hover:bg-green-700" size="lg">
                    Proceed to Payment ₹{total}
                  </Button>

                  <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
                    <Clock className="h-4 w-4" />
                    Estimated delivery: 15-30 mins
                  </div>
                </CardContent>
              </Card>
              </div>
            </div>
          )}
          
      </div>
        
    </div>
  </div>
  );
}

export default AddressConfirmationPage