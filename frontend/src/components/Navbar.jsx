import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { FaWallet } from 'react-icons/fa';
import NotificationBell from './NotificationBell';

function Navbar() {
  const { currentUser, logout, getUserProfile } = useAuth();
  const navigate = useNavigate();
  const userProfile = getUserProfile();
  const [balance, setBalance] = useState(userProfile?.balance || 0);

  useEffect(() => {
    // Update balance when userProfile changes
    if (userProfile?.balance !== undefined) {
      setBalance(parseFloat(userProfile.balance).toFixed(2));
    }
  }, [userProfile]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'store': return 'Store Owner';
      case 'seller': return 'Seller';
      case 'customer': return 'Customer';
      default: return 'User';
    }
  };

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link 
              to={userProfile?.role === 'admin' ? '/admin' : 
                  userProfile?.role === 'delivery' ? '/delivery' : 
                  ['store', 'seller'].includes(userProfile?.role) ? '/seller' : '/'} 
              className="flex-shrink-0 flex items-center"
            >
              <span className="text-2xl font-bold text-green-600">FreshCart</span>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            {currentUser ? (
              <>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <span className="text-sm text-gray-700 mr-2">
                      Welcome, {userProfile?.name || 'User'}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {getRoleDisplayName(userProfile?.role)}
                    </span>
                  </div>
                  
                  
                  
                 
                </div>
                
                <div className="flex items-center space-x-2">
                  {userProfile?.role === 'admin' && (
                    <Link
                      to="/admin"
                      className="text-gray-700 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium"
                    >
                      Admin Panel
                    </Link>
                  )}
                  
                  {userProfile?.role === 'store' && (
                    <Link
                      to="/seller"
                      className="text-gray-700 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium"
                    >
                      Store Dashboard
                    </Link>
                  )}
                  
                  {userProfile?.role === 'seller' && (
                    <Link
                      to="/seller"
                      className="text-gray-700 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium"
                    >
                      Seller Dashboard
                    </Link>
                  )}
                  
                  {userProfile?.role === 'customer' && (
                    <>
                      <Link
                        to="/cart"
                        className="text-gray-700 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium"
                      >
                        Cart
                      </Link>
                      <Link
                        to="/customer"
                        className="text-gray-700 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium"
                      >
                        My Orders
                      </Link>
                    </>
                  )}
                  
                  {userProfile?.role === 'delivery' ? (
                    <>
                      <Link to="/delivery" className="text-gray-700 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium">Delivery Panel</Link>
                      <Link to="/delivery/profile" className="text-gray-700 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium">My Profile</Link>
                    </>
                  ) : (
                    <Link
                      to="/profile"
                      className="text-gray-700 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium"
                    >
                      Profile
                    </Link>
                  )}
                  
                  <button
                    onClick={handleLogout}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  to="/login"
                  className="text-gray-700 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;


