export const SOURCE = 'flatgigs'
export const COMPANY = 'Flatgigs'
export const CAREERS_URL = 'https://flatgigs.com/career/'
export const EMBED_URL = 'https://www.workable.com/assets/embed.js'
export const CLIENT_URL = 'https://dcvxs6ggqztsa.cloudfront.net/widget/production/embed.js'
export const ACCOUNT = 542477
export const TITLES_URL = 'https://apply.workable.com/api/v1/widget/accounts/542477?origin=embed&callback=whrcallback'
export const DETAILS_URL = TITLES_URL + '&details=true'
export const ALLOWED_URLS = new Set([CAREERS_URL, EMBED_URL, CLIENT_URL, TITLES_URL, DETAILS_URL])
export const gap = (reason = 'native-widget-observations-do-not-establish-company-scope', pagesFetched = 0) => ({ status: 'coverage-gap', surface: CAREERS_URL, firstParty: true, listingComplete: false, pagesFetched, reportedTotal: null, indiaFacetCount: null, verifiedAt: null, reason })
export const failure = (message, extra = {}) => Object.assign(new Error('Flatgigs native: ' + message), { abortRetries: true, code: 'native_contract_unqualified', inventoryEvidence: gap(message), ...extra })
export const need = (condition, message) => { if (!condition) throw failure(message) }
export const canonical = value => JSON.stringify(value, (_key, item) => item && !Array.isArray(item) && typeof item === 'object' ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item)
export const iso = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return null
  const date = new Date(value)
  return Number.isFinite(+date) && date.toISOString() === value ? value : null
}
