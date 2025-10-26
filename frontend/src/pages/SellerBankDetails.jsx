import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function SellerBankDetails() {
  const { currentUser, getUserProfile } = useAuth();
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [hasPin, setHasPin] = useState(null); // null = checking, false = no pin, true = has pin
  const [hasBankDetails, setHasBankDetails] = useState(false);
  const [step, setStep] = useState("pin"); // pin | form | display | view
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const [form, setForm] = useState({
    bankName: "",
    branch: "",
    ifsc: "",
    accountHolderName: "",
    accountNumber: "",
    pan: "",
    upi: ""
  });

  useEffect(() => {
    if (!currentUser) { navigate('/login'); return; }
    const p = getUserProfile();
    if (!p || !["seller","store"].includes(p.role)) { navigate('/'); return; }
    checkPinStatus();
  }, [currentUser]);

  const checkPinStatus = async () => {
    if (!currentUser?.uid) return;
    setInitialLoading(true);
    try {
      // Check if user has PIN by trying to get bank details status
      const r = await fetch(`${API}/users/${currentUser.uid}/bank/status`);
      const { ok, data } = await parseResponse(r);
      if (ok) {
        const userHasPin = data.hasPin || false;
        const userHasBankDetails = data.hasBankDetails || false;
        setHasPin(userHasPin);
        setHasBankDetails(userHasBankDetails);
        
        // If user has PIN, skip to PIN entry step
        if (userHasPin) {
          setStep('pin');
        } else {
          setStep('pin'); // Show set PIN interface
        }
      } else {
        setHasPin(false);
        setHasBankDetails(false);
        setStep('pin');
      }
    } catch (e) {
      setHasPin(false);
      setHasBankDetails(false);
      setStep('pin');
    } finally {
      setInitialLoading(false);
    }
  };

  const API = 'http://localhost:5000/api';

  const validate = () => {
    if (!form.bankName.trim()) return 'Bank name is required';
    if (!form.accountHolderName.trim()) return 'Account holder name is required';
    if (form.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(form.ifsc)) return 'Invalid IFSC';
    if (form.accountNumber && !/^\d{9,18}$/.test(form.accountNumber)) return 'Invalid account number';
    if (form.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(form.pan)) return 'Invalid PAN';
    if (form.upi && !/^[a-z0-9.\/_\-]{2,256}@[a-z]{2,64}$/i.test(form.upi)) return 'Invalid UPI ID';
    return '';
  };

  async function parseResponse(r) {
    const text = await r.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text || r.statusText } }
    return { ok: r.ok, data };
  }

  const setOrVerifyPin = async (e) => {
    e.preventDefault();
    setMsg("");
    if (!/^\d{6}$/.test(pin)) { setMsg('Enter 6 digit PIN'); return; }
    setLoading(true);
    try {
      if (!hasPin) {
        // Set PIN for first time
        const r = await fetch(`${API}/users/${currentUser.uid}/bank/pin`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin })
        });
        const { ok, data } = await parseResponse(r);
        if (!ok) throw new Error(data.message || 'Failed to set PIN');
        setHasPin(true);
        setMsg('PIN set successfully.');
        // After setting PIN, load existing bank details if any
        await loadBankDetails();
      } else {
        // Verify existing PIN
        const r = await fetch(`${API}/users/${currentUser.uid}/bank/verify-pin`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin })
        });
        const { ok, data } = await parseResponse(r);
        if (!ok) throw new Error(data.message || 'Invalid PIN');
        setMsg('PIN verified.');
        // After PIN verification, load existing bank details if any
        await loadBankDetails();
      }
    } catch (e1) {
      setMsg(e1.message || 'Operation failed');
    } finally { setLoading(false); }
  };

  const loadBankDetails = async () => {
    try {
      const r = await fetch(`${API}/users/${currentUser.uid}/bank/details`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin })
      });
      const { ok, data } = await parseResponse(r);
      if (ok && data.bankDetails) {
        // Load existing bank details into form
        setForm({
          bankName: data.bankDetails.bankName || '',
          branch: data.bankDetails.branch || '',
          ifsc: data.bankDetails.ifsc || '',
          accountHolderName: data.bankDetails.accountHolderName || '',
          accountNumber: data.bankDetails.accountNumber || '',
          pan: data.bankDetails.pan || '',
          upi: data.bankDetails.upi || ''
        });
        setHasBankDetails(true);
        setStep('display'); // Show bank details with edit option
      } else {
        // No existing bank details, show form
        setHasBankDetails(false);
        setStep('form');
      }
    } catch (e) {
      // If loading fails, show form anyway
      setHasBankDetails(false);
      setStep('form');
    }
  };

  const saveBank = async (e) => {
    e.preventDefault();
    setMsg("");
    const err = validate();
    if (err) { setMsg(err); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API}/users/${currentUser.uid}/bank`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, pin })
      });
      const { ok, data } = await parseResponse(r);
      if (!ok) throw new Error(data.message || 'Failed to save');
      setMsg('Bank details saved successfully');
      setHasBankDetails(true);
      setStep('display'); // Show the bank details display view
    } catch (e1) { setMsg(e1.message || 'Save failed'); }
    finally { setLoading(false); }
  };

  const fetchMasked = async () => {
    setLoading(true);
    setMsg("");
    try {
      const r = await fetch(`${API}/users/${currentUser.uid}/bank/view`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin })
      });
      const { ok, data } = await parseResponse(r);
      if (!ok) throw new Error(data.message || 'Failed');
      // not storing sensitive values
      return data.bankDetails;
    } catch (e1) {
      setMsg(e1.message || 'Failed to load');
      return null;
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8 px-4">
      <div className="max-w-xl mx-auto bg-white rounded-xl shadow p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3">
          <h1 className="text-xl sm:text-2xl font-bold">Seller Bank Details</h1>
          <button 
            onClick={() => navigate('/seller')} 
            className="px-3 sm:px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm"
          >
            Back to Dashboard
          </button>
        </div>

        {initialLoading ? (
          <div className="text-center py-8">
            <div className="text-sm text-gray-600">Loading...</div>
          </div>
        ) : step === 'pin' && (
          <form onSubmit={setOrVerifyPin} className="space-y-4">
            <p className="text-sm text-gray-600">
              {hasPin ? 'Enter your 6-digit PIN to access bank details.' : 'Set a 6-digit PIN to secure your bank details.'}
            </p>
            <input value={pin} onChange={(e)=>setPin(e.target.value.replace(/[^\d]/g,''))} maxLength={6} placeholder="******" className="w-full p-2 sm:p-3 border rounded-lg tracking-widest text-center text-sm sm:text-base" />
            <div className="flex flex-col sm:flex-row gap-2 justify-end">
              <button type="button" onClick={()=>navigate(-1)} className="px-3 sm:px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Back</button>
              <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-green-600 text-white disabled:bg-green-400 text-sm">
                {loading ? 'Please wait...' : hasPin ? 'Enter' : 'Set PIN'}
              </button>
            </div>
            {msg && <div className={`text-sm mt-3 ${msg.includes('saved')||msg.includes('set')||msg.includes('verified')?'text-green-600':'text-red-600'}`}>{msg}</div>}
          </form>
        )}

        {step === 'form' && !hasBankDetails && (
          <form onSubmit={saveBank} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                <input value={form.bankName} onChange={(e)=>setForm(p=>({...p, bankName:e.target.value}))} className="w-full p-2 sm:p-3 border rounded-lg text-sm sm:text-base" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                <input value={form.branch} onChange={(e)=>setForm(p=>({...p, branch:e.target.value}))} className="w-full p-2 sm:p-3 border rounded-lg text-sm sm:text-base" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IFSC</label>
              <input value={form.ifsc} onChange={(e)=>setForm(p=>({...p, ifsc:e.target.value.toUpperCase()}))} className="w-full p-2 sm:p-3 border rounded-lg text-sm sm:text-base" placeholder="e.g., HDFC0001234" />
              <p className="text-xs text-gray-500 mt-1">Format: 4 letters + 0 + 6 alphanumeric</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Holder Name</label>
              <input value={form.accountHolderName} onChange={(e)=>setForm(p=>({...p, accountHolderName:e.target.value}))} className="w-full p-2 sm:p-3 border rounded-lg text-sm sm:text-base" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
              <input value={form.accountNumber} onChange={(e)=>setForm(p=>({...p, accountNumber:e.target.value.replace(/[^\d]/g,'')}))} className="w-full p-2 sm:p-3 border rounded-lg text-sm sm:text-base" placeholder="9-18 digits" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PAN</label>
                <input value={form.pan} onChange={(e)=>setForm(p=>({...p, pan:e.target.value.toUpperCase()}))} className="w-full p-2 sm:p-3 border rounded-lg text-sm sm:text-base" placeholder="ABCDE1234F" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">UPI ID (optional)</label>
                <input value={form.upi} onChange={(e)=>setForm(p=>({...p, upi:e.target.value.toLowerCase()}))} className="w-full p-2 sm:p-3 border rounded-lg text-sm sm:text-base" placeholder="name@bank" />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 justify-between">
              <button type="button" onClick={()=>setStep('pin')} className="px-3 sm:px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Change PIN</button>
              <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-green-600 text-white disabled:bg-green-400 text-sm">
                {loading ? 'Saving...' : hasBankDetails ? 'Update Details' : 'Save Details'}
              </button>
            </div>
            {msg && <div className={`text-sm mt-3 ${msg.includes('saved')?'text-green-600':'text-red-600'}`}>{msg}</div>}
          </form>
        )}

        {step === 'display' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-800 mb-3">Your Bank Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div><span className="font-medium text-gray-700">Bank:</span> {form.bankName}</div>
                <div><span className="font-medium text-gray-700">Branch:</span> {form.branch}</div>
                <div><span className="font-medium text-gray-700">IFSC:</span> {form.ifsc}</div>
                <div><span className="font-medium text-gray-700">Account Holder:</span> {form.accountHolderName}</div>
                <div><span className="font-medium text-gray-700">Account Number:</span> {form.accountNumber ? '****' + form.accountNumber.slice(-4) : ''}</div>
                <div><span className="font-medium text-gray-700">PAN:</span> {form.pan ? form.pan.slice(0,2) + '****' + form.pan.slice(-2) : ''}</div>
                {form.upi && <div><span className="font-medium text-gray-700">UPI:</span> {form.upi}</div>}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 justify-end">
              <button onClick={()=>{setStep('form'); setHasBankDetails(false);}} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Edit Bank Details</button>
            </div>
            {msg && <div className={`text-sm mt-3 ${msg.includes('saved')||msg.includes('updated')?'text-green-600':'text-red-600'}`}>{msg}</div>}
          </div>
        )}

        {step === 'view' && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-green-800 mb-2">Bank Details Saved</h3>
              <p className="text-sm text-green-700">Your bank details have been securely saved and are protected by your PIN.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 justify-end">
              <button onClick={()=>setStep('form')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Edit Bank Details</button>
            </div>
            {msg && <div className={`text-sm mt-3 ${msg.includes('saved')||msg.includes('updated')?'text-green-600':'text-red-600'}`}>{msg}</div>}
          </div>
        )}
      </div>
    </div>
  );
}