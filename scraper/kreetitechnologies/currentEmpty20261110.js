import { createHash } from 'node:crypto'
import { activeScripts } from '../../scraper-support/utils/activeNativeHtml.js'
import { readNativeAttributeDocument } from '../../scraper-support/utils/nativeHtmlAttributes.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const COMPANY = 'https://www.kreeti.com/'
const HOME = 'https://careers.kreeti.com/'
const JOBS = HOME + 'candidates'
const STUDENTS = HOME + 'students'
const PROGRAM_SHA = '4f16618285ef460033908b1082716f19d5a8ad213abf20cffe1c17acd4803508'
const STYLE_SHA = '09f06ccdf71f5a3893f5a7719bcf1ef95c7356625b36bd0557a36f5ce5a47dac'
const PROGRAM = 'https://assets.kreeti.com/assets/new_style-' + PROGRAM_SHA + '.js'
const STYLE = 'https://assets.kreeti.com/assets/new_style-' + STYLE_SHA + '.css'
const COMPANY_SHA = 'a649437a026e6a3aae164e9f14f2cf267c6c2c9804cd35e9cd8795f58343049d'
const SCRIPTS = [PROGRAM,
  'https://cdnjs.cloudflare.com/ajax/libs/bootstrap-daterangepicker/3.0.5/moment.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/bootstrap-daterangepicker/3.0.5/daterangepicker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/bootstrap-datetimepicker/4.17.47/js/bootstrap-datetimepicker.min.js',
  'https://cdn.jsdelivr.net/npm/popper.js@1.16.1/dist/umd/popper.min.js',
  'https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.13.1/js/all.min.js',
]
const STYLES = ['https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;700&display=swap',
  'https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/bootstrap-daterangepicker/3.0.5/daterangepicker.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/bootstrap-datetimepicker/4.17.47/css/bootstrap-datetimepicker.min.css', STYLE]
const ANALYTICS_SHA = '850c52177521f9c921d11f815a42617400c231562b746d97008fbdf8e380dc96'
const INLINE = { [HOME]: [],
  [STUDENTS]: ['8a4a1c9e5495df907fb5f8c12dec4f6639bb39e1d59344eb9a60887c5fb81d62', ANALYTICS_SHA],
  [JOBS]: ['6eb366ed1dba4b5f1d56103c12234c6323c52332842fa2ce0e66c1aa79fcd395', ANALYTICS_SHA] }
const VISIBLE = {
  [HOME]: '456c6bfb43dcf66e45d2aa68924b66c67ef3983f95d9148d61335c42092af550',
  [STUDENTS]: '93b721c106a2c1f4ac92d94f9bece9e893d2a3477aa1b7c98d00603a7f483395',
  [JOBS]: '90958733204f14a9f03b9af6c74c99bb9d1cd7fa4c763ff8ef5e207ec59108f4',
}
const STRUCTURE = {
  [HOME]: '620e8823bea532c7c8d18aeedd4115bc880ba83dccf0db9162aa4943d5a95e63',
  [STUDENTS]: '1e2a5b57a78240ee06d565e56332909a5c0c74155db8652b72c3c77c444106d6',
  [JOBS]: '0efbb45146a559c44a618823406fc50cef2829589f966ac3a1ab41b92a271975',
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const need = (ok, message) => { if (!ok) throw Object.assign(new Error('Kreeti current empty inventory: ' + message), {
  softFailure: true, failureKind: 'coverage_gap', abortRetries: true,
}) }
const absolute = (value, base) => {
  const url = new URL(String(value).trim(), base)
  need(url.protocol === 'https:' && !url.username && !url.password && !url.port, 'unqualified native authority')
  return url.href
}
const pathTo = (node, target, path = []) => {
  if (node === target) return [...path, node]
  for (const child of node.children.filter(child => typeof child !== 'string')) {
    const found = pathTo(child, target, [...path, node])
    if (found) return found
  }
  return null
}
const hasEmbeddedDocument = node => {
  // An iframe's raw fallback is inert, while the frame itself can be active.
  // srcdoc has no delegated URL and still invalidates a complete empty claim.
  if (node.activeFrame === true) return true
  if (node.inert) return false
  if (['object', 'embed', 'portal', 'fencedframe', 'frame', 'frameset'].includes(node.tag)) return true
  return node.children.some(child => typeof child !== 'string' && hasEmbeddedDocument(child))
}
const canonicalStructure = node => {
  const attrs = {...node.attrs}
  if (node.tag === 'meta' && attrs.name === 'csrf-token') {
    // The genuine opening/closing originals differ only in this Rails masked
    // public CSRF value. No hidden inputs, nonces or other values are omitted.
    need(Object.keys(attrs).sort().join(',') === 'content,name'
      && /^[A-Za-z0-9_-]{86}$/.test(attrs.content), 'unreviewed public CSRF metadata structure')
    attrs.content = '[dynamic-public-CSRF]'
  }
  return {tag:node.tag,attrs:Object.fromEntries(Object.entries(attrs).sort(([a],[b])=>a.localeCompare(b))),
    ...(typeof node.raw === 'string' ? {raw:node.raw} : {}),
    children:node.children.map(child => typeof child === 'string' ? child.replace(/\s+/g, ' ') : canonicalStructure(child))}
}

function context(bytes, url) {
  const html = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  const document = readNativeAttributeDocument(html, {excludeObjectFallback:false})
  const root = document.nodes(node => node.tag === 'root')[0]
  const titles = document.nodes(node => node.tag === 'title').map(node => node.raw?.trim())
  need(same(titles, [url === COMPANY ? 'Kreeti Technologies Pvt. Ltd.' : 'Kreeti Technologies']), 'native publisher identity changed')
  need(!document.nodes(node => node.tag === 'base').length && !hasEmbeddedDocument(root),
    'unreviewed native base, frame or embedded document')
  need(!document.nodes(node => node.tag === 'meta' && /^refresh$/i.test(node.attrs['http-equiv'] || '')).length,
    'native refresh changes publisher scope')
  const links = document.nodes(node => node.tag === 'a' && node.attrs.href)
    .filter(node => url !== COMPANY || new URL(node.attrs.href, url).protocol === 'https:').map(node => ({
    url: absolute(node.attrs.href, url), label: document.text(node),
  }))
  if (url === COMPANY) {
    // This exact current corporate document publishes the complete reviewed
    // careers navigation. Future programs/handoffs need their own review.
    need(sha(bytes) === COMPANY_SHA, 'current corporate publisher document requires review')
    need(links.some(link => link.url === JOBS && link.label === 'Jobs')
      && links.some(link => link.url === STUDENTS && link.label === 'Students')
      && links.some(link => link.url === HOME && link.label === 'Careers'), 'current corporate careers handoff changed')
    return { publisher: titles[0], careersLinks: links.filter(link => link.url.startsWith(HOME)) }
  }
  need(!/<style\b/i.test(html), 'unreviewed native inline style program')
  need(same(document.nodes(node => node.tag === 'script' && node.attrs.src).map(node => absolute(node.attrs.src, url)), SCRIPTS)
    && same(activeScripts(html).map(sha), INLINE[url]), 'active native renderer program changed')
  need(same(document.nodes(node => node.tag === 'link' && node.attrs.rel === 'stylesheet').map(node => absolute(node.attrs.href, url)), STYLES),
    'active native stylesheet changed')
  const permittedLinks = new Set([COMPANY, HOME, HOME.slice(0, -1), JOBS, STUDENTS, HOME + 'life_at_kreeti', HOME + 'how_we_hire', HOME + 'leaderboard'])
  need(links.every(link => permittedLinks.has(link.url) || url === STUDENTS && link.url === STUDENTS + '#carouselExampleControls'),
    'contradictory vacancy, pagination or alternate native handoff')
  need(links.some(link => link.url === JOBS && link.label === 'Jobs')
    && links.some(link => link.url === STUDENTS && link.label === 'Students'), 'current native Jobs or Students handoff changed')
  need(!document.nodes(node => node.attrs.itemtype?.includes('JobPosting') || node.attrs.itemprop === 'jobLocation'
    || /(?:^|\s)(?:pagination|pager)(?:\s|$)/i.test(node.attrs.class || '')).length, 'native vacancy or pagination scope changed')
  const forms = document.nodes(node => node.tag === 'form')
  need(forms.length === (url === JOBS ? 1 : 0), 'native filter or intake scope changed')
  const snapshot = { publisher: titles[0], links, visibleTextSHA256: sha(document.text(root)) }
  if (url === STUDENTS) {
    const applications = links.filter(link => /internship|apply|vacanc|opening|position/i.test(link.label))
    need(same(applications, [{ url: JOBS, label: 'Apply for Internship' }]), 'student application handoff changed')
    need(document.nodes(node => /^h[1-6]$/.test(node.tag) && document.text(node) === 'Campus Recruitments').length === 1
      && !document.nodes(node => node.tag === 'section' && document.hasClass(node, 'jobs')).length,
    'student vacancy program scope changed')
    snapshot.intakeUrl = JOBS
  }
  if (url === JOBS) {
    const sections = document.nodes(node => node.tag === 'section' && document.hasClass(node, 'jobs'))
    need(sections.length === 1, 'active complete openings section unavailable')
    const section = sections[0]
    const ancestry = pathTo(root, section)
    need(same(ancestry.map(node => ({ tag: node.tag, attrs: node.attrs })), [
      {tag:'root',attrs:{}}, {tag:'html',attrs:{}}, {tag:'body',attrs:{}}, {tag:'div',attrs:{class:''}}, {tag:'section',attrs:{class:'jobs'}},
    ]), 'openings visibility or unfiltered scope changed')
    const headings = document.nodes(node => /^h[1-6]$/.test(node.tag), section)
    need(headings.length === 1 && document.text(headings[0]) === 'No Open Positions'
      && same(headings[0].attrs, {class:'section-title'})
      && document.text(section) === 'No Open Positions We value your time. We respond to every applicant, so you’ll never be left in the dark',
    'active explicit empty positions state changed')
    need(!document.nodes(node => ['input', 'select', 'form', 'a'].includes(node.tag), section).length,
      'vacancy or filter inside the empty openings section')
    const form = forms[0]
    need(form.attrs.method === 'post' && absolute(form.attrs.action, url) === JOBS
      && document.nodes(node => /^h[1-6]$/.test(node.tag) && document.text(node) === 'LET US KNOW THAT YOU ARE INTERESTED').length === 1,
    'general-interest intake binding changed')
    const control = node => ['input', 'select', 'textarea', 'button'].includes(node.tag)
    const intakeControls = new Set(document.nodes(control, form))
    const otherControls = document.nodes(control).filter(node => !intakeControls.has(node))
    need(otherControls.length === 1 && otherControls[0].tag === 'button' && otherControls[0].attrs.type === 'button'
      && otherControls[0].attrs.class === 'navbar-toggler' && otherControls[0].attrs['aria-controls'] === 'navbarNavDropdown'
      && document.text(otherControls[0]) === '',
      'unqualified country, category or vacancy filter')
    const positions = document.nodes(node => node.tag === 'select' && node.attrs.name === 'job[job_id]', form)
    need(positions.length === 1, 'general-interest position control changed')
    snapshot.emptyText = 'No Open Positions'
    snapshot.generalInterestOptions = document.nodes(node => node.tag === 'option', positions[0])
      .filter(node => node.attrs.value).map(node => ({id:node.attrs.value,title:document.text(node),disposition:'general-interest-only'}))
  }
  // Equal opening/closing documents can both contain a newly added vacancy.
  // The reviewed complete visible context, including sibling sections, must
  // still agree with the actual empty publication before certifying zero.
  need(snapshot.visibleTextSHA256 === VISIBLE[url], 'unreviewed visible native context requires review')
  snapshot.normalizedDOMSHA256 = sha(JSON.stringify(canonicalStructure(root)))
  need(snapshot.normalizedDOMSHA256 === STRUCTURE[url], 'unreviewed native DOM structure or attributes require review')
  return snapshot
}

const disposeResponse = (response, reason) => {
  try { response?.body?.cancel(reason).catch(() => {}) } catch { /* Disposal must not replace the source/caller failure. */ }
}
const abortable = (pending, signal, disposeLate) => new Promise((resolve, reject) => {
  let settled = false
  const cleanup = () => signal.removeEventListener('abort', abort)
  const abort = () => {
    if (settled) return
    settled = true; cleanup(); reject(signal.reason)
  }
  if (signal.aborted) abort()
  else signal.addEventListener('abort', abort, { once: true })
  Promise.resolve(pending).then(value => {
    if (settled) { if (signal.aborted) disposeLate?.(value, signal.reason); return }
    settled = true; cleanup(); resolve(value)
  }, error => {
    if (settled) return
    settled = true; cleanup(); reject(error)
  })
})

export async function runCurrentKreetiEmpty(options = {}) {
  options.signal?.throwIfAborted()
  const signal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(90000)])
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const allowed = new Set([COMPANY, HOME, JOBS, STUDENTS, PROGRAM, STYLE]), receipts = []
  let aggregate = 0
  const read = async url => {
    signal.throwIfAborted()
    need(allowed.has(url) && receipts.length < 12, 'request outside the current complete empty contract')
    const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(15000)])
    const response = await abortable(fetchImpl(url, {method:'GET', credentials:'omit', redirect:'error', cache:'no-store',
      signal:requestSignal, headers:{Accept:url === PROGRAM ? 'application/javascript' : url === STYLE ? 'text/css' : 'text/html'}}), requestSignal, disposeResponse)
    let reader, mime
    try {
      requestSignal.throwIfAborted()
      need(response.url === url, 'native response URL authority changed')
      need(response.status === 200, 'native public HTTP ' + response.status)
      mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
      need(mime === (url === PROGRAM ? 'application/javascript' : url === STYLE ? 'text/css' : 'text/html'), 'native response MIME changed')
      need(Number(response.headers.get('content-length')) <= 1500000, 'native response body exceeds bounds')
      reader = response.body?.getReader()
      need(reader, 'native response body unavailable')
    } catch (error) { disposeResponse(response, error); throw error }
    const chunks = []
    let bytes = 0, ended = false, cancelled = false, failure
    const cancel = reason => {
      if (ended || cancelled) return
      cancelled = true
      reader.cancel(reason).catch(() => {})
    }
    const abortReader = () => cancel(requestSignal.reason)
    requestSignal.addEventListener('abort', abortReader, {once:true})
    try {
      for (;;) {
        const item = await abortable(reader.read(), requestSignal)
        requestSignal.throwIfAborted()
        if (item.done) { ended = true; break }
        bytes += item.value.byteLength
        need(bytes <= 1500000, 'native response body exceeds bounds')
        chunks.push(Buffer.from(item.value))
      }
    } catch (error) { failure = error; throw error }
    finally {
      requestSignal.removeEventListener('abort', abortReader)
      cancel(failure)
      try { reader.releaseLock() } catch { /* Cancellation may still be settling. */ }
    }
    aggregate += bytes
    need(aggregate <= 5000000, 'native aggregate byte bounds exceeded')
    const body = Buffer.concat(chunks)
    receipts.push({url,status:200,mime,bytes,sha256:sha(body),observedAt:new Date().toISOString()})
    return body
  }
  const opening = {}
  opening.company = context(await read(COMPANY), COMPANY)
  opening.home = context(await read(HOME), HOME)
  opening.students = context(await read(STUDENTS), STUDENTS)
  opening.jobs = context(await read(JOBS), JOBS)
  need(sha(await read(PROGRAM)) === PROGRAM_SHA, 'reviewed native renderer program bytes changed')
  need(sha(await read(STYLE)) === STYLE_SHA, 'reviewed native CSS program bytes changed')
  const closing = {}
  closing.jobs = context(await read(JOBS), JOBS)
  closing.students = context(await read(STUDENTS), STUDENTS)
  closing.home = context(await read(HOME), HOME)
  closing.company = context(await read(COMPANY), COMPANY)
  need(sha(await read(PROGRAM)) === PROGRAM_SHA && sha(await read(STYLE)) === STYLE_SHA, 'closing reviewed renderer or CSS program changed')
  for (const key of Object.keys(opening)) need(same(opening[key], closing[key]), 'closing native ' + key + ' context changed')
  signal.throwIfAborted()
  const at = options.now ? options.now() : new Date().toISOString()
  need(typeof at === 'string' && Number.isFinite(Date.parse(at)), 'current observation time unavailable')
  const jobs = attachInventoryEvidence([], {status:'verified-empty',surface:JOBS,firstParty:true,listingComplete:true,
    lifecycleCleanupAllowed:false,pagesFetched:receipts.length,reportedTotal:0,indiaFacetCount:0,verifiedAt:at,
    reason:'Current company-bound unfiltered public Jobs explicitly declares No Open Positions; Students only returns to the same general-interest intake. Opening/closing publisher, both career surfaces, student program, native JS/CSS reconciled. Global active public vacancies=0, so India=0; cleanup forbidden.'})
  Object.defineProperty(jobs, 'nativeCollectionEvidence', {configurable:true,value:{source:'kreetitechnologies',
    recordKind:'vacancy-rows',observedRecordCount:0,observedVacancyCount:0,sourceScopeComplete:true,
    companyGlobalTotal:0,companyIndiaTotal:0,lifecycleCleanupAllowed:false,currentContextRechecked:true,
    opening,closing,reviewedNativeProgramSHA256:PROGRAM_SHA,reviewedNativeStyleSHA256:STYLE_SHA,receipts}})
  return jobs
}
