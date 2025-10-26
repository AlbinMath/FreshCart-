import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { uploadLicense, getLicenseStatus } from '../../../backend/services/sellerService';

function SellerLicenseUpload() {
  const { currentUser, getUserProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [licenseFile, setLicenseFile] = useState(null);
  const [licensePreview, setLicensePreview] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [currentStatus, setCurrentStatus] = useState(null);

  useEffect(() => {
    // Pre-fill license number from local profile only; no backend role checks here
    const profile = getUserProfile();
    if (profile?.businessLicense) {
      setLicenseNumber(profile.businessLicense);
    }

    // Load current status (non-blocking)
    loadLicenseStatus();
  }, [getUserProfile]);

  const loadLicenseStatus = async () => {
    try {
      const status = await getLicenseStatus();
      setCurrentStatus(status);
    } catch (error) {
      console.error('Error loading license status:', error);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check file type (image only)
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setMessage({ type: 'error', text: 'Please upload a JPEG or PNG image' });
      return;
    }
    
    // Check file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'File size should be less than 5MB' });
      return;
    }
    
    setLicenseFile(file);
    setMessage({ type: '', text: '' });
    
    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLicensePreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setLicensePreview('');
    }
  };

  const handleUpload = async () => {
    if (!licenseFile || !licenseNumber.trim()) {
      setMessage({ type: 'error', text: 'Please enter a license number and select a file' });
      return;
    }

    // Validate expiry date if provided
    if (expiryDate && new Date(expiryDate) <= new Date()) {
      setMessage({ type: 'error', text: 'Expiry date must be in the future' });
      return;
    }

    // Role check only on click using local profile
    const profile = getUserProfile();
    const role = (profile?.role || '').toLowerCase();
    if (!['seller', 'store'].includes(role)) {
      setMessage({ type: 'error', text: 'Only seller accounts can upload a business license.' });
      return;
    }
    
    try {
      setLoading(true);
      setMessage({ type: '', text: '' });
      
      const formData = new FormData();
      formData.append('licenseNumber', licenseNumber.trim());
      formData.append('licenseFile', licenseFile);
      if (expiryDate) {
        formData.append('expiryDate', expiryDate);
      }
      
      await uploadLicense(formData);
      
      setMessage({ 
        type: 'success', 
        text: 'License uploaded successfully! It will be verified by our admin team.' 
      });
      
      // Clear the file input
      setLicenseFile(null);
      setLicensePreview('');
      document.getElementById('license-upload').value = '';
      
      // Reload status
      await loadLicenseStatus();
      
    } catch (error) {
      console.error('Error uploading license:', error);
      setMessage({ 
        type: 'error', 
        text: error.message || 'Failed to upload license. Please try again.' 
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Approved</span>;
      case 'pending':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Pending Review</span>;
      case 'rejected':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Rejected</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Not Uploaded</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate('/seller')}
            className="flex items-center space-x-2 text-green-600 hover:text-green-700 transition-colors bg-white px-4 py-2 rounded-lg shadow-md hover:shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="font-medium">Back to Dashboard</span>
          </button>
          
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Business License Upload</h1>
            <p className="text-gray-600">Upload your business license for verification</p>
          </div>
          
          <div className="w-32"></div>
        </div>

        {/* Current Status */}
        {currentStatus && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Current License Status</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Status: {getStatusBadge(currentStatus.status)}</p>
                {currentStatus.licenseNumber && (
                  <p className="text-sm text-gray-600 mt-1">License Number: {currentStatus.licenseNumber}</p>
                )}
                {currentStatus.rejectionReason && (
                  <p className="text-sm text-red-600 mt-1">Reason: {currentStatus.rejectionReason}</p>
                )}
              </div>
              {currentStatus.status === 'approved' && (
                <div className="text-green-600">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Message Display */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Upload Form */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-6">Upload License Document</h3>
          
          <div className="space-y-6">
            {/* License Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Business License Number
              </label>
              <input
                type="text"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="Example: AB123456"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                disabled={currentStatus?.status === 'approved'}
              />
              <p className="text-xs text-gray-500 mt-1">
                Format: 2 letters followed by 6 digits (e.g., AB123456)
              </p>
            </div>

            {/* Expiry Date (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                License Expiry Date (optional)
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                disabled={currentStatus?.status === 'approved'}
              />
              <p className="text-xs text-gray-500 mt-1">
                If provided, the date must be in the future.
              </p>
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                License Document
              </label>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4 text-center">
                        <svg className="w-8 h-8 mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                        </svg>
                        <p className="text-sm text-gray-500">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          JPG or PNG images only (MAX. 5MB)
                        </p>
                      </div>
                      <input 
                        id="license-upload"
                        type="file" 
                        className="hidden" 
                        accept=".jpg,.jpeg,.png"
                        onChange={handleFileChange}
                        disabled={loading || currentStatus?.status === 'approved'}
                      />
                    </label>
                  </div>
                </div>
                
                {licenseFile && (
                  <div className="w-full sm:w-48 flex-shrink-0">
                    <div className="border rounded-lg p-3 bg-gray-50 h-full flex flex-col">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-700 truncate">
                          {licenseFile.name}
                        </span>
                        <button 
                          type="button" 
                          onClick={() => {
                            setLicenseFile(null);
                            setLicensePreview('');
                            document.getElementById('license-upload').value = '';
                          }}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                          </svg>
                        </button>
                      </div>
                      
                      {licenseFile.type.startsWith('image/') && licensePreview && (
                        <div className="mt-2 flex-1 flex items-center justify-center bg-white rounded overflow-hidden">
                          <img 
                            src={licensePreview} 
                            alt="License preview" 
                            className="max-h-20 max-w-full object-contain"
                          />
                        </div>
                      )}
                      
                      {licenseFile.type === 'application/pdf' && (
                        <div className="mt-2 flex-1 flex flex-col items-center justify-center bg-white rounded p-2">
                          <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                          </svg>
                          <span className="text-xs text-gray-500 mt-1">PDF Document</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <p className="mt-2 text-xs text-gray-500">
                Upload a clear photo of your business license. Accepted formats: JPG, PNG (max 5MB)
              </p>
            </div>

            {/* Upload Button */}
            <div className="flex justify-end">
              <button
                onClick={handleUpload}
                disabled={loading || !licenseFile || !licenseNumber.trim() || currentStatus?.status === 'approved'}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 flex items-center"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading...
                  </>
                ) : (
                  'Upload License'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SellerLicenseUpload;
