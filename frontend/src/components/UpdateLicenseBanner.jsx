import React from 'react';
import { useNavigate } from 'react-router-dom';

// Simple banner prompting sellers to upload/update their license
// Props:
// - status: 'approved' | 'pending' | 'rejected' | undefined
// - onUploadSuccess: callback after successful upload (not used here, provided for API compatibility)
function UpdateLicenseBanner({ status = 'pending', onUploadSuccess }) {
  const navigate = useNavigate();

  const statusText =
    status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Pending Review';
  const color =
    status === 'approved' ? 'green' : status === 'rejected' ? 'red' : 'yellow';

  return (
    <div className={`rounded-md border p-4 bg-${color}-50 border-${color}-200`}> 
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className={`h-5 w-5 text-${color}-600`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className={`text-sm font-medium text-${color}-800`}>License {statusText}</h3>
          <div className={`mt-2 text-sm text-${color}-700`}>
            {status === 'approved' ? (
              <p>Your business license is approved. You can update it if needed.</p>
            ) : (
              <p>Your business license is not approved yet. Please upload or update your license to continue.</p>
            )}
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => navigate('/seller/license-upload')}
              className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {status === 'approved' ? 'Update License' : 'Upload License'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UpdateLicenseBanner;