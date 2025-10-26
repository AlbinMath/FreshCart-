import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useBackButtonHandler } from "../hooks/useBackButtonHandler";

function Login() {
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login, signInWithGoogle, currentUser, getUserProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Use back button handler
  useBackButtonHandler();

  // Redirect if already logged in
  useEffect(() => {
    if (currentUser) {
      const profile = getUserProfile();
      
      // Only redirect if we have a valid profile
      if (profile) {
        const emailLower = (currentUser.email || "").toLowerCase();
        
        if (profile.role === 'admin' || emailLower === "admin@freshcaer.fc") {
          navigate('/admin', { replace: true });
        } else if (profile.role === 'delivery') {
          navigate('/delivery', { replace: true });
        } else if (profile.role === 'store' || profile.role === 'seller') {
          navigate('/seller', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      }
    }
  }, [currentUser, navigate, getUserProfile]);

  const roleParam = new URLSearchParams(location.search).get('role');

  // Show loading if auth is still loading - AFTER all hooks are called
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600"></div>
      </div>
    );
  }

  const handleInputChange = async (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));


  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    try {
      setError("");
      setLoading(true);
      
      // Call the login function from AuthContext and get Firebase user
      const credential = await login(formData.email, formData.password);

      // Read stored profile directly by UID to avoid timing issues with currentUser
      const uid = credential?.user?.uid;
      const stored = uid ? localStorage.getItem(`userProfile_${uid}`) : null;
      const profile = stored ? JSON.parse(stored) : null;

      // Fallback: use email to decide admin on first login if profile missing
      const emailLower = (formData.email || "").toLowerCase();

      // Role → path mapping
      const roleToPath = {
        admin: '/admin',
        delivery: '/delivery',
        seller: '/seller',
        store: '/seller',
        customer: '/',
      };

      const role = profile?.role || (emailLower === 'admin@freshcaer.fc' ? 'admin' : 'customer');
      const target = roleToPath[role] || '/';
      navigate(target, { replace: true });
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = "Failed to log in";
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = "Invalid email or password";
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = "Incorrect password";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Invalid email address";
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = "This account has been disabled";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many failed attempts. Please try again later.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setError("");
      setGoogleLoading(true);
      await signInWithGoogle();
      
      // Small delay to ensure state is updated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      navigate("/", { replace: true }); // Redirect to home page after successful login
    } catch (error) {
      console.error('Google sign-in error:', error);
      setError("Failed to sign in with Google: " + error.message);
      setGoogleLoading(false);
    }
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
            <p className="text-gray-600">Welcome back to smart fresh product delivery</p>
          </div>
          
          <div className="w-20"></div> {/* Spacer for centering */}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold mb-6 text-center text-gray-900">Sign In</h2>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <input
                type="email"
                name="email"
                placeholder="Enter your email"
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 border-gray-300"
                value={formData.email}
                onChange={handleInputChange}
                required
              />

            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Enter your password"
                  className="w-full p-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  onChange={(e) => localStorage.setItem('remember_me', e.target.checked ? '1' : '0')}
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                  Remember me
                </label>
              </div>
              <div className="text-sm">
                <Link to="/forgot-password" className="text-green-600 hover:text-green-500">
                  Forgot password?
                </Link>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 ease-in-out transform hover:scale-105"
            >
              {loading ? "Signing In..." : "Sign In"}
            </button>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm text-center">{error}</p>
              </div>
            )}
          </form>
          
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>

              {roleParam === 'admin' && (
                <div className="mt-4 text-center text-xs text-gray-600">
                  <p>
                    Admin login only. Use email <span className="font-semibold">admin@freshcaer.fc</span> and your admin password.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6">
              <button 
                onClick={handleGoogleSignIn}
                disabled={googleLoading || loading}
                className="w-full inline-flex justify-center items-center py-3 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ease-in-out transform hover:scale-105"
              >
                {googleLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in with Google...
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                  </>
                )}
              </button>
            </div>
          </div>
          
          <div className="text-center mt-6 space-y-4">
            <p className="text-gray-600">
              Don't have an account?{" "}
              <Link to="/register" className="text-green-600 hover:text-green-700 font-semibold underline">
                Sign up here
              </Link>
            </p>

            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-gray-700 font-medium mb-3">Are you a Seller/Vendor or Delivery Partner?</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Link
                  to="/register/store"
                  className="block w-full py-2 px-3 rounded-lg border border-green-200 bg-white text-green-700 hover:bg-green-50 hover:border-green-300 transition"
                >
                  Seller / Store
                </Link>
                <Link
                  to="/register/delivery"
                  className="block w-full py-2 px-3 rounded-lg border border-blue-200 bg-white text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition"
                >
                  Delivery Partner
                </Link>
                
              </div>
              <p className="text-xs text-gray-500 mt-3">Already registered? Use the Sign In form above.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
