import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runCurrentVistex } from './currentNative20261115.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'vistex'
export const COMPANY = 'Vistex'
export const HOMEPAGE_URL = 'https://www.vistex.com/'
export const CAREERS_URL = 'https://www.vistex.com/careers/'
export const INDIA_CAREERS_URL = 'https://www.vistex.com/careers/careers-in-india/'
export const ABOUT_URL = 'https://www.vistex.com/about-us/'
export const CONTACT_URL = 'https://www.vistex.com/contact/'
export const ULTIPRO_BOARD_URL =
  'https://recruiting2.ultipro.com/VIS1012VISX/JobBoard/23e64b4e-ff01-4579-9e5a-835480ac7a51/?o=postedDateDesc&q='

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const decodeUrlEntities = (value) =>
  String(value ?? '')
    .replace(/&amp;/gi, '&')
    .trim()

export const extractOfficialUltiproUrl = (html = '') => {
  const anchors = [...String(html ?? '').matchAll(
    /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
  )].map(([, href, text]) => ({
    href: decodeUrlEntities(href),
    text: normalizeWhitespace(text),
  }))

  const primaryAnchor = anchors.find(({ text }) => /View All Opportunities|Find Your Opportunity/i.test(text))
    || anchors.find(({ text, href }) => /India/i.test(text) && /^https?:\/\//i.test(href))

  const candidate = primaryAnchor?.href
    || decodeUrlEntities(html).match(
      /https:\/\/recruiting2\.ultipro\.com\/VIS1012VISX\/JobBoard\/23e64b4e-ff01-4579-9e5a-835480ac7a51\/\?[^"'<\s]+/i,
    )?.[0]

  if (!candidate) return null

  try {
    const url = new URL(candidate)
    const normalizedPath = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`
    if (
      url.origin === 'https://recruiting2.ultipro.com'
      && normalizedPath === '/VIS1012VISX/JobBoard/23e64b4e-ff01-4579-9e5a-835480ac7a51/'
    ) {
      return ULTIPRO_BOARD_URL
    }

    return url.toString()
  } catch {
    return normalizeWhitespace(candidate)
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Revenue Management Solutions & Services - Vistex, Inc')
    && normalized.includes('Stronger Revenue. Optimized Margins. Financial Insights.')
    && normalized.includes('With Vistex AI-driven enterprise software and services.')
    && normalized.includes('Vistex AI-driven enterprise software helps businesses take control of revenue-generating programs')
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Careers - Vistex, Inc')
    && normalized.includes('Careers at Vistex.')
    && normalized.includes('Be Our Colleague.')
    && normalized.includes('Find Your Opportunity')
    && /View All Opportunities/i.test(String(html ?? ''))
}

export const hasOfficialIndiaCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Careers in India - Vistex, Inc.')
    && normalized.includes('Careers in India')
    && normalized.includes('We develop enterprise business solutions for the largest companies in the world')
    && normalized.includes('Vistex Asia Pacific Pvt Ltd.')
    && normalized.includes('Mumbai, Maharashtra 400059, India')
    && /FIND YOUR OPPORTUNITY/i.test(String(html ?? ''))
}

export const hasOfficialAboutSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('About Us - Vistex, Inc')
    && /About Us/i.test(normalized)
    && (
      normalized.includes('Vistex AI-driven enterprise software helps businesses take control of revenue-generating programs')
      || normalized.includes('Vistex solutions help businesses take control of mission critical processes')
    )
    && (
      normalized.includes('Gain visibility and control of complex pricing, trade, royalty and incentive programs')
      || normalized.includes('Now it all adds up')
    )
}

export const hasOfficialContactSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('General Inquiry - Vistex, Inc.')
    && (normalized.includes('CONTACT US') || normalized.includes('How Can We Help You?'))
    && normalized.includes('General Inquiry')
}

export const hasOfficialUltiproBoardSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('You are using an unsupported browser.')
    && normalized.includes('To use this site, please use a supported browser.')
    && normalized.includes('https://www.vistex.com/careers/')
}

export const createVistexScraper = () => ({ run: runCurrentVistex })

export const run = (options = {}) => runCurrentVistex(options)

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
