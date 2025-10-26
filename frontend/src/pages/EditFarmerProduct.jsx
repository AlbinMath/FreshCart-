import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';

export default function EditFarmerProduct() {
  const { currentUser, getUserProfile } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [product, setProduct] = useState(null);
  
  const [formData, setFormData] = useState({
    productName: '',
    category: '',
    description: '',
    price: '',
    quantity: '',
    imageFile: null,
    currentImage: ''
  });

  const [fileInputKey, setFileInputKey] = useState(Date.now());

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
    
    // Allow both customers and farmers to edit products
    if (profile.role !== 'customer' && profile.role !== 'farmer') {
      toast.error('You need to be a customer or farmer to edit products');
      navigate('/profile');
      return;
    }
    
    if (id) {
      fetchProduct();
    }
  }, [currentUser, navigate, getUserProfile, id]);

  const fetchProduct = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/farmer-products/${id}`, {
        headers: { 'x-uid': currentUser.uid }
      });
      
      const data = await response.json();
      if (data.success) {
        const productData = data.product;
        setProduct(productData);
        
        // Populate form with existing data
        setFormData({
          productName: productData.productName,
          category: productData.category,
          description: productData.description,
          price: productData.price.toString(),
          quantity: productData.quantity.toString(),
          imageFile: null,
          currentImage: productData.imagePath || ''
        });
      } else {
        toast.error(data.message || 'Failed to fetch product');
        navigate('/farmer-products');
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      toast.error('Failed to fetch product');
      navigate('/farmer-products');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    
    if (name === 'imageFile') {
      setFormData(prev => ({ ...prev, imageFile: files && files[0] ? files[0] : null }));
      return;
    }
    
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (['price', 'quantity'].includes(name)) {
      setFormData(prev => ({ ...prev, [name]: value.replace(/[^0-9.]/g, '') }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Validation
    if (!formData.productName.trim()) {
      setError('Product name is required');
      setLoading(false);
      return;
    }
    
    if (!formData.category) {
      setError('Please select a category');
      setLoading(false);
      return;
    }
    
    const priceNum = parseFloat(formData.price);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      setError('Price must be a non-negative number');
      setLoading(false);
      return;
    }
    
    const quantityNum = parseInt(formData.quantity, 10);
    if (Number.isNaN(quantityNum) || quantityNum < 0) {
      setError('Quantity must be a non-negative number');
      setLoading(false);
      return;
    }

    // Upload new image if provided
    let uploadedImageUrl = formData.currentImage;
    if (formData.imageFile) {
      const fd = new FormData();
      fd.append('image', formData.imageFile);
      try {
        const upRes = await fetch('http://localhost:5000/api/upload/product-image', {
          method: 'POST',
          headers: { 'x-uid': currentUser.uid },
          body: fd
        });
        
        const upData = await upRes.json();
        if (!upRes.ok || !upData?.success) {
          throw new Error(upData?.message || 'Image upload failed');
        }
        uploadedImageUrl = upData.fullUrl || upData.url;
      } catch (e) {
        setError(e.message || 'Image upload failed');
        setLoading(false);
        return;
      }
    }

    // Prepare update data
    const updateData = {
      productName: formData.productName.trim(),
      category: formData.category,
      description: formData.description.trim(),
      price: priceNum,
      quantity: quantityNum
    };

    // Only include imagePath in update if a new image was uploaded
    if (uploadedImageUrl !== formData.currentImage) {
      updateData.imagePath = uploadedImageUrl;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/farmer-products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-uid': currentUser.uid
        },
        body: JSON.stringify(updateData)
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || 'Failed to update product');
      }
      
      setSuccess('Product updated successfully!');
      toast.success('Product updated successfully!');
      
      // Refresh product data
      fetchProduct();
      
    } catch (e) {
      setError(e.message || 'Failed to update product');
      toast.error(e.message || 'Failed to update product');
    } finally {
      setLoading(false);
    }
  };

  if (!product && id) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-center py-12">
              <div className="text-gray-500">Loading product...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Edit Farmer Product</h1>
              <p className="text-gray-600 mt-2">Update your farm product details</p>
            </div>
            <button
              onClick={() => navigate('/farmer-products')}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Back to Products
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {error && (
            <div className="alert alert-danger mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800">{error}</p>
            </div>
          )}
          
          {success && (
            <div className="alert alert-success mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Product Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Product Name *</label>
                <input
                  type="text"
                  name="productName"
                  value={formData.productName}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Enter product name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                >
                  <option value="">Select Category</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Enter product description"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Price (₹) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Enter price"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quantity *</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Enter quantity"
                  required
                />
              </div>
            </div>

            {/* Current Image */}
            {formData.currentImage && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Current Image</label>
                <img 
                  src={formData.currentImage} 
                  alt="Current product" 
                  className="w-32 h-32 object-cover rounded mb-2"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
            )}

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Update Image (JPG/PNG)</label>
              <input
                key={fileInputKey}
                type="file"
                name="imageFile"
                accept="image/jpeg,image/png"
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <div className="text-xs text-gray-500 mt-1">Maximum file size: 5MB. Supported formats: JPG, PNG</div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => navigate('/farmer-products')}
                className="px-6 py-3 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-400 transition duration-200"
              >
                {loading ? 'Updating...' : 'Update Product'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}