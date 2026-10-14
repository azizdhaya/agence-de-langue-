import { describe, it, expect } from 'vitest'
import { formatMillimes, formatMoney, distributeDiscount, sumMillimes } from '../utils/money'

describe('formatMillimes', () => {
  it('renders integer millimes as dinars with three decimals', () => {
    expect(formatMillimes(250000)).toBe('250,000 DT')
    expect(formatMillimes(120500)).toBe('120,500 DT')
  })

  it('renders small amounts', () => {
    expect(formatMillimes(1000)).toBe('1,000 DT')
    expect(formatMillimes(500)).toBe('0,500 DT')
  })

  it('falls back to the money placeholder for a missing amount', () => {
    expect(formatMillimes(null)).toBe(formatMoney(null))
    expect(formatMillimes(undefined)).toBe(formatMoney(null))
  })
})

describe('distributeDiscount', () => {
  it('splits a percent proportionally with the remainder on the last line', () => {
    // 10% of [120000, 180000] = [12000, 18000].
    expect(distributeDiscount([120000, 180000], 10)).toEqual([12000, 18000])
  })

  it('keeps the sum exact when the split does not divide evenly', () => {
    // Rounding each line would give 99; the last line absorbs the remainder.
    const discounts = distributeDiscount([333, 333, 334], 10)
    expect(discounts).toEqual([33, 33, 34])
    expect(sumMillimes(discounts)).toBe(100)
  })

  it('returns zeros for a zero percent and an empty list for no prices', () => {
    expect(distributeDiscount([120000, 180000], 0)).toEqual([0, 0])
    expect(distributeDiscount([], 10)).toEqual([])
  })
})
