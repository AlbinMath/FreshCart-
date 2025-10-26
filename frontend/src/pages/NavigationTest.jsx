import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function NavigationTest() {
  const { currentUser, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Navigation & Authentication Test</h1>
          
          {/* Current User Status */}
          <div className="mb-8 p-4 bg-gray-50 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Current User Status</h2>
            {currentUser ? (
              <div>
                <p><strong>Email:</strong> {currentUser.email}</p>
                <p><strong>Email Verified:</strong> {currentUser.emailVerified ? 'Yes' : 'No'}</p>
                <p><strong>Display Name:</strong> {currentUser.displayName || 'Not set'}</p>
                <p><strong>Provider:</strong> {currentUser.providerData[0]?.providerId || 'Unknown'}</p>
                <button
                  onClick={handleLogout}
                  className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                >
                  Logout
                </button>
              </div>
            ) : (
              <p>No user logged in</p>
            )}
          </div>

          {/* Navigation Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <Link
              to="/"
              className="bg-green-600 text-white p-4 rounded-lg text-center hover:bg-green-700 transition-colors"
            >
              🏠 Home Page
            </Link>
            
            <Link
              to="/login"
              className="bg-blue-600 text-white p-4 rounded-lg text-center hover:bg-blue-700 transition-colors"
            >
              🔐 Login Page
            </Link>
            
            <Link
              to="/register"
              className="bg-purple-600 text-white p-4 rounded-lg text-center hover:bg-purple-700 transition-colors"
            >
              📝 Customer Register
            </Link>
            
            <Link
              to="/register/store"
              className="bg-orange-600 text-white p-4 rounded-lg text-center hover:bg-orange-700 transition-colors"
            >
              🏪 Store Register
            </Link>
            
            <Link
              to="/register/delivery"
              className="bg-yellow-600 text-white p-4 rounded-lg text-center hover:bg-yellow-700 transition-colors"
            >
              🚚 Delivery Register
            </Link>
            
            
            
            <Link
              to="/profile"
              className="bg-indigo-600 text-white p-4 rounded-lg text-center hover:bg-indigo-700 transition-colors"
            >
              👤 Profile Page
            </Link>
            
            <Link
              to="/test-email"
              className="bg-teal-600 text-white p-4 rounded-lg text-center hover:bg-teal-700 transition-colors"
            >
              📧 Email Test
            </Link>
            
            <Link
              to="/images"
              className="bg-pink-600 text-white p-4 rounded-lg text-center hover:bg-pink-700 transition-colors"
            >
              🖼️ Image Gallery
            </Link>
            
            <Link
              to="/auth-test"
              className="bg-red-600 text-white p-4 rounded-lg text-center hover:bg-red-700 transition-colors"
            >
              🔐 Auth Test
            </Link>
          </div>

          {/* Test Instructions */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-yellow-800">Test Instructions</h2>
            <div className="space-y-2 text-yellow-700">
              <p><strong>1. Home Button Test:</strong> Go to any login/register page and click the "Home" button</p>
              <p><strong>2. Back Button Test:</strong> Login, then use browser back button - should logout automatically</p>
              <p><strong>3. Email Verification:</strong> Register with email/password, check profile for verification banner</p>
              <p><strong>4. Profile Image:</strong> Go to profile and test image upload functionality</p>
              <p><strong>5. Store Registration:</strong> Test store registration with email verification</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NavigationTest;