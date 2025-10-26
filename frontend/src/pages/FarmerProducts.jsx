import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';

export default function FarmerProducts() {
  const { currentUser, getUserProfile } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [userProducts, setUserProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const categories = [
    'vegetables',
    'fruits', 
    'dairy',
    'meat',
    'seafood',
    'other'
  ];

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    
    const profile = getUserProfile();
    if (!profile) {
      navigate('/profile');
      return;
    }
    
    // Allow both customers and farmers to view farmer products
    if (profile.role !== 'customer' && profile.role !== 'farmer') {
      navigate('/profile');
      return;
    }
    
    fetchUserProducts();
  }, [currentUser, navigate, getUserProfile]);

  const fetchUserProducts = async () => {
    setLoading(true);
    try {
      console.log('🔍 Fetching farmer products for user...');
      const response = await fetch(`http://localhost:5000/api/farmer-products/my-products`, {
        headers: { 'x-uid': currentUser.uid }
      });
      const data = await response.json();
      console.log('📥 Farmer products response:', data);
      if (data.success) {
        setUserProducts(data.products);
        console.log('📦 Set user products:', data.products?.length || 0);
        // Log seller acceptance details
        data.products?.forEach(product => {
          if (product.acceptedBySellers && product.acceptedBySellers.length > 0) {
            console.log(`📊 Product "${product.productName}" accepted by:`, product.acceptedBySellers);
          }
        });
      } else {
        toast.error('Failed to fetch your products');
      }
    } catch (error) {
      console.error('Error fetching user products:', error);
      toast.error('Failed to fetch your products');
    } finally {
      setLoading(false);
    }
  };

  const filteredUserProducts = userProducts.filter(product => {
    const matchesSearch = product.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) {
      return;
    }
    
    try {
      const response = await fetch(`http://localhost:5000/api/farmer-products/${productId}`, {
        method: 'DELETE',
        headers: { 'x-uid': currentUser.uid }
      });
      
      if (response.ok) {
        toast.success('Product deleted successfully');
        fetchUserProducts(); // Refresh user products
      } else {
        toast.error('Failed to delete product');
      }
    } catch (error) {
      toast.error('Error deleting product');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Farmer Products</h1>
              <p className="text-gray-600 mt-2">Manage your submitted farm products</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/farmer-product-submission')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Submit Product
              </button>
              <button
                onClick={() => navigate('/profile')}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Back to Profile
              </button>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Products</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Search by product name or description..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="text-gray-500">Loading your products...</div>
            </div>
          ) : filteredUserProducts.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 mb-2">You haven't submitted any products yet</div>
              <button
                onClick={() => navigate('/farmer-product-submission')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Submit Your First Product
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredUserProducts.map((product) => (
                <div key={product._id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  {/* Product Image */}
                  {product.imagePath && (
                    <img
                      src={product.imagePath}
                      alt={product.productName}
                      className="w-full h-48 object-cover rounded mb-4"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                  
                  {/* Product Info */}
                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold text-gray-900">{product.productName}</h3>
                    
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {product.category}
                      </span>
                      <span className="text-lg font-bold text-green-600">₹{product.price}</span>
                    </div>

                    <div className="text-sm text-gray-600">
                      <div>Available: {product.quantity} units</div>
                      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${
                        product.status === 'approved' ? 'bg-green-100 text-green-800' :
                        product.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        Status: {product.status}
                      </div>
                    </div>

                    {product.description && (
                      <p className="text-sm text-gray-600 line-clamp-3">{product.description}</p>
                    )}

                    {product.status === 'rejected' && product.rejectionReason && (
                      <div className="bg-red-50 border border-red-200 rounded p-2">
                        <p className="text-xs text-red-700">
                          <strong>Reason:</strong> {product.rejectionReason}
                        </p>
                      </div>
                    )}

                    {/* Seller Acceptance Details */}
                    {product.status === 'approved' && product.acceptedBySellers && product.acceptedBySellers.length > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-semibold text-green-800">
                            ✅ Accepted by {product.acceptedBySellers.length} seller{product.acceptedBySellers.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {product.acceptedBySellers.map((seller, index) => (
                            <div key={index} className="bg-white rounded p-2 border border-green-100">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{seller.sellerName}</div>
                                  <div className="text-xs text-gray-600">
                                    Store: {seller.storeDetails?.storeName || 'N/A'}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    Address: {seller.storeDetails?.storeAddress || 'N/A'}
                                  </div>
                                </div>
                                <div className="text-xs text-gray-500">
                                  {seller.acceptedAt ? new Date(seller.acceptedAt).toLocaleDateString() : 'Recently'}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      
                      <button
                        onClick={() => handleDeleteProduct(product._id)}
                        className="flex-1 px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

