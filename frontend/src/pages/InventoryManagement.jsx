import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function InventoryManagement() {
  const { currentUser, getUserProfile } = useAuth();
  const profile = useMemo(() => getUserProfile() || {}, [getUserProfile]);
  const navigate = useNavigate();

  const API_BASE_URL = 'http://localhost:5000/api';
  const [items, setItems] = useState([]);
  const [waste, setWaste] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      await refresh();
    })();
  }, [currentUser]);

  async function refresh() {
    setLoading(true); setError('');
    try {
      // products
      const res = await fetch(`${API_BASE_URL}/products`, { headers: { 'x-uid': currentUser.uid } });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to load products');
      setItems(Array.isArray(data.products) ? data.products : []);
    } catch (e) { setError(e.message || 'Failed to load products'); }

    try {
      // waste logs
      const wr = await fetch(`${API_BASE_URL}/inventory/waste`, { headers: { 'x-uid': currentUser.uid } });
      const wd = await wr.json();
      if (wr.ok) setWaste(Array.isArray(wd.logs) ? wd.logs : []);
    } catch {}
    setLoading(false);
  }

  async function markWaste(p, qty) {
    if (!qty || qty <= 0) return;
    try {
      const res = await fetch(`${API_BASE_URL}/inventory/waste`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-uid': currentUser.uid },
        body: JSON.stringify({ productId: p._id, quantity: qty })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to mark waste');
      await refresh();
    } catch (e) { alert(e.message || 'Failed to mark waste'); }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Inventory Management</h1>
          <button onClick={() => navigate('/seller')} className="px-4 py-2 border rounded-lg">Back</button>
        </div>

        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded mb-4">{error}</div>}

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-3">Products</h2>
          {loading ? <div className="text-sm text-gray-500">Loading…</div> : (
            <div className="space-y-3">
              {items.length === 0 ? (
                <div className="text-sm text-gray-500">No products.</div>
              ) : (
                items.map(p => (
                  <div key={p._id} className="border rounded-lg p-4 flex items-center justify-between gap-3">
                    <div className="text-sm">
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-xs text-gray-600">{p.category} • ₹{p.price} • Stock: {p.stock}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="number" min={1} placeholder="Waste qty" className="w-24 p-2 border rounded text-sm" id={`wq_${p._id}`} />
                      <button className="px-3 py-1.5 text-xs rounded bg-amber-600 text-white" onClick={() => {
                        const el = document.getElementById(`wq_${p._id}`);
                        const qty = parseInt(el?.value || '0', 10);
                        markWaste(p, qty);
                      }}>Mark Waste</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow p-6 mt-6">
          <h2 className="text-lg font-semibold mb-3">Wasted Stocks</h2>
          <div className="text-xs text-gray-500 mb-2">Shows quantity marked as waste and date.</div>
          {waste.length === 0 ? (
            <div className="text-sm text-gray-500">No waste logs yet.</div>
          ) : (
            <div className="space-y-2">
              {waste.map((w) => (
                <div key={w._id} className="border rounded p-3 text-sm flex items-center justify-between">
                  <div>
                    <div className="font-medium">{w.product?.name || 'Product'}</div>
                    <div className="text-xs text-gray-600">Qty: {w.quantity} • Date: {new Date(w.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}