import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runCurrentShivaami } from './currentNative20261115.js'

import provider from './provider.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = provider
export const SOURCE = provider.source
export const COMPANY = provider.companyName
export const CAREERS_URL = provider.companyCareerPage

export const hasCareersShellSignal = (html = '') => {
  const page = String(html ?? '')
  return /Shivaami - Enterprise IT Solutions/i.test(page)
    && /id=["']root["']/i.test(page)
    && /assets\/index-[^"']+\.js/i.test(page)
}

export const extractMainBundleUrl = (html = '') => {
  const relativePath = String(html ?? '').match(/<script[^>]*src=["']([^"']*assets\/index-[^"']+\.js)["']/i)?.[1]
  if (!relativePath) return null

  try {
    return new URL(relativePath, CAREERS_URL).toString()
  } catch {
    return null
  }
}

export const extractCareersChunkUrl = (mainBundleText = '') => {
  const relativePath = String(mainBundleText ?? '').match(/assets\/Careers-[A-Za-z0-9_-]+\.js/)?.[0]
  if (!relativePath) return null

  try {
    return new URL(relativePath, provider.homepageUrl).toString()
  } catch {
    return null
  }
}

export const extractOpeningsFromCareersBundle = (bundleText = '') => [...String(bundleText ?? '').matchAll(
  /title:\s*"([^"]+)"\s*,\s*experience:\s*"([^"]+)"\s*,\s*description:\s*"([^"]+)"/g,
)].map((match) => ({
  title: match[1],
  experience: match[2],
  description: match[3],
}))

export const run = (options = {}) => runCurrentShivaami(options)

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
