import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import EmailVerification from "../components/EmailVerification";

export default function SellerStoreSettings() {
  const navigate = useNavigate();
  const { currentUser, getUserProfile } = useAuth();
  const profile = getUserProfile();

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Email Verification Banner for Sellers */}
      {profile?.role === "seller" && profile?.provider === "email" && !currentUser?.emailVerified && (
        <div className="mb-6">
          <EmailVerification />
        </div>
      )}
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Store Settings</h1>
          <p className="text-sm text-gray-600">Manage your store configurations and preferences.</p>
        </div>
        <div className="flex gap-2">
          <button
            className="px-4 py-2 rounded border hover:bg-gray-50"
            onClick={() => navigate("/seller")}
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      {/* Sections */}
      <div className="grid grid-cols-1 gap-6">
        {/* Working Hours */}
        <div className="bg-white border rounded-lg p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold">Working Hours</h2>
              <p className="text-sm text-gray-600 mt-1">
                Configure weekly schedule and special date-based overrides for your store.
              </p>
            </div>
            <button
              className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
              onClick={() => navigate("/seller?tab=hours")}
            >
              Go to 7-Day Store Hours Management
            </button>
          </div>
        </div>
        
        {/* Order History */}
        <div className="bg-white border rounded-lg p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold">Order History</h2>
              <p className="text-sm text-gray-600 mt-1">
                View all past orders for your store, including delivered and cancelled orders.
              </p>
            </div>
            <button
              className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
              onClick={() => navigate("/seller/order-history")}
            >
              View Order History
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}