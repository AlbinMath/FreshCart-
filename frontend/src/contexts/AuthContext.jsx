import React, { useContext, useState, useEffect } from "react";
import { auth, googleProvider } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendEmailVerification,
  fetchSignInMethodsForEmail,
  reload
} from "firebase/auth";
import authService from "../../../backend/services/authService";

const AuthContext = React.createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Backend API URL
  const RAW_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').trim();
  const API_BASE_URL = RAW_BASE.replace(/\/+$/, '');

  // Register function with backend integration
  async function signup(email, password, name, role, additionalInfo = {}) {
    let userCredential;
    let isExistingUser = false;
    
    try {
      // 1. Try to create user in Firebase
      try {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      } catch (firebaseError) {
        if (firebaseError.code === 'auth/email-already-in-use') {
          // If user exists in Firebase, try to sign them in to get their info
          try {
            userCredential = await signInWithEmailAndPassword(auth, email, password);
            isExistingUser = true;
          } catch (signInError) {
            throw new Error(`Email already registered with different password. Please use login instead.`);
          }
        } else {
          throw firebaseError;
        }
      }
      
      // 2. Update the user's display name in Firebase (only if new user)
      if (!isExistingUser) {
        await updateProfile(userCredential.user, {
          displayName: name
        });

        // 3. Send email verification for new email/password users
        await sendEmailVerification(userCredential.user);
      }

      // 4. Save user data to MongoDB backend (with password for email users)
      const userData = {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        name: name,
        role: role,
        provider: 'email',
        password: password, // Include password for backend storage
        ...additionalInfo,
        createdAt: new Date().toISOString()
      };

      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save user data to backend');
      }

      const savedUser = await response.json();
      console.log('User saved to backend:', savedUser);
      // Store backend JWT if returned
      try {
        if (savedUser?.token) {
          localStorage.setItem('token', savedUser.token);
        } else if (savedUser?.user?.token) {
          localStorage.setItem('token', savedUser.user.token);
        }
      } catch (_) {}

      // 5. Store additional user information in localStorage
      const userProfile = {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        displayName: name,
        role: role,
        provider: 'email',
        emailVerified: userCredential.user.emailVerified,
        ...additionalInfo,
        createdAt: new Date().toISOString()
      };

      localStorage.setItem(`userProfile_${userCredential.user.uid}`, JSON.stringify(userProfile));
      
      return userCredential;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  // Login function with backend integration
  async function login(email, password) {
    // Apply persistence based on Remember Me flag stored by Login page
    try {
      const flag = localStorage.getItem('remember_me') === '1';
      const { setPersistence, browserLocalPersistence, browserSessionPersistence } = await import('firebase/auth');
      await setPersistence(auth, flag ? browserLocalPersistence : browserSessionPersistence);
    } catch (_) { /* ignore if unsupported */ }
    try {
      // 1. Sign in with Firebase (with admin auto-create fallback)
      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } catch (err) {
        if ((email || '').toLowerCase() === 'admin@freshcaer.fc') {
          userCredential = await createUserWithEmailAndPassword(auth, email, password);
        } else {
          throw err;
        }
      }
      const uid = userCredential.user.uid;
      const userEmail = userCredential.user.email || email;
      
      // 2. Verify user exists in backend and get profile
      let response = await fetch(`${API_BASE_URL}/auth/profile/${uid}`);
      
      if (!response.ok) {
        // Auto-create admin in backend if admin email logs in first time
        // Only the fixed admin email can become admin
        if (userEmail === 'admin@freshcaer.fc') {
          const adminPayload = {
            uid,
            email: userEmail,
            name: userCredential.user.displayName || 'Admin',
            role: 'admin',
            adminLevel: 'super',
            provider: 'email',
            password
          };
          response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(adminPayload)
          });
          try { await sendEmailVerification(userCredential.user); } catch {}
          if (response.ok) {
            const saved = await response.json();
            if (saved.user) {
              localStorage.setItem(`userProfile_${uid}`, JSON.stringify(saved.user));
            }
            try {
              if (saved?.token) {
                localStorage.setItem('token', saved.token);
              } else if (saved?.user?.token) {
                localStorage.setItem('token', saved.user.token);
              }
            } catch (_) {}
          } else {
            console.warn('Failed to auto-create admin in backend');
          }
        } else {
          console.warn('User not found in backend, but Firebase auth successful');
        }
        return userCredential;
      }

      const userData = await response.json();
      console.log('User profile from backend:', userData);
      if (userData.user) {
        localStorage.setItem(`userProfile_${uid}`, JSON.stringify(userData.user));
      } else {
        // If backend doesn't return user data, create a basic profile
        const basicProfile = {
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          name: userCredential.user.displayName || userCredential.user.email?.split('@')[0] || 'User',
          role: 'customer',
          profilePicture: userCredential.user.photoURL,
          provider: 'email',
          emailVerified: userCredential.user.emailVerified,
          createdAt: new Date().toISOString()
        };
        localStorage.setItem(`userProfile_${uid}`, JSON.stringify(basicProfile));
      }
      // Store backend JWT if returned
      try {
        if (userData?.token) {
          localStorage.setItem('token', userData.token);
        } else if (userData?.user?.token) {
          localStorage.setItem('token', userData.user.token);
        }
      } catch (_) {}

      return userCredential;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // Logout function
  async function logout() {
    try {
      // Clear auth service state
      authService.clearAuthState();
      
      // Clear all localStorage data
      if (currentUser) {
        localStorage.removeItem(`userProfile_${currentUser.uid}`);
      }
      localStorage.removeItem('token');
      localStorage.removeItem('remember_me');
      
      // Clear any other auth-related localStorage items
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('userProfile_') || key.includes('auth') || key.includes('token')) {
          localStorage.removeItem(key);
        }
      });
      
      // Sign out from Firebase
      await signOut(auth);
      
      // Force reload to clear any cached state
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      // Even if there's an error, clear local storage and redirect
      authService.clearAuthState();
      localStorage.clear();
      window.location.href = '/login';
    }
  }

  // Delete account (non-admin). Deletes Firebase auth user and backend record.
  async function deleteAccount() {
    if (!currentUser) throw new Error('No user logged in');
    try {
      // 1) Delete backend record first (non-admin only)
      const res = await fetch(`${API_BASE_URL}/users/${currentUser.uid}/delete`, { method: 'DELETE' });
      if (!res.ok) {
        const text = await res.text();
        let err; try { err = JSON.parse(text); } catch { err = { message: text }; }
        throw new Error(err.message || 'Failed to delete backend account');
      }
      // 2) Delete Firebase account
      await currentUser.delete();
      // 3) Cleanup local
      localStorage.removeItem(`userProfile_${currentUser.uid}`);
      return true;
    } catch (e) {
      // If Firebase requires recent login, surface friendly message
      if (e.code === 'auth/requires-recent-login') {
        throw new Error('Please sign in again to delete your account.');
      }
      throw e;
    }
  }

  // Google Sign-In function
  async function signInWithGoogle() {
    try {
      console.log('Starting Google sign-in...');
      // Apply persistence based on Remember Me flag
      try {
        const flag = localStorage.getItem('remember_me') === '1';
        const { setPersistence, browserLocalPersistence, browserSessionPersistence } = await import('firebase/auth');
        await setPersistence(auth, flag ? browserLocalPersistence : browserSessionPersistence);
      } catch (_) {}
      
      // 1. Sign in with Google popup
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      console.log('Google sign-in successful:', user.email);
      
      // 2. Try to check/create user in backend (but don't fail if backend is down)
      try {
        let response = await fetch(`${API_BASE_URL}/auth/profile/${user.uid}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          console.log('📝 User not found in backend, creating new user...');
          // User doesn't exist in backend, create them
          const userData = {
            uid: user.uid,
            email: user.email,
            name: user.displayName || user.email.split('@')[0],
            role: 'customer', // Default role for Google sign-in users
            profilePicture: user.photoURL || '',
            provider: 'google',
            emailVerified: user.emailVerified || false
          };

          console.log('📤 Sending user data to backend:', userData);

          response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData)
          });

          const responseText = await response.text();
          console.log('📥 Backend response:', responseText);

          if (!response.ok) {
            let errorData;
            try {
              errorData = JSON.parse(responseText);
            } catch {
              errorData = { message: responseText };
            }
            
            // Check if user already exists (race condition)
            if (errorData.message && errorData.message.includes('already exists')) {
              console.log('ℹ️ User already exists in backend (race condition)');
              // Try to get the existing user
              const existingResponse = await fetch(`${API_BASE_URL}/auth/profile/${user.uid}`);
              if (existingResponse.ok) {
                const existingUser = await existingResponse.json();
                console.log('✅ Retrieved existing user:', existingUser);
                if (existingUser.user) {
                  localStorage.setItem(`userProfile_${user.uid}`, JSON.stringify(existingUser.user));
                }
                // Store token if present
                try {
                  if (existingUser?.token) {
                    localStorage.setItem('token', existingUser.token);
                  } else if (existingUser?.user?.token) {
                    localStorage.setItem('token', existingUser.user.token);
                  }
                } catch (_) {}
              }
            } else {
              console.warn('❌ Failed to save Google user to backend:', errorData.message);
            }
          } else {
            const savedUser = JSON.parse(responseText);
            console.log('✅ Google user saved to backend successfully:', savedUser);
            
            // Store user profile locally
            if (savedUser.user) {
              localStorage.setItem(`userProfile_${user.uid}`, JSON.stringify(savedUser.user));
            }
            // Store token if present
            try {
              if (savedUser?.token) {
                localStorage.setItem('token', savedUser.token);
              } else if (savedUser?.user?.token) {
                localStorage.setItem('token', savedUser.user.token);
              }
            } catch (_) {}
          }
        } else {
          // User exists, get their profile
          const userData = await response.json();
          console.log('✅ Retrieved existing Google user profile:', userData);
          
          // Store user profile locally
          if (userData.user) {
            localStorage.setItem(`userProfile_${user.uid}`, JSON.stringify(userData.user));
          }
          
          // Update last login
          try {
            await fetch(`${API_BASE_URL}/users/${user.uid}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ lastLogin: new Date().toISOString() })
            });
            console.log('📅 Updated last login time');
          } catch (updateError) {
            console.warn('⚠️ Failed to update last login:', updateError.message);
          }
        }
      } catch (backendError) {
        console.warn('Backend communication failed, but Google auth succeeded:', backendError.message);
        // Continue with local storage only
      }

      // Always store user profile in localStorage (fallback if backend fails)
      const userProfile = {
        uid: user.uid,
        email: user.email,
        name: user.displayName || user.email.split('@')[0],
        role: 'customer',
        profilePicture: user.photoURL,
        provider: 'google',
        emailVerified: user.emailVerified,
        createdAt: new Date().toISOString()
      };

      localStorage.setItem(`userProfile_${user.uid}`, JSON.stringify(userProfile));
      console.log('User profile stored in localStorage');

      return result;
    } catch (error) {
      console.error('Google sign-in error:', error);
      
      // Provide more specific error messages
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in was cancelled. Please try again.');
      } else if (error.code === 'auth/popup-blocked') {
        throw new Error('Pop-up was blocked by your browser. Please allow pop-ups and try again.');
      } else if (error.code === 'auth/network-request-failed') {
        throw new Error('Network error. Please check your internet connection and try again.');
      } else if (error.message && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please try again later.');
      } else {
        throw new Error(error.message || 'Failed to sign in with Google. Please try again.');
      }
    }
  }

  // Reset password function
  function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
  }

  // Get user profile
  function getUserProfile() {
    if (!currentUser) return null;
    const profile = localStorage.getItem(`userProfile_${currentUser.uid}`);
    if (profile) {
      return JSON.parse(profile);
    }
    
    // If no profile in localStorage, create a basic one from Firebase user
    const basicProfile = {
      uid: currentUser.uid,
      email: currentUser.email,
      name: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
      role: 'customer', // default role
      profilePicture: currentUser.photoURL,
      provider: currentUser.providerData?.[0]?.providerId || 'email',
      emailVerified: currentUser.emailVerified,
      createdAt: new Date().toISOString()
    };
    
    // Store the basic profile for future use
    localStorage.setItem(`userProfile_${currentUser.uid}`, JSON.stringify(basicProfile));
    return basicProfile;
  }

  // Upgrade role to seller and persist seller fields in backend
  async function upgradeToSeller(additionalInfo = {}) {
    if (!currentUser) throw new Error('No user logged in');
    try {
      const response = await fetch(`${API_BASE_URL}/users/${currentUser.uid}/upgrade-to-seller`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(additionalInfo)
      });
      const text = await response.text();
      if (!response.ok) {
        let err;
        try { err = JSON.parse(text); } catch { err = { message: text }; }
        throw new Error(err.message || 'Failed to upgrade to seller');
      }
      const data = JSON.parse(text);
      if (data && data.user) {
        localStorage.setItem(`userProfile_${currentUser.uid}`, JSON.stringify(data.user));
      } else {
        // Fallback merge
        const currentProfile = getUserProfile() || {};
        const updated = { ...currentProfile, role: 'seller', ...additionalInfo };
        localStorage.setItem(`userProfile_${currentUser.uid}`, JSON.stringify(updated));
      }
      return true;
    } catch (e) {
      console.error('upgradeToSeller error:', e);
      throw e;
    }
  }

  // Update user profile
  async function updateUserProfile(updates) {
    if (!currentUser) return false;
    
    // Prevent admin profile updates
    const profile = getUserProfile();
    if (profile?.role === 'admin') {
      throw new Error('Admin profiles cannot be updated');
    }
    
    try {
      // Update Firebase profile if name or photo changed
      const firebaseUpdates = {};
      if (updates.name && updates.name !== currentUser.displayName) {
        firebaseUpdates.displayName = updates.name;
      }
      if (updates.profilePicture && updates.profilePicture !== currentUser.photoURL) {
        firebaseUpdates.photoURL = updates.profilePicture;
      }

      if (Object.keys(firebaseUpdates).length > 0) {
        await updateProfile(currentUser, firebaseUpdates);
      }

      // Update profile in backend
      const response = await fetch(`${API_BASE_URL}/users/${currentUser.uid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        const currentProfile = getUserProfile();
        if (currentProfile) {
          const updatedProfile = { ...currentProfile, ...updates };
          localStorage.setItem(`userProfile_${currentUser.uid}`, JSON.stringify(updatedProfile));
          return true;
        }
      } else {
        const responseText = await response.text();
        console.error('Profile update failed:', {
          status: response.status,
          statusText: response.statusText,
          response: responseText
        });
        
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch (parseError) {
          throw new Error(`Server error (${response.status}): ${responseText}`);
        }
        
        // Handle detailed validation errors
        if (errorData.errors && Array.isArray(errorData.errors)) {
          const errorMessages = errorData.errors.map(err => 
            typeof err === 'string' ? err : err.message || err.field || 'Unknown error'
          );
          throw new Error(`${errorData.message}: ${errorMessages.join(', ')}`);
        }
        
        throw new Error(errorData.message || errorData.error || 'Failed to update profile');
      }
      return false;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }

  // Change password function
  async function changePassword(currentPassword, newPassword) {
    if (!currentUser) throw new Error('No user logged in');
    
    // Prevent admin password changes
    const profile = getUserProfile();
    if (profile?.role === 'admin') {
      throw new Error('Admin passwords cannot be changed');
    }
    
    try {
      // Re-authenticate user first
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      
      // Update password in Firebase
      await updatePassword(currentUser, newPassword);
      
      // Update password in backend
      const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid: currentUser.uid,
          newPassword: newPassword
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update password in backend');
      }

      return true;
    } catch (error) {
      console.error('Password change error:', error);
      throw error;
    }
  }

  // Get user profile from backend
  async function fetchUserProfile() {
    if (!currentUser) return null;
    
    try {
      const response = await fetch(`${API_BASE_URL}/users/${currentUser.uid}`);
      if (response.ok) {
        const data = await response.json();
        return data.user;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }

  // Seller branch stores APIs
  async function listBranchStores() {
    if (!currentUser) return { branchStores: [], linkedBranchOf: [], sellerUniqueNumber: '', pendingRequests: [] };
    try {
      const res = await fetch(`${API_BASE_URL}/users/${currentUser.uid}/branch-stores`);
      if (!res.ok) return { branchStores: [], linkedBranchOf: [], sellerUniqueNumber: '', pendingRequests: [] };
      return await res.json();
    } catch (e) {
      console.warn('listBranchStores error:', e.message);
      return { branchStores: [], linkedBranchOf: [], sellerUniqueNumber: '', pendingRequests: [] };
    }
  }

  async function addBranchStore({ name, address, linkedSellerUniqueNumber }) {
    if (!currentUser) throw new Error('No user');
    const payload = { name, address, linkedSellerUniqueNumber };
    const res = await fetch(`${API_BASE_URL}/users/${currentUser.uid}/branch-stores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    if (!res.ok) {
      let err; try { err = JSON.parse(text); } catch { err = { message: text }; }
      throw new Error(err.message || 'Failed to add branch store');
    }
    const data = JSON.parse(text);
    return data.branchStores || [];
  }

  async function listBranchLinkRequests() {
    if (!currentUser) return [];
    const res = await fetch(`${API_BASE_URL}/users/${currentUser.uid}/branch-link-requests`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.requests || [];
  }

  async function actOnBranchLinkRequest(requestId, action) {
    if (!currentUser) throw new Error('No user');
    const res = await fetch(`${API_BASE_URL}/users/${currentUser.uid}/branch-link-requests/${requestId}/${action}`, { method: 'POST' });
    const text = await res.text();
    if (!res.ok) {
      let err; try { err = JSON.parse(text); } catch { err = { message: text }; }
      throw new Error(err.message || 'Failed to update request');
    }
    return JSON.parse(text);
  }

  async function listNotifications() {
    if (!currentUser) return [];
    const res = await fetch(`${API_BASE_URL}/users/${currentUser.uid}/notifications`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.notifications || [];
  }

  async function markNotificationRead(id) {
    if (!currentUser) throw new Error('No user');
    await fetch(`${API_BASE_URL}/users/${currentUser.uid}/notifications/${id}/read`, { method: 'POST' });
    return true;
  }

  async function markAllNotificationsRead() {
    if (!currentUser) throw new Error('No user');
    await fetch(`${API_BASE_URL}/users/${currentUser.uid}/notifications/mark-all-read`, { method: 'POST' });
    return true;
  }

  // Delete a single notification
  async function deleteNotification(id) {
    if (!currentUser) throw new Error('No user');
    const res = await fetch(`${API_BASE_URL}/users/${currentUser.uid}/notifications/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete notification');
    return true;
  }

  // Clear notifications. If onlyRead=true, clear only read ones; else clear all
  async function clearNotifications(onlyRead = false) {
    if (!currentUser) throw new Error('No user');
    const res = await fetch(`${API_BASE_URL}/users/${currentUser.uid}/notifications/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onlyRead })
    });
    if (!res.ok) throw new Error('Failed to clear notifications');
    return true;
  }

  // Delivery verification functions
  async function getDeliveryVerificationStatus() {
    if (!currentUser) return null;
    try {
      const res = await fetch(`${API_BASE_URL}/delivery-verification/${currentUser.uid}/status`);
      if (res.ok) {
        const data = await res.json();
        return data.data;
      }
      return null;
    } catch (error) {
      console.error('Error getting delivery verification status:', error);
      return null;
    }
  }

  async function checkDeliveryAccess() {
    if (!currentUser) return { canAccess: false, message: 'Not logged in' };
    const profile = getUserProfile();
    
    if (profile?.role !== 'delivery') {
      return { canAccess: true, message: 'Not a delivery partner' };
    }

    try {
      const res = await fetch(`${API_BASE_URL}/delivery-verification/${currentUser.uid}/check-access`);
      if (res.ok) {
        const data = await res.json();
        return {
          canAccess: data.data.canAccessDashboard,
          isVerified: data.data.isVerified,
          status: data.data.status,
          message: data.data.message
        };
      } else {
        const errorData = await res.json();
        return {
          canAccess: false,
          message: errorData.message || 'Verification check failed'
        };
      }
    } catch (error) {
      console.error('Error checking delivery access:', error);
      return {
        canAccess: false,
        message: 'Error checking access'
      };
    }
  }

  async function deleteBranchStore(index) {
    if (!currentUser) throw new Error('No user');
    const res = await fetch(`${API_BASE_URL}/users/${currentUser.uid}/branch-stores/${index}`, { method: 'DELETE' });
    const text = await res.text();
    if (!res.ok) {
      let err; try { err = JSON.parse(text); } catch { err = { message: text }; }
      throw new Error(err.message || 'Failed to delete branch store');
    }
    const data = JSON.parse(text);
    return data.branchStores || [];
  }

  // Send email verification
  async function sendVerificationEmail() {
    if (!currentUser) throw new Error('No user logged in');
    
    try {
      await sendEmailVerification(currentUser);
      return true;
    } catch (error) {
      console.error('Email verification error:', error);
      throw error;
    }
  }

  // Check if user needs email verification
  function needsEmailVerification() {
    if (!currentUser) return false;
    
    // Google users don't need email verification
    const profile = getUserProfile();
    if (profile?.provider === 'google') return false;
    
    // Check if email is verified
    return !currentUser.emailVerified;
  }

  // Reload user to get updated email verification status
  async function reloadUser() {
    if (!currentUser) return;
    
    try {
      await currentUser.reload();
      // Update localStorage with new verification status
      const profile = getUserProfile();
      if (profile) {
        profile.emailVerified = currentUser.emailVerified;
        localStorage.setItem(`userProfile_${currentUser.uid}`, JSON.stringify(profile));
      }
    } catch (error) {
      console.error('Error reloading user:', error);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed:', user ? 'User logged in' : 'User logged out');
      
      if (user) {
        // User is logged in - ensure profile exists
        const existingProfile = localStorage.getItem(`userProfile_${user.uid}`);
        if (!existingProfile) {
          // Create a basic profile if none exists
          const basicProfile = {
            uid: user.uid,
            email: user.email,
            name: user.displayName || user.email?.split('@')[0] || 'User',
            role: 'customer',
            profilePicture: user.photoURL,
            provider: user.providerData?.[0]?.providerId || 'email',
            emailVerified: user.emailVerified,
            createdAt: new Date().toISOString()
          };
          localStorage.setItem(`userProfile_${user.uid}`, JSON.stringify(basicProfile));
        }
      } else {
        // User is logged out - clear all auth data
        localStorage.removeItem('token');
        localStorage.removeItem('remember_me');
        // Clear all user profiles
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('userProfile_')) {
            localStorage.removeItem(key);
          }
        });
      }
      
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Prevent unnecessary re-renders by memoizing the context value
  const contextValue = React.useMemo(() => ({
    currentUser,
    loading,
    signup,
    login,
    signInWithGoogle,
    logout,
    resetPassword,
    changePassword,
    getUserProfile,
    updateUserProfile,
    fetchUserProfile,
    sendVerificationEmail,
    needsEmailVerification,
    reloadUser,
    checkEmailAvailable,
    validatePasswordLive,
    validateAddressLive,
    upgradeToSeller,
    deleteAccount,
    listBranchStores,
    addBranchStore,
    deleteBranchStore,
    listBranchLinkRequests,
    actOnBranchLinkRequest,
    listNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    clearNotifications
  }), [currentUser, loading]);

  // Real-time Firebase checks
  async function checkEmailAvailable(email) {
    if (!email) return false;
    const methods = await fetchSignInMethodsForEmail(auth, email);
    return methods.length === 0; // true if not registered
  }

  function validatePasswordLive(pw) {
    const issues = [];
    if (!pw || pw.length < 6) issues.push('At least 6 characters');
    if (!/[A-Z]/.test(pw)) issues.push('1 uppercase');
    if (!/[a-z]/.test(pw)) issues.push('1 lowercase');
    if (!/\d/.test(pw)) issues.push('1 number');
    return issues; // empty array means ok
  }

  function validateAddressLive(addr) {
    const errs = [];
    if (!addr?.street || addr.street.trim().length < 5) errs.push('Street >= 5 chars');
    if (!addr?.city || addr.city.trim().length < 2) errs.push('City >= 2 chars');
    if (!addr?.state || addr.state.trim().length < 2) errs.push('State >= 2 chars');
    if (!addr?.zipCode || !/^\d{5,6}$/.test(addr.zipCode)) errs.push('ZIP 5-6 digits');
    if (!addr?.country || addr.country.trim().length < 2) errs.push('Country >= 2 chars');
    return errs;
  }

  const value = {
    currentUser,
    loading,
    signup,
    login,
    signInWithGoogle,
    logout,
    resetPassword,
    changePassword,
    getUserProfile,
    updateUserProfile,
    fetchUserProfile,
    sendVerificationEmail,
    needsEmailVerification,
    reloadUser,
    checkEmailAvailable,
    validatePasswordLive,
    validateAddressLive,
    upgradeToSeller,
    deleteAccount,
    listBranchStores,
    addBranchStore,
    deleteBranchStore,
    listBranchLinkRequests,
    actOnBranchLinkRequest,
    listNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    clearNotifications,
    getDeliveryVerificationStatus,
    checkDeliveryAccess
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}
