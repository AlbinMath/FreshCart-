import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// Helper: build headers with token or dev identity headers
function buildAdminHeaders(profile) {
  const headers = { 'Accept': 'application/json' };
  const token = localStorage.getItem('token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  else if (profile) {
    if (profile.uid) headers['x-actor-uid'] = profile.uid;
    if (profile.email) headers['x-actor-email'] = String(profile.email).toLowerCase();
  }
  return headers;
}

export default function AdminSellerLicense() {
  const { sellerId } = useParams();
  const navigate = useNavigate();
  const { getUserProfile } = useAuth();
  const profile = getUserProfile();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seller, setSeller] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').trim().replace(/\/+$/, '');
  const BASE_ORIGIN = API_BASE_URL.replace(/\/+api$/, '');

  useEffect(() => {
    if (!profile || profile.role !== 'admin') {
      navigate('/');
      return;
    }
    loadSeller();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerId]);

  async function loadSeller() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/admin/licenses/seller/${sellerId}`, {
        headers: buildAdminHeaders(profile)
      });
      if (!res.ok) throw new Error('Failed to load seller license');
      const data = await res.json();
      setSeller(data.seller);
    } catch (e) {
      console.error(e);
      alert(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function verify(status) {
    try {
      setSaving(true);
      const body = status === 'rejected' ? { status, rejectionReason: rejectReason.trim() } : { status };
      const endpoint = status === 'approved'
        ? `${API_BASE_URL}/admin/sellers/${sellerId}/approve`
        : `${API_BASE_URL}/admin/sellers/${sellerId}/reject`;
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...buildAdminHeaders(profile) },
        body: status === 'approved' ? undefined : JSON.stringify({ reason: body.rejectionReason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `Failed to ${status}`);
      // Refresh seller license info view
      await loadSeller();
      if (status === 'approved') {
        setRejectReason('');
      }
      alert(`License ${status} successfully`);
    } catch (e) {
      console.error(e);
      alert(e.message || 'Action failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading license...</div>
      </div>
    );
  }

  if (!seller) {
    return (
      <div className="p-6">
        <div className="mb-4">
          <Link to="/admin" className="text-sm text-blue-600 hover:underline">← Back to Admin</Link>
        </div>
        <div className="text-red-600">Seller not found</div>
      </div>
    );
  }

  const info = seller.licenseInfo || {};
  const hasImage = Boolean(info?.file?.url);
  // Build absolute URL for image if backend sent a relative path like /uploads/licenses/xxx.jpg
  const imageUrl = hasImage && /^https?:\/\//i.test(info.file.url) ? info.file.url : `${BASE_ORIGIN}${info.file?.url || ''}`;
  const status = info?.status || seller.verificationStatus || 'pending';

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Seller License Review</h1>
            <p className="text-sm text-gray-500">{seller.name} · {seller.email}</p>
          </div>
          <Link to="/admin" className="px-4 py-2 border rounded-md text-sm">Back to Admin</Link>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-sm text-gray-500">License Number</div>
              <div className="text-lg font-medium">{info.licenseNumber || seller.licenseNumber || 'Not provided'}</div>
            </div>
            <div>
              {status === 'approved' && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Completed Verification</span>
              )}
              {status === 'pending' && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Pending Review</span>
              )}
              {status === 'rejected' && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Rejected</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm font-medium mb-2">Uploaded License Photo</div>
              {hasImage ? (
                <a href={imageUrl} target="_blank" rel="noreferrer" className="block border rounded-md overflow-hidden">
                  <img src={imageUrl} alt="License" className="w-full object-contain max-h-96 bg-gray-50" />
                </a>
              ) : (
                <div className="border rounded-md p-6 text-center text-gray-500">No license image uploaded</div>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-500">Expiry Date</div>
                <div className="text-sm">{info.expiryDate ? new Date(info.expiryDate).toLocaleDateString() : '—'}</div>
              </div>
              {status !== 'approved' && (
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <button
                      disabled={saving || !hasImage}
                      onClick={() => verify('approved')}
                      className={`px-4 py-2 rounded-md text-white text-sm ${hasImage ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300 cursor-not-allowed'}`}
                      title={hasImage ? '' : 'No license image to approve'}
                    >
                      Approve
                    </button>
                    <button
                      disabled={saving}
                      onClick={() => verify('rejected')}
                      className="px-4 py-2 rounded-md text-white text-sm bg-red-600 hover:bg-red-700"
                    >
                      Reject
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Rejection Reason</label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Reason for rejection (required when rejecting)"
                      className="w-full border rounded-md p-2 text-sm"
                      rows={4}
                    />
                  </div>
                </div>
              )}
              {status === 'rejected' && info.rejectionReason && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
                  <div className="font-medium mb-1">Previous rejection reason</div>
                  <div>{info.rejectionReason}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



