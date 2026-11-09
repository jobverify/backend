import path from 'node:path'
import { fileURLToPath } from 'node:url'
import{createCurrentAngelScraper}from'./currentNative.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'angelone'
export const COMPANY = 'Angel One'
export const CAREERS_URL = 'https://www.angelone.in/careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const hasVerifiedCareersShellSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)
  const hasKnownTitle = /<title[^>]*>\s*Careers\s*\|\s*Angel One\s*<\/title>/i.test(rawHtml)
    || /<title[^>]*>\s*Angel One Careers \| Join a Leading Fintech Company in India\s*<\/title>/i.test(rawHtml)

  return hasKnownTitle
    && /<link[^>]+rel="canonical"[^>]+href="https:\/\/www\.angelone\.in\/careers"/i.test(rawHtml)
    && /(?:Careers at Angel One|Shape The Future of Fintech)/i.test(normalized)
    && /Departments/i.test(normalized)
    && /(?:jobs-listings|open-positions)/i.test(rawHtml)
}

export const hasEmbeddedEmptyJobsSignal = (html) =>
  /\\?"jobs\\?"\s*:\s*\[\s*\]/i.test(String(html ?? ''))

export const extractJobCards = (html) => Array.from(
  String(html ?? '').matchAll(/<a\b[^>]+href=["'][^"']*(?:\/careers\/[^"']+|\/job\/[^"']+|\/jobs\/[^"']*)["'][^>]*>/gi),
)

export const hasOpenJobCards = (html) => extractJobCards(html).length > 0
  || /\\?"jobs\\?"\s*:\s*\[\s*{[\s\S]*}\s*\]/i.test(String(html ?? ''))


export const createAngelOneScraper=createCurrentAngelScraper

export const run = async (options = {}) => createAngelOneScraper().run(options)

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
