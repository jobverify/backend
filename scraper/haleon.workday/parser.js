import { document, norm } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { requireNative, plainNativeHTML } from '../../scraper-support/shared/nativeJobPosting.js'
export const SOURCE = 'haleon', COMPANY = 'Haleon', ORIGIN = 'https://careers.haleon.com'
export const CORPORATE = 'https://www.haleon.com/careers', BOARD = ORIGIN + '/careers'
export const searchURL = start => ORIGIN + '/api/pcsx/search?domain=haleon.com&query=&location=&start=' + start + '&limit=10'
export const detailURL = id => ORIGIN + '/api/pcsx/position_details?position_id=' + id + '&domain=haleon.com&hl=en'
const ensure = (condition, message) => requireNative(condition, 'Haleon: ' + message)
const text = value => typeof value === 'string' && value.trim().length > 0
const object = value => value && typeof value === 'object' && !Array.isArray(value)
const key = value => norm(value).toLowerCase()

export function envelope(raw) {
  const p = typeof raw === 'string' ? JSON.parse(raw) : raw
  ensure(object(p) && p.status === 200 && object(p.data), 'Native envelope/status unavailable')
  for (const name of ['error', 'Error']) if (p[name] != null) {
    const error = p[name]
    ensure(object(error) && Object.keys(error).every(k => ['message', 'body'].includes(k)) && Object.values(error).every(v => v === ''), 'Native error envelope')
  }
  for (const name of ['success', 'Success']) if (p[name] != null) ensure(p[name] === true, 'Native failure flag')
  for (const name of ['errors', 'Errors', 'message', 'exception', 'errorMessage']) if (p[name] != null) ensure(p[name] === '' || Array.isArray(p[name]) && !p[name].length, 'Native error field')
  for (const name of ['statusCode', 'StatusCode', 'code', 'Status']) if (p[name] != null) ensure(p[name] === 200, 'Conflicting native status')
  if (p.metadata != null) ensure(object(p.metadata) && (!Object.hasOwn(p.metadata, 'isFallback') || p.metadata.isFallback === false), 'Fallback native response')
  return p
}
const identity = row => {
  ensure(object(row) && Number.isSafeInteger(row.id) && row.id > 0 && text(row.name), 'Native role identity/title unavailable')
  ensure(text(row.displayJobId) && text(row.atsJobId), 'Native requisition unavailable')
  ensure(row.positionUrl === '/careers/job/' + row.id, 'Native public role route changed')
  ensure(Array.isArray(row.locations) && row.locations.length > 0 && row.locations.length <= 32 && row.locations.every(text), 'Native locations unavailable')
  ensure(Array.isArray(row.standardizedLocations) && row.standardizedLocations.length === row.locations.length && row.standardizedLocations.every(text), 'Native standardized location count changed')
}
export const candidateForIndia = row => row.locations.some(l => /(?:^|,)\s*India\s*$/i.test(l)) || row.standardizedLocations.some(l => /(?:^|,)\s*IN\s*$/.test(l))
const stable = raw => Object.fromEntries(['id', 'name', 'displayJobId', 'atsJobId', 'positionUrl', 'locations', 'standardizedLocations', 'postedTs'].map(k => [k, raw[k]]))

export function createSourceConfig({ now = () => new Date().toISOString() } = {}) {
  const current = Date.parse(now())
  ensure(Number.isFinite(current), 'Invalid collection clock')
  return {
    source: SOURCE, companyName: COMPANY, boardURL: searchURL(0),
    expectedContentType(url) { return new URL(url).pathname.startsWith('/api/pcsx/') ? 'application/json' : 'text/html' },
    sameReadIdentity(from, to) { return from === to },
    validateURL(value) {
      if (value === CORPORATE || value === BOARD) return
      const url = new URL(value)
      ensure(url.origin === ORIGIN && !url.username && !url.password && !url.hash, 'Unqualified public endpoint')
      if (url.pathname === '/api/pcsx/search') {
        const start = url.searchParams.get('start')
        ensure(/^(?:0|[1-9]\d*)$/.test(start || '') && Number(start) <= 1000 && Number(start) % 10 === 0 && value === searchURL(Number(start)), 'Unqualified global listing query')
      } else {
        const id = url.searchParams.get('position_id')
        ensure(/^[1-9]\d{5,15}$/.test(id || '') && value === detailURL(id), 'Unqualified native role detail query')
      }
    },
    handoffs: [
      { url: CORPORATE, verify(html) { const doc = document(html); ensure(doc.nodes(n => n.tag === 'a' && n.attrs.href === BOARD).length > 0, 'Current corporate-to-native board link missing') } },
      { url: BOARD, verify(html) { const doc = document(html); ensure(doc.nodes(n => n.tag === 'link' && n.attrs.rel === 'canonical' && n.attrs.href === BOARD).length === 1, 'Native board canonical mismatch'); ensure(doc.nodes(n => n.tag === 'meta' && n.attrs.property === 'og:title' && n.attrs.content === 'Careers at Haleon').length === 1, 'Native board brand mismatch'); ensure(doc.nodes(n => n.tag === 'script' && /window\._EF_GROUP_ID\s*=\s*["']haleon\.com["']/.test(n.raw || '')).length === 1, 'Native board tenant mismatch') } },
    ],
    parseListing(html, url) {
      const data = envelope(html).data, start = Number(new URL(url).searchParams.get('start'))
      ensure(Number.isSafeInteger(data.count) && data.count >= 0 && data.count <= 1000, 'Unsupported global listing total')
      ensure(object(data.appliedFilters) && Object.keys(data.appliedFilters).length === 0, 'Global listing unexpectedly filtered')
      ensure(Array.isArray(data.positions) && data.positions.length === Math.min(10, Math.max(0, data.count - start)), 'Truncated global native page')
      const pageNumber = start / 10 + 1, lastPage = Math.max(1, Math.ceil(data.count / 10))
      ensure(pageNumber <= lastPage, 'Native page beyond inventory')
      const localIDs = new Set()
      const records = data.positions.map(raw => {
        identity(raw)
        ensure(!localIDs.has(raw.id), 'Duplicate native listing identity'); localIDs.add(raw.id)
        return { id: String(raw.id), title: raw.name, url: detailURL(raw.id), locations: raw.locations, standardizedLocations: raw.standardizedLocations, rawNative: raw }
      })
      return { pageNumber, lastPage, reportedTotal: data.count, observedRows: records.length, records,
        terminationKnown: pageNumber === lastPage, nextURL: pageNumber < lastPage ? searchURL(start + 10) : null }
    },
    pageFingerprint(page) { return JSON.stringify({ total: page.reportedTotal, lastPage: page.lastPage, records: page.records.map(r => stable(r.rawNative)) }) },
    candidateForIndia,
    parseDetail(html, row) {
      const payload = envelope(html), data = payload.data
      identity(data)
      ensure(JSON.stringify(stable(data)) === JSON.stringify(stable(row.rawNative)), 'Native detail/listing identity, date or location mismatch')
      ensure(data.publicUrl === ORIGIN + data.positionUrl, 'Native public URL mismatch')
      ensure(Number.isSafeInteger(data.postedTs) && data.postedTs > 0 && data.postedTs * 1000 <= current, 'Invalid/future native posting timestamp')
      ensure(data.creationTs == null || Number.isSafeInteger(data.creationTs) && data.creationTs > 0 && data.creationTs * 1000 <= current, 'Invalid native creation timestamp')
      ensure(text(data.jobDescription) && plainNativeHTML(data.jobDescription).length >= 100, 'Missing full native description')
      const india = []
      for (let i = 0; i < data.locations.length; i++) {
        const label = data.locations[i], parts = data.standardizedLocations[i].split(',').map(v => v.trim())
        const writtenIndia = /(?:^|,)\s*India\s*$/i.test(label), isoIndia = parts.at(-1) === 'IN'
        if (!writtenIndia && !isoIndia) continue
        ensure(writtenIndia && isoIndia && parts.length >= 2 && text(parts[0]), 'Native country evidence conflicts')
        const visibleCity = label.split(',').slice(0, -1).some(v => key(v) === key(parts[0]))
        india.push({ location: label, nativeStandardizedLocation: data.standardizedLocations[i], country: 'India', nativeCountryCode: 'IN', city: visibleCity ? parts[0] : null, nativeStandardizedCity: parts[0] })
      }
      ensure(india.length > 0, 'Native detail has no corroborated India location')
      const action = data.positionUserActions?.applyAction
      ensure(object(action) && action.status === 'link_off' && text(action.applyUrl), 'Native application state unavailable')
      let application
      try { application = new URL(action.applyUrl) } catch { ensure(false, 'Native application URL lacks role-bound absolute identity') }
      const applicationPostingID = application.pathname.split('/').at(-2)?.split('_').at(-1)
      const nativePostingMatches = applicationPostingID === data.atsJobId || applicationPostingID?.startsWith(data.atsJobId + '-')
        && /^[1-9]\d*$/.test(applicationPostingID.slice(data.atsJobId.length + 1))
      ensure(application.origin === 'https://gsknch.wd3.myworkdayjobs.com' && !application.username && !application.password && !application.hash
        && application.pathname.startsWith('/GSKCareers/job/') && application.pathname.endsWith('/apply')
        && nativePostingMatches, 'Native application URL is foreign or lacks role identity')
      return { id: row.id, title: row.title, sourceURL: data.publicUrl, nativeApplicationURL: action.applyUrl,
        nativeApplicationPostingID: applicationPostingID,
        nativeListingRecord: row, nativeDetail: data, nativeEnvelope: payload, indiaLocations: india,
        sourceScopeComplete: false, applicationsVisited: false, originalFirstPublication: null }
    },
  }
}
