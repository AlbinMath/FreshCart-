// Validation utility functions for profile updates

export const validateProfileData = (profileData, userRole) => {
  const errors = [];

  // Name validation
  if (!profileData.name || profileData.name.trim().length < 2) {
    errors.push("Name must be at least 2 characters long");
  }

  // Phone validation
  if (profileData.phone && !/^\+?[\d\s\-\(\)]+$/.test(profileData.phone)) {
    errors.push("Invalid phone number format");
  }

  // Date of birth validation
  if (profileData.dateOfBirth) {
    const dob = new Date(profileData.dateOfBirth);
    const today = new Date();
    const age = today.getFullYear() - dob.getFullYear();
    
    if (age < 13 || age > 120) {
      errors.push("Invalid date of birth (age must be between 13 and 120)");
    }
  }

  // Profile picture URL validation
  if (profileData.profilePicture && profileData.profilePicture.trim() !== '') {
    const urlPattern = /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i;
    if (!urlPattern.test(profileData.profilePicture)) {
      errors.push("Profile picture must be a valid image URL (jpg, jpeg, png, gif, webp)");
    }
  }

  // Role-specific validations
  if (userRole === 'store') {
    if (profileData.storeName && profileData.storeName.trim().length < 2) {
      errors.push("Store name must be at least 2 characters long");
    }
    if (profileData.businessLicense) {
      // Case-insensitive 2 letters + 6 digits (e.g., AB123456)
      const businessLicensePattern = /^[a-zA-Z]{2}\d{6}$/;
      if (!businessLicensePattern.test(profileData.businessLicense.trim())) {
        errors.push("Business license must be in format: 2 letters followed by 6 digits (e.g., AB123456)");
      }
    }
    if (profileData.storeAddress && profileData.storeAddress.trim().length < 10) {
      errors.push("Store address must be at least 10 characters long");
    }
  }

  if (userRole === 'delivery') {
    if (profileData.licenseNumber && profileData.licenseNumber.trim().length < 8) {
      errors.push("License number must be at least 8 characters long");
    }
    if (profileData.vehicleType && !['bike', 'scooter', 'car', 'van'].includes(profileData.vehicleType)) {
      errors.push("Invalid vehicle type selected");
    }
  }

  if (userRole === 'seller') {
    const validCategories = [
      'vegetables', 'fruits', 'dairy', 'meat', 'seafood', 
      'ready-to-cook', 'organic', 'bakery', 'beverages', 
      'household', 'other'
    ];
    if (profileData.sellerCategory && !validCategories.includes(profileData.sellerCategory)) {
      errors.push("Invalid seller category selected");
    }
  }

  if (userRole === 'admin') {
    if (profileData.adminLevel && !['support', 'manager', 'super'].includes(profileData.adminLevel)) {
      errors.push("Invalid admin level selected");
    }
  }

  return errors;
};

export const validatePasswordChange = (passwordData) => {
  const errors = [];

  if (!passwordData.currentPassword) {
    errors.push("Current password is required");
  }

  if (!passwordData.newPassword) {
    errors.push("New password is required");
  } else if (passwordData.newPassword.length < 6) {
    errors.push("New password must be at least 6 characters long");
  }

  if (passwordData.newPassword !== passwordData.confirmPassword) {
    errors.push("New passwords do not match");
  }

  if (passwordData.currentPassword === passwordData.newPassword) {
    errors.push("New password must be different from current password");
  }

  return errors;
};

export const validateAddress = (addressData) => {
  const errors = [];

  if (!addressData.street || addressData.street.trim().length < 5) {
    errors.push("Street address must be at least 5 characters long");
  }

  if (!addressData.city || addressData.city.trim().length < 2) {
    errors.push("City must be at least 2 characters long");
  }

  if (!addressData.state || addressData.state.trim().length < 2) {
    errors.push("State must be at least 2 characters long");
  }

  if (!addressData.zipCode || !/^\d{5,6}$/.test(addressData.zipCode)) {
    errors.push("ZIP code must be 5-6 digits");
  }

  if (!addressData.country || addressData.country.trim().length < 2) {
    errors.push("Country must be at least 2 characters long");
  }

  if (!['home', 'work', 'other'].includes(addressData.type)) {
    errors.push("Invalid address type");
  }

  return errors;
};

export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  // Remove potentially harmful characters
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
};

export const validateBusinessLicense = (license) => {
  if (!license) return { isValid: true, message: '' };
  
  const trimmed = license.trim();
  // Case-insensitive 2 letters + 6 digits (matching backend validation)
  const pattern = /^[a-zA-Z]{2}\d{6}$/;
  
  if (!pattern.test(trimmed)) {
    return {
      isValid: false,
      message: 'Format: 2 letters + 6 digits (e.g., AB123456)'
    };
  }
  
  return { isValid: true, message: 'Valid format' };
};

export const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // Format based on length
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return cleaned.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '+$1 ($2) $3-$4');
  }
  
  return cleaned;
};