import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'bharatfinancialinclusionlimited'
export const COMPANY = 'Bharat Financial Inclusion Limited'
export const CAREERS_URL = 'https://www.bfil.co.in/apply-for-job.php'
export const APPLICATION_EMAIL = 'careers@bfil.co.in'
export const APPLICATION_URL =
  'mailto:careers@bfil.co.in?subject=%5BVertical%20Name%5D%20%2F%20%5BPreferred%20Location%5D%20%2F%20%5BRole%5D'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const getApplyInstructions = (html) => {
  const doc = readNativeDocument(html)
  const text = doc.text(doc.nodes(node => node.tag === 'root')[0])
  const subject = text.match(/\[Vertical Name\]\s*\/\s*\[Preferred Location\]\s*\/\s*\[Role\]/i)?.[0]
  const examples = doc.nodes(node => node.tag === 'p' && /^Example:/i.test(doc.text(node)))
  const example = examples.length === 1 ? doc.text(examples[0]) : null
  return [subject, example].filter(Boolean).join('\n') || null
}

export const hasOfficialCareersSignal = (html) => {
  const doc = readNativeDocument(html)
  const text = doc.text(doc.nodes(node => node.tag === 'root')[0])
  return /APPLY FOR A JOB/i.test(text)
    && /Bharat Financial Inclusion Limited/i.test(text)
    && doc.nodes(node => node.tag === 'h4' && doc.text(node) === 'Current Opportunities at BFIL').length === 1
    && /How to Apply/i.test(text)
    && /\[Vertical Name\]\s*\/\s*\[Preferred Location\]\s*\/\s*\[Role\]/i.test(text)
    && doc.nodes(node => node.tag === 'a' && node.attrs.href === `mailto:${APPLICATION_EMAIL}`).length > 0
}

const descendants = (node, predicate) => !node || node.inert ? [] : [
  ...(predicate(node) ? [node] : []),
  ...node.children.filter(child => typeof child !== 'string').flatMap(child => descendants(child, predicate)),
]

const extractNativeObservations = (html) => {
  const roles = [], departments = []
  const doc = readNativeDocument(html)
  const applyInstructions = getApplyInstructions(html)
  for (const panel of doc.nodes(node => node.tag === 'div' && doc.hasClass(node, 'opportunities-list'))) {
    const headings = descendants(panel, node => node.tag === 'h5')
    const lists = descendants(panel, node => node.tag === 'ul')
    if (headings.length !== 1 || lists.length !== 1) throw new Error('BFIL native opportunities grouping changed')
    const department = doc.text(headings[0])
    const items = descendants(lists[0], node => node.tag === 'li').map(node => doc.text(node))
    if (!department || items.some(item => !item)) throw new Error('BFIL native role labels changed')
    if (/^Support Functions$/i.test(department)) {
      const context = descendants(panel, node => node.tag === 'p').map(node => doc.text(node)).join('\n') || null
      departments.push(...items.map(title => ({ title, nativeGroup: department,
        nativeHiringLabel: context, recordKind: 'department' })))
      continue
    }
    for (const title of items) {
      const jobId = slugify(`${department} ${title}`)
      roles.push({
        title,
        company: COMPANY,
        department,
        location: null,
        city: null,
        country: null,
        jobId,
        requisitionId: null,
        sourceUrl: CAREERS_URL,
        applyUrl: APPLICATION_URL,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
        nativeApplicationInstructions: applyInstructions,
        nativeSourceRecord: { title, department },
        nativeIdentityKind: 'advertised-role-label',
        sourceDetailComplete: false,
        sourceDetailFailureKind: 'native-description-and-workplace-unavailable',
        sourceListingComplete: false,
        sourceScopeComplete: false,
        lifecycleCleanupAllowed: false,
      })
    }
  }

  return { roles, departments }
}

export const extractRoleListings = html => extractNativeObservations(html).roles

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
  signal,
})

const isBrowserFallbackError = (error) =>
  /HTTP (?:403|406|429)\b|fetch failed|timed out|timeout|could not connect|und_err_connect_timeout|ssl\/tls secure channel|econnreset|unable to/i
    .test(String(error?.message ?? error ?? ''))

export const createBharatFinancialInclusionLimitedScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchBrowserText, signal, onAudit } = {}) {
    signal?.throwIfAborted()
    let browserSession = null

    const getBrowserSession = async () => {
      if (!browserSession) {
        browserSession = await createBrowserFetchSession({ userAgent: USER_AGENT, signal })
      }

      return browserSession
    }

    const browserTextFetcher = fetchBrowserText || (async (url) => {
      const session = await getBrowserSession()
      return session.fetchText(url)
    })

    const fetchPageText = async (url) => {
      signal?.throwIfAborted()
      try {
        const html = await fetchText(url, { signal })
        signal?.throwIfAborted()
        return html
      } catch (error) {
        signal?.throwIfAborted()
        if (!isBrowserFallbackError(error)) {
          throw error
        }

        const html = await browserTextFetcher(url, { signal })
        signal?.throwIfAborted()
        return html
      }
    }

    try {
      const careersHtml = await fetchPageText(CAREERS_URL)

      if (!hasOfficialCareersSignal(careersHtml)) {
        throw new Error('BFIL careers page no longer matches the verified first-party email-apply surface')
      }

      const { roles, departments } = extractNativeObservations(careersHtml)
      const jobs = roles.filter(job => job.country === 'India' && hasSourceDescription(job)).map((job) => ({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: new Date().toISOString(),
      }))
      attachSourceObservationEvidence(jobs, { source: SOURCE, recordKind: 'mixed',
        observedRecordCount: roles.length + departments.length, observedVacancyCount: roles.length, sourceScopeComplete: false })
      attachInventoryEvidence(jobs, { status: 'discovery-only', firstParty: true, listingComplete: false,
        surface: CAREERS_URL, pagesFetched: 1, reportedTotal: null, indiaFacetCount: null,
        verifiedAt: new Date().toISOString(), reason: 'bfil-native-role-briefs-and-departments:full-criteria-and-workplaces-unavailable' })
      await onAudit?.({ source: SOURCE, roleBriefs: structuredClone(roles), departments: structuredClone(departments), productionWrites: false })
      signal?.throwIfAborted()
      return jobs
    } finally {
      if (browserSession) {
        await browserSession.close()
      }
    }
  },
})

export const run = async (options = {}) => createBharatFinancialInclusionLimitedScraper().run(options)

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
