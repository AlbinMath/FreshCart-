import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import EmailVerification from '../components/EmailVerification';

// Simple seller products manager (create + list + delete)
export default function SellerProducts() {
  const { currentUser, getUserProfile } = useAuth();
  const navigate = useNavigate();
  const profile = useMemo(() => getUserProfile() || {}, [getUserProfile]);

  // Check if seller needs email verification
  const needsEmailVerification = useMemo(() => {
    return profile?.role === 'seller' && 
           profile?.provider === 'email' && 
           !currentUser?.emailVerified;
  }, [profile, currentUser]);

  const API_BASE_URL = 'http://localhost:5000/api';
  const API_ORIGIN = API_BASE_URL.replace(/\/api$/, '');
  const toImageUrl = (u) => {
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u; // already absolute URL
    if (u.startsWith('/')) return `${API_ORIGIN}${u}`; // server-relative path
    return `${API_ORIGIN}/${u}`; // relative path fallback
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [items, setItems] = useState([]);

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    mrpPrice: '',
    stock: '',
    lowStockThreshold: '10',
    images: '', // kept for backward compatibility (optional)
    imageFile: null, // new: single image file upload
    category: '' // auto-filled from profile
  });
  const [fileInputKey, setFileInputKey] = useState(Date.now()); // to reset file input

  useEffect(() => {
    if (!currentUser) return;
    // Pre-fill category
    setForm((f) => ({ ...f, category: profile?.sellerCategory || '' }));
    (async () => {
      await refreshList();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  async function refreshList() {
    if (!currentUser) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/products`, {
        headers: { 'x-uid': currentUser.uid }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to load products');
      setItems(Array.isArray(data.products) ? data.products : []);
    } catch (e) {
      setError(e.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }

  function onChange(e) {
    const { name, value, files } = e.target;
    if (name === 'imageFile') {
      setForm((p) => ({ ...p, imageFile: files && files[0] ? files[0] : null }));
      return;
    }
    setForm((p) => ({ ...p, [name]: ['price', 'mrpPrice', 'stock', 'lowStockThreshold'].includes(name) ? value.replace(/[^0-9.]/g, '') : value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError(''); setInfo('');
    
    // Check email verification
    if (needsEmailVerification) {
      alert('Please verify your email address before adding products.');
      return;
    }
    
    if (!form.name.trim()) return setError('Name required');
    if (!form.category) return setError('Category missing');
    const priceNum = parseFloat(form.price);
    if (Number.isNaN(priceNum) || priceNum < 0) return setError('Price must be a non-negative number');
    const mrpNum = form.mrpPrice ? parseFloat(form.mrpPrice) : undefined;
    if (mrpNum !== undefined && (Number.isNaN(mrpNum) || mrpNum < 0)) return setError('MRP must be a non-negative number');
    if (mrpNum !== undefined && mrpNum < priceNum) return setError('MRP must be greater than or equal to Selling Price');
    const stockNum = form.stock ? parseInt(form.stock, 10) : 0;
    if (stockNum < 0) return setError('Stock cannot be negative');

    // Upload image if a file is selected
    let uploadedImageUrl = '';
    if (form.imageFile) {
      const fd = new FormData();
      fd.append('image', form.imageFile);
      try {
        const upRes = await fetch(`${API_BASE_URL}/upload/product-image`, {
          method: 'POST',
          headers: { 'x-uid': currentUser.uid },
          body: fd
        });
        // Note: server responds with { success, url: '/uploads/products/<file>', fullUrl: 'http://localhost:5000/uploads/products/<file>' }
        const upData = await upRes.json();
        if (!upRes.ok || !upData?.success) throw new Error(upData?.message || 'Image upload failed');
        uploadedImageUrl = upData.fullUrl || upData.url;
      } catch (e) {
        return setError(e.message || 'Image upload failed');
      }
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category,
      price: priceNum,
      mrpPrice: form.mrpPrice ? parseFloat(form.mrpPrice) : undefined,
      stock: form.stock ? parseInt(form.stock, 10) : 0,
      lowStockThreshold: form.lowStockThreshold ? parseInt(form.lowStockThreshold, 10) : 10,
      images: uploadedImageUrl
        ? [uploadedImageUrl]
        : (form.images ? form.images.split(',').map(s => s.trim()).filter(Boolean) : [])
    };

    try {
      const res = await fetch(`${API_BASE_URL}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-uid': currentUser.uid
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to create product');
      setInfo('Product added');
      setForm((f) => ({ ...f, name: '', description: '', price: '', mrpPrice: '', stock: '', lowStockThreshold: '10', images: '', imageFile: null }));
      setFileInputKey(Date.now()); // reset file input
      await refreshList();
    } catch (e) {
      setError(e.message || 'Failed to create product');
    }
  }

  async function onDelete(id) {
    // Check email verification
    if (needsEmailVerification) {
      alert('Please verify your email address before managing products.');
      return;
    }
    
    if (!window.confirm('Delete this product?')) return;
    setError(''); setInfo('');
    try {
      const res = await fetch(`${API_BASE_URL}/products/${id}`, {
        method: 'DELETE',
        headers: { 'x-uid': currentUser.uid }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to delete');
      setInfo('Deleted');
      await refreshList();
    } catch (e) {
      setError(e.message || 'Failed to delete');
    }
  }

  async function updateProduct(id, field, value) {
    // Check email verification
    if (needsEmailVerification) {
      alert('Please verify your email address before editing products.');
      return false;
    }
    
    try {
      const res = await fetch(`${API_BASE_URL}/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-uid': currentUser.uid },
        body: JSON.stringify({ [field]: value })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Update failed');
      await refreshList();
      return true;
    } catch (err) {
      alert(err.message || `Failed to update ${field}`);
      return false;
    }
  }

  function getStockStatus(stock, threshold = 10) {
    if (stock === 0) return { status: 'out', color: 'red', text: 'Out of Stock' };
    if (stock <= threshold) return { status: 'low', color: 'yellow', text: 'Low Stock' };
    return { status: 'good', color: 'green', text: 'In Stock' };
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">My Products</h1>
          <button onClick={() => navigate('/seller')} className="px-4 py-2 border rounded-lg">Back</button>
        </div>

        <div className="bg-white rounded-xl shadow p-6 space-y-6">
          {/* Email Verification Banner */}
          {needsEmailVerification && (
            <EmailVerification />
          )}
          
          {profile?.role !== 'seller' && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded">
              Only seller accounts can add products.
            </div>
          )}

          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded">{error}</div>}
          {info && <div className="text-sm text-green-700 bg-green-50 border border-green-200 p-3 rounded">{info}</div>}

          <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-1">
              <label className="block text-xs text-gray-500 mb-1">Name</label>
              <input name="name" value={form.name} onChange={onChange} className="w-full p-3 border rounded-lg" placeholder="Product name" />
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs text-gray-500 mb-1">Category (locked)</label>
              <input name="category" value={form.category} onChange={onChange} className="w-full p-3 border rounded-lg bg-gray-50" disabled />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <textarea name="description" value={form.description} onChange={onChange} className="w-full p-3 border rounded-lg" placeholder="Optional" rows={3} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Selling Price (₹)</label>
              <input type="number" min={0} step="0.01" name="price" value={form.price} onChange={onChange} className="w-full p-3 border rounded-lg" placeholder="e.g., 25" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">MRP Price (₹) - Optional</label>
              <input type="number" min={0} step="0.01" name="mrpPrice" value={form.mrpPrice} onChange={onChange} className="w-full p-3 border rounded-lg" placeholder="e.g., 30 (>= Selling Price)" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Stock Quantity</label>
              <input type="number" min={0} step="1" name="stock" value={form.stock} onChange={onChange} className="w-full p-3 border rounded-lg" placeholder="e.g., 100 (>= 0)" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Low Stock Alert Threshold</label>
              <input name="lowStockThreshold" value={form.lowStockThreshold} onChange={onChange} className="w-full p-3 border rounded-lg" placeholder="e.g., 10" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Product Image (upload from device)</label>
              <input key={fileInputKey} type="file" name="imageFile" accept="image/*" onChange={onChange} className="w-full p-3 border rounded-lg" />
              <div className="text-[11px] text-gray-500 mt-1">Max 5MB. JPG/PNG/GIF/WEBP. Optional: you can still paste URLs below.</div>
              {/* <label className="block text-xs text-gray-500 mt-3 mb-1">Image URLs (comma separated) [optional]</label> */}
              {/* <input name="images" value={form.images} onChange={onChange} className="w-full p-3 border rounded-lg" placeholder="https://... , https://..." /> */}
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button 
                type="submit" 
                disabled={needsEmailVerification}
                className={`px-4 py-2 rounded-lg ${
                  needsEmailVerification 
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
                title={needsEmailVerification ? 'Please verify your email to add products' : ''}
              >
                Add Product
              </button>
            </div>
          </form>

          <div className="pt-2">
            <h2 className="text-lg font-semibold mb-2">Your Products</h2>
            {loading ? (
              <div className="text-sm text-gray-500">Loading…</div>
            ) : (
              <div className="space-y-3">
                {items.length === 0 ? (
                  <div className="text-sm text-gray-500">No products yet.</div>
                ) : (
                  items.map((p) => {
                    const stockStatus = getStockStatus(p.stock, p.lowStockThreshold || 10);
                    return (
                      <div key={p._id} className={`border rounded-lg p-4 ${stockStatus.status === 'out' ? 'border-red-300 bg-red-50' : stockStatus.status === 'low' ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-sm flex-1">
                            <div className="flex items-start gap-3">
                              {Array.isArray(p.images) && p.images.length > 0 && (
                                <img
                                  src={toImageUrl(p.images[0])}
                                  alt={p.name}
                                  className="w-16 h-16 object-cover rounded border"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              )}
                              <div className="flex-1">
                                <div className="font-semibold flex items-center gap-2">
                                  {p.name}
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${stockStatus.color === 'red' ? 'bg-red-100 text-red-700' : stockStatus.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                                    {stockStatus.text}
                                  </span>
                                  {p.approvalStatus === 'rejected' && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-600 text-white" title={p.rejectionReason || 'Rejected by Admin'}>
                                      Rejected by Admin
                                    </span>
                                  )}
                                  {p.approvalStatus === 'pending' && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500 text-white" title="Awaiting admin approval">
                                      Pending Approval
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-600 mt-1">{p.category}</div>
                                
                                {/* Editable Description */}
                                <div className="mt-2">
                                  <label className="text-xs text-gray-500">Description:</label>
                                  <textarea
                                    defaultValue={p.description || ''}
                                    disabled={needsEmailVerification || p.approvalStatus !== 'approved'}
                                    className={`w-full mt-1 p-2 text-xs border rounded resize-none ${
                                      (needsEmailVerification || p.approvalStatus !== 'approved') ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
                                    }`}
                                    rows={2}
                                    placeholder={needsEmailVerification ? 'Verify email to edit' : (p.approvalStatus !== 'approved' ? 'Awaiting approval/rejected - editing disabled' : 'Add description...')}
                                    title={p.approvalStatus === 'rejected' ? 'Rejected by admin: editing disabled' : (p.approvalStatus === 'pending' ? 'Pending approval: editing disabled' : '')}
                                    onBlur={async (e) => {
                                      if (needsEmailVerification || p.approvalStatus !== 'approved') return;
                                      const value = e.target.value.trim();
                                      if (value !== (p.description || '')) {
                                        await updateProduct(p._id, 'description', value);
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                            
                            {/* Pricing and Stock Controls */}
                            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div>
                                <label className="text-xs text-gray-500">Selling Price (₹):</label>
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  defaultValue={p.price}
                                  disabled={needsEmailVerification || p.approvalStatus !== 'approved'}
                                  className={`w-full mt-1 p-1 border rounded text-sm ${
                                    (needsEmailVerification || p.approvalStatus !== 'approved') ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
                                  }`}
                                  onBlur={async (e) => {
                                    if (needsEmailVerification || p.approvalStatus !== 'approved') return;
                                    const value = parseFloat(e.target.value);
                                    if (Number.isNaN(value) || value < 0) { e.target.value = p.price; return; }
                                    if (value !== p.price) {
                                      await updateProduct(p._id, 'price', value);
                                    }
                                  }}
                                />
                              </div>
                              
                              <div>
                                <label className="text-xs text-gray-500">MRP Price (₹):</label>
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  defaultValue={p.mrpPrice || ''}
                                  placeholder={needsEmailVerification ? 'Verify email to edit' : 'Optional'}
                                  disabled={needsEmailVerification}
                                  className={`w-full mt-1 p-1 border rounded text-sm ${
                                    needsEmailVerification ? 'bg-gray-100 text-gray-500' : ''
                                  }`}
                                  onBlur={async (e) => {
                                    const value = e.target.value ? parseFloat(e.target.value) : undefined;
                                    if (e.target.value && (Number.isNaN(value) || value < 0)) { 
                                      e.target.value = p.mrpPrice || ''; 
                                      return; 
                                    }
                                    if (value !== p.mrpPrice) {
                                      await updateProduct(p._id, 'mrpPrice', value);
                                    }
                                  }}
                                />
                              </div>
                              
                              <div>
                                <label className="text-xs text-gray-500">Stock Quantity:</label>
                                <input
                                  type="number"
                                  min={0}
                                  defaultValue={p.stock}
                                  disabled={needsEmailVerification || p.approvalStatus !== 'approved'}
                                  className={`w-full mt-1 p-1 border rounded text-sm ${
                                    (needsEmailVerification || p.approvalStatus !== 'approved') ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
                                  }`}
                                  onBlur={async (e) => {
                                    if (needsEmailVerification || p.approvalStatus !== 'approved') return;
                                    const value = parseInt(e.target.value, 10);
                                    if (Number.isNaN(value) || value < 0) { e.target.value = p.stock; return; }
                                    if (value !== p.stock) {
                                      await updateProduct(p._id, 'stock', value);
                                    }
                                  }}
                                />
                              </div>
                              
                              <div>
                                <label className="text-xs text-gray-500">Low Stock Alert:</label>
                                <input
                                  type="number"
                                  min={0}
                                  defaultValue={p.lowStockThreshold || 10}
                                  disabled={needsEmailVerification || p.approvalStatus !== 'approved'}
                                  className={`w-full mt-1 p-1 border rounded text-sm ${
                                    (needsEmailVerification || p.approvalStatus !== 'approved') ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
                                  }`}
                                  onBlur={async (e) => {
                                    if (needsEmailVerification || p.approvalStatus !== 'approved') return;
                                    const value = parseInt(e.target.value, 10);
                                    if (Number.isNaN(value) || value < 0) { e.target.value = p.lowStockThreshold || 10; return; }
                                    if (value !== (p.lowStockThreshold || 10)) {
                                      await updateProduct(p._id, 'lowStockThreshold', value);
                                    }
                                  }}
                                />
                              </div>
                            </div>
                            
                            {/* Stock Status Info */}
                            <div className="mt-2 text-xs text-gray-600">
                              Current Stock: {p.stock} | Alert Threshold: {p.lowStockThreshold || 10}
                              {p.mrpPrice && p.price && p.mrpPrice > p.price && (
                                <span className="ml-2 text-green-600">
                                  Discount: {Math.round(((p.mrpPrice - p.price) / p.mrpPrice) * 100)}% off
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-2">
                            <button 
                              onClick={() => onDelete(p._id)}
                              disabled={needsEmailVerification}
                              className={`px-3 py-1.5 text-xs rounded ${
                                needsEmailVerification 
                                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                                  : 'bg-red-600 text-white hover:bg-red-700'
                              }`}
                              title={needsEmailVerification ? 'Please verify your email to delete products' : ''}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}