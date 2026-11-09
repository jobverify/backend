import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'

import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { extractClientRoles, contractFailure } from './clientRoles.js'
import { activeHead, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { analyzePublishableJobs } from '../../scraper-support/utils/publishableJobMetrics.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'persevex'
export const COMPANY = 'Persevex'
export const HOMEPAGE_URL = 'https://www.persevex.com/'
export const CAREERS_URL = 'https://www.persevex.com/careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const INDIA_LOCATION_PATTERN = /^(?:Remote \(India\)|Hybrid \((?:Bangalore|Bengaluru|Pune) \/ India\)|India)$/i
const CARD_PATTERN = /<div class="bg-card border border-border rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"[\s\S]*?<button class="w-full text-left[^"]*"[^>]*>([\s\S]*?)<\/button>/gi
const REPORT = Symbol.for('jobverify.persevex-report')
const OBSERVATIONS = Symbol.for('jobverify.verified-recruitment-observations')
export const readPersevexReport = jobs => jobs?.[REPORT] ?? (jobs?.[OBSERVATIONS]?.source === SOURCE ? jobs[OBSERVATIONS] : null)
const sha256 = value => createHash('sha256').update(value).digest('hex')

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const extractOpenRolesSection = (html) =>
  String(html ?? '').match(/<section[^>]+id=["']open-roles["'][^>]*>[\s\S]*?<\/section>/i)?.[0] || ''

const extractDisplayedRoleCount = (sectionHtml) => {
  const count = sectionHtml.match(/Showing\s*<(span|strong)[^>]*>(\d+)<\/\1>\s*(?:<!--.*?-->\s*)?role/i)?.[2]
  return count ? Number.parseInt(count, 10) : null
}

const extractCurrentCards = html => {
  const document = readNativeDocument(html)
  const one = (nodes, label) => {
    if (nodes.length !== 1) throw contractFailure('Persevex malformed native card ' + label)
    return nodes[0]
  }
  const section = one(document.nodes(node => node.tag === 'section' && node.attrs.id === 'open-roles'), 'section')
  const articles = document.nodes(node => node.tag === 'article' && document.hasClass(node, 'position-card'), section)
  if (!articles.length) return null
  const status = one(document.nodes(node => node.tag === 'p' && node.attrs.role === 'status', section), 'count')
  const count = document.text(status).match(/^Showing (\d+) roles?$/)?.[1]
  if (!count || Number(count) > 200) throw contractFailure('Persevex native role count changed')
  const cards = articles.map(article => {
    const field = name => one(document.nodes(node => document.hasClass(node, 'position-card__' + name), article), name)
    const title = document.text(one(document.nodes(node => node.tag === 'h3', article), 'title'))
    const department = document.text(field('department'))
    const metadata = field('meta').children.filter(node => typeof node !== 'string' && node.tag === 'span').map(document.text)
    const details = field('details')
    const description = document.text(one(document.nodes(node => node.tag === 'p', details), 'description'))
    const requirementTitle = document.text(one(document.nodes(node => node.tag === 'h4', details), 'requirements title'))
    const requirements = document.nodes(node => node.tag === 'li', one(document.nodes(node => node.tag === 'ul', details), 'requirements')).map(document.text)
    const apply = field('apply')
    if (metadata.length !== 2 || requirementTitle !== 'Requirements' || apply.tag !== 'a'
      || apply.attrs.href !== '#application' || apply.attrs['aria-label'] !== 'Apply for ' + title) throw contractFailure('Persevex native card detail/application binding changed')
    return { title, department, type: metadata[1], location: metadata[0], stipend: document.text(field('compensation')) || null, description, requirements }
  })
  return { count: Number(count), cards }
}

const extractTextValues = (html) =>
  [...String(html ?? '').matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)

const extractBadges = (cardHtml) =>
  extractTextValues(
    cardHtml.match(/<div class="flex flex-wrap items-center gap-2 mb-2">([\s\S]*?)<\/div>/i)?.[1] ?? '',
  )

const extractMetadataValues = (cardHtml) =>
  extractTextValues(
    cardHtml.match(
      /<div class="flex flex-wrap items-center gap-4 mt-2 text-xs text-muted-foreground">([\s\S]*?)<\/div>/i,
    )?.[1] ?? '',
  )

const normalizeIndiaLocation = (value) => {
  const location = normalizeWhitespace(value)
  if (!location) return null
  return location
}

const normalizeCompensation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return normalized.replace(/^💰\s*/u, '')
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const hybridCity = normalized.match(/\b(Bangalore|Bengaluru|Pune)\b/i)?.[1]
  if (!hybridCity) return null

  return /^bengaluru$/i.test(hybridCity) ? 'Bangalore' : hybridCity
}

const normalizeWorkplaceType = (location) => {
  const normalized = normalizeWhitespace(location)?.toLowerCase()
  if (!normalized) return null
  if (normalized.startsWith('remote')) return 'Remote'
  if (normalized.startsWith('hybrid')) return 'Hybrid'
  return 'On-site'
}

const isIndiaLocation = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return false
  return INDIA_LOCATION_PATTERN.test(normalized)
}

export const hasVerifiedCareersLink = html => {
  try {
    return readNativeDocument(html).nodes(node => node.tag === 'a' && node.attrs.href === '/careers').length > 0
  } catch { return false }
}

const officialDocument = html => {
  const document = readNativeDocument(html)
  const titles = activeHead(html).titles
  return { document, text: document.nodes(node => node.tag === 'body').map(document.text).join(' ').toLowerCase(),
    titleMatches: titles.length === 1 && /^Persevex\s*\|\s*Persevex$/i.test(titles[0]) }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  let proof
  try { proof = officialDocument(page) } catch { return false }
  const { text, titleMatches, document } = proof
  return titleMatches
    && text.includes('campus ambassador')
    && (text.includes('job clox')
      || (text.includes('learn. build. launch your career')
        && document.nodes(node => node.tag === 'a' && node.attrs.href === 'mailto:support@persevex.com').length > 0
        && activeHead(page).metas.some(meta => meta.property === 'og:site_name' && meta.content === COMPANY)))
    && text.includes('persevex lms')
    && hasVerifiedCareersLink(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  let proof
  try { proof = officialDocument(page) } catch { return false }
  const { text, titleMatches, document } = proof
  const sections = document.nodes(node => node.tag === 'section' && node.attrs.id === 'open-roles')
  const rolesSection = sections.length === 1 ? document.text(sections[0]).toLowerCase() : ''
  return titleMatches
    && text.includes('join the team')
    && text.includes('help students launch careers')
    && text.includes('build yours here')
    && rolesSection.includes('open positions')
    && rolesSection.includes('apply in under a minute')
    && rolesSection.includes("don't see your role")
}

export const extractPublishedClientUrl = html => {
  const candidates = readNativeDocument(html).nodes(node => node.tag === 'script' && typeof node.attrs.src === 'string')
    .map(node => node.attrs.src).filter(value => value.includes('/careers/page-'))
  if (candidates.length !== 1) throw contractFailure('Persevex requires exactly one published careers client URL')
  let url
  try { url = new URL(candidates[0], CAREERS_URL) } catch { throw contractFailure('Persevex invalid published client URL identity') }
  if (url.origin !== new URL(CAREERS_URL).origin
    || !/^\/_next\/static\/chunks\/app\/\(main\)\/careers\/page-[a-f0-9]+\.js$/.test(url.pathname)
    || url.username || url.password || url.hash
    || [...url.searchParams.keys()].some(key => key !== 'dpl')
    || url.searchParams.getAll('dpl').length > 1) throw contractFailure('Persevex published client URL must retain the verified same-origin path')
  return url.href
}

const assertPageIdentity = (page, expected) => {
  if (Number(page?.status) !== 200 || page.url !== expected) throw contractFailure('Persevex response URL/status identity changed for ' + expected)
}

export const extractPublicJobs = (html, client, { pagesFetched = 2, verifiedAt = new Date().toISOString() } = {}) => {
  if (!hasOfficialCareersSignal(html)) throw contractFailure('Persevex careers page no longer matches the verified public careers page')
  if (!client) throw contractFailure('Persevex published careers client is required; HTML card metadata is not a description')
  const section = extractOpenRolesSection(html), current = extractCurrentCards(html), count = current?.count ?? extractDisplayedRoleCount(section)
  if (!Number.isInteger(count) || count <= 0) throw contractFailure('Persevex role count does not verify an explicit empty inventory')
  const cards = current?.cards ?? [...section.matchAll(CARD_PATTERN)].map(match => {
    const card = match[1], badges = extractBadges(card), metadata = extractMetadataValues(card)
    const title = stripTags(card.match(/<h3 class="text-lg font-bold text-foreground">([\s\S]*?)<\/h3>/i)?.[1])
    if (!title || badges.length !== 2 || metadata.length < 2 || badges[0] !== metadata[1]) throw contractFailure('Persevex malformed visible role cards')
    return { title, department: badges[1], type: badges[0], location: metadata[0], stipend: normalizeCompensation(metadata[2]) }
  })
  const roles = extractClientRoles(client)
  if (cards.length !== count || roles.length !== count) throw contractFailure('Persevex published role count and visible card count mismatch')
  const seen = new Set()
  for (const role of roles) {
    const card = cards.find(card => card.title === role.title)
    if (!card || seen.has(card.title) || card.department !== role.department || card.type !== role.type
      || card.location !== role.location || (card.stipend || null) !== (role.stipend || null)
      || current && (card.description !== normalizeWhitespace(role.description)
        || JSON.stringify(card.requirements) !== JSON.stringify(role.requirements.map(normalizeWhitespace)))) throw contractFailure('Persevex published client role does not match visible card detail binding: ' + role.id)
    seen.add(card.title)
  }
  const unknown = roles.filter(role => !isIndiaLocation(role.location)).map(({ id, title, location }) => ({ id, title, location }))
  const india = roles.filter(role => isIndiaLocation(role.location))
  const reason = unknown.length
    ? String(unknown.length) + ' roles have unverified India geography: ' + JSON.stringify(unknown)
    : 'All published roles match visible cards and explicit India locations'
  if (!india.length) throw Object.assign(contractFailure('Persevex has no verified India inventory: ' + reason), { code: 'PERSEVEX_GEOGRAPHY_UNVERIFIED', failureKind: 'upstream_geography_unverified', abortRetries: true, unresolvedRoles: unknown })
  const jobs = india.map(role => {
    const workplaceType = normalizeWorkplaceType(role.location)
    return {
      title: role.title, company: COMPANY, department: role.department,
      location: role.location, city: extractCity(role.location), state: null, country: 'India',
      jobId: role.id, requisitionId: role.id, sourceUrl: CAREERS_URL, applyUrl: CAREERS_URL,
      applicationIdentity: { publicJobId: role.id, publicTitle: role.title },
      employmentType: role.type, workplaceType, experienceRequired: null, minimumQualification: null,
      preferredQualification: null, requiredSkills: [], requirements: [...role.requirements],
      postingDate: null, closingDate: null,
      jobDescription: role.description + '\n\nRequirements:\n' + role.requirements.map(text => '- ' + text).join('\n'),
      sourceDescription: role.description + '\n\nRequirements:\n' + role.requirements.map(text => '- ' + text).join('\n'),
      sourceDetailComplete: true, sourceDetailStatus: 'complete', sourceScopeComplete: false,
      sourceLocationCorroborationComplete: true,
      publicExperienceChecked: true, remoteStatus: workplaceType, sourceListingComplete: unknown.length === 0,
    }
  })
  attachInventoryEvidence(jobs, {
    status: unknown.length ? 'coverage-gap' : 'complete-inventory', surface: CAREERS_URL, firstParty: true,
    listingComplete: unknown.length === 0, pagesFetched, reportedTotal: roles.length, indiaFacetCount: india.length,
    verifiedAt, reason,
  })
  const evidence = readInventoryEvidence(jobs)
  evidence.unverifiedGeographyCount = unknown.length
  evidence.unresolvedRoles = unknown
  Object.defineProperty(jobs, REPORT, { configurable: true, value: {
    source: SOURCE, roles, rawJobs: roles.length, observedIndiaJobs: india.length,
    unresolvedRoles: unknown, sourceScopeComplete: false, sourceListingComplete: false,
    cleanupAllowed: false, verifiedZeroInventory: false, closingMatches: false,
  } })
  return jobs
}

const limit = (value, fallback, maximum, name, minimum = 1) => {
  const chosen = value ?? fallback
  if (!Number.isSafeInteger(chosen) || chosen < minimum || chosen > maximum) throw contractFailure('Persevex invalid ' + name + ' limit')
  return chosen
}

// Race both injected readers and native stream reads. A reader that ignores its
// signal cannot retain the collector, or resume the collector after it ended.
const bounded = async (operation, { signal, timeoutMs, onAbort, checkOuter } = {}) => {
  checkOuter?.()
  signal?.throwIfAborted()
  const controller = new AbortController()
  const deadline = performance.now() + timeoutMs
  const timeoutReason = Object.assign(Error('Persevex public request deadline exceeded'), { code: 'ETIMEDOUT' })
  const check = () => {
    checkOuter?.()
    signal?.throwIfAborted()
    if (performance.now() >= deadline) controller.abort(timeoutReason)
    controller.signal.throwIfAborted()
  }
  const forward = () => controller.abort(signal.reason)
  signal?.addEventListener('abort', forward, { once: true })
  let interrupted
  const stopped = new Promise((_, reject) => {
    interrupted = () => { try { onAbort?.(controller.signal.reason) } catch {} reject(controller.signal.reason) }
    controller.signal.addEventListener('abort', interrupted, { once: true })
  })
  const timer = setTimeout(() => controller.abort(timeoutReason), timeoutMs)
  const task = Promise.resolve().then(() => { check(); return operation(controller.signal, check) })
  try {
    const value = await Promise.race([task, stopped])
    check()
    return value
  } catch (error) { check(); controller.abort(error); throw error }
  finally {
    clearTimeout(timer)
    controller.signal.removeEventListener('abort', interrupted)
    signal?.removeEventListener('abort', forward)
  }
}

const validatePublicURL = value => {
  let url
  try { url = new URL(value) } catch { throw contractFailure('Persevex invalid public request URL identity') }
  if (url.origin !== new URL(HOMEPAGE_URL).origin || url.username || url.password || url.hash
    || !['/', '/careers'].includes(url.pathname) && !/^\/_next\/static\/chunks\/app\/\(main\)\/careers\/page-[a-f0-9]+\.js$/.test(url.pathname)
    || [...url.searchParams.keys()].some(key => key !== 'dpl') || url.searchParams.getAll('dpl').length > 1) throw contractFailure('Persevex untrusted request URL identity')
  return url
}

export const fetchPersevexPage = async (url, options = {}) => {
  let current = validatePublicURL(url), reader, responseBody
  const maxBytes = limit(options.maxResponseBytes, 1024 * 1024, 16 * 1024 * 1024, 'response byte')
  const timeoutMs = limit(options.requestTimeoutMs ?? options.timeoutMs, 15000, 30000, 'request timeout')
  const cancelled = new WeakSet()
  const cancel = reason => {
    const target = reader ?? responseBody
    if (!target || cancelled.has(target)) return
    cancelled.add(target)
    try { Promise.resolve(target.cancel?.(reason)).catch(() => {}) } catch {}
  }
  return bounded(async (signal, check) => { try {
    for (let redirects = 0; redirects <= 3; redirects++) {
      check()
      const response = await fetch(current.href, {
        method: 'GET', redirect: 'manual', credentials: 'omit',
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/javascript,text/javascript;q=0.9' }, signal,
      })
      responseBody = response.body
      check()
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        if (!location) throw contractFailure('Persevex redirect location missing')
        let next
        try { next = validatePublicURL(new URL(location, current).href) } catch { throw contractFailure('Persevex untrusted redirect URL identity') }
        cancel(); responseBody = null
        if (options.allowRedirects === false) throw contractFailure('Persevex public redirect changes exact response identity')
        current = next
        continue
      }
      if (response.url !== current.href) throw contractFailure('Persevex response URL identity changed')
      if (response.status !== 200) {
        cancel(); responseBody = null
        return { status: response.status, url: response.url, html: '' }
      }
      const mime = response.headers.get('content-type') ?? ''
      const expected = current.pathname.endsWith('.js') ? /^(?:text|application)\/(?:java|ecma)script(?:;|$)/i : /^text\/html(?:;|$)/i
      if (!expected.test(mime)) throw contractFailure('Persevex unexpected public response MIME')
      const length = response.headers.get('content-length')
      if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) throw contractFailure('Persevex response byte limit exceeded')
      if (!response.body || typeof response.body.getReader !== 'function') throw contractFailure('Persevex complete public body stream missing')
      reader = response.body.getReader()
      check()
      let bytes = 0
      const chunks = []
      for (;;) {
        check()
        const part = await reader.read()
        check()
        if (part.done) break
        if (!(part.value instanceof Uint8Array) || (bytes += part.value.byteLength) > maxBytes) throw contractFailure('Persevex response byte limit exceeded')
        chunks.push(Buffer.from(part.value))
        check()
      }
      const html = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, bytes))
      check()
      reader.releaseLock(); reader = null; responseBody = null
      return { status: response.status, url: response.url, mime, html }
    }
    throw contractFailure('Persevex redirect limit exceeded')
  } catch (error) { cancel(error); throw error }
  }, { signal: options.signal, timeoutMs, onAbort: cancel })
}

export const createPersevexScraper = (factoryOptions = {}) => ({
  async run(runOptions = {}) {
    const options = { ...factoryOptions, ...runOptions }
    if ((options.fetchText || options.fetchJson) && !options.fetchPage) throw contractFailure('Persevex legacy overrides require fetchPage')
    const fetchPage = options.fetchPage ?? fetchPersevexPage
    const requestTimeoutMs = limit(options.requestTimeoutMs ?? options.timeoutMs, 15000, 30000, 'request timeout')
    const sourceTimeoutMs = limit(options.sourceTimeoutMs, 90000, 180000, 'source timeout')
    const maxRequests = limit(options.maxRequests, 6, 12, 'request')
    const maxPages = limit(options.maxPages, 2, 2, 'page')
    const maxResponseBytes = limit(options.maxResponseBytes, 1024 * 1024, 16 * 1024 * 1024, 'response byte')
    const maxTotalBytes = limit(options.maxTotalBytes, 6 * 1024 * 1024, 32 * 1024 * 1024, 'aggregate byte')
    const maxJobs = options.maxJobs == null ? null : limit(options.maxJobs, 200, 100000, 'job', 0)
    const verifiedAt = new Date(typeof options.now === 'function' ? options.now() : options.now ?? Date.now()).toISOString()
    options.signal?.throwIfAborted()
    const controller = new AbortController(), forward = () => controller.abort(options.signal.reason)
    options.signal?.addEventListener('abort', forward, { once: true })
    const sourceReason = Object.assign(Error('Persevex source deadline exceeded'), { code: 'ETIMEDOUT' })
    const sourceDeadline = performance.now() + sourceTimeoutMs
    const checkCollection = () => {
      options.signal?.throwIfAborted()
      if (performance.now() >= sourceDeadline) controller.abort(sourceReason)
      controller.signal.throwIfAborted()
    }
    const sourceTimer = setTimeout(() => controller.abort(sourceReason), sourceTimeoutMs)
    const allowed = new Set([HOMEPAGE_URL, CAREERS_URL]), receipts = []
    let requests = 0, pages = 0, totalBytes = 0
    const read = async (url, inspect = html => html) => {
      checkCollection()
      validatePublicURL(url)
      if (!allowed.has(url) || requests >= maxRequests) throw contractFailure('Persevex public request bound exceeded')
      if (url === CAREERS_URL && pages >= maxPages) throw contractFailure('Persevex public page bound exceeded')
      requests++; if (url === CAREERS_URL) pages++
      const requestedAt = new Date().toISOString()
      return bounded(async (signal, check) => {
      const response = await fetchPage(url, {
        method: 'GET', credentials: 'omit', redirect: 'manual', signal,
        requestTimeoutMs, maxResponseBytes, allowRedirects: false,
      })
      check()
      assertPageIdentity(response, url)
      const body = response.html ?? response.body
      if (typeof body !== 'string' && !(body instanceof Uint8Array)) throw contractFailure('Persevex complete public response body missing')
      const size = typeof body === 'string' ? Buffer.byteLength(body, 'utf8') : body.byteLength
      check()
      if (size > maxResponseBytes || totalBytes + size > maxTotalBytes) throw contractFailure('Persevex public response/aggregate byte bound exceeded')
      totalBytes += size
      const bytes = Buffer.from(body)
      check()
      const html = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      check()
      receipts.push({ method: 'GET', url, requestBody: null, status: response.status, finalUrl: response.url, mime: response.mime ?? null,
        bytes: bytes.length, sha256: sha256(bytes), requestedAt: response.requestedAt ?? requestedAt, completedAt: response.completedAt ?? new Date().toISOString() })
      const result = inspect(html)
      check()
      return result
      }, { signal: controller.signal, timeoutMs: requestTimeoutMs, checkOuter: checkCollection })
    }
    const snapshot = async () => {
      await read(HOMEPAGE_URL, homepage => {
        if (!hasOfficialHomepageSignal(homepage) || !hasVerifiedCareersLink(homepage)) throw contractFailure('Persevex official homepage no longer matches the verified first-party surface')
      })
      const { careers, clientUrl } = await read(CAREERS_URL, careers => {
        if (!hasOfficialCareersSignal(careers)) throw contractFailure('Persevex careers page no longer matches the verified public careers page')
        return { careers, clientUrl: extractPublishedClientUrl(careers) }
      })
      allowed.add(clientUrl)
      const jobs = await read(clientUrl, client => extractPublicJobs(careers, client, { pagesFetched: requests, verifiedAt }))
      return { jobs, clientUrl, roles: readPersevexReport(jobs).roles }
    }
    try {
      const opening = await snapshot(), failures = []
      checkCollection()
      let closing = null
      try { closing = await snapshot() } catch (error) {
        options.signal?.throwIfAborted()
        failures.push({ stage: 'closing-inventory', message: String(error?.message ?? error), code: error?.code ?? null })
      }
      const openingInventoryHash = sha256(JSON.stringify(opening.roles)), closingInventoryHash = closing ? sha256(JSON.stringify(closing.roles)) : null
      const closingMatches = Boolean(closing && opening.clientUrl === closing.clientUrl && openingInventoryHash === closingInventoryHash)
      if (closing && !closingMatches) failures.push({ stage: 'closing-inventory', message: 'Persevex published role inventory or client binding changed' })
      const all = opening.jobs, prior = readPersevexReport(all), sourceComplete = closingMatches && prior.unresolvedRoles.length === 0
      const jobs = maxJobs === null ? all : all.slice(0, maxJobs), limited = jobs.length !== all.length
      const eligibility = analyzePublishableJobs(all, { now: new Date(verifiedAt) })
      const report = { ...prior, status: sourceComplete && !limited ? 'complete' : 'partial', currentCorporateIdentityVerified: true,
        clientUrl: opening.clientUrl, openingInventoryHash, closingInventoryHash, closingMatches, failures, receipts,
        requests, pagesFetched: pages, totalBytes, collectionLimits: { requestTimeoutMs, sourceTimeoutMs, maxRequests, maxPages, maxResponseBytes, maxTotalBytes, maxJobs },
        observedIndiaJobs: all.length, fullIndiaDetails: all.length, eligibleObservedJobs: eligibility.eligibleJobs.length,
        eligibilityFilterCounts: eligibility.filterCounts, indiaJobs: sourceComplete ? all.length : null,
        eligibleJobs: sourceComplete ? eligibility.eligibleJobs.length : null,
        sourceScopeComplete: sourceComplete, sourceListingComplete: sourceComplete && !limited, limited,
        checkedAt: verifiedAt, cleanupAllowed: false, verifiedZeroInventory: false }
      for (const job of jobs) Object.assign(job, {
        source: SOURCE, link: CAREERS_URL, scrapedAt: verifiedAt,
        companyCareerPage: CAREERS_URL, companyDomain: 'persevex.com', atsPlatform: 'official-company-careers',
        sourceScopeComplete: sourceComplete, sourceListingComplete: sourceComplete && !limited,
      })
      const evidence = readInventoryEvidence(all)
      attachInventoryEvidence(jobs, { ...evidence, status: sourceComplete && !limited ? 'complete-inventory' : 'coverage-gap', listingComplete: sourceComplete && !limited,
        pagesFetched: requests, reason: [evidence.reason, !closingMatches && 'Closing current identity/inventory did not verify', limited && 'Returned jobs limited by maxJobs'].filter(Boolean).join('; ') })
      Object.assign(readInventoryEvidence(jobs), { unverifiedGeographyCount: prior.unresolvedRoles.length, unresolvedRoles: prior.unresolvedRoles })
      Object.defineProperty(jobs, REPORT, { configurable: true, value: report })
      Object.defineProperty(jobs, OBSERVATIONS, { configurable: true, value: report })
      if (!sourceComplete) attachSourceObservationEvidence(jobs, { source: SOURCE, recordKind: 'vacancy-rows',
        observedRecordCount: opening.roles.length, observedVacancyCount: opening.roles.length, sourceScopeComplete: false })
      checkCollection()
      if (typeof options.onReport === 'function') await bounded(() => options.onReport(report), { signal: controller.signal, timeoutMs: requestTimeoutMs, checkOuter: checkCollection })
      checkCollection()
      return jobs
    } finally {
      clearTimeout(sourceTimer)
      options.signal?.removeEventListener('abort', forward)
      controller.abort()
    }
  },
})

export const run = async (options = {}) => createPersevexScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()
  if (isDryRun) saveToFile(readInventoryEvidence(jobs), path.join(currentDir, 'jobs.evidence.json'))

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
