/**
 * Build all common phone number variants for MongoDB $or queries.
 * Handles: +917973944144, 917973944144, 7973944144, 07973944144
 */
function phoneVariants(phone) {
  if (!phone) return [];
  const raw = String(phone).trim();
  const digits = raw.replace(/[^\d]/g, '');
  const variants = new Set([raw, digits]);

  if (digits.length === 10) {
    variants.add('+91' + digits);
    variants.add('91' + digits);
    variants.add('0' + digits);
  } else if (digits.length === 12 && digits.startsWith('91')) {
    const last10 = digits.slice(2);
    variants.add('+' + digits);
    variants.add(last10);
    variants.add('0' + last10);
  } else if (digits.length === 13 && digits.startsWith('91')) {
    // e.g. +917973944144 stripped = 917973944144 (12 digits covered above)
    // extra safety
    variants.add('+' + digits.slice(0, 12));
  }

  return Array.from(variants);
}

/**
 * Returns an $or array for Patient lookups by phone
 */
function patientPhoneOr(phone) {
  return phoneVariants(phone).flatMap(v => [{ phoneNumber: v }, { phone: v }]);
}

module.exports = { phoneVariants, patientPhoneOr };
