import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'hutlabs'
export const COMPANY = 'HuT Labs'
export const JOBS_URL = 'https://www.amrita.edu/jobs/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HUT_LABS_TITLE_PATTERN = /\b(?:hut\s*labs|hutlabs|humanitarian technology)\b/i

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8217;|&rsquo;|&#x2019;/gi, "'")
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const stripTags = (value) => decodeHtml(String(value ?? ''))
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<\/p>/gi, ' ')
  .replace(/<\/div>/gi, ' ')
  .replace(/<\/span>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const absoluteUrl = (value, base = JOBS_URL) => {
  try {
    return new URL(String(value ?? ''), base).toString()
  } catch {
    return null
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  timeoutMs: 15000,
  label: SOURCE,
})

const normalizeLocation = (value) => {
  const text = stripTags(value)
  if (/amritapuri/i.test(text)) {
    return {
      location: 'Amritapuri, Kollam, Kerala, India',
      city: 'Kollam',
      state: 'Kerala',
      country: 'India',
    }
  }

  const parts = text.split(',').map((part) => part.trim()).filter(Boolean)
  if (parts.length >= 2) {
    return {
      location: `${parts[0]}, ${parts[1]}`,
      city: parts[0],
      state: parts[1],
      country: 'India',
    }
  }

  return {
    location: text,
    city: null,
    state: null,
    country: 'India',
  }
}

export const hasOfficialJobsBoardSignal = (html) => {
  const page = String(html ?? '')
  return /<title>\s*Job Openings at Amrita Vishwa Vidyapeetham\s*<\/title>/i.test(page)
    && /https:\/\/www\.amrita\.edu\/job\//i.test(page)
    && /class=["'][^"']*\bposition\b[^"']*["']/i.test(page)
    && /Apply now/i.test(page)
}

export const isHuTLabsRoleTitle = (title) => HUT_LABS_TITLE_PATTERN.test(String(title ?? ''))

export const extractJobCards = (html) => {
  const cards = []
  const page = String(html ?? '')

  for (const blockMatch of page.matchAll(/<li>\s*<div class="position">[\s\S]*?<\/li>/gi)) {
    const block = blockMatch[0]
    const titleMatch = block.match(/<div class="position">\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/div>/i)
    if (!titleMatch) continue

    const detailUrl = absoluteUrl(titleMatch[1])
    const title = stripTags(titleMatch[2])
    if (!detailUrl || !title) continue

    const placeMatch = block.match(/<div class="place">([\s\S]*?)<\/div>/i)
    const applyMatch = block.match(/<a[^>]+href=["']([^"']+)["'][^>]*>\s*Apply now\s*<\/a>/i)
    const closingDateMatch = block.match(/Closing date\s*:\s*<span>([^<]+)<\/span>/i)

    cards.push({
      title,
      detailUrl,
      locationText: placeMatch ? stripTags(placeMatch[1]) : '',
      applyUrl: absoluteUrl(applyMatch?.[1]),
      closingDateText: stripTags(closingDateMatch?.[1]),
    })
  }

  return cards
}

const extractMetaUpdatedTime = (html) => {
  const match = String(html ?? '').match(/meta\s+property=["']og:updated_time["']\s+content=["']([^"']+)["']/i)
  if (!match) return null

  const value = new Date(match[1])
  return Number.isNaN(value.getTime()) ? null : value.toISOString()
}

const toDateOnlyIso = (value) => {
  const text = String(value ?? '').trim()
  const match = text.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})$/)
  if (!match) return null

  const months = {
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    may: '05',
    jun: '06',
    jul: '07',
    aug: '08',
    sep: '09',
    oct: '10',
    nov: '11',
    dec: '12',
  }
  const month = months[match[1].slice(0, 3).toLowerCase()]
  if (!month) return null

  const day = match[2].padStart(2, '0')
  const parsed = new Date(`${match[3]}-${month}-${day}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

const extractDetailText = (html) => {
  const match = String(html ?? '').match(/<div class="detail-text">([\s\S]*?)<\/div>\s*<div class="deatil-list">/i)
  return match ? match[1] : ''
}

const extractTableRows = (html) => {
  const tableMatch = String(html ?? '').match(/<div class="deatil-list">\s*<table[^>]*>([\s\S]*?)<\/table>/i)
  if (!tableMatch) return {}

  const rows = {}
  for (const rowMatch of tableMatch[1].matchAll(/<tr>\s*<th>([\s\S]*?)<\/(?:th|td)>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/gi)) {
    rows[stripTags(rowMatch[1]).toLowerCase()] = {
      text: stripTags(rowMatch[2]),
      html: rowMatch[2],
    }
  }

  return rows
}

export const hasOfficialHuTLabsDetailSignal = (html, expectedListingTitle = '') => {
  const page = String(html ?? '')
  const tableRows = extractTableRows(page)
  const detailTitle = stripTags(page.match(/<h2[^>]*class=["'][^"']*\bblock-title\b[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i)?.[1])
  const expectedTitle = stripTags(expectedListingTitle)

  return /<title>\s*[^<]*Hu(?:T|t)\s*Labs[^<]*-\s*Amrita Vishwa Vidyapeetham\s*<\/title>/i.test(page)
    && (!expectedTitle || detailTitle === expectedTitle)
    && Boolean(tableRows['job title']?.text)
    && Boolean(tableRows.location?.text)
    && Boolean(tableRows.qualification?.text)
    && Boolean(tableRows['last date to apply']?.text)
    && /https:\/\/careers\.amrita\.edu\/client\/job-search\?/i.test(page)
}

export const extractJobFromDetail = (html, card) => {
  const page = String(html ?? '')
  const detailText = extractDetailText(page)
  const tableRows = extractTableRows(page)

  const detailTitle = stripTags(page.match(/<h2[^>]*class=["'][^"']*\bblock-title\b[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i)?.[1])
  const jobTitle = tableRows['job title']?.text || detailTitle
  const normalizedLocation = normalizeLocation(tableRows.location?.text || card.locationText)
  const minimumQualification = tableRows.qualification?.text || null
  const closingDateText = tableRows['last date to apply']?.text || card.closingDateText
  const applyUrl = absoluteUrl(
    tableRows['apply online']?.html.match(/href=["']([^"']+)["']/i)?.[1]
      || detailText.match(/href=["']([^"']*careers\.amrita\.edu[^"']*)["']/i)?.[1]
      || card.applyUrl,
  )

  const introParagraphs = [...detailText.matchAll(/<p>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)
    .filter((paragraph) => !/^apply now$/i.test(paragraph))
  const jobDescription = introParagraphs.join(' ').trim() || null
  const postedAt = extractMetaUpdatedTime(page)

  return {
    title: jobTitle,
    company: COMPANY,
    location: normalizedLocation.location,
    city: normalizedLocation.city,
    state: normalizedLocation.state,
    country: normalizedLocation.country,
    sourceUrl: card.detailUrl,
    applyUrl,
    postedAt,
    closingDate: toDateOnlyIso(closingDateText),
    jobDescription,
    minimumQualification,
    companyCareerPage: JOBS_URL,
  }
}

export const createHuTLabsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const jobsBoardHtml = await fetchText(JOBS_URL)
    if (!hasOfficialJobsBoardSignal(jobsBoardHtml)) {
      throw new Error('HuT Labs verified Amrita jobs board changed materially')
    }

    const cards = extractJobCards(jobsBoardHtml)
    if (!cards.length) {
      throw new Error('HuT Labs verified Amrita jobs board no longer exposes recognizable job cards')
    }

    const hutLabsCards = cards.filter((card) => isHuTLabsRoleTitle(card.title))
    if (!hutLabsCards.length) {
      return []
    }

    const jobs = []
    for (const card of hutLabsCards) {
      const detailHtml = await fetchText(card.detailUrl)
      if (!hasOfficialHuTLabsDetailSignal(detailHtml, card.title)) {
        throw new Error(`HuT Labs verified HuT Labs detail surface changed: ${card.detailUrl}`)
      }

      jobs.push(extractJobFromDetail(detailHtml, card))
    }

    return jobs
  },
})

export const run = async (options = {}) => createHuTLabsScraper().run(options)

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
