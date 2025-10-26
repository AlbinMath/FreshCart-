import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const LicenseVerification = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pendingLicenses, setPendingLicenses] = useState([]);
  const [processingId, setProcessingId] = useState(null);
  // Normalize API base and build absolute URLs for uploaded files
  const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').trim().replace(/\/+$/, '');
  const BASE_ORIGIN = API_BASE_URL.replace(/\/+api$/, '');
  const toAbsolute = (u) => (/^https?:\/\//i.test(u || '') ? u : `${BASE_ORIGIN}${u || ''}`);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') {
      navigate('/');
      return;
    }
    loadPendingLicenses();
  }, [currentUser, navigate]);

  const loadPendingLicenses = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/admin/licenses/pending`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Normalize items to expected shape
        const sellers = (data?.sellers || []).map(s => ({
          _id: s._id,
          sellerName: s.name,
          storeName: s.storeName,
          status: s.licenseInfo?.status || 'pending',
          licenseNumber: s.licenseInfo?.licenseNumber,
          documentUrl: s.licenseInfo?.file?.url ? toAbsolute(s.licenseInfo.file.url) : '',
          rejectionReason: s.licenseInfo?.rejectionReason || '',
          createdAt: s.createdAt
        }));
        setPendingLicenses(sellers);
      } else {
        toast.error('Failed to load pending licenses');
      }
    } catch (error) {
      console.error('Error loading pending licenses:', error);
      toast.error('Error loading pending licenses');
    } finally {
      setLoading(false);
    }
  };

  const handleLicenseAction = async (licenseId, action, rejectionReason = '') => {
    try {
      setProcessingId(licenseId);
      
      const response = await fetch(`${API_BASE_URL}/admin/licenses/verify/${licenseId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: action === 'approve' ? 'approved' : 'rejected', rejectionReason })
      });

      if (response.ok) {
        toast.success(`License ${action}ed successfully`);
        loadPendingLicenses(); // Reload the list
      } else {
        const error = await response.json();
        toast.error(error.message || `Failed to ${action} license`);
      }
    } catch (error) {
      console.error(`Error ${action}ing license:`, error);
      toast.error(`Error ${action}ing license`);
    } finally {
      setProcessingId(null);
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
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Unknown</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading license verifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">License Verification</h1>
              <p className="mt-2 text-gray-600">Review and approve business licenses for sellers</p>
            </div>
            <button
              onClick={() => navigate('/admin')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Admin Dashboard
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Pending Review</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {pendingLicenses.filter(l => l.status === 'pending').length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Approved</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {pendingLicenses.filter(l => l.status === 'approved').length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Rejected</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {pendingLicenses.filter(l => l.status === 'rejected').length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* License List */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Business License Applications</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Review and verify business licenses submitted by sellers
            </p>
          </div>
          
          {pendingLicenses.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No license applications</h3>
              <p className="mt-1 text-sm text-gray-500">No business licenses are currently pending review.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {pendingLicenses.map((license) => (
                <li key={license._id} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-700">
                              {license.sellerName?.charAt(0) || 'S'}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {license.sellerName || 'Unknown Seller'}
                          </p>
                          <p className="text-sm text-gray-500 truncate">
                            {license.storeName || 'No store name'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="mt-2 flex items-center space-x-4">
                        <div>
                          <span className="text-xs text-gray-500">License Number:</span>
                          <span className="ml-1 text-sm font-medium text-gray-900">
                            {license.licenseNumber || 'Not provided'}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Submitted:</span>
                          <span className="ml-1 text-sm text-gray-900">
                            {new Date(license.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div>
                          {getStatusBadge(license.status)}
                        </div>
                      </div>

                      {license.rejectionReason && (
                        <div className="mt-2">
                          <span className="text-xs text-red-500">Rejection Reason:</span>
                          <p className="text-sm text-red-700">{license.rejectionReason}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* View License Document */}
                      {license.documentUrl && (
                        <a
                          href={license.documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View Document
                        </a>
                      )}

                      {/* Action Buttons */}
                      {license.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleLicenseAction(license._id, 'approve')}
                            disabled={processingId === license._id}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                          >
                            {processingId === license._id ? (
                              <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                            Approve
                          </button>
                          
                          <button
                            onClick={() => {
                              const reason = prompt('Please provide a reason for rejection:');
                              if (reason && reason.trim()) {
                                handleLicenseAction(license._id, 'reject', reason.trim());
                              }
                            }}
                            disabled={processingId === license._id}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default LicenseVerification;

