import { createHash } from 'node:crypto'
import { boundedDeclaredPublicGet } from '../../scraper-support/native-sources/boundedDeclaredPublicGet.js'
import { firstPartyFailure } from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import { qualifiedFirstPartyHTML, retained, clean } from '../../scraper-support/native-sources/firstPartyNativeHtml.js'
import { readNativeDocument, decodeNativeEntities, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { nativeCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const SOURCE = 'rapyutarobotics', ROOT = 'https://www.rapyuta-robotics.com/careers/'
const COMPANY = 'Rapyuta Robotics', ACCOUNT = 'rapyuta-robotics'
const ENDPOINT = 'https://www.rapyuta-robotics.com/wp-json/bento-jobs/v1/'
const RENDERER_PATH = '/wp-content/cache/min/1/wp-content/plugins/bento-jobs/assets/bento-jobs.js'
const RENDERER_SHA = '9e413824d553ba3265c5a5bc482b770f4dcf53a84bb69212a61523667251a2cb'
const chrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const sha = value => createHash('sha256').update(value).digest('hex')
const classes = (node, value) => (node.attrs.class || '').split(/\s+/).includes(value)
const originalText = node => ['script', 'style', 'template', 'object', 'iframe', 'noscript'].includes(node.tag) ? ''
  : node.children.map(child => typeof child === 'string' ? decodeNativeEntities(child) : originalText(child)).join(' ')
const failure = message => firstPartyFailure(SOURCE, message, { failureKind: 'coverage_gap', nativeAuthorityFailure: true })
const need = (value, message) => { if (!value) throw failure(message) }
export const hasCurrentRapyutaClient = html => /data-endpoint-job=/.test(html) && /bento-jobs/.test(html)

function inspect(html) {
  const page = qualifiedFirstPartyHTML(html, ROOT, failure)
  need(page.title.includes(COMPANY) && /Careers/i.test(page.title), 'Current publisher identity changed')
  const roots = page.raw.nodes(node => classes(node, 'bj--list') && node.attrs['data-account'] === ACCOUNT)
  need(roots.length === 1, 'Missing or ambiguous current Bento list account')
  const root = roots[0], cfgText = root.attrs['data-cfg'], cfg = JSON.parse(cfgText)
  need(root.attrs['data-endpoint'] === ENDPOINT + 'jobs' && root.attrs['data-endpoint-job'] === ENDPOINT + 'job'
    && cfg.display === 'list' && cfg.details === 'toggle' && cfg.loc_country === true && cfg.loc_region === true
    && cfg.per_page === 0 && Array.isArray(cfg.codes) && cfg.codes.length === 0 && Array.isArray(cfg.meta)
    && cfg.meta.join(',') === 'department,location,employment_type,experience,workplace', 'Current declared endpoint or location projection changed')
  const programs = page.raw.nodes(node => node.tag === 'script' && node.attrs.src && !Object.hasOwn(node.attrs, 'nomodule')
    && /^(?:|module|(?:text|application)\/(?:java|ecma)script)$/i.test(node.attrs.type || '')).map(node => new URL(node.attrs.src, ROOT))
    .filter(url => url.origin === new URL(ROOT).origin && url.pathname === RENDERER_PATH && [...url.searchParams.keys()].every(key => key === 'ver'))
  need(programs.length === 1, 'Current Bento renderer declaration changed')
  const list = retained(root, node => node.tag === 'ul' && classes(node, 'bj-list'))
  need(list.length === 1, 'Missing native full listing')
  const nodes = list[0].children.filter(node => typeof node !== 'string' && node.tag === 'li' && classes(node, 'bj-job'))
  need(nodes.length > 0 && nodes.length <= 500, 'Current listing is missing; empty scope is unqualified')
  const ids = new Set(), rows = nodes.map(node => {
    const id = node.attrs['data-key'], titles = retained(node, child => child.tag === 'a' && classes(child, 'bj-title-link'))
    const meta = retained(node, child => child.tag === 'span' && classes(child, 'bj-meta-item')).map(child => clean(originalText(child)))
    need(/^[A-Z0-9]{6,32}$/.test(id || '') && !ids.has(id) && titles.length === 1 && meta.length >= 2 && meta.length <= cfg.meta.length, 'Native listing identity or fields changed')
    ids.add(id)
    const title = clean(originalText(titles[0])), url = 'https://apply.workable.com/j/' + id
    need(title && titles[0].attrs.href === url, 'Native own role declaration changed')
    // The renderer omits empty optional metadata spans. Read their typed
    // filters rather than shifting every subsequent span into another field.
    const filters = JSON.parse(node.attrs['data-filters'])
    need(filters && typeof filters === 'object' && !Array.isArray(filters)
      && Object.values(filters).every(values => Array.isArray(values) && values.every(value => typeof value === 'string')), 'Native typed filters changed')
    const locations = meta.filter(value => nativeCountryName(value.split(',').at(-1)?.trim()))
    const location = locations.length === 1 ? locations[0] : null
    const country = location ? nativeCountryName(location.split(',').at(-1)?.trim()) : null
    return { id, title, url, location, country, metadata: {
      department: node.attrs['data-dept'], employment_type: filters.employment_type?.join(', '),
      experience: filters.experience?.join(', '), workplace: filters.workplace?.join(', '), originalMetadata: meta,
    }, attributes: { ...node.attrs } }
  })
  return { rows, cfgText, renderer: programs[0].href, html }
}

export async function runCurrentRapyuta(options = {}) {
  options.signal?.throwIfAborted()
  const timeout = options.sourceTimeoutMs ?? 180000
  need(Number.isSafeInteger(timeout) && timeout > 0 && timeout <= 180000, 'Invalid native deadline')
  const signal = AbortSignal.any([AbortSignal.timeout(timeout), ...(options.signal ? [options.signal] : [])])
  const receipts = [], failures = [], fullRoles = [], jobs = []
  const audit = { source: SOURCE, sourceScopeComplete: false, lifecycleCleanupAllowed: false, receipts, failures, fullRoles }
  let requests = 0, aggregate = 0
  const allowed = new Set([ROOT])
  const read = async (url, type, finalURL = url) => {
    signal.throwIfAborted(); need(allowed.has(url) && ++requests <= 100, 'Unbound public read or native request budget')
    const response = await boundedDeclaredPublicGet(url, { signal, fetchImpl: (requested, init) => (options.fetchImpl || globalThis.fetch)(requested,
      { ...init, credentials: 'omit', cache: 'no-store', headers: { ...init.headers, 'User-Agent': chrome } }), overflowError: failure('Native entity exceeds byte limit') })
    const body = Buffer.from(response.bodyBase64, 'base64'); aggregate += body.length
    need(aggregate <= 24e6, 'Native aggregate byte budget exceeded')
    receipts.push({ requestedURL: url, finalURL: response.url, status: response.status, bytes: body.length, sha256: sha(body) })
    if ([301, 302, 307, 308].includes(response.status) && finalURL !== url) {
      need(new URL(response.headers.location, url).href === finalURL, 'Native own role redirect changed')
      allowed.add(finalURL); return read(finalURL, type)
    }
    if (response.status !== 200) throw Object.assign(failure('Native public HTTP ' + response.status), { status: response.status })
    need([url, finalURL].includes(response.url), 'Native response authority changed')
    need((type === 'json' ? /application\/json/i : type === 'js' ? /(?:text|application)\/(?:java|ecma)script/i : /text\/html/i)
      .test(response.headers['content-type'] || ''), 'Native response MIME changed')
    const text = new TextDecoder('utf-8', { fatal: true }).decode(body)
    return { text, url: response.url, value: type === 'json' ? JSON.parse(text) : null }
  }
  const endpoint = (snapshot, kind, extra) => {
    const url = new URL(ENDPOINT + kind)
    url.searchParams.set('account', ACCOUNT); url.searchParams.set('cfg', snapshot.cfgText)
    for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value)
    url.searchParams.set('_', Math.floor(Date.now() / 300000))
    allowed.add(url.href); return url.href
  }
  try {
    const opening = inspect((await read(ROOT, 'html')).text)
    allowed.add(opening.renderer)
    need(sha((await read(opening.renderer, 'js')).text) === RENDERER_SHA, 'Current native Bento renderer profile changed')
    const index = await read(endpoint(opening, 'jobs', { index: '1' }), 'json')
    need(index.value && Object.keys(index.value).length === 1 && index.value.index && typeof index.value.index === 'object'
      && !Array.isArray(index.value.index) && Object.keys(index.value.index).length === opening.rows.length
      && opening.rows.every(row => typeof index.value.index[row.id] === 'string' && index.value.index[row.id].split('\n')[0] === row.title), 'Native index/listing identities changed')
    Object.assign(audit, { originalListings: structuredClone(opening.rows), originalIndex: structuredClone(index.value), originalIndexText: index.text,
      originalPublisherHTML: opening.html, rendererURL: opening.renderer, rendererSHA256: RENDERER_SHA })
    for (const row of opening.rows.filter(row => row.country === 'India')) {
      signal.throwIfAborted()
      try {
        const detailURL = endpoint(opening, 'job', { shortcode: row.id }), detail = await read(detailURL, 'json'), value = detail.value
        const expectedApply = row.url + '/apply'
        need(value?.shortcode === row.id && value.title === row.title && value.url === row.url && value.apply_url === expectedApply
          && typeof value.html === 'string', 'Native role or application identity changed')
        const document = readNativeDocument(value.html), criteria = document.nodes(node => classes(node, 'bj-detail-body'))
        need(document.nodes(node => classes(node, 'bj-detail') && node.attrs['data-key'] === row.id).length === 1 && criteria.length === 1,
          'Native full role criteria owner changed')
        const description = extractActiveDescription(value.html)
        need(description && clean(originalText(criteria[0])).length >= 100
          && !/no longer (?:available|accepting)|position (?:is|has been) filled/i.test(description), 'Native full criteria unavailable or closed')
        need(document.nodes(node => node.tag === 'a' && classes(node, 'bj-apply') && node.attrs.href === expectedApply).length === 1,
          'Native application action unavailable')
        const ownURL = 'https://apply.workable.com/' + ACCOUNT + '/j/' + row.id
        allowed.add(row.url)
        const own = await read(row.url, 'html', ownURL), owned = readNativeDocument(own.text)
        need(owned.nodes(node => node.tag === 'title').length === 1
          && clean(decodeNativeEntities(owned.nodes(node => node.tag === 'title')[0].raw)) === row.title + ' - ' + COMPANY
          && owned.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical' && node.attrs.href === ownURL).length === 1
          && owned.nodes(node => node.tag === 'meta' && node.attrs.name === 'subdomain' && node.attrs.content === ACCOUNT).length === 1,
        'Native own role employer or canonical account changed')
        fullRoles.push({ id: row.id, originalDetail: structuredClone(value), originalDetailText: detail.text, detailURL,
          originalOwnHTML: own.text, ownURL, originalListing: structuredClone(row) })
        jobs.push({ source: SOURCE, company: COMPANY, title: row.title, jobId: row.id, sourceNativeJobId: row.id, requisitionId: null,
          country: 'India', location: row.location, city: row.location.split(',')[0].trim(), sourceUrl: ownURL, applyUrl: expectedApply, link: ownURL,
          department: row.metadata.department || null, employmentType: row.metadata.employment_type || null,
          experienceRequired: row.metadata.experience || null, postingDate: /^\d{4}-\d{2}-\d{2}$/.test(row.attributes['data-date']) ? row.attributes['data-date'] : null,
          jobDescription: description, sourceDescription: description, sourceNativeJobRecord: structuredClone(value),
          sourceDetailComplete: true, sourceDetailStatus: 'complete-current-first-party-native-criteria', sourceListingComplete: false,
          sourceScopeComplete: false, lifecycleCleanupAllowed: false, scrapedAt: typeof options.now === 'function' ? options.now() : new Date().toISOString() })
      } catch (error) { signal.throwIfAborted(); failures.push({ id: row.id, message: error.message, status: error.status }) }
    }
    for (const role of fullRoles) need((await read(endpoint(opening, 'job', { shortcode: role.id }), 'json')).text === role.originalDetailText,
      'Closing native full role criteria changed')
    const closingIndex = await read(endpoint(opening, 'jobs', { index: '1' }), 'json')
    const closing = inspect((await read(ROOT, 'html')).text)
    need(JSON.stringify(closing.rows) === JSON.stringify(opening.rows) && closing.cfgText === opening.cfgText
      && closing.renderer === opening.renderer && closingIndex.text === index.text, 'Closing native listing or publisher changed')
    audit.closingIndex = closingIndex.value; audit.closingPublisherHTML = closing.html
    audit.configuredCollectionReconciled = true
    const limit = options.maxJobs ?? null
    need(limit === null || limit === Infinity || Number.isSafeInteger(limit) && limit >= 0, 'Invalid caller output cap')
    const selected = limit === null || limit === Infinity ? jobs : jobs.slice(0, limit)
    attachSourceObservationEvidence(selected, { source: SOURCE, recordKind: 'vacancy-rows', observedRecordCount: opening.rows.length,
      observedVacancyCount: opening.rows.length, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null })
    Object.defineProperty(selected, 'nativeCollectionEvidence', { value: audit, configurable: true })
    options.signal?.throwIfAborted()
    return attachInventoryEvidence(selected, { status: selected.length ? 'discovery-only' : 'coverage-gap', surface: ROOT, firstParty: true,
      listingComplete: false, lifecycleCleanupAllowed: false, pagesFetched: requests, reportedTotal: opening.rows.length, indiaFacetCount: null,
      verifiedAt: null, reason: 'current-declared-Bento-full-role-criteria-and-native-owner-reconciled;configured-language-view;whole-company-scope-unqualified;cleanup-forbidden' })
  } catch (error) { options.signal?.throwIfAborted(); error.sourceAudit = audit; throw error }
}
