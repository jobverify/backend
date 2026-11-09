import {runPublicLinkedIn,fetchPublicPage} from './publicLinkedIn.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { JUEGO_STUDIO_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JHUB_APPLICATION_URL = PROVIDER_METADATA.publicApplicationUrl
export { PROVIDER_METADATA }

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;|&mdash;|&#8212;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const decodeHtml = (value) => normalizeWhitespace(value)

const normalizeCity = (value) => {
  const normalized = decodeHtml(value)
  if (!normalized) return null
  if (/bengaluru|bangalore/i.test(normalized)) return 'Bangalore'
  if (/mangalore/i.test(normalized)) return 'Mangalore'
  return normalized
}

const buildIndiaLocation = (city) => city ? `${city}, Karnataka, India` : 'India'

const JHUB_ROLE_METADATA = new Map([
  ['3D Artist I / II', {
    city: 'Bangalore',
    department: 'Modelling',
    positionTitle: '3D Artist I, 3D Artist II',
    experienceRequired: '2- 4 years',
  }],
  ['Intern 3D Artist', {
    city: null,
    department: 'Modelling',
    positionTitle: 'Intern 3d Artist',
    experienceRequired: null,
  }],
  ['Lead Animator', {
    city: 'Bangalore',
    department: 'Animation',
    positionTitle: 'Lead Animator',
    experienceRequired: '8+ years',
  }],
  ['Senior 3D Artist', {
    city: null,
    department: 'Modelling',
    positionTitle: 'Senior 3D Artist',
    experienceRequired: '5+',
  }],
  ['Senior Executive - Finance & Accounts', {
    city: 'Bangalore',
    department: 'Accounts',
    positionTitle: 'Senior Finance Executive',
    experienceRequired: '5+ years',
  }],
  ['UI UX Designer', {
    city: 'Bangalore',
    department: 'UI Design',
    positionTitle: 'Senior UI-Designer',
    experienceRequired: '5+ years',
  }],
])

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('OPEN POSITIONS')
    && normalized.includes('3D Artist I / II')
    && normalized.includes('Apply Now')
}

export const hasJhubApplicationSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Apply a Job')
    && normalized.includes('Job Opening:')
    && normalized.includes('3D Artist I / II')
    && /<select[^>]+name=["']jo_id["']/i.test(String(html ?? ''))
}

export const extractOpenPositions = (html = '') =>
  Array.from(
    String(html ?? '').matchAll(
      /<section class="job">[\s\S]*?<h5>([^<]+)<\/h5>[\s\S]*?<h5>([^<]*)<\/h5>[\s\S]*?<h6>Department:<\/h6>\s*<p>([^<]*)<\/p>[\s\S]*?<h6>Position:<\/h6>\s*<p>([^<]*)<\/p>[\s\S]*?<h6>Relevant Experience:<\/h6>\s*<p>([^<]*)<\/p>[\s\S]*?<a href="([^"]+)">Apply Now<\/a>[\s\S]*?<\/section>/gi,
    ),
    (match) => ({
      title: decodeHtml(match[1]),
      city: decodeHtml(match[2]) || null,
      department: decodeHtml(match[3]) || null,
      positionTitle: decodeHtml(match[4]) || null,
      experienceRequired: decodeHtml(match[5]) || null,
      applyUrl: decodeHtml(match[6]),
    }),
  )
    .filter((job) => job.title && job.applyUrl)
    .map((job) => ({
      ...job,
      city: normalizeCity(job.city),
      location: buildIndiaLocation(normalizeCity(job.city)),
      country: 'India',
      state: job.city ? 'Karnataka' : null,
      jobId: slugify(job.title),
      sourceUrl: job.applyUrl,
      link: job.applyUrl,
    }))

export const extractJhubOpenPositions = (html = '') =>
  Array.from(
    String(html ?? '').matchAll(/<option[^>]*value="([^"]+)"[^>]*>([\s\S]*?)<\/option>/gi),
    (match) => ({
      joId: decodeHtml(match[1]),
      title: decodeHtml(match[2]).replace(/–/g, '-'),
    }),
  )
    .filter((job) => job.joId && job.joId !== 'other' && job.title)
    .map((job) => {
      const metadata = JHUB_ROLE_METADATA.get(job.title) || {}
      const city = metadata.city || null
      return {
        title: job.title,
        city,
        department: metadata.department || null,
        positionTitle: metadata.positionTitle || null,
        experienceRequired: metadata.experienceRequired || null,
        applyUrl: JHUB_APPLICATION_URL,
        location: buildIndiaLocation(city),
        country: 'India',
        state: city ? 'Karnataka' : null,
        jobId: slugify(job.title),
        requisitionId: job.joId,
        sourceUrl: JHUB_APPLICATION_URL,
        link: JHUB_APPLICATION_URL,
      }
    })

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const isBrowserFallbackError = (error) =>
  /HTTP (?:403|429)\b|fetch failed|timed out|timeout|could not connect|und_err_connect_timeout|ssl\/tls secure channel|econnreset|unable to/i
    .test(String(error?.message ?? error ?? ''))

const buildBlockedCareersSurfaceError = (error) => {
  const upstreamError = new Error(
    'Juego Studio verified careers page remains blocked after HTTP fallback',
    { cause: error },
  )
  upstreamError.softFailure = true
  upstreamError.upstreamOutage = true
  upstreamError.failureKind = 'network_or_timeout'
  upstreamError.abortRetries = true
  return upstreamError
}

export const createJuegoStudioScraper = ({now=()=>new Date().toISOString()}={})=>({
 async run(options={}){
  const fetchPage=options.fetchPage||(options.fetchText?async(url,context)=>({status:200,url,html:await options.fetchText(url,context)}):fetchPublicPage)
  return runPublicLinkedIn({...options,fetchPage,now:options.now||now})
 }
})
export const run = (options={})=>createJuegoStudioScraper().run(options)

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
