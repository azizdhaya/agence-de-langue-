const { toMillimes, fromMillimes, sumMillimes, distributeDiscount } = require('../../src/utils/money');

describe('money helpers', () => {
  test('toMillimes converts a decimal amount to integer millimes', () => {
    expect(toMillimes(120.5)).toBe(120500);
    expect(toMillimes(0)).toBe(0);
    expect(toMillimes('99.999')).toBe(100000 - 1);
  });

  test('toMillimes treats an absent amount as 0', () => {
    expect(toMillimes(null)).toBe(0);
    expect(toMillimes(undefined)).toBe(0);
    expect(toMillimes('')).toBe(0);
  });

  test('toMillimes refuses a non-numeric amount', () => {
    expect(() => toMillimes('abc')).toThrow(RangeError);
  });

  test('fromMillimes converts back to a decimal amount', () => {
    expect(fromMillimes(120500)).toBe(120.5);
    expect(fromMillimes('250')).toBe(0.25);
    expect(fromMillimes(null)).toBe(0);
  });

  test('sumMillimes totals a list, ignoring junk', () => {
    expect(sumMillimes([100, 200, 300])).toBe(600);
    expect(sumMillimes([])).toBe(0);
    expect(sumMillimes(undefined)).toBe(0);
  });

  test('round-trips decimal to millimes without drift', () => {
    expect(fromMillimes(toMillimes(33.33))).toBe(33.33);
  });
});

describe('distributeDiscount', () => {
  test('splits a discount proportionally to each price', () => {
    expect(distributeDiscount([120000, 130000], 10)).toEqual([12000, 13000]);
  });

  test('puts the rounding remainder on the last line so the sum is exact', () => {
    // 10% of 1000 = 100; each line rounds to 33, so the last takes the extra 1.
    const discounts = distributeDiscount([333, 333, 334], 10);
    expect(discounts).toEqual([33, 33, 34]);
    expect(sumMillimes(discounts)).toBe(100);
  });

  test('a 0% discount leaves every line untouched', () => {
    expect(distributeDiscount([100, 200], 0)).toEqual([0, 0]);
  });

  test('a 100% discount equals each price exactly', () => {
    expect(distributeDiscount([120, 130], 100)).toEqual([120, 130]);
  });

  test('an empty list yields an empty result', () => {
    expect(distributeDiscount([], 10)).toEqual([]);
  });

  test('clamps the percentage to 0..100', () => {
    expect(distributeDiscount([1000], 250)).toEqual([1000]);
    expect(distributeDiscount([1000], -50)).toEqual([0]);
  });
});
