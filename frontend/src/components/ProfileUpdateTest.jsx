import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

function ProfileUpdateTest() {
  const { currentUser } = useAuth();
  const [testData, setTestData] = useState({
    name: '',
    phone: '',
    dateOfBirth: '',
    gender: 'male'
  });
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const testProfileUpdate = async () => {
    if (!currentUser) {
      setResult('❌ No user logged in');
      return;
    }

    setLoading(true);
    setResult('Testing profile update...');

    try {
      console.log('Testing profile update for:', currentUser.uid);
      console.log('Test data:', testData);

      const response = await fetch(`http://localhost:5000/api/users/test-update/${currentUser.uid}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData)
      });

      const responseText = await response.text();
      console.log('Raw response:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`Invalid JSON response: ${responseText}`);
      }

      if (response.ok && data.success) {
        setResult(`✅ Profile Update Test Successful!
Current User: ${data.currentUser.name} (${data.currentUser.role})
Proposed Updates: ${JSON.stringify(data.proposedUpdates, null, 2)}
Validation Status: ${data.validationStatus}`);
      } else {
        setResult(`❌ Profile Update Test Failed:
${data.message}
${data.errors ? JSON.stringify(data.errors, null, 2) : ''}
${data.details || ''}`);
      }
    } catch (error) {
      console.error('Profile update test error:', error);
      setResult(`❌ Profile Update Test Error:
${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const actualProfileUpdate = async () => {
    if (!currentUser) {
      setResult('❌ No user logged in');
      return;
    }

    setLoading(true);
    setResult('Performing actual profile update...');

    try {
      const response = await fetch(`http://localhost:5000/api/users/${currentUser.uid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData)
      });

      const responseText = await response.text();
      console.log('Update response:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`Invalid JSON response: ${responseText}`);
      }

      if (response.ok && data.success) {
        setResult(`✅ Actual Profile Update Successful!
Updated User: ${data.user.name}
Email: ${data.user.email}
Phone: ${data.user.phone}
Gender: ${data.user.gender}
Date of Birth: ${data.user.dateOfBirth}`);
      } else {
        setResult(`❌ Actual Profile Update Failed:
${data.message}
${data.errors ? JSON.stringify(data.errors, null, 2) : ''}
${data.details || ''}`);
      }
    } catch (error) {
      console.error('Actual profile update error:', error);
      setResult(`❌ Actual Profile Update Error:
${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setTestData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Profile Update Test</h2>
      
      {currentUser ? (
        <div className="space-y-4">
          <div className="bg-blue-50 p-3 rounded">
            <p><strong>Current User:</strong> {currentUser.email}</p>
            <p><strong>UID:</strong> {currentUser.uid}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                name="name"
                value={testData.name}
                onChange={handleInputChange}
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input
                type="text"
                name="phone"
                value={testData.phone}
                onChange={handleInputChange}
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date of Birth</label>
              <input
                type="date"
                name="dateOfBirth"
                value={testData.dateOfBirth}
                onChange={handleInputChange}
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Gender</label>
              <select
                name="gender"
                value={testData.gender}
                onChange={handleInputChange}
                className="w-full p-2 border rounded"
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer-not-to-say">Prefer not to say</option>
              </select>
            </div>
          </div>

          <div className="flex space-x-4">
            <button
              onClick={testProfileUpdate}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Testing...' : 'Test Update (Validation Only)'}
            </button>
            
            <button
              onClick={actualProfileUpdate}
              disabled={loading}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
            >
              {loading ? 'Updating...' : 'Actual Update'}
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

export default ProfileUpdateTest;