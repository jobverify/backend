import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "aembit"
export const COMPANY = "Aembit"
export const CAREERS_URL = 'https://aembit.io/careers/'
export const LIST_URL = 'https://aembit.bamboohr.com/careers/list'
export const EMBED_URL = 'https://aembit.bamboohr.com/jobs/embed2.php?version=1.0.0&format=json'

const request = async (url, { signal } = {}) => {
  const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) })
  if (response.status !== 200 || response.url !== url) throw new Error('Aembit native response status or final URL changed')
  return response
}
export const run = async ({ fetchPage = async (url, options) => { const r = await request(url, options); return { status: r.status, finalUrl: r.url, html: await r.text() } },
  fetchJson = async (url, options) => (await request(url, options)).json(), signal } = {}) => {
  signal?.throwIfAborted()
  const page = await fetchPage(CAREERS_URL, { signal })
  signal?.throwIfAborted()
  const bindings = readNativeDocument(page.html || '', { excludeObjectFallback: true }).nodes(node => node.tag === 'div'
    && node.attrs.id === 'BambooHR' && node.attrs['data-domain'] === 'aembit.bamboohr.com')
  if (page.status !== 200 || (page.finalUrl || page.url) !== CAREERS_URL
    || bindings.length !== 1) throw new Error('Aembit current official BambooHR binding unavailable')
  const inventory = await fetchJson(LIST_URL, { signal })
  signal?.throwIfAborted()
  const embed = await fetchJson(EMBED_URL, { signal })
  signal?.throwIfAborted()
  if (inventory?.error || inventory?.errors || inventory?.success === false || inventory?.hasMore === true || inventory?.nextPage != null
    || inventory?.meta?.hasMore === true || inventory?.meta?.totalCount !== 0 || !Array.isArray(inventory.result) || inventory.result.length
    || embed?.success !== true || embed.version !== '1.0.0' || !Array.isArray(embed.departments) || embed.departments.length
    || embed.labels?.blankStateTitle !== 'We currently have no open positions.') throw new Error('Aembit nonempty or inconsistent native inventory; positive detail contract remains pending')
  signal?.throwIfAborted()
  return attachInventoryEvidence([], { status: 'verified-empty', firstParty: true, listingComplete: true, surface: LIST_URL,
    pagesFetched: 2, reportedTotal: 0, indiaFacetCount: 0, verifiedAt: new Date().toISOString(), reason: 'current-official-bamboohr-binding-native-list-and-embed-explicitly-empty-positive-extraction-pending' })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
