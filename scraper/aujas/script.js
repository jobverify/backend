import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://www.nusummit.com/current-openings/'

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#8217;|&rsquo;/gi, "'")
    .replace(/&middot;|·/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const extractMetaContent = (property, html) => {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([\\s\\S]*?)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([\\s\\S]*?)["'][^>]+property=["']${property}["']`, 'i'),
  ]

  for (const pattern of patterns) {
    const match = pattern.exec(html)
    if (match) return normalizeWhitespace(match[1])
  }

  return null
}

const extractFirst = (pattern, value) => normalizeWhitespace(pattern.exec(value || '')?.[1])

const normalizeExperience = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return normalized.replace(/\bYrs?\b/i, 'years')
}

const slugToJobId = (url) => normalizeWhitespace(
  String(url || '')
    .replace(/\/+$/, '')
    .split('/')
    .pop(),
)

const parseOgDescription = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return {
    requisitionId: extractFirst(/Job Code:\s*(.*?)\s+Role:/i, normalized),
    title: extractFirst(/Role:\s*(.*?)\s+(?:Experience|Exp):/i, normalized),
    experienceRequired: normalizeExperience(
      extractFirst(/(?:Experience|Exp):\s*(.*?)\s+Location:/i, normalized),
    ),
    location: extractFirst(/Location:\s*(.*?)\s+Job Type:/i, normalized),
    employmentType: extractFirst(/Job Type:\s*(.*?)\s+Job Description:/i, normalized),
    jobDescription: extractFirst(/Job Description:\s*(.*)$/i, normalized),
  }
}

export const extractJobUrls = (html) => {
  const urls = new Set()

  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const href = match[1]

    if (/nusummituat\.com/i.test(href)) continue

    if (/^https:\/\/www\.nusummit\.com\/current-opening\/[^"'?#]+\/?$/i.test(href)) {
      urls.add(href.replace(/\/?$/, '/'))
      continue
    }

    if (/^\/current-opening\/[^"'?#]+\/?$/i.test(href)) {
      urls.add(new URL(href, CAREER_PAGE_URL).toString().replace(/\/?$/, '/'))
    }
  }

  return [...urls]
}

export const extractJobDetail = (html, sourceUrl) => {
  const titleMeta = extractMetaContent('og:title', html)
  const descriptionMeta = extractMetaContent('og:description', html)
  const parsed = parseOgDescription(descriptionMeta)
  const title = normalizeWhitespace(
    parsed?.title || titleMeta?.replace(/[·]+$/g, ''),
  )
  const location = parsed?.location || null

  return {
    title,
    company: 'Aujas Cybersecurity',
    department: null,
    location,
    city: normalizeWhitespace(location?.split(',')[0]),
    jobId: slugToJobId(sourceUrl),
    requisitionId: parsed?.requisitionId || null,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: parsed?.employmentType || null,
    experienceRequired: parsed?.experienceRequired || null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: parsed?.jobDescription || null,
  }
}

const fetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const run = async () => {
  const listingHtml = await fetchText(CAREER_PAGE_URL)
  const jobUrls = extractJobUrls(listingHtml)
  const jobs = []
  const maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null

  for (const jobUrl of jobUrls) {
    const detailHtml = await fetchText(jobUrl)
    const detail = extractJobDetail(detailHtml, jobUrl)

    if (!detail.title || !detail.jobId) continue

    jobs.push({
      ...detail,
      company: 'Aujas Cybersecurity',
      source: 'aujas',
      link: detail.applyUrl || detail.sourceUrl,
      scrapedAt: new Date().toISOString(),
    })

    if (maxJobs && jobs.length >= maxJobs) break
  }

  return jobs
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Aujas scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'aujas')
    console.log('DB result:', result)
    process.exit(0)
  }
}
