import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'gxptechnologiesindiapvtltd'
export const COMPANY = 'GxP Technologies India Pvt. Ltd.'
export const HOMEPAGE_URL = 'https://gxptechnologies.com/'
export const CHECKED_ROUTE_URLS = [
  'https://gxptechnologies.com/careers',
  'https://gxptechnologies.com/careers/',
  'https://gxptechnologies.com/career',
  'https://gxptechnologies.com/career/',
  'https://gxptechnologies.com/jobs',
  'https://gxptechnologies.com/jobs/',
  'https://gxptechnologies.com/company/careers',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bjobposting\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /workable\.com/i,
  /smartrecruiters/i,
  /jobvite/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
]

export const extractBundlePath = (html) => {
  const match = /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["'](\/assets\/[^"']+\.js)["']/i.exec(
    String(html ?? ''),
  )

  return match?.[1] ?? null
}

const hasOctober2026ProductCopy = (html) => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)
  return /<link\b[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/gxptechnologies\.com\/["']/i.test(page)
    && text.includes('Guide your operators toward perfect execution.')
    && text.includes('Shihan GX™ learns from your own runs which in-range step choices lead to on-spec results')
    && text.includes('It sits beside your validated systems and advises; your people decide.')
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Shihan GX(?:™|&trade;)?\s*[—-]\s*Operator Execution Intelligence\s*\|\s*GxP Technologies\s*<\/title>/i.test(rawHtml)
    && /GxP Technologies/i.test(normalized)
    && ((/Shihan GX(?:™|&trade;)?\s*[—-]\s*reduce recurring GMP execution errors without replacing your validated systems\./i.test(normalized)
    && /Up to 75% fewer QC execution errors in a biopharma method/i.test(normalized)
    && /\$4M\+\s+in manufacturing-error savings previously achieved/i.test(normalized))
      || hasOctober2026ProductCopy(rawHtml))
    && /support@gxptechnologies\.com/i.test(rawHtml)
    && extractBundlePath(rawHtml) !== null
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const routeMatchesVerifiedShell = (html, bundlePath) =>
  hasOfficialHomepageSignal(html)
  && extractBundlePath(html) === bundlePath
  && !hasPublicJobsSignal(html)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const hasVerifiedResumeOnlyClientCareers = (bundle) => {
  const text = String(bundle ?? '')
  return text.includes('Careers at ')
    && text.includes('Key Roles')
    && text.includes('We are not actively recruiting at this moment.')
    && text.includes('upload a resume with a description of why you are interested')
    && text.includes('support@gxptechnologies.com')
    && /type:["']career["']/.test(text)
    && !PUBLIC_JOBS_SIGNAL_PATTERNS.filter(pattern => !pattern.test('apply now')).some(pattern => pattern.test(text))
}

export const createGxpTechnologiesIndiaPvtLtdScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('GxP Technologies India Pvt. Ltd. verified official homepage no longer matches the known first-party surface')
    }

    if (hasPublicJobsSignal(homepageHtml)) {
      throw new Error('GxP Technologies India Pvt. Ltd. homepage now appears to expose public jobs')
    }

    const bundlePath = extractBundlePath(homepageHtml)
    let hasExplicitlyInactiveRecruitment = false
    // The current product shell hides recruiting content in its first-party module.
    if (hasOctober2026ProductCopy(homepageHtml)) {
      const clientBundle = await fetchText(new URL(bundlePath, HOMEPAGE_URL).toString())
      if (!hasVerifiedResumeOnlyClientCareers(clientBundle)) {
        throw new Error('GxP Technologies India Pvt. Ltd. client careers no longer verifies a resume-only surface without active recruitment')
      }
      hasExplicitlyInactiveRecruitment = true
    }

    for (const routeUrl of CHECKED_ROUTE_URLS) {
      const routeHtml = await fetchText(routeUrl)

      if (!routeMatchesVerifiedShell(routeHtml, bundlePath)) {
        throw new Error('GxP Technologies India Pvt. Ltd. checked first-party route changed materially or now exposes public jobs')
      }
    }

    return attachInventoryEvidence([], {
      status: hasExplicitlyInactiveRecruitment ? 'verified-empty' : 'discovery-only',
      surface: new URL(bundlePath, HOMEPAGE_URL).toString(), firstParty: true,
      listingComplete: hasExplicitlyInactiveRecruitment,
      pagesFetched: 1 + CHECKED_ROUTE_URLS.length + (hasExplicitlyInactiveRecruitment ? 1 : 0),
      reportedTotal: hasExplicitlyInactiveRecruitment ? 0 : null,
      indiaFacetCount: hasExplicitlyInactiveRecruitment ? 0 : null,
      verifiedAt: new Date().toISOString(),
      reason: hasExplicitlyInactiveRecruitment ? 'First-party client careers explicitly states not actively recruiting at this moment.'
        : 'GxP legacy product shell does not expose verified complete recruitment inventory.',
    })
  },
})

export const run = async (options = {}) => createGxpTechnologiesIndiaPvtLtdScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  const evidence = readInventoryEvidence(jobs)
  if (isDryRun && evidence) {
    const { writeFile } = await import('node:fs/promises')
    await writeFile(path.join(currentDir, 'inventory-evidence.json'), JSON.stringify(evidence, null, 2))
  }
  if (evidence?.listingComplete === false) {
    console.error(evidence.reason)
    process.exitCode = 1
  } else if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
