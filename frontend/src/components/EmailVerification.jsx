import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { sendEmailVerification } from 'firebase/auth';

function EmailVerification() {
  const { currentUser, getUserProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const profile = getUserProfile && getUserProfile();

  const handleResendVerification = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      setMessage({ type: '', text: '' });
      
      await sendEmailVerification(currentUser);
      setMessage({ 
        type: 'success', 
        text: 'Verification email sent! Please check your inbox.' 
      });
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: `Failed to send verification email: ${error.message}` 
      });
    } finally {
      setLoading(false);
    }
  };

  // Hide for admins entirely and for verified users
  if (!currentUser || currentUser.emailVerified || (profile && profile.role === 'admin')) {
    return null;
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-yellow-800 font-medium">Email Verification Required</p>
            <p className="text-yellow-700 text-sm">
              Please verify your email address to access all features.
            </p>
          </div>
        </div>
        
        <button
          onClick={handleResendVerification}
          disabled={loading}
          className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition duration-200"
        >
          {loading ? 'Sending...' : 'Resend Verification'}
        </button>
      </div>

      {message.text && (
        <div className={`mt-3 p-3 rounded-lg text-sm ${
          message.type === 'success' 
            ? 'bg-green-100 text-green-800 border border-green-200' 
            : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}
    </div>
  );
}

export default EmailVerification;

