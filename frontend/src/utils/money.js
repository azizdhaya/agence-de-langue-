/**
 * Amount formatting.
 *
 * The financial module (invoices, payments, receipts, tariffs, multi-currency
 * management) has been removed. Course prices still need to be rendered, so a
 * single formatting helper remains. The centre bills in Tunisian dinars: the
 * default code and its symbol are static.
 */

const DEFAULT_CODE = 'TND'

/** Symbol shown after the amount, per ISO code. */
const SYMBOLS = {
  TND: 'DT',
  EUR: '€',
  USD: '$'
}

/** The code used when a document does not carry one. */
export function getDefaultCode() {
  return DEFAULT_CODE
}

/**
 * Decimal places for a currency.
 * @param {string} code
 * @returns {number}
 */
function decimalsFor(code) {
  const ZERO_DECIMAL = ['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF']
  const THREE_DECIMAL = ['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']

  if (ZERO_DECIMAL.includes(code)) return 0
  if (THREE_DECIMAL.includes(code)) return 3
  return 2
}

/**
 * Total a list of millime amounts. Mirrors the backend helper.
 * @param {number[]} amounts
 * @returns {number}
 */
export function sumMillimes(amounts) {
  return (amounts || []).reduce((total, value) => total + (Number(value) || 0), 0)
}

/**
 * Split a whole-module discount across its submodule prices, proportionally to
 * each price, with the rounding remainder on the last line. Mirrors the backend
 * helper exactly so the previewed total matches what the server will record.
 * @param {number[]} priceMillimes
 * @param {number} percent 0..100
 * @returns {number[]} discount in millimes per line
 */
export function distributeDiscount(priceMillimes, percent) {
  const prices = (priceMillimes || []).map((price) => Math.max(0, Math.round(Number(price) || 0)))
  if (prices.length === 0) return []

  const rate = Math.min(100, Math.max(0, Number(percent) || 0)) / 100
  const discounts = prices.map((price) => Math.round(price * rate))
  const allocated = sumMillimes(discounts)
  const target = Math.round(sumMillimes(prices) * rate)

  discounts[discounts.length - 1] += target - allocated
  return discounts.map((discount, index) => Math.min(Math.max(0, discount), prices[index]))
}

/**
 * Render an amount.
 *
 * @param {number|string|null|undefined} amount
 * @param {string} [currency] ISO code; falls back to the default currency
 * @param {{ locale?: string, withSymbol?: boolean }} [options]
 * @returns {string} e.g. '1 234,500 DT'
 */
export function formatMoney(amount, currency, options = {}) {
  const code = currency || DEFAULT_CODE
  const symbol = SYMBOLS[code] || code
  const locale = options.locale || 'fr-FR'

  const value = Number(amount)
  if (value === null || value === undefined || Number.isNaN(value)) {
    return options.withSymbol === false ? '-' : `- ${symbol}`
  }

  const decimals = options.withSymbol === false ? 2 : decimalsFor(code)
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value)

  return options.withSymbol === false ? formatted : `${formatted} ${symbol}`
}

/**
 * Grouped amount without the currency, for totals next to a currency label.
 * @param {number|string|null|undefined} amount
 * @returns {string}
 */
export function formatNumber(amount) {
  const value = Number(amount)
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(value)
}

/**
 * Render an amount held in integer millimes (1 dinar = 1000 millimes), the
 * storage format of the financial module.
 * @param {number|string|null|undefined} millimes
 * @param {string} [currency] ISO code; falls back to the default currency
 * @param {{ locale?: string, withSymbol?: boolean }} [options]
 * @returns {string} e.g. '1 234,500 DT'
 */
export function formatMillimes(millimes, currency, options = {}) {
  const value = Number(millimes)
  if (millimes === null || millimes === undefined || Number.isNaN(value)) {
    return formatMoney(null, currency, options)
  }
  return formatMoney(value / 1000, currency, options)
}

/**
 * Badge variant for a status.
 * @param {string} status
 * @returns {'success'|'warning'|'danger'|'info'|'default'}
 */
export function statusVariant(status) {
  switch (status) {
    case 'completed':
    case 'active':
      return 'success'
    case 'scheduled':
      return 'info'
    case 'postponed':
      return 'warning'
    case 'cancelled':
    case 'inactive':
      return 'default'
    default:
      return 'info'
  }
}

/**
 * French label for a pedagogical status (sessions, courses, groups).
 * @param {string} status
 * @returns {string}
 */
export function pedagogyStatusLabel(status) {
  const labels = {
    active: 'Actif',
    inactive: 'Inactif',
    scheduled: 'Planifiée',
    completed: 'Terminée',
    cancelled: 'Annulée',
    postponed: 'Reportée',
    revoked: 'Révoqué',
    graduated: 'Diplômé',
    suspended: 'Suspendu',
    on_leave: 'En congé'
  }
  return labels[status] || status || '-'
}
