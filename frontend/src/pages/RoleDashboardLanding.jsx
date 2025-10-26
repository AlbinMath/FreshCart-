import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function RoleDashboardLanding() {
  const { currentUser, getUserProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
      return;
    }
    
    const userProfile = getUserProfile();
    setProfile(userProfile);
    setLoading(false);
    
    // Auto-redirect if user has a specific role
    if (userProfile?.role) {
      const redirectPaths = {
        admin: "/admin/dashboard",
        seller: "/seller/dashboard", 
        store: "/seller/dashboard",
        delivery: "/delivery/dashboard"
      };
      
      // Optional: Auto-redirect after 3 seconds
      // setTimeout(() => {
      //   if (redirectPaths[userProfile.role]) {
      //     navigate(redirectPaths[userProfile.role]);
      //   }
      // }, 3000);
    }
  }, [currentUser, navigate, getUserProfile]);

  const dashboardOptions = [
    {
      role: "admin",
      title: "Admin Dashboard",
      description: "Manage users, monitor system, handle reports and oversee platform operations",
      icon: (
        <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
        </svg>
      ),
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      textColor: "text-blue-900",
      buttonColor: "bg-blue-600 hover:bg-blue-700",
      features: ["User Management", "System Analytics", "Platform Monitoring", "Reports & Insights"],
      path: "/admin/dashboard"
    },
    {
      role: "seller",
      title: "Seller Dashboard", 
      description: "Manage your store, products, orders and track business performance",
      icon: (
        <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
        </svg>
      ),
      bgColor: "bg-green-50",
      borderColor: "border-green-200", 
      textColor: "text-green-900",
      buttonColor: "bg-green-600 hover:bg-green-700",
      features: ["Product Catalog", "Order Processing", "Inventory Management", "Sales Analytics"],
      path: "/seller/dashboard"
    },
    {
      role: "delivery",
      title: "Delivery Agent Dashboard",
      description: "Manage deliveries, track routes, update schedules and monitor earnings",
      icon: (
        <svg className="w-12 h-12 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      ),
      bgColor: "bg-orange-50",
      borderColor: "border-orange-200",
      textColor: "text-orange-900", 
      buttonColor: "bg-orange-600 hover:bg-orange-700",
      features: ["Active Deliveries", "Route Planning", "Schedule Management", "Earnings Tracker"],
      path: "/delivery/dashboard"
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const userRole = profile?.role;
  const availableDashboards = userRole ? 
    dashboardOptions.filter(option => option.role === userRole || userRole === 'admin') :
    dashboardOptions;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">
                FC
              </div>
              <div>
                <h1 className="text-xl font-bold text-green-700">FreshCart</h1>
                <p className="text-sm text-gray-600">Choose Your Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                Welcome, <span className="font-medium">{profile?.displayName || profile?.email || 'User'}</span>
              </span>
              <button 
                onClick={async () => { await logout(); navigate('/login'); }}
                className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg border border-red-200"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            {userRole ? `${userRole.charAt(0).toUpperCase() + userRole.slice(1)} Dashboard` : 'Select Dashboard'}
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {userRole ? 
              `Access your ${userRole} dashboard to manage your activities and monitor performance.` :
              'Choose the appropriate dashboard based on your role in the FreshCart platform.'
            }
          </p>
          {profile?.role && (
            <div className="mt-4 inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Current Role: {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
            </div>
          )}
        </div>

        {/* Dashboard Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {availableDashboards.map((dashboard) => (
            <div
              key={dashboard.role}
              className={`${dashboard.bgColor} ${dashboard.borderColor} border-2 rounded-xl p-8 hover:shadow-lg transition-all duration-200 ${
                userRole === dashboard.role ? 'ring-2 ring-offset-2 ring-green-500' : ''
              }`}
            >
              <div className="text-center mb-6">
                <div className="flex justify-center mb-4">
                  {dashboard.icon}
                </div>
                <h3 className={`text-2xl font-bold ${dashboard.textColor} mb-2`}>
                  {dashboard.title}
                </h3>
                <p className="text-gray-600">
                  {dashboard.description}
                </p>
              </div>

              <div className="space-y-3 mb-8">
                <h4 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
                  Key Features
                </h4>
                <ul className="space-y-2">
                  {dashboard.features.map((feature, index) => (
                    <li key={index} className="flex items-center text-sm text-gray-700">
                      <svg className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => navigate(dashboard.path)}
                className={`w-full py-3 px-6 rounded-lg text-white font-medium transition-colors ${dashboard.buttonColor} ${
                  userRole === dashboard.role ? 'ring-2 ring-offset-2 ring-green-300' : ''
                }`}
              >
                {userRole === dashboard.role ? 'Go to My Dashboard' : `Access ${dashboard.title}`}
              </button>

              {userRole === dashboard.role && (
                <div className="mt-3 text-center">
                  <span className="text-xs text-green-600 font-medium">
                    ✓ This is your assigned dashboard
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        {userRole && (
          <div className="mt-16 bg-white rounded-xl shadow-sm border p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">Quick Actions</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <button 
                onClick={() => navigate('/settings')}
                className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 00-.734 2.165c.94 1.543-.827 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37.46-.756.12-1.742-.734-2.164-1.64-.82-1.64-3.124 0-3.943a1.724 1.724 0 00.734-2.165c-.94-1.543.827-3.31 2.37-2.37.94.573 2.147.02 2.573-1.065z"/>
                </svg>
                <div className="text-left">
                  <div className="font-medium">Profile Settings</div>
                  <div className="text-sm text-gray-600">Update your profile</div>
                </div>
              </button>
              
              <button 
                onClick={() => navigate('/help')}
                className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <div className="text-left">
                  <div className="font-medium">Help & Support</div>
                  <div className="text-sm text-gray-600">Get assistance</div>
                </div>
              </button>
              
              <button 
                onClick={() => navigate('/notifications')}
                className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                </svg>
                <div className="text-left">
                  <div className="font-medium">Notifications</div>
                  <div className="text-sm text-gray-600">View updates</div>
                </div>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center text-gray-600">
            <p>&copy; 2024 FreshCart. All rights reserved.</p>
            <p className="text-sm mt-2">Smart Fresh Product Delivery System</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
