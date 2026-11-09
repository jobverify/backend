import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { normalizeInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'udaan'
export const COMPANY = 'Udaan'
export const FIRST_PARTY_ROOT_URL = 'https://udaan.com/'
export const CAREERS_URL = 'https://udaan.com/careers'
export const CAREERS_HOST_URL = 'https://careers.udaan.com/'
export const EMPLOYER_URL = 'https://www.linkedin.com/company/udaan/'
export const LISTING_URL = 'https://www.linkedin.com/jobs/search/?f_C=10838271&location=India'

const activeDocument = html => {
  const doc = document(html)
  const prune = (node, inherited = false) => {
    const style = (node.attrs.style || '').replace(/\/\*[\s\S]*?\*\//g,'')
    node.inactive ||= inherited || /(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test(style)
    for (const child of node.children.filter(c => typeof c !== 'string')) prune(child,node.inactive)
  }
  prune(doc.root)
  return doc
}

export const createUdaanScraper = () => ({
  async run({fetchImpl = globalThis.fetch, signal, timeoutMs = 45000, now = () => new Date().toISOString()} = {}) {
    signal?.throwIfAborted()
    let firstParty = false, surface = FIRST_PARTY_ROOT_URL, pagesFetched = 0, timer, onAbort
    const retainedResponses = [], controller = new AbortController()
    const gap = (reason, cause) => Object.assign(new Error(`Udaan coverage gap: ${reason}`, {cause}), {
      code:'UDAAN_COVERAGE_GAP', sourceListingComplete:false, lifecycleCleanupAllowed:false, retainedResponses,
      inventoryEvidence:normalizeInventoryEvidence({status:'coverage-gap', surface, firstParty,
        listingComplete:false, pagesFetched, reportedTotal:null, indiaFacetCount:null, verifiedAt:now(), reason}),
    })
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) throw gap('Invalid aggregate deadline')
    const cancelled = new Promise((_, reject) => {
      onAbort = () => {controller.abort(signal.reason); reject(signal.reason)}
      signal?.addEventListener('abort', onAbort, {once:true})
      timer = setTimeout(() => {
        const error = gap('Aggregate official inventory deadline exceeded')
        controller.abort(error); reject(error)
      }, timeoutMs)
    })
    const inspect = async () => {
      const read = async (url, allowRedirect = false) => {
        controller.signal.throwIfAborted(); surface = url
        let r
        try {r = await fetchImpl(url, {signal:controller.signal, redirect:'manual', headers:{accept:'text/html'}})}
        catch (error) {
          retainedResponses.push({url, finalUrl:null, status:null, body:null, error:String(error)})
          throw error
        }
        controller.signal.throwIfAborted()
        if (r?.url !== url) throw gap('Native final URL identity changed')
        const body = await r.text()
        controller.signal.throwIfAborted()
        if (typeof body !== 'string' || Buffer.byteLength(body) > 5000000) throw gap('Native body unavailable or exceeds bound')
        pagesFetched++
        const location = r.headers?.get('location') || null
        retainedResponses.push({url, finalUrl:r.url, status:r.status, location, body,
          bodySHA256:createHash('sha256').update(body).digest('hex')})
        if (allowRedirect && [301,302,303,307,308].includes(r.status)) {
          if (!location || new URL(location,url).href !== CAREERS_HOST_URL) throw gap('Untrusted careers redirect')
          return read(CAREERS_HOST_URL)
        }
        if (r.status !== 200) throw gap(`Native HTTP ${r.status}`)
        if (!body.trim()) throw gap('Native body empty')
        return body
      }
      const html = await read(FIRST_PARTY_ROOT_URL), doc = activeDocument(html)
      const heading = doc.text(doc.root)
      if (!/India[’']s Largest eB2B Platform for Small Businesses Owners/i.test(heading)
        || !doc.nodes(n => n.tag === 'a' && ['/about-us','https://udaan.com/about-us'].includes(n.attrs.href)
          && /about us/i.test(doc.text(n))).length) throw gap('Official commerce employer identity changed')
      firstParty = true
      if (doc.nodes(n => n.tag === 'a' && n.attrs.href === EMPLOYER_URL).length) {
        const company = activeDocument(await read(EMPLOYER_URL))
        const organizations = company.nodes(n => n.tag === 'script' && n.attrs.type === 'application/ld+json')
          .flatMap(n => {const p = JSON.parse(n.raw); return p['@graph'] || [p]})
          .filter(p => p['@type'] === 'Organization')
        if (organizations.length !== 1 || organizations[0].name !== 'udaan.com'
          || organizations[0].sameAs !== 'http://udaan.com'
          || !company.nodes(n => n.tag === 'h1' && company.text(n) === 'udaan.com').length
          || !company.nodes(n => n.attrs['data-semaphore-content-urn'] === 'urn:li:organization:10838271').length) {
          throw gap('Official LinkedIn employer identity changed')
        }
        const listing = activeDocument(await read(LISTING_URL))
        const bound = listing.nodes(n => n.tag === 'input' && n.attrs.name === 'f_C'
          && n.attrs.value === '10838271' && Object.hasOwn(n.attrs,'checked')).length === 1
        if (!bound) throw gap('Native search employer filter changed')
        if (listing.nodes(n => n.tag === 'h1' && /couldn[’']t find a match.*India/i.test(listing.text(n))).length === 1) {
          throw gap('Native employer-filtered India search has no matches; whole-company inventory remains unverified')
        }
        throw gap('Official LinkedIn employer listing changed; pagination and details require verification')
      }
      await read(CAREERS_URL, true)
      throw gap('Official careers surface has no verified enumerable inventory contract')
    }
    try {return await Promise.race([inspect(), cancelled])}
    catch (error) {
      if (signal?.aborted) throw signal.reason
      if (error?.code === 'UDAAN_COVERAGE_GAP') throw error
      throw gap('Official careers transport or native inventory unavailable', error)
    } finally {
      clearTimeout(timer); signal?.removeEventListener('abort', onAbort); controller.abort()
    }
  },
})

export const run = async (options = {}) => createUdaanScraper().run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/udaan/script.js')

if (isDirectExecution) {
  const jobs = await run()
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
