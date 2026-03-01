import * as fc from 'fast-check';

/**
 * Generator for valid email addresses
 */
export const emailArbitrary = fc.emailAddress();

/**
 * Generator for phone numbers (various formats)
 */
export const phoneNumberArbitrary = fc.oneof(
  fc.stringMatching(/^\d{10}$/), // 10 digits
  fc.stringMatching(/^\+\d{1,3}\d{10}$/), // With country code
  fc.stringMatching(/^\d{3}-\d{3}-\d{4}$/), // With dashes
  fc.stringMatching(/^\(\d{3}\) \d{3}-\d{4}$/), // With parentheses
);

/**
 * Generator for invalid email addresses
 */
export const invalidEmailArbitrary = fc.oneof(
  fc.constant('not-an-email'),
  fc.constant('missing@domain'),
  fc.constant('@nodomain.com'),
  fc.constant('spaces in@email.com'),
);

/**
 * Generator for optional email (can be undefined or valid email)
 */
export const optionalEmailArbitrary = fc.option(emailArbitrary, { nil: undefined });

/**
 * Generator for optional phone number
 */
export const optionalPhoneArbitrary = fc.option(phoneNumberArbitrary, { nil: undefined });

/**
 * Generator for timestamps
 */
export const timestampArbitrary = fc.date({
  min: new Date('2020-01-01'),
  max: new Date('2025-12-31'),
});

/**
 * Generator for link precedence
 */
export const linkPrecedenceArbitrary = fc.constantFrom('primary', 'secondary');
