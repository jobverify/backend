import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const CAREER_PAGE_URL = 'https://tutorhiring.cuemath.com/'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
const TUTOR_APPLICATION_SIGNAL_PATTERN = /become a cuemath tutor|start your application|cuemath tutor screening/i

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'cuemath',
  timeoutMs: 15000,
})

export const hasTutorApplicationSignal = (html) =>
  TUTOR_APPLICATION_SIGNAL_PATTERN.test(String(html ?? ''))

export const extractJobs = () => []

export const createCuemathScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREER_PAGE_URL)

    if (!hasTutorApplicationSignal(html)) {
      throw new Error('Cuemath tutor application page no longer exposes public tutor-application signals')
    }

    return extractJobs(html)
  },
})

export const run = async () => createCuemathScraper().run()
