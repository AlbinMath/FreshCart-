import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function ChangePassword() {
  const { currentUser, changePassword, getUserProfile } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { 
    if (!currentUser) {
      navigate('/login');
      return;
    }
    
    // Check if user is admin - admins cannot change passwords
    const profile = getUserProfile();
    if (profile?.role === 'admin') {
      navigate('/admin', { replace: true });
      return;
    }
  }, [currentUser, navigate, getUserProfile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) { setMsg('All fields are required'); return; }
    if (form.newPassword !== form.confirmPassword) { setMsg('Passwords do not match'); return; }
    setLoading(true);
    try {
      await changePassword(form.currentPassword, form.newPassword);
      setMsg('Password changed successfully');
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (e1) {
      setMsg(e1.message || 'Failed to change password');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto bg-white rounded-xl shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Change Password</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input type="password" name="currentPassword" value={form.currentPassword} onChange={handleChange} className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input type="password" name="newPassword" value={form.newPassword} onChange={handleChange} className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 border rounded-lg">Back</button>
            <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-green-600 text-white disabled:bg-green-400">{loading ? 'Changing...' : 'Change Password'}</button>
          </div>
          {msg && <div className="text-sm mt-2 {msg.includes('success') ? 'text-green-600' : 'text-red-600'}">{msg}</div>}
        </form>
      </div>
    </div>
  );
}