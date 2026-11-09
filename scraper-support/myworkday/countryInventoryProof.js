import { createHash } from 'node:crypto'
import { decodeNativeEntities } from '../utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../utils/visibleNativeHtml.js'
import { currentAureconCorporateReceipt } from './nativeAureconWorksites.js'

export const WORKDAY_COUNTRY_INVENTORY_PROOF = Symbol.for('jobverify.workday.country-inventory-proof')
export const hashWorkdayProof = body => createHash('sha256').update(body).digest('hex')

const boardKey = value => {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    const parts = url.pathname.split('/').filter(Boolean).filter(part => !/^[a-z]{2}-[a-z]{2}$/i.test(part))
    if (/^[^.]+\.wd\d+\.myworkdayjobs\.com$/i.test(url.hostname) && parts.length === 1) return url.origin + '/' + parts[0]
    if (/\.myworkdaysite\.com$/i.test(url.hostname) && parts.length === 3 && parts[0] === 'recruiting') return url.origin + '/' + parts.join('/')
  } catch { /* Invalid URLs cannot bind a board. */ }
  return null
}

// The shared native tree reader excludes raw-text, template and fallback
// markup. Additional activity checks apply to anchors and their ancestors.
export const currentWorkdayBoardReceipt = ({ officialCareersUrl, boardUrl, response, html, renderProof = null }) => {
  if (renderProof !== null) return currentAureconCorporateReceipt({ officialCareersUrl, boardUrl, response, html, renderProof })
  const requested = new URL(officialCareersUrl), actual = new URL(response.url)
  const contentType = response.headers?.get?.('content-type') || ''
  if (!response.ok || requested.protocol !== 'https:' || actual.protocol !== 'https:'
    || requested.username || requested.password || actual.username || actual.password
    || actual.origin !== requested.origin || actual.pathname.replace(/\/$/, '') !== requested.pathname.replace(/\/$/, '')
    || actual.search !== requested.search || actual.hash || !/^(?:text\/html|application\/xhtml\+xml)(?:\s*;|$)/i.test(contentType)) {
    throw new Error('Current corporate careers response has an invalid status, URL, or HTML content type')
  }
  const expected = boardKey(boardUrl)
  if (!expected) throw new Error('Expected Workday board identity is invalid')
  const document = readVisibleNativeDocument(String(html), { strict: true })
  const anchorUrls = []
  const visibleText = node => {
    if (typeof node === 'string') return decodeNativeEntities(node)
    const { tag, attrs } = node
    const blocked = node.inert || ['script', 'style', 'head', 'svg'].includes(tag)
      || ['hidden', 'inert', 'disabled'].some(key => Object.hasOwn(attrs, key))
      || ['aria-hidden', 'aria-disabled'].some(key => Object.hasOwn(attrs, key) && attrs[key].toLowerCase() !== 'false')
      || /(?:^|\s)(?:hidden|invisible|sr-only)(?:\s|$)/i.test(attrs.class || '')
    if (blocked) return ''
    const text = node.children.map(visibleText).join(' ')
    if (tag === 'a' && attrs.href && text.trim()) {
      try {
        const href = new URL(attrs.href, actual)
        if (boardKey(href.href) === expected) anchorUrls.push(href.href)
      } catch { /* An invalid anchor is not a handoff. */ }
    }
    return text
  }
  for (const root of document.nodes(node => node.tag === 'root')) visibleText(root)
  if (!anchorUrls.length) throw new Error('Current corporate careers HTML has no active anchor to the exact Workday board')
  return { requestedUrl: requested.href, responseUrl: actual.href,
    status: response.status, contentType, board: expected, anchorUrl: anchorUrls[0],
    sha256: hashWorkdayProof(html), fetchedAt: new Date().toISOString() }
}

const regionNames = ['long', 'short'].map(style => new Intl.DisplayNames(['en'], { type: 'region', style }))
const countries = new Map()
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b), names = regionNames.map(formatter => formatter.of(code)).filter(name => name && name !== code)
  if (names.length && !['ZZ', 'EU', 'UN', 'XA', 'XB', 'QO'].includes(code)) {
    // DisplayNames accepts aliases such as UK. Compare their canonical region
    // codes so the alias cannot overwrite United Kingdom with a spurious UK/GB
    // disagreement in an otherwise consistent native country object.
    const canonicalCode = new Intl.Locale('und-' + code).region
    countries.set(code.toLowerCase(), canonicalCode)
    for (const name of names) countries.set(name.toLowerCase(), canonicalCode)
  }
}
for (const [name, code] of Object.entries({ IND: 'IN', USA: 'US', 'United States of America': 'US', 'Russian Federation': 'RU', 'Korea, Republic of': 'KR', UK: 'GB', UAE: 'AE' })) countries.set(name.toLowerCase(), code)
// A comma-delimited state abbreviation is not an explicit country token.
// Native country fields can still prove the office's country independently.
const ambiguousStateCodes = new Set(('AN AP AR AS BR CG CH DD DL DN GA GJ HP HR JH JK KA KL LA LD MH ML MN MP MZ NL OD OR PB PY RJ SK TN TR TS UK UP UT WB '
  + 'AL AK AZ CA CO CT DE DC FL HI ID IL IN IA KS KY ME MD MA MI MS MO MT NE NV NH NJ NM NY NC ND OH OK PA RI SC SD TX VT VA WA WV WI WY FM GU PR PW VI').split(' '))

// Only an explicit country token proves scope here. City names and punctuation
// alone never prove a foreign country, nor do broad regional/remote labels.
const explicitCountryScope = (value, additionalWorksite = false) => {
  const label = String(value || '').trim()
  if (!label || /[;/|+&]|\b(?:or|and|global|worldwide|anywhere|APAC|EMEA|LATAM)\b/i.test(label)) return null
  const prefix = label.match(/^([A-Z]{2,3})\s*[.\-,]\s*/)?.[1]
  const suffix = label.match(/,\s*([^,]+)$/)?.[1]
  const prefixCountry = prefix && countries.get(prefix.toLowerCase())
  const suffixCountry = suffix && countries.get(suffix.toLowerCase())
  // The additional-location strings in full CXS records can explicitly name
  // a country before a city. Listing selection retains its existing policy.
  const writtenPrefix=additionalWorksite&&label.match(/^(.+?)\s+[-\u2013\u2014]\s+/u)?.[1]
  const writtenCountry=writtenPrefix&&writtenPrefix.length>3
    ?countries.get(writtenPrefix.toLowerCase())||(writtenPrefix.toLowerCase()==='turkey'?'TR':null):null
  const unicodePrefix=additionalWorksite&&label.match(/^([A-Z]{2,3})\s*[\u2013\u2014]\s*/u)?.[1]
  const unicodeCountry=unicodePrefix&&!ambiguousStateCodes.has(unicodePrefix)?countries.get(unicodePrefix.toLowerCase()):null
  // This extension only proves explicit foreign countries. It cannot promote
  // an ambiguous code or a city-only native location into India.
  const additionalForeign=[writtenCountry,unicodeCountry].filter(code=>code&&code!=='IN')
  // Conflicting tokens still require native detail evidence, even when one
  // token could also name a state. Removing ambiguity must not invent certainty.
  if (prefixCountry && suffixCountry && prefixCountry !== suffixCountry) return null
  const explicitCountries = [countries.get(label.toLowerCase()),
    countries.get(label.replace(/\s+(?:[-–—]\s*)?remote$/i, '').toLowerCase()),
    prefixCountry, suffix && !ambiguousStateCodes.has(suffix.toUpperCase()) && suffixCountry,...additionalForeign].filter(Boolean)
  if (new Set(explicitCountries).size !== 1) return null
  const country = explicitCountries[0]
  if (/\bindia\b/i.test(label) && country !== 'IN') return null
  return country ? country === 'IN' ? 'india' : 'foreign' : null
}
export const explicitWorkdayCountryScope=value=>explicitCountryScope(value)
export const explicitWorkdayAdditionalCountryScope=value=>explicitCountryScope(value,true)

export const hasRecognizedWorkdayCountry = country => {
  const values = (typeof country === 'string' ? [country] : [country?.descriptor, country?.alpha2Code])
    .filter(value => typeof value === 'string' && value.trim())
  const codes = values.map(value => countries.get(value.trim().toLowerCase()))
  if (!codes.length || codes.some(code => !code)) return false
  // The CXS resolver recognizes the native India country ID. It cannot override
  // a different explicit country descriptor or code in the same object.
  const nativeId = typeof country?.id === 'string' ? country.id.trim().toLowerCase() : null
  const idCountry = nativeId === 'c4f78be1a8f14da0ab49ce1162348a5e' ? 'IN' : countries.get(nativeId)
  if (idCountry) codes.push(idCountry)
  return new Set(codes).size === 1
}

export const workdayInventoryIdentity = job => JSON.stringify([
  job.externalPath, job.title, job.bulletFields || [], job.locationsText || null,
])
