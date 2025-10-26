import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getLicenseStatus } from '../../../backend/services/sellerService';

// Gate that allows access only if seller license is approved.
// Use it inside ProtectedRoute(allowedRoles=["store","seller"]).
// Excludes the upload page itself from redirect loops.
function SellerLicenseGate({ children }) {
  const [loading, setLoading] = useState(true);
  const [approved, setApproved] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const info = await getLicenseStatus();
        if (!active) return;
        setApproved(info?.status === 'approved');
      } catch (_) {
        if (!active) return;
        setApproved(false);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking license verification...</p>
        </div>
      </div>
    );
  }

  // Allow the upload page even if not approved to avoid redirect loop
  const isUploadPage = location.pathname.startsWith('/seller/license-upload');
  if (!approved && !isUploadPage) {
    return <Navigate to="/seller/license-upload" replace />;
  }

  return children;
}

export default SellerLicenseGate;