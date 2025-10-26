import React, { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';

function GoogleSignInTest() {
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const testDirectGoogleSignIn = async () => {
    setLoading(true);
    setResult('Testing direct Google sign-in...');

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });

      console.log('Starting Google sign-in popup...');
      const result = await signInWithPopup(auth, provider);
      
      console.log('Google sign-in successful:', result);
      setResult(`✅ Direct Google Sign-In Successful!
User: ${result.user.email}
UID: ${result.user.uid}
Display Name: ${result.user.displayName}
Photo URL: ${result.user.photoURL}
Provider: ${result.user.providerData[0]?.providerId}`);

    } catch (error) {
      console.error('Direct Google sign-in error:', error);
      
      let errorMessage = `❌ Direct Google Sign-In Failed:
Error Code: ${error.code || 'Unknown'}
Error Message: ${error.message || 'Unknown error'}`;

      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage += '\n\n💡 The popup was closed before completing sign-in.';
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage += '\n\n💡 The popup was blocked by your browser. Please allow popups for this site.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage += '\n\n💡 Network error. Check your internet connection.';
      }

      setResult(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const testFirebaseConfig = () => {
    setResult(`🔧 Firebase Configuration:
API Key: ${import.meta.env.VITE_FIREBASE_API_KEY ? 'Set' : 'Not set'}
Auth Domain: ${import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'freshcart-a4365.firebaseapp.com'}
Project ID: ${import.meta.env.VITE_FIREBASE_PROJECT_ID || 'freshcart-a4365'}

Auth Instance: ${auth ? 'Initialized' : 'Not initialized'}
Current User: ${auth.currentUser ? auth.currentUser.email : 'None'}`);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Google Sign-In Direct Test</h2>
      
      <div className="space-y-4">
        <div className="flex space-x-4">
          <button
            onClick={testDirectGoogleSignIn}
            disabled={loading}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:bg-gray-400"
          >
            {loading ? 'Testing...' : 'Test Direct Google Sign-In'}
          </button>
          
          <button
            onClick={testFirebaseConfig}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Check Firebase Config
          </button>
        </div>

        {result && (
          <div className="bg-gray-100 p-4 rounded">
            <pre className="text-sm whitespace-pre-wrap">{result}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default GoogleSignInTest;