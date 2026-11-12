import {disposeResponseBody} from './responseBodyDisposal.js'
import {parse} from 'acorn'
import {readNativeDocument, extractActiveDescription, decodeNativeEntities} from '../utils/activeNativeHtml.js'
import {nativeCountryName} from './nativeJobPosting.js'
import {attachInventoryEvidence} from '../utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'

const need = (condition, message) => {
  if (!condition) throw Object.assign(new Error(`Paradox native inventory: ${message}`), {
    softFailure: true, abortRetries: true, failureKind: 'parser_or_contract_error',
  })
}
const member = (node, name) => node?.type === 'MemberExpression' && !node.computed
  && node.object?.name === 'window' && node.property?.name === name

const checkJson = node => {
  if (node.type === 'ObjectExpression') {
    const keys = new Set()
    for (const property of node.properties) {
      need(property.type === 'Property' && property.kind === 'init' && !property.computed
        && !property.method && !property.shorthand, 'nonliteral state property')
      const key = String(property.key.value ?? property.key.name)
      need(!keys.has(key), 'duplicate state property')
      keys.add(key)
      checkJson(property.value)
    }
  } else if (node.type === 'ArrayExpression') {
    for (const value of node.elements) { need(value, 'sparse state array'); checkJson(value) }
  } else {
    need(node.type === 'Literal' && !node.regex && typeof node.value !== 'bigint'
      || node.type === 'UnaryExpression' && node.operator === '-'
        && node.argument.type === 'Literal' && typeof node.argument.value === 'number', 'nonliteral state value')
  }
}

// Read the assignment boundary from syntax, never by executing publisher code.
// Current pages append a separate __BUILD__ assignment in the same script.
export const readParadoxPreload = html => {
  const document = readNativeDocument(html)
  const states = []
  for (const script of document.nodes(node => node.tag === 'script' && !node.attrs.src
    && /^(?:|(?:text|application)\/(?:java|ecma)script)$/i.test(node.attrs.type || ''))) {
    if (!(script.raw || '').includes('__PRELOAD_STATE__')) continue
    need(!Object.hasOwn(script.attrs, 'nomodule') && !Object.keys(script.attrs).some(key => /^on/i.test(key)), 'unreviewed state script activation')
    let program
    try { program = parse(script.raw, {ecmaVersion: 'latest'}) } catch { need(false, 'invalid state script') }
    let count = 0
    for (const statement of program.body) {
      const expression = statement.type === 'ExpressionStatement' ? statement.expression : null
      need(expression?.type === 'AssignmentExpression' && expression.operator === '=', 'unreviewed state script statement')
      if (member(expression.left, '__PRELOAD_STATE__')) {
        need(++count === 1, 'duplicate state assignment')
        checkJson(expression.right)
        try { states.push(JSON.parse(script.raw.slice(expression.right.start, expression.right.end))) }
        catch { need(false, 'state is not JSON') }
      } else need(member(expression.left, '__BUILD__') && expression.right.type === 'Literal'
        && typeof expression.right.value === 'string', 'unreviewed state script assignment')
    }
    need(count === 1, 'missing state assignment')
  }
  need(states.length <= 1, 'ambiguous active state')
  return states[0] || null
}

export const paradoxIndiaRows = state => {
  const rows = state?.jobSearch?.jobs
  need(Array.isArray(rows), 'missing native jobs')
  return rows.filter(row => Array.isArray(row?.locations) && row.locations.length
    && row.locations.every(location => nativeCountryName(location.country) === 'India'
      && (!location.countryAbbr || nativeCountryName(location.countryAbbr) === 'India')))
}

const profiles = {
  fedex: {origin: 'https://careers.fedex.com', company: 'FedEx', nativeCompany: 'paradox-fedexapi.paradox.ai-FedEx',
    nativeWorkdayCompany: 'Federal Express Corporation - PROD external', nativeWorkdayCompanyID: '25_2634_external',
    descriptionClass: 'c-job-details-content__description', countryFilter: true},
  gevernova: {origin: 'https://careers.gevernova.com', company: 'GE Vernova', nativeCompany: 'GE Vernova - PROD',
    descriptionClass: 'description', employer: 'GE Vernova'},
}
const text = value => typeof value === 'string' ? decodeNativeEntities(value).replace(/\s+/g, ' ').trim() : ''
const stable = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item)
const hasClass = (node, value) => (node.attrs.class || '').split(/\s+/).includes(value)
const httpURL = value => {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.port ? url.href : null }
  catch { return null }
}
const pageURL = (profile, page) => profile.origin + '/jobs' + (page > 1 ? '/page/' + page : '')
  + (profile.countryFilter ? '?filter[country][0]=India' : '')
const nativeDate = value => {
  if (value == null || value === '') return null
  need(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?$/.test(value)
    && Number.isFinite(Date.parse(value)), 'invalid native date')
  const day = new Date(value.slice(0,10) + 'T00:00:00Z')
  need(Number.isFinite(day.getTime()) && day.toISOString().slice(0,10) === value.slice(0,10), 'invalid native date')
  return value
}

const readNativeJson = raw => {
  let program
  try { program = parse('(' + raw + '\n)', {ecmaVersion: 'latest'}) }
  catch { need(false, 'invalid native JSON') }
  need(program.body.length === 1 && program.body[0].type === 'ExpressionStatement', 'invalid native JSON expression')
  checkJson(program.body[0].expression)
  try { return JSON.parse(raw) }
  catch { need(false, 'native data is not JSON') }
}

const fetchNativeText = async (url, {signal, callerSignal} = {}) => {
  signal?.throwIfAborted()
  const requestSignal = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(20000)])
  const response = await fetch(url, {signal: requestSignal, redirect: 'manual',
    headers: {Accept: 'text/html', 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify careers inventory check)'}})
  if (response.status !== 200) {
    await disposeResponseBody(response, {signal: callerSignal, bestEffort: true})
    throw Object.assign(new Error(`Paradox public response HTTP ${response.status}`), {
      status: response.status, abortRetries: true, softFailure: true,
      failureKind: [401,403,429].includes(response.status) ? 'blocked_or_access_denied' : 'network_or_timeout',
    })
  }
  const chunks = []; let size = 0
  for await (const chunk of response.body) {
    size += chunk.length
    need(size <= 4 * 1024 * 1024, 'public response exceeds body limit')
    chunks.push(chunk)
  }
  signal?.throwIfAborted()
  return Buffer.concat(chunks).toString('utf8')
}

const role = (html, row, profile) => {
  const document = readNativeDocument(html)
  const postings = document.nodes(node => node.tag === 'script' && !node.attrs.src && node.attrs.type === 'application/ld+json')
    .map(node => readNativeJson(node.raw)).filter(value => value?.['@type'] === 'JobPosting')
  need(postings.length === 1, 'missing or ambiguous native JobPosting')
  const posting = postings[0], sourceURL = new URL(row.originalURL, profile.origin + '/').href
  need(posting.url === sourceURL && text(posting.title) === text(row.title)
    && posting.identifier?.value === row.reference && posting.identifier?.name === 'Job ID', 'native listing/detail identity changed')
  need(document.nodes(node => node.tag === 'h1' && document.text(node) === text(row.title)).length === 1, 'native visible role title changed')
  const employer = profile.employer || row.brandName
  const workdayMirror = Boolean(profile.nativeWorkdayCompany && row.companyName === profile.nativeWorkdayCompany
    && row.companyID === profile.nativeWorkdayCompanyID)
  need(text(employer) && text(posting.hiringOrganization?.name) === text(employer)
    && (row.companyName === profile.nativeCompany || workdayMirror)
    && (!profile.countryFilter || workdayMirror || row.accountName === 'FedEx'), 'native employer changed')
  const locations = Array.isArray(posting.jobLocation) ? posting.jobLocation : [posting.jobLocation]
  need(locations.length && locations.every(location => nativeCountryName(location?.address?.addressCountry) === 'India'), 'native role country is unresolved or contradictory')
  const containers = document.nodes(node => hasClass(node, profile.descriptionClass))
  need(containers.length === 1, 'missing or ambiguous full native description')
  const container = profile.countryFilter ? {...containers[0], children: containers[0].children.filter(child =>
    typeof child === 'string' || child.tag !== 'h2' || document.text(child) !== 'Description')} : containers[0]
  const visibleDescription = document.text(container), schemaDescription = extractActiveDescription(posting.description)
  need(schemaDescription?.length >= 100 && visibleDescription.length >= 100
    && visibleDescription.replace(/\s/g, '') === schemaDescription.replace(/\s/g, ''), 'full native criteria differ from the visible role')
  const applyURL = httpURL(row.applyURL)
  need(applyURL && document.nodes(node => node.tag === 'a' && httpURL(node.attrs.href) === applyURL).length > 0, 'native role application binding changed')
  need(!/\b(?:this (?:job|position) is no longer available|position has been filled)\b/i.test(document.text(container)), 'native role is unavailable')
  const fields = new Map((row.customFields || []).map(field => [field.cfKey, field.value]))
  need(!['1',true].includes(fields.get('cf_workday_closed')), 'native role is closed')
  const posted = nativeDate(posting.datePosted)
  const closing = nativeDate(posting.validThrough || fields.get('cf_posting_end_date'))
  return {posting, description: visibleDescription, sourceURL, applyURL, posted, closing}
}

export const createParadoxPublicScraper = source => {
  const profile = profiles[source]
  need(profile, 'unreviewed source profile')
  return {async run({fetchText = fetchNativeText, signal: callerSignal, maxPages = 10, maxJobs = 250,
    sourceTimeoutMs = 120000, now = new Date()} = {}) {
    callerSignal?.throwIfAborted()
    need(Number.isSafeInteger(maxPages) && maxPages > 0 && maxPages <= 1000
      && Number.isSafeInteger(maxJobs) && maxJobs > 0 && maxJobs <= 10000, 'invalid collection bounds')
    need(Number.isSafeInteger(sourceTimeoutMs) && sourceTimeoutMs > 0 && sourceTimeoutMs <= 120000, 'invalid source deadline')
    const workAbort = new AbortController()
    const signal = AbortSignal.any([workAbort.signal, AbortSignal.timeout(sourceTimeoutMs), ...(callerSignal ? [callerSignal] : [])])
    let totalBytes = 0
    const checkedAt = new Date(typeof now === 'function' ? now() : now).toISOString()
    const read = async url => {
      signal?.throwIfAborted()
      let html
      try { html = await fetchText(url, {signal, callerSignal, cache: 'no-store'}) }
      catch (error) { callerSignal?.throwIfAborted(); signal.throwIfAborted(); throw error }
      signal?.throwIfAborted()
      need(typeof html === 'string', 'native reader did not return HTML')
      const bytes = Buffer.byteLength(html, 'utf8')
      totalBytes += bytes
      need(bytes <= 4 * 1024 * 1024 && totalBytes <= 64 * 1024 * 1024, 'native response byte bound exceeded')
      if (/<title[^>]*>\s*(?:Just a moment|Radware Captcha Page|Access Denied|Robot Check)|cf-chl-|sucuri_cloudproxy_js|_Incapsula_Resource/i.test(html)) {
        throw Object.assign(new Error('Paradox public access challenge'), {softFailure: true, abortRetries: true, failureKind: 'blocked_or_access_denied'})
      }
      return html
    }
    const jobs = [], pages = [], ids = new Set(), requisitions = new Set(), selectedNativeRecords = [], heldNativeRecords = []
    let total = null, observed = 0, complete = false
    const searchPage = (html, page) => {
      const state = readParadoxPreload(html), search = state?.jobSearch
      need(Array.isArray(search?.jobs) && Number.isSafeInteger(search.totalJob) && search.totalJob >= 0
        && search.isLoading === false && Number(search.params?.page_number || 1) === page, 'native search envelope changed')
      need(!profile.countryFilter || stable(search.params?.filter?.country) === '["India"]', 'native India filter changed')
      return {state, search}
    }
    for (let page = 1; page <= maxPages && jobs.length < maxJobs; page++) {
      const url = pageURL(profile, page), {state, search} = searchPage(await read(url), page)
      if (total === null) total = search.totalJob
      need(search.totalJob === total && observed + search.jobs.length <= total, 'native total changed during pagination')
      need(search.jobs.length || observed === total, 'native pagination ended early')
      pages.push({url, page, snapshot: stable(search)})
      for (const row of search.jobs) {
        need(typeof row?.uniqueID === 'string' && row.uniqueID && !ids.has(row.uniqueID), 'duplicate or missing native posting identity')
        ids.add(row.uniqueID)
        selectedNativeRecords.push(structuredClone(row))
      }
      observed += search.jobs.length
      const ready = []
      for (const row of paradoxIndiaRows(state)) {
        if (requisitions.has(row.reference)) continue
        need(typeof row.reference === 'string' && row.reference && row.title && row.originalURL, 'missing public native role identity')
        if (![false,'false'].includes(row.isInternal) || String(row.postingType) !== '1') {
          heldNativeRecords.push({reason: 'native-publication-state-unqualified', record: structuredClone(row)})
          continue
        }
        const workdayMirror = profile.nativeWorkdayCompany && row.companyName === profile.nativeWorkdayCompany
          && row.companyID === profile.nativeWorkdayCompanyID
        if (row.companyName !== profile.nativeCompany && !workdayMirror) {
          heldNativeRecords.push({reason: 'native-employer-contract-unqualified', record: structuredClone(row)})
          continue
        }
        const url = new URL(row.originalURL, profile.origin + '/')
        need(url.origin === profile.origin && !url.search && !url.hash
          && url.pathname.endsWith('/job/' + (workdayMirror ? row.uniqueID : row.reference)), 'native role URL changed')
        ready.push({row, url})
        requisitions.add(row.reference)
      }
      const qualify = async ({row, url}) => {
        const opening = role(await read(url.href), row, profile)
        const closing = role(await read(url.href), row, profile)
        need(stable(opening) === stable(closing), 'closing native role changed')
        if (opening.closing && Date.parse(opening.closing.includes('T') ? opening.closing : opening.closing + 'T23:59:59.999Z') < Date.parse(checkedAt)) {
          heldNativeRecords.push({reason: 'native-expiry-passed', record: structuredClone(row), jobPosting: structuredClone(opening.posting)})
          return null
        }
        const location = row.locations[0]
        return {source, company: profile.company, title: text(row.title), jobId: row.reference,
          requisitionId: row.requisitionID || row.reference, country: 'India', city: location.city || null,
          location: location.locationText || [location.city,location.state,'India'].filter(Boolean).join(', '),
          locations: row.locations.map(location => location.locationText), sourceUrl: opening.sourceURL,
          applyUrl: opening.applyURL, link: opening.applyURL, employmentType: (row.employmentType || []).join(', ') || null,
          jobDescription: opening.description, sourceDescription: opening.posting.description,
          postingDate: opening.posted, closingDate: opening.closing, sourceClosingDateIsExact: Boolean(opening.closing?.includes('T')),
          sourcePostedDateRaw: opening.posted, firstEverPostedAt: null,
          remoteStatus: row.isRemote ? 'Remote' : 'On-site', scrapedAt: checkedAt,
          nativeListingRecord: structuredClone(row), nativeJobPosting: structuredClone(opening.posting),
          nativeClosingJobPosting: structuredClone(closing.posting),
          sourceDetailComplete: true, sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
          sourceNativeClosingContext: {fullRoleRechecked: true, selectedListingPagesRechecked: true, companyScopeComplete: false},
        }
      }
      // Keep each role's opening/closing reads paired. A fatal role/access error
      // cancels its peers and is observed before any later page is requested.
      for (let cursor = 0; cursor < ready.length && jobs.length < maxJobs;) {
        signal.throwIfAborted()
        const batch = ready.slice(cursor, cursor + Math.min(4, maxJobs - jobs.length))
        cursor += batch.length
        const settled = await Promise.allSettled(batch.map(candidate => qualify(candidate).catch(error => {
          if (!workAbort.signal.aborted) workAbort.abort(error)
          throw error
        })))
        const failed = settled.find(item => item.status === 'rejected')
        if (failed) { callerSignal?.throwIfAborted(); throw failed.reason }
        jobs.push(...settled.map(item => item.value).filter(Boolean))
      }
      complete = observed === total
      if (complete) break
    }
    for (const page of pages) {
      const {search} = searchPage(await read(page.url), page.page)
      need(stable(search) === page.snapshot, 'closing native listing changed')
    }
    if (jobs.length) jobs[0].nativeInventoryContext = {selectedNativeRecords, heldNativeRecords,
      observedRecordCount: observed, selectedPaginationComplete: complete, companyScopeComplete: false}
    attachInventoryEvidence(jobs, {status: 'coverage-gap', surface: pageURL(profile,1), firstParty: true,
      listingComplete: false, pagesFetched: pages.length * 2, reportedTotal: null, indiaFacetCount: null,
      verifiedAt: checkedAt, reason: `qualified-native-India-roles=${jobs.length};held-native-India-roles=${heldNativeRecords.length};selected-native-rows=${observed};selected-pagination-complete=${complete};whole-company-scope-unqualified;cleanup-forbidden`})
    return attachSourceObservationEvidence(jobs, {source, recordKind: 'vacancy-rows', observedRecordCount: observed,
      observedVacancyCount: observed, sourceScopeComplete: false})
  }}
}
