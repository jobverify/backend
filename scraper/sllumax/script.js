import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const COMPANY = 'SL LUMAX'
export const OFFICIAL_COMPANY_PAGE_URL = 'https://www.slworld.com/about_eng/grobal_02_11.php'
export const CURRENT_OPENINGS_URL = 'https://www.lumaxworld.in/current-openings.html'
export const WORK_WITH_US_URL = 'https://www.lumaxworld.in/work-with-us.html'

const COMPANY_TITLE_PATTERN = /<title>\s*Global network\s*\|\s*SL corporation\s*<\/title>/i
const SL_LUMAX_TAMIL_NADU_PATTERN = /SL Lumax\s*\(Tami\s*nadu\)/i
const SL_LUMAX_PUNE_PATTERN = /SL Lumax\s*\(Pune\)/i
const SL_LUMAX_TAMIL_NADU_ADDRESS_PATTERN = /G-15\s+Sipcot\s+Industrial\s+Park\s+Irrugattukottai/i
const SL_LUMAX_PUNE_ADDRESS_PATTERN = /Plot\s+No\s+B-1\s*,?Talegon\s+Industrial\s+Area\s+Phase-II/i

const CURRENT_OPENINGS_TITLE_PATTERN = /<title>\s*Lumax World\s*\|\s*lumax career\s*&amp;\s*Job Openings\s*<\/title>/i
const CURRENT_OPENINGS_HEADING_PATTERN = /Current openings/i
const CURRENT_OPENINGS_VACANCY_PATTERN = /\b\d+\s+Vacanc(?:y|ies)\b|There (?:is|are) currently \d+ vacanc(?:y|ies)/i
const CURRENT_OPENINGS_APPLY_PATTERN = /Apply Now/i

const WORK_WITH_US_TITLE_PATTERN = /<title>\s*Lumax World\s*\|\s*Work-with-us\s*<\/title>/i
const WORK_WITH_US_HEADING_PATTERN = /Work With Us/i
const WORK_WITH_US_FORM_PATTERN = /formvalidate_workwithus_lumax\.php/i
const WORK_WITH_US_POSITION_PATTERN = /Position Applied For/i

const SL_LUMAX_ATTRIBUTION_PATTERNS = [
  /SL Lumax/i,
  /Sriperumbudur/i,
  /Irrugattukottai/i,
  /Talegon\s+Industrial\s+Area/i,
  /Badhalawadi/i,
]

const containsAll = (page, patterns) => patterns.every((pattern) => pattern.test(page))

export const hasOfficialCompanySignal = (html) => {
  const page = String(html ?? '')

  return containsAll(page, [
    COMPANY_TITLE_PATTERN,
    SL_LUMAX_TAMIL_NADU_PATTERN,
    SL_LUMAX_PUNE_PATTERN,
    SL_LUMAX_TAMIL_NADU_ADDRESS_PATTERN,
    SL_LUMAX_PUNE_ADDRESS_PATTERN,
  ])
}

export const hasOfficialCurrentOpeningsSignal = (html) => {
  const page = String(html ?? '')

  return containsAll(page, [
    CURRENT_OPENINGS_TITLE_PATTERN,
    CURRENT_OPENINGS_HEADING_PATTERN,
    CURRENT_OPENINGS_VACANCY_PATTERN,
    CURRENT_OPENINGS_APPLY_PATTERN,
  ])
}

export const hasOfficialWorkWithUsSignal = (html) => {
  const page = String(html ?? '')

  return containsAll(page, [
    WORK_WITH_US_TITLE_PATTERN,
    WORK_WITH_US_HEADING_PATTERN,
    WORK_WITH_US_FORM_PATTERN,
    WORK_WITH_US_POSITION_PATTERN,
  ])
}

export const pageMentionsAttributedSllumaxOpenings = (html) => {
  const page = String(html ?? '')

  return SL_LUMAX_ATTRIBUTION_PATTERNS.some((pattern) => pattern.test(page))
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'sllumax',
  timeoutMs: 15000,
})

export const createSllumaxScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const companyHtml = await fetchText(OFFICIAL_COMPANY_PAGE_URL)
    if (!hasOfficialCompanySignal(companyHtml)) {
      throw new Error('SL LUMAX official SL company surface changed; refusing to assume no attributable public jobs')
    }

    const currentOpeningsHtml = await fetchText(CURRENT_OPENINGS_URL)
    if (!hasOfficialCurrentOpeningsSignal(currentOpeningsHtml)) {
      throw new Error('SL LUMAX official Lumax current openings surface changed; refusing to assume no attributable public jobs')
    }

    if (pageMentionsAttributedSllumaxOpenings(currentOpeningsHtml)) {
      throw new Error('Lumax current openings page now attributes roles to SL LUMAX; review required before returning an empty result')
    }

    const workWithUsHtml = await fetchText(WORK_WITH_US_URL)
    if (!hasOfficialWorkWithUsSignal(workWithUsHtml)) {
      throw new Error('SL LUMAX official Lumax work-with-us surface changed; refusing to assume no attributable public jobs')
    }

    if (pageMentionsAttributedSllumaxOpenings(workWithUsHtml)) {
      throw new Error('Lumax work-with-us page now attributes roles to SL LUMAX; review required before returning an empty result')
    }

    return []
  },
})

export const run = async (options = {}) => createSllumaxScraper().run(options)
