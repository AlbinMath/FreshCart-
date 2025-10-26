import { useState, useEffect } from "react";
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Home, Building, Navigation, Plus, Edit, Trash2, Map, MapPin } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { MapPicker } from "../components/MapPicker";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { addressService } from '../services/addressService';
import { useAuth } from '../contexts/AuthContext';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to display all addresses on a map
function AddressMapViewer({ addresses, onAddressSelect, currentLocation }) {
  const [selectedAddress, setSelectedAddress] = useState(null);

  const handleMarkerClick = (address) => {
    setSelectedAddress(address);
    onAddressSelect(address);
  };

  // Calculate center point from all addresses or use current location
  const getMapCenter = () => {
    if (addresses.length === 0) return [20.5937, 78.9629]; // Center of India

    if (currentLocation) return [currentLocation.lat, currentLocation.lng];

    // Calculate centroid of all addresses
    let totalLat = 0, totalLng = 0, count = 0;
    addresses.forEach(addr => {
      if (addr.coordinates && addr.coordinates.lat && addr.coordinates.lng) {
        totalLat += addr.coordinates.lat;
        totalLng += addr.coordinates.lng;
        count++;
      }
    });

    if (count > 0) {
      return [totalLat / count, totalLng / count];
    }

    return [20.5937, 78.9629];
  };

  return (
    <div className="h-96 w-full border rounded-lg overflow-hidden">
      <MapContainer
        center={getMapCenter()}
        zoom={addresses.length === 1 ? 15 : 10}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Current location marker */}
        {currentLocation && (
          <Marker position={[currentLocation.lat, currentLocation.lng]}>
            <Popup>
              <div className="text-center">
                <strong>📍 Your Current Location</strong><br />
                Lat: {currentLocation.lat.toFixed(6)}<br />
                Lng: {currentLocation.lng.toFixed(6)}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Address markers */}
        {addresses.map((address, index) => {
          if (!address.coordinates || !address.coordinates.lat || !address.coordinates.lng) {
            return null;
          }

          const iconHtml = address.type === 'home' ? '🏠' : address.type === 'work' ? '🏢' : '📍';
          const customIcon = L.divIcon({
            html: `<div style="background-color: ${selectedAddress?._id === address._id ? '#ef4444' : '#3b82f6'}; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">${iconHtml}</div>`,
            className: 'custom-address-marker',
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          });

          return (
            <Marker
              key={address._id || index}
              position={[address.coordinates.lat, address.coordinates.lng]}
              icon={customIcon}
              eventHandlers={{
                click: () => handleMarkerClick(address),
              }}
            >
              <Popup>
                <div className="max-w-xs">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold capitalize">{address.type}</span>
                    {address.isDefault && (
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Default</span>
                    )}
                  </div>
                  <p className="font-medium">{address.name}</p>
                  <p className="text-sm text-gray-600">{address.phone}</p>
                  <p className="text-sm text-gray-600">
                    {address.house ? `${address.house}, ` : ''}{address.street}
                  </p>
                  {address.landmark && <p className="text-sm text-gray-600">Near: {address.landmark}</p>}
                  <p className="text-sm text-gray-600">
                    {address.city}, {address.state} {address.zipCode}
                  </p>
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-xs text-gray-500">
                      📍 {address.coordinates.lat.toFixed(6)}, {address.coordinates.lng.toFixed(6)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => handleMarkerClick(address)}
                  >
                    Edit This Address
                  </Button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

export function AddAddressPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [addresses, setAddresses] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [newAddress, setNewAddress] = useState({
    type: "home",
    name: "",
    phone: "",
    house: "",
    street: "",
    landmark: "",
    city: "",
    state: "",
    zipCode: "",
    country: "India",
    coordinates: null,
    isDefault: false
  });
  const [loading, setLoading] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [error, setError] = useState(null);

  const loadAddresses = async () => {
    if (!currentUser) return;
    try {
      const userAddresses = await addressService.getAddresses(currentUser.uid);
      setAddresses(userAddresses);
    } catch (err) {
      console.error('Error loading addresses:', err);
      setError('Failed to load addresses');
    } finally {
      setLoadingAddresses(false);
    }
  };

  useEffect(() => {
    loadAddresses();
    // Get current location for map centering
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCurrentLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
        },
        (err) => {
          console.log('Geolocation error:', err);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    }
  }, [currentUser]);

  useEffect(() => {
    if (location.state?.address) {
      setNewAddress(location.state.address);
      setIsEditing(true);
    }
  }, [location.state]);

  const handleSubmitAddress = async () => {
    if (!currentUser) return;

    // Validate that coordinates are selected
    if (!newAddress.coordinates || !newAddress.coordinates.lat || !newAddress.coordinates.lng) {
      setError('Please select a location on the map before saving the address.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      if (isEditing) {
        await addressService.updateAddress(currentUser.uid, newAddress._id, newAddress);
      } else {
        await addressService.addAddress(currentUser.uid, {
          ...newAddress,
          isDefault: false // You can modify this logic as needed
        });
      }
      await loadAddresses(); // Reload addresses
      setNewAddress({
        type: "home",
        name: "",
        phone: "",
        house: "",
        street: "",
        landmark: "",
        city: "",
        state: "",
        zipCode: "",
        country: "India",
        coordinates: null,
        isDefault: false
      });
      setIsEditing(false); // Reset to add mode
      // Stay on the page, reset form
    } catch (err) {
      console.error(`Error ${isEditing ? 'updating' : 'adding'} address:`, err);
      setError(err.message || `Failed to ${isEditing ? 'update' : 'add'} address. Please check your coordinates and try again.`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAddress = async (addressId) => {
    if (!window.confirm("Are you sure you want to delete this address?")) return;

    try {
      await addressService.deleteAddress(currentUser.uid, addressId);
      await loadAddresses(); // Reload addresses
    } catch (err) {
      console.error('Error deleting address:', err);
      setError('Failed to delete address');
    }
  };

  const handleEditAddress = (address) => {
    setNewAddress(address);
    setIsEditing(true);
    // Scroll to form or something, but for now just set the state
  };

  const handleAddressSelectFromMap = (address) => {
    handleEditAddress(address);
    // Optionally hide map after selection
    // setShowMap(false);
  };

  const isFormValid = newAddress.name && newAddress.phone && newAddress.street && newAddress.city && newAddress.state && newAddress.zipCode;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" onClick={() => navigate(-1)} className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <h1 className="text-3xl font-bold text-gray-800">Manage Addresses</h1>
          </div>

          {/* Addresses List */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Your Addresses</h2>
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowMap(!showMap)}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Map className="h-4 w-4" />
                  {showMap ? 'Hide Map' : 'Show Map'}
                </Button>
                <Button onClick={() => {
                  setNewAddress({
                    type: "home",
                    name: "",
                    phone: "",
                    house: "",
                    street: "",
                    landmark: "",
                    city: "",
                    state: "",
                    zipCode: "",
                    country: "India",
                    coordinates: null,
                    isDefault: false
                  });
                  setIsEditing(false);
                }} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add New Address
                </Button>
              </div>
            </div>

            {loadingAddresses ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Loading addresses...</p>
              </div>
            ) : addresses.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No addresses found</p>
                <Button onClick={() => {
                  setNewAddress({
                    type: "home",
                    name: "",
                    phone: "",
                    house: "",
                    street: "",
                    landmark: "",
                    city: "",
                    state: "",
                    zipCode: "",
                    country: "India",
                    coordinates: null,
                    isDefault: false
                  });
                  setIsEditing(false);
                }} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Your First Address
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {addresses.map((address, index) => (
                  <div key={address._id || index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                        {address.type}
                      </span>
                      {address.isDefault && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Default
                        </span>
                      )}
                    </div>

                    <div className="text-sm text-gray-600 mb-3">
                      <p><strong>{address.name}</strong></p>
                      <p>{address.phone}</p>
                      <p>{address.house ? `${address.house}, ` : ''}{address.street}</p>
                      {address.landmark && <p>Near: {address.landmark}</p>}
                      <p>{address.city}, {address.state} {address.zipCode}</p>
                      <p>{address.country}</p>
                      {address.coordinates && (
                        <p className="text-xs text-gray-500 mt-1">
                          📍 {address.coordinates.lat?.toFixed(6)}, {address.coordinates.lng?.toFixed(6)}
                        </p>
                      )}
                    </div>

                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditAddress(address)}
                        className="flex items-center gap-1"
                      >
                        <Edit className="h-3 w-3" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteAddress(address._id)}
                        className="flex items-center gap-1 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Map View */}
          {showMap && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="h-5 w-5" />
                <h2 className="text-xl font-semibold">Address Locations</h2>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Click on any marker to edit that address. Markers show: 🏠 Home, 🏢 Work, 📍 Other
              </p>
              <AddressMapViewer
                addresses={addresses}
                onAddressSelect={handleAddressSelectFromMap}
                currentLocation={currentLocation}
              />
            </div>
          )}

          {/* Form */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">{isEditing ? 'Edit Address' : 'Add New Address'}</h2>
            <div className="space-y-4">
              <div>
                <Label>Address Type</Label>
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
                <Label htmlFor="house">House/Building (Optional)</Label>
                <Input
                  id="house"
                  value={newAddress.house}
                  onChange={(e) => setNewAddress({...newAddress, house: e.target.value})}
                  placeholder="House/Building name or number"
                />
              </div>
              <div>
                <Label htmlFor="street">Street Address</Label>
                <Input
                  id="street"
                  value={newAddress.street}
                  onChange={(e) => setNewAddress({...newAddress, street: e.target.value})}
                  placeholder="Street address"
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
                <Label htmlFor="zipCode">ZIP Code</Label>
                <Input
                  id="zipCode"
                  value={newAddress.zipCode}
                  onChange={(e) => setNewAddress({...newAddress, zipCode: e.target.value})}
                  placeholder="110001"
                />
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={newAddress.country}
                  onChange={(e) => setNewAddress({...newAddress, country: e.target.value})}
                  placeholder="India"
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

              {error && (
                <div className="text-red-600 text-sm">{error}</div>
              )}

              <Button
                onClick={handleSubmitAddress}
                className="w-full"
                disabled={!isFormValid || loading}
              >
                {loading ? (isEditing ? 'Updating Address...' : 'Adding Address...') : (isEditing ? 'Update Address' : 'Add Address')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddAddressPage;