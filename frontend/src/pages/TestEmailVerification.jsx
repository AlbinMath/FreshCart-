import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

function TestEmailVerification() {
  const { currentUser, needsEmailVerification, sendVerificationEmail, reloadUser } = useAuth();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendVerification = async () => {
    setLoading(true);
    try {
      await sendVerificationEmail();
      setMessage('Verification email sent! Check your inbox.');
    } catch (error) {
      setMessage('Error: ' + error.message);
    }
    setLoading(false);
  };

  const handleCheckStatus = async () => {
    setLoading(true);
    try {
      await reloadUser();
      if (currentUser.emailVerified) {
        setMessage('Email is now verified!');
      } else {
        setMessage('Email is still not verified.');
      }
    } catch (error) {
      setMessage('Error checking status: ' + error.message);
    }
    setLoading(false);
  };

  if (!currentUser) {
    return <div>Please log in first</div>;
  }

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">Email Verification Test</h2>
      
      <div className="space-y-4">
        <div>
          <p><strong>User:</strong> {currentUser.email}</p>
          <p><strong>Email Verified:</strong> {currentUser.emailVerified ? 'Yes' : 'No'}</p>
          <p><strong>Needs Verification:</strong> {needsEmailVerification() ? 'Yes' : 'No'}</p>
        </div>

        {needsEmailVerification() && (
          <div className="space-y-2">
            <button
              onClick={handleSendVerification}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Verification Email'}
            </button>
            
            <button
              onClick={handleCheckStatus}
              disabled={loading}
              className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Checking...' : 'Check Verification Status'}
            </button>
          </div>
        )}

        {message && (
          <div className="p-3 bg-gray-100 rounded">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

export default TestEmailVerification;