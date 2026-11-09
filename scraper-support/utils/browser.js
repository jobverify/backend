/**
 * @file Optimized Puppeteer browser launch and page setup configuration.
 * @module scraper/utils/browser
 */

import dns from 'node:dns/promises'
import { existsSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

const dnsCache = new Map()
export const isPrivateIPv4 = (hostname) => {
  const parts = hostname.split('.').map((part) => Number.parseInt(part, 10))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false
  }

  const [first, second] = parts
  return (
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first === 0
  )
}

const isPrivateIPv6 = (hostname) => {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  const mappedIPv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1]

  if (!normalized.includes(':')) return false
  if (mappedIPv4) return isPrivateIPv4(mappedIPv4)

  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('::ffff:127.') ||
    normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:192.168.') ||
    /^::ffff:172\.(1[6-9]|2\d|3[0-1])\./.test(normalized) ||
    normalized === '::ffff:0:0'
  )
}

export const isInternalIpAddress = (hostname) => (
  isPrivateIPv4(hostname) || isPrivateIPv6(hostname)
)

const WINDOWS_BROWSER_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
]

const MAC_BROWSER_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
]

const LINUX_BROWSER_CANDIDATES = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/microsoft-edge',
]

const getBrowserExecutableCandidates = (platform = process.platform) => {
  if (platform === 'win32') return WINDOWS_BROWSER_CANDIDATES
  if (platform === 'darwin') return MAC_BROWSER_CANDIDATES
  return LINUX_BROWSER_CANDIDATES
}

export const resolveBrowserExecutablePath = ({
  platform = process.platform,
  env = process.env,
  existsSync: fileExists = existsSync,
} = {}) => {
  const explicitPath = env.PUPPETEER_EXECUTABLE_PATH || env.CHROME_EXECUTABLE_PATH
  if (explicitPath && fileExists(explicitPath)) {
    return explicitPath
  }

  return getBrowserExecutableCandidates(platform).find((candidate) => fileExists(candidate)) || null
}

export const createBrowserUserDataDir = async ({
  mkdtempImpl = mkdtemp,
  tmpdirPath = os.tmpdir(),
} = {}) => mkdtempImpl(path.join(tmpdirPath, 'jobverify-puppeteer-profile-'))

const resolveHostnameAddresses = async (hostname) => {
  if (dnsCache.has(hostname)) return dnsCache.get(hostname)

  const lookupPromise = dns.lookup(hostname, { all: true, verbatim: true })
    .then((records) => records.map((record) => record.address))
    .catch(() => [])

  dnsCache.set(hostname, lookupPromise)
  return lookupPromise
}

export const isBlockedInternalUrl = async (value, resolveAddresses = resolveHostnameAddresses) => {
  try {
    const url = new URL(value)
    const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()

    if (!['http:', 'https:'].includes(url.protocol)) return true

    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return true
    }

    if (net.isIP(hostname)) {
      return isInternalIpAddress(hostname)
    }

    const resolvedAddresses = await resolveAddresses(hostname)
    if (resolvedAddresses.length === 0) {
      return true
    }

    return resolvedAddresses.some((address) => isInternalIpAddress(address))
  } catch {
    return true
  }
}

// Shared browser scraping is disabled. Sources must use HTTP/API access.
export const launchBrowser = async (options = {}) => {
  const requestingSource = (
    options.sourcePath
    || options.source
    || options.scraper
    || options.configuration
    || options.config?.sourcePath
    || options.config?.source
    || 'this scraper'
  )
  const error = new Error(
    `API-only scraper runtime forbids browser launches. Migrate ${requestingSource} to HTTP/API access.`,
  )
  error.code = 'SCRAPER_BROWSER_DISABLED'
  error.abortRetries = true
  throw error
}

// Configures a new browser page with request interception to block heavy assets.
export const createOptimizedPage = async (browser) => {
  const page = await browser.newPage()
  await page.setRequestInterception(true)
  page.on('request', async (req) => {
    if (await isBlockedInternalUrl(req.url())) {
      await req.abort()
      return
    }

    const type = req.resourceType()
    if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
      await req.abort()
    } else {
      await req.continue()
    }
  })
  return page
}
