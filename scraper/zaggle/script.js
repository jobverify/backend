import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'zaggle'
export const COMPANY = 'Zaggle'
export const CAREERS_URL = 'https://www.zaggle.in/careers'
export const VERIFIED_AT = '2026-07-25'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const INDIA_CITIES = [
  'Ahmedabad',
  'Bengaluru',
  'Bangalore',
  'Chennai',
  'Gurgaon',
  'Gurugram',
  'Hyderabad',
  'Jaipur',
  'Kolkata',
  'Mumbai',
  'New Delhi',
  'Noida',
  'Pune',
]

const decodeHtml = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, CAREERS_URL).toString()
  } catch {
    return null
  }
}

const getCity = (value) => INDIA_CITIES.find((city) => new RegExp(`\\b${city}\\b`, 'i').test(value)) || null

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = decodeHtml(page)

  return /Be Part Of Zaggle(?:'|&#39;|&apos;|&#x27;)s Journey/i.test(text)
    && /Zaggle Open Roles/i.test(text)
    && text.includes('Why Work at Zaggle?')
}

export const extractJobs = (html) => {
  const page = String(html ?? '')
  const jobs = []
  const rolePattern = /<h4\b[^>]*>([\s\S]*?)<\/h4>([\s\S]*?)(?=<h[2-4]\b|$)/gi

  for (const match of page.matchAll(rolePattern)) {
    const title = decodeHtml(match[1])
    const block = match[2]
    const details = decodeHtml(block)
    const city = getCity(details)
    const link = [...block.matchAll(/href=["']([^"']+)["']/gi)]
      .map((linkMatch) => toAbsoluteUrl(linkMatch[1]))
      .find((candidate) => /linkedin\.com\/jobs\/view\//i.test(candidate || '')) || null

    if (!title || !city || !link || !/apply\s+now/i.test(details)) continue

    jobs.push({
      title,
      company: COMPANY,
      location: city,
      city,
      country: 'India',
      link,
      applyUrl: link,
      sourceUrl: CAREERS_URL,
    })
  }

  return jobs
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const run = async ({ fetchPage = defaultFetchPage } = {}) => {
  const page = await fetchPage(CAREERS_URL)
  if (page.status !== 200 || !hasOfficialCareersSignal(page.html)) {
    throw new Error('Zaggle verified official careers page no longer matches the trusted first-party surface')
  }

  return extractJobs(page.html)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) {
    await saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs)
  }
}
