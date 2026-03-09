const Joi = require('joi');

// Common validation schemas
const schemas = {
  phoneNumber: Joi.string()
    .pattern(/^[0-9+\-\s()]+$/)
    .min(10)
    .max(20)
    .required()
    .messages({
      'string.pattern.base': 'Phone number must contain only digits, plus, minus, spaces, or parentheses',
      'string.min': 'Phone number must be at least 10 characters long',
      'string.max': 'Phone number must not exceed 20 characters',
      'any.required': 'Phone number is required'
    }),

  verificationCode: Joi.string()
    .pattern(/^[0-9]{6}$/)
    .required()
    .messages({
      'string.pattern.base': 'Verification code must be exactly 6 digits',
      'any.required': 'Verification code is required'
    }),

  countryCode: Joi.string()
    .pattern(/^[0-9]{1,4}$/)
    .default('91')
    .messages({
      'string.pattern.base': 'Country code must be 1-4 digits'
    }),

  date: Joi.date()
    .iso()
    .required()
    .messages({
      'date.format': 'Date must be in ISO format (YYYY-MM-DD)',
      'any.required': 'Date is required'
    }),

  day: Joi.number()
    .integer()
    .min(1)
    .max(90)
    .required()
    .messages({
      'number.min': 'Day must be between 1 and 90',
      'number.max': 'Day must be between 1 and 90',
      'any.required': 'Day is required'
    }),

  skinScoreMetrics: Joi.object({
    darkest_patch: Joi.number().integer().min(1).max(5).default(0),
    skin_tone: Joi.number().integer().min(1).max(5).default(0),
    texture: Joi.number().integer().min(1).max(5).default(0),
    confidence: Joi.number().integer().min(1).max(5).default(0)
  }),

  patientId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid patient ID format',
      'any.required': 'Patient ID is required'
    })
};

// Validation middleware factory
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = req[source];
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context.value
      }));

      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }

    // Replace the original data with validated and sanitized data
    req[source] = value;
    next();
  };
};

// Specific validation schemas for different endpoints
const validationSchemas = {
  sendVerification: Joi.object({
    phoneNumber: schemas.phoneNumber,
    countryCode: schemas.countryCode
  }),

  verifyCode: Joi.object({
    phoneNumber: schemas.phoneNumber,
    verificationCode: schemas.verificationCode,
    deviceFingerprint: Joi.string().optional()
  }),

  register: Joi.object({
    phoneNumber: schemas.phoneNumber,
    verificationCode: schemas.verificationCode,
    deviceFingerprint: Joi.string().optional()
  }),

  verifyToken: Joi.object({
    authToken: Joi.string().min(32).required().messages({
      'string.min': 'Auth token must be at least 32 characters long',
      'any.required': 'Auth token is required'
    }),
    deviceFingerprint: Joi.string().optional()
  }),

  skinScore: Joi.object({
    patientId: schemas.patientId.optional(),
    patientPhone: schemas.phoneNumber.required(),
    date: schemas.date,
    day: schemas.day,
    darkest_patch: Joi.number().integer().min(1).max(5).default(0),
    skin_tone: Joi.number().integer().min(1).max(5).default(0),
    texture: Joi.number().integer().min(1).max(5).default(0),
    confidence: Joi.number().integer().min(1).max(5).default(0),
    photoUrl: Joi.string().uri().optional(),
    notes: Joi.string().max(500).optional()
  }),

  checkIn: Joi.object({
    patientId: schemas.patientId.optional(),
    patientPhone: schemas.phoneNumber.required(),
    date: schemas.date,
    day: schemas.day,
    mood: Joi.number().integer().min(1).max(5).required(),
    energy: Joi.number().integer().min(1).max(5).required(),
    sleep: Joi.number().integer().min(1).max(5).required(),
    stress: Joi.number().integer().min(1).max(5).required(),
    water: Joi.number().integer().min(0).max(10).default(0),
    diet: Joi.number().integer().min(1).max(5).default(0),
    exercise: Joi.number().integer().min(1).max(5).default(0),
    skincare: Joi.number().integer().min(1).max(5).default(0),
    notes: Joi.string().max(500).optional(),
    photos: Joi.array().items(Joi.string().uri()).optional()
  })
};

module.exports = {
  validate,
  schemas,
  validationSchemas
};
