import { gunzipSync } from 'node:zlib'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { createPublicIO, sha256 } from '../../scraper-support/native-sources/publicIO.js'
import { readJobPosting, originalLinks, nodeText, plainHTML, normalizeText, geography, unknownGeography, nativeFields, appliesToIndia } from '../../scraper-support/native-sources/jobPostingData.js'
import { readSmartCollection, reconcileSmartObservations } from '../../scraper-support/native-sources/smartData.js'
import { readNativeRSS } from './literalRSS.js'
import { RGBSI_CATALOG as catalog, BOARD_URL, LISTING_API_URL } from './catalog.js'

const allowed = url => ['www.rgbsi.com', 'rgbsi.com', 'www.zobility.com', 'zobility.com'].includes(url.hostname)
  || url.hostname === 'careers.smartrecruiters.com' && /^\/RGBSI(?:\/|$)/.test(url.pathname)
  || url.hostname === 'api.smartrecruiters.com' && /^\/v1\/companies\/RGBSI\/postings(?:\/\d+)?$/.test(url.pathname)
  || url.hostname === 'www2.jobdiva.com' && (url.pathname === '/portal/'
    || /^\/portal\/index_bundle\.js\.gz$/.test(url.pathname)
    || /^\/candidates\/myjobs\/(?:getjobsrssfeed|openjob_outside)\.jsp$/.test(url.pathname))
const linksOf = page => page?.usable && page.originalText ? originalLinks(readNativeDocument(page.originalText), page.url) : []
const rosterKey = fields => JSON.stringify([fields.title, fields.description, fields.pubDate])
const pool = async (items, work) => {
  let next = 0
  await Promise.all(Array.from({ length: Math.min(4, items.length) }, async () => {
    while (next < items.length) { const item = items[next++];await work(item) }
  }))
}
export const runRgbsi = async options => {
  const { signal, onAudit = () => {}, now = () => new Date().toISOString(), maxJobs = null } = options
  signal?.throwIfAborted()
  const io = createPublicIO({ ...options, allowed }), observations = [], contracts = [], rssSnapshots = [], currentCareerLinks = []
  const indexURL = new URL(LISTING_API_URL);indexURL.searchParams.set('limit', '100');indexURL.searchParams.set('offset', '0')
  let openingLegacy = null, closingLegacy = null, careerURL = null, fatal = null
  const safeLinks = page => { try { return linksOf(page) } catch (error) { io.issue('native-HTML-links-unreadable', { url: page?.url, message: error.message });return [] } }
  const inspectRSSRole = async (entry, context, fresh = false) => {
    const fields = entry.fields
    let sourceURL = fields.link || context.portalURL, id = null, model = null, syntax = null, bound = false, geo = unknownGeography(), page = null, redirectURL = null
    let description = null
    const problems = []
    try { if (typeof fields.description === 'string') description = plainHTML(fields.description) || null }
    catch (error) { problems.push('native-RSS-criteria-unreadable');io.issue('native-RSS-criteria-unreadable', { title: fields.title, message: error.message }) }
    try {
      const uri = new URL(fields.link)
      const permittedKeys = new Set(['a', 'from', 'id', 'SearchString', 'StatesString', 't'])
      if (entry.duplicateFields.length || uri.origin !== context.origin || uri.pathname !== '/candidates/myjobs/openjob_outside.jsp'
        || uri.searchParams.get('a') !== context.tenant || !/^\d+$/.test(uri.searchParams.get('id') || '')
        || [...uri.searchParams.keys()].some(key => !permittedKeys.has(key))) throw Error('RSS role link/fields do not reconcile to the real portal')
      id = uri.searchParams.get('id')
      const first = await io.load(uri.href, { fresh })
      if (first?.status >= 300 && first.status < 400 && first.headers.location) {
        const target = new URL(first.headers.location, first.url)
        if (target.origin !== context.origin || target.pathname !== '/portal/' || target.searchParams.get('a') !== context.tenant
          || target.searchParams.get('jobid') !== id || target.hash.split('?')[0] !== '#/jobs/' + id) throw Error('Native job redirect has another identity')
        redirectURL = target.href
        page = await io.follow(target.href, { fresh })
      } else page = first
      if (page?.usable && page.originalText) {
        const parsed = readJobPosting(page.originalText, { rawControls: true })
        model = parsed.candidate?.model ?? null;syntax = parsed.candidate?.syntax ?? null
        const title = normalizeText(model?.title), reference = normalizeText(model?.identifier?.value)
        const employer = normalizeText(model?.hiringOrganization?.name)
        const address = model?.jobLocation?.address
        const nativeHeadline = title + ' (' + reference + ') - ' + normalizeText(address?.addressRegion) + ' - ' + normalizeText(address?.addressLocality)
        bound = Boolean(model && parsed.candidates.length === 1 && title && reference && employer === context.publisher
          && normalizeText(fields.title) === normalizeText(nativeHeadline))
        if (bound) geo = geography(model)
        else problems.push('native-role-title-reference-employer-or-model-unreconciled')
        if (parsed.errors.length) problems.push('native-literal-model-unreadable')
      } else problems.push('native-public-role-metadata-unavailable')
    } catch (error) {
      signal?.throwIfAborted()
      problems.push('native-RSS-role-identity-or-model-unreadable');io.issue('native-RSS-role-unqualified', { title: fields.title, message: error.message })
    }
    // Actual native router contract, real portal parameters and real RSS ID.
    // Keep full timestamp-bearing RSS/redirect URLs separately. No nonce is
    // invented or described as stable, and no publisher canonical tag is claimed.
    const routed = new URL(context.portalURL)
    if (id) routed.hash = '/jobs/' + id
    const applyURL = id && context.routerDeclared ? routed.href : sourceURL
    return { title: bound ? normalizeText(model.title) : normalizeText(fields.title), company: context.publisher, source: catalog.source,
      sourceParentPublisher: 'RGBSI', sourceNativeStaffingDivision: context.publisher === 'Zobility',
      jobId: id, requisitionId: null, sourceUrl: id ? sourceURL : context.portalURL, applyUrl: id ? applyURL : context.portalURL,
      applicationUrlIsGeneric: !id || Boolean(context.routerDeclared), sourceNativePostingIdentityQualified: Boolean(id),
      country: geo.country, city: geo.city, state: geo.state, location: geo.location, locations: geo.locations,
      sourceNativeCountryCodes: geo.countries, sourceCountryScopeUnresolved: !bound || geo.unresolved,
      ...(bound ? nativeFields(model) : { postingDate: null, closingDate: null, employmentType: null, experienceRequired: null }),
      jobDescription: description, sourceDescription: description,
      sourceNativePlatform: 'jobdiva', sourceNativeRSSItem: { ...fields, duplicateFields: entry.duplicateFields, originalXML: entry.originalXML },
      sourceNativeJobPosting: model, sourceNativeModelSyntax: syntax,
      sourceNativeRoleDetail: { bound, url: page?.url ?? null, bodySHA256: page?.bodySHA256 ?? null, issues: problems },
      sourceNativeApplication: { originalRSSURL: sourceURL, originalRedirectURL: redirectURL, originalPortalURL: context.portalURL,
        derivedFromObservedRouter: Boolean(id && context.routerDeclared), routeTemplate: context.routerDeclared ? '/jobs/:jobid' : null,
        boundToRole: bound, activationVerified: false, allControlsQualified: false },
      sourceCompanyScopeUnresolved: !context.publisherQualified || !id, sourceDetailComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false }
  }
  const collectPortal = async (portalLink, { publisherQualified }) => {
    const portal = await io.follow(portalLink.url)
    if (!portal?.usable || !portal.originalText) { io.issue('native-portal-unavailable', { url: portalLink.url });return }
    const portalURL = new URL(portalLink.url);portalURL.hash = ''
    const tenant = portalURL.searchParams.get('a')
    if (!tenant) { io.issue('native-portal-tenant-unavailable');return }
    const literals = [...portal.originalText.matchAll(/["'](\/portal\/index_bundle\.js\.gz\?[^"'\r\n]+)["']/g)].map(match => match[1])
    const unique = [...new Set(literals)]
    if (unique.length !== 1) { io.issue('native-portal-script-contract-unqualified');return }
    const script = await io.load(new URL(unique[0], portal.url).href)
    if (!script?.usable || !script.bodyBase64) { io.issue('native-portal-script-data-unavailable');return }
    let decoded, maximum, rssPath, routerDeclared
    try {
      const bytes = Buffer.from(script.bodyBase64, 'base64')
      decoded = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes, { maxOutputLength: 16 * 1024 * 1024 }) : bytes
      const text = decoded.toString('utf8')
      if (!Buffer.from(text, 'utf8').equals(decoded)) throw Error('Native script data is not UTF8')
      const marker = '/candidates/myjobs/getjobsrssfeed.jsp?a=', offset = text.indexOf(marker)
      if (offset < 0 || text.indexOf(marker, offset + 1) >= 0 || !text.includes('&versionid=2')) throw Error('Native RSS template changed')
      const counts = text.slice(Math.max(0, offset - 3500), offset).match(/counts:\[([\d,]+)\]/)?.[1]?.split(',').map(Number)
      if (!counts?.length || counts.some(value => !Number.isSafeInteger(value) || value < 1)) throw Error('Native UI count options missing')
      maximum = Math.max(...counts);rssPath = marker.split('?')[0];routerDeclared = text.includes('"/jobs/:jobid"')
      contracts.push({ portalURL: portalLink.url, scriptURL: script.url, originalScriptBodySHA256: script.bodySHA256,
        decodedDataSHA256: sha256(decoded), decodedBytes: decoded.length, originalRSSPathLiteral: marker,
        declaredUIRequestedCounts: counts, requestedMaximum: maximum, websiteJavaScriptExecuted: false, routerDeclared })
    } catch (error) { io.issue('native-portal-literal-contract-unreadable', { message: error.message });return }
    const rssURL = new URL(rssPath, portal.url)
    rssURL.searchParams.set('a', tenant)
    for (const [key, value] of [['noofjobs', String(maximum)], ['country', ''], ['states', ''], ['zip', ''], ['miles', ''], ['postype', ''], ['divisions', ''], ['SearchString', ''], ['versionid', '2']]) rssURL.searchParams.set(key, value)
    const readRSS = async phase => {
      const page = await io.load(rssURL.href, { fresh: true })
      try {
        if (!page?.usable || !page.originalText) throw Error('Original RSS response unavailable')
        const data = readNativeRSS(page.originalText), title = normalizeText(data.channel.fields.title)
        const publisher = title === 'Zobility Jobs' ? 'Zobility' : title === 'RGBSI Jobs' ? 'RGBSI' : null
        const channelURL = new URL(data.channel.fields.link)
        if (!publisher || data.channel.duplicateFields.length || channelURL.origin !== portalURL.origin || channelURL.searchParams.get('a') !== tenant) throw Error('Native RSS publisher/tenant changed')
        const snapshot = { phase, sourceURL: rssURL.href, bodySHA256: page.bodySHA256, originalChannel: data.channel,
          items: data.items, observedItems: data.items.length, requestedMaximum: maximum, authoritativeTotal: null,
          completeInventory: false, countryFacetQualified: false }
        rssSnapshots.push(snapshot)
        return { ...data, publisher }
      } catch (error) { io.issue('native-RSS-unreadable-or-unbound', { phase, message: error.message });return null }
    }
    const opening = await readRSS('opening')
    if (!opening) return
    const context = { portalURL: portalURL.href, origin: portalURL.origin, tenant, publisher: opening.publisher,
      publisherQualified: opening.publisher === 'RGBSI' || publisherQualified, routerDeclared }
    const records = new Map(), results = new Map()
    for (const entry of opening.items) {
      let key
      try { key = new URL(entry.fields.link).searchParams.get('id') } catch {}
      if (!key || records.has(key)) { io.issue('native-RSS-duplicate-or-missing-ID', { id: key ?? null });continue }
      records.set(key, entry)
    }
    await pool([...records], async ([id, entry]) => { results.set(id, await inspectRSSRole(entry, context)) })
    const closing = await readRSS('closing')
    if (closing) {
      const changed = []
      for (const entry of closing.items) {
        let id
        try { id = new URL(entry.fields.link).searchParams.get('id') } catch {}
        if (!id) { io.issue('native-closing-RSS-ID-unqualified');continue }
        const previous = records.get(id)
        if (!previous || rosterKey(previous.fields) !== rosterKey(entry.fields)) changed.push([id, entry])
        records.set(id, entry)
      }
      if (changed.length || closing.items.length !== opening.items.length) io.issue('native-RSS-opening-closing-core-differ', { changedIDs: changed.map(([id]) => id) })
      await pool(changed, async ([id, entry]) => { results.set(id, await inspectRSSRole(entry, context, true)) })
    }
    observations.push(...[...records.keys()].map(id => results.get(id)).filter(Boolean))
  }
  try {
    const board = await io.follow(BOARD_URL)
    if (!board?.usable || !/RGBSI/i.test(plainHTML(board.originalText || ''))) io.issue('legacy-branded-board-unavailable')
    openingLegacy = await readSmartCollection(io, indexURL.href)
    const legacyContext = { companyID: 'RGBSI', companyName: 'RGBSI', source: catalog.source, boardURL: BOARD_URL }
    await reconcileSmartObservations(io, openingLegacy, observations, legacyContext)
    const home = await io.follow(catalog.homepageUrl), homeLinks = safeLinks(home)
    const career = homeLinks.find(link => ['rgbsi.com', 'www.rgbsi.com'].includes(new URL(link.url).hostname) && new URL(link.url).pathname === '/careers/')
    if (career) {
      careerURL = career.url
      const careers = await io.follow(careerURL), careerLinks = safeLinks(careers)
      currentCareerLinks.push(...careerLinks)
      const text = careers?.usable ? plainHTML(careers.originalText || '') : ''
      const divisionDeclared = /Zobility is now RGBSI[’']s staffing division/.test(text)
      const related = careerLinks.find(link => new URL(link.url).hostname === 'www.zobility.com' && /^\/careers\/?$/.test(new URL(link.url).pathname))
      if (related) {
        const relatedPage = await io.follow(related.url)
        currentCareerLinks.push(...safeLinks(relatedPage))
      }
      const portals = [...new Map(currentCareerLinks.filter(link => new URL(link.url).hostname === 'www2.jobdiva.com'
        && new URL(link.url).pathname === '/portal/' && new URL(link.url).searchParams.get('a')).map(link => [new URL(link.url).searchParams.get('a'), link])).values()]
      for (const portal of portals) await collectPortal(portal, { publisherQualified: divisionDeclared })
      closingLegacy = await readSmartCollection(io, indexURL.href, { fresh: true })
      if (JSON.stringify(openingLegacy.records) !== JSON.stringify(closingLegacy.records)) io.issue('legacy-native-opening-closing-differ')
      await reconcileSmartObservations(io, closingLegacy, observations, legacyContext, { fresh: true })
      await io.follow(careerURL, { fresh: true });await io.follow(BOARD_URL, { fresh: true })
    } else io.issue('current-official-careers-channel-unavailable')
  } catch (error) { signal?.throwIfAborted();fatal = error }
  const audit = { source: catalog.source, observations, rawPages: io.rawPages, issues: io.issues, currentCareerLinks,
    openingLegacy, closingLegacy, nativeRSSSnapshots: rssSnapshots, derivedNativePublicContracts: contracts,
    authoritativeSourceTotal: null, authoritativeIndiaFacetCount: null, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
    qualification: 'Native current staffing/legacy observations. Zobility remains the literal hiring brand, not an assertion of RGBSI/client employment. RSS requested cap is not a total. Nonstandard original literal model syntax remains explicitly visible; no native bytes or JSON-LD validity are rewritten.' }
  await onAudit(structuredClone(audit));signal?.throwIfAborted()
  if (fatal) throw fatal
  const selected = observations.filter(job => !job.sourceCompanyScopeUnresolved && appliesToIndia(job))
  const count = Number.isSafeInteger(maxJobs) && maxJobs >= 0 ? maxJobs : null
  const jobs = (count == null ? selected : selected.slice(0, count)).map(job => ({ ...job, link: job.applyUrl, scrapedAt: now() }))
  Object.defineProperty(jobs, 'sourceAudit', { value: audit })
  return attachInventoryEvidence(jobs, { status: 'discovery-only', surface: careerURL || BOARD_URL, firstParty: io.rawPages.some(page => page.transportQualified),
    listingComplete: false, pagesFetched: io.rawPages.filter(page => page.usable).length, reportedTotal: null, indiaFacetCount: null,
    verifiedAt: now(), reason: 'current-native-criteria-and-literal-country-fields-retained-requested-cap-and-source-application-scope-unqualified' })
}
