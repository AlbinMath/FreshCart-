import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import EmailVerification from '../components/EmailVerification';
import { cartService } from '../../../backend/services/cartService';

function Home() {
  const { currentUser, logout, getUserProfile } = useAuth();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [stock, setStock] = useState(false);
  const [addingToCart, setAddingToCart] = useState(new Set());

  // Check user role and redirect if necessary
  useEffect(() => {
    if (currentUser) {
      const profile = getUserProfile();
      if (profile) {
        // Redirect users with specific roles to their dashboards
        if (profile.role === 'admin') {
          navigate('/admin', { replace: true });
          return;
        } else if (profile.role === 'delivery') {
          navigate('/delivery', { replace: true });
          return;
        } else if (['store', 'seller'].includes(profile.role)) {
          navigate('/seller', { replace: true });
          return;
        }
      }
    }
  }, [currentUser, navigate, getUserProfile]);

  // Fetch products from the public API
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        // Always use public endpoint without includeAll to enforce approved + in-stock filtering on backend
        const url = `${import.meta.env.VITE_API_BASE_URL}/public/products`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
          setProducts(data.products);
        } else {
          setError('Failed to fetch products from server');
        }
      } catch (err) {
        console.error('Error fetching products:', err);
        setError('Failed to load products from server');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);



  // Filter products based on category and search term; always require stock > 0
  const filteredProducts = products
    .filter(product => {
      const productCategory = String(product.category || 'other').toLowerCase();
      const matchesCategory = selectedCategory === 'all' || productCategory === selectedCategory;
      const name = String(product.name || '').toLowerCase();
      const desc = String(product.description || '').toLowerCase();
      const term = searchTerm.toLowerCase();
      const matchesSearch = name.includes(term) || desc.includes(term);
      const stockValue = Number(product.stock ?? 0);
      const matchesStock = stockValue > 0; // Always in-stock only
      return matchesCategory && matchesSearch && matchesStock;
    });

  // Sort in-stock first, then by higher stock count
  const sortedFilteredProducts = [...filteredProducts].sort((a, b) => {
    const aStock = Number(a.stock ?? 0);
    const bStock = Number(b.stock ?? 0);
    const aIn = aStock > 0;
    const bIn = bStock > 0;
    if (aIn && !bIn) return -1;
    if (!aIn && bIn) return 1;
    return bStock - aStock;
  });

  // Group by category (normalized to lowercase) after sorting
  const groupedByCategory = sortedFilteredProducts.reduce((acc, p) => {
    const key = String(p.category || 'other').toLowerCase();
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  // Categories for filter dropdown (normalized)
  const categories = ['all', ...new Set(products.map(product => String(product.category || 'other').toLowerCase()))];

  // Categories to display in sections (normalized)
  const categoriesForDisplay = selectedCategory === 'all'
    ? Array.from(new Set(sortedFilteredProducts.map(p => String(p.category || 'other').toLowerCase())))
    : [selectedCategory];

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(price);
  };

  const handleAddToCart = async (product) => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    const profile = getUserProfile();
    if (profile?.role !== 'customer') {
      alert('Only customers can add items to cart');
      return;
    }

    setAddingToCart(prev => new Set(prev).add(product._id));

    try {
      // Use the identifier as expected by getSellerProductModel (not the full collection name)
      const identifier = product.sellerInfo?.sellerUniqueNumber || product.sellerInfo?.uid || 'unknown';
      const safeIdentifier = String(identifier).replace(/[^a-zA-Z0-9_-]/g, '_');

      await cartService.addToCart(currentUser.uid, {
        productId: product._id,
        sellerCollection: safeIdentifier, // Pass just the identifier
        sellerUid: product.sellerInfo?.uid,
        quantity: 1
      });

      // Show success message
      alert('Product added to cart successfully!');
    } catch (err) {
      console.error('Error adding to cart:', err);
      alert(err.message || 'Failed to add product to cart');
    } finally {
      setAddingToCart(prev => {
        const newSet = new Set(prev);
        newSet.delete(product._id);
        return newSet;
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Email Verification Banner */}
        {currentUser && <EmailVerification />}

        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            Welcome to FreshCart
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Your Smart Fresh Product Delivery System
          </p>
          
          {currentUser ? (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
              <p className="font-semibold">
                Welcome back, {currentUser.displayName || currentUser.email}!
              </p>
              <p className="text-sm">You are successfully logged in.</p>
              <div className="mt-3">
                <Link 
                  to="/profile" 
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded text-sm mr-2"
                >
                  View Profile
                </Link>

              </div>
            </div>
          ) : (
            <div className="space-x-4">
              <Link 
                to="/login" 
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded"
              >
                Login
              </Link>
              <Link 
                to="/register" 
                className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-6 rounded"
              >
                Register
              </Link>
            </div>
          )}
        </div>

        
        

        {/* Product Browsing Section */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">
            Browse Fresh Products
          </h2>
          
          {/* Search and Filter Controls */}
          <div className="mb-8 bg-white p-6 rounded-lg shadow-md">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search Bar */}
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              {/* Category Filter */}
              <div className="md:w-48">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* In Stock Only Toggle */}
              <label className="flex items-center gap-2 select-none">
                <input
                  type="checkbox"
                  checked={stock}
                  onChange={(e) => setStock(e.target.checked)}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">In Stock only</span>
              </label>
            </div>
          </div>

          {/* Products Grid */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="mt-4 text-gray-600">Loading products...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-500 mb-4">⚠️</div>
              <p className="text-red-600">{error}</p>
            </div>
          ) : sortedFilteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">📦</div>
              <p className="text-gray-600">
                {products.length === 0 ? 'No products available at the moment.' : 'No products match your search criteria.'}
              </p>
            </div>
          ) : (
            <div className="space-y-10">
              {categoriesForDisplay.map((category) => (
                <div key={category}>
                  <h3 className="text-2xl font-semibold text-gray-800 mb-4">
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {(groupedByCategory[category] || []).map((product) => (
                      <div key={product._id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                        {/* Product Image */}
                        <div className="h-48 bg-gray-200 flex items-center justify-center">
                          {product.images && product.images.length > 0 ? (
                            <img
                              src={product.images[0]}
                              alt={product.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div className="text-gray-400 text-4xl" style={{display: product.images && product.images.length > 0 ? 'none' : 'flex'}}>
                            📦
                          </div>
                        </div>
                        
                        {/* Product Info */}
                        <div className="p-4">
                          <h3 className="font-semibold text-lg text-gray-800 mb-2 line-clamp-2">
                            {product.name}
                          </h3>
                          
                          {product.description && (
                            <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                              {product.description}
                            </p>
                          )}
                          
                          {/* Category Badge */}
                          <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mb-3">
                            {product.category}
                          </span>
                          
                          {/* Price */}
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <span className="text-xl font-bold text-green-600">
                                {formatPrice(product.price)}
                              </span>
                              {product.mrpPrice && product.mrpPrice > product.price && (
                                <span className="text-sm text-gray-500 line-through ml-2">
                                  {formatPrice(product.mrpPrice)}
                                </span>
                              )}
                            </div>
                            
                            {/* Stock Status */}
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              product.stock > 0 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                            </span>
                          </div>
                          
                          {/* Seller Info */}
                          <div className="text-xs text-gray-500 mb-3">
                            Sold by: {product.sellerInfo?.name || 'Unknown Seller'}
                          </div>
                          
                          {/* Add to Cart Button */}
                          <button
                            onClick={() => handleAddToCart(product)}
                            disabled={product.stock === 0 || addingToCart.has(product._id)}
                            className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                              product.stock > 0 && !addingToCart.has(product._id)
                                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            {addingToCart.has(product._id)
                              ? 'Adding...'
                              : product.stock > 0
                                ? 'Add to Cart'
                                : 'Out of Stock'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-3xl mb-4">🥬</div>
            <h3 className="text-xl font-semibold mb-2">Fresh Products</h3>
            <p className="text-gray-600">
              Get the freshest vegetables, fruits, and groceries delivered to your door.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-3xl mb-4">🚚</div>
            <h3 className="text-xl font-semibold mb-2">Fast Delivery</h3>
            <p className="text-gray-600">
              Quick and reliable delivery service to ensure freshness.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-3xl mb-4">📱</div>
            <h3 className="text-xl font-semibold mb-2">Smart System</h3>
            <p className="text-gray-600">
              Intelligent ordering system that learns your preferences.
            </p>
          </div>
        </div>

        {/* Call to Action */}
        {!currentUser && (
          <div className="text-center bg-blue-50 p-8 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">Ready to get started?</h2>
            <p className="text-gray-600 mb-6">
              Join thousands of customers who trust FreshCart for their fresh product needs.
            </p>
            <Link 
              to="/register" 
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-lg"
            >
              Start Shopping Now
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;


