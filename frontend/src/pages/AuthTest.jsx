import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import GoogleSignInTest from '../components/GoogleSignInTest';
import ProfileUpdateTest from '../components/ProfileUpdateTest';
import SimpleProfileTest from '../components/SimpleProfileTest';

function AuthTest() {
  const { currentUser, signInWithGoogle, logout } = useAuth();
  const [testResult, setTestResult] = useState('');
  const [loading, setLoading] = useState(false);

  const testGoogleSignIn = async () => {
    setLoading(true);
    setTestResult('Testing Google Sign-In...');
    
    try {
      const result = await signInWithGoogle();
      setTestResult(`✅ Google Sign-In Successful!\nUser: ${result.user.email}\nUID: ${result.user.uid}`);
    } catch (error) {
      setTestResult(`❌ Google Sign-In Failed:\n${error.message}`);
      console.error('Google Sign-In Test Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const testLogout = async () => {
    setLoading(true);
    setTestResult('Testing Logout...');
    
    try {
      await logout();
      setTestResult('✅ Logout Successful!');
    } catch (error) {
      setTestResult(`❌ Logout Failed:\n${error.message}`);
      console.error('Logout Test Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const testBackendConnection = async () => {
    setLoading(true);
    setTestResult('Testing Backend Connection...');
    
    try {
      const response = await fetch('http://localhost:5000/api/auth/test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTestResult(`✅ Backend Connection Successful!\nResponse: ${JSON.stringify(data, null, 2)}`);
      } else {
        setTestResult(`❌ Backend Connection Failed!\nStatus: ${response.status}\nStatusText: ${response.statusText}`);
      }
    } catch (error) {
      setTestResult(`❌ Backend Connection Error:\n${error.message}`);
      console.error('Backend Test Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link
            to="/"
            className="flex items-center space-x-2 text-green-600 hover:text-green-700 transition-colors bg-white px-4 py-2 rounded-lg shadow-md hover:shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="font-medium">Home</span>
          </Link>
          
          <h1 className="text-3xl font-bold text-gray-900">Authentication Test</h1>
          
          <div className="w-20"></div>
        </div>

        {/* Current User Status */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Current User Status</h2>
          {currentUser ? (
            <div className="space-y-2">
              <p><strong>Email:</strong> {currentUser.email}</p>
              <p><strong>Display Name:</strong> {currentUser.displayName || 'Not set'}</p>
              <p><strong>UID:</strong> {currentUser.uid}</p>
              <p><strong>Email Verified:</strong> {currentUser.emailVerified ? 'Yes' : 'No'}</p>
              <p><strong>Provider:</strong> {currentUser.providerData[0]?.providerId || 'Unknown'}</p>
              <p><strong>Photo URL:</strong> {currentUser.photoURL || 'None'}</p>
            </div>
          ) : (
            <p className="text-gray-600">No user logged in</p>
          )}
        </div>

        {/* Test Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <button
            onClick={testGoogleSignIn}
            disabled={loading || currentUser}
            className="bg-red-600 text-white p-4 rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors"
          >
            {loading ? 'Testing...' : 'Test Google Sign-In'}
          </button>
          
          <button
            onClick={testLogout}
            disabled={loading || !currentUser}
            className="bg-gray-600 text-white p-4 rounded-lg hover:bg-gray-700 disabled:bg-gray-400 transition-colors"
          >
            {loading ? 'Testing...' : 'Test Logout'}
          </button>
          
          <button
            onClick={testBackendConnection}
            disabled={loading}
            className="bg-blue-600 text-white p-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {loading ? 'Testing...' : 'Test Backend'}
          </button>
        </div>

        {/* Google Sign-In Direct Test */}
        <GoogleSignInTest />

        {/* Simple Profile Test */}
        <SimpleProfileTest />

        {/* Profile Update Test */}
        <ProfileUpdateTest />

        {/* Test Results */}
        {testResult && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Context Test Results</h2>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto whitespace-pre-wrap">
              {testResult}
            </pre>
          </div>
        )}

        {/* Navigation Links */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Navigation</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link to="/login" className="bg-blue-600 text-white p-3 rounded text-center hover:bg-blue-700">
              Login Page
            </Link>
            <Link to="/register" className="bg-green-600 text-white p-3 rounded text-center hover:bg-green-700">
              Register Page
            </Link>
            <Link to="/profile" className="bg-purple-600 text-white p-3 rounded text-center hover:bg-purple-700">
              Profile Page
            </Link>
            <Link to="/nav-test" className="bg-orange-600 text-white p-3 rounded text-center hover:bg-orange-700">
              Nav Test
            </Link>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4 text-yellow-800">Test Instructions</h2>
          <div className="space-y-2 text-yellow-700">
            <p><strong>1. Google Sign-In Test:</strong> Click "Test Google Sign-In" to verify Google authentication works</p>
            <p><strong>2. Backend Test:</strong> Click "Test Backend" to verify server connection</p>
            <p><strong>3. Logout Test:</strong> After signing in, click "Test Logout" to verify logout functionality</p>
            <p><strong>4. Navigation Test:</strong> Use the navigation links to test page redirections</p>
            <p><strong>5. Browser Console:</strong> Check browser console for detailed error messages</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthTest;