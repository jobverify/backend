import path from 'node:path'
import { resolve4, resolve6 } from 'node:dns/promises'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'odnestcompany'
export const COMPANY = 'OdNest Company'
export const VERIFIED_ON = '2026-07-13'
export const VERIFIED_SURFACE_SUMMARY =
  'No trustworthy first-party careers surface was discoverable on July 13, 2026, and the canonical OdNest hostnames did not resolve.'
export const CAREER_HOSTS = [
  'odnestcompany.com',
  'www.odnestcompany.com',
  'odnestcompany.in',
  'www.odnestcompany.in',
  'odnestcompany.co.in',
  'www.odnestcompany.co.in',
  'odnest.com',
  'www.odnest.com',
  'odnest.in',
  'www.odnest.in',
]

export const hasResolvableFirstPartyHost = (addresses) =>
  Array.isArray(addresses) && addresses.length > 0

const resolveWithTimeout = (resolver, host, timeoutMs) => new Promise((resolve) => {
  const timeoutId = setTimeout(() => resolve([]), timeoutMs)
  resolver(host)
    .then((addresses) => resolve(Array.isArray(addresses) ? addresses : []))
    .catch(() => resolve([]))
    .finally(() => clearTimeout(timeoutId))
})

export const resolveCanonicalHosts = async (
  hosts = CAREER_HOSTS,
  {
    resolve4Impl = resolve4,
    resolve6Impl = resolve6,
    timeoutMs = 3000,
  } = {},
) => {
  const results = await Promise.all(
    hosts.flatMap((host) => [
      resolveWithTimeout(resolve4Impl, host, timeoutMs),
      resolveWithTimeout(resolve6Impl, host, timeoutMs),
    ]),
  )

  return [...new Set(results.flat())]
}

export const createOdNestCompanyScraper = () => ({
  async run({
    resolveHosts = resolveCanonicalHosts,
  } = {}) {
    const addresses = await resolveHosts(CAREER_HOSTS)

    if (hasResolvableFirstPartyHost(addresses)) {
      throw new Error(
        'OdNest Company canonical first-party hosts now resolve; re-verify the official careers surface before trusting []',
      )
    }

    return []
  },
})

export const run = async () => createOdNestCompanyScraper().run()

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
