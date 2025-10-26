import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const useBackButtonHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, currentUser } = useAuth();

  useEffect(() => {
    // Only handle back button if user is already logged in and on auth pages
    const authPages = ['/login', '/register', '/register/store', '/register/delivery', '/register/admin'];
    
    if (!currentUser || !authPages.includes(location.pathname)) {
      return; // Don't interfere if user is not logged in or not on auth pages
    }

    const handleBackButton = async () => {
      try {
        console.log('Back button detected on auth page while logged in, logging out...');
        await logout();
        navigate('/', { replace: true });
      } catch (error) {
        console.error('Error logging out on back button:', error);
        navigate('/', { replace: true });
      }
    };

    // Add a history entry to detect back button
    const historyState = { preventBack: true, timestamp: Date.now() };
    window.history.pushState(historyState, '');
    
    const handlePopState = (event) => {
      if (event.state && event.state.preventBack) {
        handleBackButton();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [location.pathname, currentUser, logout, navigate]);

  // Function to handle programmatic navigation with logout
  const navigateWithLogout = async (path) => {
    if (currentUser) {
      try {
        await logout();
      } catch (error) {
        console.error('Error logging out:', error);
      }
    }
    navigate(path, { replace: true });
  };

  return { navigateWithLogout };
};