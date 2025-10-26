# Firebase Authentication Setup for FreshCart

This guide will help you set up Firebase Authentication for the FreshCart application.

## Prerequisites

1. A Google account
2. Node.js and npm installed
3. The FreshCart project cloned and dependencies installed

## Step 1: Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or "Create a project"
3. Enter your project name (e.g., "freshcart-auth")
4. Follow the setup wizard (you can disable Google Analytics for now)

## Step 2: Enable Authentication

1. In your Firebase project console, click on "Authentication" in the left sidebar
2. Click "Get started" if this is your first time
3. Go to the "Sign-in method" tab
4. Enable "Email/Password" authentication:
   - Click on "Email/Password"
   - Toggle "Enable" to ON
   - Click "Save"

## Step 3: Get Firebase Configuration

1. Click on the gear icon (⚙️) in the left sidebar and select "Project settings"
2. Scroll down to "Your apps" section
3. Click on the web icon (`</>`) to add a web app
4. Give your app a name (e.g., "FreshCart Web")
5. Click "Register app"
6. Copy the Firebase configuration object

## Step 4: Configure Your Application

1. Create a `.env` file in the `frontend` directory
2. Add your Firebase configuration:

```env
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

Replace the placeholder values with your actual Firebase configuration values.

## Step 5: Test the Application

1. Navigate to the frontend directory: `cd frontend`
2. Start the development server: `npm run dev`
3. Open your browser and go to `http://localhost:5173`
4. Try registering a new account and logging in

## Features Implemented

### ✅ User Registration
- Email and password registration
- Password confirmation validation
- Display name support
- Automatic login after registration

### ✅ User Login
- Email and password authentication
- Error handling for invalid credentials
- Automatic redirect after successful login

### ✅ User Logout
- Secure logout functionality
- Clear authentication state

### ✅ Authentication State Management
- Global authentication context
- Persistent login state
- Protected routes (ready for implementation)

### ✅ UI/UX Improvements
- Loading states during authentication
- Error message display
- Responsive design with Tailwind CSS
- Navigation updates based on auth state

## File Structure

```
frontend/src/
├── contexts/
│   └── AuthContext.jsx          # Authentication context and provider
├── components/
│   └── ProtectedRoute.jsx       # Component for protecting routes
├── pages/
│   ├── Home.jsx                 # Home page with auth-aware content
│   ├── Login.jsx                # Login form with Firebase auth
│   └── Register.jsx             # Registration form with Firebase auth
├── firebase.js                  # Firebase configuration and initialization
└── App.jsx                      # Main app with AuthProvider wrapper
```

## Security Notes

1. Never commit your `.env` file to version control
2. Add `.env` to your `.gitignore` file
3. Use environment variables for all sensitive configuration
4. Consider implementing additional security rules in Firebase

## Troubleshooting

### Common Issues

1. **"Firebase: Error (auth/configuration-not-found)"**
   - Check that your Firebase configuration is correct
   - Ensure all environment variables are set properly

2. **"Firebase: Error (auth/invalid-api-key)"**
   - Verify your API key in the Firebase console
   - Check that the API key is correctly set in your `.env` file

3. **"Firebase: Error (auth/unauthorized-domain)"**
   - Add your domain (e.g., localhost:5173) to authorized domains in Firebase console
   - Go to Authentication > Settings > Authorized domains

## Next Steps

1. **Add Password Reset**: Implement forgot password functionality
2. **Email Verification**: Add email verification for new users
3. **Social Login**: Add Google, Facebook, or other social login options
4. **Profile Management**: Allow users to update their profiles
5. **Backend Integration**: Optionally integrate with your existing backend using Firebase Admin SDK

## Backend Integration (Optional)

If you want to integrate with your existing Node.js backend:

1. Install Firebase Admin SDK: `npm install firebase-admin`
2. Verify Firebase ID tokens on your backend
3. Use Firebase UID as user identifier in your database
4. Maintain user profiles in your MongoDB database

This allows you to use Firebase for authentication while keeping your existing backend logic.

