import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { useBackButtonHandler } from "../hooks/useBackButtonHandler";

function DeliveryRegister() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    vehicleType: "",
    licenseNumber: ""
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailStatus, setEmailStatus] = useState("");
  const [passwordIssues, setPasswordIssues] = useState([]);
  const { signup, checkEmailAvailable, validatePasswordLive, logout } = useAuth();
  const navigate = useNavigate();
  
  // Use back button handler
  useBackButtonHandler();

  const handleInputChange = async (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (name === 'email') {
      setEmailStatus(value ? 'checking' : '');
      if (value && /.+@.+\..+/.test(value)) {
        try { const available = await checkEmailAvailable(value); setEmailStatus(available ? 'available' : 'taken'); } catch { setEmailStatus(''); }
      } else { setEmailStatus(''); }
    }
    if (name === 'password') setPasswordIssues(validatePasswordLive(value));
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      return setError("Passwords do not match");
    }

    if (formData.password.length < 6) {
      return setError("Password should be at least 6 characters");
    }

    try {
      setError("");
      setLoading(true);

      const additionalInfo = {
        phone: formData.phone,
        vehicleType: formData.vehicleType,
        licenseNumber: formData.licenseNumber
      };

      await signup(formData.email, formData.password, formData.name, "delivery", additionalInfo);
      
      // Show success message
      setError("");
      setMessage("Delivery account created! Please verify your email, then sign in.");
      
      // Enforce login before access
      try { const { logout } = useAuth(); await logout(); } catch(_) {}
      navigate("/login", { replace: true });
    } catch (error) {
      setError("Failed to create delivery agent account: " + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-12 px-4">
      <div className="max-w-md mx-auto">
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
          
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">FreshCart</h1>
            <p className="text-gray-600">Join as a Delivery Agent</p>
          </div>
          
          <div className="w-20"></div> {/* Spacer for centering */}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold mb-6 text-center text-gray-900">Delivery Agent Registration</h2>
          <p className="text-sm text-gray-700 mb-2">I am a:</p>
          <div className="flex flex-wrap gap-2 bg-gray-100 p-2 rounded-xl mb-6">
            {[
              { id: "customer", label: "Customer", to: "/register/customer" },
              { id: "seller", label: "Seller", to: "/register/store" },
              { id: "delivery", label: "Delivery", to: "/register/delivery" }
            ].map(({ id, label, to }) => {
              const active = id === "delivery"; // This page is the Delivery registration
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => { if (!active) navigate(to); }}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    active
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                  }`}
                  aria-pressed={active}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
              <input
                type="text"
                name="name"
                placeholder="Enter your full name"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <input
                type="email"
                name="email"
                placeholder="Enter your email"
                className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${emailStatus==='taken' ? 'border-red-300' : 'border-gray-300'}`}
                value={formData.email}
                onChange={handleInputChange}
                required
              />
              {formData.email && (
                <p className={`mt-1 text-xs ${emailStatus==='taken' ? 'text-red-600' : 'text-gray-500'}`}>
                  {emailStatus==='checking' && 'Checking availability...'}
                  {emailStatus==='available' && 'Email is available'}
                  {emailStatus==='taken' && 'Email already registered'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
              <input
                type="tel"
                name="phone"
                placeholder="Enter your phone number"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                value={formData.phone}
                onChange={handleInputChange}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle Type</label>
              <select
                name="vehicleType"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                value={formData.vehicleType}
                onChange={handleInputChange}
                required
              >
                <option value="">Select Vehicle Type</option>
                <option value="bike">Bike</option>
                <option value="scooter">Scooter</option>
                <option value="car">Car</option>
                <option value="van">Van</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Driving License Number</label>
              <input
                type="text"
                name="licenseNumber"
                placeholder="Enter driving license number"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                value={formData.licenseNumber}
                onChange={handleInputChange}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                name="password"
                placeholder="Create a password"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                value={formData.password}
                onChange={handleInputChange}
                required
              />
              {formData.password && (
                <ul className="mt-1 text-xs text-gray-600 list-disc ml-5 space-y-0.5">
                  <li className={passwordIssues.includes('At least 6 characters') ? 'text-red-600' : ''}>At least 6 characters</li>
                  <li className={passwordIssues.includes('1 uppercase') ? 'text-red-600' : ''}>1 uppercase</li>
                  <li className={passwordIssues.includes('1 lowercase') ? 'text-red-600' : ''}>1 lowercase</li>
                  <li className={passwordIssues.includes('1 number') ? 'text-red-600' : ''}>1 number</li>
                </ul>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
              <input
                type="password"
                name="confirmPassword"
                placeholder="Confirm your password"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 ease-in-out transform hover:scale-105"
            >
              {loading ? "Creating Account..." : "Register as Delivery Agent"}
            </button>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm text-center">{error}</p>
              </div>
            )}

            {message && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-green-600 text-sm text-center">{message}</p>
              </div>
            )}
          </form>
          
          <div className="text-center mt-6">
            <p className="text-gray-600">
              Already have an account?{" "}
              <Link to="/login" className="text-green-600 hover:text-green-700 font-semibold underline">
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DeliveryRegister;