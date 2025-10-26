import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { CheckCircle, Clock, AlertCircle, Upload, FileText, User, Car, Camera, MapPin, Edit3, Save, X, ArrowLeft } from 'lucide-react';

export default function DeliveryVerificationPage() {
  const { currentUser, getUserProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [verification, setVerification] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formSaved, setFormSaved] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [verificationProgress, setVerificationProgress] = useState(0);
  const [uploadProgress, setUploadProgress] = useState({});

  // Form data state
  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    address: '',
    drivingLicense: {
      licenseNumber: '',
      expiryDate: ''
    },
    vehicle: {
      type: 'bike',
      registrationNumber: '',
      model: '',
      color: ''
    },
    emergencyContact: {
      name: '',
      relationship: '',
      phoneNumber: ''
    }
  });

  const vehicleTypes = [
    { value: 'bike', label: 'Motorcycle/Bike' },
    { value: 'scooter', label: 'Scooter' },
    { value: 'car', label: 'Car' },
    { value: 'van', label: 'Van' },
    { value: 'truck', label: 'Truck' },
    { value: 'bicycle', label: 'Bicycle' }
  ];

  const documentTypes = {
    license: {
      front: { label: 'License Front', required: true },
      back: { label: 'License Back', required: true }
    },
    vehicle: {
      front: { label: 'Vehicle Front', required: true },
      back: { label: 'Vehicle Back', required: true },
      rc: { label: 'Registration Certificate', required: true }
    }
  };

  // Steps configuration
  const steps = [
    { id: 1, title: 'Personal Information', icon: User, completed: false },
    { id: 2, title: 'Document Upload', icon: FileText, completed: false },
    { id: 3, title: 'Review & Submit', icon: CheckCircle, completed: false }
  ];

  useEffect(() => {
    const profile = getUserProfile();
    if (!currentUser || profile?.role !== 'delivery') {
      navigate('/login');
      return;
    }
    loadVerificationData();
  }, [currentUser]);

  // Load existing verification data
  const loadVerificationData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:5000/api/delivery-verification/${currentUser.uid}/status`);
      if (res.ok) {
        const data = await res.json();
        if (data.data.exists && data.data.verification) {
          const verificationData = data.data.verification;
          setVerification(verificationData);
          
          // Populate form with existing data
          setFormData({
            fullName: verificationData.fullName || '',
            phoneNumber: verificationData.phoneNumber || '',
            address: verificationData.address || '',
            drivingLicense: {
              licenseNumber: verificationData.drivingLicense?.licenseNumber || '',
              expiryDate: verificationData.drivingLicense?.expiryDate ? 
                new Date(verificationData.drivingLicense.expiryDate).toISOString().split('T')[0] : ''
            },
            vehicle: {
              type: verificationData.vehicle?.type || 'bike',
              registrationNumber: verificationData.vehicle?.registrationNumber || '',
              model: verificationData.vehicle?.model || '',
              color: verificationData.vehicle?.color || ''
            },
            emergencyContact: {
              name: verificationData.emergencyContact?.name || '',
              relationship: verificationData.emergencyContact?.relationship || '',
              phoneNumber: verificationData.emergencyContact?.phoneNumber || ''
            }
          });

          // Check if basic form is saved
          const hasBasicInfo = verificationData.fullName && verificationData.phoneNumber && 
                              verificationData.address && verificationData.drivingLicense?.licenseNumber && 
                              verificationData.vehicle?.registrationNumber;
          setFormSaved(hasBasicInfo);
          
          // Calculate progress and set current step
          calculateProgress(verificationData);
        }
      }
    } catch (error) {
      console.error('Error loading verification data:', error);
      toast.error('Error loading verification data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate verification progress
  const calculateProgress = (verificationData) => {
    let progress = 0;
    let step = 1;

    // Step 1: Personal Information (40%)
    const hasBasicInfo = verificationData.fullName && verificationData.phoneNumber && 
                        verificationData.address && verificationData.drivingLicense?.licenseNumber && 
                        verificationData.vehicle?.registrationNumber;
    
    if (hasBasicInfo) {
      progress += 40;
      step = 2;
    }

    // Step 2: Document Upload (50%)
    const documents = verificationData.documents || {};
    const requiredDocs = ['license.front', 'license.back', 'vehicle.front', 'vehicle.back', 'vehicle.rc'];
    const uploadedDocs = requiredDocs.filter(doc => {
      const [type, subtype] = doc.split('.');
      return documents[type] && documents[type][subtype];
    });

    if (uploadedDocs.length > 0) {
      progress += (uploadedDocs.length / requiredDocs.length) * 50;
      if (uploadedDocs.length === requiredDocs.length) {
        step = 3;
      }
    }

    // Step 3: Review (10%)
    if (verificationData.status === 'pending' || verificationData.status === 'approved') {
      progress += 10;
    }

    setVerificationProgress(Math.round(progress));
    setCurrentStep(step);
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const keys = name.split('.');
    
    if (keys.length === 1) {
      setFormData(prev => ({ ...prev, [name]: value }));
    } else if (keys.length === 2) {
      setFormData(prev => ({
        ...prev,
        [keys[0]]: { ...prev[keys[0]], [keys[1]]: value }
      }));
    }
  };

  // Validate required fields
  const validateRequiredFields = () => {
    const required = [
      { field: formData.fullName, name: 'Full Name' },
      { field: formData.phoneNumber, name: 'Phone Number' },
      { field: formData.address, name: 'Address' },
      { field: formData.drivingLicense.licenseNumber, name: 'License Number' },
      { field: formData.drivingLicense.expiryDate, name: 'License Expiry Date' },
      { field: formData.vehicle.type, name: 'Vehicle Type' },
      { field: formData.vehicle.registrationNumber, name: 'Vehicle Registration Number' }
    ];

    const missing = required.filter(item => !item.field || item.field.trim() === '');
    
    if (missing.length > 0) {
      toast.error(`Please fill in: ${missing.map(item => item.name).join(', ')}`);
      return false;
    }
    return true;
  };

  // Save form data
  const saveFormData = async () => {
    if (!validateRequiredFields()) {
      return false;
    }

    try {
      setLoading(true);
      
      const dataToSave = {
        fullName: formData.fullName,
        phoneNumber: formData.phoneNumber,
        address: formData.address,
        drivingLicense: {
          licenseNumber: formData.drivingLicense.licenseNumber,
          expiryDate: formData.drivingLicense.expiryDate
        },
        vehicle: {
          type: formData.vehicle.type,
          registrationNumber: formData.vehicle.registrationNumber,
          model: formData.vehicle.model || '',
          color: formData.vehicle.color || ''
        },
        emergencyContact: {
          name: formData.emergencyContact.name || '',
          relationship: formData.emergencyContact.relationship || '',
          phoneNumber: formData.emergencyContact.phoneNumber || ''
        },
        isDraft: true
      };

      const response = await fetch(`http://localhost:5000/api/delivery-verification/${currentUser.uid}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataToSave)
      });

      if (response.ok) {
        toast.success('Information saved successfully');
        setFormSaved(true);
        setIsEditing(false);
        setCurrentStep(2);
        await loadVerificationData();
        return true;
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Failed to save information');
        return false;
      }
    } catch (error) {
      console.error('Error saving form data:', error);
      toast.error('Error saving information');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const uploadDocument = async (documentType, imageType, file) => {
    if (!formSaved) {
      toast.error('Please save your personal information first');
      return;
    }

    try {
      const progressKey = `${documentType}-${imageType}`;
      setUploadProgress(prev => ({ ...prev, [progressKey]: 0 }));

      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('documentType', documentType);
      uploadFormData.append('imageType', imageType);

      const response = await fetch(`http://localhost:5000/api/delivery-verification/${currentUser.uid}/upload`, {
        method: 'POST',
        body: uploadFormData
      });

      if (response.ok) {
        toast.success(`${documentTypes[documentType][imageType].label} uploaded successfully`);
        await loadVerificationData();
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Upload failed');
    } finally {
      setUploadProgress(prev => {
        const updated = { ...prev };
        delete updated[`${documentType}-${imageType}`];
        return updated;
      });
    }
  };

  const deleteDocument = async (documentType, imageType) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:5000/api/delivery-verification/${currentUser.uid}/document?documentType=${documentType}&imageType=${imageType}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        toast.success('Document deleted successfully');
        await loadVerificationData();
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Failed to delete document');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'resubmission_required': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Render document upload section
  const renderDocumentUpload = (documentType, imageType) => {
    const document = verification?.documents?.[documentType]?.[imageType];
    const hasDocument = document && document.url;
    const progressKey = `${documentType}-${imageType}`;
    const isUploading = uploadProgress[progressKey] !== undefined;

    return (
      <div key={`${documentType}-${imageType}`} className="border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900">
            {documentTypes[documentType][imageType].label}
            {documentTypes[documentType][imageType].required && (
              <span className="text-red-500 ml-1">*</span>
            )}
          </h4>
          {hasDocument && (
            <span className="text-green-600 text-sm flex items-center">
              <CheckCircle className="w-4 h-4 mr-1" />
              Uploaded
            </span>
          )}
        </div>

        {hasDocument ? (
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <img 
                src={document.url} 
                alt={documentTypes[documentType][imageType].label}
                className="w-full max-w-xs h-32 object-cover rounded cursor-pointer hover:opacity-80"
                onClick={() => window.open(document.url, '_blank')}
              />
              <p className="text-sm text-gray-600 mt-2">
                {document.filename} ({(document.size / 1024).toFixed(1)} KB)
              </p>
              <p className="text-xs text-gray-500">
                Uploaded: {new Date(document.uploadedAt).toLocaleString()}
              </p>
            </div>
            <div className="flex space-x-2">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error('File size must be less than 5MB');
                      return;
                    }
                    uploadDocument(documentType, imageType, file);
                  }
                }}
                disabled={isUploading}
                className="hidden"
                id={`replace-${documentType}-${imageType}`}
              />
              <label
                htmlFor={`replace-${documentType}-${imageType}`}
                className="cursor-pointer inline-flex items-center px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                <Upload className="w-4 h-4 mr-1" />
                Replace
              </label>
              <button
                onClick={() => deleteDocument(documentType, imageType)}
                className="text-red-600 hover:text-red-800 text-sm flex items-center px-3 py-1 border border-red-200 rounded hover:bg-red-50"
              >
                <X className="w-4 h-4 mr-1" />
                Delete
              </button>
            </div>
          </div>
        ) : (
          <div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  if (file.size > 5 * 1024 * 1024) {
                    toast.error('File size must be less than 5MB');
                    return;
                  }
                  uploadDocument(documentType, imageType, file);
                }
              }}
              disabled={isUploading || !formSaved}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 disabled:opacity-50"
            />
            {!formSaved && (
              <p className="text-xs text-amber-600 mt-2">
                Please save your personal information first
              </p>
            )}
            {isUploading && (
              <div className="mt-2">
                <div className="text-sm text-gray-600">Uploading...</div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const submitForReview = async () => {
    if (!verification?.isComplete) {
      toast.error('Please upload all required documents before submitting');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/delivery-verification/${currentUser.uid}/submit`, {
        method: 'POST'
      });

      if (response.ok) {
        toast.success('Verification submitted for review successfully!');
        await loadVerificationData();
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Failed to submit for review');
      }
    } catch (error) {
      console.error('Error submitting for review:', error);
      toast.error('Error submitting for review');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !verification) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading verification data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Back Button */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <button
              onClick={() => navigate('/delivery')}
              className="inline-flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Dashboard
            </button>
            <div className="sm:text-right">
              <h1 className="text-2xl font-bold text-gray-900">Delivery Verification</h1>
              <p className="text-sm text-gray-600 mt-1">Complete verification to become a delivery partner</p>
            </div>
            {verification && (
              <div className="text-right">
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(verification.status)}`}>
                  {verification.readableStatus || verification.status}
                </span>
                {verification.completionPercentage !== undefined && (
                  <p className="text-sm text-gray-600 mt-1">
                    {verification.completionPercentage}% Complete
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Alert */}
        {verification && verification.status === 'rejected' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
              </svg>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Verification Rejected</h3>
                <p className="text-sm text-red-700 mt-1">{verification.rejectionReason || verification.reviewComments}</p>
                <p className="text-sm text-red-600 mt-2">Please reupload the required documents and resubmit.</p>
              </div>
            </div>
          </div>
        )}

        {verification && verification.status === 'resubmission_required' && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <svg className="w-5 h-5 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
              </svg>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-orange-800">Resubmission Required</h3>
                <p className="text-sm text-orange-700 mt-1">{verification.rejectionReason || verification.reviewComments}</p>
                <p className="text-sm text-orange-600 mt-2">Please address the issues and resubmit your verification.</p>
              </div>
            </div>
          </div>
        )}

        {verification && verification.status === 'approved' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Verification Approved!</h3>
                <p className="text-sm text-green-700 mt-1">Your verification has been approved. You can now access the delivery dashboard and accept orders.</p>
                {verification.reviewComments && (
                  <p className="text-sm text-green-600 mt-2">Admin Comments: {verification.reviewComments}</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Form Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Personal Information</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    rows="3"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Driving License Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Driving License Information</h2>
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">License Number *</label>
                  <input
                    type="text"
                    name="drivingLicense.licenseNumber"
                    value={formData.drivingLicense.licenseNumber}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date *</label>
                  <input
                    type="date"
                    name="drivingLicense.expiryDate"
                    value={formData.drivingLicense.expiryDate}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
              </div>

              <h3 className="text-lg font-medium mb-4">License Documents</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {renderDocumentUpload('license', 'front')}
                {renderDocumentUpload('license', 'back')}
              </div>
            </div>

            {/* Vehicle Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Vehicle Information</h2>
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type *</label>
                  <select
                    name="vehicle.type"
                    value={formData.vehicle.type}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  >
                    {vehicleTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Registration Number *</label>
                  <input
                    type="text"
                    name="vehicle.registrationNumber"
                    value={formData.vehicle.registrationNumber}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Make</label>
                  <input
                    type="text"
                    name="vehicle.make"
                    value={formData.vehicle.make}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                  <input
                    type="text"
                    name="vehicle.model"
                    value={formData.vehicle.model}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <input
                    type="number"
                    name="vehicle.year"
                    value={formData.vehicle.year}
                    onChange={handleInputChange}
                    min="1900"
                    max={new Date().getFullYear() + 1}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                  <input
                    type="text"
                    name="vehicle.color"
                    value={formData.vehicle.color}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <h3 className="text-lg font-medium mb-4">Vehicle Documents</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {renderDocumentUpload('vehicle', 'front')}
                {renderDocumentUpload('vehicle', 'back')}
                {renderDocumentUpload('vehicle', 'rc')}
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Emergency Contact</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    name="emergencyContact.name"
                    value={formData.emergencyContact.name}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
                  <input
                    type="text"
                    name="emergencyContact.relationship"
                    value={formData.emergencyContact.relationship}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    name="emergencyContact.phoneNumber"
                    value={formData.emergencyContact.phoneNumber}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Status Sidebar */}
          <div className="space-y-6">
            {/* Progress Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Verification Progress</h3>
              {verification && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Overall Progress</span>
                      <span>{verification.completionPercentage || 0}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${verification.completionPercentage || 0}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${verification.drivingLicense?.frontImage?.filename ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span>License Front Image</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${verification.drivingLicense?.backImage?.filename ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span>License Back Image</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${verification.vehicle?.frontImage?.filename ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span>Vehicle Front Image</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${verification.vehicle?.backImage?.filename ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span>Vehicle Back Image</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${verification.vehicle?.rcImage?.filename ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span>Registration Certificate</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="space-y-3">
                <button
                  onClick={saveFormData}
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
                >
                  {loading ? 'Saving...' : 'Save Information'}
                </button>
                
                {verification && verification.isComplete && verification.status !== 'under_review' && verification.status !== 'approved' && (
                  <button
                    onClick={submitForReview}
                    disabled={loading}
                    className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:bg-green-400 transition-colors"
                  >
                    {loading ? 'Submitting...' : 'Submit for Review'}
                  </button>
                )}

                {verification && verification.status === 'approved' && (
                  <button
                    onClick={() => navigate('/delivery/dashboard')}
                    className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Go to Dashboard
                  </button>
                )}
              </div>
            </div>

            {/* Requirements */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Requirements</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p>• All images must be clear and readable</p>
                <p>• File size limit: 5MB per image</p>
                <p>• Accepted formats: JPG, PNG, GIF</p>
                <p>• License must be valid and not expired</p>
                <p>• Vehicle registration must be current</p>
                <p>• Upload: License (front & back), Vehicle (front & back), Registration certificate</p>
                <p>• All required fields must be completed</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
