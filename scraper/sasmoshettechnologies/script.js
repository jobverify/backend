import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'sasmoshettechnologies'
export const JOIN_TEAM_URL = 'https://sasmos.com/join-our-team/'
export const OPEN_POSITIONS_URL = 'https://sasmos.com/join-our-team/open-positions/'
export const SHARE_PROFILE_URL = 'https://sasmos.com/join-our-team/share-your-profile/'
export const CAREERS_EMAIL = 'careers@sasmos.com'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const hasOfficialJoinTeamSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Join our team[^<]*SASMOS\s*<\/title>/i.test(page)
    && /<h1[^>]*>\s*Join Our Team\s*<\/h1>/i.test(page)
    && /People of SASMOS/i.test(page)
    && /Professionals/i.test(page)
    && /Student\s*&amp;\s*Graduates|Student\s*&\s*Graduates/i.test(page)
    && /mailto:careers@sasmos\.com/i.test(page)
}

const extractAbsoluteUrl = (html, label, baseUrl = JOIN_TEAM_URL) => {
  const page = String(html ?? '')
  const safeLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = page.match(new RegExp(`<a[^>]+href="([^"]+)"[^>]*>\\s*${safeLabel}\\s*<\\/a>`, 'i'))

  if (!match) return null

  try {
    return new URL(match[1], baseUrl).toString()
  } catch {
    return null
  }
}

export const extractVerifiedJoinTeamLinks = (html) => {
  const page = String(html ?? '')
  const emailMatch = page.match(/mailto:([^"'?\s>]+)/i)

  return {
    openPositionsUrl: extractAbsoluteUrl(page, 'Open Positions'),
    shareProfileUrl: extractAbsoluteUrl(page, 'Share your profile'),
    careersEmail: emailMatch?.[1]?.toLowerCase() ?? null,
  }
}

export const hasVerifiedEmptySubpageSignal = (html, heading) => {
  const page = String(html ?? '')
  const safeHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  return new RegExp(`<title>\\s*${safeHeading}[^<]*SASMOS\\s*<\\/title>`, 'i').test(page)
    && new RegExp(`<h1[^>]*>\\s*${safeHeading}\\s*<\\/h1>`, 'i').test(page)
    && /<div id="content" class="sixteen columns">\s*<\/div>/i.test(page)
}

const PUBLIC_JOB_LINK_PATTERN =
  /<a[^>]+href="[^"]*(?:jobs\.lever\.co|greenhouse\.io|greenhouse\.com|myworkdayjobs\.com|workable\.com|ashbyhq\.com|smartrecruiters\.com|jobvite\.com|icims\.com|\/job\/|\/jobs\/[^/"#?]+|\/open-positions\/[^/"#?]+)[^"]*"[^>]*>|\bapply now\b/i

export const pageExposesPublicJobListings = (html) =>
  PUBLIC_JOB_LINK_PATTERN.test(String(html ?? ''))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createSasmosHetTechnologiesScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const joinTeamHtml = await fetchText(JOIN_TEAM_URL)

    if (!hasOfficialJoinTeamSignal(joinTeamHtml)) {
      throw new Error('SASMOS HET TECHNOLOGIES join-team page no longer matches the verified official join-team surface')
    }

    const verifiedLinks = extractVerifiedJoinTeamLinks(joinTeamHtml)
    if (
      verifiedLinks.openPositionsUrl !== OPEN_POSITIONS_URL
      || verifiedLinks.shareProfileUrl !== SHARE_PROFILE_URL
      || verifiedLinks.careersEmail !== CAREERS_EMAIL
    ) {
      throw new Error('SASMOS HET TECHNOLOGIES join-team page no longer matches the verified official join-team surface')
    }

    const openPositionsHtml = await fetchText(OPEN_POSITIONS_URL)
    if (pageExposesPublicJobListings(openPositionsHtml)) {
      throw new Error('SASMOS HET TECHNOLOGIES public job listings are now exposed on the open positions page')
    }

    if (!hasVerifiedEmptySubpageSignal(openPositionsHtml, 'Open Positions')) {
      throw new Error('SASMOS HET TECHNOLOGIES open positions page no longer matches the verified empty public shell')
    }

    const shareProfileHtml = await fetchText(SHARE_PROFILE_URL)
    if (pageExposesPublicJobListings(shareProfileHtml)) {
      throw new Error('SASMOS HET TECHNOLOGIES public job listings are now exposed on the share-your-profile page')
    }

    if (!hasVerifiedEmptySubpageSignal(shareProfileHtml, 'Share your profile')) {
      throw new Error('SASMOS HET TECHNOLOGIES share-your-profile page no longer matches the verified empty public shell')
    }

    return []
  },
})

export const run = async (options = {}) => createSasmosHetTechnologiesScraper().run(options)

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
