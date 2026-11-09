import { createHash } from 'node:crypto'
import { composeAbortSignals } from '../../scraper-support/utils/fetch.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const ORIGIN = 'https://careers.techmahindra.com'
const PREFIX = 'ctl00$ContentPlaceHolder1$'
export const TECHMAHINDRA_NATIVE_AUDIT = Symbol.for('jobverify.techmahindra-native-audit')
const scopeUrls = { IT: `${ORIGIN}/CurrentOpportunity.aspx`, BPS: `${ORIGIN}/BpsOpportunity.aspx` }
const norm = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const walk = (node, predicate) => !node || node.inert ? [] : [
  ...(predicate(node) ? [node] : []),
  ...node.children.filter(child => typeof child !== 'string').flatMap(child => walk(child, predicate)),
]
const requireNative = (condition, message) => { if (!condition) throw new Error(`Tech Mahindra native content: ${message}`) }
const aborted = signal => { if (signal?.aborted) throw signal.reason || new DOMException('Aborted', 'AbortError') }
const digest = value => createHash('sha256').update(value).digest('hex')
const atsHost = /(?:^|\.)(?:myworkdayjobs\.com|myworkdaysite\.com|successfactors\.(?:com|eu)|greenhouse\.io|lever\.co|smartrecruiters\.com|icims\.com|taleo\.net|oraclecloud\.com|workable\.com|applytojob\.com|ashbyhq\.com|zohorecruit\.(?:com|in)|bamboohr\.com|dayforcehcm\.com|darwinbox\.(?:com|in)|ceipal\.com|avature\.net|manatal\.com|careers-page\.com|recruitee\.com|recruiterbox\.com)$/i

const additionalNativeScopes = (document, base, cards) => {
  const scopes = new Set()
  const cardRoutes = new Set(cards.map(card => card.sourceUrl).filter(Boolean))
  const inspect = (value, label = '', script = false) => {
    let target
    try { target = new URL(value, base) } catch { return }
    if (!['http:', 'https:'].includes(target.protocol)) return
    // A same-origin detail URL is reconciled only when its active role card was
    // actually parsed. Native navigation outside the table is separate scope.
    if (target.origin === ORIGIN && /^\/JobDetails\.aspx$/i.test(target.pathname)) {
      if (!cardRoutes.has(target.toString())) scopes.add(target.toString())
      return
    }
    const knownNative = target.origin === ORIGIN && /^\/(?:CurrentOpportunity|BpsOpportunity|Registration|Signin)\.aspx$/i.test(target.pathname)
    const knownMarketing = target.hostname === 'www.techmahindra.com'
      && /^\/careers\/(?:why-techm|techm-way|diversity-inclusion)\/?$/i.test(target.pathname)
    if (knownNative || knownMarketing) return
    const careerRoute = /(?:^|\/)(?:careers?|jobs?|openings?|opportunities|vacancies|recruit(?:ing|ment)?)(?:\/|$)/i.test(target.pathname)
    if (atsHost.test(target.hostname) || careerRoute || (!script && /\b(?:careers?|jobs?|vacancies|openings?|opportunities)\b/i.test(label))) scopes.add(target.toString())
  }
  for (const node of document.nodes(node => node.tag === 'a' && node.attrs.href)) inspect(node.attrs.href, document.text(node))
  for (const node of document.nodes(node => node.tag === 'script')) {
    if (node.attrs.src) inspect(node.attrs.src, '', true)
    for (const match of (node.raw || '').replace(/\\\//g, '/').matchAll(/https?:\/\/[^\s"'<>`\\]+/gi)) inspect(match[0], '', true)
  }
  return [...scopes].sort()
}

// Only paths already declared by the public document may be requested. In
// particular the listing's Apply/Shortlist submit is never invoked.
const officialUrl = (value, base, allowedPaths) => {
  const url = new URL(value, base)
  requireNative(url.origin === ORIGIN && !url.username && !url.password
    && allowedPaths.some(path => url.pathname.toLowerCase() === path.toLowerCase()), 'unexpected public route')
  return url.toString()
}

export const parseNativeListing = (html, url, scope) => {
  const document = readVisibleNativeDocument(String(html))
  requireNative(document.nodes(node => node.tag === 'title').some(node => norm(node.raw) === 'Careers & Job Opportunities with Tech Mahindra'), 'employer identity missing')
  requireNative(document.nodes(node => node.tag === 'h1' && document.text(node) === `Latest ${scope} Jobs`).length === 1, 'listing scope missing')
  const forms = document.nodes(node => node.tag === 'form' && node.attrs.id === 'aspnetForm')
  requireNative(forms.length === 1, 'one public ASP.NET form required')
  const form = forms[0]
  const action = officialUrl(form.attrs.action || url, url, [new URL(scopeUrls[scope]).pathname])
  requireNative((form.attrs.method || '').toLowerCase() === 'post', 'unexpected search form method')
  const controls = {}
  const nonemptySearchInputs = []
  // Disabled fields and all submit controls are excluded from a read-only search.
  for (const node of walk(form, node => node.tag === 'input' && node.attrs.name && !Object.hasOwn(node.attrs, 'disabled'))) {
    if (!['hidden', 'text', 'search', ''].includes((node.attrs.type || '').toLowerCase())) continue
    requireNative(!Object.hasOwn(controls, node.attrs.name), 'duplicate form field')
    controls[node.attrs.name] = node.attrs.value || ''
    if ((node.attrs.type || '').toLowerCase() !== 'hidden' && norm(node.attrs.value)) nonemptySearchInputs.push(node.attrs.name)
  }
  const selects = {}
  for (const node of walk(form, node => node.tag === 'select' && node.attrs.name)) {
    const options = walk(node, child => child.tag === 'option').map(child => ({ value: child.attrs.value ?? document.text(child), text: document.text(child), selected: Object.hasOwn(child.attrs, 'selected') }))
    const selected = options.filter(option => option.selected)
    requireNative(selected.length <= 1 && options.length > 0 && !Object.hasOwn(controls, node.attrs.name), 'ambiguous search selection')
    selects[node.attrs.name] = options
    controls[node.attrs.name] = (selected[0] || options[0]).value
  }
  const unfilteredOptions = {
    ddlCountry: ['Select country', ['Select country']],
    ddlState: ['Select state', ['0']],
    ddlCity: ['Select city', ['0']],
    ddlMinExp: ['Select minimum experience', ['0']],
    ddlTotExpYears: ['Select maximum experience', ['0', 'NA']],
    ddlDesignation: ['Select designation', ['Select designation']],
  }
  const unfilteredScope = !nonemptySearchInputs.length
    && ['ddlCountry', 'ddlState', 'ddlCity', 'ddlTotExpYears'].every(name => selects[`${PREFIX}${name}`])
    && Object.entries(selects).every(([name, options]) => {
      const expected = name.startsWith(PREFIX) ? unfilteredOptions[name.slice(PREFIX.length)] : null
      return expected && expected[1].includes(controls[name]) && options.some(option => option.value === controls[name] && option.text === expected[0])
    })
  const cards = [], tables = walk(form, node => node.tag === 'table' && node.attrs.id === `${PREFIX.replaceAll('$', '_')}DataListRecommended`)
  requireNative(tables.length <= 1, 'duplicate native listing table')
  for (const cell of tables.flatMap(table => walk(table, node => node.tag === 'td'))) {
    const codes = walk(cell, node => node.tag === 'input' && node.attrs.name?.endsWith('$HdnJobCode'))
    const links = walk(cell, node => node.tag === 'a' && /\/JobDetails\.aspx\?/i.test(new URL(node.attrs.href || '', url).pathname + new URL(node.attrs.href || '', url).search))
    if (!codes.length && !links.length) continue
    requireNative(codes.length <= 1 && links.length <= 1, 'ambiguous native card identity')
    const titleNodes = walk(cell, node => node.tag === 'div' && /font-size:\s*13px/i.test(node.attrs.style || '') && /margin-bottom:\s*5px/i.test(node.attrs.style || ''))
    requireNative(titleNodes.length === 1, 'card title missing')
    const title = document.text(titleNodes[0]), fields = walk(cell, node => node.tag === 'p').map(document.text).join(' ')
    const nativeJobCode = codes[0]?.attrs.value || null
    requireNative(title && (!nativeJobCode || /^\d+$/.test(nativeJobCode)), 'invalid native card identity')
    const sourceUrl = links[0] ? officialUrl(links[0].attrs.href, url, ['/JobDetails.aspx']) : null
    const skillSet = fields.match(/Skill Set\s*:\s*(.*?)\s*Experience\s*:/i)?.[1] || null
    const experienceRequired = fields.match(/Experience\s*:\s*(.*?)\s*Location\s*:/i)?.[1] || null
    const location = fields.match(/Location\s*:\s*(.*)/i)?.[1] || null
    cards.push({ nativeJobCode, title, skillSet, experienceRequired, location, country: null, sourceUrl, detailRoute: sourceUrl ? 'public-get' : 'submit-only' })
  }
  const pager = walk(form, node => node.tag === 'a' && /(?:^|\s)page_(?:enabled|disabled)(?:\s|$)/.test(node.attrs.class || '')).map(node => {
    const match = (node.attrs.href || '').match(/^javascript:__doPostBack\('([^']+)',''\)$/)
    requireNative(match && /^ctl00\$ContentPlaceHolder1\$rptPager\$ctl\d+\$lnkPage$/.test(match[1]), 'unknown native pager action')
    return { label: document.text(node), target: match[1], current: (node.attrs.class || '').split(/\s+/).includes('page_disabled') }
  })
  const current = pager.filter(item => item.current && /^\d+$/.test(item.label))
  requireNative(current.length <= 1 && (!pager.length || current.length === 1), 'ambiguous current page')
  const page = current.length ? Number(current[0].label) : 1
  const next = pager.find(item => Number(item.label) === page + 1 && !item.current)
    || pager.find(item => item.label === '>>' && !item.current)
  const forwardUnresolved = pager.some(item => !item.current && ((/^\d+$/.test(item.label) && Number(item.label) > page) || item.label === 'Last'))
  const empty = walk(form, node => node.attrs.id === 'ctl00_ContentPlaceHolder1_Lblmsg').map(document.text).filter(Boolean)
  const explicitEmpty = empty.length === 1 && (scope === 'BPS' ? empty[0] === 'No jobs available for BPS' : empty[0] === 'No jobs available')
  requireNative(!explicitEmpty || (!cards.length && !pager.length), 'contradictory empty listing')
  return { action, controls, selects, cards, page, next, explicitEmpty, unfilteredScope, additionalScopes: additionalNativeScopes(document, url, cards), terminal: !next && !forwardUnresolved && (cards.length > 0 || explicitEmpty), frames: document.frames().length }
}

const searchPayload = page => {
  const payload = { ...page.controls }
  const country = page.selects[`${PREFIX}ddlCountry`]
  requireNative(country?.some(option => option.value === 'IND' && option.text === 'India'), 'native India option missing')
  for (const [name, label] of [['ddlTotExpYears', 'Select maximum experience'], ['ddlMinExp', 'Select minimum experience']]) {
    if (!page.selects[`${PREFIX}${name}`]) continue
    const option = page.selects[`${PREFIX}${name}`].find(option => option.text === label)
    requireNative(option, 'native unbounded experience option missing')
    payload[`${PREFIX}${name}`] = option.value
  }
  payload.__EVENTTARGET = ''
  payload.__EVENTARGUMENT = ''
  payload[`${PREFIX}ddlCountry`] = 'IND'
  payload[`${PREFIX}btnSearchJobs`] = 'Search'
  return payload
}
const sameCards = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const sameInventory = (left, right) => {
  const sorted = cards => [...cards].sort((a, b) => String(a.nativeJobCode || a.sourceUrl).localeCompare(String(b.nativeJobCode || b.sourceUrl)))
  return sameCards(sorted(left), sorted(right))
}

export const runNativeInventory = async (options = {}) => {
  aborted(options.signal)
  requireNative(options.transport == null || typeof options.transport === 'function' || typeof options.transport.fetchPage === 'function' || typeof options.transport.fetch === 'function', 'invalid supplied transport')
  const supplied = options.fetchPage ?? options.transport?.fetchPage
  requireNative(supplied == null || typeof supplied === 'function', 'invalid supplied transport')
  const fetchImpl = options.fetchImpl ?? (typeof options.transport === 'function' ? options.transport : options.transport?.fetch) ?? globalThis.fetch
  const cookies = new Map(), audit = { observedAt: new Date().toISOString(), responses: [], scopes: {}, acceptedIndia: 0, limitations: [] }
  let requests = 0
  const request = async (url, init = {}) => {
    aborted(options.signal)
    officialUrl(url, ORIGIN, ['/CurrentOpportunity.aspx', '/BpsOpportunity.aspx', '/JobDetails.aspx'])
    requireNative(!init.body || !/(?:btn_jobs|btnApply)/i.test(decodeURIComponent(init.body)), 'application submit prohibited')
    const requestInit = { ...init, redirect: 'manual', signal: composeAbortSignals(options.signal, AbortSignal.timeout(options.timeoutMs || 45000)), headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html', ...(init.body ? { 'Content-Type': 'application/x-www-form-urlencoded', Referer: url } : {}), ...(cookies.size ? { Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; ') } : {}), ...(init.headers || {}) } }
    const response = supplied ? await supplied(url, requestInit) : await fetchImpl(url, requestInit)
    aborted(options.signal)
    const status = response?.status ?? 200, finalUrl = response?.url ?? response?.finalUrl ?? url
    const html = typeof response === 'string' ? response : response.html ?? response.body ?? (typeof response.text === 'function' ? await response.text() : response.text)
    requireNative(typeof html === 'string', 'transport did not return HTML')
    const headers = response.headers
    audit.responses.push({ url, finalUrl, status, location: headers?.get?.('location') || null, method: init.method || 'GET', bytes: Buffer.byteLength(html), sha256: digest(html) })
    requireNative(status === 200, `public request returned HTTP ${status}`)
    officialUrl(finalUrl, url, [new URL(url).pathname])
    for (const cookie of headers?.getSetCookie?.() || []) {
      const [pair] = cookie.split(';'), at = pair.indexOf('=')
      if (at > 0) cookies.set(pair.slice(0, at), pair.slice(at + 1))
    }
    requests++
    return html
  }
  const post = (url, fields) => request(url, { method: 'POST', body: new URLSearchParams(fields).toString() })
  const maxPages = Number.isInteger(options.maxPages) && options.maxPages > 0 ? options.maxPages : 500
  for (const [scope, url] of Object.entries(scopeUrls)) {
    const record = audit.scopes[scope] = { discovered: [], additionalScopes: [], pagesFetched: 0, paginationComplete: false, explicitEmpty: false, closingStable: false, limitations: [] }
    const noteAdditionalScope = page => {
      if (page.additionalScopes.length) {
        record.additionalScopes = [...new Set([...record.additionalScopes, ...page.additionalScopes])].sort()
        if (!record.limitations.includes('additional-ATS-scope')) record.limitations.push('additional-ATS-scope')
      }
    }
    try {
      const initial = parseNativeListing(await request(url), url, scope)
      noteAdditionalScope(initial)
      requireNative(!initial.explicitEmpty || initial.unfilteredScope, 'restricted-empty-scope')
      let page = initial.explicitEmpty ? initial : parseNativeListing(await post(url, searchPayload(initial)), url, scope)
      const signatures = new Set(), seen = new Map()
      for (let n = 1; n <= maxPages; n++) {
        record.pagesFetched++
        requireNative(initial.explicitEmpty || page.controls[`${PREFIX}ddlCountry`] === 'IND', 'India selection was not retained')
        requireNative(page.page === n, 'pager skipped or repeated a page')
        requireNative(!page.explicitEmpty || page.unfilteredScope, 'restricted-empty-scope')
        noteAdditionalScope(page)
        if (page.frames) record.limitations.push('additional-active-frame')
        const signature = digest(JSON.stringify(page.cards))
        requireNative(!signatures.has(signature), 'listing page repeated')
        signatures.add(signature)
        if (!page.cards.length && n > 1) { record.limitations.push('empty-after-nonempty-page'); break }
        record.explicitEmpty = page.explicitEmpty
        for (const card of page.cards) {
          const key = card.nativeJobCode || card.sourceUrl
          if (seen.has(key)) { if (!sameCards(seen.get(key), card)) record.limitations.push('conflicting-native-card'); else record.limitations.push('duplicate-native-card'); continue }
          seen.set(key, card); record.discovered.push(card)
        }
        if (page.terminal) { record.paginationComplete = true; break }
        if (!page.next) { record.limitations.push('pagination-closure-unproven'); break }
        if (n === maxPages) { record.limitations.push('pagination-safety-cap'); break }
        const payload = { ...page.controls, __EVENTTARGET: page.next.target, __EVENTARGUMENT: '' }
        page = parseNativeListing(await post(page.action, payload), url, scope)
      }
      // No Apply/Shortlist postback is safe to use for public detail discovery:
      // a server may record interest before returning a redirect.
      if (record.discovered.some(card => !card.sourceUrl)) record.limitations.push('public-detail-route-unavailable')
      if (record.discovered.some(card => card.sourceUrl)) record.limitations.push('public-detail-contract-unverified')
      if (record.paginationComplete) {
        const closingInitial = parseNativeListing(await request(url), url, scope)
        noteAdditionalScope(closingInitial)
        requireNative(!closingInitial.explicitEmpty || closingInitial.unfilteredScope, 'restricted-empty-scope')
        let closing = initial.explicitEmpty && closingInitial.explicitEmpty ? closingInitial
          : parseNativeListing(await post(url, searchPayload(closingInitial)), url, scope)
        const closingCards = [], closingSeen = new Set()
        record.closingPagesFetched = 0
        let closingComplete = false
        for (let n = 1; n <= maxPages; n++) {
          record.closingPagesFetched++
          noteAdditionalScope(closing)
          requireNative(!closing.explicitEmpty || closing.unfilteredScope, 'restricted-empty-scope')
          if (closing.frames || closing.additionalScopes.length || closing.page !== n || (!closingInitial.explicitEmpty && closing.controls[`${PREFIX}ddlCountry`] !== 'IND')) break
          const signature = digest(JSON.stringify(closing.cards))
          if (closingSeen.has(signature)) break
          closingSeen.add(signature)
          closingCards.push(...closing.cards)
          if (closing.terminal) { closingComplete = true; break }
          if (!closing.next || !closing.cards.length || n === maxPages) break
          closing = parseNativeListing(await post(closing.action, { ...closing.controls, __EVENTTARGET: closing.next.target, __EVENTARGUMENT: '' }), url, scope)
        }
        record.closingStable = closingComplete && sameInventory(closingCards, record.discovered) && closing.explicitEmpty === record.explicitEmpty
        if (!record.closingStable) record.limitations.push('closing-inventory-changed')
      }
    } catch (error) {
      aborted(options.signal)
      record.limitations.push(error.message)
    }
    if (!record.paginationComplete) record.limitations.push('incomplete-native-pagination')
    audit.limitations.push(...record.limitations.map(reason => `${scope}:${reason}`))
  }
  // Public card locations and a requested country filter cannot fill a native
  // role's country, original publication date, full description or requisition.
  const jobs = []
  const allEmpty = Object.values(audit.scopes).every(scope => scope.explicitEmpty && scope.paginationComplete && scope.closingStable && !scope.limitations.length)
  attachInventoryEvidence(jobs, { status: allEmpty ? 'verified-empty' : requests ? 'discovery-only' : 'coverage-gap', surface: scopeUrls.IT,
    firstParty: requests > 0, listingComplete: allEmpty, pagesFetched: requests,
    reportedTotal: allEmpty ? 0 : null, indiaFacetCount: allEmpty ? 0 : null,
    verifiedAt: new Date().toISOString(), reason: allEmpty ? 'both-native-IT-and-BPS-explicit-empty-with-stable-closing-scope' : audit.limitations.join('; ') || 'native-role-details-unverified' })
  Object.defineProperty(jobs, TECHMAHINDRA_NATIVE_AUDIT, { value: audit })
  if (options.onNativeAudit) await options.onNativeAudit(audit)
  return jobs
}
