import { createHash } from 'node:crypto'
import { setTimeout as yieldToCollectionTimer } from 'node:timers/promises'
import { parse } from 'acorn'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const HOME = 'https://www.bluebinaries.com/'
const ENTRY = HOME + 'static/js/main.726414c5.js'
const STYLE = HOME + 'static/css/main.ee20edae.css'
const CAREERS = HOME + 'become-a-bluebee'
const ROOT_SHA = 'a3e848ae1fdc2b30fd1fb91b73226c806b36a1f488d1059afd91a1f5a9bbeea3'
const ENTRY_SHA = 'f015404118bbc6eb96824698308aaa440e7f99c3033282b8ebfee32fc66bce53'
const MODELS_SHA = '1bf11c79197044e89cc04e1fa97677cf3ed4fcff424340db01bf2beaf0670d62'
const BINDINGS = {
  di: 'e66d6ca3b068055e924b6998c6fc91feb037195a0faf5b4c5303d961e8f1584d',
  fi: '5d0033a589a51280ea4ebb9217c85b01d4d2b34df76cf2d9c84ac61845e68766',
  Wu: 'd605c3c6d69bcf58d56b4057e5cc2ae088b78425a7a74fbdf258f1d393673794',
  Ku: 'e1758596bc9b6e5133c26afba97f174ba25017137be85d088042032f14fc79d1',
  rd: 'cdd2f65e3e2b98ae257645745923d162faa1438bfe4848d90f999b6271e886ed',
  md: '69d8383a09270a4142e8b92ed18be947ffba361923149872e6065a57c405aac2',
  hd: 'c4f3afbe98c30681a613ae29fb78a619188085e8bb24e58285589c2947d09ac6',
}
const PROFILES = new Map([
  [ROOT_SHA,{rootSHA256:ROOT_SHA,entryURL:ENTRY,declaredStylesheetURL:STYLE,entrySHA256:ENTRY_SHA,bindings:BINDINGS,blockStart:378741,blockEnd:958794,label:'current-react-20261111'}],
  ['e38db4c9b80f4473777826213ae1c05d34209e31b5f7b45663c31d0a68885463',{
    rootSHA256:'e38db4c9b80f4473777826213ae1c05d34209e31b5f7b45663c31d0a68885463',
    entryURL:HOME+'static/js/main.69b436a7.js',declaredStylesheetURL:HOME+'static/css/main.cf2af84f.css',
    entrySHA256:'7d6f90f82e40d6a365d4d132c2449a9f9cc35d0bf23820ca46b95dd89edfa56c',
    bindings:{...BINDINGS,hd:'4dc55536c2de520890a1bfa4404ff9479bc4be0e5d8920e658de958ead601356'},
    blockStart:378740,blockEnd:958441,label:'current-react-20261113',
  }],
])
const hash = value => createHash('sha256').update(value).digest('hex')
const failure = (message, cause, failureKind = 'surface_drift_or_fail_closed') => Object.assign(new Error('Blue Binaries current React contract: ' + message, { cause }), {
  code: 'BLUEBINARIES_REACT_CONTRACT', source: 'bluebinaries', abortRetries: true,
  failureKind, softFailure: failureKind !== 'parser_or_contract_error', upstreamOutage: false,
  sourceListingComplete: false, lifecycleCleanupAllowed: false,
})
const requireContract = (condition, message, signal) => {
  signal.throwIfAborted()
  if (!condition) throw failure(message)
}
const property = (node, name) => node?.type === 'ObjectExpression'
  ? node.properties.find(item => item.type === 'Property' && !item.computed && (item.key.name ?? item.key.value) === name)?.value
  : undefined
const member = (node, object, name) => node?.type === 'MemberExpression' && !node.computed
  && node.object?.type === 'Identifier' && node.object.name === object && node.property.name === name
const jsx = (node, name) => node?.type === 'CallExpression' && node.callee?.type === 'SequenceExpression'
  && member(node.callee.expressions.at(-1), 'pi', 'jsx')
  && node.arguments[0]?.type === 'Identifier' && node.arguments[0].name === name
const visit = (node, callback) => {
  if (!node || typeof node !== 'object') return
  if (typeof node.type === 'string') callback(node)
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) { for (const item of value) if (item && typeof item === 'object') visit(item, callback) }
    else if (value && typeof value === 'object') visit(value, callback)
  }
}
const containsMember = (node, object, name) => {
  let found = false
  visit(node, item => { if (member(item, object, name)) found = true })
  return found
}

// This selects a closed profile; it does not confer authority on an arbitrary SPA.
export const looksLikeCurrentReactHomepage = html => {
  if (!/<div\b[^>]*\bid\s*=\s*["']root["']/i.test(html)
    && !/<script\b[^>]*\bsrc\s*=\s*["'][^"']*\/static\/js\/main\./i.test(html)) return false
  return readNativeDocument(html).nodes(node => !node.inert && (node.tag === 'div' && node.attrs.id === 'root'
    || node.tag === 'script' && /\/static\/js\/main\./i.test(node.attrs.src || '')
      && !Object.hasOwn(node.attrs, 'nomodule') && (!node.attrs.type || /^(?:module|(?:text|application)\/(?:x-)?(?:java|ecma)script)$/i.test(node.attrs.type)))).length > 0
}

const readRoot = (html, signal) => {
  const profile=typeof html==='string'&&Buffer.byteLength(html)<=16384?PROFILES.get(hash(html)):null
  requireContract(profile, 'unreviewed complete employer root document', signal)
  const doc = readNativeDocument(html)
  const scripts = doc.nodes(node => node.tag === 'script' && !node.inert)
  const roots = doc.nodes(node => node.tag === 'div' && node.attrs.id === 'root' && !node.inert)
  const styles = doc.nodes(node => node.tag === 'link' && node.attrs.rel === 'stylesheet' && !node.inert)
  requireContract(roots.length === 1 && scripts.length === 1 && styles.length === 1, 'root or declared program/style binding changed', signal)
  const script = scripts[0]
  requireContract(Object.hasOwn(script.attrs, 'defer') && !Object.hasOwn(script.attrs, 'nomodule') && !script.attrs.type, 'entry activation declaration changed', signal)
  const entry = new URL(script.attrs.src, HOME)
  const style = new URL(styles[0].attrs.href, HOME)
  requireContract(entry.origin === new URL(HOME).origin && entry.href === profile.entryURL && !entry.username && !entry.password
    && style.origin === entry.origin && style.href === profile.declaredStylesheetURL, 'employer-origin entry or stylesheet declaration changed', signal)
  return profile
}

const readProgram = (javascript, signal, profile) => {
  requireContract(typeof javascript === 'string' && Buffer.byteLength(javascript) <= 1048576 && hash(javascript) === profile.entrySHA256, 'unreviewed complete declared entry program', signal)
  let ast
  try { ast = parse(javascript, { sourceType: 'script', ecmaVersion: 'latest' }) }
  catch (cause) { signal.throwIfAborted(); throw failure('complete declared entry AST unavailable', cause, 'parser_or_contract_error') }
  signal.throwIfAborted()
  const declarations = new Map(), blocks = []
  let rootRender = false
  const walk = node => {
    if (!node || typeof node !== 'object') return
    const block = node.type === 'BlockStatement'
    if (block) blocks.push(node)
    const owner = blocks.at(-1)
    if (node.type === 'VariableDeclarator' && Object.hasOwn(profile.bindings, node.id?.name)
      && owner?.start === profile.blockStart && owner.end === profile.blockEnd) {
      requireContract(!declarations.has(node.id.name), 'ambiguous same-scope contract binding', signal)
      declarations.set(node.id.name, node)
    }
    if (node.type === 'CallExpression' && node.callee?.type === 'MemberExpression' && node.callee.property.name === 'render') {
      const creation = node.callee.object, target = creation?.arguments?.[0]
      const strict = node.arguments[0], child = property(strict?.arguments?.[1], 'children')
      if (creation?.type === 'CallExpression' && member(creation.callee, 't', 'createRoot')
        && target?.type === 'CallExpression' && member(target.callee, 'document', 'getElementById')
        && target.arguments.length === 1 && target.arguments[0].value === 'root'
        && node.arguments.length === 1 && jsx(child, 'md')) rootRender = true
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) { for (const item of value) if (item && typeof item === 'object') walk(item) }
      else if (value && typeof value === 'object') walk(value)
    }
    if (block) blocks.pop()
  }
  walk(ast)
  requireContract(rootRender && declarations.size === Object.keys(profile.bindings).length, 'root or same-scope frontend graph changed', signal)
  for (const [name, expectedHash] of Object.entries(profile.bindings)) {
    const node = declarations.get(name)
    requireContract(hash(javascript.slice(node.start, node.end)) === expectedHash, 'complete ' + name + ' binding changed', signal)
  }
  const get = name => declarations.get(name).init
  requireContract(property(get('di'), 'BecomeABluebee')?.value === 'become-a-bluebee', 'native careers route changed', signal)
  const rootComponent = get('md')
  requireContract(rootComponent.type === 'FunctionExpression' && rootComponent.params.length === 0
    && rootComponent.body.body.length === 1 && jsx(rootComponent.body.body[0].argument, 'hd'), 'root-to-router binding changed', signal)
  let nav = false, route = false, modelsToRenderer = false
  visit(get('fi'), node => {
    const to = property(node, 'to')
    if (to?.type === 'BinaryExpression' && to.operator === '+' && to.left.value === '/'
      && containsMember(to.right, 'di', 'BecomeABluebee')) nav = true
  })
  visit(get('hd'), node => {
    if (containsMember(property(node, 'path'), 'di', 'BecomeABluebee') && jsx(property(node, 'element'), 'rd')) route = true
  })
  visit(get('rd'), node => {
    if (node.type !== 'CallExpression' || !member(node.callee, 'Wu', 'map') || node.arguments.length !== 1) return
    const callback = node.arguments[0], data = property(callback.body?.arguments?.[1], 'data')
    if (callback.type === 'ArrowFunctionExpression' && jsx(callback.body, 'Ku')
      && data?.type === 'Identifier' && data.name === callback.params[0]?.name) modelsToRenderer = true
  })
  requireContract(nav && route && modelsToRenderer, 'careers navigation, route or data-to-renderer binding changed', signal)
  const renderer = get('Ku')
  requireContract(renderer.type === 'FunctionExpression' && ['jobTitle', 'postedDate', 'location', 'description'].every(name => containsMember(renderer, 'a', name)), 'complete native renderer fields changed', signal)
  const array = get('Wu')
  requireContract(array.type === 'ArrayExpression' && array.elements.length === 9, 'native observation array changed', signal)
  const models = array.elements.map(node => {
    requireContract(node?.type === 'ObjectExpression' && node.properties.length === 4, 'native observation shape changed', signal)
    const value = {}
    for (const item of node.properties) {
      const name = item.key?.name ?? item.key?.value
      requireContract(item.type === 'Property' && !item.computed && item.kind === 'init' && !item.method && !item.shorthand
        && ['jobTitle', 'postedDate', 'location', 'description'].includes(name) && !Object.hasOwn(value, name)
        && item.value.type === 'Literal' && typeof item.value.value === 'string' && item.value.value.length > 0, 'native observation literal field changed', signal)
      value[name] = item.value.value
    }
    return value
  })
  requireContract(hash(JSON.stringify(models)) === MODELS_SHA, 'complete native observation values changed', signal)
  return models
}

const observation = (model, index, sourceURL) => {
  const country = /,\s*UK\s*$/.test(model.location) ? 'United Kingdom' : /,\s*Austria\s*$/.test(model.location) ? 'Austria' : null
  return {
    source: 'bluebinaries', company: 'Blue Binaries', title: model.jobTitle, location: model.location,
    country, countryCode: country === 'United Kingdom' ? 'GB' : country === 'Austria' ? 'AT' : null,
    jobId: null, sourceJobId: null, requisitionId: null, observationIndex: index,
    sourceUrl: CAREERS, nativeModelSourceURL: sourceURL, applyUrl: null, link: CAREERS,
    applicationPublicContextValidated: false, applicationUrlScope: 'unqualified',
    sourceNativeFields: { ...model }, nativePublicationLabel: model.postedDate,
    postingDate: null, closingDate: null, sourceClosingDateIsExact: false,
    jobDescription: null, sourceDescription: null, sourceIdentityComplete: false, sourceDetailComplete: false,
    sourceListingComplete: false, sourceCleanupEligible: false, lifecycleCleanupAllowed: false,
    sourceDetailFailureKind: 'current-react-identity-rendering-application-unqualified',
    sourceNativeCriteria: { fullObservedHTML: model.description, rendererVerified: false, visibilityIssues: ['current-react-reveal-and-styles-unqualified'] },
    sourceNativeCountryEvidence: { location: model.location, country, basis: country ? 'explicit-native-role-location-country-text' : null },
  }
}

export const collectCurrentReactHiringObservations = async ({ openingHTML, scope }) => {
  const { signal } = scope
  const opening = readRoot(openingHTML, signal)
  const openingProgram = await scope.read(opening.entryURL, { kind: 'javascript', phase: 'initial' })
  const models = readProgram(openingProgram, signal, opening)
  // The AST work is synchronous. Yield once to the existing collection timer
  // before admitting closing reads or publishing any native observations.
  await yieldToCollectionTimer(0)
  signal.throwIfAborted()
  const closingHTML = await scope.read(HOME, { phase: 'closing' })
  const closing = readRoot(closingHTML, signal)
  requireContract(closing.entryURL === opening.entryURL && closing.rootSHA256===opening.rootSHA256, 'closing declared entry changed', signal)
  const closingProgram = await scope.read(closing.entryURL, { kind: 'javascript', phase: 'closing' })
  // The closing entity is separately read, bounded and hashed. Equal complete bytes
  // have the same already-parsed graph; they are not replaced by the opening entity.
  requireContract(typeof closingProgram === 'string' && Buffer.byteLength(closingProgram) <= 1048576
    && hash(closingProgram) === opening.entrySHA256 && closingProgram === openingProgram, 'closing complete entry program changed', signal)
  const observations = models.map((model,index)=>observation(model,index,opening.entryURL))
  signal.throwIfAborted()
  const now = scope.stamp()
  signal.throwIfAborted()
  const closingEvidence = {
    rootRequests: 2, programRequests: 2, payloadsReconciled: true,
    contemporaneousAcquisitionVerified: false,
    qualification: 'Separate logical opening/closing reads; parser equality does not certify transport acquisition times or employer-wide inventory.',
  }
  const evidence = {
    profile: opening.label, rootSHA256: opening.rootSHA256, entrySHA256: opening.entrySHA256,
    declaredCareerURL: CAREERS, declaredStylesheetURL: opening.declaredStylesheetURL, stylesheetVisibilityQualified: false,
    observations, closingEvidence, sourceScopeComplete: false, companyScopeComplete: false, lifecycleCleanupAllowed: false,
  }
  await scope.audit({
    source: 'bluebinaries', observedGlobalCount: 9, nativeGlobalReportedTotal: null,
    nativeJobs: observations, observations, currentReactContract: evidence,
    closingReconciled: true, primaryScopeComplete: false, scopeComplete: false,
    indiaJobCount: null, eligibleCount: 0, cleanupEligible: false, outputCapped: false,
    requests: scope.publicPages.length,
    reasons: ['native-posting-id-unpublished', 'role-owned-country-partly-unresolved', 'current-react-rendering-and-application-unqualified', 'closing-acquisition-and-company-scope-unqualified'],
  })
  signal.throwIfAborted()
  const jobs = []
  Object.defineProperty(jobs, 'nativeCurrentReactEvidence', { value: evidence })
  attachSourceObservationEvidence(jobs, { source: 'bluebinaries', recordKind: 'hiring-signals', observedRecordCount: 9, observedVacancyCount: 0, sourceScopeComplete: false })
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{source:'bluebinaries',recordKind:'hiring-signals',observedRecordCount:9,observedVacancyCount:0,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,...evidence},configurable:true})
  return attachInventoryEvidence(jobs, {
    status: 'coverage-gap', surface: CAREERS, firstParty: true, listingComplete: false,
    lifecycleCleanupAllowed:false,
    pagesFetched: scope.publicPages.length, reportedTotal: null, indiaFacetCount: null, verifiedAt: now,
    reason: 'Current employer-declared React native observations; posting IDs, country, rendered criteria, application, closing acquisition and company scope remain unqualified.',
  })
}
