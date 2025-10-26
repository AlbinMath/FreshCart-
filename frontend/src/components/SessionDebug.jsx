import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { checkSellerRole } from '../../../backend/services/sellerService';

const SessionDebug = () => {
  const { currentUser, getUserProfile } = useAuth();
  const [debugInfo, setDebugInfo] = useState({});
  const [loading, setLoading] = useState(false);

  const gatherDebugInfo = async () => {
    setLoading(true);
    try {
      const profile = getUserProfile();
      const token = localStorage.getItem('token');
      const roleCheck = await checkSellerRole();
      
      setDebugInfo({
        firebaseUser: currentUser ? {
          uid: currentUser.uid,
          email: currentUser.email,
          emailVerified: currentUser.emailVerified
        } : null,
        localProfile: profile,
        hasToken: !!token,
        tokenLength: token ? token.length : 0,
        roleCheck: roleCheck,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      setDebugInfo({
        error: error.message,
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    gatherDebugInfo();
  }, []);

  const clearSession = () => {
    localStorage.removeItem('token');
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('userProfile_')) {
        localStorage.removeItem(key);
      }
    });
    window.location.reload();
  };

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-md z-50">
      <h3 className="font-bold text-sm mb-2">Session Debug Info</h3>
      <button 
        onClick={gatherDebugInfo}
        disabled={loading}
        className="mb-2 px-2 py-1 bg-blue-500 text-white text-xs rounded"
      >
        {loading ? 'Loading...' : 'Refresh'}
      </button>
      <button 
        onClick={clearSession}
        className="mb-2 ml-2 px-2 py-1 bg-red-500 text-white text-xs rounded"
      >
        Clear Session
      </button>
      <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-64">
        {JSON.stringify(debugInfo, null, 2)}
      </pre>
    </div>
  );
};

export default SessionDebug;

