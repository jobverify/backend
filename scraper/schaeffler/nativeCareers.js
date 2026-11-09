import { document } from './nativeHtml.js'
import { nativeUTCDate, readApply, placeholder, readSearchConfiguration } from './nativeData.js'
import { createPublicIO } from '../../scraper-support/native-sources/publicIO.js'
import { countryName } from '../../scraper-support/native-sources/jobPostingData.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

export const HOME = 'https://jobs.schaeffler.com/search/?createNewAlert=false&q=&locationsearch=India&locale=en_US'
const origin = 'https://jobs.schaeffler.com', category = '/search/'
const requireNative = (condition, message) => { if (!condition) throw Error(message) }
const roleId = value => {
  try {
    const url = new URL(value)
    return url.origin === origin && !url.username && !url.password && !url.search && !url.hash
      ? /^\/job\/[^/]+\/([1-9]\d*)\/$/.exec(url.pathname)?.[1] ?? null : null
  } catch { return null }
}
const searchScriptPath = '/platform/js/j2w/min/j2w.searchResults.min.js'
const searchScriptSHA256 = '3f866be28d14d1b31eb3420fae10074d99f5de8c5d398f40d94cece392985569'
const allowed = url => url.origin === origin && (roleId(url.href) || url.pathname === category
  || url.pathname === '/tile-search-results/' || url.pathname === searchScriptPath)
const listing = page => {
  requireNative(page?.usable && page.originalText, 'Native search response unavailable')
  const doc = document(page.originalText), rows = [], pages = [], totals = [], tileCache = new Map()
  const beneath = (node, parent) => { for (let at = node; at; at = at.parent) if (at === parent) return true;return false }
  const tileData = tile => {
    if (!tile) return { originalTileHTML: null, originalTileFields: [], originalTileAttributes: null, tileURL: null, tileAmbiguous: false }
    if (tileCache.has(tile)) return tileCache.get(tile)
    const originalTileFields = doc.nodes(node => doc.hasClass(node, 'section-field') && beneath(node, tile)).map(node => {
      const labels = doc.nodes(child => doc.hasClass(child, 'section-label') && beneath(child, node))
      const values = node.attrs.id ? doc.nodes(child => child.attrs.id === node.attrs.id + '-value' && beneath(child, node)) : []
      const match = /^job-(\d+)-(?:desktop|mobile)-section-(.+)$/.exec(node.attrs.id || '')
      return { name: match?.[2] ?? null, rolePublicPostingId: match?.[1] ?? null,
        label: labels.length === 1 ? doc.text(labels[0]) : null, value: values.length === 1 ? doc.text(values[0]) : null,
        originalText: doc.text(node), attrs: { ...node.attrs }, originalHTML: doc.original(node),
        qualified: labels.length === 1 && values.length === 1 && !node.duplicateAttributes.length && !values[0].duplicateAttributes.length }
    })
    let tileURL = null
    try { tileURL = new URL(tile.attrs['data-url'], page.url).href } catch { /* original attribute remains retained */ }
    const result = { originalTileHTML: doc.original(tile), originalTileFields, originalTileAttributes: { ...tile.attrs },
      tileURL, tileAmbiguous: tile.duplicateAttributes.length > 0 }
    tileCache.set(tile, result);return result
  }
  for (const anchor of doc.nodes(node => node.tag === 'a' && doc.hasClass(node, 'jobTitle-link'))) {
    try {
      const url = new URL(anchor.attrs.href, page.url).href, id = roleId(url)
      if (!id) continue
      let tile = anchor.parent
      while (tile && !(tile.tag === 'li' && doc.hasClass(tile, 'job-tile'))) tile = tile.parent
      const original = tileData(tile)
      rows.push({ id, url, title: doc.text(anchor), attrs: { ...anchor.attrs }, duplicateAttributes: anchor.duplicateAttributes,
        ...original, listingURL: page.url, listingBodySHA256: page.bodySHA256,
        originalAnchorHTML: doc.original(anchor), discoveryKind: 'native-title-anchor', ambiguous: original.tileAmbiguous || anchor.duplicateAttributes.length > 0
          || Boolean(original.tileURL && original.tileURL !== url) })
    } catch { /* malformed original links remain in the whole retained response */ }
  }
  // The native card's data-url is also a published role navigation target.
  // Read it even when a title anchor is absent or contradicts the card target.
  for (const tile of doc.nodes(node => node.tag === 'li' && doc.hasClass(node, 'job-tile'))) {
    const original = tileData(tile), id = roleId(original.tileURL)
    if (!id) continue
    const titles = [...new Set(doc.nodes(node => doc.hasClass(node, 'section-title') && doc.hasClass(node, 'title')
      && beneath(node, tile)).map(doc.text))]
    const tileIds = (tile.attrs.class || '').split(/\s+/).flatMap(value => /^job-id-(\d+)$/.exec(value)?.[1] || [])
    rows.push({ id, url: original.tileURL, title: titles[0] || '', attrs: { ...tile.attrs }, duplicateAttributes: tile.duplicateAttributes,
      ...original, listingURL: page.url, listingBodySHA256: page.bodySHA256, originalAnchorHTML: null,
      discoveryKind: 'native-tile-data-url', ambiguous: original.tileAmbiguous || titles.length !== 1
        || tileIds.length !== 1 || tileIds[0] !== id })
  }
  for (const node of doc.nodes(node => node.tag === 'a' && /^(?:Page \d+|First Page|Last Page|Next Page|Previous Page)$/.test(node.attrs.title || ''))) {
    try {
      let parent = node.parent
      while (parent && !doc.hasClass(parent, 'pagination')) parent = parent.parent
      if (!parent || node.duplicateAttributes.length) continue
      const url = new URL(node.attrs.href, page.url)
      if (allowed(url) && !roleId(url.href)) pages.push(url.href)
    } catch { /* no guessed offsets or API routes */ }
  }
  for (const node of doc.nodes(node => node.attrs.id === 'tile-search-results-label')) {
    const match = /^Showing\s+\d+\s+to\s+\d+\s+of\s+(\d+)\s+Jobs$/i.exec(doc.text(node))
    if (match) totals.push(Number(match[1]))
  }
  return { rows, pages: [...new Set(pages)], nativeCategoryReportedTotals: [...new Set(totals)],
    originalSearchConfiguration: new URL(page.url).pathname === category ? readSearchConfiguration(doc) : null,
    originalResponseSHA256: page.bodySHA256 }
}
const contexts = (snapshots, io) => {
  const indexed = new Map()
  for (const snapshot of snapshots) for (const row of snapshot.rows) {
    if (!indexed.has(row.id)) indexed.set(row.id, [])
    indexed.get(row.id).push(row)
  }
  return [...indexed].map(([id, rows]) => {
    const identities = [...new Set(rows.map(row => JSON.stringify([row.title, row.url])))]
    const signatures = [...new Set(rows.map(row => JSON.stringify([row.title, row.url,
      row.originalTileFields.map(field => [field.name, field.rolePublicPostingId, field.label, field.value, field.qualified])])))]
    const ambiguous = rows.some(row => row.ambiguous) || identities.length !== 1
    if (ambiguous) io.issue('native-listing-identity-conflict', { id })
    return { id, url: rows[0].url, title: rows[0].title, rows, ambiguous, signature: JSON.stringify(signatures.sort()) }
  })
}

export const runNative = async (options = {}) => {
  const { signal, now = () => new Date().toISOString(), onAudit = () => {}, maxJobs = null } = options
  signal?.throwIfAborted()
  const observedAt = typeof now === 'function' ? now() : now
  requireNative(typeof observedAt === 'string' && Number.isFinite(Date.parse(observedAt)), 'Invalid observation clock')
  const io = createPublicIO({ ...options, allowed }), knownListingURLs = new Set([HOME]), applyCache = new Map()
  const observations = new Map(), known = new Map(), navigationEvidence = []
  const additionalNativePages = async (page, snapshot) => {
    const config = snapshot.originalSearchConfiguration
    if (!config) return []
    if (!config.calls.length) return []
    try {
      requireNative(config.calls.length === 1, 'Multiple qualified native search configurations conflict')
      const call = config.calls[0], values = call.values
      requireNative(page.transportQualified && !call.issues.length, 'Native search configuration unqualified')
      requireNative(values.apiEndpoint === 'tile-search-results' && typeof values.searchQuery === 'string'
        && values.searchQuery.startsWith('?') && Number.isSafeInteger(values.jobRecordsPerPage) && values.jobRecordsPerPage > 0
        && values.jobRecordsPerPage <= 10000 && Number.isSafeInteger(values.jobRecordsFound) && values.jobRecordsFound >= 0,
      'Native search configuration values unsupported')
      if (values.jobRecordsFound <= values.jobRecordsPerPage) return []
      const query = new URLSearchParams(values.searchQuery), own = new URL(page.url)
      requireNative(query.get('q') === own.searchParams.get('q') && query.get('locationsearch') === own.searchParams.get('locationsearch')
        && snapshot.nativeCategoryReportedTotals.length === 1 && snapshot.nativeCategoryReportedTotals[0] === values.jobRecordsFound,
      'Native query or reported count disagrees')
      const declared = config.originalDeclaredScripts.flatMap(script => {
        try { const url = new URL(script.attrs.src, page.url);return url.origin === origin && url.pathname === searchScriptPath ? [url.href] : [] }
        catch { return [] }
      })
      requireNative(new Set(declared).size === 1, 'Native pagination script declaration unavailable or conflicting')
      const script = await io.load(declared[0])
      requireNative(script?.usable && script.transportQualified && script.bodySHA256 === searchScriptSHA256,
        'Native GET pagination script bytes unsupported')
      // The exact captured native script declares GET, endpoint + query and
      // startrow = pageIndex * jobRecordsPerPage. This source uses root search
      // and /job/ routes. No script is evaluated and no offset comes from a guess.
      const urls = []
      for (let offset = values.jobRecordsPerPage; offset < values.jobRecordsFound && urls.length < 100; offset += values.jobRecordsPerPage)
        urls.push(origin + '/' + values.apiEndpoint + '/' + values.searchQuery + '&startrow=' + offset)
      if (urls.length === 100 && values.jobRecordsFound > values.jobRecordsPerPage * 101) io.issue('native-pagination-page-limit')
      navigationEvidence.push({ sourceURL: page.url, sourceBodySHA256: page.bodySHA256, originalConfiguration: call,
        actualDeclaredScript: { url: script.url, bodySHA256: script.bodySHA256 }, method: 'GET', URLsDerivedFromNativeData: urls,
        websiteJavaScriptExecuted: false, authoritativeTotal: null })
      return urls
    } catch (error) { signal?.throwIfAborted();io.issue('native-declared-pagination-unqualified', { url: page.url, message: error.message });return [] }
  }
  const collect = async fresh => {
    const queue = [...knownListingURLs], seen = new Set(), snapshots = []
    while (queue.length) {
      signal?.throwIfAborted()
      const url = queue.shift()
      if (seen.has(url)) continue
      if (seen.size >= 100) { io.issue('native-category-navigation-limit');break }
      seen.add(url);knownListingURLs.add(url)
      const page = await io.load(url, { fresh })
      try {
        const snapshot = { url, ...listing(page) };snapshots.push(snapshot)
        for (const next of snapshot.pages) if (!seen.has(next)) queue.push(next)
        for (const next of await additionalNativePages(page, snapshot)) if (!seen.has(next)) queue.push(next)
      } catch (error) { signal?.throwIfAborted();io.issue('native-category-unqualified', { url, fresh, message: error.message }) }
    }
    return snapshots
  }
  const inspect = async (context, fresh = false) => {
    const page = await io.load(context.url, { fresh }), problems = []
    let properties = [], metas = [], canonicals = [], applications = { calls: [], errors: [] }, originalDescriptionHTML = null
    let bound = false, title = context.title, nativeCompany = null, country = null, city = null, description = null
    let requisitionId = null, requisitionEvidence = null, originalApplyCTAs = []
    let postingDate = null, closingDate = null, department = null, criteriaPlaceholder = false, roleLayout = null
    if (page?.usable && page.originalText) {
      try {
        const doc = document(page.originalText)
        const scopes = doc.nodes(node => node.tag === 'div' && doc.hasClass(node, 'jobDisplayShell')
          && /^https?:\/\/schema\.org\/JobPosting$/.test(node.attrs.itemtype || '') && Object.hasOwn(node.attrs, 'itemscope'))
        const scope = scopes.length === 1 && scopes[0].closed && !scopes[0].duplicateAttributes.length ? scopes[0] : null
        // Membership in the role's own published JobPosting layout is required.
        // Nested unrelated entities cannot lend their fields to this role.
        const roleOwned = node => {
          for (let parent = node; parent; parent = parent.parent) {
            if (parent === scope) return true
            if (Object.hasOwn(parent.attrs, 'itemscope') || parent.attrs.itemtype) return false
          }
          return false
        }
        roleLayout = { qualified: Boolean(scope), candidates: scopes.length, attrs: scope ? { ...scope.attrs } : null,
          originalOpeningTag: scope ? page.originalText.slice(scope.openStart, scope.openEnd) : null }
        const propertyNodes = doc.nodes(node => Object.hasOwn(node.attrs, 'data-careersite-propertyid'))
        properties = propertyNodes.map(node => ({ id: node.attrs['data-careersite-propertyid'], value: doc.text(node),
          attrs: { ...node.attrs }, duplicateAttributes: node.duplicateAttributes, closed: node.closed, roleOwned: roleOwned(node),
          label: node.parent ? node.parent.children.filter(child => typeof child !== 'string' && doc.hasClass(child, 'joblayouttoken-label')).map(doc.text).join(' ') : '',
          originalHTML: doc.original(node), originalInnerHTML: doc.inner(node) }))
        const propertyDOM = new Map(properties.map((field, index) => [field, propertyNodes[index]]))
        metas = doc.nodes(node => node.tag === 'meta' && node.attrs.itemprop).map(node => ({ ...node.attrs, duplicateAttributes: node.duplicateAttributes, roleOwned: roleOwned(node),
          originalHTML: doc.original(node) }))
        canonicals = doc.nodes(node => node.tag === 'link' && (node.attrs.rel || '').split(/\s+/).includes('canonical'))
          .map(node => ({ attrs: { ...node.attrs }, duplicateAttributes: node.duplicateAttributes, originalHTML: doc.original(node) }))
        applications = readApply(doc, applyCache)
        const unique = id => { const rows = properties.filter(field => field.id === id && field.roleOwned);return rows.length === 1 && rows[0].closed && !rows[0].duplicateAttributes.length ? rows[0] : null }
        const meta = name => { const rows = metas.filter(field => field.itemprop === name && field.roleOwned);return rows.length === 1 && !rows[0].duplicateAttributes.length ? rows[0].content : null }
        const descriptionFields = properties.filter(field => field.id === 'description' && field.roleOwned)
        if (descriptionFields.length === 1) originalDescriptionHTML = descriptionFields[0].originalInnerHTML
        const criteria = unique('description')?.value || null
        criteriaPlaceholder = Boolean(criteria && placeholder(criteria))
        const links = doc.nodes(node => node.tag === 'a' && doc.hasClass(node, 'dialogApplyBtn') && roleOwned(node))
        originalApplyCTAs = links.map(node => ({ attrs: { ...node.attrs }, text: doc.text(node), originalHTML: doc.original(node), duplicateAttributes: node.duplicateAttributes }))
        nativeCompany = meta('hiringOrganization')
        const ownTitle = unique('title'), call = applications.calls.length === 1 ? applications.calls[0] : null
        requireNative(scope && !context.ambiguous && page.transportQualified, 'Native role layout, listing or transport identity unqualified')
        requireNative(canonicals.length === 1 && !canonicals[0].duplicateAttributes.length
          && canonicals[0].attrs.href === context.url && roleId(canonicals[0].attrs.href) === context.id, 'Native canonical identity disagreement')
        requireNative(ownTitle?.value && ownTitle.attrs.itemprop === 'title' && ownTitle.value === context.title
          && (() => {
            for (let parent = propertyDOM.get(ownTitle)?.parent; parent && parent !== scope; parent = parent.parent)
              if (parent.tag === 'h1' && roleOwned(parent)) return true
            return false
          })(), 'Native role title disagreement')
        requireNative(nativeCompany === 'Schaeffler', 'Native publisher identity disagreement')
        requireNative(!applications.errors.length && call && !call.issues.length && String(call.fields.jobID) === context.id
          && call.fields.sourceId === 'JATS-schaeffler', 'Native published application identity disagreement')
        bound = true;title = ownTitle.value
        const nativeCountry = unique('country')
        country = nativeCountry ? countryName(nativeCountry.value) : null
        city = country ? unique('city')?.value || null : null
        if (!country) problems.push('Native explicit job country missing, unknown or conflicting')
        department = unique('department')?.value || null
        description = criteria && !criteriaPlaceholder ? criteria : null
        const req = unique('customfield3')
        const listingReqs = context.rows.flatMap(row => row.originalTileFields).filter(field => field.qualified && field.rolePublicPostingId === context.id && /^Requisition ID:?$/i.test(field.label || ''))
        const values = [...new Set(listingReqs.map(field => field.value))]
        const reqQualified = Boolean(req && /^Job Requisition ID:\s*$/i.test(req.label) && /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(req.value)
          && (!values.length || values.length === 1 && values[0] === req.value))
        requisitionId = reqQualified ? req.value : null
        requisitionEvidence = { qualified: reqQualified, originalRoleField: req, originalListingFields: listingReqs }
        if (!reqQualified) problems.push('Native requisition field missing, duplicated or inconsistent')
        postingDate = nativeUTCDate(meta('datePosted'));closingDate = nativeUTCDate(meta('validThrough'))
        if (meta('datePosted') && !postingDate) problems.push('Native posting date is not a qualified explicit UTC date')
        if (meta('validThrough') && !closingDate) problems.push('Native closing date is not a qualified explicit UTC date')
      } catch (error) { signal?.throwIfAborted();problems.push(error.message);io.issue('native-role-unqualified', { id: context.id, message: error.message }) }
    } else problems.push('Native role response unavailable')
    const location = country ? [city, country].filter(Boolean).join(', ') : null
    return { source: 'schaeffler', title, company: nativeCompany, sourceCatalogCompany: 'Schaeffler', jobId: context.id, requisitionId,
      sourceUrl: context.url, applyUrl: context.url, link: context.url, applicationUrlIsGeneric: true,
      country, city, state: null, location, locations: location ? [location] : [], sourceNativeCountryCodes: country ? [country] : [],
      sourceCountryScopeUnresolved: !country, sourceCompanyScopeUnresolved: !bound, sourceNativePostingIdentityQualified: bound,
      jobDescription: description, sourceDescription: description, department, postingDate, closingDate,
      employmentType: null, sourceEmploymentTypeUnresolved: true, remoteStatus: null, sourceRemoteStatusUnresolved: true,
      experienceRequired: null, minimumQualification: null, preferredQualification: null, requiredSkills: [],
      sourceNativePlatform: 'successfactors-rmk-public-native', sourceNativeRequisitionEvidence: requisitionEvidence,
      sourceNativeRole: { projectionKind: 'original-published-HTML-and-microdata-not-a-native-JSON-feed', properties, microdataMetas: metas,
        canonicals, applications, originalDescriptionHTML, roleLayout },
      sourceNativeDiscovery: { originalListingRows: context.rows, conflictingIdentity: context.ambiguous },
      sourceNativeRoleDetail: { bound, url: context.url, bodySHA256: page?.bodySHA256 ?? null, issues: problems },
      sourceNativeCriteria: { unavailable: !description, placeholder: criteriaPlaceholder,
        normalizedTextIncludesMetadataBoilerplate: false },
      sourceNativeAvailability: { held: null, heldStatusFieldObserved: false, deadlinePassed: closingDate ? Date.parse(closingDate) < Date.parse(observedAt) : null,
        activeRecruitmentVerified: false },
      sourceNativeApplication: { originalCalls: applications.calls, originalApplyCTAs, activationVerified: false, allControlsQualified: false, applicantEligibilityQualified: false },
      sourceNativeObservedAt: observedAt, sourceCurrentNativeRoleQualified: bound, sourceDetailComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false }
  }
  const inspectMany = async entries => {
    let next = 0
    await Promise.all(Array.from({ length: Math.min(4, entries.length) }, async () => {
      while (next < entries.length) { const context = entries[next++];observations.set(context.id, await inspect(context));known.set(context.id, context) }
    }))
  }
  const opening = await collect(false)
  await inspectMany(contexts(opening, io))
  const closing = await collect(true)
  const closingContexts = contexts(closing, io), closingIds = new Set(closingContexts.map(row => row.id))
  for (const context of closingContexts) {
    const previous = known.get(context.id), earlier = observations.get(context.id)
    const retryUnavailable = earlier?.sourceNativeRoleDetail.issues.includes('Native role response unavailable')
    if (!previous || previous.signature !== context.signature || previous.ambiguous !== context.ambiguous || retryUnavailable) {
      io.issue('native-closing-new-or-changed-role', { id: context.id })
      const current = await inspect(context, true)
      const snapshot = job => {
        const { sourceNativeObservationHistory, sourceNativeClosingObservation, ...original } = job
        return structuredClone(original)
      }
      const history = [...(earlier ? earlier.sourceNativeObservationHistory || [{ phase: 'opening', observation: snapshot(earlier) }] : []),
        { phase: 'closing', observation: snapshot(current) }]
      // A closing positive is another observation, not permission to overwrite
      // the earlier positive country/title/criteria or withdraw its discovery.
      const retained = earlier?.jobDescription ? { ...earlier, sourceNativeClosingObservation: snapshot(current),
        sourceCurrentNativeRoleQualified: false, sourceNativeTemporalQualification: 'earlier-positive-retained-closing-inspection-has-separate-original-observation' }
        : current
      observations.set(context.id, { ...retained, sourceNativeObservationHistory: history })
      known.set(context.id, context)
    }
  }
  for (const job of observations.values()) if (!closingIds.has(job.jobId)) {
    job.sourceCurrentNativeRoleQualified = false;job.sourceNativeTemporalQualification = 'earlier-positive-retained-closing-category-omission-or-failure'
  }
  const all = [...observations.values()].sort((a, b) => a.jobId.localeCompare(b.jobId))
  const audit = { source: 'schaeffler', observations: all, rawPages: io.rawPages, issues: io.issues, opening, closing, navigationEvidence,
    nativeCategoryReportedTotals: [...new Set([...opening, ...closing].flatMap(snapshot => snapshot.nativeCategoryReportedTotals))],
    authoritativeSourceTotal: null, authoritativeIndiaFacetCount: null, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
    qualification: 'Native search tiles, role HTML, literal application/requisition identity and explicit date observations with unresolved country retained. Whole-company inventory, activation, active recruitment and publication remain unqualified.' }
  await onAudit(structuredClone(audit));signal?.throwIfAborted()
  const eligible = all.filter(job => job.sourceNativeRoleDetail.bound && job.jobDescription
    && (!job.country || job.country === 'India'))
  const jobs = (Number.isSafeInteger(maxJobs) && maxJobs >= 0 ? eligible.slice(0, maxJobs) : eligible).map(job => ({ ...job, scrapedAt: observedAt }))
  Object.defineProperty(jobs, 'sourceAudit', { value: audit })
  return attachInventoryEvidence(jobs, { status: 'discovery-only', surface: HOME, firstParty: io.rawPages.some(page => page.transportQualified),
    pagesFetched: io.rawPages.filter(page => page.usable).length, listingComplete: false, reportedTotal: null, indiaFacetCount: null, verifiedAt: observedAt,
    reason: 'native-tile-role-criteria-requisition-and-UTC-date-observations-country-and-whole-source-scope-unqualified' })
}
