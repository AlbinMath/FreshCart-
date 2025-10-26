import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Generic protected route with role-based access control
// - allowedRoles: array of roles permitted to view this route
function ProtectedRoute({ children, allowedRoles = null }) {
  const { currentUser, getUserProfile, loading } = useAuth();

  // Wait for auth state to resolve to avoid flicker/false redirect
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  const profile = getUserProfile();

  // If profile is still null after getUserProfile, wait a bit more
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600"></div>
      </div>
    );
  }

  // Block deactivated users from protected routes (except profile)
  if (profile && profile.isActive === false) {
    // Allow access only to profile page to show the blocked message
    const pathname = window.location.pathname;
    if (!pathname.startsWith('/profile')) {
      return <Navigate to="/profile?blocked=1" replace />;
    }
  }

  // Check role-based access
  if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    const userRole = profile?.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      // Redirect to appropriate dashboard based on user role
      if (userRole === 'admin') {
        return <Navigate to="/admin" replace />;
      } else if (userRole === 'delivery') {
        return <Navigate to="/delivery" replace />;
      } else if (['store', 'seller'].includes(userRole)) {
        return <Navigate to="/seller" replace />;
      } else {
        return <Navigate to="/" replace />;
      }
    }
  }

  return children;
}

export default ProtectedRoute;

