import { parse } from 'acorn'
import { document, compact } from './nativeHtml.js'
import { createPublicIO } from '../../scraper-support/native-sources/publicIO.js'
import { countryName } from '../../scraper-support/native-sources/jobPostingData.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

export const HOME = 'https://careers.nomura.com/Nomura/go/Career-Opportunities-India/9050900/'
const origin = 'https://careers.nomura.com', category = '/Nomura/go/Career-Opportunities-India/9050900/'
const requireNative = (condition, message) => { if (!condition) throw Error(message) }
const roleId = value => {
  try {
    const url = new URL(value)
    return url.origin === origin && !url.username && !url.password && !url.search && !url.hash
      ? /^\/Nomura\/job\/[^/]+\/([1-9]\d*)\/$/.exec(url.pathname)?.[1] ?? null : null
  } catch { return null }
}
const allowed = url => url.origin === origin && (roleId(url.href) || url.pathname === category || new RegExp('^' + category + '\\d+/$').test(url.pathname))
const nativeUTCDate = value => {
  const match = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{2}) (\d{2}):(\d{2}):(\d{2}) UTC (\d{4})$/.exec(value || '')
  if (!match) return null
  const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(match[2])
  const timestamp = new Date(Date.UTC(Number(match[7]), month, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6])))
  return timestamp.getUTCFullYear() === Number(match[7]) && timestamp.getUTCMonth() === month && timestamp.getUTCDate() === Number(match[3])
    && timestamp.getUTCHours() === Number(match[4]) && timestamp.getUTCMinutes() === Number(match[5]) && timestamp.getUTCSeconds() === Number(match[6])
    && ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][timestamp.getUTCDay()] === match[1] ? timestamp.toISOString() : null
}
const placeholder = value => /^(?:(?:NA|TBD|TBC|TOBEUPDATED|TOBEDETERMINED|LPITOBEONHOLD))+$/.test(value.replace(/[\s/.,:;!_\-–—()]/g, '').toUpperCase())
const heldPlaceholder = value => /^(?:LPITOBEONHOLD)+$/.test(value.replace(/[\s/.,:;!_\-–—()]/g, '').toUpperCase())
const memberPath = node => node?.type === 'Identifier' ? node.name : node?.type === 'MemberExpression'
  ? memberPath(node.object) + '.' + (node.computed ? node.property.type === 'Literal' ? node.property.value : '?' : node.property.name) : ''

// Parse published JavaScript syntax as data. Never execute page code. Strings,
// comments, templates and regex literals cannot supply an application identity.
const readApply = (doc, cache) => {
  const results = [], errors = []
  for (const script of doc.nodes(node => node.tag === 'script' && !node.attrs.src
    && (!node.attrs.type || /^(?:text|application)\/javascript$/i.test(node.attrs.type)))) {
    const raw = script.raw || ''
    if (!/\bj2w\b/.test(raw)) continue
    if (script.duplicateAttributes.length || !script.closed) errors.push('Native init script markup is ambiguous or unterminated')
    let result = cache.get(raw)
    if (!result) {
      result = { calls: [], errors: [] }
      try {
        const ast = parse(raw, { ecmaVersion: 'latest', sourceType: 'script' })
        const visit = (node, parent, grandparent) => {
          if (!node || typeof node !== 'object') return
          if (node.type === 'CallExpression' && memberPath(node.callee) === 'j2w.Apply.init') {
            const object = node.arguments.length === 1 ? node.arguments[0] : null
            const fields = [], originals = [], seen = new Set(), issues = []
            if (parent?.type !== 'ExpressionStatement' || grandparent?.type !== 'Program')
              issues.push('Native init call is not a direct top-level published expression')
            if (object?.type !== 'ObjectExpression') issues.push('Native init argument is not an object literal')
            else for (const property of object.properties) {
              const key = !property.computed && property.key?.type === 'Identifier' ? property.key.name
                : property.key?.type === 'Literal' ? String(property.key.value) : null
              originals.push(raw.slice(property.start, property.end))
              if (property.type !== 'Property' || !key || property.kind !== 'init' || property.method || seen.has(key)) issues.push('Duplicate or nonliteral native init property')
              if (key) seen.add(key)
              if (key && property.value?.type === 'Literal') fields.push([key, property.value.value])
              else if (['jobID', 'sourceId'].includes(key)) issues.push('Native identity is not a literal')
            }
            result.calls.push({ fields: Object.fromEntries(fields), originalCall: raw.slice(node.start, node.end),
              originalObjectLiteral: object ? raw.slice(object.start, object.end) : null, originalProperties: originals, issues })
          }
          if (node.type === 'AssignmentExpression' && memberPath(node.left).startsWith('j2w.Apply.init')) result.errors.push('Native init function overwritten')
          for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(child => { if (child?.type) visit(child, node, parent) })
            else if (value?.type) visit(value, node, parent)
          }
        }
        visit(ast)
      } catch (error) { result.errors.push(error.message) }
      cache.set(raw, result)
    }
    results.push(...result.calls);errors.push(...result.errors)
  }
  return { calls: results, errors }
}
const listing = page => {
  requireNative(page?.usable && page.originalText, 'Native category response unavailable')
  const doc = document(page.originalText), rows = [], pages = [], totals = []
  for (const row of doc.nodes(node => node.tag === 'tr' && doc.hasClass(node, 'data-row'))) {
    const anchors = doc.nodes(node => node.tag === 'a' && doc.hasClass(node, 'jobTitle-link')).filter(node => {
      let parent = node.parent
      while (parent && parent !== row) parent = parent.parent
      return parent === row
    })
    const links = anchors.flatMap(node => {
      try {
        const url = new URL(node.attrs.href, page.url).href, id = roleId(url)
        return id ? [{ id, url, title: doc.text(node), attrs: { ...node.attrs }, duplicateAttributes: node.duplicateAttributes }] : []
      } catch { return [] }
    })
    if (links.length) rows.push(...links.map(link => ({ ...link, originalRowHTML: doc.original(row), listingURL: page.url,
      listingBodySHA256: page.bodySHA256, ambiguous: links.some(other => other.id !== link.id || other.url !== link.url || other.title !== link.title)
        || link.duplicateAttributes.length > 0 })))
  }
  for (const node of doc.nodes(node => node.tag === 'a' && /^(?:Page \d+|First Page|Last Page|Next Page|Previous Page)$/.test(node.attrs.title || ''))) {
    try {
      let parent = node.parent
      while (parent && !(parent.tag === 'ul' && doc.hasClass(parent, 'pagination'))) parent = parent.parent
      if (!parent) continue
      const url = new URL(node.attrs.href, page.url)
      if (allowed(url) && !roleId(url.href) && !node.duplicateAttributes.length) pages.push(url.href)
    } catch { /* malformed navigation stays in original document */ }
  }
  for (const node of doc.nodes(node => doc.hasClass(node, 'paginationLabel'))) {
    const match = /\bof\s+(\d+)\s*$/.exec(doc.text(node))
    if (match) totals.push(Number(match[1]))
  }
  return { rows, pages: [...new Set(pages)], nativeCategoryReportedTotals: [...new Set(totals)], originalResponseSHA256: page.bodySHA256 }
}
const contexts = (snapshots, io) => {
  const indexed = new Map()
  for (const snapshot of snapshots) for (const row of snapshot.rows) {
    if (!indexed.has(row.id)) indexed.set(row.id, [])
    indexed.get(row.id).push(row)
  }
  return [...indexed].map(([id, rows]) => {
    const signatures = [...new Set(rows.map(row => JSON.stringify([row.title, row.url])))]
    const ambiguous = rows.some(row => row.ambiguous) || signatures.length !== 1
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
  const observations = new Map(), known = new Map()
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
      } catch (error) { signal?.throwIfAborted();io.issue('native-category-unqualified', { url, fresh, message: error.message }) }
    }
    return snapshots
  }
  const inspect = async (context, fresh = false) => {
    const page = await io.load(context.url, { fresh }), problems = []
    let properties = [], metas = [], canonicals = [], applications = { calls: [], errors: [] }, originalDescriptionHTML = null
    let bound = false, title = context.title, nativeCompany = null, country = null, city = null, description = null, held = false
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
        held = Boolean(criteria && heldPlaceholder(criteria))
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
        requireNative(nativeCompany === 'Nomura Holdings, inc.', 'Native publisher identity disagreement')
        requireNative(!applications.errors.length && call && !call.issues.length && String(call.fields.jobID) === context.id
          && call.fields.sourceId === 'JATS-nomurahold', 'Native published application identity disagreement')
        bound = true;title = ownTitle.value
        const nativeCountry = unique('country')
        country = nativeCountry ? countryName(nativeCountry.value) : null
        city = country ? unique('city')?.value || null : null
        if (!country) problems.push('Native explicit job country missing, unknown or conflicting')
        department = unique('department')?.value || null
        description = criteria && !criteriaPlaceholder && !held ? criteria : null
        postingDate = nativeUTCDate(meta('datePosted'));closingDate = nativeUTCDate(meta('validThrough'))
        if (meta('datePosted') && !postingDate) problems.push('Native posting date is not a qualified explicit UTC date')
        if (meta('validThrough') && !closingDate) problems.push('Native closing date is not a qualified explicit UTC date')
      } catch (error) { signal?.throwIfAborted();problems.push(error.message);io.issue('native-role-unqualified', { id: context.id, message: error.message }) }
    } else problems.push('Native role response unavailable')
    const location = country ? [city, country].filter(Boolean).join(', ') : null
    return { source: 'nomuraindia', title, company: nativeCompany, sourceCatalogCompany: 'Nomura India', jobId: context.id, requisitionId: null,
      sourceUrl: context.url, applyUrl: context.url, link: context.url, applicationUrlIsGeneric: true,
      country, city, state: null, location, locations: location ? [location] : [], sourceNativeCountryCodes: country ? [country] : [],
      sourceCountryScopeUnresolved: !country, sourceCompanyScopeUnresolved: !bound, sourceNativePostingIdentityQualified: bound,
      jobDescription: description, sourceDescription: description, department, postingDate, closingDate,
      employmentType: null, sourceEmploymentTypeUnresolved: true, remoteStatus: null, sourceRemoteStatusUnresolved: true,
      experienceRequired: null, minimumQualification: null, preferredQualification: null, requiredSkills: [],
      sourceNativePlatform: 'successfactors-rmk-public-native',
      sourceNativeRole: { projectionKind: 'original-published-HTML-and-microdata-not-a-native-JSON-feed', properties, microdataMetas: metas,
        canonicals, applications, originalDescriptionHTML, roleLayout },
      sourceNativeDiscovery: { originalListingRows: context.rows, conflictingIdentity: context.ambiguous },
      sourceNativeRoleDetail: { bound, url: context.url, bodySHA256: page?.bodySHA256 ?? null, issues: problems },
      sourceNativeCriteria: { unavailable: !description, placeholder: criteriaPlaceholder,
        normalizedTextIncludesMetadataBoilerplate: false },
      sourceNativeAvailability: { held, deadlinePassed: closingDate ? Date.parse(closingDate) < Date.parse(observedAt) : null,
        activeRecruitmentVerified: false },
      sourceNativeApplication: { originalCalls: applications.calls, activationVerified: false, allControlsQualified: false, applicantEligibilityQualified: false },
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
  const audit = { source: 'nomuraindia', observations: all, rawPages: io.rawPages, issues: io.issues, opening, closing,
    nativeCategoryReportedTotals: [...new Set([...opening, ...closing].flatMap(snapshot => snapshot.nativeCategoryReportedTotals))],
    authoritativeSourceTotal: null, authoritativeIndiaFacetCount: null, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
    qualification: 'Native category, role HTML, literal application identity and explicit country observations. Whole-company inventory, activation, active recruitment and publication remain unqualified.' }
  await onAudit(structuredClone(audit));signal?.throwIfAborted()
  const eligible = all.filter(job => job.sourceNativeRoleDetail.bound && job.jobDescription && !job.sourceNativeAvailability.held
    && (!job.country || job.country === 'India'))
  const jobs = (Number.isSafeInteger(maxJobs) && maxJobs >= 0 ? eligible.slice(0, maxJobs) : eligible).map(job => ({ ...job, scrapedAt: observedAt }))
  Object.defineProperty(jobs, 'sourceAudit', { value: audit })
  return attachInventoryEvidence(jobs, { status: 'discovery-only', surface: HOME, firstParty: io.rawPages.some(page => page.transportQualified),
    pagesFetched: io.rawPages.filter(page => page.usable).length, listingComplete: false, reportedTotal: null, indiaFacetCount: null, verifiedAt: observedAt,
    reason: 'native-category-role-criteria-and-explicit-country-observations-whole-source-scope-and-activation-unqualified' })
}
