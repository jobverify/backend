import { createHash } from 'node:crypto'
import { parse } from 'acorn'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { findExplicitNativeClosure, readNativeStatusTextBlocks } from '../../scraper-support/utils/sourceAvailability.js'
import { readLiteralModel } from '../../scraper-support/native-sources/literalModel.js'
import { nativeHTMLText, criteria } from '../../scraper-support/native-sources/declaredGreenhouse/nativeData.js'
import { rawScriptNodes, rawElementNodes, executableScripts, executionKind } from './scriptExecution.js'
export { rawScriptNodes } from './scriptExecution.js'

export const HOME = 'https://biofourmis.com/'
export const GENERAL = 'https://biofourmis.com/about/job-openings'
export const CLINICAL = 'https://biofourmis.com/about/clinical-job-openings'
export const LOADER = 'https://c27rhq.csb.app/get-jobs.js'
export const BOARD = 'https://job-boards.greenhouse.io/biofourmis'
export const API = 'https://boards-api.greenhouse.io/v1/boards/biofourmis'
export const LOADER_SHA256 = 'cadd78c6e28f5a0795a15c9f1da6b25dd26845b21191e5d5d5d4c8ee7fe7d798'
export const PUBLIC_SCOPE = 'current-Biofourmis-homepage-advertised-public-careers-surfaces-and-unfiltered-Greenhouse-biofourmis'
export const sha256 = value => createHash('sha256').update(value).digest('hex')
const norm = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const need = (condition, message) => { if (!condition) throw Error('Biofourmis public inventory: ' + message) }
const one = (nodes, message) => { need(nodes.length === 1, message);return nodes[0] }
const firstParty = url => url.protocol === 'https:' && ['biofourmis.com', 'www.biofourmis.com'].includes(url.hostname)
  && !url.username && !url.password && !url.port
const careersURL = url => firstParty(url) && !url.search && !url.hash && [GENERAL, CLINICAL].includes(HOME.slice(0, -1) + url.pathname)
const sameBoard = url => url.href === BOARD || url.href === BOARD + '/'
const recruiting = /\b(?:careers?|jobs|open roles|open positions|job openings|apply now|vacancies|join our team)\b/i
const ats = /(?:greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|smartrecruiters\.com|workable\.com|icims\.com|taleo\.net|rippling\.com|jobvite\.com|bamboohr\.com|teamtailor\.com|recruitee\.com)/i
const recruitingURL = url => ats.test(url.hostname) || /^(?:jobs?|careers?|recruiting)\./i.test(url.hostname)
  || /\/(?:careers?|jobs?|apply|vacancies|open[-_]roles|open[-_]positions)(?:[\/_-]|$)/i.test(url.pathname)

export const advertisedClinical = (html, base) => {
  const doc = readNativeDocument(html || '')
  return doc.nodes(node => node.tag === 'a' && node.attrs.href).some(node => {
    try { const url = new URL(node.attrs.href, base);return careersURL(url) && url.pathname === '/about/clinical-job-openings' } catch { return false }
  })
}

export function inspectPublicPage(html, url, { homepage = false } = {}) {
  // Validate the common raw-text grammar before the shared visible-tree reader
  // can supply identity, links, or absence evidence from this same source.
  const scripts = executableScripts(html), doc = readNativeDocument(html), titles = doc.nodes(node => node.tag === 'title')
  need(titles.length === 1 && (homepage ? /\bBiofourmis\b/.test(titles[0].raw || '')
    : /^(?:Clinical )?Job Openings(?:\s*\|\s*Biofourmis)?$/i.test(norm(titles[0].raw))), 'current employer page title changed')
  const canonical = one(doc.nodes(node => node.tag === 'link' && (node.attrs.rel || '').toLowerCase() === 'canonical'), 'unique employer canonical unavailable')
  const canonicalURL = new URL(canonical.attrs.href)
  need(firstParty(canonicalURL) && canonicalURL.pathname === new URL(url).pathname && !canonicalURL.search && !canonicalURL.hash,
    'current employer canonical changed')
  const anchors = doc.nodes(node => node.tag === 'a' && node.attrs.href)
  if (homepage) need(anchors.some(node => {
    try { const target = new URL(node.attrs.href, url);return careersURL(target) && target.pathname === '/about/job-openings' } catch { return false }
  }), 'current homepage no longer advertises the configured careers page')
  const loaders = scripts.filter(node => {
    try { return new URL(node.attrs.src, url).href === LOADER } catch { return false }
  })
  if (!homepage) need(loaders.length === 1 && executionKind(loaders[0]) === 'classic', 'unique executable classic careers loader unavailable')
  const additional = []
  const inspect = (raw, label = '') => {
    let target
    try { target = new URL(raw, url) } catch { return }
    if (!['http:', 'https:'].includes(target.protocol)) return
    if (careersURL(target) || sameBoard(target) || target.href === LOADER) return
    if (firstParty(target) && target.pathname === '/' && !target.search) return
    if (recruitingURL(target) || recruiting.test(label)) additional.push(target.href)
  }
  for (const node of doc.nodes(node => ['a', 'form', 'iframe', 'embed', 'object'].includes(node.tag))) {
    const raw = node.attrs.href || node.attrs.action || node.attrs.src || node.attrs.data
    if (raw) inspect(raw, node.tag === 'a' ? doc.text(node) : '')
    if (node.tag === 'iframe' && Object.hasOwn(node.attrs, 'srcdoc')) additional.push('unreviewed-inline-frame')
  }
  for (const node of scripts) {
    if (node.attrs.src) { inspect(node.attrs.src);continue }
    // Inspect literal configuration URLs without evaluating expressions or JS.
    // Inert data blocks and strings that merely contain example source are not
    // recursively interpreted as code.
    const ast = parse(node.raw, { ecmaVersion: 'latest', sourceType: executionKind(node) === 'module' ? 'module' : 'script' })
    const visit = value => {
      if (!value || typeof value !== 'object') return
      if (value.type === 'Literal') { if (typeof value.value === 'string' && /^(?:https?:\/\/|\/)/i.test(value.value)) inspect(value.value);return }
      for (const child of Object.values(value)) if (Array.isArray(child)) child.forEach(visit);else if (child && typeof child === 'object') visit(child)
    }
    visit(ast)
  }
  return { clinicalAdvertised: advertisedClinical(html, url), additional: [...new Set(additional)], loaderDeclared: loaders.length === 1 }
}

// The retained current native board has exactly these auxiliary script bodies:
// history/scroll restoration, literal ENV, and the reviewed module bootstrap.
// Their bytes do not mutate the literal job model. Unknown additional source,
// including aliases through document.defaultView, withholds this optional proof.
const nativeAuxiliaryScripts = new Map([
  ['82a0347349654ed2e47c9310918775b144d9da4367eae0f8634c74504a071097', 'classic'],
  ['34b8d4d0ebe91a0e5b8c77d833b48cf00d1e516ed2fed6ab8cb6b22b62d247bb', 'classic'],
  ['e32555ea8abc0269156dd51bc104ad9e61e1181d7fee24432783b6168a43dfc9', 'module'],
])
const nativeModel = (html, isJob) => {
  const models = [], seenAuxiliary = new Set()
  for (const node of rawScriptNodes(html)) {
    const kind = executionKind(node)
    if (!kind) continue
    need(!Object.hasOwn(node.attrs, 'src'), 'unreviewed external native script declaration')
    const ast = parse(node.raw, { ecmaVersion: 'latest', sourceType: kind === 'module' ? 'module' : 'script' })
    const hash = sha256(node.raw)
    if (nativeAuxiliaryScripts.has(hash)) {
      need(nativeAuxiliaryScripts.get(hash) === kind && !seenAuxiliary.has(hash), 'native auxiliary script mode/count changed')
      seenAuxiliary.add(hash);continue
    }
    const statement = ast.body.length === 1 ? ast.body[0] : null
    const assignment = statement?.type === 'ExpressionStatement' ? statement.expression : null
    const left = assignment?.left
    need(kind === 'classic' && assignment?.type === 'AssignmentExpression' && assignment.operator === '='
      && left?.type === 'MemberExpression' && left.computed === false && left.object?.type === 'Identifier'
      && left.object.name === 'window' && left.property?.type === 'Identifier' && left.property.name === '__remixContext'
      && assignment.right?.type === 'ObjectExpression', 'unreviewed native script statement, model alias or mutation')
    models.push(readLiteralModel(node.raw.slice(assignment.right.start, assignment.right.end)).value)
  }
  const model = one(models, 'unique whole-script native model initializer unavailable')
  const data = model.state?.loaderData, root = data?.root
  need(model.state?.errors === null && root?.internal === false && root.preview === false && root.urlToken === 'biofourmis'
    && root.isJobPost === isJob && root.boardConfiguration?.job_board_id === 4006066007
    && root.boardConfiguration.job_board_public_url === BOARD, 'current native board/model identity changed')
  return data
}

export function verifyHostedBoard(html, feed) {
  const data = nativeModel(html, false), route = data['routes/$url_token'], posts = route?.jobPosts
  need(route?.urlToken === 'biofourmis' && route.board?.name === 'Biofourmis' && route.board.public_url === BOARD
    && route.board.redirect_to === null, 'native hosted employer identity changed')
  need(['departmentIds', 'officeIds'].every(key => Array.isArray(route[key]) && route[key].length === 0)
    && route.customFieldFilters && Object.keys(route.customFieldFilters).length === 0, 'native hosted board is filtered')
  need(posts && Number.isSafeInteger(posts.total) && posts.total === feed?.meta?.total && posts.page === 1
    && Array.isArray(posts.data) && posts.count === posts.data.length && posts.count === Math.min(50, posts.total)
    && posts.total_pages === (posts.total === 0 ? 0 : Math.ceil(posts.total / 50)), 'native hosted count/pagination disagrees with full API inventory')
  const ids = new Set()
  for (const row of posts.data) {
    const original = feed.jobs.find(record => record.id === row.id)
    need(original && !ids.has(row.id) && row.title === original.title && row.absolute_url === original.absolute_url
      && row.internal_job_id === original.internal_job_id && row.location === original.location?.name, 'native hosted posting identity conflicts')
    ids.add(row.id)
  }
  const doc = readNativeDocument(html)
  need(doc.nodes(node => node.tag === 'h1' && doc.text(node) === 'Current openings at Biofourmis').length === 1,
    'native hosted visible employer identity unavailable')
  return { total: posts.total, displayedCount: posts.count }
}

export function verifyHostedDetail(html, native, observedAt) {
  const data = nativeModel(html, true), route = data['routes/$url_token_.jobs_.$job_post_id'], post = route?.jobPost
  need(route?.urlToken === 'biofourmis' && String(route.jobPostId) === String(native.id) && post?.post_type === 'job_post'
    && post.company_name === 'Biofourmis' && post.hiring_plan_id === native.internal_job_id && post.public_url === native.absolute_url
    && post.title === native.title && post.job_post_location === native.location?.name && post.redirect_to === null,
  'native hosted role/employer/location identity conflicts')
  need(route.submitPath === `https://boards.greenhouse.io/biofourmis/jobs/${native.id}`
    && route.confirmationPath === `/biofourmis/jobs/${native.id}/confirmation`, 'native application route identity conflicts')
  need((post.published_at ?? null) === (native.first_published ?? null), 'native original publication date conflicts')
  need((post.application_deadline ?? null) === (native.application_deadline ?? null), 'native closing date conflicts')
  if (post.application_deadline != null) need(Number.isFinite(Date.parse(post.application_deadline))
    && Date.parse(post.application_deadline) > Date.parse(observedAt), 'native application deadline passed or unqualified')
  const doc = readVisibleNativeDocument(html, { strict: true, statusLayout: true })
  const statusNodes = predicate => doc.statusNodes(predicate)
  const header = one(statusNodes(node => doc.hasClass(node, 'job__header')), 'unique native role header unavailable')
  const descriptions = one(statusNodes(node => doc.hasClass(node, 'job__description')), 'unique native description unavailable')
  const form = one(statusNodes(node => node.tag === 'form' && node.attrs.id === 'application-form'), 'unique native application form unavailable')
  const within = (root, node) => root === node || root.children?.some(child => typeof child !== 'string' && within(child, node))
  need(doc.text(one(doc.nodes(node => node.tag === 'h1' && within(header, node)), 'native title unavailable')) === native.title
    && doc.text(one(doc.nodes(node => doc.hasClass(node, 'job__location') && within(header, node)), 'native location unavailable')) === norm(native.location.name),
  'native visible title/location conflicts')
  const originalElements = rawElementNodes(html), originalForms = originalElements.filter(node => node.tag === 'form')
  need(originalElements.filter(node => node.attrs.id === form.attrs.id).length === 1 && originalForms.length === 1
    && doc.nodes(node => node.attrs.id === form.attrs.id).length === 1
    && !statusNodes(node => node.tag === 'form' && node !== form && within(form, node)).length,
  'native application form owner is ambiguous')
  const sameAttributes = (original, rendered, names) => names.every(name => Object.hasOwn(original.attrs, name) === Object.hasOwn(rendered.attrs, name)
    && original.attrs[name] === rendered.attrs[name])
  need(sameAttributes(originalForms[0], form, ['id', 'action', 'method']), 'native raw/rendered form attributes differ')
  const potentialSubmit = node => node.tag === 'button' && !['button', 'reset'].includes((node.attrs.type || '').toLowerCase())
    || node.tag === 'input' && ['submit', 'image'].includes((node.attrs.type || '').toLowerCase())
  // Explicit form ownership can make an outside button submit this form, or
  // make a descendant button submit a different form. Count both situations.
  const submits = statusNodes(potentialSubmit).filter(node => within(form, node) || node.attrs.form === form.attrs.id)
  const submit = one(submits, 'unique native application submitter unavailable')
  const originalSubmit = one(originalElements.filter(potentialSubmit), 'unique original native application submitter unavailable')
  need(originalSubmit.tag === submit.tag && sameAttributes(originalSubmit, submit, ['type', 'form', 'formaction', 'formmethod', 'disabled', 'aria-disabled']),
    'native raw/rendered submitter attributes differ')
  const visible = doc.nodes(node => node === submit).length === 1
  const ownsForm = Object.hasOwn(submit.attrs, 'form') ? submit.attrs.form === form.attrs.id : within(form, submit)
  const disabledAncestor = doc.nodes(node => node.tag === 'fieldset' && Object.hasOwn(node.attrs, 'disabled') && within(node, submit)).length > 0
  const effectiveMethod = (Object.hasOwn(submit.attrs, 'formmethod') ? submit.attrs.formmethod : form.attrs.method || 'get').toLowerCase()
  const action = Object.hasOwn(submit.attrs, 'formaction') ? submit.attrs.formaction : form.attrs.action || native.absolute_url
  // Absolute reviewed routes are independent of document base elements. A
  // relative action with a base declaration needs an unreviewed URL context.
  if (!/^https?:\/\//i.test(action)) need(!/<base(?=[\t\n\f\r />])/i.test(html), 'unreviewed relative application action/base URL')
  const effectiveAction = new URL(action, native.absolute_url).href
  need(visible && ownsForm && !Object.hasOwn(form.attrs, 'inert') && !disabledAncestor
    && !Object.hasOwn(submit.attrs, 'disabled') && (submit.attrs['aria-disabled'] || '').toLowerCase() !== 'true'
    && submit.tag === 'button' && /submit|apply/i.test(doc.text(submit)) && effectiveMethod === 'post'
    && [native.absolute_url, route.submitPath].includes(effectiveAction), 'native effective application submitter is unavailable, disabled, or leaves the own role')
  const blocks = [header, descriptions, form, submit].flatMap(readNativeStatusTextBlocks)
  need(!findExplicitNativeClosure(blocks), 'native role advertises closure')
  const full = criteria(native).jobDescription
  need(full && nativeHTMLText(post.content) === nativeHTMLText(native.content)
    && norm(doc.text(descriptions)) === norm([nativeHTMLText(post.introduction), full, nativeHTMLText(post.conclusion)].filter(Boolean).join(' ')),
  'complete native criteria differ from the visible published role')
  return { nativeHostedRecord: structuredClone(post), fullPublishedDescription: doc.text(descriptions),
    application: { state: 'public-form-available', submitted: false, postId: String(native.id),
      formAction: new URL(form.attrs.action || native.absolute_url, native.absolute_url).href, submitPath: route.submitPath,
      effectiveAction, effectiveMethod, formOwner: form.attrs.id, observedAt } }
}
