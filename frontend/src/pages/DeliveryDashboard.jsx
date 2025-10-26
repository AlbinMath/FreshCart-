
import  { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import DeliveryVerificationGuard from "../components/DeliveryVerificationGuard";

// Minimal delivery partner dashboard inspired by provided design
export default function DeliveryDashboard() {
  const { currentUser, getUserProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isOnline, setIsOnline] = useState(false); // Initialize as false

  // Orders state with proper initial values
  const [availableOrders, setAvailableOrders] = useState([]);
  const [acceptedOrders, setAcceptedOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Earnings state
  const [earningsData, setEarningsData] = useState({
    totalEarnings: 0,
    todayEarnings: 0,
    todayDeliveries: 0,
    earningsByDate: [],
    totalDeliveries: 0
  });
  const [loadingEarnings, setLoadingEarnings] = useState(false);

  // Wallet balance state
  const [walletData, setWalletData] = useState({
    totalEarnings: 0,
    totalWithdrawn: 0,
    balance: 0,
    availableBalance: 0,
    transactions: []
  });
  const [loadingWallet, setLoadingWallet] = useState(false);

  // Earnings modal and withdrawal state
  const [showEarningsModal, setShowEarningsModal] = useState(false);
  const [showWithdrawalForm, setShowWithdrawalForm] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalHistory, setWithdrawalHistory] = useState([]);
  const [loadingWithdrawal, setLoadingWithdrawal] = useState(false);
  const [withdrawalMsg, setWithdrawalMsg] = useState('');

  // State to track recently accepted orders for visual feedback
  const [recentlyAcceptedOrder, setRecentlyAcceptedOrder] = useState(null);
  
  // Auto-refresh state
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState(null);
  
  // Error and notification state
  const [walletError, setWalletError] = useState(null);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');

  // Schedule management state
  const [scheduleItems, setScheduleItems] = useState([]);
  const [scheduleForm, setScheduleForm] = useState({
    date: "",
    start: "",
    end: "",
    note: ""
  });
  const [scheduleMsg, setScheduleMsg] = useState("");

  const normalizeSchedules = (list = []) => (
    Array.isArray(list) ? list.map((item) => {
      // Add safety checks for item
      if (!item) return {};
      
      const rawId = item?._id ?? item?.id;
      const normalizedId =
        rawId && typeof rawId === "object" && typeof rawId.toString === "function"
          ? rawId.toString()
          : rawId ?? "";
          
      // Ensure all required properties are present
      return { 
        ...item, 
        _id: normalizedId, 
        id: normalizedId,
        date: item.date || '',
        start: item.start || '',
        end: item.end || '',
        status: item.status || 'scheduled'
      };
    }) : []
  );

  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
      return;
    }
    const profile = getUserProfile();
    if (!profile || profile.role !== "delivery") {
      navigate("/");
      return;
    }
    
    // Additional verification check - this will be caught by DeliveryVerificationGuard
    // but adding here as a backup
    checkDeliveryVerificationStatus();
    
    loadSchedule();
    loadAvailableOrders();
    loadAcceptedOrders();
    loadEarnings();
    loadWallet();
  }, [currentUser, navigate]);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefreshEnabled || !currentUser) return;

    const refreshInterval = setInterval(() => {
      console.log('🔄 Auto-refreshing wallet data...');
      loadWallet();
      loadWithdrawalHistory();
      setLastRefreshTime(new Date());
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(refreshInterval);
  }, [autoRefreshEnabled, currentUser]);

  // Reload data when returning to the page (e.g., from delivery tracking)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Page is visible again, reload data
        loadAcceptedOrders();
        loadEarnings();
        loadWallet();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser]);

  // Check if delivery partner is approved
  const checkDeliveryVerificationStatus = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/delivery-verification/${currentUser.uid}/status`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.exists) {
          const status = data.data.verification?.status;
          if (status !== 'approved') {
            console.log('Delivery partner not approved, redirecting...');
            navigate('/delivery/verification');
            return;
          }
        } else {
          console.log('No verification found, redirecting...');
          navigate('/delivery/verification');
          return;
        }
      }
    } catch (error) {
      console.error('Error checking verification status:', error);
    }
  };

  // Load available orders
  async function loadAvailableOrders() {
    setLoadingOrders(true);
    try {
      const res = await fetch(`http://localhost:5000/api/orders/delivery/available`);
      const data = await res.json();
      if (res.ok && data.success) {
        // Filter for ready_for_delivery orders only and exclude orders already assigned to this delivery partner
        const readyOrders = Array.isArray(data.orders) 
          ? data.orders.filter(order => 
              order && 
              order.status === 'ready_for_delivery' && 
              order.deliveryPartnerId !== currentUser.uid
            ) 
          : [];
        setAvailableOrders(readyOrders);
      } else {
        setAvailableOrders([]); // Set to empty array on error
      }
    } catch (error) {
      console.error("Error loading available orders:", error);
      setAvailableOrders([]); // Set to empty array on error
    } finally {
      setLoadingOrders(false);
    }
  }

  // Load accepted orders (out_for_delivery and ready_for_delivery with assigned delivery partner)
  async function loadAcceptedOrders() {
    try {
      // First get out_for_delivery orders assigned to this delivery partner
      const res = await fetch(`http://localhost:5000/api/orders/delivery/my-orders?deliveryPartnerId=${currentUser.uid}`);
      const data = await res.json();
      let accepted = [];
      
      if (res.ok && data.success) {
        // Get today's date for filtering delivered orders
        const today = new Date().toISOString().split('T')[0];
        
        // Filter for out_for_delivery orders AND today's delivered orders
        accepted = Array.isArray(data.orders) 
          ? data.orders.filter(order => {
              if (!order) return false;
              
              // Include all out_for_delivery orders
              if (order.status === 'out_for_delivery') return true;
              
              // Include delivered orders only if completed today
              if (order.status === 'delivered' && order.deliveryCompletedAt) {
                const deliveryDate = new Date(order.deliveryCompletedAt).toISOString().split('T')[0];
                return deliveryDate === today;
              }
              
              return false;
            }) 
          : [];
      }
      
      // Then get ready_for_delivery orders assigned to this delivery partner
      const assignedRes = await fetch(`http://localhost:5000/api/orders/delivery/available`);
      const assignedData = await assignedRes.json();
      
      if (assignedRes.ok && assignedData.success) {
        // Filter for ready_for_delivery orders assigned to this delivery partner
        const assignedOrders = Array.isArray(assignedData.orders) 
          ? assignedData.orders.filter(order => 
              order && 
              order.status === 'ready_for_delivery' && 
              order.deliveryPartnerId === currentUser.uid
            ) 
          : [];
        
        // Combine both arrays
        accepted = [...accepted, ...assignedOrders.map(order => ({
          ...order,
          status: 'assigned_pending_otp' // Special status to indicate assigned but not yet verified
        }))];
      }
      
      setAcceptedOrders(accepted);
    } catch (error) {
      console.error("Error loading accepted orders:", error);
      setAcceptedOrders([]); // Set to empty array on error
    }
  }
  
  // Load earnings data
  async function loadEarnings() {
    if (!currentUser) return;
    setLoadingEarnings(true);
    try {
      const res = await fetch(`http://localhost:5000/api/orders/delivery/${currentUser.uid}/earnings`);
      const data = await res.json();
      if (res.ok && data.success) {
        setEarningsData(data.data);
      } else {
        setEarningsData({
          totalEarnings: 0,
          todayEarnings: 0,
          todayDeliveries: 0,
          earningsByDate: [],
          totalDeliveries: 0
        });
      }
    } catch (error) {
      console.error("Error loading earnings:", error);
      setEarningsData({
        totalEarnings: 0,
        todayEarnings: 0,
        todayDeliveries: 0,
        earningsByDate: [],
        totalDeliveries: 0
      });
    } finally {
      setLoadingEarnings(false);
    }
  }

  // Load wallet balance
  async function loadWallet() {
    if (!currentUser) return;
    setLoadingWallet(true);
    try {
      const token = await currentUser.getIdToken();
      console.log('🔍 Loading wallet data for user:', currentUser.uid);
      
      const res = await fetch(`http://localhost:5000/api/delivery/${currentUser.uid}/wallet`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📥 Wallet API response status:', res.status);
      const data = await res.json();
      console.log('📥 Wallet API response data:', data);
      
      if (res.ok && data.success) {
        const wallet = data.wallet || {
          totalEarnings: 0,
          totalWithdrawn: 0,
          balance: 0,
          availableBalance: 0,
          transactions: []
        };
        
        console.log('✅ Wallet data loaded successfully:', wallet);
        setWalletData(wallet);
      } else {
        console.warn('⚠️ Wallet API failed:', data.message);
        setWalletError(data.message || 'Failed to load wallet data');
        // Set fallback data
        setWalletData({
          totalEarnings: 0,
          totalWithdrawn: 0,
          balance: 0,
          availableBalance: 0,
          transactions: []
        });
      }
    } catch (error) {
      console.error("❌ Error loading wallet:", error);
      setWalletError('Network error: Unable to load wallet data');
      // Set fallback data on error
      setWalletData({
        totalEarnings: 0,
        totalWithdrawn: 0,
        balance: 0,
        transactions: []
      });
    } finally {
      setLoadingWallet(false);
    }
  }

  // Load withdrawal history
  async function loadWithdrawalHistory() {
    if (!currentUser) return;
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`http://localhost:5000/api/delivery/${currentUser.uid}/wallet/withdrawals`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setWithdrawalHistory(data.withdrawals || []);
        // Update wallet data with calculated values from withdrawal history
        if (data.totalWithdrawn !== undefined) {
          setWalletData(prev => ({
            ...prev,
            totalWithdrawn: data.totalWithdrawn,
            availableBalance: Math.max(0, prev.totalEarnings - data.totalWithdrawn)
          }));
        }
      } else {
        setWithdrawalHistory([]);
      }
    } catch (error) {
      console.error("Error loading withdrawal history:", error);
      setWithdrawalHistory([]);
    }
  }

  // Submit withdrawal request
  const submitWithdrawal = async () => {
    setWithdrawalMsg('');
    const amount = parseFloat(withdrawalAmount);
    
    if (isNaN(amount) || amount <= 0) {
      setWithdrawalMsg('Please enter a valid amount');
      return;
    }

    if (amount < 500) {
      setWithdrawalMsg('Minimum withdrawal amount is ₹500');
      return;
    }

    // Calculate available balance based on withdrawal history
    const availableBalance = walletData.availableBalance || Math.max(0, walletData.totalEarnings - walletData.totalWithdrawn);
    if (amount > availableBalance) {
      setWithdrawalMsg(`Insufficient balance. Available: ₹${availableBalance.toFixed(2)}`);
      return;
    }

    setLoadingWithdrawal(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`http://localhost:5000/api/delivery/${currentUser.uid}/wallet/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ amount })
      });

      const data = await res.json();
      
      if (res.ok && data.success) {
        setWithdrawalMsg('Withdrawal request submitted successfully! Admin will process your request.');
        setWithdrawalAmount('');
        setShowWithdrawalForm(false);
        
        // Reload wallet and withdrawal history
        loadWallet();
        loadWithdrawalHistory();

        // Show success notification
        setNotificationMessage('Withdrawal request submitted successfully!');
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 5000);

        setTimeout(() => {
          setWithdrawalMsg('');
        }, 5000);
      } else {
        setWithdrawalMsg(data.message || 'Failed to submit withdrawal request');
      }
    } catch (error) {
      console.error('Error submitting withdrawal:', error);
      setWithdrawalMsg('Failed to submit withdrawal request');
    } finally {
      setLoadingWithdrawal(false);
    }
  };
  
  // Load ready_for_delivery orders assigned to this delivery partner
  async function loadAssignedOrders() {
    // This function is now integrated into loadAcceptedOrders
    // Keeping it for backward compatibility but it's empty
    return;
  }
  // Load store overview orders (active orders)
  async function loadStoreOverviewOrders() {
    setLoadingStoreOrders(true);
    try {
      const res = await fetch(`http://localhost:5000/api/orders/delivery/store-overview`);
      const data = await res.json();
      if (res.ok && data.success) {
        // Add safety check for orders array
        const safeOrders = Array.isArray(data.orders) ? data.orders.filter(order => order != null) : [];
        setStoreOverviewOrders(safeOrders);
      } else {
        setStoreOverviewOrders([]); // Set to empty array on error
      }
    } catch (error) {
      console.error("Error loading store overview orders:", error);
      setStoreOverviewOrders([]); // Set to empty array on error
    } finally {
      setLoadingStoreOrders(false);
    }
  }

  // Load schedule data
  async function loadSchedule() {
    if (!currentUser) return;
    try {
      const res = await fetch(`http://localhost:5000/api/users/${currentUser.uid}/schedules`);
      const data = await res.json();
      if (res.ok && data.success) {
        // Add safety check for schedules array
        const safeSchedules = Array.isArray(data.schedules) ? data.schedules : [];
        setScheduleItems(normalizeSchedules(safeSchedules));
        
        // Check if there's an active schedule
        const activeSchedule = safeSchedules.find(schedule => 
          schedule && schedule.status !== 'completed' && schedule.status !== 'cancelled'
        );
        setIsOnline(!!activeSchedule);
      } else {
        setScheduleItems([]);
        setIsOnline(false);
      }
    } catch (error) {
      console.error("Error loading schedule:", error);
      // Set default values on error
      setScheduleItems([]);
      setIsOnline(false);
    }
  }

  // Schedule form handlers
  const onScheduleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setScheduleForm((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
  };

  const addSchedule = async (e) => {
    e.preventDefault();
    setScheduleMsg("");
    if (!scheduleForm.date || !scheduleForm.start || !scheduleForm.end) { 
      setScheduleMsg('Date, Start time, and End time are required'); 
      return; 
    }
    
    // Validate that end time is after start time
    if (scheduleForm.start >= scheduleForm.end) {
      setScheduleMsg('End time must be after start time');
      return;
    }
    
    try {
      const body = { 
        date: scheduleForm.date, 
        start: scheduleForm.start, 
        end: scheduleForm.end, 
        note: scheduleForm.note 
      };
      const res = await fetch(`http://localhost:5000/api/users/${currentUser.uid}/schedules`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to add');
      setScheduleItems(normalizeSchedules(data.schedules || []));
      setScheduleForm({ date: "", start: "", end: "", note: "" });
      setScheduleMsg('Schedule added successfully');
      
      // Reload orders when schedule changes
      loadAvailableOrders();
      loadAcceptedOrders();
    } catch (error) { 
      setScheduleMsg(error.message || 'Failed to add schedule'); 
    }
  };

  const removeSchedule = async (scheduleId) => {
    if (!scheduleId) {
      setScheduleMsg('Invalid schedule identifier');
      return;
    }
    try {
      const res = await fetch(`http://localhost:5000/api/users/${currentUser.uid}/schedules/${scheduleId}`, { 
        method: 'DELETE' 
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to remove');
      setScheduleItems(normalizeSchedules(data.schedules || []));
      setScheduleMsg('Schedule removed successfully');
    } catch (error) { 
      setScheduleMsg(error.message || 'Failed to remove schedule'); 
    }
  };

  const profile = getUserProfile();

  // Demo data placeholders - now using real earnings data
  const stats = {
    deliveriesToday: earningsData.todayDeliveries || 0,
    earningsToday: earningsData.todayEarnings || 0,
    avgRating: 0.0,
    timeOnline: "0.0 h",
    availableOrders: Array.isArray(availableOrders) ? availableOrders.length : 0,
    totalEarnings: earningsData.totalEarnings || 0,
    totalDeliveries: earningsData.totalDeliveries || 0
  };

  const isScheduled = useMemo(() => {
    // Add safety check for scheduleItems array
    if (!Array.isArray(scheduleItems) || !scheduleItems.length) {
      return false;
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const minutesSinceMidnight = today.getHours() * 60 + today.getMinutes();

    return scheduleItems.some((item) => {
      // Add safety check for item
      if (!item) return false;
      
      // Add safety check for item.date
      if (!item.date || typeof item.date !== 'string') {
        return false;
      }
      // Add additional safety check for todayStr
      if (!todayStr || typeof todayStr !== 'string') {
        return false;
      }
      if (item.date !== todayStr) {
        return false;
      }
      
      // Add safety checks for start and end times
      if (!item.start || !item.end || typeof item.start !== 'string' || typeof item.end !== 'string') {
        return false;
      }
      
      const startParts = item.start.split(':');
      const endParts = item.end.split(':');
      
      // Check if split resulted in valid parts
      if (startParts.length < 2 || endParts.length < 2) {
        return false;
      }
      
      const startHour = parseInt(startParts[0], 10);
      const startMinute = parseInt(startParts[1], 10);
      const endHour = parseInt(endParts[0], 10);
      const endMinute = parseInt(endParts[1], 10);
      
      // Check if parsing resulted in valid numbers
      if (isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute)) {
        return false;
      }
      
      const startTotal = startHour * 60 + startMinute;
      const endTotal = endHour * 60 + endMinute;
      return minutesSinceMidnight >= startTotal && minutesSinceMidnight <= endTotal;
    });
  }, [scheduleItems]);

  const hasSchedules = useMemo(() => Array.isArray(scheduleItems) && scheduleItems.length > 0, [scheduleItems]);
  const isDeliveryFeatureLocked = !isOnline;
  const deliveryFeatureLockMessage = "Activate a schedule to access delivery actions.";

  const getActiveSchedule = () => {
    if (!Array.isArray(scheduleItems) || scheduleItems.length === 0) return null;
    return [...scheduleItems].reverse().find((item) => item.status !== 'completed' && item.status !== 'cancelled');
  };

  const markOffline = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/users/${currentUser.uid}/schedules/go-offline`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to go offline');
      setScheduleItems(normalizeSchedules(data.schedules || []));
      setIsOnline(false);
      setScheduleMsg('You are now offline');
      
      // Reload orders when status changes
      loadAvailableOrders();
      loadAcceptedOrders();
    } catch (error) {
      console.error('Error going offline:', error);
      setScheduleMsg(error.message || 'Failed to go offline');
    }
  };

  const markOnline = async () => {
    try {
      // When going online, create a 1-hour schedule
      const now = new Date();
      const startTime = now.toTimeString().slice(0, 5); // HH:MM format
      now.setHours(now.getHours() + 1);
      const endTime = now.toTimeString().slice(0, 5); // HH:MM format
      const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // First try to go online through the API
      const res = await fetch(`http://localhost:5000/api/users/${currentUser.uid}/schedules/go-online`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await res.json();
      if (!res.ok || !data.success) {
        // If go-online fails, try to create a manual schedule
        const scheduleRes = await fetch(`http://localhost:5000/api/users/${currentUser.uid}/schedules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date,
            start: startTime,
            end: endTime,
            note: 'Manual online status'
          })
        });
        
        const scheduleData = await scheduleRes.json();
        if (!scheduleRes.ok || !scheduleData.success) {
          throw new Error(scheduleData.message || 'Failed to create schedule');
        }
        
        setScheduleItems(normalizeSchedules(scheduleData.schedules || []));
      } else {
        setScheduleItems(normalizeSchedules(data.schedules || []));
      }
      
      setIsOnline(true);
      setScheduleMsg('You are now online');
      
      // Reload orders when status changes
      loadAvailableOrders();
      loadAcceptedOrders();
    } catch (error) {
      console.error('Error going online:', error);
      setScheduleMsg(error.message || 'Failed to go online');
    }
  };

  const handleStatusToggle = async () => {
    if (!currentUser) return;

    if (isOnline) {
      await markOffline();
    } else {
      await markOnline();
    }
  };

  // Accept order for delivery
  const acceptOrder = async (orderId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/orders/delivery/accept/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryPartnerId: currentUser.uid })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to accept order');
      
      // Set the recently accepted order for visual feedback
      setRecentlyAcceptedOrder(orderId);
      
      // Clear the recently accepted order after 3 seconds
      setTimeout(() => {
        setRecentlyAcceptedOrder(null);
      }, 3000);
      
      // Reload orders after accepting
      loadAvailableOrders();
      loadAcceptedOrders();
      
      setScheduleMsg('Delivery partner assigned successfully. Please verify OTP on the tracking page to start delivery.');
      
      // Scroll to the "My Deliveries" section to show the newly accepted order
      setTimeout(() => {
        const myDeliveriesSection = document.getElementById('my-deliveries-section');
        if (myDeliveriesSection) {
          myDeliveriesSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 500);
      
      // Navigate to tracking page after a short delay to allow user to see the message
      setTimeout(() => {
        navigate(`/delivery/track/${orderId}`);
      }, 2000);
      
      // Clear the message after 3 seconds
      setTimeout(() => {
        setScheduleMsg('');
      }, 3000);
    } catch (error) {
      console.error('Error accepting order:', error);
      setScheduleMsg(error.message || 'Failed to accept order');
    }
  };

  return (
    <DeliveryVerificationGuard>
      <div className="min-h-screen bg-gray-50">
        {/* Success Notification */}
        {showNotification && (
          <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 transform transition-all duration-300 ease-in-out animate-bounce">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
            </svg>
            <span>{notificationMessage}</span>
            <button 
              onClick={() => setShowNotification(false)}
              className="text-white hover:text-gray-200"
            >
              ✕
            </button>
          </div>
        )}
        {/* Sidebar */}
        <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-gray-200 flex flex-col z-20">
          <div className="px-4 py-5 border-b">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">FC</div>
              <div>
                <div className="text-lg font-semibold text-green-700">Fresh Cart</div>
                <div className="text-xs text-gray-500">Welcome back, <span className="font-medium">Delivery Agent</span></div>
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
            {[
              { key: "dashboard", label: "Dashboard", icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
            )},
            { key: "deliveries", label: "My Deliveries", icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h18M9 7h12M9 11h12M9 15h12M9 19h12M3 7h.01M3 11h.01M3 15h.01M3 19h.01"/></svg>
            )},
            { key: "earnings", label: "Earnings", icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8 4a8 8 0 11-16 0 8 8 0 0116 0z"/></svg>
            )},
            { key: "schedule", label: "Schedule", icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 11-16 0V7a2 2 0 0116 0z"/></svg>
            )},
          ].map(item => (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${activeTab === item.key ? 'bg-green-100 text-green-700' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              <span className="text-gray-500">{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge ? <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full">{item.badge}</span> : null}
            </button>
          ))}
        </nav>

        <div className="mt-auto border-t p-3 space-y-2">
          
          <button onClick={() => navigate('/delivery/profile')} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A9 9 0 1118.879 4.196 9 9 0 015.12 17.804z"/></svg>
            <span>My Profile</span>
          </button>
          <button onClick={async () => { await logout(); navigate('/login'); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
            <span>Logout</span>
          </button>
        </div>
        </aside>

        {/* Main Content */}
        <div className="ml-64">
          {/* Header */}
          <div className="border-b bg-white">
            <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Delivery Status</h1>
                <p className="text-sm text-gray-600">
                  {isOnline ? "Online & Available" : isScheduled ? "Offline • Scheduled" : "Offline"}
                </p>
              </div>
              <button
                onClick={handleStatusToggle}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isOnline
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-green-600 text-white hover:bg-green-700"
                }`}
              >
                {isOnline ? "Go Offline" : "Go Online"}
              </button>
            </div>
          </div>

          {/* Status alert */}
          {!isOnline && (
            <div className="max-w-7xl mx-auto px-6 pt-4">
              <div className={`rounded-lg p-4 text-sm border ${
                isScheduled ? "bg-yellow-50 border-yellow-200 text-yellow-800" : "bg-red-50 border-red-200 text-red-700"
              }`}>
                {isScheduled ? (
                  <div className="flex items-start gap-3">
                    <span className="text-lg">📅</span>
                    <div>
                      <p className="font-semibold">You are currently marked offline with an active schedule.</p>
                      <p className="mt-1">Your availability will automatically switch to online when the scheduled slot begins.</p>
                      <button
                        onClick={() => setActiveTab('schedule')}
                        className="mt-3 inline-flex items-center text-sm font-medium text-yellow-800 hover:text-yellow-900"
                      >
                        Review today's schedule →
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <span className="text-lg">⚠️</span>
                    <div>
                      <p className="font-semibold">You are offline.</p>
                      <p className="mt-1">Create a schedule slot to become available or go online manually.</p>
                      <button
                        onClick={() => setActiveTab('schedule')}
                        className="mt-3 inline-flex items-center text-sm font-medium text-red-700 hover:text-red-800"
                      >
                        Go to Schedule Management →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          

          {/* Success message */}
          {scheduleMsg && (
            <div className="max-w-7xl mx-auto px-6 pt-4">
              <div className="rounded-lg p-4 text-sm border bg-green-50 border-green-200 text-green-700">
                <div className="flex items-start gap-3">
                  <span className="text-lg">✓</span>
                  <div>
                    <p className="font-semibold">{scheduleMsg}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Top metrics */}
          <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600">Earnings Today</div>
              <div className="text-2xl font-semibold text-gray-900 mt-1">₹{loadingEarnings ? '...' : stats.earningsToday.toFixed(2)}</div>
              <div className="text-xs text-green-600 mt-2">From {stats.deliveriesToday} deliveries</div>
            </div>
            <button 
              onClick={() => {
                setShowEarningsModal(true);
                loadWithdrawalHistory();
              }}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer text-left"
            >
              <div className="text-sm text-gray-600 flex items-center justify-between">
                <span>Total Earnings</span>
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                </svg>
              </div>
              <div className="text-2xl font-semibold text-gray-900 mt-1">₹{loadingEarnings ? '...' : stats.totalEarnings.toFixed(2)}</div>
              <div className="text-xs text-blue-600 mt-2">{stats.totalDeliveries} total deliveries • Click for details</div>
            </button>
            
          </div>

          {/* Body - Conditional Content Based on Active Tab */}
          {activeTab === "dashboard" && (
            <div className="max-w-7xl mx-auto px-6 pb-12">
              {!hasSchedules ? (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                  <div className="text-red-500 mb-4">
                    <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">No Schedule Created</h3>
                  <p className="text-gray-600 mb-6">You need to create a schedule to access delivery features.</p>
                  <button 
                    onClick={() => setActiveTab('schedule')}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                  >
                    Create Schedule
                  </button>
                  <div className="mt-8 text-left bg-gray-50 p-6 rounded-lg max-w-2xl mx-auto">
                    <h4 className="font-semibold text-gray-900 mb-3">Why create a schedule?</h4>
                    <ul className="text-gray-600 space-y-2 text-sm">
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">•</span>
                        <span>Available Orders section will be accessible when you have a schedule</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">•</span>
                        <span>My Deliveries section will be accessible when you have a schedule</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">•</span>
                        <span>Delivery Tracking will be accessible when you have a schedule</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">•</span>
                        <span>You'll be able to receive delivery requests during your scheduled hours</span>
                      </li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
                  {/* Available Orders */}
                  <div className="bg-white rounded-lg shadow p-6 h-full flex flex-col">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="text-lg font-semibold">Available Orders</h3>
                      <span className="inline-flex w-max text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">{availableOrders.length}</span>
                    </div>
                    <div className="mt-4 space-y-4 flex-1">
                      {loadingOrders ? (
                        <div className="text-center py-8 text-gray-500">
                          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                          <p>Loading available orders...</p>
                        </div>
                      ) : availableOrders.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2"/>
                          </svg>
                          <p>No available orders</p>
                          <p className="text-sm">Check back later for new delivery requests</p>
                        </div>
                      ) : (
                        availableOrders.slice(0, 3).map((order) => {
                          // Add safety checks for order properties
                          if (!order) return null;
                          
                          const orderId = order._id || order.id || '';
                          const orderNumber = order.orderNumber || (orderId ? orderId.slice(-6) : 'Unknown');
                          const totalItems = order.products && Array.isArray(order.products) 
                            ? order.products.reduce((sum, item) => sum + (item ? item.quantity || 0 : 0), 0) 
                            : 0;
                          const customerName = order.customerInfo?.name || 'Customer';
                          const city = order.deliveryAddress?.city || '';
                          const state = order.deliveryAddress?.state || '';
                          const totalAmount = order.totalAmount || 0;
                          const status = order.status || '';
                          
                          return (
                            <div key={orderId} className="border rounded-lg p-4 bg-gray-50">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-semibold text-gray-900">#{orderNumber}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                      status === 'ready_for_delivery' ? 'bg-green-100 text-green-700' :
                                      status === 'out_for_delivery' ? 'bg-blue-100 text-blue-700' :
                                      status === 'assigned_pending_otp' ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-gray-100 text-gray-700'
                                    }`}>
                                      {status === 'ready_for_delivery' ? 'Ready for Delivery' :
                                       status === 'out_for_delivery' ? 'Out for Delivery' :
                                       status === 'assigned_pending_otp' ? 'Assigned - Pending OTP' :
                                       status}
                                    </span>
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    {customerName} • {totalItems} items
                                  </div>
                                </div>
                              </div>
                              <div className="text-sm text-gray-600 mb-2">
                                {city}, {state}
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="text-sm font-semibold text-green-600">
                                  ₹{totalAmount}
                                  <div className="text-xs text-gray-500">Delivery Fee: ₹{order.deliveryFee || 0}</div>
                                </div>
                                {isDeliveryFeatureLocked ? (
                                  <span className="text-xs text-gray-400" title={deliveryFeatureLockMessage}>
                                    {deliveryFeatureLockMessage}
                                  </span>
                                ) : (
                                  <button 
                                    onClick={() => acceptOrder(orderId)}
                                    className="text-xs px-3 py-1 rounded transition-colors bg-blue-600 text-white hover:bg-blue-700"
                                  >
                                    Accept Delivery
                                  </button>
                                )}
                              </div>
                              {order.storeDetails?.name && (
                                <div className="text-xs text-gray-500 mt-2">
                                  Store: {order.storeDetails.name}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                      {availableOrders.length > 3 && (
                        <div className="text-center">
                          <button 
                            className={`text-sm transition-colors ${isDeliveryFeatureLocked ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800'}`}
                            disabled={isDeliveryFeatureLocked}
                            title={isDeliveryFeatureLocked ? deliveryFeatureLockMessage : 'View all available orders'}
                          >
                            View all {availableOrders.length} orders
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* My Deliveries (Accepted Orders) */}
                  <div id="my-deliveries-section" className="bg-white rounded-lg shadow p-6 h-full flex flex-col">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">My Deliveries</h3>
                        <p className="text-xs text-gray-500 mt-1">Active & today's completed deliveries</p>
                      </div>
                      <span className="inline-flex w-max text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">{acceptedOrders.length}</span>
                    </div>
                    <div className="mt-4 space-y-4 flex-1">
                      {acceptedOrders.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2M9 5a2 2 0 012-2h2a2 2 0 012"/>
                          </svg>
                          <p>No accepted deliveries</p>
                          <p className="text-sm">Accept orders from the Available Orders section</p>
                        </div>
                      ) : (
                        acceptedOrders.slice(0, 5).map((order) => {
                          // Add safety checks for order properties
                          if (!order) return null;
                          
                          const orderId = order._id || order.id || '';
                          const orderNumber = order.orderNumber || (orderId ? orderId.slice(-6) : 'Unknown');
                          const totalItems = order.products && Array.isArray(order.products) 
                            ? order.products.reduce((sum, item) => sum + (item ? item.quantity || 0 : 0), 0) 
                            : 0;
                          const customerName = order.customerInfo?.name || 'Customer';
                          const city = order.deliveryAddress?.city || '';
                          const state = order.deliveryAddress?.state || '';
                          const totalAmount = order.totalAmount || 0;
                          const status = order.status || '';
                          const storeName = order.storeDetails?.name || 'Store';
                          
                          return (
                            <div key={orderId} className={`border rounded-lg p-4 ${recentlyAcceptedOrder === orderId ? 'bg-green-50 border-green-300 animate-pulse' : 'bg-gray-50'}`}>
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-semibold text-gray-900">#{orderNumber}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                      status === 'ready_for_delivery' ? 'bg-green-100 text-green-700' :
                                      status === 'out_for_delivery' ? 'bg-blue-100 text-blue-700' :
                                      status === 'delivered' ? 'bg-purple-100 text-purple-700' :
                                      status === 'assigned_pending_otp' ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-gray-100 text-gray-700'
                                    }`}>
                                      {status === 'ready_for_delivery' ? 'Ready for Delivery' :
                                       status === 'out_for_delivery' ? 'Out for Delivery' :
                                       status === 'delivered' ? 'Delivered ✓' :
                                       status === 'assigned_pending_otp' ? 'Assigned - Pending OTP' :
                                       status}
                                    </span>
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    {customerName} • {totalItems} items
                                  </div>
                                </div>
                              </div>
                              <div className="text-sm text-gray-600 mb-2">
                                {city}, {state}
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="text-sm font-semibold text-green-600">
                                  ₹{totalAmount}
                                  <div className="text-xs text-gray-500">Delivery Fee: ₹{order.deliveryFee || 0}</div>
                                </div>
                                {status === 'delivered' ? (
                                  <div className="text-xs px-3 py-1 rounded bg-purple-100 text-purple-700 font-medium">
                                    ✓ Completed
                                  </div>
                                ) : (
                                  <button 
                                    onClick={() => navigate(`/delivery/track/${orderId}`)}
                                    className={`text-xs px-3 py-1 rounded transition-colors ${isDeliveryFeatureLocked ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
                                    disabled={isDeliveryFeatureLocked}
                                  >
                                    Track Delivery
                                  </button>
                                )}
                              </div>
                              {storeName && (
                                <div className="text-xs text-gray-500 mt-2">
                                  Store: {storeName}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                      {acceptedOrders.length > 3 && (
                        <div className="text-center">
                          <button 
                            onClick={() => setActiveTab('deliveries')}
                            className={`text-sm transition-colors ${isDeliveryFeatureLocked ? 'text-gray-400 cursor-not-allowed' : 'text-green-600 hover:text-green-800'}`}
                            disabled={isDeliveryFeatureLocked}
                            title={isDeliveryFeatureLocked ? deliveryFeatureLockMessage : 'View all accepted deliveries'}
                          >
                            View all {acceptedOrders.length} deliveries
                          </button>
                        </div>
                      )}
                      </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* My Deliveries Tab */}
          {activeTab === "deliveries" && (
            <div className="max-w-4xl mx-auto px-6 pb-12">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-semibold">My Deliveries</h3>
                    <p className="text-sm text-gray-500 mt-1">Active deliveries & today's completed deliveries</p>
                  </div>
                  {!isDeliveryFeatureLocked && (
                    <button onClick={() => setActiveTab('dashboard')} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">
                      Back to Dashboard
                    </button>
                  )}
                </div>
                
                {acceptedOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012"/>
                    </svg>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">No deliveries assigned</h4>
                    <p className="text-gray-600 mb-4">You haven't accepted any deliveries yet.</p>
                    <button 
                      onClick={() => setActiveTab('dashboard')}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      View Available Orders
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {acceptedOrders.map((order) => {
                      // Add safety checks for order properties
                      if (!order) return null;
                      
                      const orderId = order._id || order.id || '';
                      const orderNumber = order.orderNumber || (orderId ? orderId.slice(-6) : 'Unknown');
                      const totalItems = order.products && Array.isArray(order.products) 
                        ? order.products.reduce((sum, item) => sum + (item ? item.quantity || 0 : 0), 0) 
                        : 0;
                      const customerName = order.customerInfo?.name || 'Customer';
                      const house = order.deliveryAddress?.house || '';
                      const street = order.deliveryAddress?.street || '';
                      const city = order.deliveryAddress?.city || '';
                      const state = order.deliveryAddress?.state || '';
                      const zipCode = order.deliveryAddress?.zipCode || '';
                      const totalAmount = order.totalAmount || 0;
                      const status = order.status || '';
                      const storeName = order.storeDetails?.name || 'Store';
                      
                      return (
                        <div key={orderId} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-semibold text-gray-900">#{orderNumber}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  status === 'ready_for_delivery' ? 'bg-green-100 text-green-700' :
                                  status === 'out_for_delivery' ? 'bg-blue-100 text-blue-700' :
                                  status === 'delivered' ? 'bg-purple-100 text-purple-700' :
                                  status === 'assigned_pending_otp' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {status === 'ready_for_delivery' ? 'Ready for Delivery' :
                                   status === 'out_for_delivery' ? 'Out for Delivery' :
                                   status === 'delivered' ? 'Delivered ✓' :
                                   status === 'assigned_pending_otp' ? 'Assigned - Pending OTP' :
                                   status}
                                </span>
                              </div>
                              <div className="text-sm text-gray-600">
                                {customerName} • {totalItems} items
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold text-green-600">
                                ₹{totalAmount}
                              </div>
                              <div className="text-xs text-gray-500">
                                Delivery Fee: ₹{order.deliveryFee || 0}
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                            <div>
                              <div className="text-xs text-gray-500">Delivery Address</div>
                              <div className="text-sm">
                                {house}, {street},<br />
                                {city}, {state} - {zipCode}
                              </div>
                              {order.deliveryAddress?.landmark && (
                                <div className="text-xs text-gray-500 mt-1">
                                  Landmark: {order.deliveryAddress.landmark}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">Store</div>
                              <div className="text-sm">{storeName}</div>
                              {order.storeDetails?.address && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {order.storeDetails.address}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex justify-end gap-2">
                            {status === 'delivered' ? (
                              <div className="px-3 py-1 text-sm rounded bg-purple-100 text-purple-700 font-medium">
                                ✓ Delivery Completed
                              </div>
                            ) : (
                              <>
                                <button 
                                  onClick={() => navigate(`/delivery/track/${orderId}`)}
                                  className={`px-3 py-1 text-sm rounded transition-colors ${isDeliveryFeatureLocked ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
                                  disabled={isDeliveryFeatureLocked}
                                >
                                  Track Delivery
                                </button>
                              </>
                            )}
                          </div>

                        </div>
                      );
                    })}
                  </div>
                  
                )}

              </div>
            </div>

        )}

        {/* Schedule Management */}
        {activeTab === "schedule" && (
          <div className="max-w-4xl mx-auto px-6 pb-12">
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold">7-Day Schedule Management</h3>
                <button onClick={() => setActiveTab('dashboard')} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">
                  Back to Dashboard
                </button>
              </div>
              
              {/* Schedule Summary */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="text-lg font-medium mb-4">Schedule Summary</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{scheduleItems.length}</div>
                    <div className="text-sm text-gray-600">Total Schedules</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {scheduleItems.filter(s => s.date === new Date().toISOString().split('T')[0]).length}
                    </div>
                    <div className="text-sm text-gray-600">Today's Schedules</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {scheduleItems.filter(s => s.status === 'cancelled').length}
                    </div>
                    <div className="text-sm text-gray-600">Cancelled Schedules</div>
                  </div>
                </div>
              </div>

              {/* Add Schedule Form */}
              <div className="border rounded-lg p-4 mb-6">
                <h4 className="text-lg font-medium mb-4">Add New Schedule</h4>
                <form onSubmit={addSchedule} className="grid md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Date</label>
                    <select 
                      name="date" 
                      value={scheduleForm.date} 
                      onChange={onScheduleChange} 
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" 
                      required
                    >
                      <option value="">Choose a date</option>
                      {Array.from({length: 7}, (_, i) => {
                        const date = new Date();
                        date.setDate(date.getDate() + i);
                        const dayName = i === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'long' });
                        const dateStr = date.toISOString().split('T')[0];
                        const displayDate = `${dayName} - ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                        return (
                          <option key={dateStr} value={dateStr}>{displayDate}</option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                    <input 
                      type="time" 
                      name="start" 
                      value={scheduleForm.start} 
                      onChange={onScheduleChange} 
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" 
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                    <input 
                      type="time" 
                      name="end" 
                      value={scheduleForm.end} 
                      onChange={onScheduleChange} 
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" 
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
                    <input 
                      name="note" 
                      value={scheduleForm.note} 
                      onChange={onScheduleChange} 
                      placeholder="Optional note" 
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" 
                    />
                  </div>
                  <div className="md:col-span-4 flex justify-start">
                    <button 
                      type="submit" 
                      className="px-6 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
                    >
                      Add Schedule
                    </button>
                  </div>
                </form>
                
                {scheduleMsg && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
                    {scheduleMsg}
                  </div>
                )}
              </div>
            </div>

              {/* 7-Day Schedule View with Delivery Status */}
              <div>
                <h4 className="text-lg font-medium mb-4">7-Day Schedule View</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {Array.from({length: 7}, (_, i) => {
                    const date = new Date();
                    date.setDate(date.getDate() + i);
                    const dateStr = date.toISOString().split('T')[0];
                    // Add safety check for scheduleItems
                    const daySchedules = Array.isArray(scheduleItems) 
                      ? scheduleItems.filter(s => s && s.date === dateStr)
                      : [];
                    const isToday = i === 0;
                    
                    // Check if there's an active schedule for this day
                    const isActiveDay = daySchedules.some(schedule => {
                      if (!schedule) return false;
                      const startTime = schedule.start || '';
                      const endTime = schedule.end || '';
                      
                      // For today, check if we're currently in the scheduled time
                      if (isToday) {
                        const now = new Date();
                        const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
                        
                        const startParts = startTime.split(':');
                        const endParts = endTime.split(':');
                        
                        if (startParts.length >= 2 && endParts.length >= 2) {
                          const startHour = parseInt(startParts[0], 10);
                          const startMinute = parseInt(startParts[1], 10);
                          const endHour = parseInt(endParts[0], 10);
                          const endMinute = parseInt(endParts[1], 10);
                          
                          if (!isNaN(startHour) && !isNaN(startMinute) && !isNaN(endHour) && !isNaN(endMinute)) {
                            const startTotal = startHour * 60 + startMinute;
                            const endTotal = endHour * 60 + endMinute;
                            return minutesSinceMidnight >= startTotal && minutesSinceMidnight <= endTotal;
                          }
                        }
                      }
                      
                      return true; // For future days, just show that there's a schedule
                    });
                    
                    return (
                      <div key={dateStr} className={`border rounded-lg p-4 ${
                        isToday ? 'border-green-500 bg-green-50' : 'border-gray-200'
                      }`}>
                        <div className="text-center mb-3">
                          <div className={`text-xs font-medium ${
                            isToday ? 'text-green-600' : 'text-gray-500'
                          }`}>
                            {isToday ? 'TODAY' : date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                          </div>
                          <div className={`text-lg font-bold ${
                            isToday ? 'text-green-600' : 'text-gray-900'
                          }`}>
                            {date.getDate()}
                          </div>
                          <div className={`text-xs ${
                            isToday ? 'text-green-600' : 'text-gray-500'
                          }`}>
                            {date.toLocaleDateString('en-US', { month: 'short' })}
                          </div>
                          {isToday && (
                            <div className="text-xs text-green-600 font-medium mt-1">Current Day</div>
                          )}
                        </div>
                        
                        {/* Delivery Status for the day */}
                        <div className="mb-3">
                          {daySchedules.length === 0 ? (
                            <div className="text-center py-2 bg-red-50 rounded text-red-700 text-sm">
                              No Schedule
                            </div>
                          ) : isActiveDay ? (
                            <div className="text-center py-2 bg-green-100 rounded text-green-700 text-sm font-medium">
                              Scheduled
                            </div>
                          ) : (
                            <div className="text-center py-2 bg-yellow-50 rounded text-yellow-700 text-sm">
                              Scheduled (Not Active)
                            </div>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          {daySchedules.length === 0 ? (
                            <div className="text-center py-4">
                              <div className="text-sm text-gray-500 mb-2">No schedules</div>
                              <button
                                onClick={() => setScheduleForm(prev => ({ ...prev, date: dateStr }))}
                                className="text-xs px-2 py-1 rounded bg-green-100 text-green-600 hover:bg-green-200"
                              >
                                + Add Schedule
                              </button>
                            </div>
                          ) : (
                            daySchedules.map((schedule) => {
                              // Add safety checks for schedule properties
                              if (!schedule) return null;
                              
                              const scheduleId = schedule._id || schedule.id || `${schedule.date}-${schedule.start}`;
                              const startTime = schedule.start || '';
                              const endTime = schedule.end || '';
                              const note = schedule.note || '';
                              
                              return (
                                <div key={scheduleId} className="bg-white rounded p-2 text-sm border">
                                  <div className="font-medium">
                                    {startTime} - {endTime}
                                  </div>
                                  {note && (
                                    <div className="text-gray-600 text-xs mt-1">{note}</div>
                                  )}
                                  <button
                                    onClick={() => removeSchedule(scheduleId)}
                                    className="text-xs mt-1 text-red-600 hover:text-red-800"
                                  >
                                    Remove
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
  
        )}

        {/* Earnings Tab */}
        {activeTab === "earnings" && (
          <div className="max-w-6xl mx-auto px-6 pb-12">
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold">Earnings & Wallet</h3>
                <button onClick={() => setActiveTab("dashboard")} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">
                  Back to Dashboard
                </button>
              </div>
                
              

               

              

              {/* Day-by-Day Earnings Breakdown */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold mb-4">Delivery History & Earnings</h4>
                
                {loadingEarnings ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
                    <p className="text-gray-500">Loading earnings data...</p>
                  </div>
                ) : earningsData.earningsByDate.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">No earnings yet</h4>
                    <p className="text-gray-600">Complete deliveries to start earning</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {earningsData.earningsByDate.map((dayData) => {
                      const date = new Date(dayData.date);
                      const isToday = dayData.date === new Date().toISOString().split('T')[0];
                      
                      return (
                        <div key={dayData.date} className={`border rounded-lg overflow-hidden ${
                          isToday ? 'border-green-500 shadow-md' : 'border-gray-200'
                        }`}>
                          {/* Day Header */}
                          <div className={`p-4 ${
                            isToday ? 'bg-green-50' : 'bg-gray-50'
                          } flex items-center justify-between`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                isToday ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-700'
                              } font-bold`}>
                                {date.getDate()}
                              </div>
                              <div>
                                <div className={`text-sm font-semibold ${
                                  isToday ? 'text-green-800' : 'text-gray-900'
                                }`}>
                                  {isToday ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'long' })}
                                </div>
                                <div className={`text-xs ${
                                  isToday ? 'text-green-600' : 'text-gray-600'
                                }`}>
                                  {date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`text-2xl font-bold ${
                                isToday ? 'text-green-800' : 'text-gray-900'
                              }`}>
                                ₹{dayData.totalEarnings.toFixed(2)}
                              </div>
                              <div className={`text-xs ${
                                isToday ? 'text-green-600' : 'text-gray-600'
                              }`}>
                                {dayData.deliveryCount} {dayData.deliveryCount === 1 ? 'delivery' : 'deliveries'}
                              </div>
                            </div>
                          </div>
                          
                          {/* Deliveries List */}
                          <div className="divide-y divide-gray-100">
                            {dayData.deliveries.map((delivery) => (
                              <div key={delivery._id} className="p-4 hover:bg-gray-50 transition-colors">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-sm font-semibold text-gray-900">
                                        #{delivery.orderNumber}
                                      </span>
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                        Delivered
                                      </span>
                                    </div>
                                    <div className="text-sm text-gray-600 mb-1">
                                      {delivery.customerInfo.name}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {delivery.deliveryAddress?.city}, {delivery.deliveryAddress?.state}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">
                                      {new Date(delivery.deliveryCompletedAt || delivery.timestamp).toLocaleTimeString('en-US', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-sm font-semibold text-green-600">
                                      +₹{delivery.deliveryFee.toFixed(2)}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      Order: ₹{delivery.totalAmount.toFixed(2)}
                                    </div>
                                    <button
                                      onClick={() => navigate(`/delivery/track/${delivery._id}`)}
                                      className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                                    >
                                      View Details →
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Earnings Modal with Withdrawal */}
    {showEarningsModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          {/* Modal Header */}
          <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Earnings & Withdrawal</h2>
            <button
              onClick={() => {
                setShowEarningsModal(false);
                setShowWithdrawalForm(false);
                setWithdrawalMsg('');
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm text-blue-600 font-medium">Total Earnings</div>
                <div className="text-2xl font-bold text-blue-900 mt-1">₹{stats.totalEarnings.toFixed(2)}</div>
                <div className="text-xs text-blue-600 mt-1">{stats.totalDeliveries} deliveries</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-green-600 font-medium">Wallet Balance</div>
                <div className="text-2xl font-bold text-green-900 mt-1">₹{walletData.availableBalance?.toFixed(2) || Math.max(0, walletData.totalEarnings - walletData.totalWithdrawn).toFixed(2)}</div>
                <div className="text-xs text-green-600 mt-1">
                  {walletData.totalWithdrawn === 0 
                    ? 'No withdrawals yet' 
                    : `₹${walletData.totalWithdrawn.toFixed(2)} withdrawn`
                  }
                </div>
              </div>
             
            </div>

            {/* Auto-refresh Settings */}
            <div className="mb-6 bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-blue-700">Auto-refresh Settings</h3>
                  <p className="text-xs text-blue-600">Automatically update wallet data every 30 seconds</p>
                </div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={autoRefreshEnabled}
                    onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-blue-700">Enable</span>
                </label>
              </div>
            </div>

            {/* Calculation Breakdown */}
            <div className="mb-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Balance Calculation</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Total Earnings:</span>
                  <span className="font-semibold text-blue-600">₹{stats.totalEarnings.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Total Withdrawn:</span>
                  <span className="font-semibold text-red-600">
                    -₹{walletData.totalWithdrawn.toFixed(2)}
                  </span>
                </div>
                <div className="border-t pt-2 flex items-center justify-between">
                  <span className="font-semibold text-gray-900">Available Balance:</span>
                  <span className="font-bold text-green-600 text-lg">₹{walletData.availableBalance?.toFixed(2) || Math.max(0, stats.totalEarnings - walletData.totalWithdrawn).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Withdrawal Message */}
            {withdrawalMsg && (
              <div className={`mb-4 p-4 rounded-lg ${
                withdrawalMsg.includes('success') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {withdrawalMsg}
              </div>
            )}

            {/* Withdrawal Button */}
            {!showWithdrawalForm && (
              <div className="mb-6">
                <button
                  onClick={() => setShowWithdrawalForm(true)}
                  disabled={(walletData.availableBalance || Math.max(0, walletData.totalEarnings - walletData.totalWithdrawn)) < 500}
                  className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
                >
                  {(walletData.availableBalance || Math.max(0, walletData.totalEarnings - walletData.totalWithdrawn)) < 500 ? 'Minimum ₹500 required for withdrawal' : 'Request Withdrawal'}
                </button>
                {(walletData.availableBalance || Math.max(0, walletData.totalEarnings - walletData.totalWithdrawn)) < 500 && (walletData.availableBalance || Math.max(0, walletData.totalEarnings - walletData.totalWithdrawn)) > 0 && (
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    You need ₹{(500 - (walletData.availableBalance || Math.max(0, walletData.totalEarnings - walletData.totalWithdrawn))).toFixed(2)} more to make a withdrawal
                  </p>
                )}
              </div>
            )}

            {/* Withdrawal Form */}
            {showWithdrawalForm && (
              <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-4">Withdrawal Request</h3>
                
                <p className="text-sm text-gray-600 mb-4">
                  Enter the amount you wish to withdraw. Admin will process your request and contact you for payment details.
                </p>
                
                {/* Amount Input */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                    <input
                      type="number"
                      value={withdrawalAmount}
                      onChange={(e) => setWithdrawalAmount(e.target.value)}
                      className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Enter amount (Min: 100)"
                      min="100"
                      max={walletData.availableBalance || Math.max(0, walletData.totalEarnings - walletData.totalWithdrawn)}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Available: ₹{(walletData.availableBalance || Math.max(0, walletData.totalEarnings - walletData.totalWithdrawn)).toFixed(2)}</p>
                </div>

                {/* Form Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowWithdrawalForm(false);
                      setWithdrawalMsg('');
                      setWithdrawalAmount('');
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitWithdrawal}
                    disabled={loadingWithdrawal}
                    className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {loadingWithdrawal ? 'Processing...' : 'Submit Request'}
                  </button>
                </div>
              </div>
            )}

            {/* Withdrawal History */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">Withdrawal History</h3>
                {withdrawalHistory.length > 0 && (
                  <span className="text-xs text-gray-500">
                    {withdrawalHistory.length} {withdrawalHistory.length === 1 ? 'request' : 'requests'}
                  </span>
                )}
              </div>
              
              {withdrawalHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <p className="font-medium mb-1">No withdrawal history yet</p>
                  <p className="text-xs">Your withdrawal requests will appear here</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {withdrawalHistory.map((withdrawal) => (
                    <div key={withdrawal._id} className={`border rounded-lg p-4 ${
                      withdrawal.status === 'completed' ? 'bg-green-50 border-green-200' :
                      withdrawal.status === 'pending' ? 'bg-yellow-50 border-yellow-200' :
                      withdrawal.status === 'processing' ? 'bg-blue-50 border-blue-200' :
                      withdrawal.status === 'rejected' ? 'bg-red-50 border-red-200' :
                      'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg font-bold text-gray-900">₹{withdrawal.amount.toFixed(2)}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              withdrawal.status === 'completed' ? 'bg-green-200 text-green-800' :
                              withdrawal.status === 'pending' ? 'bg-yellow-200 text-yellow-800' :
                              withdrawal.status === 'processing' ? 'bg-blue-200 text-blue-800' :
                              withdrawal.status === 'rejected' ? 'bg-red-200 text-red-800' :
                              'bg-gray-200 text-gray-800'
                            }`}>
                              {withdrawal.status === 'completed' ? '✓ Completed' :
                               withdrawal.status === 'pending' ? '⏳ Pending' :
                               withdrawal.status === 'processing' ? '⚡ Processing' :
                               withdrawal.status === 'rejected' ? '✗ Rejected' :
                               withdrawal.status.charAt(0).toUpperCase() + withdrawal.status.slice(1)}
                            </span>
                          </div>
                          <div className="text-xs text-gray-700 mb-2">
                            <div>
                              <span className="text-gray-500">Status:</span>{' '}
                              <span className="font-medium">
                                {withdrawal.status === 'pending' ? '⏳ Pending Admin Processing' :
                                 withdrawal.status === 'processing' ? '⚡ Being Processed' :
                                 withdrawal.status === 'completed' ? '✓ Transfer Completed' :
                                 withdrawal.status === 'rejected' ? '✗ Rejected' :
                                 withdrawal.status}
                              </span>
                            </div>
                          </div>
                          <div className="text-xs text-gray-600 space-y-1">
                            <div>
                              <span className="text-gray-500">Requested:</span>{' '}
                              {new Date(withdrawal.requestedAt).toLocaleString('en-US', {
                                dateStyle: 'medium',
                                timeStyle: 'short'
                              })}
                            </div>
                            {withdrawal.status === 'completed' && withdrawal.completedAt && (
                              <div className="text-green-700">
                                <span className="text-gray-500">Completed:</span>{' '}
                                {new Date(withdrawal.completedAt).toLocaleString('en-US', {
                                  dateStyle: 'medium',
                                  timeStyle: 'short'
                                })}
                              </div>
                            )}
                            {withdrawal.status === 'processing' && withdrawal.processedAt && (
                              <div className="text-blue-700">
                                <span className="text-gray-500">Processing since:</span>{' '}
                                {new Date(withdrawal.processedAt).toLocaleString('en-US', {
                                  dateStyle: 'medium',
                                  timeStyle: 'short'
                                })}
                              </div>
                            )}
                          </div>
                          {withdrawal.transactionId && (
                            <div className="text-xs text-gray-600 mt-2 bg-white rounded px-2 py-1">
                              <span className="text-gray-500">Transaction ID:</span>{' '}
                              <span className="font-mono font-medium">{withdrawal.transactionId}</span>
                            </div>
                          )}
                          {withdrawal.rejectedReason && (
                            <div className="text-xs text-red-700 mt-2 bg-red-100 rounded px-2 py-1">
                              <span className="font-semibold">Rejection Reason:</span> {withdrawal.rejectedReason}
                            </div>
                          )}
                          {withdrawal.adminNotes && (
                            <div className="text-xs text-gray-600 mt-2 bg-white rounded px-2 py-1">
                              <span className="font-semibold">Admin Notes:</span> {withdrawal.adminNotes}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500 mb-1">Reference</div>
                          <div className="text-xs font-mono font-semibold text-gray-700 bg-white rounded px-2 py-1">
                            {withdrawal.reference}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )}
  </DeliveryVerificationGuard>
);

}