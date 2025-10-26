import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function SellerNotifications() {
  const { currentUser, getUserProfile, listNotifications, markNotificationRead, markAllNotificationsRead, actOnBranchLinkRequest, clearNotifications, deleteNotification } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const profile = useMemo(() => getUserProfile() || {}, [getUserProfile]);

  async function load() {
    if (!currentUser) return;
    try {
      setLoading(true);
      const data = await listNotifications();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!currentUser) return;
    if (!profile || !["store", "seller"].includes(profile.role)) return;
    load();
    // Optional polling every 30s
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [currentUser]);

  async function handleMarkRead(id) {
    try {
      await markNotificationRead(id);
      setItems(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
    } catch (e) {
      alert(e?.message || "Failed to mark as read");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <div className="text-xs text-gray-600">{profile.storeName || profile.displayName || "Seller"}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate('/seller')} className="px-3 py-1.5 bg-gray-700 text-white text-sm rounded hover:bg-gray-800">Back to Dashboard</button>
            <button onClick={load} className="px-3 py-1.5 bg-white border text-sm rounded hover:bg-gray-50">Refresh</button>
            <button
              onClick={async () => { try { await clearNotifications(false); await load(); } catch (e) { alert(e?.message || 'Failed to clear'); } }}
              className="px-3 py-1.5 bg-white border text-sm rounded hover:bg-gray-50"
              title="Delete all notifications"
            >Clear All</button>
          </div>
        </div>

        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

        <div className="bg-white rounded-lg shadow divide-y">
          {loading && <div className="p-4 text-sm text-gray-500">Loading...</div>}
          {!loading && items.length === 0 && <div className="p-4 text-sm text-gray-500">No notifications</div>}
          {items.map(n => (
            <div key={n._id} className={`p-4 flex items-start gap-3 ${n.read ? 'bg-white' : 'bg-green-50'}`}>
              <div className={`w-2 h-2 rounded-full mt-2 ${n.read ? 'bg-gray-300' : 'bg-green-600'}`} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium">{n.title || 'Notification'}</div>
                  {n.type && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700">{n.type}</span>}
                </div>
                <div className="text-xs text-gray-600 mt-0.5">{n.message}</div>
                {n.data && (n.data.branchName || n.data.from) && (
                  <div className="text-xs text-gray-500 mt-1">
                    {n.data.from && <span className="mr-2">From: {n.data.from}</span>}
                    {n.data.branchName && <span className="mr-2">Branch: {n.data.branchName}</span>}
                    {n.data.branchAddress && <span>Address: {n.data.branchAddress}</span>}
                  </div>
                )}
                {/* Actions for pending branch-link-request on target seller */}
                {n.type === 'branch-link-request' && n.data?.requestId && (!n.data?.status || n.data?.status === 'pending') && (
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={async () => {
                        try {
                          await actOnBranchLinkRequest(n.data.requestId, 'accept');
                          // Backend deletes related seller notifications; refresh list
                          await load();
                        } catch (e) {
                          alert(e?.message || 'Failed to accept request');
                        }
                      }}
                      className="px-3 py-1.5 rounded bg-green-600 text-white text-xs hover:bg-green-700"
                    >Accept</button>
                    <button
                      onClick={async () => {
                        try {
                          await actOnBranchLinkRequest(n.data.requestId, 'deny');
                          // Backend deletes related seller notifications; refresh list
                          await load();
                        } catch (e) {
                          alert(e?.message || 'Failed to deny request');
                        }
                      }}
                      className="px-3 py-1.5 rounded bg-red-600 text-white text-xs hover:bg-red-700"
                    >Deny</button>
                  </div>
                )}
                {/* Status display when already processed */}
                {n.type === 'branch-link-request' && n.data?.status && n.data.status !== 'pending' && (
                  <div className="mt-2 text-xs text-gray-600">
                    Status: <span className={n.data.status === 'accepted' ? 'text-green-700' : 'text-red-700'}>{n.data.status}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="text-[11px] text-gray-500">{new Date(n.createdAt).toLocaleString()}</div>
                {!n.read && (
                  <button onClick={() => handleMarkRead(n._id)} className="px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700">Mark read</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}