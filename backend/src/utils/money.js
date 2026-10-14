/**
 * Money helpers for the financial module.
 *
 * Amounts are stored as **integer millimes** (1 dinar = 1000 millimes) so
 * arithmetic never drifts on floating point. The API accepts decimal amounts
 * (what an admin types) and converts at the edge with `toMillimes`; responses
 * expose the integer millimes, which the frontend formats with money.js.
 */

const MILLIMES_PER_UNIT = 1000;

/**
 * Convert a decimal amount (e.g. 120.5 TND) to integer millimes (120500).
 * An absent amount is 0 so optional fields stay optional.
 * @param {number|string|null|undefined} amount
 * @returns {number}
 */
function toMillimes(amount) {
  if (amount === null || amount === undefined || amount === '') return 0;
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    throw new RangeError(`Invalid amount: ${amount}`);
  }
  return Math.round(value * MILLIMES_PER_UNIT);
}

/**
 * Convert integer millimes back to a decimal amount.
 * @param {number|null|undefined} millimes
 * @returns {number}
 */
function fromMillimes(millimes) {
  const value = Number(millimes);
  if (!Number.isFinite(value)) return 0;
  return value / MILLIMES_PER_UNIT;
}

/**
 * Total a list of millime amounts.
 * @param {number[]} amounts
 * @returns {number}
 */
function sumMillimes(amounts) {
  return (amounts || []).reduce((total, value) => total + (Number(value) || 0), 0);
}

/**
 * Split a whole-module discount across its submodule charges, proportionally to
 * each price, with the rounding remainder placed on the last line so the sum of
 * the line discounts equals the exact expected total. The same pattern as the
 * former CEFR pricing keeps totals honest.
 *
 * @param {number[]} priceMillimes price snapshot of each submodule
 * @param {number} percent discount applied to the module, 0..100
 * @returns {number[]} discount in millimes for each line, same order
 */
function distributeDiscount(priceMillimes, percent) {
  const prices = (priceMillimes || []).map((price) =>
    Math.max(0, Math.round(Number(price) || 0))
  );
  if (prices.length === 0) return [];

  const rate = Math.min(100, Math.max(0, Number(percent) || 0)) / 100;
  const discounts = prices.map((price) => Math.round(price * rate));
  const allocated = sumMillimes(discounts);
  const target = Math.round(sumMillimes(prices) * rate);

  // Put the rounding remainder on the last line, then never discount a line
  // below zero (or above its own price).
  discounts[discounts.length - 1] += target - allocated;
  return discounts.map((discount, index) => Math.min(Math.max(0, discount), prices[index]));
}

module.exports = {
  MILLIMES_PER_UNIT,
  toMillimes,
  fromMillimes,
  sumMillimes,
  distributeDiscount
};
