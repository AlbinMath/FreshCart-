import axios from 'axios';

// Resolve API base URL from Vite env and normalize (strip trailing slashes and any trailing /api)
const RAW_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').trim();
const ROOT_URL = RAW_BASE.replace(/\/+$/, '').replace(/\/api$/i, '');
const API_BASE = `${ROOT_URL}/api`;

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Note: Authentication interceptors are now handled by the centralized authService

// Upload a new license document (image/pdf)
const uploadLicense = async (formData) => {
  try {
    const token = localStorage.getItem('token');
    // Token optional: if absent, we will pass identity headers instead of Authorization

    // Optional profile check; only call /users/me when a token exists to avoid 401 interceptors
    const licenseNumber = formData.get('licenseNumber');
    let user = null;
    if (token) {
      try {
        const userResponse = await api.get('/users/me');
        user = userResponse.data;
      } catch (_) {}
    }
    if (user?.businessLicense && (user.businessLicense || '').toLowerCase() !== String(licenseNumber || '').toLowerCase()) {
      throw new Error('License number does not match your registered business license');
    }

    // Attach identity headers if no token
    let xHeaders = {};
    try {
      const profileKey = Object.keys(localStorage).find(k => k.startsWith('userProfile_'));
      const parsed = profileKey ? JSON.parse(localStorage.getItem(profileKey)) : null;
      if (!token && parsed) {
        if (parsed.uid) xHeaders['x-actor-uid'] = parsed.uid;
        if (parsed.email) xHeaders['x-actor-email'] = String(parsed.email).toLowerCase();
      }
    } catch {}

    const response = await axios.post(`${API_BASE}/license/upload`, formData, {
      withCredentials: true,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...xHeaders
      }
    });
    if (response.data?.token) {
      localStorage.setItem('token', response.data.token);
    }
    return response.data;
  } catch (error) {
    console.error('License upload error:', error);
    
    // Handle 403 Forbidden specifically (no redirects here)
    if (error.response?.status === 403) {
      const errorMsg = error.response?.data?.message || 'Access denied. You may not have seller permissions.';
      console.warn('403 Forbidden during license upload:', errorMsg);
      throw new Error(errorMsg);
    }
    
    const msg = error?.response?.data?.message || error?.message || 'Failed to upload license. Please try again.';
    throw new Error(msg);
  }
};

// Update an existing license document (image/pdf optional)
const updateLicense = async (formData) => {
  try {
    const response = await api.put('/license/update', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    if (response.data?.token) {
      localStorage.setItem('token', response.data.token);
    }
    return response.data;
  } catch (error) {
    const msg = error?.response?.data?.message || error?.message || 'Failed to update license. Please try again.';
    throw new Error(msg);
  }
};

// Submit a URL-only license (no file)
const uploadLicenseLink = async ({ licenseNumber, licenseUrl }) => {
  try {
    // Optional profile check; tolerate missing /me
    let user = null;
    try {
      const userResponse = await api.get('/users/me');
      user = userResponse.data;
    } catch (_) {}

    const normalizedInputLicense = String(licenseNumber || '').trim().toLowerCase();
    if (user?.businessLicense && (user.businessLicense || '').toLowerCase() !== normalizedInputLicense) {
      throw new Error('License number does not match your registered business license');
    }

    const response = await api.post('/license/link', {
      licenseNumber: normalizedInputLicense,
      licenseUrl: String(licenseUrl || '').trim()
    });
    if (response.data?.token) {
      localStorage.setItem('token', response.data.token);
    }
    return response.data;
  } catch (error) {
    const msg = error?.response?.data?.message || error?.message || 'Failed to submit license link. Please try again.';
    throw new Error(msg);
  }
};

// Get current license status for the logged-in seller
const getLicenseStatus = async () => {
  try {
    const token = localStorage.getItem('token');

    // Build headers: use token if available; else pass identity headers
    const headers = { 'Accept': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      // Development identity headers (no-token flow)
      try {
        const profileKey = Object.keys(localStorage).find(k => k.startsWith('userProfile_'));
        if (profileKey) {
          const profile = JSON.parse(localStorage.getItem(profileKey));
          if (profile?.uid) headers['x-actor-uid'] = profile.uid;
          if (profile?.email) headers['x-actor-email'] = String(profile.email).toLowerCase();
        }
      } catch {}
    }

    const response = await axios.get(`${API_BASE}/license/status`, {
      headers,
      withCredentials: true
    });

    if (response.data?.token) {
      localStorage.setItem('token', response.data.token);
    }

    const info = response.data?.licenseInfo || null;
    return {
      status: info?.status, // undefined -> UI shows "Not Uploaded"
      rejectionReason: info?.rejectionReason || '',
      updatedAt: info?.verifiedAt || info?.updatedAt || new Date().toISOString(),
      licenseNumber: info?.licenseNumber || '',
      file: info?.file || null,
      externalLink: info?.externalLink || ''
    };
  } catch (error) {
    console.error('Error getting license status:', error);

    // If it's a 403 error, surface message without redirect
    if (error.response?.status === 403) {
      console.warn('403 Forbidden - User may not have seller role or token is invalid');
      return { status: undefined, rejectionReason: 'Access denied. Seller role required.', updatedAt: new Date().toISOString(), licenseNumber: '', file: null, externalLink: '' };
    }

    // For other errors, return minimal inactive-like state without forcing a status string
    return { status: undefined, rejectionReason: '', updatedAt: new Date().toISOString(), licenseNumber: '', file: null, externalLink: '' };
  }
};

// Check if current user has seller role
const checkSellerRole = async () => {
  try {
    const token = localStorage.getItem('token');
    // token may be absent; we will use identity headers if needed

    // Build headers: token or identity
    const headers = { 'Accept': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    else {
      try {
        const profileKey = Object.keys(localStorage).find(k => k.startsWith('userProfile_'));
        if (profileKey) {
          const profile = JSON.parse(localStorage.getItem(profileKey));
          if (profile?.uid) headers['x-actor-uid'] = profile.uid;
          if (profile?.email) headers['x-actor-email'] = String(profile.email).toLowerCase();
        }
      } catch {}
    }

    const response = await axios.get(`${API_BASE}/users/me`, {
      headers,
      withCredentials: true
    });
    
    if (response.data?.token) {
      localStorage.setItem('token', response.data.token);
    }
    
    const user = response.data;
    const hasSellerRole = user && ['seller', 'store'].includes(user.role);
    
    return { 
      hasRole: hasSellerRole, 
      user: user,
      error: hasSellerRole ? null : `User role '${user?.role}' is not authorized for license operations`
    };
  } catch (error) {
    console.error('Error checking seller role:', error);
    return { hasRole: false, error: error.message };
  }
};

// Admin helpers
const getPendingSellers = async () => {
  const token = localStorage.getItem('token');
  const response = await axios.get(`${API_BASE}/admin/sellers/pending`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
    withCredentials: true
  });
  if (response.data?.token) localStorage.setItem('token', response.data.token);
  return response.data.sellers || [];
};

const approveSeller = async (sellerId) => {
  const token = localStorage.getItem('token');
  const response = await axios.put(
    `${API_BASE}/admin/sellers/${sellerId}/approve`,
    {},
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      withCredentials: true
    }
  );
  if (response.data?.token) localStorage.setItem('token', response.data.token);
  return response.data;
};

const rejectSeller = async (sellerId, reason) => {
  const token = localStorage.getItem('token');
  const response = await axios.put(
    `${API_BASE}/admin/sellers/${sellerId}/reject`,
    { reason },
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      withCredentials: true
    }
  );
  if (response.data?.token) localStorage.setItem('token', response.data.token);
  return response.data;
};

export {
  api,
  uploadLicense,
  updateLicense,
  uploadLicenseLink,
  getLicenseStatus,
  checkSellerRole,
  getPendingSellers,
  approveSeller,
  rejectSeller
};