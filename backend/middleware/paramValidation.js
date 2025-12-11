
export const validateAddressId = (req, res, next) => {
  const { addressId } = req.params;

  // Check if addressId exists
  if (!addressId) {
    return res.status(400).json({
      success: false,
      message: 'Address ID is required'
    });
  }

  // Check type
  if (typeof addressId !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Address ID must be a string'
    });
  }

  // Trim and check length
  const trimmedId = addressId.trim();
  
  if (trimmedId.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Address ID cannot be empty'
    });
  }

  if (trimmedId.length > 50) {
    return res.status(400).json({
      success: false,
      message: 'Address ID is too long'
    });
  }

  // Check for valid characters (alphanumeric, hyphens, underscores only)
  // This prevents injection attempts
  const validIdPattern = /^[a-zA-Z0-9_-]+$/;
  if (!validIdPattern.test(trimmedId)) {
    return res.status(400).json({
      success: false,
      message: 'Address ID contains invalid characters'
    });
  }

  // Replace the param with the trimmed version
  req.params.addressId = trimmedId;
  
  next();
};


export const validateId = (paramName = 'id', maxLength = 50) => {
  return (req, res, next) => {
    const id = req.params[paramName];

    if (!id) {
      return res.status(400).json({
        success: false,
        message: `${paramName} is required`
      });
    }

    if (typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        message: `${paramName} must be a string`
      });
    }

    const trimmedId = id.trim();
    
    if (trimmedId.length === 0) {
      return res.status(400).json({
        success: false,
        message: `${paramName} cannot be empty`
      });
    }

    if (trimmedId.length > maxLength) {
      return res.status(400).json({
        success: false,
        message: `${paramName} is too long`
      });
    }

    const validIdPattern = /^[a-zA-Z0-9_-]+$/;
    if (!validIdPattern.test(trimmedId)) {
      return res.status(400).json({
        success: false,
        message: `${paramName} contains invalid characters`
      });
    }

    req.params[paramName] = trimmedId;
    next();
  };
};