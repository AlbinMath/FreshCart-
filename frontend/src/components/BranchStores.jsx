import React, { useEffect, useState } from 'react';

// Branch store manager used in Seller Profile
// Now shows:
// - My Branches (outgoing branches I created)
// - Pending Requests (incoming requests to link to me)
// - Linked as Branch Of (reverse links where my account is a branch of another seller)
export default function BranchStores({ uid }) {
  const [branches, setBranches] = useState([]); // my outgoing branch stores
  const [sellerId, setSellerId] = useState(''); // current seller unique number
  const [linkedBranchOf, setLinkedBranchOf] = useState([]); // reverse links
  const [linkedProfiles, setLinkedProfiles] = useState([]); // expanded seller profiles
  const [pendingRequests, setPendingRequests] = useState([]); // incoming pending requests

  const [form, setForm] = useState({ name: '', address: '', linkedSellerUniqueNumber: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load branches and related info
  async function loadBranches() {
    try {
      const res = await fetch(`http://localhost:5000/api/users/${uid}/branch-stores`);
      if (res.ok) {
        const data = await res.json();
        // Expected from API: { seller, branchStores, linkedBranchOf, linkedProfiles, pendingRequests }
        if (Array.isArray(data?.branchStores)) setBranches(data.branchStores); else if (Array.isArray(data)) setBranches(data); else setBranches([]);
        if (data?.seller?.sellerUniqueNumber) setSellerId(data.seller.sellerUniqueNumber);
        if (Array.isArray(data?.linkedBranchOf)) setLinkedBranchOf(data.linkedBranchOf); else setLinkedBranchOf([]);
        if (Array.isArray(data?.linkedProfiles)) setLinkedProfiles(data.linkedProfiles); else setLinkedProfiles([]);
        if (Array.isArray(data?.pendingRequests)) setPendingRequests(data.pendingRequests); else setPendingRequests([]);
      } else {
        setBranches([]); setSellerId(''); setLinkedBranchOf([]); setLinkedProfiles([]); setPendingRequests([]);
      }
    } catch (e) {
      setBranches([]); setSellerId(''); setLinkedBranchOf([]); setLinkedProfiles([]); setPendingRequests([]);
    }
  }

  useEffect(() => { loadBranches(); }, [uid]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  // Helper to find seller profile by unique number
  function findProfileByNumber(num) {
    return (linkedProfiles || []).find(p => p.sellerUniqueNumber === num);
  }

  // Add branch (UI updates only after server confirms)
  const addBranch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const name = form.name.trim();
      const address = form.address.trim();
      const linkedSellerUniqueNumber = form.linkedSellerUniqueNumber.trim();
      if (!name || name.length < 2) throw new Error('Enter a valid branch name');
      if (!address || address.length < 10) throw new Error('Enter a valid branch address (>= 10 chars)');

      const payload = { name, address };
      if (linkedSellerUniqueNumber) payload.linkedSellerUniqueNumber = linkedSellerUniqueNumber;

      const res = await fetch(`http://localhost:5000/api/users/${uid}/branch-stores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add branch');

      setSuccess('Branch added');
      setForm({ name: '', address: '', linkedSellerUniqueNumber: '' });
      setBranches(Array.isArray(data?.branchStores) ? data.branchStores : []);
    } catch (e1) {
      setError(e1.message || 'Failed to add branch');
    } finally {
      setLoading(false);
    }
  };

  // Delete branch (UI updates only after server confirms)
  const removeBranch = async (index) => {
    if (!window.confirm('Remove this branch?')) return;
    try {
      const res = await fetch(`http://localhost:5000/api/users/${uid}/branch-stores/${index}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to remove branch');
      setBranches(Array.isArray(data?.branchStores) ? data.branchStores : []);
    } catch (e1) {
      setError(e1.message || 'Failed to remove branch');
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {error && <div className="mb-3 p-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded">{error}</div>}
      {success && <div className="mb-3 p-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded">{success}</div>}

      {/* Seller Unique Number (read-only if available) */}
      {sellerId && (
        <div className="mb-3 text-xs text-gray-600">
          <span className="font-medium">Seller Unique Number:</span> {sellerId}
        </div>
      )}

      {/* My Branches (outgoing) */}
      <div className="space-y-3 mb-6">
        <div className="text-sm font-semibold mb-1">My Branches</div>
        {branches.length === 0 && <p className="text-sm text-gray-500">No branch stores added yet.</p>}
        {branches.map((b, i) => {
          const linkedProfile = b.linkedSellerUniqueNumber ? findProfileByNumber(b.linkedSellerUniqueNumber) : null;
          return (
            <div key={i} className="flex items-start justify-between gap-4 border border-gray-100 rounded p-3">
              <div>
                <div className="font-medium">{b.name}</div>
                <div className="text-sm text-gray-600 whitespace-pre-line">{b.address}</div>

                {/* Accepted link badge and info */}
                {b.linkedSellerUniqueNumber && (
                  <div className="text-[11px] text-blue-600 mt-1">
                    Linked seller: {b.linkedSellerUniqueNumber}
                    {linkedProfile && <> — {linkedProfile.storeName}, {linkedProfile.storeAddress}</>}
                    <span className="ml-2 inline-block px-2 py-0.5 text-[10px] rounded bg-green-100 text-green-700 align-middle">Accepted</span>
                  </div>
                )}
              </div>
              <button onClick={() => removeBranch(i)} className="text-red-600 hover:text-red-700 text-sm">Remove</button>
            </div>
          );
        })}
      </div>

      {/* Incoming pending requests (to me) */}
      {pendingRequests?.length > 0 && (
        <div className="space-y-3 mb-6">
          <div className="text-sm font-semibold mb-1">Pending Requests</div>
          {pendingRequests.map((r) => (
            <div key={r._id} className="border border-yellow-200 bg-yellow-50 rounded p-3">
              <div className="font-medium">{r.branchName}</div>
              <div className="text-sm text-gray-700 whitespace-pre-line">{r.branchAddress}</div>
              <div className="text-[11px] text-yellow-800 mt-1">
                From: {r.requesterSellerUniqueNumber || 'Unknown'}
                <span className="ml-2 inline-block px-2 py-0.5 text-[10px] rounded bg-yellow-200 text-yellow-900 align-middle">Pending</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Linked as Branch Of (reverse links) */}
      {linkedBranchOf?.length > 0 && (
        <div className="space-y-3 mb-4">
          <div className="text-sm font-semibold mb-1">Linked as Branch Of</div>
          {linkedBranchOf.map((x, i) => {
            const main = findProfileByNumber(x.sellerUniqueNumber);
            return (
              <div key={i} className="border border-gray-100 rounded p-3">
                <div className="font-medium">{x.branchName}</div>
                <div className="text-sm text-gray-600 whitespace-pre-line">{x.branchAddress}</div>
                <div className="text-[11px] text-blue-600 mt-1">
                  Main seller: {x.sellerUniqueNumber}
                  {main && <> — {main.storeName}, {main.storeAddress}</>}
                  <span className="ml-2 inline-block px-2 py-0.5 text-[10px] rounded bg-green-100 text-green-700 align-middle">Accepted</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Branch Form */}
      <form onSubmit={addBranch} className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name</label>
          <input name="name" value={form.name} onChange={onChange} className="w-full p-2.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Branch Address</label>
          <textarea name="address" rows={3} value={form.address} onChange={onChange} className="w-full p-2.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Link to Seller (optional)</label>
          <input name="linkedSellerUniqueNumber" value={form.linkedSellerUniqueNumber} onChange={onChange} placeholder="Existing Seller Unique No." className="w-full p-2.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="md:col-span-2 flex justify-end">
          <button disabled={loading} type="submit" className="px-4 py-2 rounded bg-green-600 text-white disabled:bg-green-400">
            {loading ? 'Adding...' : 'Add Branch'}
          </button>
        </div>
      </form>
    </div>
  );
}