import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import EmailVerification from "../components/EmailVerification";
import { toast } from "react-toastify";
import apiService from "../services/apiService.js";

// Minimal Store/Seller dashboard inspired by provided design
export default function SellerDashboard() {
  const { currentUser, getUserProfile, logout, deleteAccount, listBranchLinkRequests, listNotifications } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sellerPurchases, setSellerPurchases] = useState([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  
  // Store hours management state
  const [storeHours, setStoreHours] = useState([]);
  const [hoursForm, setHoursForm] = useState({
    day: "",
    openTime: "09:00",
    closeTime: "18:00",
    isClosed: false,
    note: ""
  });
  const [hoursMsg, setHoursMsg] = useState("");

  // Order processing state
  const [pendingOrders, setPendingOrders] = useState([]);
  const [acceptedOrders, setAcceptedOrders] = useState([]);
  const [orderCountdowns, setOrderCountdowns] = useState({});
  const [processingOrder, setProcessingOrder] = useState(null);
  const [autoRejectingOrders, setAutoRejectingOrders] = useState(new Set());
  
  // Product management state
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [stockEdit, setStockEdit] = useState({ id: null, value: '' });
  
  // Generate next 7 days starting from today
  const next7Days = useMemo(() => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      days.push({
        date: date.toISOString().split('T')[0],
        dayName: date.toLocaleDateString('en-US', { weekday: 'long' }),
        dayShort: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: date.getDate(),
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        isToday: i === 0
      });
    }
    return days;
  }, []);

  // Store hours form handlers
  const onHoursChange = (e) => {
    const { name, value, type, checked } = e.target;
    setHoursForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const addStoreHours = async (e) => {
    e.preventDefault();
    setHoursMsg("");
    
    if (!hoursForm.day) {
      const msg = 'Please select a day';
      setHoursMsg(msg);
      toast.error(msg);
      return;
    }
    
    if (!hoursForm.isClosed && (!hoursForm.openTime || !hoursForm.closeTime)) {
      const msg = 'Please set opening and closing times';
      setHoursMsg(msg);
      toast.error(msg);
      return;
    }
    
    if (!hoursForm.isClosed && hoursForm.openTime >= hoursForm.closeTime) {
      const msg = 'Closing time must be after opening time';
      setHoursMsg(msg);
      toast.error(msg);
      return;
    }

    try {
      const body = {
        day: hoursForm.day.trim(),
        openTime: hoursForm.isClosed ? null : hoursForm.openTime,
        closeTime: hoursForm.isClosed ? null : hoursForm.closeTime,
        isClosed: hoursForm.isClosed,
        note: hoursForm.note.trim()
      };

      const res = await fetch(`http://localhost:5000/api/users/${currentUser.uid}/store-hours`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to save store hours');

      setStoreHours(data.storeHours || []);
      const successMsg = 'Store hours saved successfully';
      setHoursMsg(successMsg);
      toast.success(successMsg);
      setHoursForm({
        day: "",
        openTime: "09:00",
        closeTime: "18:00",
        isClosed: false,
        note: ""
      });
    } catch (error) {
      const errorMsg = error.message || 'Failed to save store hours';
      setHoursMsg(errorMsg);
      toast.error(errorMsg);
    }
  };

  const removeStoreHours = async (day) => {
    if (!window.confirm(`Are you sure you want to remove store hours for ${day}?`)) {
      return;
    }
    
    try {
      const res = await fetch(`http://localhost:5000/api/users/${currentUser.uid}/store-hours/${encodeURIComponent(day)}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to remove store hours');

      setStoreHours(data.storeHours || []);
      const successMsg = 'Store hours removed successfully';
      setHoursMsg(successMsg);
      toast.success(successMsg);
    } catch (error) {
      const errorMsg = error.message || 'Failed to remove store hours';
      setHoursMsg(errorMsg);
      toast.error(errorMsg);
    }
  };

  const getHoursForDay = (day) => {
    if (!day || !Array.isArray(storeHours)) return null;
    return storeHours.find(h => h.day && h.day.trim().toLowerCase() === day.trim().toLowerCase());
  };

  // Fetch seller purchases from farmers
  const fetchSellerPurchases = async () => {
    setPurchasesLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/seller-farmer-transactions/my-purchases', {
        headers: { 'x-uid': currentUser.uid }
      });
      const data = await response.json();
      if (data.success) {
        setSellerPurchases(data.transactions || []);
      } else {
        toast.error('Failed to fetch purchase history');
      }
    } catch (error) {
      console.error('Error fetching seller purchases:', error);
      toast.error('Failed to fetch purchase history');
    } finally {
      setPurchasesLoading(false);
    }
  };

  // Farmer products state
  const [farmerProducts, setFarmerProducts] = useState([]);
  const [farmerProductsLoading, setFarmerProductsLoading] = useState(false);
  const [acceptedProducts, setAcceptedProducts] = useState([]);
  const [acceptedProductsLoading, setAcceptedProductsLoading] = useState(false);

  // Fetch farmer products
  const fetchFarmerProducts = async () => {
    setFarmerProductsLoading(true);
    try {
      console.log('🔍 Fetching farmer products with status=approved...');
      const response = await fetch('http://localhost:5000/api/farmer-products?status=approved', {
        headers: { 'x-uid': currentUser.uid }
      });
      const data = await response.json();
      console.log('📥 Farmer products response:', data);
      if (data.success) {
        setFarmerProducts(data.products || []);
        console.log('📦 Set farmer products:', data.products?.length || 0);
      } else {
        toast.error('Failed to fetch farmer products');
      }
    } catch (error) {
      console.error('Error fetching farmer products:', error);
      toast.error('Failed to fetch farmer products');
    } finally {
      setFarmerProductsLoading(false);
    }
  };

  // Fetch accepted farmer products
  const fetchAcceptedProducts = async () => {
    setAcceptedProductsLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/farmer-products/accepted-by-seller/${currentUser.uid}`, {
        headers: { 'x-uid': currentUser.uid }
      });
      const data = await response.json();
      if (data.success) {
        setAcceptedProducts(data.products || []);
      } else {
        toast.error('Failed to fetch accepted products');
      }
    } catch (error) {
      console.error('Error fetching accepted products:', error);
      toast.error('Failed to fetch accepted products');
    } finally {
      setAcceptedProductsLoading(false);
    }
  };

  // Accept farmer product
  const handleAcceptFarmerProduct = async (productId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/farmer-products/${productId}/accept`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-uid': currentUser.uid
        }
      });
      
      const data = await response.json();
      if (data.success) {
        toast.success('Product accepted successfully!');
        // Refresh both lists
        fetchFarmerProducts();
        fetchAcceptedProducts();
      } else {
        toast.error(data.message || 'Failed to accept product');
      }
    } catch (error) {
      console.error('Error accepting farmer product:', error);
      toast.error('Failed to accept product');
    }
  };

  // Order processing functions
  const fetchPendingOrders = async () => {
    try {
      const response = await apiService.get(`/orders/seller/pending/${currentUser.uid}`);
      if (response.success) {
        setPendingOrders(response.orders);

        // Initialize countdowns for new orders
        const newCountdowns = {};
        response.orders.forEach(order => {
          const timeLeft = getTimeLeft(order.createdAt);
          newCountdowns[order._id] = timeLeft;
        });
        setOrderCountdowns(newCountdowns);
      }
    } catch (error) {
      console.error('Error fetching pending orders:', error);
      toast.error('Failed to fetch pending orders');
    }
  };

  const fetchAcceptedOrders = async () => {
    try {
      const response = await apiService.get(`/orders/seller/accepted/${currentUser.uid}`);
      if (response.success) {
        setAcceptedOrders(response.orders);
      }
    } catch (error) {
      console.error('Error fetching accepted orders:', error);
      toast.error('Failed to fetch accepted orders');
    }
  };

  const getTimeLeft = (createdAt) => {
    const now = new Date();
    const orderTime = new Date(createdAt);
    const deadline = new Date(orderTime.getTime() + 3 * 60 * 1000); // 3 minutes
    const diff = deadline - now;

    if (diff <= 0) return { minutes: 0, seconds: 0, expired: true };

    const minutes = Math.floor(diff / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return { minutes, seconds, expired: false };
  };

  const updateCountdowns = () => {
    setOrderCountdowns(prev => {
      const updated = {};
      Object.keys(prev).forEach(orderId => {
        const order = pendingOrders.find(o => o._id === orderId);
        if (order) {
          const timeLeft = getTimeLeft(order.createdAt);
          updated[orderId] = timeLeft;

          // Auto-reject if expired and not already processing/rejecting
          if (timeLeft.expired && !processingOrder && !autoRejectingOrders.has(orderId)) {
            setAutoRejectingOrders(prev => new Set([...prev, orderId]));
            handleRejectOrder(orderId);
          }
        }
      });
      return updated;
    });
  };

  const handleAcceptOrder = async (orderId) => {
    if (processingOrder) return;

    setProcessingOrder(orderId);
    try {
      const response = await apiService.put(`/orders/seller/accept/${orderId}`, {
        sellerId: currentUser.uid
      });

      if (response.success) {
        toast.success('Order accepted successfully!');
        // Refresh both lists
        fetchPendingOrders();
        fetchAcceptedOrders();
        setOrderCountdowns(prev => {
          const updated = { ...prev };
          delete updated[orderId];
          return updated;
        });
      } else {
        toast.error(response.message || 'Failed to accept order');
      }
    } catch (error) {
      console.error('Error accepting order:', error);
      toast.error(error.message || 'Failed to accept order');
    } finally {
      setProcessingOrder(null);
    }
  };
  const handleRejectOrder = async (orderId) => {
    if (processingOrder) return;

    setProcessingOrder(orderId);
    try {
      const response = await apiService.put(`/orders/seller/reject/${orderId}`, {
        sellerId: currentUser.uid
      });

      if (response.success) {
        toast.success('Order rejected successfully!');
        // Remove from pending orders
        setPendingOrders(prev => prev.filter(order => order._id !== orderId));
        setOrderCountdowns(prev => {
          const updated = { ...prev };
          delete updated[orderId];
          return updated;
        });
        setAutoRejectingOrders(prev => {
          const newSet = new Set(prev);
          newSet.delete(orderId);
          return newSet;
        });
      } else {
        toast.error(response.message || 'Failed to reject order');
        setAutoRejectingOrders(prev => {
          const newSet = new Set(prev);
          newSet.delete(orderId);
          return newSet;
        });
      }
    } catch (error) {
      console.error('Error rejecting order:', error);
      toast.error(error.message || 'Failed to reject order');
      setAutoRejectingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    } finally {
      setProcessingOrder(null);
    }
  };

  const handleReadyForDelivery = async (orderId) => {
    if (processingOrder) return;

    setProcessingOrder(orderId);
    try {
      const response = await apiService.put(`/orders/seller/ready-delivery/${orderId}`, {
        sellerId: currentUser.uid
      });

      if (response.success) {
        toast.success('Order marked as ready for delivery!');
        // Refresh accepted orders
        fetchAcceptedOrders();
      } else {
        toast.error(response.message || 'Failed to mark order ready for delivery');
      }
    } catch (error) {
      console.error('Error marking order ready for delivery:', error);
      toast.error(error.message || 'Failed to mark order ready for delivery');
    } finally {
      setProcessingOrder(null);
    }
  };

  const handleProcessOrder = async (orderId) => {
    if (processingOrder) return;

    setProcessingOrder(orderId);
    try {
      const response = await apiService.put(`/orders/seller/process/${orderId}`, {
        sellerId: currentUser.uid
      });

      if (response.success) {
        toast.success('Order processing started!');
        // Refresh accepted orders
        fetchAcceptedOrders();
      } else {
        toast.error(response.message || 'Failed to start processing order');
      }
    } catch (error) {
      console.error('Error processing order:', error);
      toast.error(error.message || 'Failed to start processing order');
    } finally {
      setProcessingOrder(null);
    }
  };

  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
      return;
    }
    const profile = getUserProfile();
    if (!profile || !["store", "seller"].includes(profile.role)) {
      navigate("/");
      return;
    }

    // Check for tab parameter in URL
    const urlParams = new URLSearchParams(location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ['overview', 'catalog', 'orders', 'reports', 'hours', 'farmer-products', 'my-purchases'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
    
    // Check email verification for sellers
    if (profile.role === "seller" && profile.provider === "email" && !currentUser.emailVerified) {
      // Allow access but show verification warning - handled by EmailVerification component
      console.log("Seller needs email verification");
    }

    // Load pending branch link requests count and products
    (async () => {
      try {
        const reqs = await listBranchLinkRequests();
        setPendingCount(Array.isArray(reqs) ? reqs.length : 0);
      } catch {
        setPendingCount(0);
      }
      // Load unread notifications count
      try {
        const notes = await listNotifications();
        const unread = (notes || []).filter(n => !n.read).length;
        setUnreadCount(unread);
      } catch {}
      // Load seller products
      try {
        setProductsLoading(true);
        const res = await fetch('http://localhost:5000/api/products', {
          headers: { 'x-uid': currentUser.uid }
        });
        const data = await res.json();
        console.log('Seller products API response:', data);
        if (res.ok && Array.isArray(data.products)) {
          setProducts(data.products);
          console.log('Seller products loaded:', data.products.length);
        } else {
          console.error('Failed to load seller products:', data);
        }
      } catch (error) {
        console.error('Error loading seller products:', error);
      } finally {
        setProductsLoading(false);
      }
      // Load store hours
      loadStoreHours();
      // Load pending orders
      fetchPendingOrders();
      // Load accepted orders
      fetchAcceptedOrders();
    })();
  }, [currentUser, navigate, location.search]);

  // Handle buying farmer product
  const handleBuyFarmerProduct = async (product) => {
    const quantity = prompt(`Enter quantity to buy (Available: ${product.quantity}):`, '1');
    if (!quantity || isNaN(quantity) || parseInt(quantity) <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    const quantityNum = parseInt(quantity);
    if (quantityNum > product.quantity) {
      toast.error('Quantity exceeds available stock');
      return;
    }

    try {
      // First, accept the product if not already accepted
      const isAccepted = product.acceptedBySellers?.some(seller => seller.sellerId === currentUser.uid);
      if (!isAccepted) {
        console.log('🛒 Accepting product before purchase...');
        const acceptResponse = await fetch(`http://localhost:5000/api/farmer-products/${product._id}/accept`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-uid': currentUser.uid
          }
        });
        
        const acceptData = await acceptResponse.json();
        if (!acceptResponse.ok) {
          toast.error(acceptData.message || 'Failed to accept product');
          return;
        }
        console.log('✅ Product accepted successfully');
      }

      // Then create the purchase transaction
      console.log('🛒 Creating purchase transaction...');
      const response = await fetch('http://localhost:5000/api/seller-farmer-transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-uid': currentUser.uid
        },
        body: JSON.stringify({
          productId: product._id,
          quantityPurchased: quantityNum,
          deliveryAddress: getUserProfile()?.storeAddress || '',
          notes: `Purchase from farmer: ${product.farmerName}`
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Product accepted and purchase order created successfully!');
        fetchFarmerProducts(); // Refresh farmer products
        fetchSellerPurchases(); // Refresh purchase history
        fetchAcceptedProducts(); // Refresh accepted products
      } else {
        toast.error(data.message || 'Failed to create purchase order');
      }
    } catch (error) {
      console.error('Error buying farmer product:', error);
      toast.error('Failed to create purchase order');
    }
  };

  // Handle farmer product actions
  const handleViewProduct = (product) => {
    // Show product details in a modal or navigate to details page
    alert(`Product Details:
Name: ${product.productName}
Category: ${product.category}
Price: ₹${product.price}
Quantity: ${product.quantity}
Farmer: ${product.farmerName}
Status: ${product.status}`);
  };

  const handleEditProduct = async (product) => {
    if (product.status === 'approved') {
      toast.error('Cannot edit approved products');
      return;
    }
    
    const newName = prompt('Enter new product name:', product.productName);
    if (newName && newName !== product.productName) {
      try {
        const response = await fetch(`http://localhost:5000/api/farmer-products/${product._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-uid': currentUser.uid
          },
          body: JSON.stringify({ productName: newName })
        });
        
        if (response.ok) {
          toast.success('Product updated successfully');
          fetchFarmerProducts();
        } else {
          toast.error('Failed to update product');
        }
      } catch (error) {
        toast.error('Error updating product');
      }
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) {
      return;
    }
    
    try {
      const response = await fetch(`http://localhost:5000/api/farmer-products/${productId}`, {
        method: 'DELETE',
        headers: { 'x-uid': currentUser.uid }
      });
      
      if (response.ok) {
        toast.success('Product deleted successfully');
        fetchFarmerProducts();
      } else {
        toast.error('Failed to delete product');
      }
    } catch (error) {
      toast.error('Error deleting product');
    }
  };

  // Fetch farmer products when tab is active
  useEffect(() => {
    if (activeTab === 'farmer-products' && currentUser) {
      fetchFarmerProducts();
    }
    
    if (activeTab === 'my-purchases' && currentUser) {
      fetchSellerPurchases();
    }
  }, [activeTab, currentUser]);

  // Auto-navigate to Store Settings page when settings tab is selected
  useEffect(() => {
    if (activeTab === 'settings') {
      navigate('/seller/settings');
    }
  }, [activeTab, navigate]);

  // Load store hours from database
  async function loadStoreHours() {
    if (!currentUser) return;
    try {
      const res = await fetch(`http://localhost:5000/api/users/${currentUser.uid}/store-hours`);
      const data = await res.json();
      if (res.ok && data.success) {
        setStoreHours(data.storeHours || []);
      }
    } catch (error) {
      console.error("Error loading store hours:", error);
    }
  }

  const profile = useMemo(() => getUserProfile() || {}, [getUserProfile]);

  // Calculate stats from products
  const stats = useMemo(() => {
    console.log('📊 Calculating stats from products:', products.length);
    console.log('📊 Products data:', products);
    
    const lowStockProducts = products.filter(p => p.stock <= (p.lowStockThreshold || 10));
    const outOfStockProducts = products.filter(p => p.stock === 0);
    
    console.log('📊 Low stock products:', lowStockProducts.length);
    console.log('📊 Out of stock products:', outOfStockProducts.length);
    
    return {
      totalProducts: products.length,
      lowStockCount: lowStockProducts.length,
      outOfStockCount: outOfStockProducts.length,
      ordersToday: 0,
      dailyRevenue: 0,
      activeStaff: 0,
    };
  }, [products]);

  function getStockStatus(stock, threshold = 10) {
    if (stock === 0) return { status: 'out', color: 'red', text: 'Out of Stock' };
    if (stock <= threshold) return { status: 'low', color: 'yellow', text: 'Low Stock' };
    return { status: 'good', color: 'green', text: 'In Stock' };
  }

  const activeOrders = [
  
  ];

  const lowStock = [
    
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed left-0 top-16 md:top-20 bottom-0 w-64 bg-white border-r border-gray-200 flex flex-col z-20">
        <div className="px-4 py-5 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">FC</div>
            <div>
              <div className="text-lg font-semibold text-green-700">Fresh Cart</div>
              <div className="text-xs text-gray-500">Welcome back, <span className="font-medium">{profile.storeName || profile.displayName || 'Store'}</span></div>
            </div>
            <span className="ml-auto text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Store</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
          {[
            { key: "overview", label: "Store Overview", icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
            )},
            { key: "catalog", label: "Product Catalog", icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7h18M3 12h18M3 17h18"/></svg>
            )},
            
            { key: "orders", label: "Order Processing", icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h18M9 7h12M9 11h12M9 15h12M9 19h12M3 7h.01M3 11h.01M3 15h.01M3 19h.01"/></svg>
            )},
          
            { key: "farmer-products", label: "Farmer Products", icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
            )},
           
            { key: "hours", label: "Store Hours", icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            )},
            { key: "settings", label: "Store Settings", icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37-.46.756-.12 1.742.734 2.164 1.64.82 1.64 3.124 0 3.943a1.724 1.724 0 00-.734 2.165c.94 1.543-.827 3.31 2.37 2.37a1.724 1.724 0 00-2.573 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37.46-.756.12-1.742-.734-2.164-.94-1.543.827-3.31 2.37-2.37.94.573 2.147.02 2.573-1.065z"/></svg>
            )},
            // Removed "Store Settings" from this sidebar per requirement
            
          ].map(item => (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${activeTab === item.key ? 'bg-green-100 text-green-700' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              <span className="text-gray-500">{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto border-t p-3 space-y-2">
          
          <button onClick={() => navigate('/seller/profile')} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A13.937 13.937 0 0112 15c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            <span>Seller Profile</span>
          </button>
          
          <button onClick={async () => { await logout(); navigate('/login'); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 11-6 0v-1"/></svg>
            <span>Logout</span>
          </button>
          {/* Danger zone for seller/store (not admin) */}
          <button
            onClick={async () => {
              const profile = getUserProfile();
              if (profile?.role === 'admin') return;

              if (!window.confirm('Delete your account permanently? This cannot be undone.')) return;
              try {
                await deleteAccount();
                navigate('/');
              } catch (e) {
                alert(e.message || 'Failed to delete account');
              }
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white bg-red-600 hover:bg-red-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
            <span>Delete Account</span>
          </button>
        </div>
      </aside>

      {/* Header */}
      <div className="ml-64">
        {/* Email Verification Banner for Sellers */}
        {profile.role === "seller" && profile.provider === "email" && !currentUser.emailVerified && (
          <div className="bg-red-50 border-b border-red-200">
            <div className="max-w-7xl mx-auto px-6 py-3">
              <EmailVerification />
            </div>
          </div>
        )}
        
        <div className="border-b bg-white">
          <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {activeTab === 'settings' ? 'Store Settings' : 
                 activeTab === 'catalog' ? 'Product Catalog - All Products' : 
                 activeTab === 'farmer-products' ? 'Farmer Products' :
                 activeTab === 'my-purchases' ? 'My Purchases' :
                 activeTab === 'hours' ? 'Store Hours Management' :
                 'Store Overview'}
              </h1>
              <p className="text-sm text-gray-600">{profile.storeName || 'Your Store'} • Category: {profile.sellerCategory || 'not set'}</p>
            </div>
            <div className="flex items-center gap-3">
              
              {pendingCount > 0 && (
                <button onClick={() => navigate('/BranchLinkRequest')} className="relative px-4 py-2 rounded-lg text-sm bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
                  Requests
                  <span className="absolute -top-2 -right-2 text-[10px] bg-red-600 text-white rounded-full px-1.5 py-0.5">{pendingCount}</span>
                </button>
              )}
              <button 
                onClick={() => {
                  if (profile.role === "seller" && profile.provider === "email" && !currentUser.emailVerified) {
                    alert("Please verify your email before adding products.");
                    return;
                  }
                  navigate('/seller/products');
                }}
                className={`px-4 py-2 rounded-lg text-sm ${
                  profile.role === "seller" && profile.provider === "email" && !currentUser.emailVerified
                    ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
                disabled={profile.role === "seller" && profile.provider === "email" && !currentUser.emailVerified}
              >
                Add Product
              </button>
            </div>
          </div>
        </div>

        {/* Notification bar */}
        {pendingCount > 0 && (
          <div className="max-w-7xl mx-auto px-6 mt-4">
            <div className="flex items-center justify-between rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
              <div className="text-sm text-yellow-900">You have {pendingCount} pending branch link {pendingCount === 1 ? 'request' : 'requests'}.</div>
              <div className="flex items-center gap-2">
                <button onClick={() => navigate('/BranchLinkRequest')} className="px-3 py-1.5 rounded-lg bg-yellow-100 text-yellow-800 text-xs hover:bg-yellow-200">Review</button>
                <button onClick={async () => { try { const reqs = await listBranchLinkRequests(); setPendingCount(Array.isArray(reqs) ? reqs.length : 0); } catch {} }} className="px-3 py-1.5 rounded-lg bg-white border text-xs hover:bg-gray-50">Refresh</button>
              </div>
            </div>
          </div>
        )}

        {/* Top metrics */}
        <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">Total Products</div>
            <div className="text-2xl font-semibold text-gray-900 mt-1">{stats.totalProducts}</div>
            <div className="text-xs text-green-600 mt-2">Active inventory</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">Low Stock Items</div>
            <div className="text-2xl font-semibold text-yellow-600 mt-1">{stats.lowStockCount}</div>
            <div className="text-xs text-yellow-600 mt-2">Need restocking</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">Out of Stock</div>
            <div className="text-2xl font-semibold text-red-600 mt-1">{stats.outOfStockCount}</div>
            <div className="text-xs text-red-600 mt-2">Urgent attention</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">Orders Today</div>
            <div className="text-2xl font-semibold text-gray-900 mt-1">{stats.ordersToday}</div>
            <div className="text-xs text-green-600 mt-2">+0</div>
          </div>
        </div>

        {/* Main Content Area */}
        {activeTab === 'overview' ? (
          /* Overview Content */
          <div className="max-w-7xl mx-auto px-6 pb-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Store Information + Performance */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold">Store Information</h3>
              <div className="mt-4 text-sm text-gray-700 space-y-1">
                <div className="font-medium">{profile.storeName || 'Fresh Cart - Downtown'}</div>
                <div className="flex items-center gap-2 text-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 12l4.243-4.243m-4.243 4.243L6.343 6.343M13.414 12l-7.071 7.071"/></svg>
                  <span>{profile.storeAddress || '123 Main Street, Downtown, City'}</span>
                </div>
                <div className="text-xs text-gray-500">Seller ID: {profile.sellerUniqueNumber || '—'}</div>
               
                
              </div>
            </div>

            {/* Low stock alerts */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold">Low Stock Alerts</h3>
              <div className="mt-4 space-y-3">
                {products.filter(p => p.stock <= (p.lowStockThreshold || 10)).length === 0 ? (
                  <div className="text-sm text-gray-500">No low stock items</div>
                ) : (
                  products.filter(p => p.stock <= (p.lowStockThreshold || 10)).map((product) => (
                    <div key={product._id} className="flex items-center justify-between border rounded-xl p-4 bg-red-50">
                      <div>
                        <div className="text-sm font-medium text-red-700">{product.name}</div>
                        <div className="text-xs text-red-600">Stock: {product.stock} (Alert: {product.lowStockThreshold || 10})</div>
                      </div>
                      <button 
                        onClick={() => navigate('/seller/products')}
                        className="px-3 py-1.5 rounded-lg bg-white border border-red-200 text-red-700 text-xs hover:bg-red-100"
                      >
                        Restock
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

              
          </div>
        ) : activeTab === 'settings' ? (
          /* Store Settings - Navigate to dedicated page */
          <div className="max-w-7xl mx-auto px-6 pb-12">
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <div className="py-12">
                <div className="text-gray-500 mb-4">Redirecting to Store Settings...</div>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
              </div>
            </div>
          </div>
        ) : activeTab === 'catalog' ? (
          /* Product Catalog View */
          <div className="max-w-7xl mx-auto px-6 pb-12">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Product Catalog</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={async () => {
                      try {
                        setProductsLoading(true);
                        const res = await fetch('http://localhost:5000/api/products', {
                          headers: { 'x-uid': currentUser.uid }
                        });
                        const data = await res.json();
                        if (res.ok && Array.isArray(data.products)) {
                          setProducts(data.products);
                          console.log('Seller products refreshed:', data.products.length);
                        }
                      } catch (error) {
                        console.error('Error refreshing products:', error);
                      } finally {
                        setProductsLoading(false);
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Refresh All Products
                  </button>
                  <button 
                    onClick={() => navigate('/seller/products')} 
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Add New Product
                  </button>
                </div>
              </div>
              
              {productsLoading ? (
                <div className="text-center py-12">
                  <div className="text-gray-500 mb-4">Loading all products...</div>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-500 mb-4">No products found in the catalog</div>
                  <button 
                    onClick={() => {
                      if (profile.role === "seller" && profile.provider === "email" && !currentUser.emailVerified) {
                        alert("Please verify your email before adding products.");
                        return;
                      }
                      navigate('/seller/products');
                    }}
                    className={`px-6 py-3 rounded-lg ${
                      profile.role === "seller" && profile.provider === "email" && !currentUser.emailVerified
                        ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                    disabled={profile.role === "seller" && profile.provider === "email" && !currentUser.emailVerified}
                  >
                    Add First Product to Catalog
                  </button>
                </div>
              ) : (
                <div>
                  <div className="mb-4 text-sm text-gray-600">
                    Showing {products.length} product{products.length !== 1 ? 's' : ''} in the catalog
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {products.map((product) => {
                    const stockStatus = getStockStatus(product.stock, product.lowStockThreshold || 10);
                    return (
                      <div 
                        key={product._id} 
                        className={`border rounded-lg p-4 ${
                          stockStatus.status === 'out' ? 'border-red-300 bg-red-50' : 
                          stockStatus.status === 'low' ? 'border-yellow-300 bg-yellow-50' : 
                          'border-gray-200'
                        }`}
                      >
                        {Array.isArray(product.images) && product.images.length > 0 && (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="w-full h-32 object-cover rounded mb-3"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        )}
                        
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            {product.name}
                            {product.approvalStatus === 'rejected' && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-600 text-white" title={product.rejectionReason || 'Rejected by Admin'}>
                                Rejected by Admin
                              </span>
                            )}
                            {product.approvalStatus === 'pending' && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500 text-white" title="Awaiting admin approval">
                                Pending Approval
                              </span>
                            )}
                          </h3>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            stockStatus.color === 'red' ? 'bg-red-100 text-red-700' :
                            stockStatus.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {stockStatus.text}
                          </span>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-2">{product.description || 'No description'}</p>
                        
                        <div className="flex items-center justify-between text-sm">
                          <div>
                            <div className="font-semibold text-green-600">₹{product.price}</div>
                            {product.mrpPrice && product.mrpPrice > product.price && (
                              <div className="text-xs text-gray-500 line-through">₹{product.mrpPrice}</div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-gray-600">Stock: {product.stock}</div>
                            <div className="text-xs text-gray-500">Alert: {product.lowStockThreshold || 10}</div>
                          </div>
                        </div>
                        
                        <div className="mt-3 flex flex-col gap-2">
                          <div className="flex gap-2">
                            <button 
                              onClick={() => {
                                if (profile.role === "seller" && profile.provider === "email" && !currentUser.emailVerified) {
                                  alert("Please verify your email before editing products.");
                                  return;
                                }
                                navigate('/seller/products');
                              }}
                              className={`flex-1 px-3 py-1.5 text-xs rounded ${
                                profile.role === "seller" && profile.provider === "email" && !currentUser.emailVerified
                                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                              disabled={profile.role === "seller" && profile.provider === "email" && !currentUser.emailVerified}
                            >
                              Edit
                            </button>
                           
                            {/* Inline stock editor toggle */}
                            {(() => {
                              const isApproved = ( product.approvalStatus) === 'approved';
                              return (
                                <button
                                  onClick={() => {
                                    if (!isApproved) {
                                      const state = (product.approvalStatus);
                                      alert(state === 'rejected'
                                        ? 'This product was rejected by admin and cannot be updated.' 
                                        : 'Pending products cannot be updated until approved.');
                                      return;
                                    }
                                    setStockEdit(prev => ({ id: prev.id === product._id ? null : product._id, value: product.stock }));
                                  }}
                                  className={`flex-1 px-3 py-1.5 text-xs rounded ${
                                    !isApproved ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                  }`}
                                  disabled={!isApproved}
                                >
                                  {stockEdit?.id === product._id ? 'Close' : 'Update Stock'}
                                </button>
                              );
                            })()}
                          </div>

                          {/* Inline stock edit row */}
                          {stockEdit?.id === product._id && (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                value={stockEdit.value}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (v === '') { setStockEdit(s => ({ ...s, value: '' })); return; }
                                  const n = Number(v);
                                  if (Number.isFinite(n) && n >= 0) setStockEdit(s => ({ ...s, value: Math.floor(n) }));
                                }}
                                className="w-28 px-2 py-1 text-xs border rounded"
                              />
                              <button
                                onClick={async () => {
                                  // Guard: only allow saving if product is approved (status or legacy approvalStatus)
                                  const state = ( product.approvalStatus);
                                  if (state !== 'approved') {
                                    alert(state === 'rejected'
                                      ? 'This product was rejected by admin and cannot be updated.'
                                      : 'Pending products cannot be updated until approved.');
                                    return;
                                  }

                                  const n = Number(stockEdit.value);
                                  if (!Number.isFinite(n) || n < 0) { alert('Enter a valid non-negative number'); return; }
                                  try {
                                    const res = await fetch(`http://localhost:5000/api/products/${product._id}`, {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json', 'x-uid': currentUser.uid },
                                      body: JSON.stringify({ stock: Math.floor(n) })
                                    });
                                    const data = await res.json();
                                    if (!res.ok) throw new Error(data?.message || 'Update failed');
                                    // Refresh products
                                    const pr = await fetch('http://localhost:5000/api/products', { headers: { 'x-uid': currentUser.uid } });
                                    const pd = await pr.json();
                                    if (pr.ok && Array.isArray(pd.products)) {
                                      setProducts(pd.products);
                                    }
                                    setStockEdit({ id: null, value: '' });
                                  } catch (e) {
                                    alert(e.message || 'Failed to update stock');
                                  }
                                }}
                                className="px-3 py-1.5 text-xs rounded bg-green-600 text-white hover:bg-green-700"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setStockEdit({ id: null, value: '' })}
                                className="px-3 py-1.5 text-xs rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'farmer-products' ? (
          /* Farmer Products View */
          <div className="max-w-7xl mx-auto px-6 pb-12">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Farmer Products</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={fetchFarmerProducts}
                    disabled={farmerProductsLoading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-400"
                  >
                    {farmerProductsLoading ? 'Loading...' : 'Refresh'}
                  </button>
                  <button 
                    onClick={fetchAcceptedProducts}
                    disabled={acceptedProductsLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                  >
                    {acceptedProductsLoading ? 'Loading...' : 'My Accepted Products'}
                  </button>
                </div>
              </div>

              {farmerProductsLoading ? (
                <div className="text-center py-12">
                  <div className="text-gray-500">Loading farmer products...</div>
                </div>
              ) : farmerProducts.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <div className="text-gray-500 mb-2">No farmer products available</div>
                  <div className="text-sm text-gray-400">Farmer-submitted products will appear here</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {farmerProducts.map((product) => {
                    // Check if current seller has accepted this product
                    const isAccepted = product.acceptedBySellers?.some(seller => seller.sellerId === currentUser.uid);
                    
                    return (
                      <div key={product._id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        {/* Product Image */}
                        {product.imagePath && (
                          <img
                            src={product.imagePath}
                            alt={product.productName}
                            className="w-full h-48 object-cover rounded mb-4"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        )}
                        
                        <div className="space-y-3">
                          {/* Product Info */}
                          <div>
                            <h3 className="text-xl font-semibold text-gray-900">{product.productName}</h3>
                            
                            <div className="flex items-center justify-between mt-2">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                {product.category}
                              </span>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                product.status === 'approved' ? 'bg-green-100 text-green-800' :
                                product.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {product.status}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-lg font-bold text-green-600">₹{product.price}</span>
                            <span className="text-sm text-gray-600">Qty: {product.quantity}</span>
                          </div>

                          {/* Farmer Info */}
                          <div className="text-sm text-gray-600">
                            <div>Farmer: {product.farmerName}</div>
                            <div className="text-xs text-gray-500">Email: {product.farmerEmail}</div>
                          </div>

                          {/* Description */}
                          {product.description && (
                            <p className="text-sm text-gray-600 line-clamp-3">{product.description}</p>
                          )}

                          {/* Rejection Reason */}
                          {product.status === 'rejected' && product.rejectionReason && (
                            <div className="bg-red-50 border border-red-200 rounded p-2">
                              <p className="text-xs text-red-700">
                                <strong>Reason:</strong> {product.rejectionReason}
                              </p>
                            </div>
                          )}

                          {/* Accepted by seller indicator */}
                          {isAccepted && (
                            <div className="bg-green-50 border border-green-200 rounded p-2">
                              <p className="text-xs text-green-700">
                                <strong>✓ You've accepted this product</strong>
                              </p>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex gap-2 pt-2">
                            <button 
                              className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                              onClick={() => handleViewProduct(product)}
                            >
                              View
                            </button>
                            
                            {/* Debug info */}
                            <div className="text-xs text-gray-500 mb-2">
                              Status: {product.status}, Qty: {product.quantity}, Accepted: {isAccepted ? 'Yes' : 'No'}
                            </div>
                            
                            {product.status === 'approved' && product.quantity > 0 && !isAccepted && (
                              <button 
                                className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 font-semibold"
                                onClick={() => handleAcceptFarmerProduct(product._id)}
                              >
                                ✅ Accept Product
                              </button>
                            )}
                            
                            {product.status === 'approved' && product.quantity > 0 && (
                              <button 
                                className="flex-1 px-3 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
                                onClick={() => handleBuyFarmerProduct(product)}
                              >
                                🛒 Buy & Accept
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* Accepted Products Section */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-4">My Accepted Products</h3>
                {acceptedProductsLoading ? (
                  <div className="text-center py-4">
                    <div className="text-gray-500">Loading accepted products...</div>
                  </div>
                ) : acceptedProducts.length === 0 ? (
                  <div className="text-center py-4 bg-gray-50 rounded-lg">
                    <div className="text-gray-500">You haven't accepted any farmer products yet</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {acceptedProducts.map((product) => (
                      <div key={product._id} className="border rounded-lg p-4 bg-green-50">
                        <h4 className="font-semibold text-green-800">{product.productName}</h4>
                        <div className="text-sm text-green-700 mt-1">
                          <div>Category: {product.category}</div>
                          <div>Price: ₹{product.price}</div>
                          <div>Quantity: {product.quantity}</div>
                          <div>Farmer: {product.farmerName}</div>
                        </div>
                        <div className="mt-2 text-xs text-green-600">
                          Accepted on: {new Date(product.acceptedBySellers.find(s => s.sellerId === currentUser.uid)?.acceptedAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'my-purchases' ? (
          /* My Purchases View */
          <div className="max-w-7xl mx-auto px-6 pb-12">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">My Purchases from Farmers</h2>
                <button 
                  onClick={fetchSellerPurchases}
                  disabled={purchasesLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                >
                  {purchasesLoading ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              {purchasesLoading ? (
                <div className="text-center py-12">
                  <div className="text-gray-500">Loading purchase history...</div>
                </div>
              ) : sellerPurchases.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <div className="text-gray-500 mb-2">No purchases found</div>
                  <div className="text-sm text-gray-400">Your purchases from farmers will appear here</div>
                </div>
              ) : (
                <div className="row">
                  {sellerPurchases.map((purchase) => (
                    <div key={purchase._id} className="col-md-6 mb-4">
                      <div className="card h-100">
                        {/* Product Image */}
                        {purchase.productImagePath && (
                          <img
                            src={purchase.productImagePath}
                            alt={purchase.productName}
                            className="card-img-top"
                            style={{ height: '200px', objectFit: 'cover' }}
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        )}
                        
                        <div className="card-body d-flex flex-column">
                          {/* Product Info */}
                          <h5 className="card-title">{purchase.productName}</h5>
                          
                          <div className="mb-2">
                            <span className="badge bg-secondary me-2">{purchase.productCategory}</span>
                            <span className={`badge ${
                              purchase.status === 'delivered' ? 'bg-success' :
                              purchase.status === 'cancelled' ? 'bg-danger' :
                              purchase.status === 'shipped' ? 'bg-info' :
                              'bg-warning'
                            }`}>
                              {purchase.status}
                            </span>
                          </div>

                          <div className="mb-2">
                            <strong className="text-success">₹{purchase.totalAmount}</strong>
                            <span className="text-muted ms-2">Qty: {purchase.quantityPurchased}</span>
                            <span className="text-muted ms-2">@ ₹{purchase.unitPrice} each</span>
                          </div>

                          {/* Farmer Info */}
                          <div className="mb-2 text-muted small">
                            <div>Farmer: {purchase.farmerName}</div>
                            <div>Email: {purchase.farmerEmail}</div>
                          </div>

                          {/* Transaction Info */}
                          <div className="mb-2 text-muted small">
                            <div>Transaction ID: {purchase.transactionId}</div>
                            <div>Purchased: {new Date(purchase.createdAt).toLocaleDateString()}</div>
                          </div>

                          {/* Payment Status */}
                          <div className="mb-2">
                            <span className={`badge ${
                              purchase.paymentStatus === 'paid' ? 'bg-success' :
                              purchase.paymentStatus === 'failed' ? 'bg-danger' :
                              'bg-warning'
                            }`}>
                              Payment: {purchase.paymentStatus}
                            </span>
                          </div>

                          {/* Notes */}
                          {purchase.notes && (
                            <p className="card-text text-muted small">{purchase.notes}</p>
                          )}

                          {/* Action Buttons */}
                          <div className="mt-auto">
                            <div className="btn-group w-100" role="group">
                              <button 
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => alert(`Transaction Details:
ID: ${purchase.transactionId}
Status: ${purchase.status}
Payment: ${purchase.paymentStatus}
Total: ₹${purchase.totalAmount}`)}
                                title="View Details"
                              >
                                <i className="fas fa-eye"></i>
                              </button>
                              {purchase.status === 'pending' && (
                                <button 
                                  className="btn btn-outline-success btn-sm"
                                  onClick={() => {
                                    if (window.confirm('Confirm this purchase?')) {
                                      // Update status to confirmed
                                      fetch(`http://localhost:5000/api/seller-farmer-transactions/${purchase._id}/status`, {
                                        method: 'PUT',
                                        headers: {
                                          'Content-Type': 'application/json',
                                          'x-uid': currentUser.uid
                                        },
                                        body: JSON.stringify({ status: 'confirmed' })
                                      }).then(() => {
                                        toast.success('Purchase confirmed');
                                        fetchSellerPurchases();
                                      });
                                    }
                                  }}
                                  title="Confirm Purchase"
                                >
                                  <i className="fas fa-check"></i>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'hours' ? (
          /* Store Hours Management View */
          <div className="max-w-4xl mx-auto px-6 pb-12">
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold">7-Day Store Hours Management</h3>
                <button onClick={() => setActiveTab('overview')} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">
                  Back to Overview
                </button>
              </div>
              
              {/* Store Hours Summary */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="text-lg font-medium mb-4">Store Hours Summary</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{storeHours.length}</div>
                    <div className="text-sm text-gray-600">Days Configured</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {storeHours.filter(h => !h.isClosed).length}
                    </div>
                    <div className="text-sm text-gray-600">Open Days</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {storeHours.filter(h => h.isClosed).length}
                    </div>
                    <div className="text-sm text-gray-600">Closed Days</div>
                  </div>
                </div>
              </div>
              
              {/* Add Store Hours Form */}
              <div className="border rounded-lg p-4 mb-6">
                <h4 className="text-lg font-medium mb-4">Set Store Hours</h4>
                <form onSubmit={addStoreHours} className="grid md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Day</label>
                    <select 
                      name="day" 
                      value={hoursForm.day} 
                      onChange={onHoursChange} 
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" 
                      required
                    >
                      <option value="">Choose a day</option>
                      {next7Days.map(day => (
                        <option key={day.dayName} value={day.dayName}>
                          {day.isToday ? 'Today' : day.dayName} - {day.month} {day.dayNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="md:col-span-4 flex items-center gap-2">
                    <input 
                      id="isClosed" 
                      type="checkbox" 
                      name="isClosed" 
                      checked={hoursForm.isClosed} 
                      onChange={onHoursChange} 
                    />
                    <label htmlFor="isClosed" className="text-sm text-gray-700">Store is closed on this day</label>
                  </div>
                  
                  {!hoursForm.isClosed && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Opening Time</label>
                        <input 
                          type="time" 
                          name="openTime" 
                          value={hoursForm.openTime} 
                          onChange={onHoursChange} 
                          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" 
                          required={!hoursForm.isClosed}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Closing Time</label>
                        <input 
                          type="time" 
                          name="closeTime" 
                          value={hoursForm.closeTime} 
                          onChange={onHoursChange} 
                          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" 
                          required={!hoursForm.isClosed}
                        />
                      </div>
                    </>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
                    <input 
                      name="note" 
                      value={hoursForm.note} 
                      onChange={onHoursChange} 
                      placeholder="e.g., Holiday hours, Special event" 
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" 
                    />
                  </div>
                  
                  <div className="md:col-span-4 flex justify-start">
                    <button 
                      type="submit" 
                      className="px-6 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
                    >
                      Set Hours
                    </button>
                  </div>
                </form>
                
                {hoursMsg && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
                    {hoursMsg}
                  </div>
                )}
              </div>

              {/* 7-Day Store Hours Grid */}
              <div>
                <h4 className="text-lg font-medium mb-4">7-Day Store Hours View</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {next7Days.map(day => {
                    const dayHours = getHoursForDay(day.dayName);
                    const isToday = day.isToday;
                    
                    return (
                      <div key={day.dayName} className={`border rounded-lg p-4 ${
                        isToday ? 'border-green-500 bg-green-50' : 'border-gray-200'
                      }`}>
                        <div className="text-center mb-3">
                          <div className={`text-xs font-medium ${
                            isToday ? 'text-green-600' : 'text-gray-500'
                          }`}>
                            {isToday ? 'TODAY' : day.dayShort.toUpperCase()}
                          </div>
                          <div className={`text-lg font-bold ${
                            isToday ? 'text-green-600' : 'text-gray-900'
                          }`}>
                            {day.dayNumber}
                          </div>
                          <div className={`text-xs ${
                            isToday ? 'text-green-600' : 'text-gray-500'
                          }`}>
                            {day.month}
                          </div>
                          <div className="text-sm font-medium mt-1">{day.dayName}</div>
                          {isToday && (
                            <div className="text-xs text-green-600 font-medium mt-1">Current Day</div>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          {!dayHours ? (
                            <div className="text-center py-4">
                              <div className="text-sm text-gray-500 mb-2">Hours not set</div>
                              <button
                                onClick={() => setHoursForm(prev => ({ ...prev, day: day.dayName }))}
                                className="text-xs px-2 py-1 rounded bg-green-100 text-green-600 hover:bg-green-200"
                              >
                                + Set Hours
                              </button>
                            </div>
                          ) : (
                            <div className="bg-white rounded p-2 text-sm border">
                              {dayHours.isClosed ? (
                                <div className="text-center">
                                  <div className="font-medium text-red-600">CLOSED</div>
                                  {dayHours.note && (
                                    <div className="text-gray-600 text-xs mt-1">{dayHours.note}</div>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  <div className="font-medium text-green-600">
                                    {dayHours.openTime} - {dayHours.closeTime}
                                  </div>
                                  {dayHours.note && (
                                    <div className="text-gray-600 text-xs mt-1">{dayHours.note}</div>
                                  )}
                                </div>
                              )}
                              <button
                                onClick={() => removeStoreHours(day.dayName)}
                                className="text-xs mt-1 text-red-600 hover:text-red-800"
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'orders' ? (
          /* Order Processing View */
          <div className="max-w-7xl mx-auto px-6 pb-12">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Order Processing</h2>
                
              </div>

              {/* Pending Orders Section */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Pending Orders - Action Required</h3>
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                    {pendingOrders.length} pending
                  </span>
                </div>

                {pendingOrders.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <div className="text-gray-500 mb-2">No pending orders</div>
                    <div className="text-sm text-gray-400">Orders requiring your approval will appear here</div>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {pendingOrders.slice(0, 3).map((order) => {
                      const countdown = orderCountdowns[order._id] || { minutes: 0, seconds: 0, expired: true };
                      const isProcessing = processingOrder === order._id;
                      const totalItems = order.products?.reduce((sum, item) => sum + item.quantity, 0) || 0;

                      return (
                        <div key={order._id} className="border rounded-lg p-4 bg-white shadow-sm">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-semibold text-gray-900">#{order.orderNumber || order._id.slice(-6)}</span>
                                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Pending Approval</span>
                              </div>
                              <div className="text-sm text-gray-600">
                                {order.customerInfo?.name || 'Customer'} • {totalItems} items
                              </div>
                            </div>

                            {/* Countdown Timer */}
                            <div className="text-right">
                              <div className={`text-sm font-mono ${
                                countdown.expired ? 'text-red-600' : countdown.minutes === 0 && countdown.seconds <= 30 ? 'text-orange-600' : 'text-green-600'
                              }`}>
                                {countdown.expired ? 'EXPIRED' : `${countdown.minutes}:${countdown.seconds.toString().padStart(2, '0')}`}
                              </div>
                              <div className="text-xs text-gray-500">Time left</div>
                            </div>
                          </div>

                          {/* Order Items Preview */}
                          <div className="mb-3">
                            <div className="flex gap-2 overflow-x-auto pb-2">
                              {order.products?.slice(0, 3).map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded px-2 py-1 min-w-max">
                                  {item.image && (
                                    <img
                                      src={item.image}
                                      alt={item.name}
                                      className="w-6 h-6 object-cover rounded"
                                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                  )}
                                  <span className="text-xs text-gray-700">{item.name}</span>
                                  <span className="text-xs text-gray-500">x{item.quantity}</span>
                                </div>
                              ))}
                              {order.products?.length > 3 && (
                                <div className="text-xs text-gray-500 px-2 py-1">
                                  +{order.products.length - 3} more
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Order Summary */}
                          <div className="flex items-center justify-between mb-4">
                            <div className="text-sm text-gray-600">
                              Total: <span className="font-semibold text-green-600">₹{order.totalAmount || 0}</span>
                            </div>
                            <div className="text-sm text-gray-600">
                              Delivery: <span className="font-medium">₹{order.deliveryFee || 0}</span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex justify-center">
                            <button
                              onClick={() => handleAcceptOrder(order._id)}
                              disabled={countdown.expired || isProcessing}
                              className={`px-8 py-2 rounded-lg text-sm font-medium ${
                                countdown.expired || isProcessing
                                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                  : 'bg-green-600 text-white hover:bg-green-700'
                              }`}
                            >
                              {isProcessing ? 'Processing...' : 'Accept Order'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Active Orders Section */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Active Orders</h3>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                    {acceptedOrders.filter(order => order.status === 'delivery_pending').length} active
                  </span>
                </div>

                {acceptedOrders.filter(order => order.status === 'delivery_pending').length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <div className="text-gray-500 mb-2">No active orders</div>
                    <div className="text-sm text-gray-400">Accepted orders will appear here</div>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {acceptedOrders.filter(order => order.status === 'delivery_pending').slice(0, 3).map((order) => {
                      const totalItems = order.products?.reduce((sum, item) => sum + item.quantity, 0) || 0;

                      return (
                        <div key={order._id} className="border rounded-lg p-4 bg-white shadow-sm">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-semibold text-gray-900">#{order.orderNumber || order._id.slice(-6)}</span>
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Active</span>
                              </div>
                              <div className="text-sm text-gray-600">
                                {order.customerInfo?.name || 'Customer'} • {totalItems} items
                              </div>
                            </div>
                          </div>

                          {/* Order Items Preview */}
                          <div className="mb-3">
                            <div className="flex gap-2 overflow-x-auto pb-2">
                              {order.products?.slice(0, 3).map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded px-2 py-1 min-w-max">
                                  {item.image && (
                                    <img
                                      src={item.image}
                                      alt={item.name}
                                      className="w-6 h-6 object-cover rounded"
                                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                  )}
                                  <span className="text-xs text-gray-700">{item.name}</span>
                                  <span className="text-xs text-gray-500">x{item.quantity}</span>
                                </div>
                              ))}
                              {order.products?.length > 3 && (
                                <div className="text-xs text-gray-500 px-2 py-1">
                                  +{order.products.length - 3} more
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Order Summary */}
                          <div className="flex items-center justify-between mb-4">
                            <div className="text-sm text-gray-600">
                              Total: <span className="font-semibold text-green-600">₹{order.totalAmount || 0}</span>
                            </div>
                            <div className="text-sm text-gray-600">
                              Delivery: <span className="font-medium">₹{order.deliveryFee || 0}</span>
                            </div>
                          </div>

                          {/* Action Button */}
                          <div className="text-center">
                            <button
                              onClick={() => handleReadyForDelivery(order._id)}
                              disabled={processingOrder === order._id}
                              className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                            >
                              {processingOrder === order._id ? 'Processing...' : 'Ready to Delivery'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Pending Delivery Orders Section */}
              {acceptedOrders.filter(order => order.status === 'ready_for_delivery').length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Pending Delivery Orders</h3>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                      {acceptedOrders.filter(order => order.status === 'ready_for_delivery').length} pending delivery
                    </span>
                  </div>

                  <div className="grid gap-4">
                    {acceptedOrders.filter(order => order.status === 'ready_for_delivery').slice(0, 3).map((order) => {
                      const totalItems = order.products?.reduce((sum, item) => sum + item.quantity, 0) || 0;

                      return (
                        <div
                          key={order._id}
                          className="border rounded-lg p-4 bg-white shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => navigate(`/seller/order-processing/${order._id}`)}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-semibold text-gray-900">#{order.orderNumber || order._id.slice(-6)}</span>
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Ready for Delivery</span>
                              </div>
                              <div className="text-sm text-gray-600">
                                {order.customerInfo?.name || 'Customer'} • {totalItems} items
                              </div>
                            </div>
                          </div>

                          {/* Order Items Preview */}
                          <div className="mb-3">
                            <div className="flex gap-2 overflow-x-auto pb-2">
                              {order.products?.slice(0, 3).map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded px-2 py-1 min-w-max">
                                  {item.image && (
                                    <img
                                      src={item.image}
                                      alt={item.name}
                                      className="w-6 h-6 object-cover rounded"
                                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                  )}
                                  <span className="text-xs text-gray-700">{item.name}</span>
                                  <span className="text-xs text-gray-500">x{item.quantity}</span>
                                </div>
                              ))}
                              {order.products?.length > 3 && (
                                <div className="text-xs text-gray-500 px-2 py-1">
                                  +{order.products.length - 3} more
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Order Summary */}
                          <div className="flex items-center justify-between mb-4">
                            <div className="text-sm text-gray-600">
                              Total: <span className="font-semibold text-green-600">₹{order.totalAmount || 0}</span>
                            </div>
                            <div className="text-sm text-gray-600">
                              Delivery: <span className="font-medium">₹{order.deliveryFee || 0}</span>
                            </div>
                          </div>

                          {/* OTP Section */}
                          <div className="mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                            <div className="text-sm font-medium text-yellow-800 mb-2">Delivery OTP</div>
                            <div className="text-lg font-mono font-bold text-yellow-900 bg-yellow-100 px-3 py-2 rounded text-center">
                              {order.deliveryOTP || 'OTP will be generated when processing starts'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-orange-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-orange-600">{pendingOrders.length}</div>
                  <div className="text-sm text-orange-800">Pending Approval</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{acceptedOrders.filter(order => order.status === 'delivery_pending').length}</div>
                  <div className="text-sm text-blue-800">Active Orders</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{acceptedOrders.filter(order => order.status === 'ready_for_delivery').length}</div>
                  <div className="text-sm text-green-800">Pending Delivery</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Default Overview Content */
          <div className="max-w-7xl mx-auto px-6 pb-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Store Information + Performance */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold">Store Information</h3>
              <div className="mt-4 text-sm text-gray-700 space-y-1">
                <div className="font-medium">{profile.storeName || 'Fresh Cart - Downtown'}</div>
                <div className="flex items-center gap-2 text-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 12l4.243-4.243m-4.243 4.243L6.343 6.343M13.414 12l-7.071 7.071"/></svg>
                  <span>{profile.storeAddress || '123 Main Street, Downtown, City'}</span>
                </div>
                <div className="text-xs text-gray-500">Seller ID: {profile.sellerUniqueNumber || '—'}</div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-gray-600">Operating Hours</div>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Open Now</span>
                </div>
                <div className="mt-2 w-full h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-2 bg-gray-900" style={{ width: '000%' }}></div></div>
                <div className="text-xs text-gray-600">Today's Performance • 000%</div>
              </div>
            </div>

            {/* Low stock alerts */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold">Low Stock Alerts</h3>
              <div className="mt-4 space-y-3">
                {products.filter(p => p.stock <= (p.lowStockThreshold || 10)).length === 0 ? (
                  <div className="text-sm text-gray-500">No low stock items</div>
                ) : (
                  products.filter(p => p.stock <= (p.lowStockThreshold || 10)).map((product) => (
                    <div key={product._id} className="flex items-center justify-between border rounded-xl p-4 bg-red-50">
                      <div>
                        <div className="text-sm font-medium text-red-700">{product.name}</div>
                        <div className="text-xs text-red-600">Stock: {product.stock} (Alert: {product.lowStockThreshold || 10})</div>
                      </div>
                      <button 
                        onClick={() => navigate('/seller/products')}
                        className="px-3 py-1.5 rounded-lg bg-white border border-red-200 text-red-700 text-xs hover:bg-red-100"
                      >
                        Restock
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Active Orders */}
            <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Active Orders</h3>
                <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full">{activeOrders.length}</span>
              </div>
              <div className="mt-4 grid md:grid-cols-3 gap-4">
                {activeOrders.length === 0 ? (
                  <div className="text-sm text-gray-500 col-span-3 text-center py-8">No active orders</div>
                ) : (
                  activeOrders.map(o => (
                    <div key={o.id} className="border rounded-xl p-4 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold">{o.id}</div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${o.status === 'preparing' ? 'bg-yellow-100 text-yellow-700' : o.status === 'ready' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{o.status}</span>
                      </div>
                      <div className="text-sm text-gray-600">{o.customer} • {o.items} items</div>
                      <div className="text-xs text-gray-400">{o.ago}</div>
                      <div className="mt-2 font-semibold text-green-700">₹{o.total}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}