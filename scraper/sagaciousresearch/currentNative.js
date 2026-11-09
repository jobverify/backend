import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { readNativeDocument, decodeNativeEntities } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { classifyScraperError } from '../../scraper-support/utils/failureClassification.js'
const visibility = JSON.parse(fs.readFileSync(new URL('./nativeVisibility20261107.json', import.meta.url)))
export const CAREERS_URL = 'https://sagaciousresearch.com/current-openings'
const HOME = 'https://sagaciousresearch.com/', CAREER_HOME = HOME + 'careers'
const SOURCE = 'sagaciousresearch', COMPANY = 'Sagacious Research', NATIVE_COMPANY = 'Sagacious IP'
const OBSERVATIONS = Symbol.for('jobverify.verified-recruitment-observations')
const sha = value => createHash('sha256').update(value).digest('hex')
const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim()
// Recognize affirmative status clauses. Intervening negation and the distinct
// word "unfilled" cannot satisfy these bounded connectors or word boundaries.
const affirmativeClosure = value => [
  /\bapplication window(?: for (?:this|the) (?:position|role))? (?:has (?:(?:now|already|recently) )?(?:been (?:(?:now|already|recently) )?)?|(?:is|was) (?:(?:now|already|currently|recently) )?)closed\b/i,
  /\b(?:this|the) (?:position|role) (?:has (?:(?:now|already|recently) )?been (?:(?:now|already|recently) )?|(?:is|was) (?:(?:now|already|currently|recently) )?)(?:filled|closed)\b/i,
  /\b(?:this|the) (?:position|role) (?:is|was) (?:(?:now|currently|temporarily) )?on hold\b/i,
  /\bhiring (?:is (?:(?:now|currently|temporarily) )?|has (?:(?:now|already) )?been )paused\b/i,
  /\b(?:we are|this (?:position|role) is) no longer accepting applications\b/i,
  /\bapplications for (?:this|the) (?:position|role) are no longer (?:being )?accepted\b/i,
].some(pattern => pattern.test(clean(decodeNativeEntities(value))))
const need = (ok, message) => { if (!ok) throw Object.assign(new Error('Sagacious official careers surface: ' + message), {
  softFailure: true, upstreamOutage: false, failureKind: 'coverage_gap', abortRetries: true, lifecycleCleanupAllowed: false,
}) }
const one = (values, name) => { need(values.length === 1, 'ambiguous or missing ' + name); return values[0] }
const normalizeURL = value => { const url = new URL(value, HOME); return url.origin + url.pathname.replace(/\/$/, '') }
const noWait = operation => { try { Promise.resolve(operation()).catch(() => {}) } catch {} }
const abortable = (signal, operation, late) => {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    let settled = false
    const abort = () => { if (!settled) { settled = true; signal.removeEventListener('abort', abort); reject(signal.reason) } }
    signal.addEventListener('abort', abort, { once: true })
    Promise.resolve().then(() => { signal.throwIfAborted(); return operation() }).then(value => {
      if (settled || signal.aborted) { if (late) noWait(() => late(value)); abort(); return }
      settled = true; signal.removeEventListener('abort', abort); resolve(value)
    }, error => { if (!settled) { settled = true; signal.removeEventListener('abort', abort); reject(signal.aborted ? signal.reason : error) } })
  })
}
const documentModel = html => {
  const document = readNativeDocument(html), root = document.nodes(() => true)[0], nodes = [], parents = new WeakMap()
  const walk = node => { nodes.push(node); for (const child of node.children) if (typeof child === 'object') { parents.set(child, node); walk(child) } }
  walk(root)
  const modes = node => ['mobile', 'tablet', 'desktop'].filter(mode => {
    for (let current = node; current; current = parents.get(current)) {
      if (current.inert || document.hasClass(current, 'elementor-hidden-' + mode)
        || mode === 'mobile' && document.hasClass(current, 'elementor-hidden-phone')) return false
    }
    return true
  })
  const text = (node, mode) => !node || node.tag === 'script' || node.tag === 'style' || mode && !modes(node).includes(mode) ? ''
    : clean(node.children.map(child => typeof child === 'string' ? decodeNativeEntities(child) : text(child, mode)).join(' '))
  const descendants = (node, predicate) => nodes.filter(item => {
    for (let current = item; current; current = parents.get(current)) if (current === node) return predicate(item)
    return false
  })
  const ancestor = (node, predicate) => { for (let current = node; current; current = parents.get(current)) if (predicate(current)) return current }
  return { document, root, nodes, parents, modes, text, descendants, ancestor }
}
const escapeAttribute = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
const serialize = (node, comparison = false) => '<' + node.tag + Object.entries(node.attrs).filter(([key, value]) =>
  !(comparison && key === 'data-eae-slider' && /^\d+$/.test(value) && (node.attrs.class || '').split(/\s+/).includes('has_eae_slider')))
  .map(([key, value]) => ' ' + key + '="' + escapeAttribute(value) + '"').join('') + '>'
  + (node.raw || node.children.map(child => typeof child === 'string' ? child : serialize(child, comparison)).join(''))
  + (['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'].includes(node.tag) ? '' : '</' + node.tag + '>')
const intersects = (left, right) => left.some(value => right.includes(value))
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)
export const hasOfficialCareersSignal = html => {
  const model = documentModel(String(html ?? ''))
  return ['mobile', 'tablet', 'desktop'].some(mode => /WORK WITH US/i.test(model.text(model.root, mode))
    && /We are looking for exceptional talent/i.test(model.text(model.root, mode))
    && /careers@sagaciousresearch\.com/i.test(model.text(model.root, mode)))
}

export async function runCurrentSagacious(options = {}) {
  options.signal?.throwIfAborted()
  need(!options.fetchText && !options.fetchPage, 'legacy text-only transport cannot establish full native role criteria')
  const signal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(options.sourceTimeoutMs ?? 180000)])
  const now = options.now ? options.now() : new Date().toISOString(), receipts = [], allowed = new Set([HOME, CAREER_HOME, CAREERS_URL])
  const fetchImpl = options.fetchImpl || fetch
  let totalBytes = 0, candidates = [], hiddenListingCards = 0
  const observations = () => ({ source: SOURCE, observedAt: now, requestCount: receipts.length, nativeRecords: candidates.length,
    returnedIndiaJobs: 0, sourceScopeComplete: false, lifecycleCleanupAllowed: false, receipts: [...receipts], failures: [],
    unresolved: ['whole-company-recruitment-scope-unverified'] })
  const read = async initial => {
    let url = initial
    for (let hop = 0; hop < 2; hop++) {
      signal.throwIfAborted(); need(allowed.has(url) && receipts.length < 64, 'undeclared request or native request bound')
      const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(20000)])
      const response = await abortable(requestSignal, () => fetchImpl(url, { method: 'GET', redirect: 'manual', signal: requestSignal,
        headers: { Accept: 'text/html,text/css' } }), response => response?.body?.cancel())
      const reader = response.body?.getReader(); need(reader, 'missing native body stream')
      const chunks = []; let bytes = 0
      try {
        for (;;) {
          const part = await abortable(requestSignal, () => reader.read()); requestSignal.throwIfAborted(); if (part.done) break
          bytes += part.value.byteLength; totalBytes += part.value.byteLength
          need(bytes <= 2000000 && totalBytes <= 24000000, 'native body size bound')
          chunks.push(Buffer.from(part.value))
        }
      } finally { noWait(() => reader.cancel()); try { reader.releaseLock() } catch {} }
      requestSignal.throwIfAborted()
      const body = Buffer.concat(chunks), receipt = { requestedURL: url, method: 'GET', status: response.status, finalURL: response.url,
        bodySHA256: sha(body), bodyBytes: body.length, contentType: response.headers.get('content-type') }
      receipts.push(receipt)
      const location = response.headers.get('location')
      const redirect = response.status === 301 && location && url.endsWith('/') && new URL(location, url).href === url.slice(0, -1)
      if (response.status !== 200 && !redirect) {
        const cause = Object.assign(new Error('HTTP ' + response.status + ' at ' + url), { status: response.status, requestUrl: url })
        const observed = observations()
        observed.receipts = receipts.map(row => ({ ...row, finalURL: (() => { try { const target = new URL(row.finalURL); return target.origin + target.pathname } catch { return null } })(),
          contentType: row.contentType?.split(';')[0] || null }))
        observed.failures = [{ status: response.status, requestUrl: url, stage: 'native-http' }]
        throw Object.assign(new Error('Sagacious native HTTP ' + response.status + ' at ' + url, { cause }), classifyScraperError(cause), {
          status: response.status, abortRetries: true, lifecycleCleanupAllowed: false, recruitmentObservations: observed })
      }
      need(response.url === url, 'native final URL identity changed')
      if (redirect) { url = new URL(location, url).href; allowed.add(url); continue }
      return { url, html: body.toString(), bodySHA256: receipt.bodySHA256 }
    }
    need(false, 'native redirect bound')
  }
  const page = async url => {
    const reply = await read(url), model = documentModel(reply.html), { document } = model
    need(!document.nodes(node => node.tag === 'base').length, 'unreviewed document base')
    need(one(document.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical'), 'native canonical URL').attrs.href
      && normalizeURL(one(document.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical'), 'native canonical URL').attrs.href) === normalizeURL(reply.url), 'native canonical identity changed')
    need(one(document.nodes(node => node.tag === 'meta' && node.attrs.property === 'og:site_name'), 'native employer identity').attrs.content === NATIVE_COMPANY,
      'native employer publisher identity changed')
    const nativePage = one(model.nodes.filter(node => node.attrs['data-elementor-type'] === 'wp-page'), 'own native page')
    const renderDeclarations = Object.entries(visibility.renderScripts).map(([id, script]) => {
      need(one(document.nodes(node => node.tag === 'script' && node.attrs.id === id), 'reviewed render plugin').attrs.src === script.url,
        'render-instance plugin declaration changed')
      return script
    })
    const pageId = nativePage.attrs['data-elementor-id']; need(/^\d+$/.test(pageId), 'native page identity missing')
    const stylesheet = one(document.nodes(node => node.tag === 'link' && node.attrs.rel === 'stylesheet'
      && new URL(node.attrs.href, HOME).pathname === '/wp-content/uploads/elementor/css/post-' + pageId + '.css'), 'native page CSS')
    const cssURL = new URL(stylesheet.attrs.href, HOME)
    need(cssURL.origin === new URL(HOME).origin && !cssURL.username && !cssURL.password && visibility.styles[cssURL.pathname], 'unreviewed page visibility CSS')
    allowed.add(cssURL.href); const css = await read(cssURL.href)
    need(css.bodySHA256 === visibility.styles[cssURL.pathname], 'native page visibility CSS changed')
    return { ...reply, model, nativePage, pageId, renderDeclarations }
  }
  const hasLink = (value, target) => value.model.document.nodes(node => node.tag === 'a' && node.attrs.href
    && normalizeURL(new URL(node.attrs.href, value.url).href) === normalizeURL(target) && value.model.modes(node).length).length > 0
  const publisher = async () => {
    const home = await page(HOME); need(hasLink(home, CAREER_HOME), 'current corporate careers handoff unavailable')
    const careers = await page(CAREER_HOME); need(hasLink(careers, CAREERS_URL), 'current openings handoff unavailable')
    const listing = await page(CAREERS_URL); need(hasOfficialCareersSignal(listing.html), 'current hiring identity changed')
    const frontend = one(listing.model.document.nodes(node => node.tag === 'link' && node.attrs.rel === 'stylesheet'
      && new URL(node.attrs.href, HOME).pathname === '/wp-content/plugins/elementor/assets/css/frontend.min.css'), 'responsive CSS contract')
    allowed.add(frontend.attrs.href); const css = await read(frontend.attrs.href)
    need(css.bodySHA256 === visibility.styles[new URL(frontend.attrs.href).pathname], 'responsive visibility CSS changed')
    for (const script of listing.renderDeclarations) {
      allowed.add(script.url); const plugin = await read(script.url)
      need(plugin.bodySHA256 === script.SHA256, 'reviewed render-instance plugin changed')
    }
    const { model } = listing, cards = [], identities = new Set(); let hidden = 0
    for (const anchor of model.nodes.filter(node => node.tag === 'a' && /Apply Now/i.test(model.text(node)))) {
      const modes = model.modes(anchor), section = model.ancestor(anchor, node => node.tag === 'section')
      need(section, 'unbound native listing card')
      if (!modes.length) { hidden++; continue }
      const headings = model.descendants(section, node => model.document.hasClass(node, 'elementor-heading-title'))
      need(headings.length === 2, 'own listing department/title identity changed')
      const department = model.text(headings[0]), title = model.text(headings[1])
      const fields = model.descendants(section, node => node.tag === 'li').map(node => model.text(node))
      need(fields.length === 3 && /\(\s*India\s*\)$/i.test(fields[0]), 'listing native country or criteria unavailable')
      const target = new URL(anchor.attrs.href, CAREERS_URL)
      need(target.origin === new URL(HOME).origin && !target.search && !target.hash && /^\/careers\/job-opening\/[a-z0-9-]+\/$/.test(target.pathname), 'native listing role URL changed')
      need(!identities.has(target.href), 'duplicate native listing role identity'); identities.add(target.href); allowed.add(target.href)
      cards.push({ title, department, locationText: fields[0], employmentType: fields[1], listingExperience: fields[2], url: target.href, viewports: modes })
    }
    need(cards.length > 0 && cards.length <= 20, 'native listing has no qualified current role contract or exceeds bounds')
    return { cards, hidden, binding: [home.pageId, careers.pageId, listing.pageId] }
  }
  try {
    const opening = await publisher(); candidates = opening.cards; hiddenListingCards = opening.hidden
    const qualify = async card => {
      const detail = await page(card.url), { model, nativePage } = detail
      const modes = card.viewports
      const closed = model.descendants(nativePage, node => node.children.some(child => typeof child === 'string'
        && affirmativeClosure(child)))
        .filter(node => intersects(model.modes(node), modes))
      const columns = model.descendants(nativePage, node => model.document.hasClass(node, 'elementor-column')
        && /(?:Company Overview|About Sagacious IP)/.test(model.text(node)) && /Role Summary/.test(model.text(node))
        && /Desired Educational Qualifications/.test(model.text(node)) && /Compensation/.test(model.text(node)))
      if (closed.length) return { excluded: true, nativePageId: detail.pageId, url: detail.url,
        closedNotice: [...new Set(closed.map(node => model.text(node)))].join('\n'),
        closedNoticeHTML: closed.map(node => serialize(node)).join('\n'),
        hiddenCriteriaAudit: columns.map(node => serialize(node)).join('\n'),
        criteriaAuditComparisonSHA256: sha(columns.map(node => serialize(node, true)).join('\n')), bodySHA256: detail.bodySHA256 }
      const column = one(columns, 'full native role criteria')
      const activeModes = model.modes(column).filter(mode => modes.includes(mode))
      need(activeModes.length > 0, 'full native role criteria are hidden')
      const fullText = model.text(column)
      need(fullText.length > 1000 && activeModes.every(mode => model.text(column, mode) === fullText), 'whole native criteria visibility changed')
      const companyHeading = one(model.descendants(column, node => node.tag === 'div'
        && model.document.hasClass(node, 'elementor-heading-title')
        && /(?:^|[.!?]\s+)Company Overview$/.test(model.text(node))), 'own native role employer Company Overview heading')
      const headingContainer = model.parents.get(companyHeading), headingWidget = model.parents.get(headingContainer)
      const widgetGroup = model.parents.get(headingWidget)
      need(headingContainer?.tag === 'div' && model.document.hasClass(headingContainer, 'elementor-widget-container')
        && headingWidget?.tag === 'div' && headingWidget.attrs['data-widget_type'] === 'heading.default'
        && widgetGroup?.tag === 'div' && model.document.hasClass(widgetGroup, 'elementor-widget-wrap')
        && model.parents.get(widgetGroup) === column, 'own native role employer heading boundary changed')
      const widgets = widgetGroup.children.filter(child => typeof child === 'object')
      const employerWidget = widgets[widgets.indexOf(headingWidget) + 1]
      need(employerWidget?.tag === 'div' && employerWidget.attrs['data-widget_type'] === 'text-editor.default'
        && /^Sagacious IP is\b/.test(model.text(employerWidget)), 'own native role adjacent employer changed')
      const headers = model.descendants(nativePage, node => node.tag === 'section' && model.document.hasClass(node, 'elementor-top-section')
        && intersects(model.modes(node), activeModes)
        && model.descendants(node, child => model.document.hasClass(child, 'elementor-heading-title') && model.text(child) === card.title).length > 0
        && activeModes.some(mode => model.modes(node).includes(mode) && model.text(node, mode).includes(card.title)
          && model.text(node, mode).includes(card.department) && model.text(node, mode).includes(card.locationText)
          && model.text(node, mode).includes(card.employmentType)))
      need(headers.length > 0, 'own full-role location/country/title identity changed')
      const applications = model.descendants(column, node => node.tag === 'a' && /Apply Now/i.test(model.text(node))
        && intersects(model.modes(node), activeModes)).map(node => node.attrs.href)
      const applyURL = one([...new Set(applications)], 'own native application route')
      const target = new URL(applyURL), slug = new URL(card.url).pathname.split('/').filter(Boolean).at(-1)
      need(target.origin === new URL(HOME).origin && !target.search && !target.hash
        && ['/careers/job-opening/', '/careers-/job-opening/'].some(prefix => target.pathname === prefix + slug + '/apply-now/'), 'native role application identity changed')
      const native = { pageId: detail.pageId, title: card.title, department: card.department, locationText: card.locationText,
        employmentType: card.employmentType, nativeEmployer: NATIVE_COMPANY, criteriaHTML: serialize(column), criteriaText: fullText,
        criteriaComparisonSHA256: sha(serialize(column, true)),
        declaredApplyURL: applyURL, postingDate: null, closingDate: null }
      return { native, bodySHA256: detail.bodySHA256 }
    }
    const opened = []
    for (const card of candidates) opened.push(await qualify(card))
    const jobs = [], exclusions = []
    for (let index = 0; index < candidates.length; index++) {
      const current = opened[index], closing = await qualify(candidates[index])
      const comparison = native => native && Object.fromEntries(Object.entries(native).filter(([key]) => key !== 'criteriaHTML'))
      need(current.excluded === closing.excluded && same(comparison(current.native), comparison(closing.native))
        && current.closedNotice === closing.closedNotice && current.closedNoticeHTML === closing.closedNoticeHTML
        && current.criteriaAuditComparisonSHA256 === closing.criteriaAuditComparisonSHA256, 'closing full native role criteria or hold changed')
      if (current.excluded) { exclusions.push({ ...current, closingBodySHA256: closing.bodySHA256,
        closingHiddenCriteriaAudit: closing.hiddenCriteriaAudit, closingClosedNoticeHTML: closing.closedNoticeHTML }); continue }
      const native = current.native, location = native.locationText.replace(/\s*\(\s*India\s*\)\s*$/i, '') + ', India'
      jobs.push({ title: native.title, company: COMPANY, source: SOURCE, department: native.department, location,
        city: location.split(',')[0].trim(), country: 'India', jobId: SOURCE + '-wp-' + native.pageId, requisitionId: null,
        sourceUrl: normalizeURL(candidates[index].url), applyUrl: native.declaredApplyURL, link: native.declaredApplyURL,
        employmentType: native.employmentType, experienceRequired: candidates[index].listingExperience,
        minimumQualification: null, preferredQualification: null, requiredSkills: [], postingDate: null, closingDate: null,
        jobDescription: native.criteriaHTML, sourceDescription: native.criteriaHTML, nativeEmployer: NATIVE_COMPANY,
        nativeSourceRecord: native, nativeClosingSourceRecord: closing.native,
        nativeSourceEvidence: { openingBodySHA256: current.bodySHA256, closingBodySHA256: closing.bodySHA256,
          criteriaEncoding: 'complete-source-DOM-serialization', viewportPolicy: visibility.viewportPolicy,
          criteriaComparison: 'all-DOM-except-reviewed-numeric-background-render-instance-attribute;raw-HTML-retained',
          postingDateUnavailable: true, pageModificationDateNotUsed: true },
        sourceDetailComplete: true, sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false,
        activeApplyVerified: false, applicationVisited: false, scrapedAt: now })
    }
    const closing = await publisher(); need(same(closing, opening), 'closing native listing or corporate binding changed')
    const observed = { ...observations(), returnedIndiaJobs: jobs.length, hiddenListingCards, exclusions }
    Object.defineProperty(jobs, OBSERVATIONS, { value: observed })
    return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: CAREERS_URL, firstParty: true, listingComplete: false,
      pagesFetched: receipts.length, reportedTotal: null, indiaFacetCount: null, verifiedAt: now,
      reason: 'current-declared-visible-roles-and-full-criteria-closing-reconciled;hidden-legacy-and-closed-roles-excluded;whole-company-scope-unverified;cleanup-forbidden' })
  } catch (error) {
    if (signal.aborted) throw signal.reason
    if (error && typeof error === 'object' && !error.recruitmentObservations) error.recruitmentObservations = observations()
    throw error
  }
}
