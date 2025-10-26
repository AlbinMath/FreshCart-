import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function BranchLinkRequest() {
  const { listBranchLinkRequests, actOnBranchLinkRequest, listBranchStores } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const reqs = await listBranchLinkRequests();
        setRequests(Array.isArray(reqs) ? reqs : []);
      } catch (e) {
        setError(e.message || "Failed to load requests");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handle(action, id) {
    setError(""); setInfo("");
    try {
      setSaving(true);
      await actOnBranchLinkRequest(id, action);
      setRequests(prev => prev.filter(r => r._id !== id));
      if (action === 'accept') {
        // Optional: refresh branches for any dependent components
        try { await listBranchStores(); } catch {}
      }
      setInfo(action === 'accept' ? 'Request accepted' : 'Request denied');
    } catch (e) {
      setError(e.message || 'Failed to update request');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Branch Link Requests</h1>
          <button onClick={() => navigate(-1)} className="px-4 py-2 border rounded-lg">Back</button>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          {loading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : (
            <div className="space-y-3">
              {requests.length === 0 && (
                <div className="text-sm text-gray-500">No pending requests.</div>
              )}
              {requests.map((r) => (
                <div key={r._id} className="flex items-start justify-between border rounded-xl p-4 bg-yellow-50">
                  <div>
                    <div className="text-sm font-medium">From: {r.requesterSellerUniqueNumber}</div>
                    <div className="text-xs text-gray-600">Branch: {r.branchName}</div>
                    <div className="text-xs text-gray-600 break-words">Address: {r.branchAddress}</div>
                    {!!r.requesterStoreName && (
                      <div className="text-[11px] text-gray-500 mt-1">Store: {r.requesterStoreName}</div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={saving}
                      onClick={() => handle('accept', r._id)}
                      className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs hover:bg-green-700 disabled:bg-green-400"
                    >Accept</button>
                    <button
                      disabled={saving}
                      onClick={() => handle('deny', r._id)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-red-200 text-red-600 text-xs hover:bg-red-50 disabled:opacity-60"
                    >Deny</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {(error || info) && (
            <div className={`mt-3 text-sm ${error ? 'text-red-600' : 'text-green-600'}`}>{error || info}</div>
          )}
        </div>
      </div>
    </div>
  );
}