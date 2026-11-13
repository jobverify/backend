import { createHash } from 'node:crypto'
import { activeHead, decodeNativeEntities, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const HOME = 'https://www.anaptyss.com/'
const CAREERS = HOME + 'careers/openings'
const TAB_CLIENT = HOME + '_next/static/chunks/1sr4oigy47isl.js'
const TAB_CLIENT_SHA = '10353e3fcff9aff0ffea54a071344e1183caf2d7ae91467355c253948c9f30cd'
const hash = value => createHash('sha256').update(value).digest('hex')
const need = (ok, why) => { if (!ok) throw Error('Anaptyss current native: ' + why) }
const one = (rows, label) => { need(rows.length === 1, 'expected one active ' + label); return rows[0] }
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const nodes = (root, predicate) => root.inert ? [] : [...(predicate(root) ? [root] : []), ...root.children.filter(child => typeof child !== 'string').flatMap(child => nodes(child, predicate))]
const cls = (node, value) => (node.attrs.class || '').split(/\s+/).includes(value)
const fact = (doc, root, label) => {
  const groups = nodes(root, node => node.children.some(child => typeof child !== 'string' && child.tag === 'dt' && doc.text(child) === label))
  return doc.text(one(nodes(one(groups, label + ' fact'), node => node.tag === 'dd'), label + ' value'))
}
const canonical = (doc, url) => one(doc.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical' && node.attrs.href === url), 'canonical employer URL')
const cards = html => {
  const doc = readVisibleNativeDocument(html, { strict: true })
  need(activeHead(html).titles.includes('Current Openings | Anaptyss'), 'current careers title changed')
  canonical(doc, CAREERS)
  const rows = doc.nodes(node => node.tag === 'details' && cls(node, 'op-card')).map(node => {
    const summary = one(nodes(node, child => child.tag === 'summary'), 'role summary')
    const title = doc.text(one(nodes(summary, child => child.tag === 'h4'), 'role title'))
    const meta = one(nodes(summary, child => cls(child, 'op-card-meta')), 'role metadata').children.filter(child => typeof child !== 'string' && child.tag === 'span').map(child => doc.text(child))
    const link = one(nodes(node, child => child.tag === 'a' && cls(child, 'op-btn')), 'current role handoff')
    const url = new URL(link.attrs.href, HOME)
    need(title && meta.length === 2 && meta.every(Boolean) && url.origin === new URL(HOME).origin
      && /^\/job-post\/[a-z0-9-]+$/.test(url.pathname) && !url.search && !url.hash, 'current role identity changed')
    return { title, jobType: meta[0], location: meta[1], department: fact(doc, node, 'Industry'), experience: fact(doc, node, 'Work Experience'), dateOpened: fact(doc, node, 'Date Opened'), url: url.href }
  })
  const counts = doc.nodes(node => cls(node, 'op-count')).map(node => Number(doc.text(node).match(/^(\d+) open positions$/)?.[1]))
  need(rows.length > 0 && rows.length <= 200 && counts.length > 0 && counts.every(Number.isSafeInteger)
    && counts.reduce((a, b) => a + b, 0) === rows.length && new Set(rows.map(row => row.url)).size === rows.length,
  'native card count/continuation is incomplete or ambiguous')
  need(!doc.nodes(node => node.tag === 'a' && /next/i.test(node.attrs.rel || '')).length, 'unsupported public inventory continuation')
  return rows
}
const escape = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const serialize = (node, expanded = new Set()) => {
  if (typeof node === 'string') return node
  const content = node.raw ?? node.children.map(child => serialize(child, expanded)).join('')
  if (node.tag === 'root') return content
  const attrs = Object.entries(node.attrs).filter(([key]) => !(key === 'hidden' && expanded.has(node))).map(([key, value]) => ` ${key}="${escape(value)}"`).join('')
  return `<${node.tag}${attrs}>${content}</${node.tag}>`
}
const qualifyCriteriaVisibility = (root, isCriteria) => {
  // Current authored criteria and their ancestors have no inline styling.
  // Decorative icons elsewhere on the page cannot qualify or conceal body text.
  const authored = node => typeof node === 'string' ? /[\p{L}\p{N}]/u.test(decodeNativeEntities(node))
    : ['svg', 'img'].includes(node.tag) ? false : Boolean(node.raw?.trim()) || node.children.some(authored)
  const qualified = node => !node.inert && !Object.hasOwn(node, 'raw') && !(node.attrs.style || '').trim()
  const inspect = node => {
    if (typeof node === 'string' || !authored(node)) return
    need(qualified(node), 'unreviewed styling or concealment of authored criteria')
    node.children.forEach(inspect)
  }
  const visit = (node, ancestors = []) => {
    if (typeof node === 'string') return
    if (isCriteria(node)) {
      need(ancestors.every(qualified), 'unreviewed authored criteria ancestor visibility')
      inspect(node)
      return
    }
    node.children.forEach(child => visit(child, [...ancestors, node]))
  }
  visit(root)
}
const fullCriteria = html => {
  const original = readNativeDocument(html), root = one(original.nodes(node => node.tag === 'root'), 'document')
  const isCriteria = node => cls(node, 'jb-block') || cls(node, 'jb-perks')
  const blocks = original.nodes(isCriteria), expanded = new Set()
  const qualifications = one(blocks.filter(node => nodes(node, child => child.tag === 'h2').some(child => original.text(child) === 'Qualifications')), 'Qualifications section')
  const tabs = one(nodes(qualifications, node => cls(node, 'jb-tabs')), 'published qualification tabs')
  const buttons = nodes(tabs, node => node.tag === 'button' && node.attrs.role === 'tab')
  const panels = tabs.children.filter(child => typeof child !== 'string' && child.attrs.role === 'tabpanel')
  need(equal(buttons.map(node => original.text(node)), ['Educational Qualification', 'Experience', 'Skills']) && panels.length === 3, 'public qualification tabs changed')
  for (const [index, panel] of panels.entries()) {
    const button = buttons[index]
    need(button.attrs['aria-controls'] === panel.attrs.id && panel.attrs['aria-labelledby'] === button.attrs.id
      && panel.attrs.class === 'jb-tabpanel jb-prose' && button.attrs['aria-selected'] === String(index === 0)
      && Object.hasOwn(panel.attrs, 'hidden') === (index !== 0)
      && !Object.hasOwn(panel.attrs, 'inert') && !panel.attrs.style && !panel.attrs['aria-hidden'], 'unbound or concealed public qualification panel')
    expanded.add(panel)
  }
  const projected = serialize(root, expanded), visible = readVisibleNativeDocument(projected, { strict: true }), active = readNativeDocument(projected)
  const visibleBlocks = visible.nodes(isCriteria)
  need(visibleBlocks.length === blocks.length && blocks.length === 4 && visible.nodes(node => node.attrs.role === 'tabpanel' && cls(node, 'jb-tabpanel')).length === 3,
    'full public criteria are hidden or incomplete')
  const heading = doc => doc.nodes(isCriteria).map(node => doc.text(one(nodes(node, child => child.tag === 'h2'), 'criteria heading')))
  need(equal(heading(visible), ['About the role', 'Job Description', 'Qualifications', 'Perks & Benefits']), 'public authored criteria sections changed')
  qualifyCriteriaVisibility(one(active.nodes(node => node.tag === 'root'), 'expanded document'), isCriteria)
  const activeText = active.nodes(isCriteria).map(node => active.text(node))
  need(equal(activeText, visibleBlocks.map(node => visible.text(node))) && visibleBlocks.every(node => visible.text(node).length > 40), 'full visible authored criteria changed')
  return visibleBlocks.map(node => serialize(node)).join('\n')
}
const description = (html, row) => {
  const doc = readVisibleNativeDocument(html, { strict: true })
  canonical(doc, row.url)
  need(activeHead(html).titles.includes(row.title + ' | Anaptyss') && doc.text(one(doc.nodes(node => node.tag === 'h1'), 'role title')) === row.title, 'same-ID detail title changed')
  const info = one(doc.nodes(node => cls(node, 'jb-info')), 'native role information')
  need(fact(doc, info, 'Country') === 'India' && fact(doc, info, 'City') === row.location
    && fact(doc, info, 'Job Type') === row.jobType && fact(doc, info, 'Work Experience') === row.experience
    && fact(doc, info, 'Date Opened') === row.dateOpened, 'native listing/detail country or metadata conflict')
  const links = doc.nodes(node => node.tag === 'a' && node.attrs.href?.startsWith('/apply-now?'))
  need(links.length === 2, 'first-party role application handoff changed')
  const apply = new URL(links[0].attrs.href, HOME)
  need(links.every(node => node.attrs.href === links[0].attrs.href && doc.text(node) === 'Apply Now'
    && !Object.hasOwn(node.attrs, 'disabled') && node.attrs['aria-disabled'] !== 'true') && apply.origin === new URL(HOME).origin
    && apply.pathname === '/apply-now' && decodeNativeEntities(apply.searchParams.get('post')) === row.title && [...apply.searchParams].length === 1, 'application title/employer binding changed')
  const full = fullCriteria(html)
  const date = row.dateOpened.match(/^(\d{2}) Nov (\d{4})$/)
  return { source: 'anaptyss', company: 'Anaptyss', jobId: new URL(row.url).pathname.split('/').at(-1), requisitionId: null,
    title: row.title, department: row.department, location: row.location + ', India', city: /remote|hybrid|wfo/i.test(row.location) ? null : row.location,
    country: 'India', sourceNativeCountry: 'India', sourceUrl: row.url, detailUrl: row.url, applyUrl: apply.href, link: apply.href,
    companyDomain: 'anaptyss.com', companyCareerPage: CAREERS, employmentType: row.jobType, experienceRequired: row.experience,
    postingDate: date ? `${date[2]}-11-${date[1]}` : null, closingDate: null,
    jobDescription: full, sourceDescription: full, sourceDetailComplete: true, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
    sourceCompanyScope: 'Current declared first-party openings inventory; company-wide recruitment scope unproved' }
}

export async function runNativeAnaptyss(options = {}) {
  const signal = AbortSignal.any([AbortSignal.timeout(180000), ...(options.signal ? [options.signal] : [])])
  const wait = promise => new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(signal.reason) }
    signal.addEventListener('abort', abort, { once: true })
    Promise.resolve(promise).then(value => { signal.removeEventListener('abort', abort); resolve(value) }, error => { signal.removeEventListener('abort', abort); reject(error) })
    if (signal.aborted) abort()
  })
  const responses = [], failures = [], observed = new Map()
  const read = async url => {
    signal.throwIfAborted()
    const page = await wait(Promise.resolve().then(() => options.fetchPage(url, { signal })))
    signal.throwIfAborted()
    need(page.status === 200 && page.url === url, 'public HTTP/final URL changed: ' + url + ' (' + page.status + ')')
    need(typeof page.html === 'string' && Buffer.byteLength(page.html) <= 16000000, 'oversized or invalid public response')
    responses.push({ url, status: page.status, bytes: Buffer.byteLength(page.html), sha256: hash(page.html) })
    return page.html
  }
  const context = async () => {
    const home = await read(HOME), doc = readVisibleNativeDocument(home, { strict: true })
    need(activeHead(home).titles.includes("Anaptyss — Building Intelligent Enterprises for What's Next") && doc.nodes(node => node.tag === 'a' && node.attrs.href === '/careers/openings').length > 0, 'corporate current careers handoff changed')
    return cards(await read(CAREERS))
  }
  const inspect = async (rows, phase) => {
    let clientRead = false
    for (const row of rows) {
      try {
        const html = await read(row.url), doc = readNativeDocument(html)
        one(doc.nodes(node => node.tag === 'script' && node.attrs.src === new URL(TAB_CLIENT).pathname && !Object.hasOwn(node.attrs, 'nomodule')), 'current qualification executable client')
        if (!clientRead) { need(hash(await read(TAB_CLIENT)) === TAB_CLIENT_SHA, 'unreviewed public qualification tab client contract'); clientRead = true }
        const job = description(html, row)
        if (phase === 'opening') observed.set(job.jobId, job)
        else if (!equal(observed.get(job.jobId), job)) failures.push({ id: job.jobId, phase, reason: 'full same-ID criteria changed at closing' })
      } catch (error) { signal.throwIfAborted(); if (/public HTTP|tab client contract/.test(error.message)) throw error; failures.push({ id: new URL(row.url).pathname.split('/').at(-1), phase, reason: error.message }) }
    }
  }
  const opening = await context()
  await inspect(opening, 'opening')
  const sample = [...observed.values()][0]
  if (sample) {
    const form = readNativeDocument(await read(sample.applyUrl))
    need(form.nodes(node => node.tag === 'form' && node.attrs.method === 'post').length === 1
      && form.nodes(node => node.tag === 'input' && node.attrs.name === 'post_name' && node.attrs.value === sample.title).length === 1, 'shared first-party application role context changed')
  }
  const closingBeforeDetails = await context()
  await inspect(closingBeforeDetails, 'closing')
  const closing = cards(await read(CAREERS)), unchanged = equal(opening, closingBeforeDetails) && equal(opening, closing)
  if (!unchanged) failures.push({ phase: 'closing-inventory', reason: 'native membership changed after full closing criteria' })
  const active = new Map(closing.map(row => [new URL(row.url).pathname.split('/').at(-1), row])), bad = new Set(failures.map(row => row.id))
  let jobs = [...observed.values()].filter(job => active.has(job.jobId) && !bad.has(job.jobId)
    && equal(opening.find(row => row.url === job.sourceUrl), active.get(job.jobId)))
  const limited = Number.isSafeInteger(options.maxJobs) && options.maxJobs > 0 && jobs.length > options.maxJobs
  if (limited) jobs = jobs.slice(0, options.maxJobs)
  const complete = unchanged && !failures.length && !limited
  attachInventoryEvidence(jobs, { status: complete ? 'complete-inventory' : 'coverage-gap', surface: CAREERS, firstParty: true, listingComplete: complete, lifecycleCleanupAllowed: false,
    pagesFetched: responses.length, reportedTotal: opening.length, indiaFacetCount: complete ? jobs.length : null, verifiedAt: new Date().toISOString(),
    reason: 'Current native public card counts and same-ID details, explicit work countries, reviewed public qualification tab activation and final inventory after closing full criteria; declared openings scope only.' })
  if (!complete) attachSourceObservationEvidence(jobs, { source: 'anaptyss', recordKind: 'vacancy-rows', observedRecordCount: opening.length, observedVacancyCount: opening.length, sourceScopeComplete: false })
  const audit = { source: 'anaptyss', opening, closing, observedDetails: [...observed.values()], sourceCompanyWideScopeComplete: false, lifecycleCleanupAllowed: false, failures, limited, responses }
  Object.defineProperty(jobs, 'nativeCollectionEvidence', { value: audit, configurable: true })
  Object.defineProperty(jobs, 'sourceAudit', { value: audit })
  for (const job of jobs) job.scrapedAt = (options.now || (() => new Date().toISOString()))()
  signal.throwIfAborted()
  return jobs
}
