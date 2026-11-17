import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {decodeHTML} from 'entities'
import {readNativeDocument, activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {readOriginalNativeCriteria} from '../../scraper-support/native-sources/currentNativeCriteria20261106.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {buildHttpError} from '../../scraper-support/utils/fetch.js'

const profile = JSON.parse(readFileSync(new URL('./currentNativeProfile20261114.json', import.meta.url), 'utf8'))
const currentProfile = JSON.parse(readFileSync(new URL('./currentNativeProfile20261116.json', import.meta.url), 'utf8'))
const currentCorporateEntities = JSON.parse(readFileSync(new URL('./currentCorporate20261116.json', import.meta.url), 'utf8')).originalEntities
const sha = value => createHash('sha256').update(value).digest('hex')
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)
export const DRIP_NATIVE_LIMITS = Object.freeze({maxRequests: 16, maxPages: 6, maxDetails: 10,
  sourceTimeoutMs: 45000, requestTimeoutMs: 15000, maxEntityBytes: 4000000, maxAggregateBytes: 24000000})
const failure = message => Object.assign(new Error('Drip Capital native text coverage gap: ' + message), {
  name: 'DripCapitalNativeCoverageError', softFailure: true, failureKind: 'coverage_gap',
  sourceScopeComplete: false, lifecycleCleanupAllowed: false,
})
const need = (condition, message) => { if (!condition) throw failure(message) }
const one = (rows, name) => { need(rows.length === 1, 'Missing or ambiguous ' + name); return rows[0] }
const allNodes = node => [node, ...node.children.filter(child => typeof child !== 'string').flatMap(allNodes)]
const authoredFormText = node => node.tag === 'script' ? '' : node.children.map(child => typeof child === 'string' ? decodeHTML(child) : authoredFormText(child)).join(' ').replace(/\s+/g, ' ').trim()
const utf8 = raw => {
  need(!(raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf), 'Unreviewed original UTF8 BOM')
  try { return new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(raw) }
  catch { throw failure('Invalid original UTF8 entity') }
}

// Admit the ORIGINAL entity bytes. Ordered immutable segments include every
// owner, attribute, program, style, form, question and criteria byte. Only the
// exact reviewed data slots between those segments can vary; no HTML, script,
// BOM, encoding or text normalization participates in this admission.
const admitEntity = (raw, contract) => {
  if (!contract.segments) {
    need([contract, ...(contract === profile.corporate ? currentCorporateEntities : [])].some(entity => raw.length === entity.originalEntityBytes && sha(raw) === entity.originalEntitySHA256), 'Unreviewed complete corporate entity')
    return utf8(raw)
  }
  let cursor = 0
  const csrf = []
  for (let index = 0; index < contract.segments.length; index++) {
    const segment = contract.segments[index]
    need(cursor + segment.bytes <= raw.length && sha(raw.subarray(cursor, cursor + segment.bytes)) === segment.sha256,
      'Unreviewed immutable original document segment')
    cursor += segment.bytes
    const slot = contract.slots[index]
    if (!slot) continue
    if (slot.kind === 'public-hidden-csrf') {
      const value = raw.subarray(cursor, cursor + slot.bytes)
      need(value.length === 64 && [...value].every(byte => byte >= 48 && byte <= 57 || byte >= 65 && byte <= 90 || byte >= 97 && byte <= 122),
        'Changed public hidden-input data slot')
      csrf.push(value); cursor += slot.bytes
    } else {
      need(slot.kind === 'newrelic-application-time', 'Unreviewed native data slot')
      let length = 0
      while (length <= slot.maximumBytes && raw[cursor + length] >= 48 && raw[cursor + length] <= 57) length++
      need(length > 0 && length <= slot.maximumBytes, 'Changed native telemetry integer slot')
      const value = raw.subarray(cursor, cursor + length).toString('ascii')
      need(/^(?:0|[1-9]\d*)$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) >= slot.minimum && Number(value) <= slot.maximum,
        'Changed native telemetry integer range')
      cursor += length
    }
  }
  need(cursor === raw.length && csrf.length === contract.publicHiddenCSRFCount
    && (!contract.publicHiddenCSRFValuesEqual || csrf.every(value => value.equals(csrf[0]))), 'Changed original document data ownership or cardinality')
  const html = utf8(raw), prefix = 'window.NREUM||(NREUM={});NREUM.info=', start = html.indexOf(prefix), end = html.indexOf('</script>', start)
  need(start >= 0 && html.indexOf(prefix, start + 1) === -1 && end > start, 'Changed complete native telemetry declaration')
  const data = JSON.parse(html.slice(start + prefix.length, end))
  need(same(Object.keys(data), contract.newRelicJSONKeys), 'Changed native telemetry keys')
  delete data.applicationTime
  need(sha(JSON.stringify(data)) === contract.immutableNewRelicSiblingsSHA256, 'Changed native telemetry siblings')
  return html
}
const document = html => {
  const doc = readNativeDocument(html), root = one(doc.nodes(node => node.tag === 'root'), 'native root')
  return {doc, root, text: doc.text(root)}
}
const unavailable = text => /\b(?:this|the) (?:job|role|position|vacancy) (?:is|was|has been) (?:(?:now|currently|already) )?(?:closed|filled|expired|unavailable|on hold)\b|\b(?:we are |we're |is |are )?no longer accepting applications\b/i.test(text)
const corporateDeclaration = html => {
  const {doc} = document(html)
  const link = one(doc.nodes(node => node.tag === 'a' && doc.text(node) === 'View Jobs'), 'active corporate View Jobs declaration')
  need(link.attrs.href === profile.declaredViewJobsURL, 'Changed corporate native handoff')
  return link.attrs.href
}
const boardRecords = (html, selectedProfile = profile) => {
  const {doc, text} = document(html)
  need(same(activeHead(html).titles, ['Drip Capital jobs | Drip Capital openings | Drip Capital careers']), 'Changed native board publisher title')
  need(doc.text(one(doc.nodes(node => node.tag === 'h1' && doc.text(node) === 'Jobs at Drip Capital'), 'native employer heading')) === 'Jobs at Drip Capital', 'Changed native board employer')
  need(doc.nodes(node => node.tag === 'a' && node.attrs.href === 'https://www.dripcapital.com').length > 0, 'Missing reciprocal corporate ownership')
  const cards = doc.nodes(node => node.tag === 'a' && /^\/jobs\/[a-z0-9]+\/$/.test(node.attrs.href ?? '')).map(node => ({
    url: new URL(node.attrs.href, profile.boardURL).href, href: node.attrs.href,
    title: doc.text(one(doc.nodes(child => /^h[1-6]$/.test(child.tag), node), 'native card title')),
    countries: doc.nodes(child => child.tag === 'span' && doc.hasClass(child, 'meta-job-location-country'), node).map(child => doc.text(child)),
    fullCardText: doc.text(node),
  }))
  const advertised = text.match(/View\s+(\d+)\s+Openings/)
  need(advertised && Number(advertised[1]) === cards.length && new Set(cards.map(card => card.href)).size === cards.length, 'Incomplete or duplicate native advertised cohort')
  need(!doc.nodes(node => node.tag === 'a' && (/\bnext\b/i.test(node.attrs.rel ?? '') || /^(?:Next|Next page)$/i.test(doc.text(node)))).length, 'Unreviewed native pagination')
  need(same(cards, selectedProfile.advertisedCards), 'Changed native card identity, country or inventory')
  return cards
}
const detailRecord = (entity, expected) => {
  const html = admitEntity(entity.raw, expected), {doc, root, text} = document(html)
  need(!unavailable(text), 'Native role explicitly unavailable')
  need(same(activeHead(html).titles, [expected.title + ' at Drip Capital']), 'Changed native detail employer/title')
  const title = doc.text(one(doc.nodes(node => node.tag === 'div' && doc.hasClass(node, 'js-job-title')), 'native role title'))
  const country = doc.text(one(doc.nodes(node => node.tag === 'span' && doc.hasClass(node, 'meta-job-location-country')), 'native role country'))
  need(title === expected.title && country === 'India', 'Native detail identity/country contradiction')
  need(!doc.nodes(node => node.tag === 'time' || node.tag === 'meta' && /date|posted|valid|expir/i.test(node.attrs.itemprop ?? node.attrs.property ?? '')
    || node.tag === 'script' && /json/i.test(node.attrs.type ?? '')).length, 'New native date or alternate criterion carrier requires review')
  const owner = one(doc.nodes(node => node.tag === 'div' && doc.hasClass(node, 'jobdesciption')), 'native original criteria owner')
  const marker = Buffer.from('<div class="jobdesciption">'), at = entity.raw.indexOf(marker)
  need(at >= 0 && entity.raw.indexOf(marker, at + 1) === -1, 'Ambiguous original native criteria bytes')
  const original = entity.raw.subarray(at, at + expected.criteriaHTMLBytes)
  need(sha(original) === expected.criteriaHTMLSHA256, 'Changed complete original native criteria')
  const criteria = readOriginalNativeCriteria(utf8(original), failure)
  need(criteria.sourceDetailComplete && doc.text(owner) === document(criteria.sourceDescriptionHTML).text, 'Incomplete original native text criteria')
  const forms = allNodes(root).filter(node => node.tag === 'form').map(node => ({attributes: node.attrs,
    originalAuthoredText: authoredFormText(node),nativeReaderInert: Boolean(node.inert)}))
  need(forms.length === 2 && forms.every(form => form.attributes.method === 'post' && form.attributes.action === '/jobs/' + expected.id), 'Changed same-role native application binding')
  const city = doc.text(one(doc.nodes(node => node.tag === 'span' && doc.hasClass(node, 'meta-job-location-city')), 'native city'))
  const state = doc.text(one(doc.nodes(node => node.tag === 'span' && doc.hasClass(node, 'meta-job-location-state')), 'native state'))
  return {id: expected.id, url: expected.url, title, country, city, state, criteria, forms,
    rawEntitySHA256: entity.sha256, fullNativeHTML: html, fullNativeText: doc.text(root),
    publicationDate: null, closingDate: null, originalCriteriaHTMLSHA256: sha(original)}
}
const waitWithSignal = (promise, signal) => new Promise((resolve, reject) => {
  const aborted = () => { cleanup(); reject(signal.reason) }
  const cleanup = () => signal.removeEventListener('abort', aborted)
  // Observe an already-started transport even when it synchronously aborts.
  // Otherwise its concurrent rejection would become an orphaned promise.
  Promise.resolve(promise).then(value => {
    cleanup()
    if (signal.aborted) {
      if (typeof value?.body?.cancel === 'function') Promise.resolve(value.body.cancel()).catch(() => {})
      reject(signal.reason)
    } else resolve(value)
  }, error => { cleanup(); reject(error) })
  if (signal.aborted) aborted()
  else signal.addEventListener('abort', aborted, {once: true})
})
const limitsFor = options => Object.fromEntries(Object.entries(DRIP_NATIVE_LIMITS).map(([key, cap]) => {
  const value = options[key] ?? cap
  need(Number.isSafeInteger(value) && value > 0, 'Invalid acquisition budget ' + key)
  return [key, Math.min(value, cap)]
}))

export const createNativeDripCapitalScraper = (defaults = {}) => ({
  async run(supplied = {}) {
    const options = {...defaults, ...supplied}, caller = options.signal
    caller?.throwIfAborted()
    const limits = limitsFor(options), startedAt = new Date().toISOString(), sourceSignal = AbortSignal.timeout(limits.sourceTimeoutMs)
    const source = caller ? AbortSignal.any([caller, sourceSignal]) : sourceSignal
    const fetchImpl = options.fetchImpl ?? options.fetchPage ?? globalThis.fetch
    need(typeof fetchImpl === 'function', 'Missing full-response native transport')
    const audit = {source: 'dripcapital', recordKind: 'vacancy-rows', observedRecordCount: 0, observedVacancyCount: 0,
      sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null, lifecycleCleanupAllowed: false,
      scope: 'Complete finite reviewed server-delivered native text only; rendered/client/CSS/application qualification unverified.',
      sourceActivationComplete: false, sourceRenderedCriteriaComplete: false, sourceApplicationQualificationComplete: false,
      limits, startedAt, receipts: [], openingRecords: [], closingRecords: [], openingCards: [], closingCards: [],
      explicitOutOfCountryRecords: [], discoveryResponses: 0, detailResponses: 0, aggregateEntityBytes: 0,
      wholeCompanyInventoryComplete: false, closingInventoryEqual: false, closingCorporateHandoffEqual: false}
    const read = async (url, kind, expectedStatus = 200) => {
      caller?.throwIfAborted(); source.throwIfAborted()
      need(audit.receipts.length < limits.maxRequests, 'Original total read cap reached')
      const detail = kind.startsWith('detail-'), key = detail ? 'detailResponses' : 'discoveryResponses'
      need(audit[key] < (detail ? limits.maxDetails : limits.maxPages), 'Original ' + (detail ? 'detail' : 'discovery') + ' read cap reached')
      audit[key]++
      const budget = AbortSignal.any([source, AbortSignal.timeout(limits.requestTimeoutMs)])
      const receipt = {url, kind, method: 'GET', startedAt: new Date().toISOString()}; audit.receipts.push(receipt)
      let reader, response
      try {
        response = await waitWithSignal(fetchImpl(url, {method: 'GET', redirect: 'manual', credentials: 'omit', signal: budget,
          headers: {Accept: 'text/html', 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify careers inventory check)'}}), budget)
        caller?.throwIfAborted(); budget.throwIfAborted()
        need(typeof response?.arrayBuffer === 'function' && typeof response.headers?.get === 'function'
          && response.url === url && response.redirected !== true && Number.isInteger(response.status), 'A complete original manual HTTP Response is required')
        receipt.status = response.status
        if (response.status !== expectedStatus) throw Object.assign(buildHttpError(response, url), {sourceScopeComplete: false, lifecycleCleanupAllowed: false})
        if (expectedStatus === 301) need(response.headers.get('location') === profile.redirectLocation, 'Changed exact native301 Location')
        const type = response.headers.get('content-type') ?? ''
        need(expectedStatus === 301 ? type === '' : /^text\/html(?:\s*;\s*charset=utf-8)?$/i.test(type), 'Unreviewed original entity content type or encoding')
        const declaredLength = response.headers.get('content-length')
        need(declaredLength === null || /^\d+$/.test(declaredLength) && Number(declaredLength) <= limits.maxEntityBytes, 'Declared original entity exceeds byte cap')
        const chunks = []; let bytes = 0
        if (response.body !== null) {
          need(typeof response.body?.getReader === 'function', 'A bounded original entity stream is required')
          reader = response.body.getReader()
          for (;;) {
            const chunk = await waitWithSignal(reader.read(), budget)
            caller?.throwIfAborted(); budget.throwIfAborted()
            if (chunk.done) break
            need(chunk.value instanceof Uint8Array, 'Invalid original response byte chunk')
            bytes += chunk.value.byteLength; audit.aggregateEntityBytes += chunk.value.byteLength
            need(bytes <= limits.maxEntityBytes && audit.aggregateEntityBytes <= limits.maxAggregateBytes, 'Original entity or aggregate byte cap reached')
            chunks.push(Buffer.from(chunk.value))
          }
        }
        caller?.throwIfAborted(); budget.throwIfAborted()
        const raw = Buffer.concat(chunks, bytes), digest = sha(raw)
        Object.assign(receipt, {bytes, rawEntitySHA256: digest, completedAt: new Date().toISOString(),
          ...(expectedStatus === 301 ? {Location: response.headers.get('location')} : {})})
        if (expectedStatus === 301) need(bytes === 0 && digest === profile.originalEntityProvenance.find(row => row.status === 301).sha256, 'Changed original native redirect entity')
        return {raw, sha256: digest, receipt}
      } finally {
        if (reader) Promise.resolve(reader.cancel()).catch(() => {})
        else if (typeof response?.body?.cancel === 'function') Promise.resolve(response.body.cancel()).catch(() => {})
      }
    }
    try {
      const openingCorporate = await read(profile.corporateURL, 'corporate-opening')
      const declared = corporateDeclaration(admitEntity(openingCorporate.raw, profile.corporate))
      await read(profile.recruiterboxURL, 'redirect-opening', 301)
      const openingBoard = await read(profile.boardURL, 'board-opening')
      let selectedProfile, boardHTML, originalFailure
      for (const candidate of [profile, currentProfile]) {
        try { boardHTML = admitEntity(openingBoard.raw, candidate.board); selectedProfile = candidate; break }
        catch (error) { if (error?.name !== 'DripCapitalNativeCoverageError') throw error; originalFailure ??= error }
      }
      if (!selectedProfile) throw originalFailure
      audit.openingCards = boardRecords(boardHTML, selectedProfile)
      audit.observedRecordCount = audit.openingCards.length; audit.observedVacancyCount = audit.openingCards.length
      audit.explicitOutOfCountryRecords = audit.openingCards.filter(card => !same(card.countries, ['India']))
      const india = audit.openingCards.filter(card => same(card.countries, ['India']))
      need(india.length > 0 && india.length * 2 <= limits.maxDetails && same(india.map(card => card.url), selectedProfile.roles.map(role => role.url)), 'Current India scope cannot be fully paired within original detail cap')
      for (const role of selectedProfile.roles) audit.openingRecords.push(detailRecord(await read(role.url, 'detail-opening'), role))
      for (const role of selectedProfile.roles) {
        const record = detailRecord(await read(role.url, 'detail-closing'), role)
        audit.closingRecords.push(record)
        const opened = audit.openingRecords.find(row => row.id === role.id)
        need(same({...opened, rawEntitySHA256: null, fullNativeHTML: null}, {...record, rawEntitySHA256: null, fullNativeHTML: null}), 'Native identity, country, text, questions or status changed on closing')
      }
      const closingCorporate = await read(profile.corporateURL, 'corporate-closing')
      audit.closingCorporateHandoffEqual = corporateDeclaration(admitEntity(closingCorporate.raw, profile.corporate)) === declared
      need(audit.closingCorporateHandoffEqual, 'Corporate handoff changed on closing')
      await read(profile.recruiterboxURL, 'redirect-closing', 301)
      const closingBoard = await read(profile.boardURL, 'board-closing')
      audit.closingCards = boardRecords(admitEntity(closingBoard.raw, selectedProfile.board), selectedProfile)
      audit.closingInventoryEqual = same(audit.openingCards, audit.closingCards)
      need(audit.closingInventoryEqual, 'Native advertised records changed on closing')
      caller?.throwIfAborted(); source.throwIfAborted()
      const jobs = audit.openingRecords.map(record => ({...record.criteria, source: 'dripcapital', sourceJobId: record.id,
        companyName: 'Drip Capital', company: 'Drip Capital', officialBrandName: 'Drip Capital', companyDomain: 'dripcapital.com',
        title: record.title, jobTitle: record.title, country: record.country, countryCode: 'IN', city: record.city, state: record.state,
        location: [record.city, record.state, record.country].join(', '), jobUrl: record.url, jobLink: record.url, applyUrl: record.url,
        careerPage: profile.corporateURL, atsPlatform: 'trakstar-hire', postedAt: null, postingDate: null, datePosted: null, closingDate: null,
        sourceNativeTextComplete: true, sourcePublicationDateAvailable: false, sourceActivationComplete: false,
        sourceRenderedCriteriaComplete: false, sourceApplicationQualificationComplete: false, sourceListingComplete: false,
        sourceScopeComplete: false, lifecycleCleanupAllowed: false, sourceOriginalEntitySHA256: record.rawEntitySHA256,
        sourceApplicationQuestions: record.forms.map(form => form.originalAuthoredText),
      }))
      need(jobs.length > 0, 'No qualified current native India text; zero inventory is unverified')
      audit.completedAt = new Date().toISOString(); audit.returnedIndiaTextRecords = jobs.length
      attachSourceObservationEvidence(jobs, audit)
      Object.defineProperty(jobs, 'nativeCollectionEvidence', {value: audit, configurable: true})
      attachInventoryEvidence(jobs, {status: 'coverage-gap', surface: profile.corporateURL, firstParty: true,
        listingComplete: false, lifecycleCleanupAllowed: false, pagesFetched: audit.discoveryResponses,
        reportedTotal: null, indiaFacetCount: null, verifiedAt: audit.completedAt,
        reason: `Finite advertised${audit.openingCards.length}native records closed;${jobs.length}India original text pairs; application, external activation and whole-company scope held.`})
      return jobs
    } catch (error) {
      caller?.throwIfAborted()
      audit.completedAt = new Date().toISOString()
      if (error && typeof error === 'object') {
        Object.defineProperty(error, 'nativeCollectionEvidence', {value: audit, configurable: true})
        Object.defineProperty(error, 'recruitmentObservations', {value: audit, configurable: true})
      }
      throw error
    }
  },
})
export const run = options => createNativeDripCapitalScraper().run(options)
