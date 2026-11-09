import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'cropin'
export const COMPANY = 'CropIn'
export const FIRST_PARTY_CAREERS_URL = 'https://www.cropin.com/career/'
export const KEKA_CAREERS_URL = 'https://cropinhrms.keka.com/careers/'
export const TENANT_ID = '953bbd12-8a46-443b-8c3e-a6fdf7bbd11e'
export const ACTIVE_JOBS_URL = `${KEKA_CAREERS_URL}api/embedjobs/default/active/${TENANT_ID}`
// Reviewed native client fetches the complete active array once and applies all
// department/location filters locally. A new client needs review before its
// empty response can certify inventory completeness.
const REVIEWED_CLIENT_SHA256 = '176878893ddcd1a0dabb3b84d1c8a98bde7c16c6ace1af2871db06c741fa022b'
// The shared slice reader handles standard hidden/inert ancestors. This source
// additionally prunes content-visibility and case-insensitive ARIA hiding.
const activeDocument = html => {
  const doc = document(html)
  const nodes = (predicate, node = doc.root) => {
    const style = (node.attrs.style || '').replace(/\/\*[\s\S]*?\*\//g, '')
    if (node.inactive || node.attrs['aria-hidden']?.toLowerCase() === 'true'
      || /(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test(style)) return []
    return [...(predicate(node) ? [node] : []), ...node.children.filter(child => typeof child !== 'string').flatMap(child => nodes(predicate, child))]
  }
  return { ...doc, nodes }
}
const activeScripts = html => activeDocument(html).nodes(node => node.tag === 'script' && !node.attrs.src).map(node => node.raw || '')
const requireCoverage = (condition, reason) => {
  if (!condition) throw Object.assign(Error(`CropIn coverage gap: ${reason}`), {
    code: 'CROPIN_COVERAGE_GAP', partial: true,
    inventoryEvidence: { status: 'coverage-gap', surface: ACTIVE_JOBS_URL,
      firstParty: true, listingComplete: false, reportedTotal: null, indiaFacetCount: null, reason },
  })
}

export const createCropInScraper = () => ({
  async run({ fetch: fetcher = globalThis.fetch, signal, timeoutMs = 45000 } = {}) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120000) throw Error('Invalid CropIn timeout')
    signal?.throwIfAborted()
    const controller = new AbortController()
    const onCallerAbort = () => controller.abort(signal.reason)
    signal?.addEventListener('abort', onCallerAbort, { once: true })
    const timer = setTimeout(() => controller.abort(Error('CropIn source timed out')), timeoutMs)
    let onAbort
    const aborted = new Promise((_, reject) => {
      onAbort = () => reject(controller.signal.reason)
      controller.signal.addEventListener('abort', onAbort, { once: true })
    })
    try {
      const collect = async () => {
        let pagesFetched = 0
        const request = async url => {
          controller.signal.throwIfAborted()
          const response = await fetcher(url, { signal: controller.signal, redirect: 'follow', headers: { Accept: 'text/html,application/json,text/javascript', 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify)' } })
          controller.signal.throwIfAborted()
          requireCoverage(response?.status === 200 && response.url === url, 'HTTP failure or unexpected redirect')
          const body = await response.text()
          controller.signal.throwIfAborted()
          requireCoverage(typeof body === 'string' && body.trim(), 'missing response body')
          requireCoverage(Buffer.byteLength(body, 'utf8') <= 4 * 1024 * 1024, 'response body too large')
          pagesFetched++
          return body
        }
        const json = async url => {
          const body = await request(url)
          try { return JSON.parse(body) } catch { requireCoverage(false, 'invalid native JSON') }
        }
        const official = activeDocument(await request(FIRST_PARTY_CAREERS_URL))
        requireCoverage(official.nodes(node => node.tag === 'a' && node.attrs.href === KEKA_CAREERS_URL).length > 0
          && /Cropin/i.test(official.text(official.root)), 'official employer handoff missing')
        const board = await request(KEKA_CAREERS_URL)
        const paths = activeScripts(board).flatMap(script => [...script.matchAll(/\bfetch\(\s*['"]([^'"]+)['"]\s*\)/g)].map(match => match[1]))
        requireCoverage(paths.length === 1 && new RegExp(`^/ats/documents/${TENANT_ID}/careerportal/[a-f0-9]{32}\\.html$`).test(paths[0]), 'native portal shell changed')
        const portal = await request(new URL(paths[0], KEKA_CAREERS_URL).href)
        const configs = activeScripts(portal).filter(script => /\bwindow\.khConfig\s*=/.test(script))
        requireCoverage(configs.length === 1, 'missing or ambiguous native configuration')
        const config = /^\s*window\.khConfig\s*=\s*\{\s*identifier:\s*'([^']+)',\s*domain:\s*'([^']+)',\s*targetContainer:\s*'([^']+)'\s*\}\s*;?\s*$/.exec(configs[0])
        requireCoverage(config && config[1] === TENANT_ID && config[2] === KEKA_CAREERS_URL && config[3] === '#khembedjobs', 'foreign or changed native configuration')
        const clientUrl = `${KEKA_CAREERS_URL}api/embedjobs/js/${TENANT_ID}`
        const portalDoc = activeDocument(portal)
        requireCoverage(portalDoc.nodes(node => node.tag === 'script' && node.attrs.src === clientUrl).length === 1
          && portalDoc.nodes(node => node.attrs.id === 'khembedjobs').length === 1, 'missing native inventory widget')
        const client = await request(clientUrl)
        requireCoverage(createHash('sha256').update(client).digest('hex') === REVIEWED_CLIENT_SHA256, 'unreviewed inventory pagination contract')
        const organization = await json(`${KEKA_CAREERS_URL}api/organization/default/careerportalinfo`)
        requireCoverage(organization?.name === 'Cropin' && organization.shortName === 'Cropin'
          && organization.careersPortalDomain === 'cropinhrms.keka.com'
          && !['error', 'errors', 'success', 'ok', 'hasError', 'status', 'statusCode'].some(key => Object.hasOwn(organization, key)), 'native employer identity mismatch')
        const group = await json(`${KEKA_CAREERS_URL}api/embedjobs/grouplinkstatus/${TENANT_ID}`)
        requireCoverage(group?.isGroupLinked === false && Object.keys(group).length === 1, 'group inventory changed')
        const jobs = await json(ACTIVE_JOBS_URL)
        requireCoverage(Array.isArray(jobs), 'invalid active inventory envelope')
        // There are no current native role records to establish location, JD,
        // publication-date or detail contracts. Do not manufacture those fields
        // from guessed Keka schemas when this employer starts hiring again.
        requireCoverage(jobs.length === 0, 'nonempty native role contract requires verification')
        return attachInventoryEvidence([], {
          status: 'verified-empty', surface: ACTIVE_JOBS_URL, firstParty: true,
          listingComplete: true, pagesFetched, reportedTotal: 0, indiaFacetCount: 0,
          verifiedAt: new Date().toISOString(), reason: 'official-employer-bound-unfiltered-active-api-empty',
        })
      }
      return await Promise.race([collect(), aborted])
    } finally {
      clearTimeout(timer)
      controller.abort(Error('CropIn source settled'))
      signal?.removeEventListener('abort', onCallerAbort)
      controller.signal.removeEventListener('abort', onAbort)
    }
  },
})

export const run = async (options = {}) => createCropInScraper().run(options)

const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
