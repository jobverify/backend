import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createAshbyApiScraper } from '../../scraper-support/utils/ashbyApi.js'
import { readNativeDocument, activeHead } from '../../scraper-support/utils/activeNativeHtml.js'
import { inspectRecruitingBundle } from '../../scraper-support/utils/recruitingBundleContracts.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { runPublicCollection } from './publicBoundary.js'

import { SKYSCANNER_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const ASHBY_BOARD_TOKEN = 'eb485598-6bf3-40a5-8560-d70150131305'
export const ASHBY_JOB_BOARD_URL = `https://api.ashbyhq.com/posting-api/job-board/${ASHBY_BOARD_TOKEN}`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*' },
    signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(20000)]) })
  return { status: response.status, url: response.url, html: await response.text() }
}

export const hasVerifiedJobsShellSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(html)
  return /\bCurrent jobs\b/i.test(normalized)
    && /All teams/i.test(normalized)
    && /All locations/i.test(normalized)
    && /Search by title, team or location/i.test(page)
}

export const hasEnumerableJobsSignal = (html = '') => {
  const page = String(html ?? '')
  return /(?:href|url)=["'][^"']*\/jobs\/job\/\d+/i.test(page)
    || /https?:\/\/[^"'\s]*skyscanner[^"'\s]*\/jobs\/job\/\d+/i.test(page)
    || /(?:jobId|jobTitle|jobLocation|jobDescription)\s*[:=]/i.test(page)
}

export const hasChallengeGateSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  const page = String(html ?? '')
  const hasStaticChallengeShell = /<title>\s*Skyscanner\s*<\/title>/i.test(page)
    && /<noscript>\s*You need to enable JavaScript to run this app\.\s*<\/noscript>/i.test(page)
    && /<div[^>]+id=["']root["'][^>]*>/i.test(page)
    && /(?:href|src)=["']\.\/static\/(?:js|css)\/main\.[^"']+["']/i.test(page)

  return hasStaticChallengeShell
    || (
      /<title>\s*Skyscanner\s*<\/title>/i.test(page)
      && /Are you a person or a robot\?/i.test(normalized)
      && /Please don(?:'|\u2019)t take this personally/i.test(normalized)
      && /You need to enable JavaScript to run this app\./i.test(normalized)
    )
}

export const createSkyscannerScraper = ({ maxJobs = null } = {}) => ({
  async run(options = {}) {
    return runPublicCollection(SOURCE, options, async boundary => {
    const signal = boundary.signal, fetchJson = options.fetchJson
    const fetchPage = options.fetchPage
      ? url => boundary.read(url, context => options.fetchPage(url, { signal: context.signal }))
      : url => boundary.fetchPage(url, options.fetchImpl || globalThis.fetch, { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*' })
    const loadPage = async url => {
      signal?.throwIfAborted()
      const page = await fetchPage(url, { signal })
      signal?.throwIfAborted()
      let challengeRedirect = false
      try { const target = new URL(page?.url); challengeRedirect = target.origin === new URL(CAREERS_URL).origin && target.pathname === '/sttc/px/captcha-v2/index.html' } catch {}
      if ([401, 403, 429].includes(page?.status) || challengeRedirect || hasChallengeGateSignal(page?.html)) {
        throw Object.assign(new Error('Skyscanner current employer page denied public access; current board binding unavailable'), {
          softFailure: true, upstreamOutage: true, abortRetries: true, failureKind: 'public_access_denied', status: page?.status,
        })
      }
      if (page?.status !== 200 || String(page.url || '').replace(/\/+$/, '') !== url.replace(/\/+$/, '')
        || typeof page.html !== 'string' || page.html.length > 3000000) throw new Error('Skyscanner current employer page/bundle binding unavailable')
      return page.html
    }
    const html = await loadPage(CAREERS_URL)
    if (activeHead(html).titles[0] !== 'Skyscanner Jobs') throw new Error('Skyscanner current employer page identity unavailable')
    const scripts = readNativeDocument(html).nodes(node => node.tag === 'script' && node.attrs.src
      && !Object.hasOwn(node.attrs, 'nomodule') && /^(?:|module|(?:text|application)\/javascript)$/i.test(node.attrs.type || ''))
      .flatMap(node => {
        try {
          const url = new URL(node.attrs.src, CAREERS_URL)
          return url.origin === 'https://js.skyscnr.com' && !url.username && !url.password && !url.search && !url.hash
            && /^\/sttc\/hamilton\/falcon\/static\/js\/skyscanner-internal-landing-pages-shared-ui-src-components-JobsApp\.[a-z\d]+\.chunk\.js$/i.test(url.pathname)
            ? [url.href] : []
        } catch { return [] }
      })
    if (scripts.length !== 1) throw new Error('Skyscanner current executable JobsApp bundle binding unavailable')
    const facts = inspectRecruitingBundle(await loadPage(scripts[0]))
    const ashbyUrls = facts.fetchUrls.filter(url => url.startsWith('https://api.ashbyhq.com/posting-api/job-board/'))
    if (ashbyUrls.length !== 1 || ashbyUrls[0] !== ASHBY_JOB_BOARD_URL) throw new Error('Skyscanner current bundle native board contract changed')
    const jobs = await createAshbyApiScraper({ source: SOURCE, companyName: COMPANY, ashbyJobBoardUrl: ASHBY_JOB_BOARD_URL })
      .run({ fetchJson: fetchJson ? url => boundary.read(url, context => fetchJson(url, { signal: context.signal })) : undefined, signal })
    const evidence = readInventoryEvidence(jobs), reasons = []
    const proven = jobs.filter(job => /^(?:India|IN|IND)$/i.test(job.country || '') || /\bIndia\b/i.test(job.location || ''))
    if (proven.length !== jobs.length) reasons.push('native-location-scope-unresolved:india-country-evidence-unavailable')
    if (!evidence?.listingComplete) reasons.push(evidence?.reason || 'native-inventory-evidence-unavailable')
    const capped = Number.isInteger(maxJobs) && maxJobs >= 0 && maxJobs < proven.length
    const selected = capped ? proven.slice(0, maxJobs) : proven
    if (capped) reasons.push('source-job-limit')
    for (const job of selected) {
      Object.assign(job, { companyCareerPage: CAREERS_URL, companyDomain: PROVIDER_METADATA.companyDomain, atsPlatform: 'ashby' })
      if (reasons.length) Object.assign(job, { sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false })
    }
    return attachInventoryEvidence(selected, { ...evidence, pagesFetched: evidence.pagesFetched + 2,
      listingComplete: reasons.length === 0, status: reasons.length ? 'discovery-only' : evidence.status,
      indiaFacetCount: reasons.some(reason => /location-scope-unresolved/.test(reason)) ? null : evidence.indiaFacetCount,
      reason: reasons.length ? `skyscanner-native-incomplete:${reasons.join(';')}` : 'skyscanner-current-jobs-bundle-and-native-ashby-inventory-verified',
    })
    })
  },
})

export const run = async (options = {}) => createSkyscannerScraper(options).run(options)

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
