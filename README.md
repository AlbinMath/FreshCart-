# FreshCart - A Smart Fresh Product Delivery System

A comprehensive e-commerce platform for fresh product delivery with advanced user management, real-time notifications, and a powerful admin dashboard. FreshCart connects local fresh produce sellers with customers through an intuitive and efficient platform.

## 🌟 Key Features

### 🛒 E-commerce Platform
- **Product Catalog**: Browse fresh products with categories and filters
- **Shopping Cart**: Add/remove items with quantity controls
- **Order Management**: Track order status in real-time
- **Secure Checkout**: Multiple payment options
- **Product Reviews**: Rating and feedback system

### 🔐 Authentication & Security
- **Multi-factor Authentication**: Email verification
- **Role-Based Access Control**: Granular permissions
- **Session Management**: Secure token-based authentication
- **Data Encryption**: Sensitive data protection
- **Business License Validation**: Strict format enforcement (2 letters + 6 digits)

### 📱 Responsive Design
- Mobile-first approach
- Cross-browser compatibility
- Optimized for all device sizes
- Touch-friendly interfaces

### 👤 User Profile System
- **Personal Information**: Name, phone, date of birth, gender, profile picture
- **Address Management**: Add, edit, delete multiple addresses (home, work, other)
- **Security Settings**: Email verification, password management
- **Profile Updates**: Real-time profile editing and updates

### 🛡️ Admin Features
- **User Management**: View, activate/deactivate, and manage all users
- **System Statistics**: Real-time user counts and system metrics
- **Email Verification**: Admin can verify user emails manually
- **Role Management**: Change user roles and permissions
- **Analytics**: User growth and system performance metrics
- **Notification System**: Real-time notifications for admin actions and system events
- **Product Approval**: Manage and approve new product submissions
- **Store Management**: Approve and manage store registrations
- **Content Moderation**: Review and moderate user-generated content

### 🏪 Store & Seller Features
- **Store Management**: Registration, profile, and settings
- **Product Catalog**: Add, edit, and manage product listings
- **Order Processing**: Real-time order tracking and fulfillment
- **Inventory Control**: Stock level monitoring and alerts
- **Sales Analytics**: Performance metrics and reports
- **Business Hours**: Custom scheduling and availability

## 🛠️ Tech Stack

### Frontend
- **React 18** with Vite - Fast and efficient UI rendering
- **Tailwind CSS** - Utility-first CSS framework
- **React Router** - Client-side routing
- **Firebase** - Authentication and real-time database
- **WebSocket** - Real-time notifications and updates
- **React Query** - Server state management
- **Formik & Yup** - Form handling and validation

### Backend
- **Node.js** - JavaScript runtime
- **Express** - Web application framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB object modeling
- **JWT** - Secure authentication tokens
- **bcrypt** - Password hashing
- **Socket.IO** - Real-time bidirectional communication
- **Multer** - File upload handling
- **Nodemailer** - Email services

## 🗂️ Project Structure

```
FreshCart/
├── frontend/                 # React frontend application
│   ├── public/              # Static files
│   └── src/
│       ├── assets/          # Images, fonts, etc.
│       ├── components/      # Reusable UI components
│       │   ├── common/      # Common components (buttons, modals, etc.)
│       │   ├── forms/       # Form components
│       │   ├── layout/      # Layout components
│       │   └── ui/          # Basic UI elements
│       ├── contexts/        # React context providers
│       ├── hooks/           # Custom React hooks
│       ├── pages/           # Page components
│       │   ├── admin/       # Admin-specific pages
│       │   ├── auth/        # Authentication pages
│       │   ├── seller/      # Seller dashboard pages
│       │   └── user/        # User account pages
│       ├── services/        # API service layer
│       ├── utils/           # Utility functions
│       ├── App.jsx          # Main application component
│       └── main.jsx         # Application entry point
│
├── backend/                 # Node.js backend server
│   ├── config/             # Configuration files
│   ├── controllers/        # Route controllers
│   ├── middleware/         # Custom middleware
│   ├── models/             # MongoDB models
│   ├── routes/             # API routes
│   ├── services/           # Business logic
│   ├── utils/              # Utility functions
│   ├── server.js           # Main server file
│   └── socket.js           # WebSocket configuration
│
├── .gitignore
├── package.json
└── README.md
```

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (v5.0+)
- npm (v8.0+) or yarn
- Firebase account
- Git

### Backend Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd FreshCart/backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the backend directory:
   ```env
   MONGODB_URI=mongodb://localhost:27017/freshcart
   JWT_SECRET=your-secret-key
   PORT=5000
   ```

4. **Start the server**
   ```bash
   npm start
   ```

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd ../frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Firebase Configuration**
   Update `src/firebase.js` with your Firebase credentials:
   ```javascript
   const firebaseConfig = {
     apiKey: "your-api-key",
     authDomain: "your-domain.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-bucket.appspot.com",
     messagingSenderId: "your-sender-id",
     appId: "your-app-id"
   };
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

## API Documentation

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh-token` - Refresh access token
- `POST /api/auth/logout` - Invalidate session
- `GET /api/auth/me` - Get current user profile

### Users
- `GET /api/users/me` - Get current user profile
- `PUT /api/users/me` - Update profile
- `GET /api/users/me/addresses` - Get user addresses
- `POST /api/users/me/addresses` - Add new address
- `PUT /api/users/me/addresses/:id` - Update address
- `DELETE /api/users/me/addresses/:id` - Remove address

### Products
- `GET /api/products` - List all products (Public)
- `GET /api/products/:id` - Get product details (Public)
- `POST /api/products` - Create new product (Seller/Admin)
- `PUT /api/products/:id` - Update product (Owner/Admin)
- `DELETE /api/products/:id` - Delete product (Owner/Admin)
- `GET /api/products/seller` - Get seller's products (Seller)

### Orders
- `GET /api/orders` - Get user's orders (Customer)
- `POST /api/orders` - Create new order (Customer)
- `GET /api/orders/seller` - Get seller's orders (Seller)
- `PUT /api/orders/:id/status` - Update order status (Seller/Admin)

### Admin
- `GET /api/admin/users` - List all users (Admin)
- `PUT /api/admin/users/:id/status` - Update user status (Admin)
- `GET /api/admin/analytics` - Get system analytics (Admin)
- `GET /api/admin/notifications` - Get system notifications (Admin)
- `GET /api/admin/products/pending` - Get pending product approvals (Admin)
- `PUT /api/admin/products/:id/approve` - Approve product (Admin)
- `PUT /api/admin/products/:id/reject` - Reject product (Admin)

## 👥 User Roles & Permissions

### 👤 Customer
- Browse and purchase products
- Manage profile and addresses
- Track orders in real-time
- Write product reviews
- View order history

### 🏪 Store Owner
- All customer permissions
- Manage store profile and products
- Process and fulfill orders
- View sales analytics
- Handle returns and refunds

### 🔐 Admin
- Full system administration
- User and role management
- Content moderation
- System analytics
- Platform configuration

## 🛠️ Features in Detail

### 🔔 Real-time Notifications
- Order status updates
- System announcements
- Product approval alerts
- Admin notifications
- WebSocket integration

### 📦 Product Management
- Detailed product listings
- Category organization
- Inventory tracking
- Approval workflow

### 🛒 Order Processing
- Secure checkout
- Order tracking
- Payment integration
- Invoice generation
- Returns handling

## 🔒 Security

- **Authentication**: JWT with refresh tokens
- **Password Security**: bcrypt hashing
- **Authorization**: Role-based access
- **Data Protection**: Input validation
- **Rate Limiting**: API throttling
- **CORS**: Strict origin policy
- **CSRF Protection**: Anti-forgery tokens

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📧 Contact

Project Link: [https://github.com/yourusername/freshcart](https://github.com/yourusername/freshcart)

## 🙏 Acknowledgments

- [React](https://reactjs.org/)
- [Node.js](https://nodejs.org/)
- [MongoDB](https://www.mongodb.com/)
- [Firebase](https://firebase.google.com/)
- [Tailwind CSS](https://tailwindcss.com/)

## 📊 Project Status

🚧 Under Active Development 🚧

### Completed Features
- [x] User authentication
- [x] Role-based access control
- [x] Admin dashboard
- [x] Real-time notifications
- [x] Product management
- [x] Order processing

### In Progress
- [ ] Advanced analytics
- [ ] Mobile app development
- [ ] Multi-language support
- [ ] Payment gateway integration

## 🚀 Project Status

### ✅ Completed
- User authentication & authorization
- Role-based access control
- Admin dashboard
- Real-time notifications
- Product management
- Order processing
- Seller dashboard
- Store management

### 🚧 In Progress
- Advanced analytics
- Mobile app development
- Multi-language support
- Payment gateway integration

### 📅 Planned
- Advanced search & filters
- Review system
- Mobile app (React Native)
- AI recommendations
- Delivery integration

## Support

For support and questions, please open an issue in the GitHub repository or contact the development team.

---

**FreshCart** - Making fresh product delivery smart and accessible! 🥬🚚

