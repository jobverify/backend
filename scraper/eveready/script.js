import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const CAREERS_URL = 'https://www.eveready.in/talent/'

const BRAND_PATTERN = /\bEveready(?: Industries India Limited)?\b/i
const TALENT_HEADING_PATTERN = />\s*Talent\s*</i
const JOIN_PATTERN = /Join\s+Eveready/i
const RESUME_PATTERN = /Upload\s+Your\s+Resume/i
const FORM_PATTERN = /<form\b/i
const FILE_INPUT_PATTERN = /type=["']file["']/i
const FUNCTION_PATTERN = /name=["']department["']|>\s*(?:Department|Function Applied for)\*?\s*</i
const STATE_PATTERN = /name=["']state["']|>\s*State(?: Applied for)?\*?\s*</i
const APPLY_BUTTON_PATTERN = />\s*Apply\s+Now\s*</i

export const hasOfficialTalentSignal = (html) => {
  const page = String(html ?? '')
  return BRAND_PATTERN.test(page)
    && TALENT_HEADING_PATTERN.test(page)
    && JOIN_PATTERN.test(page)
    && RESUME_PATTERN.test(page)
}

export const hasApplicationFormSignal = (html) => {
  const page = String(html ?? '')
  return FORM_PATTERN.test(page)
    && FILE_INPUT_PATTERN.test(page)
    && FUNCTION_PATTERN.test(page)
    && STATE_PATTERN.test(page)
    && APPLY_BUTTON_PATTERN.test(page)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'eveready',
  timeoutMs: 15000,
})

export const createEvereadyScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialTalentSignal(careersHtml)) {
      throw new Error('Eveready official talent surface changed; refusing to assume no public listings')
    }

    if (!hasApplicationFormSignal(careersHtml)) {
      throw new Error('Eveready application form changed; refusing to assume the verified generic apply flow still applies')
    }

    return []
  },
})

export const run = async (options = {}) => createEvereadyScraper().run(options)
