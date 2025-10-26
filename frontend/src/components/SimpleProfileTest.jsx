import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

function SimpleProfileTest() {
  const { currentUser, updateUserProfile } = useAuth();
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const testSimpleUpdate = async () => {
    if (!currentUser) {
      setResult('❌ No user logged in');
      return;
    }

    setLoading(true);
    setResult('Testing simple profile update...');

    try {
      // Test with minimal data
      const testData = {
        name: 'Test User Updated',
        phone: '+1234567890'
      };

      console.log('Testing with data:', testData);
      
      const success = await updateUserProfile(testData);
      
      if (success) {
        setResult(`✅ Simple Profile Update Successful!
Updated: ${JSON.stringify(testData, null, 2)}`);
      } else {
        setResult('❌ Profile update returned false');
      }
    } catch (error) {
      console.error('Simple profile update error:', error);
      setResult(`❌ Simple Profile Update Failed:
${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testDirectAPI = async () => {
    if (!currentUser) {
      setResult('❌ No user logged in');
      return;
    }

    setLoading(true);
    setResult('Testing direct API call...');

    try {
      const testData = {
        name: 'Direct API Test',
        phone: '+9876543210'
      };

      console.log('Direct API test with data:', testData);
      
      const response = await fetch(`http://localhost:5000/api/users/${currentUser.uid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData)
      });

      const responseText = await response.text();
      console.log('Direct API response:', responseText);

      if (response.ok) {
        const data = JSON.parse(responseText);
        setResult(`✅ Direct API Update Successful!
Response: ${JSON.stringify(data, null, 2)}`);
      } else {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = { message: responseText };
        }
        
        setResult(`❌ Direct API Update Failed:
Status: ${response.status}
Error: ${JSON.stringify(errorData, null, 2)}`);
      }
    } catch (error) {
      console.error('Direct API error:', error);
      setResult(`❌ Direct API Error:
${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Simple Profile Update Test</h2>
      
      {currentUser ? (
        <div className="space-y-4">
          <div className="bg-blue-50 p-3 rounded">
            <p><strong>Current User:</strong> {currentUser.email}</p>
            <p><strong>UID:</strong> {currentUser.uid}</p>
          </div>

          <div className="flex space-x-4">
            <button
              onClick={testSimpleUpdate}
              disabled={loading}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
            >
              {loading ? 'Testing...' : 'Test via AuthContext'}
            </button>
            
            <button
              onClick={testDirectAPI}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Testing...' : 'Test Direct API'}
            </button>
          </div>

          {result && (
            <div className="bg-gray-100 p-4 rounded">
              <pre className="text-sm whitespace-pre-wrap">{result}</pre>
            </div>
          )}
        </div>
      ) : (
        <p className="text-gray-600">Please log in to test profile updates</p>
      )}
    </div>
  );
}

export default SimpleProfileTest;