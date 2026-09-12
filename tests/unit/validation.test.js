import { describe, it, expect } from 'vitest';
import { luhn, isEmail, parseExpiry, formatCardNumber, formatExpiry, last4, validateCheckout, validateCustomer, validateAddress, validatePayment } from '../../public/js/validation.js';

const NOW = new Date('2026-09-12T12:00:00Z');

const good = {
  customer: { firstName: 'Amara', lastName: 'Okafor', email: 'amara@example.com', phone: '+1 555 010 2233' },
  address: { line1: '12 Market Street', city: 'Houston', state: 'TX', postalCode: '77002', country: 'US' },
  payment: { method: 'card', cardNumber: '4242 4242 4242 4242', cardName: 'Amara Okafor', expiry: '12/30', cvc: '123' },
  items: [{ id: 'p01', qty: 1 }],
};

describe('checkout validation (client mirror of server rules)', () => {
  it('luhn accepts the demo card and rejects a one-digit change', () => {
    expect(luhn('4242424242424242')).toBe(true);
    expect(luhn('4242 4242 4242 4242')).toBe(true);
    expect(luhn('4242424242424241')).toBe(false);
    expect(luhn('')).toBe(false);
  });
  it('isEmail', () => {
    expect(isEmail('a@b.co')).toBe(true);
    expect(isEmail('not-an-email')).toBe(false);
  });
  it('parseExpiry handles format, range and expiry', () => {
    expect(parseExpiry('12/30', NOW).valid).toBe(true);
    expect(parseExpiry('09/26', NOW).valid).toBe(true); // current month still valid
    expect(parseExpiry('08/26', NOW)).toMatchObject({ valid: false, expired: true });
    expect(parseExpiry('13/30', NOW).valid).toBe(false);
    expect(parseExpiry('1230', NOW).valid).toBe(false);
  });
  it('formatters', () => {
    expect(formatCardNumber('4242424242424242')).toBe('4242 4242 4242 4242');
    expect(formatExpiry('1230')).toBe('12/30');
    expect(last4('4242 4242 4242 4242')).toBe('4242');
  });
  it('a complete valid form passes', () => {
    expect(validateCheckout(good, { now: NOW })).toEqual({ valid: true, fields: {} });
  });
  it('reports field paths for bad input', () => {
    const { valid, fields } = validateCheckout({
      ...good,
      customer: { ...good.customer, email: 'nope', firstName: 'A' },
      address: { ...good.address, line1: '' },
      payment: { ...good.payment, cardNumber: '4242424242424241', expiry: '01/20' },
    }, { now: NOW });
    expect(valid).toBe(false);
    expect(Object.keys(fields)).toEqual(expect.arrayContaining(['customer.email', 'customer.firstName', 'address.line1', 'payment.cardNumber', 'payment.expiry']));
  });
  it('mobile money requires provider and number; cash on delivery needs nothing extra', () => {
    expect(Object.keys(validatePayment({ method: 'mobile-money' }))).toEqual(expect.arrayContaining(['payment.provider', 'payment.mobileNumber']));
    expect(validatePayment({ method: 'mobile-money', provider: 'M-Pesa', mobileNumber: '0244123456' })).toEqual({});
    expect(validatePayment({ method: 'cash-on-delivery' })).toEqual({});
    expect(Object.keys(validatePayment({ method: 'bitcoin' }))).toContain('payment.method');
  });
  it('empty cart is flagged', () => {
    expect(validateCheckout({ ...good, items: [] }, { now: NOW }).fields.items).toBeTruthy();
  });
  it('customer and address validators are independent', () => {
    expect(validateCustomer(good.customer)).toEqual({});
    expect(validateAddress(good.address)).toEqual({});
    expect(Object.keys(validateAddress({}))).toEqual(expect.arrayContaining(['address.line1', 'address.city', 'address.postalCode', 'address.country']));
  });
});
