const CAREERS_PAGE_URL = 'https://www.dhan.bank.in/careers/'
const CAREERS_API_URL = 'https://www.dhan.bank.in/api/careers/'

const normalizeDescription = (value) => String(value || '')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

const toJob = (entry, scrapedAt) => {
  if (!entry?.id || !entry.title || Number(entry.status) !== 1) return null

  const id = String(entry.id)
  const applyUrl = entry.applyForm === 1
    ? `https://www.dhan.bank.in/cv?post=${encodeURIComponent(id)}`
    : null

  return {
    title: entry.title,
    company: 'Dhanalaxmi Bank',
    department: entry.title,
    location: 'India',
    city: null,
    country: 'India',
    jobId: id,
    requisitionId: id,
    sourceUrl: CAREERS_PAGE_URL,
    applyUrl,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: entry.createdAt || null,
    closingDate: entry.lastDate || null,
    jobDescription: normalizeDescription(entry.description),
    attachmentUrl: entry.pdfFile ? new URL(entry.pdfFile, CAREERS_PAGE_URL).href : null,
    source: 'dhanalaxmibank',
    link: applyUrl || CAREERS_PAGE_URL,
    scrapedAt,
  }
}

export const createDhanalaxmiBankScraper = () => ({
  async run(options = {}) {
    const payload = await (options.fetchJson || defaultFetchJson)(CAREERS_API_URL)
    const scrapedAt = new Date().toISOString()

    return (payload?.careers || [])
      .map((entry) => toJob(entry, scrapedAt))
      .filter(Boolean)
  },
})

export const run = async () => createDhanalaxmiBankScraper().run()
