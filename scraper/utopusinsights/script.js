import path from 'path'
import { fileURLToPath } from 'url'
import { createHash } from 'node:crypto'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { createBoundedPublicCareerTransport } from '../../scraper-support/utils/boundedPublicCareerTransport.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'utopusinsights'
export const COMPANY = 'Utopus Insights'
export const CAREERS_URL = 'https://www.utopusinsights.com/careers'
export const OPEN_POSITIONS_URL = 'https://www.utopusinsights.com/open-positions'
export const BAMBOOHR_SCRIPT_URL = 'https://utopusinsights.bamboohr.com/js/embed.js'
export const BAMBOOHR_EMBED_URL = 'https://utopusinsights.bamboohr.com/jobs/embed2.php?version=1.0.0&format=json'
export const BAMBOOHR_CLIENT_SHA256 = '362a883600af02dc038eba2666e283565d190390e9c1c8156235e4530d80abf0'

export const currentUtopusDocument = (body, alias) => {
  const raw = String(body ?? '').trim()
  if (!raw.startsWith('{')) return readNativeDocument(raw)
  const model = JSON.parse(raw)
  if (model.alias !== alias || typeof model.content !== 'string' || typeof model.page_title !== 'string')
    throw Error('Utopus current first-party page model identity is unqualified')
  // Duda publishes the native page fragment inside a JSON model. Parse that
  // original fragment, without interpreting escaped JSON as an HTML document.
  return readNativeDocument(model.content)
}

export const hasOfficialCareersSignal = (html) => {
  const doc = currentUtopusDocument(html, 'careers')
  return doc.nodes(n => n.tag === 'a' && n.attrs.href && new URL(n.attrs.href, CAREERS_URL).href === OPEN_POSITIONS_URL).length > 0
}

export const hasOfficialOpenPositionsSignal = (html) => {
  const doc = currentUtopusDocument(html, 'open-positions')
  return doc.nodes(n => n.tag === 'div' && n.attrs.id === 'BambooHR'
    && n.attrs['data-domain'] === 'utopusinsights.bamboohr.com' && n.attrs['data-version'] === '1.0.0').length === 1
    && doc.nodes(n => n.tag === 'script' && n.attrs.src === BAMBOOHR_SCRIPT_URL
      && (!n.attrs.type || /^(?:text|application)\/javascript$/.test(n.attrs.type))).length === 1
}

export const hasBambooHrHandoff = hasOfficialOpenPositionsSignal

export const hasEmptyOpeningsSignal = body => {
  let model
  try { model = JSON.parse(body) } catch { return false }
  return model && typeof model === 'object' && !Array.isArray(model)
    && !Object.keys(model).some(key => /^(?:error|errors|fault|exception)$/i.test(key))
    && model.success !== false && model.ok !== false
    && Array.isArray(model.departments) && model.labels && typeof model.labels === 'object' && !Array.isArray(model.labels)
    && model.departments.every(department => Array.isArray(department.jobs) && department.jobs.length === 0)
}

export const createUtopusInsightsScraper = () => ({
  async run(options = {}) {
    options.signal?.throwIfAborted()
    const now = options.now || (() => new Date().toISOString())
    if (options.maxJobs === 0) return attachInventoryEvidence([], { status: 'coverage-gap', surface: OPEN_POSITIONS_URL,
      firstParty: true, listingComplete: false, pagesFetched: 0, verifiedAt: now(), reason: 'caller-cap-zero-no-public-reads' })
    const transport = createBoundedPublicCareerTransport({ source: SOURCE, ...options,
      allowedURL: (url, method) => method === 'GET' && [CAREERS_URL, OPEN_POSITIONS_URL, BAMBOOHR_SCRIPT_URL, BAMBOOHR_EMBED_URL].includes(url) })
    const { fetchText, fetchScript } = transport
    try {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Utopus Insights careers page no longer matches the verified official public surface')
    }
    const openingsHtml = await fetchText(OPEN_POSITIONS_URL)
    if (!hasOfficialOpenPositionsSignal(openingsHtml)) {
      throw new Error('Utopus Insights open positions page no longer matches the verified official public surface')
    }

    if (!hasBambooHrHandoff(openingsHtml)) {
      throw new Error('Utopus Insights open positions page no longer exposes the verified BambooHR handoff')
    }

    const client = await fetchScript(BAMBOOHR_SCRIPT_URL)
    if (createHash('sha256').update(client).digest('hex') !== BAMBOOHR_CLIENT_SHA256)
      throw Error('Utopus current declared BambooHR client changed; native response contract unqualified')
    const bambooHrEmbedHtml = await fetchText(BAMBOOHR_EMBED_URL)
    if (!bambooHrEmbedHtml.trim()) {
      throw Object.assign(Error('Utopus current BambooHR JSON widget response is empty; no verified inventory'), {
        abortRetries: true, incompleteScope: true,
        recruitmentObservations: { source: SOURCE, nativeInventoryReads: [{ url: BAMBOOHR_EMBED_URL, usable: false }],
          failures: [{ stage: 'native-widget', failureKind: 'empty-native-json-response' }], sourceScopeComplete: false },
      })
    }
    if (!hasEmptyOpeningsSignal(bambooHrEmbedHtml)) throw Error('Utopus native widget is nonempty or malformed; full public role qualification required')
    return attachInventoryEvidence([], { status: 'coverage-gap', surface: OPEN_POSITIONS_URL, firstParty: true,
      listingComplete: false, pagesFetched: 4, verifiedAt: now(), reason: 'observed-declared-widget-empty;company-inventory-unqualified' })
    } finally { transport.close() }
  },
})

export const run = async (options = {}) => createUtopusInsightsScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running ${COMPANY} scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
