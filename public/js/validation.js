/**
 * Checkout validation. pure functions, no DOM, no imports.
 * Mirrors the server rules from SPEC.md so the shopper sees the same
 * messages the API would return. Unit-testable in Node.
 *
 *   validateCheckout(form) -> { valid: boolean, fields: { 'customer.firstName': 'message', ... } }
 *   validateCustomer(customer) / validateAddress(address) / validatePayment(payment) -> fields map
 *   luhn('4242 4242 4242 4242') -> true
 *   parseExpiry('12/29') -> { valid, month, year, expired, message }
 *   isEmail('a@b.co') -> true
 *   formatCardNumber('4242424242424242') -> '4242 4242 4242 4242'
 *   formatExpiry('1229') -> '12/29'
 */

export const PAYMENT_METHODS = ['card', 'mobile-money', 'cash-on-delivery'];

export const MOBILE_MONEY_PROVIDERS = [
  { id: 'mpesa', label: 'M-Pesa' },
  { id: 'mtn-momo', label: 'MTN MoMo' },
  { id: 'airtel-money', label: 'Airtel Money' },
  { id: 'orange-money', label: 'Orange Money' },
];

const str = (v) => (v == null ? '' : String(v)).trim();
export const digitsOnly = (v) => str(v).replace(/\D/g, '');

/** RFC-ish: one @, something on both sides, a dot in the domain, no spaces. */
export function isEmail(value) {
  const v = str(value);
  if (v.length < 5 || v.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

/** Luhn checksum. Accepts spaces/dashes; requires 13–19 digits. */
export function luhn(number) {
  const digits = digitsOnly(number);
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = digits.charCodeAt(i) - 48;
    if (double) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/**
 * Parse an `MM/YY` expiry. A card is valid through the last day of its month.
 * @param {string} value
 * @param {Date} [now] injectable clock for tests
 */
export function parseExpiry(value, now = new Date()) {
  const v = str(value);
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(v);
  if (!m) return { valid: false, month: null, year: null, expired: false, message: 'Use the format MM/YY' };
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return { valid: false, month, year, expired: false, message: 'Month must be between 01 and 12' };
  const nowIndex = now.getFullYear() * 12 + now.getMonth(); // 0-based month
  const expIndex = year * 12 + (month - 1);
  if (expIndex < nowIndex) return { valid: false, month, year, expired: true, message: 'This card has expired' };
  return { valid: true, month, year, expired: false, message: '' };
}

/** '4242424242424242' -> '4242 4242 4242 4242' (max 19 digits). */
export function formatCardNumber(value) {
  const digits = digitsOnly(value).slice(0, 19);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** '1229' | '12/29' | '12 / 29' -> '12/29'. Leading-zero pads single-digit months typed as e.g. '3/'. */
export function formatExpiry(value) {
  let digits = digitsOnly(value).slice(0, 4);
  if (digits.length === 1 && Number(digits) > 1) digits = `0${digits}`;
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

/** Mask a card number to its last four digits for display: '•••• 4242'. */
export function last4(value) {
  return digitsOnly(value).slice(-4);
}

/* ------------------------------------------------------------------ */

export function validateCustomer(customer = {}) {
  const fields = {};
  if (str(customer.firstName).length < 2) fields['customer.firstName'] = 'Enter your first name (at least 2 characters)';
  if (str(customer.lastName).length < 2) fields['customer.lastName'] = 'Enter your last name (at least 2 characters)';
  if (!isEmail(customer.email)) fields['customer.email'] = 'Enter a valid email address, like ama@example.com';
  if (digitsOnly(customer.phone).length < 7) fields['customer.phone'] = 'Enter a phone number with at least 7 digits';
  return fields;
}

export function validateAddress(address = {}) {
  const fields = {};
  if (!str(address.line1)) fields['address.line1'] = 'Enter your street address';
  if (!str(address.city)) fields['address.city'] = 'Enter your city';
  if (!str(address.postalCode)) fields['address.postalCode'] = 'Enter your postal code';
  if (!str(address.country)) fields['address.country'] = 'Choose your country';
  return fields;
}

export function validatePayment(payment = {}, now = new Date()) {
  const fields = {};
  const method = str(payment.method);
  if (!PAYMENT_METHODS.includes(method)) {
    fields['payment.method'] = 'Choose how you would like to pay';
    return fields;
  }
  if (method === 'card') {
    const number = digitsOnly(payment.cardNumber);
    if (!number) fields['payment.cardNumber'] = 'Enter your card number';
    else if (number.length < 13 || number.length > 19) fields['payment.cardNumber'] = 'Card number should be 13 to 19 digits';
    else if (!luhn(number)) fields['payment.cardNumber'] = 'That card number does not look right. Check the digits';
    if (str(payment.cardName).length < 2) fields['payment.cardName'] = 'Enter the name printed on the card';
    const exp = parseExpiry(payment.expiry, now);
    if (!exp.valid) fields['payment.expiry'] = exp.message;
    const cvc = digitsOnly(payment.cvc);
    if (cvc.length < 3 || cvc.length > 4) fields['payment.cvc'] = 'Security code is the 3 or 4 digits on your card';
  } else if (method === 'mobile-money') {
    if (!str(payment.provider)) fields['payment.provider'] = 'Choose your mobile money provider';
    if (digitsOnly(payment.mobileNumber).length < 7) fields['payment.mobileNumber'] = 'Enter the mobile number linked to your wallet';
  }
  return fields;
}

/**
 * Validate the whole checkout form.
 * @param {{customer?:object, address?:object, payment?:object, items?:Array}} form
 * @param {{now?: Date}} [opts]
 */
export function validateCheckout(form = {}, opts = {}) {
  const now = opts.now || new Date();
  const fields = {
    ...(Array.isArray(form.items) && form.items.length === 0 ? { items: 'Your cart is empty' } : {}),
    ...validateCustomer(form.customer || {}),
    ...validateAddress(form.address || {}),
    ...validatePayment(form.payment || {}, now),
  };
  return { valid: Object.keys(fields).length === 0, fields };
}

/** Validate a single field path against the current form (used for on-blur validation). */
export function validateField(path, form = {}, opts = {}) {
  const { fields } = validateCheckout(form, opts);
  return fields[path] || '';
}

/** Build the POST /api/orders payment object. never sends more than the server needs. */
export function paymentPayload(payment = {}) {
  const method = str(payment.method);
  if (method === 'card') {
    return {
      method,
      cardNumber: digitsOnly(payment.cardNumber),
      cardName: str(payment.cardName),
      expiry: formatExpiry(payment.expiry),
      cvc: digitsOnly(payment.cvc),
    };
  }
  if (method === 'mobile-money') {
    return { method, provider: str(payment.provider), mobileNumber: str(payment.mobileNumber) };
  }
  return { method };
}
