import { createHash } from 'node:crypto'
import { decodeHTML } from 'entities'
import { activeHead, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import profile from './reviewedPublicContract20261113.json' with { type: 'json' }
import currentProfile from './reviewedPublicContract20261114.json' with { type: 'json' }

const HOME = 'https://www.vahan.co/'
export const VAHAN_CAREERS = HOME + 'careers/'
const SOURCE = 'vahan'
const norm = value => decodeHTML(String(value || '')).replace(/\s+/g, ' ').trim()
const hash = value => createHash('sha256').update(value).digest('hex')
const cls = (node, value) => (node.attrs.class || '').split(/\s+/).includes(value)
const need = (ok, message) => { if (!ok) throw new Error('[vahan] Current native careers: ' + message) }
const one = (values, message) => { need(values.length === 1, message); return values[0] }
const all = (node, predicate) => typeof node === 'string' ? [] : [
  ...(predicate(node) ? [node] : []), ...node.children.flatMap(child => all(child, predicate)),
]
const root = document => one(document.nodes(node => node.tag === 'root'), 'document missing')
const authored = node => typeof node === 'string' ? node : (node.raw || '') + node.children.map(authored).join(' ')
const fingerprint = rows => JSON.stringify([...rows].sort((a, b) => a.id.localeCompare(b.id)))
const stylesFor = (contract, kind) => Object.keys(contract.assets).filter(path => path.endsWith('.css')
  && (kind === 'role' || !path.includes('career-role.'))
  && (kind !== 'home' || !path.includes('/careers.')))
const baseClientFor = contract => contract.baseClient || Object.keys(contract.assets).find(path => path.endsWith('.js'))
const legacyFonts = ['https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&family=Inter:wght@100..900&display=swap']
const expectedStyles = (contract, kind) => [...stylesFor(contract, kind), ...(contract.externalStylesheets || legacyFonts)].sort()
const isStylesheet = node => node.tag === 'link' && (node.attrs.rel || '').toLowerCase().split(/\s+/).includes('stylesheet')
const styleDeclarations = tree => {
  const links = all(tree, isStylesheet)
  need(links.every(node => !node.inert), 'inactive stylesheet declaration requires review')
  return links.map(node => node.attrs.href).sort()
}
const declaredStyles = html => styleDeclarations(root(readNativeDocument(html)))
const selectContract = (home, board) => one([profile, currentProfile].filter(contract =>
  JSON.stringify(declaredStyles(home)) === JSON.stringify(expectedStyles(contract, 'home'))
  && JSON.stringify(declaredStyles(board)) === JSON.stringify(expectedStyles(contract, 'listing'))),
'unreviewed current deployment stylesheet declaration tuple')
const project = (html, styles) => readVisibleNativeDocument('<style>' + styles + '</style>' + html, { strict: true })
const unstyledPath = (tree, target) => {
  const visit = (node, path) => {
    if (typeof node === 'string') return null
    const current = [...path, node]
    if (node === target) return current
    for (const child of node.children) {
      const found = visit(child, current)
      if (found) return found
    }
    return null
  }
  const path = visit(tree, [])
  return path && path.every(node => !Object.hasOwn(node.attrs, 'style'))
}

function documentBindings(tree, kind) {
  const nodes = all(tree, () => true), parents = new Map()
  need(!nodes.some(node => node.tag === 'base'), 'unreviewed document base changes native URL authority')
  need(!nodes.some(node => Object.keys(node.attrs).some(name => /^on/i.test(name))),
    'unreviewed executable document event program')
  need(!nodes.some(node => node.tag === 'meta' && (node.attrs['http-equiv'] || '').trim().toLowerCase() === 'refresh'),
    'unreviewed document refresh handoff')
  for (const node of nodes) for (const child of node.children) if (typeof child !== 'string') parents.set(child, node)
  const critical = nodes.filter(node => kind === 'role'
    ? ['jr-title', 'jr-meta', 'jr-pill', 'jr-body', 'jr-form'].some(name => cls(node, name))
    : kind === 'listing' ? cls(node, 'jobs') || cls(node, 'role-select') || Object.hasOwn(node.attrs, 'data-filter')
      : node.tag === 'a' && ['/careers/', VAHAN_CAREERS].includes(node.attrs.href))
  const protectedNodes = new Set()
  for (const node of critical) {
    for (const child of all(node, () => true)) protectedNodes.add(child)
    for (let parent = parents.get(node); parent; parent = parents.get(parent)) protectedNodes.add(parent)
  }
  // The reviewed shared clients animate decorative tracks, open videos and
  // operate carousels. Those bindings cannot own criteria, forms or ancestors.
  const triggers = ['data-video', 'data-slideshow', 'data-wave', 'data-wave-on', 'data-carousel']
  need(![...protectedNodes].some(node => cls(node, 'logo-strip-track')
    || node.tag === 'a' && ['youtube.com', 'youtu.be'].some(part => (node.attrs.href || '').includes(part))
    || kind !== 'home' && cls(node, 'nav-item') && cls(node, 'has-dropdown')
    || triggers.some(name => Object.hasOwn(node.attrs, name))), 'unreviewed decorative client binding to native criteria or application')
}

function employer(document) {
  const scripts = document.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json')
  need(scripts.length === 1, 'employer identity missing or ambiguous')
  let value
  try { value = JSON.parse(scripts[0].raw) } catch { need(false, 'employer identity malformed') }
  need(value['@type'] === 'Organization' && value.name === 'Vahan'
    && value.legalName === 'Vahan Technologies India Pvt. Ltd.' && value.url === 'https://www.vahan.co',
  'employer identity changed')
}

function documentIdentity(html, url, kind, styles, contract) {
  const original = readNativeDocument(html), tree = root(original)
  documentBindings(tree, kind)
  const document = project(html, styles)
  employer(original)
  const canonical = document.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical')
  need(canonical.length === 1 && canonical[0].attrs.href === url, 'canonical URL identity changed')
  // The current deployment adds only a literal scrollbar-gutter rule in head.
  // Any additional, moved or changed inline styling still requires review.
  const inlineStyles = all(tree, node => node.tag === 'style')
  need(contract.inlineStyleSHA256 ? inlineStyles.length === 1
    && Object.keys(inlineStyles[0].attrs).length === 0
    && hash(inlineStyles[0].raw) === contract.inlineStyleSHA256
    && original.nodes(node => node.tag === 'head' && node.children.includes(inlineStyles[0])).length === 1
    : inlineStyles.length === 0, 'unreviewed inline stylesheet cannot qualify visible criteria')
  need(JSON.stringify(styleDeclarations(tree)) === JSON.stringify(expectedStyles(contract, kind)),
    'declared criteria stylesheet set changed')
  const baseClient = baseClientFor(contract)
  if (contract.scaleInitializerSHA256) {
    const clients = original.nodes(node => node.tag === 'script' && node.attrs.type !== 'application/ld+json')
    const external = [baseClient, ...(kind === 'home' ? contract.homeClients : [])]
    const externalClient = node => external.includes(node.attrs.src) && node.attrs.type === 'module'
      && Object.keys(node.attrs).length === 2 && !norm(node.raw)
    const scaler = node => Object.keys(node.attrs).length === 0 && hash(node.raw) === contract.scaleInitializerSHA256
    const inline = node => Object.keys(node.attrs).length === 1 && node.attrs.type === 'module'
      && !node.attrs.src && kind !== 'home' && hash(node.raw) === contract.inlineClients[kind]
    need(clients.length === external.length + (kind === 'home' ? 1 : 2)
      && external.every(path => clients.filter(node => externalClient(node) && node.attrs.src === path).length === 1)
      && clients.filter(scaler).length === 1 && clients.filter(inline).length === (kind === 'home' ? 0 : 1)
      && clients.every(node => externalClient(node) || scaler(node) || inline(node)),
    'published public client declaration contract changed')
  }
  if (kind !== 'home') {
    const scopes = kind === 'role' ? ['jr-title', 'jr-meta', 'jr-pill', 'jr-body', 'jr-form'] : ['jobs']
    for (const node of all(tree, node => scopes.some(value => cls(node, value)))) {
      need(unstyledPath(tree, node), 'unreviewed inline styling cannot qualify visible authored criteria')
      if (cls(node, 'jr-body') || cls(node, 'jobs')) need(!all(node, child => Object.hasOwn(child.attrs, 'style')).length,
        'unreviewed inline styling cannot qualify visible authored criteria')
    }
    if (!contract.scaleInitializerSHA256) {
      const clients = original.nodes(node => node.tag === 'script' && node.attrs.type !== 'application/ld+json')
      need(clients.length === 2 && clients.every(node => node.attrs.type === 'module')
        && clients.filter(node => node.attrs.src === baseClient).length === 1
        && clients.filter(node => !node.attrs.src && hash(node.raw) === contract.inlineClients[kind]).length === 1,
      'published public client contract changed')
    }
  }
  return { document, tree }
}

function listing(html, styles, contract) {
  const { document, tree } = documentIdentity(html, VAHAN_CAREERS, 'listing', styles, contract)
  need(activeHead(html).titles.includes('Vahan — Careers'), 'current employer careers title changed')
  const filters = document.nodes(node => node.tag === 'select' && node.attrs['data-filter'])
  need(filters.length === 3 && ['department', 'type', 'location'].every(name => filters.some(node => {
    const options = all(node, child => child.tag === 'option')
    return node.attrs['data-filter'] === name && options[0]?.attrs.value === 'all'
      && options.every((child, index) => index === 0 || !Object.hasOwn(child.attrs, 'selected'))
  })), 'current unfiltered role scope changed')
  need(!document.nodes(node => node.tag === 'a' && /\bnext\b/i.test(node.attrs.rel || '')).length,
    'unsupported role inventory continuation')
  const container = one(document.nodes(node => node.tag === 'div' && cls(node, 'jobs')), 'visible role board missing')
  const rows = all(container, node => cls(node, 'job-row')).map(card => {
    need(!card.inert, 'role board contains hidden authored vacancies')
    const title = document.text(one(all(card, node => cls(node, 'job-title') && !node.inert), 'visible role card title missing'))
    const metadata = document.text(one(all(card, node => cls(node, 'job-loc') && !node.inert), 'visible role card location missing'))
    const application = one(all(card, node => node.tag === 'a' && cls(node, 'job-apply') && !node.inert), 'visible native role handoff missing')
    const match = metadata.match(/^(.+) · (Full-time|Internship|Part-time)$/)
    const url = new URL(application.attrs.href, HOME)
    need(title && match && url.origin === HOME.slice(0, -1) && /^\/careers\/[a-z0-9-]+\/$/.test(url.pathname)
      && !url.search && !url.hash && !url.username && !url.password, 'native own-role identity changed')
    const group = one(all(container, node => cls(node, 'job-group') && all(node, child => child === card).length), 'role department missing')
    const department = document.text(one(all(group, node => cls(node, 'job-group-title') && !node.inert), 'visible department title missing'))
    return { id: url.pathname.split('/')[2], url: url.href, title, location: match[1], employmentType: match[2], department }
  })
  need(rows.length <= 100 && new Set(rows.map(row => row.id)).size === rows.length
    && all(tree, node => cls(node, 'job-row')).length === rows.length,
  'duplicate, hidden or unsupported employer role inventory')
  const roleLinks = document.nodes(node => node.tag === 'a' && node.attrs.href && /\/careers\//.test(node.attrs.href))
  for (const link of roleLinks) {
    const url = new URL(link.attrs.href, HOME)
    need(url.href === VAHAN_CAREERS || rows.some(row => row.url === url.href), 'unaccounted employer role or continuation')
  }
  return rows
}

function role(html, row, styles, contract) {
  const { document, tree } = documentIdentity(html, row.url, 'role', styles, contract)
  const title = one(document.nodes(node => node.tag === 'h1' && cls(node, 'jr-title')), 'visible same-role title missing')
  need([row.title, row.title + '.'].includes(document.text(title)), 'same-role title conflicts with listing')
  const meta = document.text(one(document.nodes(node => cls(node, 'jr-meta')), 'native role country missing'))
  need(meta === row.department + ' · ' + row.location + ', India', 'assigned workplace country missing or conflicting')
  need(document.text(one(document.nodes(node => cls(node, 'jr-pill')), 'employment type missing')) === row.employmentType,
    'employment type conflicts with listing')
  const nativeBody = one(all(tree, node => cls(node, 'jr-body')), 'full visible authored criteria missing')
  const visibleBody = one(document.nodes(node => cls(node, 'jr-body')), 'full visible authored criteria missing')
  const form = one(document.nodes(node => node.tag === 'form' && cls(node, 'jr-form')), 'visible public application missing')
  need(form.attrs.id === 'apply' && form.attrs['data-role'] === row.title && form.attrs['data-slug'] === row.id
    && !Object.hasOwn(form.attrs, 'hidden') && !Object.hasOwn(form.attrs, 'action'), 'public application role binding changed')
  const submit = one(all(form, node => node.tag === 'button' && node.attrs.type === 'submit' && !node.inert), 'visible public application submit control missing')
  const parents = new Map()
  const indexParents = node => {
    for (const child of node.children) if (typeof child !== 'string') { parents.set(child, node); indexParents(child) }
  }
  indexParents(root(document))
  const enabled = node => {
    for (let current = node; current; current = parents.get(current)) {
      if (current.inert || Object.hasOwn(current.attrs, 'disabled') || current.attrs['aria-disabled']?.toLowerCase() === 'true') return false
    }
    return true
  }
  const required = all(form, node => ['input', 'select', 'textarea'].includes(node.tag)
    && (Object.hasOwn(node.attrs, 'required') || node.attrs.name === 'resumeUrl'))
  need(enabled(submit) && required.every(node => enabled(node) && !Object.hasOwn(node.attrs, 'readonly'))
    && all(form, node => node.tag === 'input' && node.attrs.name === 'resumeUrl' && !node.inert).length === 1,
  'public application unavailable')
  need(document.nodes(node => node.tag === 'a' && cls(node, 'jr-apply') && node.attrs.href === '#apply').length === 1,
    'visible same-role application anchor missing')
  const nativeBlocks = nativeBody.children.filter(node => typeof node !== 'string' && node.tag === 'section' && cls(node, 'jr-block'))
  const visibleBlocks = visibleBody.children.filter(node => typeof node !== 'string' && node.tag === 'section' && cls(node, 'jr-block') && !node.inert)
  need(nativeBlocks.length > 0 && nativeBlocks.length === visibleBlocks.length
    && nativeBody.children.every(node => typeof node === 'string' ? !norm(node)
      : node.tag === 'section' && cls(node, 'jr-block') || node.tag === 'a' && cls(node, 'jr-apply') || node.tag === 'form' && cls(node, 'jr-form')),
  'full visible authored criteria structure changed')
  for (const [index, block] of nativeBlocks.entries()) {
    need(!all(block, node => ['script', 'style', 'template', 'iframe'].includes(node.tag) || node.attrs.style).length
      && norm(authored(block)) === norm(document.text(visibleBlocks[index])), 'full visible authored criteria hidden or incomplete')
  }
  const matches = [...html.matchAll(/<section\b[^>]*>[\s\S]*?<\/section\s*>/gi)]
    .map(match => ({ html: match[0], tree: root(readNativeDocument(match[0])) }))
    .filter(value => all(value.tree, node => node.tag === 'section' && cls(node, 'jr-block')).length)
  need(matches.length === nativeBlocks.length && matches.every((value, index) => {
    const blocks = all(value.tree, node => node.tag === 'section')
    return blocks.length === 1 && norm(authored(blocks[0])) === norm(authored(nativeBlocks[index]))
  }), 'original visible authored criteria boundaries changed')
  const full = matches.map(value => value.html).join('\n')
  const substantive = nativeBlocks.flatMap(block => all(block, node => ['p', 'li'].includes(node.tag)))
    .map(node => norm(authored(node))).join(' ')
  need(substantive.length >= 200 && !/\b(?:no longer accepting applications|this (?:role|position) is closed)\b/i.test(full),
    'full substantive authored criteria unavailable or closed')
  return { source: SOURCE, company: 'Vahan', companyDomain: 'vahan.co', companyCareerPage: VAHAN_CAREERS,
    jobId: row.id, requisitionId: row.id, title: row.title, department: row.department,
    location: row.location + ', India', country: 'India', employmentType: row.employmentType,
    sourceNativeLocation: meta.split(' · ')[1], sourceUrl: row.url, detailUrl: row.url,
    applyUrl: row.url + '#apply', link: row.url + '#apply', atsPlatform: 'first-party-native-html',
    postingDate: null, closingDate: null, sourcePostingDateUnavailable: true,
    jobDescription: full, sourceDescription: full, sourceDetailComplete: true,
    sourceScopeComplete: false, lifecycleCleanupAllowed: false }
}

export async function runVahanCurrentNative({ fetchImpl = fetch, signal: callerSignal, now = () => new Date().toISOString(), maxJobs } = {}) {
  callerSignal?.throwIfAborted()
  const controller = new AbortController()
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(120000), ...(callerSignal ? [callerSignal] : [])])
  const audit = { source: SOURCE, recordKind: 'vacancy-rows', observedRecordCount: 0, observedVacancyCount: 0,
    sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null, lifecycleCleanupAllowed: false,
    sourceListingComplete: false, responses: [], closingStable: false }
  const wait = (promise, activeSignal) => new Promise((resolve, reject) => {
    const abort = () => { activeSignal.removeEventListener('abort', abort); reject(activeSignal.reason) }
    activeSignal.addEventListener('abort', abort, { once: true })
    Promise.resolve(promise).then(value => { activeSignal.removeEventListener('abort', abort); resolve(value) }, error => { activeSignal.removeEventListener('abort', abort); reject(error) })
    if (activeSignal.aborted) abort()
  })
  const read = async url => {
    signal.throwIfAborted()
    need(audit.responses.length < 220, 'bounded source request limit exceeded')
    const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(15000)])
    const response = await wait(Promise.resolve().then(() => fetchImpl(url, { method: 'GET', redirect: 'manual', signal: requestSignal,
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html,text/css,application/javascript' } })), requestSignal)
    requestSignal.throwIfAborted()
    need(response.status === 200 && response.url === url, 'public HTTP/final URL identity changed (' + response.status + '): ' + url)
    const html = await wait(response.text(), requestSignal)
    requestSignal.throwIfAborted()
    need(Buffer.byteLength(html) <= 4 * 1024 * 1024, 'bounded source response body exceeded')
    audit.responses.push({ url, status: response.status, bytes: Buffer.byteLength(html), sha256: hash(html) })
    return html
  }
  const details = async (rows, styles, contract) => {
    const result = new Array(rows.length)
    let cursor = 0, failure
    const workers = Array.from({ length: Math.min(3, rows.length) }, async () => {
      try {
        while (cursor < rows.length) {
          signal.throwIfAborted()
          const index = cursor++
          result[index] = role(await read(rows[index].url), rows[index], styles, contract)
        }
      } catch (error) { failure ||= error; controller.abort(failure); throw error }
    })
    await Promise.allSettled(workers)
    if (failure) throw failure
    signal.throwIfAborted()
    return result
  }
  try {
    const home = await read(HOME), openingHtml = await read(VAHAN_CAREERS), contract = selectContract(home, openingHtml)
    const verifyAssets = async () => {
      const assets = {}
      for (const [path, sha] of Object.entries(contract.assets)) {
        assets[path] = await read(new URL(path, HOME).href)
        need(hash(assets[path]) === sha, path.endsWith('.css') ? 'unreviewed criteria stylesheet contract' : 'unreviewed shared public client contract')
      }
      return assets
    }
    const assets = await verifyAssets()
    const styles = Object.entries(assets).filter(([path]) => path.endsWith('.css')).map(([, body]) => body).join('\n')
    const bindHome = html => {
      const { document } = documentIdentity(html, HOME, 'home', styles, contract)
      need(document.nodes(node => node.tag === 'a' && node.attrs.href === '/careers/' && document.text(node) === 'Careers').length > 0,
        'current corporate employer careers handoff missing')
    }
    bindHome(home)
    const opening = listing(openingHtml, styles, contract)
    audit.observedRecordCount = audit.observedVacancyCount = opening.length
    let jobs = [], complete = false
    if (opening.length) {
      jobs = await details(opening, styles, contract)
      bindHome(await read(HOME))
      const closing = listing(await read(VAHAN_CAREERS), styles, contract)
      need(fingerprint(opening) === fingerprint(closing), 'closing inventory changed')
      const closingJobs = await details(closing, styles, contract)
      need(JSON.stringify(jobs) === JSON.stringify(closingJobs), 'closing full authored criteria changed')
      need(fingerprint(opening) === fingerprint(listing(await read(VAHAN_CAREERS), styles, contract)), 'final closing inventory changed after role details')
      await verifyAssets()
      complete = audit.closingStable = true
    }
    const limited = Number.isSafeInteger(maxJobs) && maxJobs > 0 && jobs.length > maxJobs
    if (limited) { jobs = jobs.slice(0, maxJobs); complete = false }
    audit.sourceListingComplete = complete
    audit.limited = limited
    const verifiedAt = now()
    jobs = jobs.map(job => ({ ...job, scrapedAt: verifiedAt }))
    attachSourceObservationEvidence(jobs, audit)
    Object.defineProperty(jobs, 'nativeCollectionEvidence', { value: audit, configurable: true })
    attachInventoryEvidence(jobs, { status: complete ? 'complete-inventory' : 'coverage-gap', surface: VAHAN_CAREERS,
      firstParty: true, listingComplete: complete, lifecycleCleanupAllowed: false, pagesFetched: audit.responses.length,
      reportedTotal: null, indiaFacetCount: null, verifiedAt,
      reason: complete ? 'current first-party employer HTML board and full authored criteria reconciled;whole-company-scope-unverified;cleanup-forbidden'
        : 'empty-or-limited-published-employer-board;whole-company-inventory-unverified;cleanup-forbidden' })
    signal.throwIfAborted()
    return jobs
  } catch (error) {
    controller.abort(error)
    callerSignal?.throwIfAborted()
    throw error
  }
}
