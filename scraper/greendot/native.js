import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'acorn'
import { runWorkdayScraper } from '../../scraper-support/myworkday/engine.js'
import { workdayRequestScheduler } from '../../scraper-support/myworkday/requestScheduler.js'
import { WORKDAY_COUNTRY_INVENTORY_PROOF as PROOF, workdayInventoryIdentity, hashWorkdayProof, hasRecognizedWorkdayCountry, explicitWorkdayCountryScope } from '../../scraper-support/myworkday/countryInventoryProof.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { toPlainText } from '../../scraper-support/detailExtractors/shared.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { createGreendotNativeBoundary, isGreendotDeadline } from './nativeBoundary.js'

const OFFICIAL = 'https://www.greendot.com/working-here', BOARD = 'https://greendotcorp.wd1.myworkdayjobs.com/en-us/gdc'
const ENGINE_BASE = 'https://greendotcorp.wd1.myworkdayjobs.com/gdc', CANONICAL = 'https://greendotcorp.wd1.myworkdayjobs.com/GDC'
const API = 'https://greendotcorp.wd1.myworkdayjobs.com/wday/cxs/greendotcorp/gdc'
const ENGINE_DIRECTORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../greendot.workday')
const requireFact = (ok, message) => { if (!ok) throw new Error('Green Dot native identity: ' + message) }
const memberName = node => node?.type === 'MemberExpression' ? node.computed ? node.property?.type === 'Literal' && typeof node.property.value === 'string' ? node.property.value : null : node.property?.name : null
const globalNames = new Set(['window', 'self', 'globalThis', 'top', 'parent', 'frames', 'opener'])
const reflectiveNames = new Set(['Object', 'Reflect', 'eval', 'Function', 'Proxy'])
const globalObject = node => node?.type === 'ThisExpression' || node?.type === 'Identifier' && globalNames.has(node.name)
  || node?.type === 'MemberExpression' && (globalObject(node.object) && globalNames.has(memberName(node)) || ['defaultView', 'parentWindow'].includes(memberName(node)))
const workdayObject = node => node?.type === 'MemberExpression' && globalObject(node.object) && memberName(node) === 'workday' || node?.type === 'Identifier' && node.name === 'workday'
const initializerObject = node => node?.type === 'MemberExpression' && !node.computed && node.object?.name === 'window' && memberName(node) === 'workday'
const propertyName = property => property.key?.type === 'Identifier' ? property.key.name : property.key?.type === 'Literal' && typeof property.key.value === 'string' ? property.key.value : null
const literalData = node => {
  if (!node) return false
  if (node.type === 'Literal') return node.value == null || ['string', 'boolean', 'number'].includes(typeof node.value)
  if (node.type === 'ArrayExpression') return node.elements.every(literalData)
  if (node.type === 'ObjectExpression') {
    const keys = node.properties.map(propertyName)
    return keys.every(key => key != null) && new Set(keys).size === keys.length && node.properties.every(property => property.type === 'Property' && !property.computed && !property.method && property.kind === 'init' && literalData(property.value))
  }
  if (node.type === 'ConditionalExpression') return literalData(node.test) && literalData(node.consequent) && literalData(node.alternate)
  if (node.type === 'BinaryExpression' && ['==', '===', '!=', '!==', '<', '<=', '>', '>='].includes(node.operator)) return literalData(node.left) && literalData(node.right)
  if (node.type === 'UnaryExpression' && ['-', '+', '!'].includes(node.operator)) return literalData(node.argument)
  return false
}
const verifyHandoff = capture => {
  const doc = readVisibleNativeDocument(capture.rawText, { strict: true }), anchors = []
  const visit = (node, disabled = false) => {
    if (typeof node !== 'object') return
    disabled ||= node.inert || Object.hasOwn(node.attrs, 'disabled') || node.attrs['aria-disabled']?.toLowerCase() === 'true' || /(?:^|\s)(?:hidden|invisible|sr-only)(?:\s|$)/i.test(node.attrs.class || '')
    if (disabled) return
    if (node.tag === 'a' && node.attrs.href === BOARD && doc.text(node).trim()) anchors.push(node)
    node.children.forEach(child => visit(child, disabled))
  }
  doc.nodes(node => node.tag === 'root').forEach(root => visit(root))
  requireFact(anchors.length === 1, 'current enabled visible official handoff unavailable')
}
const verifyBootstrap = capture => {
  const doc = readVisibleNativeDocument(capture.rawText, { strict: true })
  const canonicals = doc.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical')
  requireFact(canonicals.length === 1 && canonicals[0].attrs.href === CANONICAL, 'bootstrap exact canonical identity mismatch')
  const bindings = [], critical = new Set(['tenant', 'siteId', 'locale', 'isExternal', 'appName'])
  const scripts = doc.nodes(node => node.tag === 'script' && (!node.attrs.type || /^(?:text|application)\/javascript$/i.test(node.attrs.type)))
  requireFact(scripts.length === 1 && !scripts[0].attrs.src, 'bootstrap executable identity owner changed or unsupported')
  for (const script of scripts) {
    const ast = parse(script.raw || '', { ecmaVersion: 'latest' })
    const firstStatement = ast.body.find(node => node.type !== 'EmptyStatement' && !node.directive)
    const initializerReferences = new WeakSet()
    const binding = node => requireFact(node?.type === 'Identifier' && !globalNames.has(node.name) && !reflectiveNames.has(node.name) && !['workday', 'document'].includes(node.name), 'bootstrap shadowed or unsupported identity/global binding')
    // Observe the literal owner, not arbitrary JavaScript dataflow. In
    // particular whole native/global objects may not escape into aliases,
    // parameters or reflection; dynamic code is never evaluated.
    const visit = (node, parent) => {
      if (!node || typeof node !== 'object') return
      const staticKey = node.type === 'Identifier' && (parent?.type === 'MemberExpression' && parent.property === node && !parent.computed
        || parent?.type === 'Property' && parent.key === node && parent.value !== node && !parent.computed)
      if (node.type === 'VariableDeclarator') binding(node.id)
      if (/^(?:FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(node.type)) { if (node.id) binding(node.id); node.params.forEach(binding) }
      if (['ClassDeclaration', 'ClassExpression'].includes(node.type) && node.id) binding(node.id)
      if (node.type === 'CatchClause') binding(node.param)
      requireFact(!['ObjectPattern', 'ArrayPattern', 'ImportExpression', 'WithStatement', 'WhileStatement', 'DoWhileStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement', 'ThrowStatement', 'AwaitExpression', 'YieldExpression'].includes(node.type), 'bootstrap unsupported identity dataflow or nonfinite owner')
      if (node.type === 'Identifier' && reflectiveNames.has(node.name)) requireFact(staticKey, 'bootstrap unsupported reflective/dynamic identity operation')
      if (node.type === 'MemberExpression') requireFact(memberName(node) !== 'constructor', 'bootstrap unsupported dynamic constructor')
      if (workdayObject(node) && !staticKey) {
        const fieldRead = parent?.type === 'MemberExpression' && parent.object === node && typeof memberName(parent) === 'string'
        requireFact(initializerReferences.has(node) || fieldRead, 'bootstrap native Workday alias or escape')
      }
      if (globalObject(node) && !staticKey) {
        const field = parent?.type === 'MemberExpression' && parent.object === node ? memberName(parent) : null
        requireFact(field === 'workday' || globalNames.has(field), 'bootstrap native global alias or dynamic access')
      }
      if (node.type === 'AssignmentExpression' && workdayObject(node.left)) {
        requireFact(initializerObject(node.left) && parent === firstStatement && node.operator === '=' && node.right.type === 'LogicalExpression' && node.right.operator === '||'
          && initializerObject(node.right.left) && node.right.right.type === 'ObjectExpression' && literalData(node.right.right), 'bootstrap unsupported or unreachable identity assignment')
        const fields = {}, keys = new Set()
        for (const property of node.right.right.properties) {
          requireFact(property.type === 'Property' && !property.computed && !property.method && property.kind === 'init', 'bootstrap unsupported property')
          const key = propertyName(property)
          requireFact(!keys.has(key), 'bootstrap duplicate identity/property'); keys.add(key)
          if (critical.has(key) || key === 'token') { requireFact(property.value.type === 'Literal', 'bootstrap nonliteral identity'); fields[key] = property.value.value }
        }
        bindings.push(fields)
        initializerReferences.add(node.left); initializerReferences.add(node.right.left)
      } else if (['AssignmentExpression', 'UpdateExpression'].includes(node.type) || node.type === 'UnaryExpression' && node.operator === 'delete') {
        const target = node.left || node.argument
        const benignCdnFlag = node.type === 'AssignmentExpression' && node.operator === '=' && target?.type === 'MemberExpression' && !target.computed && workdayObject(target.object) && memberName(target) === 'useCdn' && node.right?.type === 'Literal' && node.right.value === false
        requireFact(!globalObject(target) && !(workdayObject(target) || target?.type === 'MemberExpression' && workdayObject(target.object) && !benignCdnFlag), 'bootstrap later identity mutation')
      }
      if (['CallExpression', 'NewExpression'].includes(node.type)) requireFact(!node.arguments.some(argument => workdayObject(argument) || globalObject(argument))
        && !(node.callee?.type === 'MemberExpression' && workdayObject(node.callee.object)), 'bootstrap unsupported native/global mutation call')
      for (const [key, value] of Object.entries(node)) {
        if (['start', 'end', 'loc'].includes(key)) continue
        if (Array.isArray(value)) value.forEach(child => visit(child, node))
        else if (value && typeof value === 'object') visit(value, node)
      }
    }
    visit(ast, null)
  }
  requireFact(bindings.length === 1, 'bootstrap requires one exact current identity')
  const binding = bindings[0]
  requireFact(binding.tenant === 'greendotcorp' && binding.siteId === 'gdc' && binding.locale === 'en-US' && binding.isExternal === true && binding.appName === 'cxs', 'bootstrap exact API identity mismatch')
  return { token: binding.token, cookie: [...(capture.headers['set-cookie'] || '').matchAll(/(?:^|,\s*)([^,\s;=]+)=([^;]*)/g)].map(match => `${match[1]}=${match[2]}`).join('; ') }
}
const names = new Map()
const display = new Intl.DisplayNames(['en'], { type: 'region' })
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) { const code = String.fromCharCode(a, b), name = display.of(code); if (name && name !== code) names.set(name.toLowerCase(), code) }
names.set('united states of america', 'US')
const countryCode = value => {
  requireFact(value && typeof value === 'object' && hasRecognizedWorkdayCountry(value), 'unknown/conflicting typed country')
  const codes = [value.descriptor && names.get(value.descriptor.trim().toLowerCase()), value.alpha2Code?.toUpperCase(), value.id === 'c4f78be1a8f14da0ab49ce1162348a5e' ? 'IN' : value.id === 'bc33aa3152ec42d4995f4791a106ed09' ? 'US' : null].filter(Boolean)
  requireFact(codes.length && new Set(codes).size === 1, 'contradictory supplied native country fields')
  return codes[0]
}
const nativeDate = (value, now, publication = false) => {
  requireFact(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), 'native date missing or unsupported')
  const parsed = new Date(value + 'T00:00:00.000Z')
  requireFact(Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === value && (!publication || +parsed <= +new Date(now)), 'invalid/future native date')
  return parsed.toISOString()
}
const verifyRole = (row, payload, expectedScope, now) => {
  const info = payload.jobPostingInfo, tail = row.externalPath.split('/').at(-1)
  requireFact(info && typeof info.id === 'string' && /^[a-f0-9]{32}$/.test(info.id), 'native posting UID unavailable')
  requireFact(info.title === row.title && info.jobPostingId === tail && typeof info.jobReqId === 'string' && info.jobReqId
    && (tail.endsWith('_' + info.jobReqId) || new RegExp('_' + info.jobReqId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '-\\d+$').test(tail)), 'native title/requisition/posting mismatch')
  requireFact(info.jobPostingSiteId === 'GDC' && info.externalUrl === CANONICAL + row.externalPath, 'exact canonical native site/URL mismatch')
  for (const supplied of [info, payload]) for (const key of ['externalUrl', 'applyUrl', 'applicationUrl', 'postingUrl', 'detailUrl', 'url']) {
    if (supplied[key] != null) requireFact(supplied[key] === info.externalUrl, 'contradictory supplied native URL')
  }
  requireFact(payload.hiringOrganization?.name === 'Green Dot Corporation', 'native employer missing or mismatched')
  requireFact(info.posted === true && info.canApply === true && payload.userAuthenticated === false, 'native publication/application status unsupported')
  const firstCountry = countryCode(info.country), primaryCountry = countryCode(info.jobRequisitionLocation?.country)
  requireFact(firstCountry === primaryCountry, 'typed native workplace countries disagree')
  requireFact(typeof info.location === 'string' && info.location.trim() && typeof info.jobRequisitionLocation.descriptor === 'string' && info.jobRequisitionLocation.descriptor.trim(), 'native worksite descriptor unavailable')
  const knownOffices = [{ location: info.location, code: firstCountry }], unqualifiedNativeLocations = []
  const checkLabel = (label, code) => requireFact(!explicitWorkdayCountryScope(label) || explicitWorkdayCountryScope(label) === (code === 'IN' ? 'india' : 'foreign'), 'explicit country in native workplace contradicts typed country')
  for (const label of [info.location, info.jobRequisitionLocation.descriptor]) checkLabel(label, firstCountry)
  if (info.additionalLocations != null) {
    requireFact(Array.isArray(info.additionalLocations), 'unsupported native additional workplaces')
    for (const office of info.additionalLocations) {
      // Unknown offices stay raw; neither their label nor another office's
      // country can promote them. Contradictory supplied typed fields reject.
      if (office && typeof office === 'object' && office.country && typeof office.country === 'object') {
        const supplied = office.country
        const knownField = hasRecognizedWorkdayCountry({ descriptor: supplied.descriptor }) || hasRecognizedWorkdayCountry({ alpha2Code: supplied.alpha2Code })
        if (hasRecognizedWorkdayCountry(supplied) || knownField) {
          const code = countryCode(supplied)
          if (typeof office.descriptor === 'string' && office.descriptor.trim()) {
            checkLabel(office.descriptor, code)
            knownOffices.push({ location: office.descriptor, code }); continue
          }
        }
      }
      unqualifiedNativeLocations.push(office)
    }
  }
  const countryScopes = [...new Set(knownOffices.map(office => office.code === 'IN' ? 'india' : 'foreign'))]
  requireFact(countryScopes.every(scope => expectedScope.includes(scope)) && !(expectedScope.includes('india') && !countryScopes.includes('india') && !unqualifiedNativeLocations.length), 'native closing country scope changed or unsupported')
  const countryScope = countryScopes.includes('india') ? 'india' : 'foreign'
  const indiaLocations = knownOffices.filter(office => office.code === 'IN').map(office => office.location)
  const postedAt = nativeDate(info.startDate, now, true), closingDate = info.endDate == null ? null : nativeDate(info.endDate, now)
  requireFact(!closingDate || closingDate >= postedAt, 'native lifecycle dates disagree')
  return { info, countryScope, countryScopes, indiaLocations, unqualifiedNativeLocations, postedAt, closingDate }
}

export const createGreendotCollector = ({ fetchImpl = globalThis.fetch, runEngine = runWorkdayScraper, requestScheduler = workdayRequestScheduler, now = () => new Date().toISOString(), requestTimeoutMs = 20000 } = {}) => {
  const read = createGreendotNativeBoundary({ fetchImpl, requestScheduler, now, requestTimeoutMs })
  return { async run(options = {}) {
    options.signal?.throwIfAborted()
    requireFact(Number.isFinite(+new Date(now())), 'current clock invalid')
    const official = await read(OFFICIAL, { signal: options.signal, html: true }); verifyHandoff(official)
    const board = await read(BOARD, { signal: options.signal, html: true }), session = verifyBootstrap(board)
    const engineJobs = await runEngine({ ...options, source: 'greendot', company: 'Green Dot', baseUrl: ENGINE_BASE, scraperDir: ENGINE_DIRECTORY, boardIdentityVerified: true, detailEnrichmentBudgetMs: 0, requestScheduler })
    options.signal?.throwIfAborted()
    const proof = engineJobs?.[PROOF], roles = proof?.listingRoles
    requireFact(proof?.scope === 'complete-board-country-proof' && proof.boardReceipt?.board === ENGINE_BASE && Array.isArray(roles)
      && proof.initial?.count === roles.length && proof.closing?.count === roles.length && proof.initial.sha256 === proof.closing.sha256, 'engine failed before a safe complete candidate proof')
    requireFact(new Set(roles.map(row => row.externalPath)).size === roles.length && roles.every(row => typeof row.title === 'string' && row.title.trim() && /^\/job\/[^?#]+\/[^/?#]+$/.test(row.externalPath) && row.url === ENGINE_BASE + row.externalPath), 'engine native listing identity invalid')
    const referenceHash = hashWorkdayProof(JSON.stringify(roles.map(workdayInventoryIdentity).sort()))
    requireFact(referenceHash === proof.initial.sha256, 'engine candidate identity hash mismatch')
    const observations = new Array(roles.length), jobsByIndex = new Array(roles.length)
    const controllers = Array.from({ length: Math.min(4, roles.length) }, () => new AbortController())
    let next = 0, fatal
    const stop = (error, origin) => {
      if (options.signal?.aborted) fatal = options.signal.reason
      else if (isGreendotDeadline(error) && !isGreendotDeadline(fatal)) fatal = error
      else fatal ||= error
      controllers.forEach((controller, index) => { if (index !== origin && !controller.signal.aborted) controller.abort(fatal) })
    }
    const retainPartialFailure = error => {
      if (options.signal?.aborted) return options.signal.reason
      if ([401, 403, 429].includes(error?.status)) error.greendotPartialEvidence = {
        source: 'greendot', sourceScopeComplete: false, finalListingReconciled: false, companyGlobalTotal: null, companyIndiaTotal: null,
        qualifiedJobs: jobsByIndex.filter(Boolean), nativeObservations: roles.map((listing, index) => observations[index] || {
          listing, qualification: 'unread', nativePayload: null, nativeCountry: null, receipt: null, reason: 'not-started-after-native-access-denial',
        }),
        engineCountryProof: proof,
      }
      return error
    }
    const workers = controllers.map(async (controller, workerIndex) => {
      const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal
      while (next < roles.length && !signal.aborted && !fatal) {
        const index = next++, row = roles[index]
        let capture
        try {
          capture = await read(API + row.externalPath, { signal, session, onStop: error => stop(error, workerIndex) })
          const hydrated = proof.roles?.find(role => role.url === row.url)
          // The engine omits direct-summary roles from its hydration receipts.
          // Only their exact reconciled listing country text can supply the
          // missing candidate scope; never fill or replace an issued receipt.
          const listingScope = hydrated ? null : explicitWorkdayCountryScope(row.locationsText)
          const expected = hydrated ? hydrated.countryScopes || [] : listingScope ? [listingScope] : []
          const facts = verifyRole(row, capture.payload, expected, now())
          observations[index] = { listing: row, qualification: facts.unqualifiedNativeLocations.length ? 'unqualified-geography' : facts.countryScope, nativePayload: capture.payload, nativeCountry: capture.payload.jobPostingInfo.country,
            nativeKnownCountryScopes: facts.countryScopes, unqualifiedNativeLocations: facts.unqualifiedNativeLocations, receipt: capture }
          if (facts.countryScope !== 'india') continue
          const prior = engineJobs.find(job => job.link === row.url || job.requisitionId === facts.info.jobReqId || job.jobId === facts.info.jobReqId)
          if (prior?.sourceDetailComplete && prior.sourceDescription) requireFact(toPlainText(prior.sourceDescription) === toPlainText(facts.info.jobDescription || ''), 'native closing description changed')
          const raw = typeof facts.info.jobDescription === 'string' ? facts.info.jobDescription : null
          const document = readVisibleNativeDocument(raw || '', { strict: true }), text = document.nodes(node => node.tag === 'root').map(root => document.text(root)).join(' ')
          const complete = Boolean(extractActiveDescription(text))
          const { info } = facts
          jobsByIndex[index] = { jobId: info.jobReqId, requisitionId: info.jobReqId, title: info.title, company: 'Green Dot', source: 'greendot', country: 'India', location: facts.indiaLocations[0], locations: facts.indiaLocations,
            nativeEmployer: capture.payload.hiringOrganization.name, nativePostingUid: info.id, link: info.externalUrl, applyUrl: info.externalUrl, sourceUrl: info.externalUrl,
            sourceDescription: raw, jobDescription: complete ? text : null, sourceDetailComplete: complete, publicExperienceChecked: complete,
            ...(!complete && { sourceDetailFailureKind: 'missing-content' }), postedAt: facts.postedAt, closingDate: facts.closingDate,
            sourceRawDates: { startDate: info.startDate, endDate: info.endDate ?? null }, sourcePostingDateIsExact: false, sourceClosingDateIsExact: false,
            nativeRawJobPostingInfo: info, sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false }
          if (!complete && !facts.unqualifiedNativeLocations.length) observations[index].qualification = 'partial-india'
        } catch (error) {
          const receipt = capture || (error.nativeCapture?.url === API + row.externalPath ? error.nativeCapture : null)
          observations[index] = { listing: row, qualification: capture?.payload ? 'unqualified' : 'unread', nativePayload: capture?.payload ?? null,
            nativeCountry: null, reason: error.message, receipt }
          if (options.signal?.aborted || signal.aborted || isGreendotDeadline(error)) {
            // A cancelled peer must not turn around and cancel the denial
            // response whose own bounded body still supplies raw diagnostics.
            if (options.signal?.aborted || isGreendotDeadline(error) || !fatal) stop(options.signal?.aborted ? options.signal.reason : isGreendotDeadline(error) ? error : signal.reason)
            return
          }
          if ([401, 403, 429].includes(error?.status)) { stop(error); return }
        }
      }
    })
    await Promise.allSettled(workers)
    options.signal?.throwIfAborted()
    if (fatal) throw retainPartialFailure(fatal)
    requireFact(observations.every(Boolean), 'native workers did not settle every candidate')
    const closing = [], captures = []
    let offset = 0
    do {
      let capture
      try { capture = await read(API + '/jobs', { signal: options.signal, session, method: 'POST', body: { appliedFacets: {}, limit: 20, offset, searchText: '' } }) }
      catch (error) { throw retainPartialFailure(error) }
      const payload = capture.payload
      requireFact(Array.isArray(payload.jobPostings) && payload.userAuthenticated === false && (payload.total === roles.length || offset > 0 && payload.total === 0), 'final closing count/schema changed')
      requireFact(payload.jobPostings.length === Math.min(20, roles.length - offset), 'final closing native row count changed')
      for (const row of payload.jobPostings) for (const key of ['externalUrl', 'applyUrl', 'applicationUrl', 'postingUrl', 'detailUrl', 'url']) {
        if (row[key] != null) requireFact(row[key] === CANONICAL + row.externalPath, 'final closing listing supplied URL contradicts native role')
      }
      closing.push(...payload.jobPostings); captures.push(capture); offset += payload.jobPostings.length
    } while (offset < roles.length)
    requireFact(new Set(closing.map(row => row.externalPath)).size === roles.length && hashWorkdayProof(JSON.stringify(closing.map(workdayInventoryIdentity).sort())) === referenceHash, 'final closing native identity set changed')
    options.signal?.throwIfAborted()
    const jobs = jobsByIndex.filter(Boolean)
    // A source-specific observation scope, never an issued complete-board or
    // authoritative-empty certificate. Keep the engine object nested unchanged.
    Object.defineProperty(jobs, PROOF, { value: { scope: 'greendot-source-local-native-observations', kind: 'partial-native-role-validation', sourceScopeComplete: false,
      companyGlobalTotal: null, companyIndiaTotal: null, engineCountryProof: proof, currentBinding: { apiSite: 'gdc', canonicalSite: 'GDC', official, board }, rawNativeObservations: observations, finalListingReceipts: captures } })
    attachSourceObservationEvidence(jobs, { source: 'greendot', recordKind: 'vacancy-rows', observedRecordCount: roles.length, observedVacancyCount: roles.length, sourceScopeComplete: false })
    return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: BOARD, firstParty: true, listingComplete: false, pagesFetched: captures.length,
      reportedTotal: null, indiaFacetCount: null, verifiedAt: null, reason: 'current-bound-native-board-observations-company-scope-and-unqualified-roles-unresolved' })
  } }
}
