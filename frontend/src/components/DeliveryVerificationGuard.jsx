import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

export default function DeliveryVerificationGuard({ children }) {
  const { currentUser, getUserProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const profile = getUserProfile();
    if (!currentUser || profile?.role !== 'delivery') {
      setLoading(false);
      return;
    }
    checkVerificationStatus();
  }, [currentUser, getUserProfile]);

  const checkVerificationStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/delivery-verification/${currentUser.uid}/status`);
      
      if (!response.ok) {
        throw new Error('Failed to check verification status');
      }

      const data = await response.json();
      console.log('🔍 Verification API response:', data);
      
      if (data.success && data.data) {
        const status = data.data.verification?.status;
        setVerificationStatus(status);
        
        // If no verification exists, redirect to verification page
        if (!data.data.exists) {
          setError('Verification required');
          setTimeout(() => navigate('/delivery/verification'), 1000);
          return;
        }
        
        // If verification exists but not approved, show waiting message
        if (status && status !== 'approved') {
          setError(`Verification ${status || 'pending'}`);
        }
      } else {
        setError('Verification required');
        setTimeout(() => navigate('/delivery/verification'), 1000);
      }
    } catch (error) {
      console.error('Error checking verification status:', error);
      setError('Error checking verification status');
      toast.error('Failed to verify delivery partner status');
    } finally {
      setLoading(false);
    }
  };

  const handleRetryVerification = () => {
    navigate('/delivery/verification');
  };

  const handleLogout = () => {
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking verification status...</p>
        </div>
      </div>
    );
  }

  // Only allow access if verification is approved
  if (verificationStatus === 'approved') {
    return children;
  }

  // Show appropriate message based on verification status
  const getStatusMessage = () => {
    switch (verificationStatus) {
      case 'pending':
        return {
          title: 'Verification Under Review',
          message: 'Your delivery partner verification is currently being reviewed by our admin team. You will be notified once approved.',
          icon: '⏳',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200'
        };
      case 'rejected':
        return {
          title: 'Verification Rejected',
          message: 'Your delivery partner verification has been rejected. Please update your information and resubmit.',
          icon: '❌',
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200'
        };
      case 'draft':
        return {
          title: 'Verification Incomplete',
          message: 'Please complete your delivery partner verification to access the dashboard.',
          icon: '📝',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200'
        };
      default:
        return {
          title: 'Verification Required',
          message: 'You need to complete the delivery partner verification process to access the dashboard.',
          icon: '🚫',
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200'
        };
    }
  };

  const statusInfo = getStatusMessage();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className={`${statusInfo.bgColor} ${statusInfo.borderColor} border rounded-lg p-6 text-center`}>
          <div className="text-4xl mb-4">{statusInfo.icon}</div>
          <h2 className={`text-xl font-bold ${statusInfo.color} mb-3`}>
            {statusInfo.title}
          </h2>
          <p className="text-gray-600 mb-6">
            {statusInfo.message}
          </p>
          
          <div className="space-y-3">
            {(verificationStatus === 'rejected' || verificationStatus === 'draft' || !verificationStatus) && (
              <button
                onClick={handleRetryVerification}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
              >
                {verificationStatus === 'rejected' ? 'Update Verification' : 'Complete Verification'}
              </button>
            )}
            
            {verificationStatus === 'pending' && (
              <button
                onClick={checkVerificationStatus}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Check Status Again
              </button>
            )}
            
            <button
              onClick={handleLogout}
              className="w-full bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
        
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Need help? Contact support for assistance.</p>
        </div>
      </div>
    </div>
  );
}