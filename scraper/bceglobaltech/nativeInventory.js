import { parse } from 'acorn'
import { createHash } from 'node:crypto'
import { readNativeDocument, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

export const BCE_CAREERS = 'https://bceglobaltech.com/career'
export const BCE_LISTING = 'https://uh2nqa8l04.execute-api.ca-central-1.amazonaws.com/prod/joblist'
const BOARD = 'https://bceglobaltech.zohorecruit.in/jobs/Careers'
const ORIGIN = new URL(BOARD).origin
const API = `${ORIGIN}/recruit/v2/public/Job_Openings`
const QUERY = '?source=CareerSite&pagename=Careers'
const LEGAL_EMPLOYER = 'BCE GLOBAL TECHNOLOGY CENTRE PRIVATE LIMITED'
const fail = message => { throw Error(`BCE native inventory: ${message}`) }
const clean = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const digest = value => createHash('sha256').update(value).digest('hex')
const property = (object, key) => {
  if (object?.type !== 'ObjectExpression') return null
  const values = object.properties.filter(p => p.type === 'Property' && !p.computed && (p.key.name || p.key.value) === key)
  return values.length === 1 ? values[0].value : null
}
const jsx = node => {
  const callee = node?.callee?.type === 'SequenceExpression' && node.callee.expressions.length === 2
    && node.callee.expressions[0].value === 0 ? node.callee.expressions[1] : node?.callee
  return node?.type === 'CallExpression' && callee?.type === 'MemberExpression'
    && !callee.computed && ['jsx', 'jsxs'].includes(callee.property.name)
}
const inactiveJsx = node => {
  const props = node.arguments[1]
  if (props?.type !== 'ObjectExpression' || props.properties.some(p => p.type !== 'Property' || p.computed)) return true
  const entries = key => props.properties.filter(p => (p.key.name || p.key.value) === key)
  for (const key of ['hidden', 'inert', 'disabled', 'aria-hidden', 'aria-disabled']) {
    const values = entries(key)
    if (values.length > 1 || (values.length && ![false, 'false'].includes(values[0].value.value))) return true
  }
  const classes = entries('className')
  if (classes.length > 1 || (classes.length && (typeof classes[0].value.value !== 'string'
    || /(?:^|\s)(?:hidden|invisible|sr-only)(?:\s|$)/i.test(classes[0].value.value)))) return true
  const styles = entries('style')
  if (styles.length > 1) return true
  if (styles.length) {
    const style = styles[0].value
    if (style.type !== 'ObjectExpression') return true
    for (const p of style.properties) {
      if (p.type !== 'Property' || p.computed) return true
      const name = p.key.name || p.key.value, value = p.value.value
      if (['display', 'visibility', 'contentVisibility', 'opacity'].includes(name)
        && (value == null || (name === 'opacity' ? Number(value) === 0 : /^(?:none|hidden|collapse)$/i.test(value)))) return true
    }
  }
  return false
}
const renderedStrings = node => {
  if (node?.type === 'Literal' && typeof node.value === 'string') return [node.value]
  if (node?.type === 'ArrayExpression') return node.elements.flatMap(renderedStrings)
  if (jsx(node) && !inactiveJsx(node)) return renderedStrings(property(node.arguments[1], 'children'))
  return []
}

// Inspect syntax only. Quoted examples and comments cannot advertise a request
// or an office. Never evaluate a downloaded client, or log its public token.
export const inspectBceClient = source => {
  if (typeof source !== 'string' || Buffer.byteLength(source) > 4000000) fail('client exceeds response budget')
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' })
  const tokens = new Set(), offices = []
  const visit = (node, inactive = false) => {
    if (!node?.type) return
    if (node.type === 'IfStatement' && typeof node.test.value === 'boolean') {
      visit(node.test.value ? node.consequent : node.alternate, inactive); return
    }
    inactive ||= jsx(node) && inactiveJsx(node)
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && !node.callee.computed
      && node.callee.property.name === 'get' && node.arguments[0]?.value === BCE_LISTING) {
      const token = property(property(node.arguments[1], 'headers'), 'authorizationToken')
      if (token?.type !== 'Literal' || !clean(token.value)) fail('ambiguous native client authorization contract')
      tokens.add(token.value)
    }
    if (!inactive && jsx(node) && node.arguments[0]?.value === 'div'
      && property(node.arguments[1], 'className')?.value === 'footer-info-location') {
      const strings = renderedStrings(property(node.arguments[1], 'children'))
      if (strings.includes('India') && strings.includes('Bangalore') && strings.includes(LEGAL_EMPLOYER)
        && strings.includes('Karnataka, India, 560100')) offices.push(strings)
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(child => visit(child, inactive))
      else if (value?.type) visit(value, inactive)
    }
  }
  visit(ast)
  if (tokens.size !== 1) fail('current client does not bind the exact listing API unambiguously')
  if (offices.length !== 1) fail('current employer India office country/address unavailable')
  return { token: [...tokens][0], office: { city: 'Bangalore', nativeCityAlias: 'Bengaluru', state: 'Karnataka', country: 'India', postalCode: '560100' } }
}

export const unwrapBceNativeListing = payload => {
  if (payload?.statusCode !== 200 || typeof payload.body !== 'string') fail('corporate API envelope changed')
  let body
  try { body = JSON.parse(payload.body); body = JSON.parse(body.data) } catch { fail('corporate API nested JSON changed') }
  if (!body || !Array.isArray(body.jobs) || Object.keys(body).some(k => k !== 'jobs')) fail('corporate jobs array/continuation changed')
  const records = new Map()
  for (const row of body.jobs) {
    if (typeof row.jobOpeningId !== 'string' || !/^\d{8,30}$/.test(row.jobOpeningId) || !clean(row.jobTitle) || !clean(row.jobId)
      || typeof row.status !== 'string' || records.has(row.jobOpeningId)) fail('invalid/duplicate corporate role identity')
    nativeRoleUrl(row.jobUrl, row.jobOpeningId, true)
    records.set(row.jobOpeningId, row)
  }
  return records
}
const nativeRoleUrl = (value, id, apply = false) => {
  let url
  try { url = new URL(value) } catch { fail('native role/application URL unavailable') }
  if (url.origin !== ORIGIN || url.username || url.password || url.port || url.hash
    || !url.pathname.startsWith(`/jobs/Careers/${id}/`) || !url.pathname.slice(`/jobs/Careers/${id}/`.length)
    || url.pathname.slice(`/jobs/Careers/${id}/`.length).includes('/')
    || url.searchParams.getAll('source').length !== 1 || url.searchParams.get('source') !== 'CareerSite'
    || [...url.searchParams.keys()].some(k => !['source', ...(apply ? ['$apply'] : [])].includes(k))
    || (apply && (url.searchParams.getAll('$apply').length !== 1 || url.searchParams.get('$apply') !== 'true'))) fail('foreign native role/application identity')
  return value
}
const isoDate = (value, display = false) => {
  let text = value
  if (display && typeof text === 'string' && /^(\d{2})\/(\d{2})\/(\d{4})$/.test(text)) text = text.replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, '$3-$2-$1')
  if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) fail('native publication date unavailable')
  const date = new Date(text + 'T00:00:00Z')
  if (!Number.isFinite(+date) || date.toISOString().slice(0, 10) !== text) fail('invalid native publication date')
  return text
}
const rows = data => {
  if (!Array.isArray(data) || data.length > 500) fail('native record array unavailable or exceeds budget')
  const result = new Map()
  for (const row of data) {
    if (typeof row?.id !== 'string' || !/^\d{8,30}$/.test(row.id) || !clean(row.Posting_Title) || typeof row.Publish !== 'boolean'
      || typeof row.Is_Locked !== 'boolean' || result.has(row.id)) fail('invalid/duplicate native role state')
    result.set(row.id, row)
  }
  return result
}
const envelope = payload => {
  if (payload?.code !== 'success' || payload.error || (Array.isArray(payload.errors) ? payload.errors.length : payload.errors)
    || payload.success === false || !Array.isArray(payload.data)) fail('native API envelope changed')
  for (const scope of [payload, payload.info]) if (scope) {
    for (const field of ['more_records', 'moreRecords', 'hasMore', 'next', 'next_page', 'nextPage', 'nextCursor', 'cursor', 'pagination']) {
      if (scope[field] != null && scope[field] !== false && scope[field] !== '') fail('native API continuation requires enumeration')
    }
    for (const field of ['total', 'total_records', 'total_count']) if (scope[field] != null && scope[field] !== payload.data.length) fail('native advertised total mismatch')
  }
  return payload.data
}
const roleState = r => [r.id || r.jobOpeningId, r.Posting_Title || r.jobTitle, r.Publish ?? r.status, r.Is_Locked,
  r.Date_Opened || r.effectiveFrom, r.Location, r.Country, r.State, r.Remote_Job, r.Job_Location,
  r.additionalLocations, r.Entity, r.location, r.jobId, r.$url || r.jobUrl]
const signature = records => JSON.stringify([...records.values()].map(roleState).sort((a, b) => a[0].localeCompare(b[0])))
const defaultPage = async (url, { signal, headers = {} } = {}) => {
  const response = await fetch(url, { signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(25000)]),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)', ...headers } })
  const html = await response.text()
  if (Buffer.byteLength(html) > 4000000) fail('response exceeds budget')
  if (response.status !== 200 || response.url !== url) fail('native HTTP status or redirect identity changed')
  return { status: response.status, url: response.url, html, contentType: response.headers.get('content-type') }
}

export const createBceNativeInventoryScraper = (defaults = {}) => ({
  async run(options = {}) {
    const settings = { ...defaults, ...options }, maxJobs = settings.maxJobs ?? 0, concurrency = settings.detailConcurrency ?? 2
    if (!Number.isSafeInteger(maxJobs) || maxJobs < 0 || !Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 4) fail('invalid run limits')
    const controller = new AbortController(), signal = settings.signal ? AbortSignal.any([settings.signal, controller.signal]) : controller.signal
    const loadPage = settings.fetchPage || defaultPage
    const loadJson = settings.fetchJson || (async (url, init) => JSON.parse((await defaultPage(url, init)).html))
    const now = settings.now || (() => new Date().toISOString()), reasons = new Set()
    let requests = 0
    const pageAt = async url => {
      signal.throwIfAborted(); const p = await loadPage(url, { signal }); signal.throwIfAborted(); requests++
      if (p?.status !== 200 || p.url !== url || typeof p.html !== 'string' || Buffer.byteLength(p.html) > 4000000) fail('current employer page identity changed')
      return p.html
    }
    const jsonAt = async (url, headers) => {
      signal.throwIfAborted(); const result = await loadJson(url, { signal, ...(headers ? { headers } : {}) }); signal.throwIfAborted(); requests++
      return result
    }
    const document = readNativeDocument(await pageAt(BCE_CAREERS))
    const scripts = document.nodes(n => n.tag === 'script' && n.attrs.src && !Object.hasOwn(n.attrs, 'nomodule')
      && /^(?:|module|(?:text|application)\/javascript)$/i.test(n.attrs.type || ''))
      .map(n => new URL(n.attrs.src, BCE_CAREERS)).filter(u => u.origin === new URL(BCE_CAREERS).origin && /^\/static\/js\/main\.[\w-]+\.js$/.test(u.pathname) && !u.search && !u.hash)
    if (scripts.length !== 1) fail('current active first-party careers bundle unavailable')
    const bundleUrl = scripts[0].href, bundle = await pageAt(bundleUrl), contract = inspectBceClient(bundle)
    const headers = { Accept: 'application/json,text/plain,*/*', authorizationToken: contract.token }
    const initialCorporate = unwrapBceNativeListing(await jsonAt(BCE_LISTING, headers))
    const snapshot = async () => {
      const board = readNativeDocument(await pageAt(BOARD))
      const hidden = id => {
        const nodes = board.nodes(n => n.tag === 'input' && n.attrs.type === 'hidden' && n.attrs.id === id)
        if (nodes.length !== 1) fail('native board carrier unavailable/ambiguous')
        return JSON.parse(nodes[0].attrs.value)
      }
      const meta = hidden('meta'), org = meta.org_info
      if (org?.id !== '147575000000304516' || org.company_name !== LEGAL_EMPLOYER || org.type !== 'internal'
        || !['https://bceglobaltech.com', 'https://bceglobaltech.com/'].includes(org.website) || org.hide_company_name !== false
        || meta.page_id !== '147575000000304666' || meta.list_url !== BOARD || meta.page_name !== 'Careers'
        || meta.source !== 'CareerSite' || meta.employee_portal !== false || meta.date_format !== 'dd/MM/yyyy') fail('native employer/organization/page identity changed')
      const embedded = rows(hidden('jobs')), payload = await jsonAt(API + QUERY), records = rows(envelope(payload))
      if (payload.info?.page_name !== 'Careers') fail('native API page identity changed')
      const agree = embedded.size === records.size && [...records].every(([id, row]) => {
        const other = embedded.get(id)
        return other && clean(row.Posting_Title) === clean(other.Posting_Title) && row.Publish === other.Publish
          && row.Is_Locked === other.Is_Locked && isoDate(row.Date_Opened, true) === isoDate(other.Date_Opened, true)
          && ['Location', 'Country', 'State', 'Remote_Job', 'Entity'].every(field => row[field] == null || other[field] == null
            || JSON.stringify(row[field]) === JSON.stringify(other[field]))
      })
      if (!agree) reasons.add('native-board-api-state-not-reconciled')
      return records
    }
    const initial = await snapshot(), jobs = [], active = [...initial.values()].filter(r => r.Publish && !r.Is_Locked)
    if ([...initialCorporate.keys()].some(id => !initial.has(id)) || active.some(r => !initialCorporate.has(r.id))) reasons.add('corporate-native-role-inventories-differ')
    // The current client also advertises a separate static category inventory.
    // Its role scope and the native lifecycle contract are not proven here.
    reasons.add('additional-client-inventory-and-lifecycle-scope-unproven')
    let next = 0
    const results = await Promise.allSettled(Array.from({ length: concurrency }, async () => {
      try {
        while (next < active.length) {
          const row = active[next++], corporate = initialCorporate.get(row.id)
          nativeRoleUrl(row.$url, row.id)
          let payload
          try { payload = await jsonAt(`${API}/${row.id}${QUERY}`) }
          catch (error) { signal.throwIfAborted(); reasons.add(`native-detail-unavailable:${row.id}`); continue }
          const detailRows = envelope(payload), detail = detailRows[0]
          if (detailRows.length !== 1 || detail?.id !== row.id || clean(detail.Posting_Title) !== clean(row.Posting_Title)
            || (corporate && clean(corporate.jobTitle) !== clean(row.Posting_Title))) fail('native listing/detail role identity changed')
          const application = nativeRoleUrl(detail.$appy_url, row.id, true)
          if (detail.Publish !== true || detail.Is_Locked !== false) { reasons.add('native-role-state-changed'); continue }
          for (const field of ['Location', 'Country', 'State', 'Entity']) {
            if (detail[field] != null && typeof detail[field] !== 'string') fail('malformed native geography or entity')
          }
          if (detail.Remote_Job != null && typeof detail.Remote_Job !== 'boolean') fail('malformed native remote state')
          for (const field of ['Job_Location', 'additionalLocations']) {
            if (detail[field] != null && (!Array.isArray(detail[field]) || detail[field].some(v => typeof v !== 'string'))) fail('malformed native additional offices')
          }
          if (detail.Entity != null && ![LEGAL_EMPLOYER, 'BCE Global Tech'].includes(clean(detail.Entity))) {
            reasons.add(`native-employer-entity-unresolved:${row.id}`); continue
          }
          const city = clean(detail.Location), country = clean(detail.Country)
          const explicitIndia = ['India', 'IN', 'IND'].includes(country), knownOffice = ['Bengaluru', 'Bangalore'].includes(city)
          if (!city || (country && !explicitIndia) || (!explicitIndia && !knownOffice)
            || (detail.Remote_Job === true && !explicitIndia) || (detail.Job_Location?.length || detail.additionalLocations?.length)) {
            reasons.add(`native-office-scope-unresolved:${row.id}`); continue
          }
          const state = clean(detail.State) || (knownOffice ? 'Karnataka' : null)
          const description = extractActiveDescription(detail.Job_Description)
          if (!description) { reasons.add(`full-native-description-unavailable:${row.id}`); continue }
          const postingDate = isoDate(detail.Date_Opened)
          if (postingDate !== isoDate(row.Date_Opened, true)) { reasons.add('native-publication-date-changed'); continue }
          jobs.push({ source: 'bceglobaltech', company: 'BCE Global Tech', nativeLegalEmployer: LEGAL_EMPLOYER,
            jobId: row.id, requisitionId: corporate?.jobId || row.id, title: detail.Posting_Title,
            location: [city, state, 'India'].filter(Boolean).join(', '), city, state, country: 'India',
            countryEvidence: explicitIndia ? { field: 'Country', value: detail.Country, surface: `${API}/${row.id}${QUERY}` }
              : { ...contract.office, surface: bundleUrl, sha256: digest(bundle) },
            sourceUrl: row.$url, applyUrl: application, link: application,
            sourceDescription: description, jobDescription: description, nativeDescriptionSHA256: digest(detail.Job_Description),
            postingDate, nativeDateOpened: detail.Date_Opened, closingDate: null,
            nativeEffectiveFrom: corporate?.effectiveFrom || null, nativeEffectiveTo: corporate?.effectiveTo || null,
            experienceRequired: clean(detail.Work_Experience) || null, employmentType: clean(detail.Job_Type) || null,
            department: corporate?.jobCategory || null, requiredSkills: [],
            companyDomain: 'bceglobaltech.com', companyCareerPage: BCE_CAREERS, atsPlatform: 'zoho-recruit-api',
            sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false, scrapedAt: new Date(now()).toISOString() })
        }
      } catch (error) { controller.abort(error); throw error }
    }))
    const failure = results.find(r => r.status === 'rejected'); if (failure) throw failure.reason
    const closingCorporate = unwrapBceNativeListing(await jsonAt(BCE_LISTING, headers)), closing = await snapshot()
    if (signature(initial) !== signature(closing) || signature(initialCorporate) !== signature(closingCorporate)) reasons.add('closing-inventory-state-not-reconciled')
    const healthy = jobs.filter(job => closing.get(job.jobId)?.Publish === true && closing.get(job.jobId)?.Is_Locked === false
      && JSON.stringify(roleState(initial.get(job.jobId))) === JSON.stringify(roleState(closing.get(job.jobId)))
      && (!initialCorporate.has(job.jobId) || (closingCorporate.get(job.jobId)?.status === 'Published'
        && JSON.stringify(roleState(initialCorporate.get(job.jobId))) === JSON.stringify(roleState(closingCorporate.get(job.jobId))))))
      .sort((a, b) => [...initial.keys()].indexOf(a.jobId) - [...initial.keys()].indexOf(b.jobId))
    const selected = maxJobs ? healthy.slice(0, maxJobs) : healthy
    if (selected.length !== healthy.length) reasons.add('source-job-limit')
    return attachInventoryEvidence(selected, { status: 'discovery-only', surface: BCE_LISTING, firstParty: true,
      listingComplete: false, pagesFetched: requests, reportedTotal: closing.size, indiaFacetCount: null,
      verifiedAt: new Date(now()).toISOString(), reason: `bce-native-incomplete:${[...reasons].join(';')}` })
  },
})
