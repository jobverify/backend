import path from 'node:path'
import { fileURLToPath } from 'node:url'

import HIVER_CATALOG from './catalog.js'
import {runCurrentHiver} from './currentNative20261115.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = HIVER_CATALOG.source
export const COMPANY = HIVER_CATALOG.companyName
export const CAREERS_URL = HIVER_CATALOG.companyCareerPage
export const PINPOINT_BOARD_URL = HIVER_CATALOG.officialPinpointBoardUrl
export const PINPOINT_POSTINGS_URL = HIVER_CATALOG.pinpointPostingsUrl
export const PINPOINT_RSS_URL = HIVER_CATALOG.pinpointRssUrl
export const VERIFIED_ON = HIVER_CATALOG.verifiedOn
export const PROVIDER_METADATA = HIVER_CATALOG

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeText = (value) => normalizeWhitespace(value)?.toLowerCase() || ''

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const sameUrl = (left, right) => normalizeComparableUrl(left) === normalizeComparableUrl(right)

const normalizeUrl = (value, baseUrl = PINPOINT_BOARD_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return normalized
  }
}

export const extractPinpointBoardUrl = (html) => {
  const match = String(html ?? '').match(/href=["'](https:\/\/hiverhq\.pinpointhq\.com\/?)["']/i)
  if (!match?.[1]) return null

  try {
    return `${new URL(match[1]).origin}/`
  } catch {
    return null
  }
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeText(page)
  const noOpenPositionsCount = (page.match(/No open positions currently/gi) || []).length

  return /<title>\s*Hiver[\s\S]*\|\s*Hiver Careers\s*<\/title>/i.test(page)
    && text.includes('see our open positions')
    && text.includes('open positions')
    && noOpenPositionsCount >= 1
    && text.includes('jobs@hiverhq.com')
    && sameUrl(extractPinpointBoardUrl(page), PINPOINT_BOARD_URL)
}

export const extractPinpointPostingsUrl = (html) => {
  const match = String(html ?? '').match(
    /["'](\/postings\.json|https:\/\/hiverhq\.pinpointhq\.com\/postings\.json)["']/i,
  )
  return match?.[1] ? normalizeUrl(match[1], PINPOINT_BOARD_URL) : null
}

export const hasOfficialPinpointEmptyBoardSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeText(page)

  return /<title>\s*Jobs at Hiver\s*\|\s*Hiver Careers\s*<\/title>/i.test(page)
    && text.includes('current opportunities')
    && /External::Jobs/i.test(page)
    && sameUrl(extractPinpointPostingsUrl(page), PINPOINT_POSTINGS_URL)
    && page.includes(PINPOINT_RSS_URL)
    && text.includes('there are currently no positions advertised')
    && text.includes('register your interest')
}

// Historical exported markup predicates remain available to callers. Current
// acquisition never treats their empty-template wording as native inventory.
export const createHiverScraper = () => ({run:runCurrentHiver})

export const run = async (options = {}) => createHiverScraper().run(options)

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
