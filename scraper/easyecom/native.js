import { createHash } from 'node:crypto'
import { setTimeout as pause } from 'node:timers/promises'
import { readEasyEcomVisibleDocument } from './visibleNative.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

export const NATIVE_CAREER_URL = 'https://www.easyecom.io/careers'
const HIRING_QUESTION = 'Where does EasyEcom hire?'
const HIRING_ANSWER = 'We hire across our hubs: Bengaluru (our headquarters) and Delhi in India, Atlanta in the United States, and Dubai in the UAE, plus select remote roles. Each role listing shows its location.'
const HUB_COUNTRIES = { Bengaluru: 'India', Delhi: 'India', Atlanta: 'United States', Dubai: 'United Arab Emirates' }
const countryName = value => ({ in: 'India', india: 'India', us: 'United States', usa: 'United States',
  'united states': 'United States', ae: 'United Arab Emirates', uae: 'United Arab Emirates',
  'united arab emirates': 'United Arab Emirates' })[norm(value).toLowerCase()] || null
const hash = value => createHash('sha256').update(value).digest('hex')
const norm = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const descendants = (node, predicate) => node.inert ? [] : [
  ...(predicate(node) ? [node] : []),
  ...node.children.filter(child => typeof child !== 'string').flatMap(child => descendants(child, predicate)),
]
const requireNative = (condition, message) => { if (!condition) throw new Error(`EasyEcom native: ${message}`) }
const absolute = value => { try { return new URL(value, NATIVE_CAREER_URL).href } catch { return null } }
const sameOrigin = value => { try { return new URL(value).origin === new URL(NATIVE_CAREER_URL).origin } catch { return false } }
const withCancellation = async (operation, signal) => {
  if (!signal) return operation
  if (signal.aborted) {
    Promise.resolve(operation).catch(() => {})
    signal.throwIfAborted()
  }
  let onAbort
  const cancellation = new Promise((_, reject) => {
    onAbort = () => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
  })
  try { return await Promise.race([operation, cancellation]) }
  finally { signal.removeEventListener('abort', onAbort) }
}

// Decode only the Next flight JSON string argument. Never execute page scripts.
const advertisedClientScripts = document => {
  const scripts = document.nodes(node => node.tag === 'script')
  const urls = scripts.filter(node => /\/app\/careers\/page-[^/]+\.js(?:\?|$)/.test(node.attrs.src || ''))
    .map(node => absolute(node.attrs.src))
  for (const script of scripts.filter(node => !node.attrs.src)) {
    const match = (script.raw || '').match(/^self\.__next_f\.push\((\[[\s\S]*\])\)\s*;?$/)
    if (!match) continue
    let payload
    try { payload = JSON.parse(match[1]) } catch { continue }
    if (!Array.isArray(payload) || typeof payload[1] !== 'string') continue
    for (const srcs of payload[1].matchAll(/"srcs":(\[(?:[^\]"\\]|"(?:[^"\\]|\\.)*")*\])/g)) {
      let values
      try { values = JSON.parse(srcs[1]) } catch { continue }
      if (Array.isArray(values)) urls.push(...values.filter(value => typeof value === 'string').map(absolute))
    }
  }
  return [...new Set(urls)].filter(Boolean)
}

export const extractNativeInventory = html => {
  const document = readEasyEcomVisibleDocument(String(html))
  const withClass = name => node => document.hasClass(node, name)
  const onlyText = (node, name) => {
    const matches = descendants(node, withClass(name))
    return matches.length === 1 ? norm(document.text(matches[0])) || null : null
  }
  const canonicals = document.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical')
  requireNative(canonicals.length === 1 && canonicals[0].attrs.href === NATIVE_CAREER_URL, 'unverified career canonical')
  const organizations = document.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json').flatMap(node => {
    try { const data = JSON.parse(node.raw); return data['@graph'] || [data] } catch { return [] }
  }).filter(node => node['@type'] === 'Organization')
  requireNative(organizations.length === 1 && organizations[0].name === 'EasyEcom'
    && organizations[0]['@id'] === 'https://www.easyecom.io/#organization'
    && organizations[0].url === 'https://www.easyecom.io', 'unverified employer')
  const lists = document.nodes(node => node.attrs.id === 'roleList')
  requireNative(lists.length === 1, 'missing or ambiguous current role list')
  const hubs = document.nodes(withClass('faq')).filter(node => onlyText(node, 'faq-q') === HIRING_QUESTION)
  const hiringAnswer = hubs.length === 1 ? onlyText(hubs[0], 'faq-a') : null
  const hubMappingVerified = hiringAnswer === HIRING_ANSWER
  const applications = document.nodes(node => node.attrs.id === 'apply')
  const sharedApplications = applications.length === 1 ? descendants(applications[0], node => node.tag === 'a'
    && /^mailto:careers@easyecom\.io(?:\?|$)/i.test(node.attrs.href || '')) : []
  const sharedApplyUrl = sharedApplications.length === 1 ? sharedApplications[0].attrs.href : null
  const cards = descendants(lists[0], withClass('role')).filter(node => !document.hasClass(node, 'hide'))
  const candidates = cards.map(card => {
    const title = onlyText(card, 'rt')
    const location = onlyText(card, 'loc')
    const department = onlyText(card, 'dept')
    const type = onlyText(card, 'type')
    const buttons = descendants(card, node => node.tag === 'a' && document.hasClass(node, 'applybtn'))
    const roleApplicationTarget = buttons.length === 1 ? absolute(buttons[0].attrs.href) : null
    const remoteStatus = /\bhybrid\b/i.test(`${location || ''} ${type || ''}`) ? 'Hybrid'
      : /\bremote\b/i.test(`${location || ''} ${type || ''}`) ? 'Remote' : null
    const mappedCountry = hubMappingVerified && !remoteStatus ? HUB_COUNTRIES[location] || null : null
    const typedCountries = [card.attrs['data-country'], ...descendants(card, withClass('country')).map(document.text)].filter(Boolean)
    const countryConflict = typedCountries.some(value => !countryName(value) || countryName(value) !== mappedCountry)
    const country = countryConflict ? null : mappedCountry
    const employmentType = /^full[ -]?time$/i.test(type || '') ? 'Full-time'
      : /^part[ -]?time$/i.test(type || '') ? 'Part-time' : /intern/i.test(type || '') ? 'Internship' : null
    const sharedOpenApplication = roleApplicationTarget === `${NATIVE_CAREER_URL}#apply` && Boolean(sharedApplyUrl)
    return {
      title, company: 'EasyEcom', department, location, city: country ? location : null, country,
      countryEvidence: country ? { kind: 'explicit-native-hiring-hub-mapping', question: HIRING_QUESTION,
        answer: hiringAnswer, exactRoleLocation: location, sourceUrl: NATIVE_CAREER_URL } : null,
      nativeIdentity: { jobId: null, title, department, location, employmentType: type },
      jobId: null, requisitionId: null, sourceUrl: NATIVE_CAREER_URL,
      roleApplicationTarget, applyUrl: sharedOpenApplication ? sharedApplyUrl : null,
      applicationMethod: sharedOpenApplication ? 'shared-open-application-email' : null,
      applicationScope: sharedOpenApplication ? 'general-interest' : null,
      employmentType, nativeEmploymentType: type, remoteStatus,
      nativeBrief: null, jobDescription: null, sourceDescription: null,
      minimumQualification: null, preferredQualification: null, requiredSkills: [],
      experienceRequired: null, postingDate: null, closingDate: null,
      healthGaps: [ ...(!title ? ['missing-title'] : []), ...(!country ? ['unknown-role-country'] : []),
        ...(countryConflict ? ['conflicting-native-role-country'] : []),
        'missing-native-job-identity', 'missing-full-job-description', 'missing-role-application-binding' ],
    }
  })
  const identities = candidates.map(candidate => JSON.stringify(candidate.nativeIdentity))
  const duplicateCards = identities.length - new Set(identities).size
  const clientScripts = advertisedClientScripts(document)
  const hiringLinks = document.nodes(node => node.tag === 'a' && /careers?|jobs?|openings?|hiring|recruit|apply/i.test(`${node.attrs.href || ''} ${document.text(node)}`))
    .map(node => ({ text: norm(document.text(node)), url: absolute(node.attrs.href) }))
  const frames = document.nodes(node => node.activeFrame).map(node => node.attrs.src || null)
  return { surface: NATIVE_CAREER_URL, company: 'EasyEcom', candidates, duplicateCards,
    hubMappingVerified, hiringQuestion: HIRING_QUESTION, hiringAnswer, sharedApplyUrl,
    clientScripts, hiringLinks, frames,
    counts: { native: candidates.length, confirmedIndia: candidates.filter(row => row.country === 'India').length,
      confirmedForeign: candidates.filter(row => row.country && row.country !== 'India').length,
      countryUnknown: candidates.filter(row => !row.country).length, fullHealthy: 0, eligible: 0 } }
}

const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, { signal })
  return { url: response.url, status: response.status, text: await response.text() }
}

export const runNativeInventory = async (options = {}) => {
  options.signal?.throwIfAborted()
  const fetchPage = options.fetchPage || (options.fetchText ? async (url, requestOptions) => ({ url, status: 200, text: await options.fetchText(url, requestOptions) }) : defaultFetchPage)
  const verifiedAt = new Date(options.now || Date.now()).toISOString()
  const requests = [], clocks = new Map()
  let opening, closing, closingSnapshotMatched = false, reason = 'native-inventory-not-verified'
  const get = async url => {
    options.signal?.throwIfAborted()
    requireNative(sameOrigin(url), 'unverified cross-origin client script')
    const host = new URL(url).host
    if (!options.fetchPage && !options.fetchText) {
      const delay = Math.max(0, 1100 - (Date.now() - (clocks.get(host) || 0)))
      if (delay) await pause(delay, undefined, { signal: options.signal })
    }
    options.signal?.throwIfAborted()
    clocks.set(host, Date.now())
    const response = await withCancellation(fetchPage(url, { signal: options.signal }), options.signal)
    options.signal?.throwIfAborted()
    const status = Number(response?.status ?? 200)
    requests.push({ url, status })
    requireNative(status >= 200 && status < 300, `HTTP ${status}`)
    requireNative(sameOrigin(response?.url || url), 'cross-origin redirect')
    const text = typeof response === 'string' ? response : typeof response?.text === 'function'
      ? await withCancellation(response.text(), options.signal) : response?.text
    options.signal?.throwIfAborted()
    requireNative(typeof text === 'string' && text.length > 0, 'empty public response')
    return text
  }
  try {
    const openingBody = await get(NATIVE_CAREER_URL)
    opening = extractNativeInventory(openingBody)
    const scripts = new Map()
    for (const url of opening.clientScripts) scripts.set(url, hash(await get(url)))
    // All current cards lack role IDs and full descriptions. They remain native
    // discovery candidates; a generic open application must never upgrade them.
    const closingBody = await get(NATIVE_CAREER_URL)
    closing = extractNativeInventory(closingBody)
    closingSnapshotMatched = hash(JSON.stringify(opening)) === hash(JSON.stringify(closing))
    for (const url of closing.clientScripts) {
      if (hash(await get(url)) !== scripts.get(url)) closingSnapshotMatched = false
    }
    reason = !closingSnapshotMatched ? 'native-closing-snapshot-changed'
      : opening.duplicateCards ? 'duplicate-native-role-cards'
        : opening.frames.length ? 'uninspected-native-hiring-frame'
          : 'native-role-cards-lack-full-description-and-role-identity'
  } catch (error) {
    options.signal?.throwIfAborted()
    if (error?.name === 'AbortError') throw error
    reason = error.message
  }
  options.signal?.throwIfAborted()
  const inventory = { ...(opening || { candidates: [], counts: { native: 0, confirmedIndia: 0, confirmedForeign: 0, countryUnknown: 0, fullHealthy: 0, eligible: 0 } }),
    verifiedAt, requests, closingSnapshotMatched, reason, cleanupSafe: false, listingComplete: false }
  if (options.onNativeInventory) await withCancellation(options.onNativeInventory(inventory), options.signal)
  options.signal?.throwIfAborted()
  return attachInventoryEvidence([], { status: opening ? 'discovery-only' : 'coverage-gap',
    surface: NATIVE_CAREER_URL, firstParty: Boolean(opening), listingComplete: false,
    pagesFetched: requests.filter(row => row.status >= 200 && row.status < 300).length,
    reportedTotal: opening?.candidates.length ?? null, indiaFacetCount: null, verifiedAt, reason })
}
