
const sanitizeString = (str) => {
  if (typeof str !== 'string') return '';
  // Remove any HTML tags and trim whitespace
  return str.replace(/<[^>]*>/g, '').trim();
};

// Helper function to validate phone number
const isValidPhone = (phone) => {
  // Allow digits, spaces, +, -, (, )
  const phoneRegex = /^[\d\s\+\-\(\)]+$/;
  return phoneRegex.test(phone);
};

// Helper function to validate postal code (Ghana format)
const isValidPostalCode = (code) => {
  // Ghana postal codes are alphanumeric (e.g., GA-123-4567 or AK123)
  const postalRegex = /^[A-Z]{2}[-\s]?\d{3}[-\s]?\d{4}$|^[A-Z]{2}\d{3}$/i;
  return postalRegex.test(code);
};

// Valid Ghana regions
export const VALID_REGIONS = [
  "Ahafo", "Ashanti", "Bono", "Bono East", "Central", "Eastern", 
  "Greater Accra", "North East", "Northern", "Oti", "Savannah", 
  "Upper East", "Upper West", "Volta", "Western", "Western North"
];


export const validateAddressData = (data, isUpdate = false) => {
  const errors = [];
  const sanitizedData = {};

  // Recipient validation
  if (data.recipient !== undefined) {
    const recipient = sanitizeString(data.recipient);
    
    if (!isUpdate && !recipient) {
      errors.push('Recipient name is required');
    } else if (recipient) {
      if (recipient.length < 2) {
        errors.push('Recipient name must be at least 2 characters');
      }
      if (recipient.length > 100) {
        errors.push('Recipient name must not exceed 100 characters');
      }
      if (!/^[a-zA-Z\s\-\.\']+$/.test(recipient)) {
        errors.push('Recipient name can only contain letters, spaces, hyphens, periods, and apostrophes');
      }
      sanitizedData.recipient = recipient;
    }
  } else if (!isUpdate) {
    errors.push('Recipient is required');
  }

  // Phone validation
  if (data.phone !== undefined) {
    const phone = sanitizeString(data.phone);
    
    if (!isUpdate && !phone) {
      errors.push('Phone number is required');
    } else if (phone) {
      if (phone.length < 10) {
        errors.push('Phone number must be at least 10 characters');
      }
      if (phone.length > 20) {
        errors.push('Phone number must not exceed 20 characters');
      }
      if (!isValidPhone(phone)) {
        errors.push('Phone number contains invalid characters');
      }
      sanitizedData.phone = phone;
    }
  } else if (!isUpdate) {
    errors.push('Phone number is required');
  }

  // Address Line 1 validation
  if (data.addressLine1 !== undefined) {
    const addressLine1 = sanitizeString(data.addressLine1);
    
    if (!isUpdate && !addressLine1) {
      errors.push('Address line 1 is required');
    } else if (addressLine1) {
      if (addressLine1.length < 3) {
        errors.push('Address line 1 must be at least 5 characters');
      }
      if (addressLine1.length > 200) {
        errors.push('Address line 1 must not exceed 200 characters');
      }
      sanitizedData.addressLine1 = addressLine1;
    }
  } else if (!isUpdate) {
    errors.push('Address line 1 is required');
  }

  // Address Line 2 validation (optional)
  if (data.addressLine2 !== undefined && data.addressLine2 !== null) {
    const addressLine2 = sanitizeString(data.addressLine2);
    
    if (addressLine2) {
      if (addressLine2.length > 200) {
        errors.push('Address line 2 must not exceed 200 characters');
      }
      sanitizedData.addressLine2 = addressLine2;
    } else {
      sanitizedData.addressLine2 = null;
    }
  }

  // City validation
  if (data.city !== undefined) {
    const city = sanitizeString(data.city);
    
    if (!isUpdate && !city) {
      errors.push('City is required');
    } else if (city) {
      if (city.length < 2) {
        errors.push('City name must be at least 2 characters');
      }
      if (city.length > 100) {
        errors.push('City name must not exceed 100 characters');
      }
      if (!/^[a-zA-Z\s\-]+$/.test(city)) {
        errors.push('City name can only contain letters, spaces, and hyphens');
      }
      sanitizedData.city = city;
    }
  } else if (!isUpdate) {
    errors.push('City is required');
  }

  // Region validation
  if (data.region !== undefined) {
    const region = sanitizeString(data.region);
    
    if (!isUpdate && !region) {
      errors.push('Region is required');
    } else if (region) {
      if (!VALID_REGIONS.includes(region)) {
        errors.push(`Invalid region. Must be one of: ${VALID_REGIONS.join(', ')}`);
      }
      sanitizedData.region = region;
    }
  } else if (!isUpdate) {
    errors.push('Region is required');
  }

  // Country validation (optional, defaults to Ghana)
  if (data.country !== undefined) {
    const country = sanitizeString(data.country);
    
    if (country) {
      if (country.length < 2 || country.length > 100) {
        errors.push('Country name must be between 2 and 100 characters');
      }
      if (!/^[a-zA-Z\s\-]+$/.test(country)) {
        errors.push('Country name can only contain letters, spaces, and hyphens');
      }
      sanitizedData.country = country;
    }
  }

  // Postal code validation (optional)
  if (data.postalCode !== undefined && data.postalCode !== null) {
    const postalCode = sanitizeString(data.postalCode);
    
    if (postalCode) {
      if (postalCode.length > 20) {
        errors.push('Postal code must not exceed 20 characters');
      }
      sanitizedData.postalCode = postalCode;
    } else {
      sanitizedData.postalCode = null;
    }
  }

  // isDefault validation
  if (data.isDefault !== undefined) {
    if (typeof data.isDefault !== 'boolean') {
      errors.push('isDefault must be a boolean value');
    } else {
      sanitizedData.isDefault = data.isDefault;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData
  };
};

export const checkAddressLimit = async (prisma, userId, maxAddresses = 10) => {
  const count = await prisma.address.count({
    where: { userId }
  });
  
  return count < maxAddresses;
};


export const validateAddressInput = (isUpdate = false) => {
  return (req, res, next) => {
    const validation = validateAddressData(req.body, isUpdate);
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      });
    }
    
    // Replace req.body with sanitized data
    req.body = validation.sanitizedData;
    next();
  };
};