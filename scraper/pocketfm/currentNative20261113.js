import { createHash } from 'node:crypto'
import { decodeHTML } from 'entities'
import { readNativeDocument, activeHead } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { nativeCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { verifyPocketClientBinding } from './currentClientBinding.js'

const HOME = 'https://pocketfm.com/', BOARD = 'https://jobs.lever.co/pocketfm'
const API = 'https://api.lever.co/v0/postings/pocketfm?mode=json&skip=0&limit=100'
const hash = value => createHash('sha256').update(value).digest('hex')
const norm = value => decodeHTML(String(value || '')).replace(/\s+/g, ' ').trim()
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const need = (ok, why) => { if (!ok) throw Error('Pocket FM current native: ' + why) }
const one = (rows, why) => { need(rows.length === 1, 'expected one ' + why); return rows[0] }
const cls = (node, name) => (node.attrs.class || '').split(/\s+/).includes(name)
const walk = (node, predicate) => typeof node === 'string' ? [] : [...(predicate(node) ? [node] : []), ...node.children.flatMap(child => walk(child, predicate))]
const root = doc => one(doc.nodes(node => node.tag === 'root'), 'native root')
const text = html => { const doc = readNativeDocument(decodeHTML(html)); return norm(doc.text(root(doc))) }
const escape = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const serialize = node => typeof node === 'string' ? node : `<${node.tag}${Object.entries(node.attrs).map(([key, value]) => ` ${key}="${escape(value)}"`).join('')}>${node.children.map(serialize).join('')}</${node.tag}>`
const parentIndex = document => {
  const parents = new Map()
  const index = node => { if (typeof node === 'string') return; for (const child of node.children) { if (typeof child !== 'string') parents.set(child, node); index(child) } }
  index(root(document)); return parents
}
const typography = value => value.split(';').every(rule => !rule.trim() || /^list-style-type\s*:\s*disc\s*$/i.test(rule.trim()))
const criteriaClasses = new Set(['', 'section page-centered', 'text-small italic text-gray-700'])
const fullVisiblePath = (node, parents, criteria = false) => {
  const valid = current => !current.inert && !Object.hasOwn(current, 'raw')
    && (criteria ? typography(current.attrs.style || '') : !(current.attrs.style || '').trim())
  for (let at = node; at; at = parents.get(at)) need(valid(at), 'unreviewed authored criteria or control ancestor styling')
  if (criteria) for (const current of walk(node, () => true)) need(valid(current)
    && criteriaClasses.has(current.attrs.class || ''), 'concealed or unreviewed original authored criteria')
}

// These complete current native CSS bodies were inspected on both role and
// application pages. Only their exact print-only button rule is projected out
// for on-screen visibility. Original criteria and response bytes stay intact.
const THEME = '4dee8e88258c0f66aa4643e77e51c003f8f342ccc754dc398638f380e0f02f32'
const CSS = ['32a37e5c33de1795b1fce8061aadfc9865e68475505b0778aa65fee07af04cf2', 'b94a197de621427f55c7aac107b6e306d1d49325dd1ec481aa16e3071858ab00']
const PRINT_ONLY = '@media print {.postings-btn {display: none !important;}}'
const HANDLER = 'e978a06e04caaec8f18e4379f42d54b0b6ad0e24a561b216fdc831663a688b8a'
const screen = (html, application = false) => {
  const original = readNativeDocument(html), all = walk(root(original), () => true)
  need(equal(all.filter(node => node.tag === 'style').map(node => hash(node.raw || '')), application ? [...CSS, THEME] : [THEME, ...CSS])
    && !original.nodes(node => node.tag === 'link' && node.attrs.rel === 'stylesheet').length
    && html.split(PRINT_ONLY).length === 3, 'unreviewed native stylesheet or print context')
  const projected = html.replaceAll(PRINT_ONLY, '')
  return { raw: readNativeDocument(projected), visible: readVisibleNativeDocument(projected, { strict: true }) }
}
const inventory = html => {
  const rows = JSON.parse(html), ids = new Set()
  const fields = new Set(['additionalPlain', 'additional', 'categories', 'createdAt', 'descriptionPlain', 'description', 'id', 'lists',
    'salaryRange', 'text', 'country', 'workplaceType', 'opening', 'openingPlain', 'descriptionBody', 'descriptionBodyPlain', 'hostedUrl', 'applyUrl'])
  need(Array.isArray(rows) && rows.length < 100 && rows.length > 0, 'unreviewed empty or continued native inventory')
  for (const row of rows) {
    need(/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(row.id || '') && !ids.has(row.id)
      && typeof row.text === 'string' && row.text.trim() && row.hostedUrl === `${BOARD}/${row.id}`
      && row.applyUrl === `${BOARD}/${row.id}/apply` && row.categories && typeof row.categories.location === 'string'
      && Array.isArray(row.categories.allLocations) && row.categories.allLocations.length > 0
      && row.categories.allLocations.every(value => typeof value === 'string' && value.trim())
      && row.categories.allLocations.includes(row.categories.location)
      && Object.keys(row).every(key => fields.has(key))
      && Object.keys(row.categories).every(key => ['commitment', 'department', 'location', 'team', 'allLocations'].includes(key)), 'native employer/role/application identity or fields changed')
    ids.add(row.id)
  }
  return rows
}
const nativeScope = row => {
  const primary = nativeCountryName(row.country), alternatives = row.categories.allLocations
  const countries = alternatives.map(label => label === row.categories.location ? primary : nativeCountryName(label.split(',').at(-1).trim()))
  const unknownGeography = Object.keys(row).some(key => /country|location|office|region|address/i.test(key) && !['country'].includes(key))
    || Object.keys(row.categories).some(key => /country|location|office|region|address/i.test(key) && !['location', 'allLocations'].includes(key))
  return { countries, complete: !unknownGeography && countries.every(Boolean), india: countries.includes('India') }
}
const qualifyNativeCriteria = row => {
  need(['description', 'descriptionBody', 'descriptionPlain', 'descriptionBodyPlain'].every(key => typeof row[key] === 'string')
    && ['opening', 'openingPlain', 'additional', 'additionalPlain'].every(key => row[key] === '')
    && Array.isArray(row.lists) && row.lists.length === 0, 'unreviewed native criteria representation')
  const originals = [row.description, row.descriptionBody].map(html => {
    const document = readNativeDocument(decodeHTML(html))
    fullVisiblePath(root(document), parentIndex(document), true)
    return norm(document.text(root(document)))
  })
  need(originals[0] === originals[1] && norm(row.descriptionPlain) === originals[0]
    && norm(row.descriptionBodyPlain) === originals[0], 'full native criteria representations disagree')
}
const reconcileBoard = (html, rows) => {
  const doc = readVisibleNativeDocument(html, { strict: true })
  need(activeHead(html).titles.includes('Pocket Entertainment Corp'), 'public native employer board changed')
  const cards = doc.nodes(node => cls(node, 'posting'))
  need(cards.length === rows.length, 'native board count or continuation changed')
  const ids = new Set()
  for (const card of cards) {
    const row = rows.find(row => row.id === card.attrs['data-qa-posting-id'])
    need(row && !ids.has(row.id), 'native board identity changed'); ids.add(row.id)
    need(norm(doc.text(one(walk(card, node => node.attrs['data-qa'] === 'posting-name'), 'board title'))) === norm(row.text)
      && norm(doc.text(one(walk(card, node => cls(node, 'location')), 'board location'))) === norm(row.categories.location)
      && walk(card, node => node.tag === 'a' && cls(node, 'posting-title') && node.attrs.href === row.hostedUrl).length === 1, 'native board metadata changed')
  }
}
const role = (html, applicationHtml, row) => {
  qualifyNativeCriteria(row)
  const { raw, visible } = screen(html), parents = parentIndex(raw)
  need(activeHead(html).titles.includes('Pocket Entertainment Corp - ' + row.text)
    && activeHead(html).metas.some(meta => meta.property === 'og:url' && meta.content === row.hostedUrl), 'native role identity changed')
  const schema = JSON.parse(one(raw.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json'), 'native role schema').raw)
  need(Object.keys(schema).every(key => ['@context', '@type', 'title', 'hiringOrganization', 'jobLocation', 'employmentType', 'datePosted', 'description'].includes(key))
    && schema['@context'] === 'http://schema.org' && schema['@type'] === 'JobPosting' && schema.title === row.text
    && schema.hiringOrganization?.['@type'] === 'Organization' && schema.hiringOrganization.name === 'Pocket Entertainment Corp'
    && Object.keys(schema.hiringOrganization).every(key => ['@type', 'name', 'logo'].includes(key))
    && schema.employmentType === row.categories.commitment
    && schema.jobLocation?.['@type'] === 'Place' && Object.keys(schema.jobLocation).every(key => ['@type', 'address'].includes(key))
    && schema.jobLocation.address?.['@type'] === 'PostalAddress'
    && Object.keys(schema.jobLocation.address).every(key => ['@type', 'addressLocality', 'addressRegion', 'addressCountry', 'postalCode'].includes(key))
    && schema.jobLocation.address.addressRegion === null && schema.jobLocation.address.postalCode === null
    && schema.jobLocation?.address?.addressLocality === row.categories.location
    && (!schema.jobLocation.address.addressCountry || nativeCountryName(schema.jobLocation.address.addressCountry) === nativeCountryName(row.country)), 'native title/employer/workplace schema conflict')
  const criteria = walk(root(raw), node => ['job-description', 'salary-range', 'ai-disclaimer'].includes(node.attrs['data-qa']))
  const body = one(criteria.filter(node => node.attrs['data-qa'] === 'job-description'), 'full original criteria')
  const wrapper = parents.get(body), accepted = new Set(['job-description', 'salary-range', 'ai-disclaimer', 'btn-apply-bottom'])
  need(wrapper.children.filter(child => typeof child !== 'string').every(node => accepted.has(node.attrs['data-qa'])), 'unhandled original public criteria section')
  for (const node of criteria) {
    fullVisiblePath(node, parents, true)
    const displayed = one(visible.nodes(candidate => equal(candidate.attrs, node.attrs)), 'visible public original criteria')
    // A visible outer section cannot qualify text hidden on one of its authored
    // children by an already present native stylesheet rule.
    fullVisiblePath(displayed, parentIndex(visible), true)
    need(norm(visible.text(displayed)) === norm(raw.text(node)), 'individual original authored criteria not visible')
  }
  need(text(row.description) === norm(raw.text(body))
    && text(row.description).length > 250, 'full original API/schema/rendered criteria disagree')
  need(one(criteria.filter(node => node.attrs['data-qa'] === 'ai-disclaimer'), 'native public policy'), 'public policy missing')
  const salary = criteria.filter(node => node.attrs['data-qa'] === 'salary-range')
  if (row.salaryRange) {
    need(salary.length === 1 && row.salaryRange.currency === 'INR' && row.salaryRange.interval === 'per-year-salary'
      && Number.isFinite(row.salaryRange.min) && Number.isFinite(row.salaryRange.max)
      && Object.keys(row.salaryRange).every(key => ['currency', 'interval', 'min', 'max'].includes(key)), 'unreviewed native salary criteria')
    const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)
    need(norm(raw.text(salary[0])) === `${money(row.salaryRange.min)} - ${money(row.salaryRange.max)} a year`, 'native salary criteria conflict')
  } else need(!salary.length, 'unreconciled native salary criteria')
  // The current native schema appends literal backslash-n separators and the
  // same displayed salary. Qualify that exact renderer output without dropping
  // or normalizing any authored words from either original representation.
  const nativeSchemaText = text(row.description) + ' \\n \\n' + (salary.length ? ' ' + norm(raw.text(salary[0])) + ' \\n' : '')
  need(text(schema.description) === nativeSchemaText, 'full original schema criteria or salary disagree')
  const links = visible.nodes(node => node.tag === 'a' && node.attrs.href === row.applyUrl)
  need(links.length === 2 && links.every(node => norm(visible.text(node)) === 'Apply for this job'
    && !Object.hasOwn(node.attrs, 'disabled') && !node.attrs['aria-disabled']), 'native role application links unavailable')
  const app = screen(applicationHtml, true), appParents = parentIndex(app.raw)
  need(activeHead(applicationHtml).titles.includes('Pocket Entertainment Corp - ' + row.text)
    && activeHead(applicationHtml).metas.some(meta => meta.property === 'og:url' && meta.content === row.applyUrl), 'public application role identity changed')
  const form = one(app.raw.nodes(node => node.tag === 'form' && node.attrs.id === 'application-form'), 'public application form')
  need(form.attrs.method === 'POST' && !form.attrs.action, 'public application action identity changed')
  const submit = one(app.visible.nodes(node => node.tag === 'button' && node.attrs.id === 'btn-submit'), 'active application button')
  need(norm(app.visible.text(submit)) === 'Submit application', 'public submit label changed')
  const controls = walk(form, node => ['input', 'select', 'textarea', 'button'].includes(node.tag)
    && (Object.hasOwn(node.attrs, 'required') || node.attrs.id === 'btn-submit'))
  need(controls.some(node => node.attrs.name === 'name') && controls.some(node => node.attrs.name === 'email'), 'required application controls unavailable')
  for (const control of controls) {
    fullVisiblePath(control, appParents)
    need(!Object.hasOwn(control.attrs, 'readonly')
      && (!Object.hasOwn(control.attrs, 'aria-readonly') || control.attrs['aria-readonly'].toLowerCase() === 'false'), 'required application control read-only')
    for (let at = control; at; at = appParents.get(at)) need(!((at === control || at.tag === 'fieldset') && Object.hasOwn(at.attrs, 'disabled'))
      && (!Object.hasOwn(at.attrs, 'aria-disabled') || at.attrs['aria-disabled'].toLowerCase() === 'false'), 'public application controls disabled')
    need(app.visible.nodes(node => equal(node.attrs, control.attrs)).length === 1, 'required application control concealed')
  }
  need(app.raw.nodes(node => node.tag === 'script' && node.raw && hash(node.raw) === HANDLER).length === 1, 'unreviewed native public submit binding')
  need(/^\d{4}-\d{2}-\d{2}$/.test(schema.datePosted) && Number.isFinite(Date.parse(schema.datePosted)) && Date.parse(schema.datePosted) <= Date.now(), 'native publication date unavailable')
  const description = criteria.map(serialize).join('\n')
  return { source: 'pocketfm', company: 'Pocket FM', jobId: row.id, requisitionId: row.id, title: row.text,
    sourceUrl: row.hostedUrl, detailUrl: row.hostedUrl, applyUrl: row.applyUrl, link: row.applyUrl,
    country: 'India', location: row.categories.location + ', India', city: row.categories.location, sourceNativeRecord: row,
    sourceNativeCountryAlternatives: nativeScope(row).countries, sourceNativeJobPosting: schema,
    department: row.categories.department, employmentType: row.categories.commitment,
    remoteStatus: ({ onsite: 'On-site', hybrid: 'Hybrid', remote: 'Remote' })[row.workplaceType] || null,
    postingDate: schema.datePosted, closingDate: null, jobDescription: description, sourceDescription: description,
    sourceDetailComplete: true, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
    sourceCompanyScope: 'Current corporate-declared Pocket FM Lever public board only; company-wide recruitment scope unproved' }
}

export async function runCurrentPocketFM(options = {}) {
  const signal = AbortSignal.any([AbortSignal.timeout(240000), ...(options.signal ? [options.signal] : [])])
  const wait = promise => new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(signal.reason) }
    signal.addEventListener('abort', abort, { once: true })
    Promise.resolve(promise).then(value => { signal.removeEventListener('abort', abort); resolve(value) }, error => { signal.removeEventListener('abort', abort); reject(error) })
    if (signal.aborted) abort()
  })
  const responses = [], observed = new Map(), failures = []
  const read = async url => {
    signal.throwIfAborted()
    const page = await wait(Promise.resolve().then(async () => {
      if (options.fetchPage) return options.fetchPage(url, { signal })
      const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]), headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html,application/json,application/javascript' } })
      return { status: response.status, url: response.url, html: await response.text() }
    }))
    signal.throwIfAborted()
    need(page.status === 200 && page.url === url && typeof page.html === 'string' && Buffer.byteLength(page.html) < 8000000, 'public HTTP/final URL/body identity changed')
    responses.push({ url, status: page.status, sha256: hash(page.html), bytes: Buffer.byteLength(page.html) })
    return page.html
  }
  const context = async () => {
    const html = await read(HOME)
    need(activeHead(html).titles.some(title => title.startsWith('Pocket FM:')), 'current corporate identity changed')
    return verifyPocketClientBinding(html, read)
  }
  await context()
  const opening = inventory(await read(API))
  reconcileBoard(await read(BOARD), opening)
  const inspect = async (rows, phase) => {
    for (const row of rows) {
      const scope = nativeScope(row)
      if (!scope.complete) failures.push({ id: row.id, phase, reason: 'unknown native workplace country alternative' })
      if (!scope.india) continue
      try {
        need(nativeCountryName(row.country) === 'India', 'India must be assigned by the native primary country')
        const job = role(await read(row.hostedUrl), await read(row.applyUrl), row)
        if (phase === 'opening') observed.set(row.id, job)
        else if (!equal(observed.get(row.id), job)) failures.push({ id: row.id, phase, reason: 'closing original criteria/application changed' })
      } catch (error) { signal.throwIfAborted(); if (/public HTTP/.test(error.message)) throw error; failures.push({ id: row.id, phase, reason: error.message }) }
    }
  }
  await inspect(opening, 'opening')
  await context()
  const closingBefore = inventory(await read(API))
  reconcileBoard(await read(BOARD), closingBefore)
  await inspect(closingBefore, 'closing')
  const closing = inventory(await read(API)), stable = equal(opening, closingBefore) && equal(opening, closing)
  if (!stable) failures.push({ phase: 'final-inventory', reason: 'native membership/criteria changed after closing details' })
  const bad = new Set(failures.map(row => row.id)), active = new Map(closing.map(row => [row.id, row]))
  let jobs = [...observed.values()].filter(job => !bad.has(job.jobId) && active.has(job.jobId) && equal(job.sourceNativeRecord, active.get(job.jobId)))
  const limited = Number.isSafeInteger(options.maxJobs) && options.maxJobs > 0 && jobs.length > options.maxJobs
  if (limited) jobs = jobs.slice(0, options.maxJobs)
  const complete = stable && !failures.length && !limited
  attachInventoryEvidence(jobs, { status: complete ? 'complete-inventory' : 'coverage-gap', surface: API, firstParty: true,
    listingComplete: complete, lifecycleCleanupAllowed: false, pagesFetched: responses.length, reportedTotal: opening.length,
    indiaFacetCount: complete ? jobs.length : null, verifiedAt: new Date().toISOString(),
    reason: 'Current exact corporate client, terminal native Lever array/board, assigned countries, full original public criteria/salary/policy and usable role-bound application controls; final native membership after closing details; public-board scope only.' })
  attachSourceObservationEvidence(jobs, { source: 'pocketfm', recordKind: 'vacancy-rows', observedRecordCount: opening.length, observedVacancyCount: opening.length, sourceScopeComplete: false })
  const audit = { source: 'pocketfm', opening, closing, observedDetails: [...observed.values()], failures, limited, responses,
    sourceScopeComplete: false, lifecycleCleanupAllowed: false, sourceCompanyWideScopeComplete: false }
  Object.defineProperty(jobs, 'nativeCollectionEvidence', { value: audit, configurable: true })
  Object.defineProperty(jobs, 'sourceAudit', { value: audit, configurable: true })
  signal.throwIfAborted()
  for (const job of jobs) job.scrapedAt = new Date().toISOString()
  return jobs
}
