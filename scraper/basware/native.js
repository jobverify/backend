import { requireNative, nativeCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { parseBoundedProgram, parseRemoteLiteral } from '../../scraper-support/utils/remoteScriptData.js'
import { collectBaswarePublicInventory, projectBaswarePublicInventory, verifyBaswareDetailAddresses, BASWARE_PROOF_URLS } from './publicInventory.js'
import { readBaswareRawScripts, isReviewedBaswareClassicScript } from './scriptExecution.js'

const CAREERS_URL = 'https://careers.basware.com/'
const WIDGET_URL = 'https://cdn.jobylon.com/jobs/company-groups/195/embed/v2/?target=jobylon-jobs-widget&page_size=5'
const ROLE_ORIGIN = 'https://emp.jobylon.com'
const evidenceKey = Symbol.for('jobverify.native-html-evidence')
const norm = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const same = (a, b) => norm(a).normalize('NFKC') === norm(b).normalize('NFKC')
const one = (values, name) => { requireNative(values.length === 1, 'Basware missing/ambiguous ' + name); return values[0] }
const children = node => node.children.filter(child => typeof child !== 'string')
const descendants = (node, predicate) => [...(predicate(node) ? [node] : []), ...children(node).flatMap(child => descendants(child, predicate))]
const executable = node => node.tag === 'script' && !node.attrs.src && !Object.hasOwn(node.attrs, 'nomodule')
  && /^(?:|text\/javascript|application\/javascript)$/i.test(node.attrs.type || '')
const astKey = node => JSON.stringify(node, (key, value) => ['start', 'end', 'raw'].includes(key) ? undefined : value)
const loaderAST = astKey(parseBoundedProgram(`(function() {
  var el = document.createElement('script');
  el.src = 'https://cdn.jobylon.com/embedder.js';
  el.type = 'text/javascript';
  el.async = true;
  d = (document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0]);
  d.appendChild(el);
})();`).body[0])

export function verifyBaswareHandoff(html, { completePublicScope = false } = {}) {
  const doc = readVisibleNativeDocument(html, { strict: true })
  requireNative(doc.nodes(node => node.tag === 'base').length === 0, 'Basware unexpected base URL')
  one(doc.nodes(node => node.attrs.id === 'jobylon-jobs-widget'), 'visible widget target')
  const scripts = doc.nodes(executable).filter(node => /\bjbl_group_id\b/.test(node.raw || ''))
  const script = one(scripts, 'current Jobylon configuration')
  const ast = parseBoundedProgram(script.raw)
  requireNative(ast.body.length >= 4, 'Basware unreviewed widget configuration')
  const expected = [['jbl_group_id', 195], ['jbl_version', 'v2'], ['jbl_page_size', 5]]
  for (const [index, [name, value]] of expected.entries()) {
    const statement = ast.body[index], declaration = statement.declarations?.[0]
    requireNative(statement.type === 'VariableDeclaration' && statement.declarations.length === 1
      && declaration.id.type === 'Identifier' && declaration.id.name === name
      && declaration.init?.type === 'Literal' && declaration.init.value === value,
    'Basware current employer group/widget settings changed')
  }
  requireNative(astKey(ast.body.at(-1)) === loaderAST, 'Basware current widget loader changed')
  if (completePublicScope) {
    requireNative(ast.body.length === 4, 'Basware filtered or additional widget configuration')
    const sourceScripts = readBaswareRawScripts(html).filter(node => !node.attrs.src
      && /\bjbl_(?:filters|widgets|company_id|group_id|version|host|page_size)\b/.test(node.raw))
    requireNative(sourceScripts.length === 1 && isReviewedBaswareClassicScript(sourceScripts[0])
      && sourceScripts[0].raw === script.raw,
      'Basware additional active Jobylon account/filter override')
  }
}

const memberPath = node => {
  if (node?.type === 'Identifier') return [node.name]
  requireNative(node?.type === 'MemberExpression' && !node.optional, 'Basware unreviewed widget assignment')
  const property = node.computed ? node.property.type === 'Literal' ? node.property.value : null
    : node.property.type === 'Identifier' ? node.property.name : null
  requireNative(['string', 'number'].includes(typeof property) && !['__proto__', 'prototype', 'constructor'].includes(String(property)),
    'Basware unreviewed widget property')
  return [...memberPath(node.object), String(property)]
}

export function parseBaswareListing(html) {
  const doc = readNativeDocument(html)
  const script = one(doc.nodes(executable).filter(node => /JBL\.embed_v2\[['"]jobs['"]\]/.test(node.raw || '')), 'native widget inventory')
  const ast = parseBoundedProgram(script.raw), values = new Map()
  const prelude = parseBoundedProgram('if (typeof JBL === "undefined" || JBL === null) { window.JBL = {}; }').body[0]
  requireNative(astKey(ast.body[0]) === astKey(prelude), 'Basware native widget initialization changed')
  const reviewedAssignments = ['', 'is_company_group', 'companies', 'categories', 'departments', 'experiences',
    'functions', 'employment_types', 'languages', 'layer_headers', 'layer_headers.1', 'layer_headers.2', 'layer_headers.3',
    'availableLayers', 'availableLayers.layers_1', 'availableLayers.layers_2', 'availableLayers.layers_3', 'locations', 'workspaces', 'jobs']
  requireNative(ast.body.length === reviewedAssignments.length + 1, 'Basware unreviewed native inventory mutation')
  for (const [index, statement] of ast.body.slice(1).entries()) {
    const assignment = statement.type === 'ExpressionStatement' && statement.expression
    requireNative(assignment?.type === 'AssignmentExpression' && assignment.operator === '=', 'Basware unreviewed inventory execution')
    const path = memberPath(assignment.left)
    requireNative(path.length >= 2 && path[0] === 'JBL' && path[1] === 'embed_v2', 'Basware foreign inventory assignment')
    const key = path.slice(2).join('.')
    requireNative(key === reviewedAssignments[index] && !values.has(key), 'Basware unreviewed or repeated inventory assignment')
    values.set(key, parseRemoteLiteral(script.raw.slice(assignment.right.start, assignment.right.end)))
  }
  requireNative(JSON.stringify(values.get('')) === '{}', 'Basware native inventory initialization is not empty')
  requireNative(values.get('is_company_group') === true && JSON.stringify(values.get('companies')) === '["Basware"]',
    'Basware native group employer changed')
  const rows = values.get('jobs')
  requireNative(Array.isArray(rows) && rows.length <= 500, 'Basware native job inventory is missing or oversized')
  const ids = new Set()
  const records = rows.map(row => {
    requireNative(row && /^\d+$/.test(row.id) && !ids.has(row.id) && norm(row.title)
      && row.company === 'Basware' && row.company_id === '1689' && row.is_internal === false
      && row.klass?.internal === false, 'Basware malformed, duplicate, internal or foreign employer role')
    ids.add(row.id)
    const url = new URL(row.url, ROLE_ORIGIN)
    requireNative(url.origin === ROLE_ORIGIN && !url.username && !url.password && !url.search && !url.hash
      && url.pathname.startsWith(`/jobs/${row.id}-basware-`) && url.pathname.endsWith('/'), 'Basware native role URL identity changed')
    // Geography uncertainty disables the complete public-scope claim later;
    // it must not discard independent positive details from other native rows.
    return { id: row.id, title: row.title, url: url.href,
      locations: Array.isArray(row.locations) ? row.locations.filter(value => typeof value === 'string') : [],
      countries: Array.isArray(row.departments) ? row.departments.filter(value => typeof value === 'string').map(value => value.split(' - ')[0]) : [],
      nativeRecord: row }
  })
  // A reviewed current controller must independently prove that this array is
  // complete. Its length is never an upstream-reported company inventory total.
  return { pageNumber: 1, lastPage: 1, nextURL: null, terminationKnown: true,
    reportedTotal: null, observedRows: rows.length, records,
    nativeCountryOfficeTaxonomy: values.get('departments'), nativeLocationTaxonomy: values.get('locations'),
    controllerSources: doc.nodes(node => node.tag === 'script' && node.attrs.src).map(node => node.attrs.src) }
}

const dateFact = value => {
  if (value == null || value === '') return { raw: null, iso: null, precision: null, exact: false }
  requireNative(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|\+00:00)$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 19) === value.slice(0, 19), 'Basware invalid original native date')
  return { raw: value, iso: new Date(value).toISOString(), precision: 'second', exact: true }
}
const contentKey = html => {
  const doc = readVisibleNativeDocument(html, { strict: true })
  return doc.text(one(doc.nodes(node => node.tag === 'root'), 'description root')).replace(/\s/g, '')
}

export function parseBaswareDetail(html, row) {
  const visible = readVisibleNativeDocument(html, { strict: true }), raw = document(html)
  requireNative(visible.nodes(node => node.tag === 'base').length === 0, 'Basware unexpected detail base URL')
  const roleNode = one(visible.nodes(node => visible.hasClass(node, 'job-id-' + row.id)), 'role identity')
  requireNative(!/\b(?:this (?:job|position|requisition) is no longer (?:available|active)|(?:this )?position (?:has been|is) filled|this (?:job|position) (?:has been|is) closed)\b/i.test(visible.text(roleNode)),
    'Basware native role visibly closed')
  const title = visible.text(one(visible.nodes(node => node.tag === 'h1' && visible.hasClass(node, 'job-title')), 'visible title'))
  const schema = JSON.parse(one(visible.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json'), 'native JobPosting').raw)
  requireNative(schema['@type'] === 'JobPosting' && same(title, row.title) && same(schema.title, row.title)
    && schema.hiringOrganization?.name === 'Basware' && schema.hiringOrganization.sameAs === 'https://www.basware.com/',
  'Basware native title/employer identity contradiction')
  const descriptionPart = className => {
    const box = one(visible.nodes(node => visible.hasClass(node, className)), 'visible ' + className)
    const content = one(descendants(box, node => visible.hasClass(node, 'span10') && visible.hasClass(node, 'offset1')), 'role content')
    const rawBox = one(raw.nodes(node => raw.hasClass(node, className)), 'original ' + className)
    const rawContent = one(descendants(rawBox, node => raw.hasClass(node, 'span10') && raw.hasClass(node, 'offset1')), 'original role content')
    requireNative(same(visible.text(content), raw.text(rawContent)), 'Basware hidden role text differs from native content')
    const heading = one(children(rawContent).filter(node => node.tag === 'h2'), 'native section heading')
    const text = raw.inner(rawContent).replace(raw.outer(heading), '')
    requireNative(contentKey(text).length >= 80, 'Basware incomplete role description/qualifications')
    return text
  }
  const sourceDescription = descriptionPart('canvas-job-description') + '\n' + descriptionPart('canvas-skills')
  requireNative(typeof schema.description === 'string' && contentKey(sourceDescription) === contentKey(schema.description),
    'Basware visible/structured full description mismatch')
  const locations = Array.isArray(schema.jobLocation) ? schema.jobLocation : [schema.jobLocation]
  requireNative(locations.length > 0 && locations.length <= 32, 'Basware native locations missing')
  const nativeAddresses = verifyBaswareDetailAddresses(locations, row)
  const indiaAddresses = nativeAddresses.filter(address => address.country === 'India').map(address => address.raw)
  requireNative(indiaAddresses.length > 0 && indiaAddresses.every(address => norm(address.addressLocality)
    && (address.addressCountry == null || nativeCountryName(address.addressCountry) === 'India')
    && row.nativeRecord.departments.some(label => same(label, 'India - ' + address.addressLocality))),
  'Basware explicit native India address unavailable or contradictory')
  const locationBox = one(visible.nodes(node => visible.hasClass(node, 'canvas-location')), 'visible workplace')
  const locationLabel = one(descendants(locationBox, node => node.tag === 'span' && typeof node.attrs.title === 'string'), 'visible workplace label')
  const label = visible.text(locationLabel)
  const multipleLocations = row.locations.length > 1 && locations.length > 1 && label === 'Multiple locations'
  requireNative(multipleLocations || row.locations.length === 1 && same(label, row.locations[0])
    && same(locationLabel.attrs.title, row.locations[0]) && indiaAddresses.every(address => same(label, address.addressLocality)),
  'Basware visible/native workplace mismatch')
  const expectedApplication = `/applications/jobs/${row.id}/create/`
  const applications = visible.nodes(node => node.tag === 'a' && /\/applications\/jobs\//.test(node.attrs.href || ''))
  requireNative(applications.length > 0 && applications.every(node => !Object.hasOwn(node.attrs, 'disabled')
    && node.attrs['aria-disabled']?.toLowerCase() !== 'true' && !visible.hasClass(node, 'disabled')
    && new URL(node.attrs.href, row.url).href === ROLE_ORIGIN + expectedApplication),
    'Basware role application identity changed')
  const posted = dateFact(schema.datePosted), closing = dateFact(schema.validThrough)
  requireNative(posted.iso && (!closing.iso || closing.iso >= posted.iso), 'Basware native publication/expiry unavailable or contradictory')
  return { id: row.id, title, sourceURL: row.url, nativeListingRecord: row, nativeJobPosting: schema,
    nativeHiringOrganization: schema.hiringOrganization,
    nativeCountryAddresses: nativeAddresses,
    nativeVisibleLocationTexts: row.locations, nativeSchemaDescription: schema.description,
    nativeVisibleDescriptionHTML: sourceDescription, nativePostedDate: posted, nativeValidThrough: closing,
    nativeApplicationURL: ROLE_ORIGIN + expectedApplication, sourceScopeComplete: false, legalEmployer: null }
}

const config = {
  source: 'basware', companyName: 'Basware', boardURL: WIDGET_URL,
  maxRequests: 64, detailConcurrency: 2, maxAggregateBytes: 16 * 1024 * 1024,
  expectedContentType: url => BASWARE_PROOF_URLS.includes(url) ? 'text/javascript' : 'text/html',
  validateURL(value) {
    const url = new URL(value)
    requireNative(value === CAREERS_URL || value === WIDGET_URL || BASWARE_PROOF_URLS.includes(value) || url.origin === ROLE_ORIGIN
      && !url.username && !url.password && !url.search && !url.hash && /^\/jobs\/\d+-basware-[a-z0-9-]+\/$/.test(url.pathname),
    'Basware unreviewed request URL')
  },
  sameReadIdentity: (before, after) => before === after,
  handoffs: [{ url: CAREERS_URL, verify: verifyBaswareHandoff }],
  verifyCompletePublicHandoff: html => verifyBaswareHandoff(html, { completePublicScope: true }),
  parseListing: parseBaswareListing,
  pageFingerprint: page => JSON.stringify(page.records.map(row => row.nativeRecord)),
  candidateForIndia: row => row.countries.includes('India'),
  parseDetail: parseBaswareDetail,
}

export const createBaswareScraper = () => {
  const collect = options => collectBaswarePublicInventory(config, options)
  return { collect, async run(options = {}) {
    const evidence = await collect(options)
    if (!evidence.handoffVerified || evidence.jobs.length === 0 && !evidence.sourceScopeComplete) {
      throw Object.assign(new Error('Basware native inventory unavailable; public inventory incomplete'),
        { name: 'NativeHTMLIncompleteError', code: 'NATIVE_HTML_INCOMPLETE', softFailure: true,
          abortRetries: true, failureKind: 'coverage_gap', nativeEvidence: evidence })
    }
    const jobs = projectBaswarePublicInventory(evidence, config)
    Object.defineProperty(jobs, evidenceKey, { value: evidence })
    return jobs
  } }
}
