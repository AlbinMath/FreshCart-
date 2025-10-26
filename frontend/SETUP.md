# FreshCart Frontend Setup Guide

## Firebase Configuration

1. **Create a Firebase Project:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Click "Add project"
   - Enter project name: "FreshCart" (or your preferred name)
   - Follow the setup wizard

2. **Enable Authentication:**
   - In Firebase Console, go to "Authentication" → "Sign-in method"
   - Enable "Email/Password" provider
   - Click "Save"

3. **Get Firebase Config:**
   - In Firebase Console, go to Project Settings (gear icon)
   - Scroll down to "Your apps" section
   - Click "Add app" → "Web" (</>)
   - Register app with name "FreshCart Web"
   - Copy the config object

4. **Create Environment File:**
   - Create `.env.local` file in the `frontend` directory
   - Add your Firebase config:

```env
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

## Running the Application

1. **Install Dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Start Development Server:**
   ```bash
   npm run dev
   ```

3. **Open Browser:**
   - Navigate to `http://localhost:5173`

## Features Implemented

✅ **User Authentication:**
- User registration with role selection (Customer, Store Owner, Seller, Admin)
- User login/logout
- Protected routes
- Role-based navigation

✅ **Modern UI:**
- Responsive design with Tailwind CSS
- Beautiful gradient backgrounds
- Interactive form elements
- Role-specific registration fields

✅ **Multi-Role System:**
- **Customer**: Can browse products, place orders
- **Store Owner**: Can manage store inventory, view orders
- **Seller**: Can list products, manage listings
- **Admin**: Can manage all users, stores, and system settings

## Next Steps

1. **Backend Integration:**
   - Connect to your Node.js backend
   - Implement user profile management
   - Add product management

2. **Additional Features:**
   - Product catalog
   - Shopping cart
   - Order management
   - Payment integration

3. **Testing:**
   - Test user registration with different roles
   - Verify authentication flow
   - Test role-based navigation

## Troubleshooting

- **Firebase Connection Issues:** Check your environment variables
- **Authentication Errors:** Ensure Firebase Auth is enabled
- **Build Errors:** Make sure all dependencies are installed


