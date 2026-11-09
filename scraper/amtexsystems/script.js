import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { decodeNativeEntities, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { nativeCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

import { AMTEX_SYSTEMS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = AMTEX_SYSTEMS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

// Static native content only. The shared reader excludes comments, inert/raw
// bodies and conservative local hiding rules; it does not execute CSS or JS,
// fetch external stylesheets, or establish browser rendering visibility.
const documentFor = html => readVisibleNativeDocument(String(html), { strict: true })
const controls = new Set(['form', 'input', 'button', 'select', 'option', 'textarea', 'script', 'style', 'template', 'noscript'])
const blocks = new Set(['div', 'section', 'article', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'ul', 'ol', 'br'])
const outsideControls = (document, predicate) => {
  const visit = node => node.inert || controls.has(node.tag) ? [] : [
    ...(predicate(node) ? [node] : []),
    ...node.children.filter(child => typeof child !== 'string').flatMap(visit),
  ]
  return document.nodes(node => node.tag === 'root').flatMap(visit)
}
const criteriaText = node => {
  const content = item => {
    if (typeof item === 'string') return decodeNativeEntities(item)
    if (item.inert || controls.has(item.tag)) return ''
    const value = item.children.map(content).join('')
    return blocks.has(item.tag) ? '\n' + value + '\n' : value
  }
  return content(node).split('\n').map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n')
}
const roleCountry = location => {
  const countries = [...new Set(location.split(/[,;/|]/).map(value => value.trim()).map(value =>
    /^(?:US|USA|United States of America)$/i.test(value) ? 'United States'
      : value.length > 2 ? nativeCountryName(value) : null).filter(Boolean))]
  return { country: countries.length === 1 ? countries[0] : null, conflict: countries.length > 1 }
}

export const hasOfficialCareersSignal = (html = '') => {
  const document = documentFor(html)
  return document.nodes(node => node.tag === 'h2' && document.hasClass(node, 'amtex-form-title'))
    .some(node => /^Join Our Team$/i.test(document.text(node)))
    && document.nodes(node => node.tag === 'label').some(node => /^Position Applying For\b/i.test(document.text(node)))
    && extractRealCareerLinks(html).includes(new URL('/career-list/business-analyst', HOMEPAGE_URL).href)
}

export const extractRealCareerLinks = (html = '') => {
  const document = documentFor(html)
  const links = []
  for (const node of outsideControls(document, node => node.tag === 'a'
    && document.hasClass(node, 'tiles3A') && document.hasClass(node, 'randomise'))) {
    try {
      const url = new URL(node.attrs.href, HOMEPAGE_URL)
      if (url.origin !== new URL(HOMEPAGE_URL).origin || url.username || url.password
        || url.search || url.hash || !/^\/career-list\/[a-z0-9-]+\/?$/i.test(url.pathname)) continue
      links.push(url.href)
    } catch { /* A malformed or placeholder card is not a native detail URL. */ }
  }
  return [...new Set(links)]
}

const parseJobDetailPage = (html = '', sourceUrl) => {
  const document = documentFor(html)
  const titles = document.nodes(node => node.tag === 'h2' && document.hasClass(node, 'amtex-form-title'))
    .map(node => document.text(node).match(/^Apply for\s+(.+)$/i)?.[1]).filter(Boolean)
  const locations = document.nodes(node => node.tag === 'p' && document.hasClass(node, 'amtex-form-subtitle'))
    .map(node => document.text(node).match(/^Join our team in\s+(.+)$/i)?.[1]).filter(Boolean)
  const title = titles.length === 1 ? titles[0] : null
  const location = locations.length === 1 ? locations[0] : null
  const scopes = outsideControls(document, node => document.hasClass(node, 'jobs1'))
  const description = scopes.length === 1 ? criteriaText(scopes[0]) : ''
  const sourceDescription = description && description !== title && extractActiveDescription(description) ? description : null
  const nativeCountry = roleCountry(location || '')
  const unresolved = []
  if (!title) unresolved.push('native-role-title-unavailable-or-ambiguous')
  if (!sourceDescription) unresolved.push('native-full-criteria-unavailable')
  if (!nativeCountry.country) unresolved.push(nativeCountry.conflict ? 'native-country-conflict' : 'native-country-unresolved')
  const vacancy = Boolean(title && location && sourceDescription)
  const context = { kind: vacancy ? 'native-role-criteria' : 'application-form-role-context',
    id: null, title, location, country: vacancy ? nativeCountry.country : null,
    legalEmployer: null, sourceUrl, sourceDescription, unresolved,
    sourceDetailComplete: vacancy, sourceScopeComplete: false, lifecycleCleanupAllowed: false }
  if (!vacancy || nativeCountry.country !== 'India') return { context, job: null }
  return { context, job: {
    title,
    location,
    city: null,
    state: null,
    country: 'India',
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: null,
    experienceRequired: null,
    remoteStatus: null,
    jobDescription: sourceDescription,
    sourceDescription,
    nativeLegalEmployer: null,
    postingDate: null,
    closingDate: null,
    sourceDetailComplete: true,
    sourceScopeComplete: false,
    sourceListingComplete: false,
    lifecycleCleanupAllowed: false,
    applicationVisited: false,
  } }
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
  signal,
})

export const createAmtexSystemsScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, fetchPage, signal, onRecords, onAudit, now: observedNow = now } = {}) {
    signal?.throwIfAborted()
    const observations = []
    let pagesFetched = 0
    const read = async url => {
      signal?.throwIfAborted()
      let html
      try {
        if (fetchPage) {
          const page = await fetchPage(url, { signal })
          signal?.throwIfAborted()
          if (page?.status !== 200) throw Object.assign(new Error('Amtex Systems HTTP ' + page?.status), { status: page?.status })
          if (page.url !== url) throw new Error('Amtex Systems public response changed the requested page')
          if (page.contentType && !/^(?:text\/html|application\/xhtml\+xml)$/i.test(String(page.contentType).split(';', 1)[0].trim())) throw new Error('Amtex Systems public response is not HTML')
          html = page.html
        } else html = await fetchText(url, { signal })
      } catch (error) { signal?.throwIfAborted(); throw error }
      signal?.throwIfAborted()
      if (typeof html !== 'string') throw new Error('Amtex Systems public response has no HTML body')
      pagesFetched++
      return html
    }
    const careersHtml = await read(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Amtex Systems verified careers page no longer matches the trusted first-party shell')
    }

    const detailLinks = extractRealCareerLinks(careersHtml)
    if (detailLinks.length === 0) {
      throw new Error('Amtex Systems careers page no longer exposes the verified first-party detail links')
    }

    const jobs = []
    for (const detailUrl of detailLinks) {
      const detailHtml = await read(detailUrl)
      const { context, job } = parseJobDetailPage(detailHtml, detailUrl)
      observations.push(context)
      if (!job) continue
      jobs.push({
        ...job,
        company: COMPANY,
        source: SOURCE,
        link: job.applyUrl,
        scrapedAt: observedNow(),
      })
    }

    signal?.throwIfAborted()
    jobs.sort((left, right) => left.title.localeCompare(right.title))
    const observedVacancyCount = observations.filter(row => row.kind === 'native-role-criteria').length
    const recordKind = observedVacancyCount === 0 ? 'hiring-signals'
      : observedVacancyCount === observations.length ? 'vacancy-rows' : 'mixed'
    const inventory = { status: 'coverage-gap', surface: CAREERS_URL, firstParty: Boolean(fetchPage),
      listingComplete: false, pagesFetched, reportedTotal: null, indiaFacetCount: null,
      verifiedAt: observedNow(), reason: 'native-detail-read;full-company-scope-unverified;cleanup-forbidden' }
    const audit = { source: SOURCE, observedAt: inventory.verifiedAt, pagesFetched, observations,
      recordKind, observedRecordCount: observations.length, observedVacancyCount,
      companyGlobalTotal: null, companyIndiaTotal: null, sourceScopeComplete: false,
      lifecycleCleanupAllowed: false, returnedIndiaJobs: jobs.length, inventoryEvidence: inventory }
    for (const [callback, value] of [[onRecords, jobs], [onAudit, audit]]) {
      signal?.throwIfAborted()
      try { if (callback) await callback(structuredClone(value)) }
      catch (error) { signal?.throwIfAborted(); throw error }
      signal?.throwIfAborted()
    }
    attachInventoryEvidence(jobs, inventory)
    attachSourceObservationEvidence(jobs, { source: SOURCE, recordKind, observedRecordCount: observations.length,
      observedVacancyCount, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null })
    Object.defineProperty(jobs, 'nativeCollectionEvidence', { value: structuredClone(audit), configurable: true })
    return jobs
  },
})

export const run = async (options = {}) => createAmtexSystemsScraper().run(options)

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
