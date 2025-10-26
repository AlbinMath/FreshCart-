import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { validateProfileData, sanitizeInput } from "../../../backend/utils/validation";

export default function ProfileSettings() {
  const { currentUser, getUserProfile, fetchUserProfile, updateUserProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", profilePicture: "" });

  useEffect(() => {
    if (!currentUser) { navigate('/login'); return; }
    
    // Check if user is admin - admins cannot edit profiles
    const profile = getUserProfile();
    if (profile?.role === 'admin') {
      navigate('/admin', { replace: true });
      return;
    }
    
    (async () => {
      const backend = await fetchUserProfile();
      const local = getUserProfile();
      const src = backend || local || {};
      setForm({
        name: src.name || src.displayName || "",
        phone: src.phone || "",
        profilePicture: src.profilePicture || "",
      });
    })();
  }, [currentUser, navigate, getUserProfile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const sanitized = Object.fromEntries(Object.entries(form).map(([k,v]) => [k, sanitizeInput(v)]));
    const role = (getUserProfile()?.role) || 'customer';
    const errs = validateProfileData(sanitized, role);
    if (errs.length) { setMessage(errs.join(', ')); setLoading(false); return; }
    try {
      await updateUserProfile(sanitized);
      setMessage('Profile updated successfully');
    } catch (e1) {
      setMessage(e1.message || 'Failed to update');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto bg-white rounded-xl shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Profile Settings</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input name="name" value={form.name} onChange={handleChange} className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input name="phone" value={form.phone} onChange={handleChange} className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Profile Picture URL</label>
            <input name="profilePicture" value={form.profilePicture} onChange={handleChange} placeholder="https://.../photo.jpg" className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            <p className="mt-1 text-xs text-gray-500">Use a direct image URL (jpg, jpeg, png, gif, webp). Admins don't need verification for this.</p>
          </div>
          
          {/* License Upload Link for Sellers */}
          {getUserProfile()?.role === 'seller' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-blue-900">Business License Document</h4>
                  <p className="text-xs text-blue-700 mt-1">Upload your business license for verification</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/seller/license-upload')}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                  </svg>
                  Upload License
                </button>
              </div>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 border rounded-lg">Back</button>
            <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-green-600 text-white disabled:bg-green-400">{loading ? 'Saving...' : 'Save'}</button>
          </div>
          {message && <div className="text-sm mt-2 {message.includes('success') ? 'text-green-600' : 'text-red-600'}">{message}</div>}
        </form>
      </div>
    </div>
  );
}