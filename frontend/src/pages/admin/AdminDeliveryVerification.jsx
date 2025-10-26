import React, { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { toast } from "react-hot-toast";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const DEFAULT_PAGE_SIZE = 20;
const STATUS_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" }
];

export default function AdminDeliveryVerification() {
  const { getUserProfile } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [reviewComments, setReviewComments] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [paging, setPaging] = useState({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    totalPages: 1,
    totalItems: 0
  });
    const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("submittedAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [details, setDetails] = useState(null);

  const API_BASE_URL = useMemo(() => {
    const base = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api").trim();
    return base.replace(/\/$/, "");
  }, []);

  useEffect(() => {
    loadRequests();
  }, [statusFilter, paging.page, paging.limit, sortBy, sortOrder, searchTerm]);

  // Test to ensure component loads
  useEffect(() => {
    console.log("AdminDeliveryVerification component mounted");
  }, []);

  const buildHeaders = () => {
    const profile = getUserProfile() || {};
    const token = localStorage.getItem("token");
    const headers = { Accept: "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (profile.uid) headers["x-actor-uid"] = profile.uid;
    if (profile.email) headers["x-actor-email"] = profile.email.toLowerCase();
    return headers;
  };

  const loadRequests = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append("page", paging.page.toString());
      params.append("limit", paging.limit.toString());
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      if (searchTerm) params.append("search", searchTerm.trim());
      if (sortBy) params.append("sortBy", sortBy);
      if (sortOrder) params.append("sortOrder", sortOrder);

      console.log("Fetching requests from:", `${API_BASE_URL}/admin/delivery-verifications?${params.toString()}`);

      const response = await fetch(`${API_BASE_URL}/admin/delivery-verifications?${params.toString()}`, {
        headers: buildHeaders()
      });

      console.log("Response status:", response.status);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch delivery verification requests`);
      }

      const payload = await response.json();
      console.log("Response payload:", payload);
      
      if (!payload.success) {
        throw new Error(payload.message || "Failed to fetch delivery verification requests");
      }

      setRequests(payload.data || []);
      setPaging(prev => ({
        ...prev,
        totalPages: payload.pagination?.totalPages || 1,
        totalItems: payload.pagination?.totalItems || 0
      }));

      console.log("Loaded requests:", payload.data?.length || 0);
    } catch (error) {
      console.error("Error loading delivery verification requests:", error);
      toast.error(error.message || "Unable to load delivery verification requests");
      // Set empty data on error
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRequestDetails = async (verificationId) => {
    try {
      setIsFetchingDetails(true);
      const response = await fetch(`${API_BASE_URL}/admin/delivery-verification/${verificationId}`, {
        headers: buildHeaders()
      });

      if (!response.ok) {
        throw new Error("Failed to fetch verification details");
      }

      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.message || "Failed to fetch verification details");
      }

      setDetails(payload.data);
      setReviewComments(payload.data?.reviewComments || "");
      setRejectionReason(payload.data?.rejectionReason || "");
    } catch (error) {
      console.error("Error fetching verification details:", error);
      toast.error(error.message || "Unable to load verification details");
    } finally {
      setIsFetchingDetails(false);
    }
  };

  const handleOpenDetails = (request) => {
    setSelectedRequest(request);
    setIsModalOpen(true);
    setDetails(null);
    setRejectionReason("");
    setReviewComments("");
    if (request?.id) {
      fetchRequestDetails(request.id);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedRequest(null);
    setDetails(null);
    setRejectionReason("");
    setReviewComments("");
  };

  const handleReviewAction = async (verificationId, action) => {
    try {
      const payload = {
        action,
        comments: reviewComments
      };

      if (action === "reject") {
        if (!rejectionReason.trim()) {
          toast.error("Please provide a rejection reason");
          return;
        }
        payload.rejectionReason = rejectionReason.trim();
      }

      const response = await fetch(`${API_BASE_URL}/admin/delivery-verification/${verificationId}/review`, {
        method: "POST",
        headers: {
          ...buildHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} verification`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || `Failed to ${action} verification`);
      }

      toast.success(result.message || `Verification ${action}d successfully`);
      closeModal();
      // Refresh the current list to show updated status
      loadRequests();
      
      // If we were viewing all requests or the status filter matches the new status,
      // the item will remain visible with updated review information
      if (statusFilter === 'all' || 
          (action === 'approve' && statusFilter === 'approved') ||
          (action === 'reject' && statusFilter === 'rejected')) {
        // Item will remain visible with updated status
      } else {
        // Show a message that the item moved to a different status
        setTimeout(() => {
          toast.success(`Item moved to ${action === 'approve' ? 'approved' : 'rejected'} status. Switch filter to see it.`);
        }, 1000);
      }
    } catch (error) {
      console.error(`Error performing action ${action}:`, error);
      toast.error(error.message || `Unable to ${action} verification`);
    }
  };

  const onChangeStatusFilter = (value) => {
    setPaging(prev => ({ ...prev, page: 1 }));
    setStatusFilter(value);
  };

  const handlePageChange = (direction) => {
    setPaging(prev => ({
      ...prev,
      page: Math.min(Math.max(1, prev.page + direction), prev.totalPages || 1)
    }));
  };

  const renderRequestCard = (request) => {
    const submittedLabel = request.submittedAt ? format(new Date(request.submittedAt), "MMM d, yyyy h:mm a") : "N/A";
    
    // Enhanced review label with reviewer information
    let reviewLabel = "Pending";
    if (request.reviewedAt) {
      const reviewDate = format(new Date(request.reviewedAt), "MMM d, yyyy h:mm a");
      const reviewerName = request.reviewedBy?.name || request.reviewedBy?.email || 'Admin';
      reviewLabel = `${reviewDate} by ${reviewerName}`;
    }

    return (
      <div key={request.id} className="card mb-4 shadow-sm">
        <div className="card-body">
          <div className="row align-items-start">
            <div className="col-lg-6">
              <h5 className="card-title mb-2">{request.fullName || "Unnamed Delivery Partner"}</h5>
              <div className="text-muted small">
                <p className="mb-1">{request.email || "No email"}</p>
                <p className="mb-1">{request.phone || "No phone"}</p>
              </div>
            </div>
            <div className="col-lg-6 text-lg-end">
              <span className={`badge ${getStatusBadgeClass(request.status)} me-2`}>
                {request.status}
              </span>
              {request.completionPercentage !== undefined && (
                <span className="text-muted small">Completion {request.completionPercentage}%</span>
              )}
            </div>
          </div>

          <div className="row mt-3">
            <div className="col-md-4">
              <h6 className="fw-bold text-dark">Vehicle</h6>
              <p className="mb-1 small text-muted">{request.vehicle?.make || request.vehicleMake || "-"} {request.vehicle?.model || request.vehicleModel || ""}</p>
              <p className="mb-1 small text-muted">Type: {request.vehicle?.type || request.vehicleType || "-"}</p>
              <p className="mb-1 small text-muted">Plate: {request.vehicle?.registrationNumber || request.vehicleNumber || "-"}</p>
            </div>
            <div className="col-md-4">
              <h6 className="fw-bold text-dark">Documents</h6>
              <p className="mb-1 small text-muted">License #: {request.license?.licenseNumber || "N/A"}</p>
              <p className="mb-1 small text-muted">License expiry: {request.license?.expiryDate ? format(new Date(request.license.expiryDate), "MMM d, yyyy") : "Not provided"}</p>
            </div>
            <div className="col-md-4">
              <h6 className="fw-bold text-dark">Timeline</h6>
              <p className="mb-1 small text-muted">Submitted: {submittedLabel}</p>
              <p className="mb-1 small text-muted">Reviewed: {reviewLabel}</p>
            </div>
          </div>

          <div className="d-flex flex-wrap gap-2 mt-3">
            <button
              onClick={() => handleOpenDetails(request)}
              className="btn btn-outline-secondary btn-sm"
            >
              View details
            </button>
            {request.status === "pending" && (
              <>
                <button
                  onClick={() => handleReviewAction(request.id, "approve")}
                  className="btn btn-success btn-sm"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleReviewAction(request.id, "reject")}
                  className="btn btn-danger btn-sm"
                >
                  Reject
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "approved":
        return "bg-success";
      case "rejected":
        return "bg-danger";
      case "draft":
        return "bg-secondary";
      default:
        return "bg-warning";
    }
  };

  return (
    <div className="container-fluid py-4">
      <div className="row mb-4">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h1 className="h2 fw-bold text-dark mb-1">Delivery Partner Verification</h1>
              <p className="text-muted mb-0">Review onboarding submissions and approve or reject delivery partners.</p>
            </div>
            <button
              onClick={() => navigate('/admin')}
              className="btn btn-outline-primary"
            >
              <i className="bi bi-arrow-left me-2"></i>
              Back to Dashboard
            </button>
          </div>
          
          <div className="row g-3 align-items-center">
            <div className="col-auto">
              <select
                value={statusFilter}
                onChange={(e) => onChangeStatusFilter(e.target.value)}
                className="form-select"
                style={{ width: '160px' }}
              >
                {STATUS_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="col-auto">
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPaging(prev => ({ ...prev, page: 1 }));
                }}
                placeholder="Search by name, email or UID"
                className="form-control"
                style={{ width: '250px' }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="row mb-4">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center">
            <div className="text-muted small">
              Showing page <strong>{paging.page}</strong> of <strong>{paging.totalPages}</strong>
              {paging.totalItems ? <span className="ms-2">({paging.totalItems} total)</span> : null}
            </div>
            <div className="btn-group" role="group">
              <button
                disabled={paging.page <= 1}
                onClick={() => handlePageChange(-1)}
                className="btn btn-outline-secondary btn-sm"
              >
                Previous
              </button>
              <button
                disabled={paging.page >= paging.totalPages}
                onClick={() => handlePageChange(1)}
                className="btn btn-outline-secondary btn-sm"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-12">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-5">
              <div className="h5 text-muted mb-2">No delivery verification requests found</div>
              <div className="text-muted">
                {statusFilter === "pending" ? "No pending requests at the moment." : "Try changing the filter or search criteria."}
              </div>
            </div>
          ) : (
            requests.map(renderRequestCard)
          )}
        </div>
      </div>

      {/* Bootstrap Modal */}
      {isModalOpen && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Verification Details</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={closeModal}
                  aria-label="Close"
                ></button>
              </div>
              <div className="modal-body" style={{ maxHeight: '70vh' }}>
                {isFetchingDetails ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                ) : !details ? (
                  <div className="text-center py-5 text-muted">Unable to load details.</div>
                ) : (
                  <div className="row g-4">
                    {/* Personal Information */}
                    <div className="col-md-6">
                      <div className="card bg-light">
                        <div className="card-body">
                          <h6 className="card-title fw-bold">Personal Information</h6>
                          <p className="mb-1"><strong>Name:</strong> {details.personalInfo?.fullName || "-"}</p>
                          <p className="mb-1"><strong>Email:</strong> {details.personalInfo?.email || "-"}</p>
                          <p className="mb-1"><strong>Phone:</strong> {details.personalInfo?.phone || "-"}</p>
                          <p className="mb-0"><strong>Address:</strong> {details.personalInfo?.address || "-"}</p>
                        </div>
                      </div>
                    </div>

                    {/* Emergency Contact */}
                    <div className="col-md-6">
                      <div className="card bg-light">
                        <div className="card-body">
                          <h6 className="card-title fw-bold">Emergency Contact</h6>
                          <p className="mb-1"><strong>Name:</strong> {details.emergencyContact?.name || "-"}</p>
                          <p className="mb-1"><strong>Relationship:</strong> {details.emergencyContact?.relationship || "-"}</p>
                          <p className="mb-0"><strong>Phone:</strong> {details.emergencyContact?.phone || "-"}</p>
                        </div>
                      </div>
                    </div>

                    {/* Driving License Information */}
                    <div className="col-12">
                      <div className="card bg-light">
                        <div className="card-body">
                          <h6 className="card-title fw-bold">Driving License</h6>
                          <div className="row">
                            <div className="col-md-6">
                              <p className="mb-1"><strong>License Number:</strong> {details.license?.number || "-"}</p>
                              <p className="mb-3"><strong>Expiry Date:</strong> {details.license?.expiryDate ? format(new Date(details.license.expiryDate), "MMM d, yyyy") : "-"}</p>
                            </div>
                          </div>
                          
                          {/* License Images */}
                          <div className="row g-3">
                            {details.license?.frontImageUrl && (
                              <div className="col-md-6">
                                <h6 className="fw-bold small">License Front</h6>
                                <div className="border rounded p-2 bg-white">
                                  <img 
                                    src={details.license.frontImageUrl} 
                                    alt="License Front" 
                                    className="img-fluid rounded"
                                    style={{ maxHeight: '200px', width: '100%', objectFit: 'contain' }}
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.nextElementSibling.style.display = 'block';
                                    }}
                                  />
                                  <div className="text-muted text-center p-3" style={{ display: 'none' }}>
                                    <i className="bi bi-image"></i>
                                    <div>Image not available</div>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {details.license?.backImageUrl && (
                              <div className="col-md-6">
                                <h6 className="fw-bold small">License Back</h6>
                                <div className="border rounded p-2 bg-white">
                                  <img 
                                    src={details.license.backImageUrl} 
                                    alt="License Back" 
                                    className="img-fluid rounded"
                                    style={{ maxHeight: '200px', width: '100%', objectFit: 'contain' }}
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.nextElementSibling.style.display = 'block';
                                    }}
                                  />
                                  <div className="text-muted text-center p-3" style={{ display: 'none' }}>
                                    <i className="bi bi-image"></i>
                                    <div>Image not available</div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Vehicle Information */}
                    <div className="col-12">
                      <div className="card bg-light">
                        <div className="card-body">
                          <h6 className="card-title fw-bold">Vehicle Information</h6>
                          <div className="row">
                            <div className="col-md-6">
                              <p className="mb-1"><strong>Type:</strong> {details.vehicle?.vehicleType || "-"}</p>
                              <p className="mb-1"><strong>Registration:</strong> {details.vehicle?.registrationNumber || "-"}</p>
                              <p className="mb-1"><strong>Make:</strong> {details.vehicle?.make || "-"}</p>
                            </div>
                            <div className="col-md-6">
                              <p className="mb-1"><strong>Model:</strong> {details.vehicle?.model || "-"}</p>
                              <p className="mb-1"><strong>Year:</strong> {details.vehicle?.year || "-"}</p>
                              <p className="mb-1"><strong>Color:</strong> {details.vehicle?.color || "-"}</p>
                            </div>
                          </div>
                          
                          {/* Vehicle Images */}
                          <div className="row g-3 mt-2">
                            {details.vehicle?.frontImageUrl && (
                              <div className="col-md-4">
                                <h6 className="fw-bold small">Vehicle Front</h6>
                                <div className="border rounded p-2 bg-white">
                                  <img 
                                    src={details.vehicle.frontImageUrl} 
                                    alt="Vehicle Front" 
                                    className="img-fluid rounded"
                                    style={{ maxHeight: '150px', width: '100%', objectFit: 'contain' }}
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.nextElementSibling.style.display = 'block';
                                    }}
                                  />
                                  <div className="text-muted text-center p-3" style={{ display: 'none' }}>
                                    <i className="bi bi-image"></i>
                                    <div>Image not available</div>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {details.vehicle?.backImageUrl && (
                              <div className="col-md-4">
                                <h6 className="fw-bold small">Vehicle Back</h6>
                                <div className="border rounded p-2 bg-white">
                                  <img 
                                    src={details.vehicle.backImageUrl} 
                                    alt="Vehicle Back" 
                                    className="img-fluid rounded"
                                    style={{ maxHeight: '150px', width: '100%', objectFit: 'contain' }}
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.nextElementSibling.style.display = 'block';
                                    }}
                                  />
                                  <div className="text-muted text-center p-3" style={{ display: 'none' }}>
                                    <i className="bi bi-image"></i>
                                    <div>Image not available</div>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {details.vehicle?.rcUrl && (
                              <div className="col-md-4">
                                <h6 className="fw-bold small">RC Document</h6>
                                <div className="border rounded p-2 bg-white">
                                  <img 
                                    src={details.vehicle.rcUrl} 
                                    alt="RC Document" 
                                    className="img-fluid rounded"
                                    style={{ maxHeight: '150px', width: '100%', objectFit: 'contain' }}
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.nextElementSibling.style.display = 'block';
                                    }}
                                  />
                                  <div className="text-muted text-center p-3" style={{ display: 'none' }}>
                                    <i className="bi bi-image"></i>
                                    <div>Image not available</div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Verification Status */}
                    <div className="col-12">
                      <div className="card bg-light">
                        <div className="card-body">
                          <h6 className="card-title fw-bold">Verification Status</h6>
                          <div className="row">
                            <div className="col-md-6">
                              <p className="mb-1"><strong>Status:</strong> 
                                <span className={`badge ms-2 ${getStatusBadgeClass(details.status)}`}>
                                  {details.status}
                                </span>
                              </p>
                              <p className="mb-1"><strong>Progress:</strong> {details.verificationProgress || 0}%</p>
                              <p className="mb-1"><strong>Submitted:</strong> {details.submittedAt ? format(new Date(details.submittedAt), "MMM d, yyyy h:mm a") : "-"}</p>
                            </div>
                              <div className="col-md-6">
                                {details.reviewedAt ? (
                                  <>
                                    <p className="mb-1"><strong>Reviewed:</strong> {format(new Date(details.reviewedAt), "MMM d, yyyy h:mm a")}</p>
                                    {details.reviewedBy && (
                                      <p className="mb-1"><strong>Reviewed By:</strong> {details.reviewedBy.name || details.reviewedBy.email || 'Admin'}</p>
                                    )}
                                  </>
                                ) : (
                                  <p className="mb-1"><strong>Reviewed:</strong> <span className="text-warning">Pending</span></p>
                                )}
                                {details.approvedAt && details.status === 'approved' && (
                                  <p className="mb-1"><strong>Approved:</strong> {format(new Date(details.approvedAt), "MMM d, yyyy h:mm a")}</p>
                                )}
                                {details.rejectionReason && (
                                  <p className="mb-1"><strong>Rejection Reason:</strong> <span className="text-danger">{details.rejectionReason}</span></p>
                                )}
                                {details.reviewComments && (
                                  <p className="mb-1"><strong>Review Comments:</strong> <span className="text-muted">{details.reviewComments}</span></p>
                                )}
                              </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Review Form (only for pending requests) */}
                    {selectedRequest?.status === "pending" && (
                      <div className="col-12">
                        <div className="card border-warning">
                          <div className="card-body">
                            <h6 className="card-title fw-bold text-warning">Review Actions</h6>
                            <div className="row g-3">
                              <div className="col-12">
                                <label className="form-label fw-bold">Comments (Optional)</label>
                                <textarea
                                  value={reviewComments}
                                  onChange={(e) => setReviewComments(e.target.value)}
                                  className="form-control"
                                  rows="3"
                                  placeholder="Add any comments about this verification..."
                                />
                              </div>
                              <div className="col-12">
                                <label className="form-label fw-bold">Rejection Reason (Required for rejection)</label>
                                <textarea
                                  value={rejectionReason}
                                  onChange={(e) => setRejectionReason(e.target.value)}
                                  className="form-control"
                                  rows="2"
                                  placeholder="Specify reason for rejection if rejecting..."
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {selectedRequest?.status === "pending" && (
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={closeModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => handleReviewAction(selectedRequest.id, "reject")}
                    disabled={!rejectionReason.trim()}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={() => handleReviewAction(selectedRequest.id, "approve")}
                  >
                    Approve
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}