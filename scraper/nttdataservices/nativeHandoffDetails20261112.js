import { createHash } from 'node:crypto'
import { parse } from 'acorn'
import { activeHead, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { mapJobsWithInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { REVIEWED_NTT_NATIVE_HANDOFFS_20261112 } from './reviewedNativeHandoffs20261112.js'

const norm = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const requireNative = (ok, message) => { if (!ok) throw Error('NTT native handoff: ' + message) }
const one = (values, label) => { requireNative(values.length === 1, 'Expected one ' + label); return values[0] }
const memberPath = node => node?.type === 'Identifier' ? node.name
  : node?.type === 'MemberExpression' && !node.computed ? memberPath(node.object) + '.' + node.property.name : null
const literalProperty = (node, name) => {
  requireNative(node?.type === 'ObjectExpression', 'Nonliteral native application configuration')
  const properties = node.properties.filter(property => property.type === 'Property' && !property.computed
    && (property.key.name ?? property.key.value) === name)
  const property = one(properties, 'native ' + name)
  requireNative(property.kind === 'init' && !property.method && property.value.type === 'Literal', 'Nonliteral native ' + name)
  return property.value.value
}
const nativeApplication = d => {
  const tenants = [], roleIds = []
  const walk = node => {
    if (!node || typeof node !== 'object') return
    if (node.type === 'CallExpression') {
      const name = memberPath(node.callee)
      if (name === 'j2w.init') tenants.push(literalProperty(node.arguments[0], 'ssoCompanyId'))
      if (name === 'j2w.Apply.init') roleIds.push(literalProperty(node.arguments[0], 'jobID'))
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk)
      else if (value && typeof value === 'object') walk(value)
    }
  }
  for (const script of d.nodes(node => node.tag === 'script' && !node.attrs.src
    && ['', 'text/javascript', 'application/javascript', 'module'].includes((node.attrs.type || '').toLowerCase()))) {
    let ast
    try { ast = parse(script.raw || '', { ecmaVersion: 'latest', sourceType: script.attrs.type === 'module' ? 'module' : 'script' }) }
    catch { continue }
    walk(ast)
  }
  return { tenant: one(tenants, 'native tenant'), roleId: String(one(roleIds, 'native application role ID')) }
}
export const parseReviewedNttSolutionsDetail = (html, binding) => {
  requireNative(typeof html === 'string' && html.length < 2000000, 'Missing or oversized native page')
  const d = readNativeDocument(html), head = activeHead(html)
  const canonical = one(d.nodes(node => node.tag === 'link' && (node.attrs.rel || '').toLowerCase().split(/\s+/).includes('canonical')), 'native canonical').attrs.href
  requireNative(canonical === binding.canonical, 'Native canonical role mismatch')
  const application = nativeApplication(d)
  requireNative(application.tenant === 'itelliP' && application.roleId === binding.nativeRoleId, 'Native tenant/application role mismatch')
  const scope = one(d.nodes(node => Object.hasOwn(node.attrs, 'itemscope') && /^https?:\/\/schema\.org\/JobPosting\/?$/.test(node.attrs.itemtype || '')), 'active native JobPosting')
  const title = d.text(one(d.nodes(node => node.attrs.itemprop === 'title', scope), 'native role title'))
  const ogTitle = one(head.metas.filter(meta => meta.property === 'og:title'), 'native head title').content
  requireNative(title === binding.nativeTitle && ogTitle === title
    && one(head.titles, 'native document title') === title + ' Job Details | NTT DATA', 'Native title mismatch')
  const suppliedCountries = d.nodes(node => node.attrs.itemprop === 'addressCountry')
    .map(node => norm(node.attrs.content ?? d.text(node)))
  requireNative(suppliedCountries.every(country => ['India', 'IN'].includes(country)), 'Native country contradicts verified Phenom India office')
  requireNative(!/(?:job (?:is )?no longer available|position has been filled|this (?:job|position) is no longer active)/i.test(d.text(one(d.nodes(node => node.tag === 'root'), 'active native page'))), 'Native role is closed')
  const footer = one(d.nodes(node => node.attrs.id === 'unifyJobFooter'), 'active native job footer')
  const description = one(d.nodes(node => node.attrs.itemprop === 'description', footer).map(node => d.text(node)).filter(Boolean), 'authored footer description')
  requireNative(description.length >= 200 && (description.match(/\p{L}[\p{L}\p{N}'_-]*/gu) || []).length >= 30, 'Native footer has no substantive description')
  requireNative(createHash('sha256').update(description).digest('hex') === binding.descriptionSha256, 'Unreviewed native footer body')
  return { title, description, application }
}

export const enrichNttSolutionsNativeHandoffs = async (jobs, { fetchText, signal } = {}) => {
  const replacements = new Map()
  for (const [index, job] of jobs.entries()) {
    signal?.throwIfAborted()
    if (job.source !== 'nttdataservices' || job.country !== 'India'
      || job.sourceDetailComplete !== false || job.sourceDetailFailureKind !== 'missing-content') continue
    const binding = REVIEWED_NTT_NATIVE_HANDOFFS_20261112.find(row => row.jobId === job.jobId
      && row.phenomUrl === job.sourceUrl && row.phenomTitle === job.title && row.handoffUrl === job.applyUrl)
    if (!binding) continue
    try {
      const html = await fetchText(binding.handoffUrl, { signal, expectedOrigin: 'https://careers.nttdata-solutions.com' })
      signal?.throwIfAborted()
      const native = parseReviewedNttSolutionsDetail(html, binding)
      const enriched = { ...job, title: native.title, jobDescription: native.description, sourceDescription: native.description,
        sourceDetailComplete: true, sourceNativeHandoffEvidence: {
          sourceUrl: binding.handoffUrl, canonical: binding.canonical, tenant: native.application.tenant,
          nativeRoleId: native.application.roleId, nativeTitle: native.title, phenomTitle: job.title,
          descriptionCarrier: 'active-native-unifyJobFooter-description', descriptionSha256: binding.descriptionSha256,
          countryEvidence: 'independently-validated-phenom-native-India-office',
          fixture: binding.fixture, observedAt: binding.observedAt,
        } }
      delete enriched.sourceDetailFailureKind
      replacements.set(index, enriched)
    } catch {
      signal?.throwIfAborted()
    }
  }
  return replacements.size ? mapJobsWithInventoryEvidence(jobs, (job, index) => replacements.get(index) || job) : jobs
}

