import {runCurrentSkillLync} from './currentNative20261117.js'
export const SOURCE = 'skilllync'
export const COMPANY = 'Skill-Lync'
export const CAREERS_URL = 'https://www.skill-lync.com/careers'
export const JOBS_URL = 'https://skill-lync.com/careers/jobs'
export const ACCEPTED_UNAVAILABLE_STATUSES = [502, 503]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bview jobs\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /greenhouse\.io/i,
  /recruitcrm/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const getCurrentOpeningsSection = (html) => {
  const page = normalizeWhitespace(html)
  const startIndex = page.indexOf('CURRENT OPENINGS')
  if (startIndex < 0) return null

  const endIndex = page.indexOf('SPEAK WITH US', startIndex)
  return endIndex >= 0 ? page.slice(startIndex, endIndex) : page.slice(startIndex)
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('make a positive career move. reach for the stars')
    && normalized.includes('evolve with us and create the future of learning')
    && normalized.includes('click to view openings')
}

export const hasOfficialJobsPageSignal = (html) => {
  const currentOpeningsSection = getCurrentOpeningsSection(html) || ''
  const normalized = currentOpeningsSection.toLowerCase()

  return normalized.includes('current openings')
    && normalized.includes('filter by location')
    && normalized.includes('filter by team')
    && normalized.includes('filter by work type')
    && normalized.includes('clear all')
}

export const hasRenderedPublicJobCards = (html) => {
  const currentOpeningsSection = getCurrentOpeningsSection(html) || ''
  if (!currentOpeningsSection) return false

  return PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(currentOpeningsSection))
    || /href\s*=\s*["'][^"']*careers\/jobs\/[^"']+/i.test(String(html ?? ''))
}

export const isVerifiedUnavailablePage = (page = {}) => {
  const html = String(page?.html ?? '')
  const normalized = normalizeWhitespace(html).toLowerCase()

  return ACCEPTED_UNAVAILABLE_STATUSES.includes(Number(page?.status))
    && (
      normalized.includes('503 service temporarily unavailable')
      || normalized.includes('502 bad gateway')
    )
    && !hasRenderedPublicJobCards(html)
}

export const createSkillLyncScraper = () => ({run:runCurrentSkillLync})

export const run = async (options = {}) => createSkillLyncScraper().run(options)
