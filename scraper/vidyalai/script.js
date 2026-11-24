import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import {readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {runNativeVidyalai} from './nativeData20261121.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'vidyalai'
export const COMPANY = 'Vidyalai'
export const HOMEPAGE_URL = 'https://www.vidyalai.com/'
export const JOBS_PAGE_URL = 'https://erp.vidyalai.com/jobs'
export const JOBS_API_URL =
  'https://erp.vidyalai.com/api/resource/Job%20Opening?fields=%5B%22name%22,%22job_title%22,%22route%22,%22company%22,%22department%22,%22employment_type%22,%22location%22,%22status%22%5D&filters=%5B%5B%22company%22,%22%3D%22,%22Vidyalai%22%5D,%5B%22status%22,%22%3D%22,%22Open%22%5D%5D&limit_page_length=200'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/part.?time/.test(normalized)) return 'Part-time'
  if (/intern/.test(normalized)) return 'Internship'
  if (/contract/.test(normalized)) return 'Contract'
  if (/full.?time/.test(normalized)) return 'Full-time'
  return normalizeWhitespace(value)
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return {
      location: null,
      city: null,
      state: null,
      country: null,
      remoteStatus: 'On-site',
    }
  }

  if (/remote/i.test(normalized)) {
    return {
      location: normalized,
      city: null,
      state: null,
      country: /\bindia\b/i.test(normalized) ? 'India' : null,
      remoteStatus: 'Remote',
    }
  }

  const parts = normalized.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)
  return {
    location: normalized,
    city: parts[0] || null,
    state: parts.length > 2 ? parts[1] : null,
    country: parts.length > 1 ? parts.at(-1) : null,
    remoteStatus: 'On-site',
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''
  const title = normalizeWhitespace(page.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]) || ''
  const hasOfficialTitle = /^Vidyalai$/i.test(title)
    || /Vidyalai\.com:\s*One to One Online Tuitions/i.test(title)
    || title === 'Vidyalai: One-to-One Online Lessons for IB, IGCSE, A Levels and AP'
  const hasVerifiedJobsLink = /href=["']https?:\/\/erp\.vidyalai\.com\/jobs\/?["']/i.test(page)

  return hasOfficialTitle
    && /Vidyalai/i.test(normalized)
    && /Careers/i.test(normalized)
    && hasVerifiedJobsLink
}

export const extractJobsPageCount = (html) => {
  const match = String(html ?? '').match(/Showing\s+(\d+)\s+results/i)
  return match ? Number.parseInt(match[1], 10) : null
}

export const buildDetailUrl = (route) => {
  try {
    return new URL(String(route ?? ''), 'https://erp.vidyalai.com/').toString()
  } catch {
    return null
  }
}

export const hasVerifiedDetailPage = (page = {}, record = {}) => {
  const html = String(page.html ?? '')
  const title = normalizeWhitespace(record.job_title)

  return Number(page.status) === 200
    && (() => {
      try {
        return new URL(page.url || buildDetailUrl(record.route)).hostname === 'erp.vidyalai.com'
      } catch {
        return false
      }
    })()
    && normalizeWhitespace(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]) === title
    && /Vidyalai/i.test(html)
    && /Apply Now/i.test(html)
    && (() => {
      try {
        const doc=readNativeDocument(html),owners=doc.nodes(node=>node.tag==='div'&&(node.attrs.class??'').split(/\s+/).includes('ql-editor')&&(node.attrs.class??'').split(/\s+/).includes('read-mode'))
        return owners.length===1&&Boolean(extractActiveDescription(doc.text(owners[0])))
      } catch { return false }
    })()
}

export const extractOpenJobs = (payload = {}) =>
  (Array.isArray(payload.data) ? payload.data : []).map((record) => {
    const detailUrl = buildDetailUrl(record.route)
    const { location, city, state, country, remoteStatus } = normalizeLocation(record.location)

    return {
      title: normalizeWhitespace(record.job_title),
      company: COMPANY,
      department: normalizeWhitespace(record.department),
      location,
      city,
      state,
      country,
      ...(country == null ? {sourceCountryScopeUnresolved:true} : {}),
      jobId: normalizeWhitespace(record.name),
      requisitionId: normalizeWhitespace(record.name),
      sourceUrl: detailUrl,
      applyUrl: detailUrl,
      employmentType: normalizeEmploymentType(record.employment_type),
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus,
    }
  })

export const createVidyalaiScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  run: (options = {}) => runNativeVidyalai({...options,maxJobs}),
})

export const run = async (options = {}) => createVidyalaiScraper().run(options)

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
