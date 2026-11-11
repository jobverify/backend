import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {collectStridesNative,activeCorporate,activePortal} from './nativeContract.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { STRIDES_PHARMA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = STRIDES_PHARMA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const OFFICIAL_CAREERS_HANDOFF_URL = PROVIDER_METADATA.officialCareersHandoffUrl
export const PORTAL_JOBS_SERVICE_URL = PROVIDER_METADATA.portalJobServiceUrl
export const PORTAL_COMPANY_TOKEN = PROVIDER_METADATA.portalCompanyToken
export const LISTING_KEY = PROVIDER_METADATA.listingKey
export const DETAIL_KEY = PROVIDER_METADATA.detailKey
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const decodeHtmlEntitiesOnce = (value) => String(value ?? '')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&amp;/gi, '&')

const decodeHtmlEntities = (value) => {
  let decoded = String(value ?? '')

  for (let index = 0; index < 4; index += 1) {
    const next = decodeHtmlEntitiesOnce(decoded)
    if (next === decoded) break
    decoded = next
  }

  return decoded
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? ''))
    .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/ul|\/ol|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<(p|div|section|article|li|ul|ol|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractTagValue = (block, tagName) => {
  const match = String(block ?? '').match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'i'))
  return normalizeWhitespace(decodeHtmlEntities(match?.[1] ?? ''))
}

const extractTableBlocks = (xml, tagName) =>
  [...String(xml ?? '').matchAll(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'gi'))]
    .map((match) => match[1])

const toLocationLabel = (locationCity) => normalizeWhitespace(locationCity)

const extractMinimumQualificationFromDescription = (descriptionHtml) =>
  decodeHtmlEntities(String(descriptionHtml ?? ''))
    .match(/\bQualification:\s*([^<\n]+)/i)?.[1]?.trim() ?? null

export const hasOfficialCareersPageSignal = html => activeCorporate(html, OFFICIAL_CAREERS_HANDOFF_URL)
export const hasOfficialPortalSignal = html => activePortal(html)

export const extractPortalServiceUrl = (
  html = '',
  portalUrl = OFFICIAL_CAREERS_HANDOFF_URL,
) => {
  const doc = readNativeDocument(String(html ?? ''))
  if (!doc.nodes(n => n.tag === 'script' && (!n.attrs.type || ['text/javascript','application/javascript','module'].includes(n.attrs.type))
    && n.attrs.src && new URL(n.attrs.src, portalUrl).href === new URL('js/Communicator.js', portalUrl).href).length) return null

  return new URL('ServiceHandler.svc/GenericMethod', portalUrl).toString()
}

const buildXmlTag = (key, value) => `<${key}>${String(value ?? '')}</${key}>`

export const buildServiceRequestBody = ({ key, params = {} } = {}) => {
  const paramXml = Object.entries(params)
    .map(([paramKey, paramValue]) => buildXmlTag(paramKey, paramValue))
    .join('')
  const xml = `<data><ctrl><kv>${key}</kv><bh>V</bh></ctrl><data><param>${paramXml}</param></data></data>`

  return JSON.stringify({ Inputparams: xml })
}

export const buildApplyUrl = (jobId) =>
  new URL(`main.aspx?loc=${encodeURIComponent(jobId)}&type=direct`, OFFICIAL_CAREERS_HANDOFF_URL).toString()

export const extractListings = (xml = '') =>
  extractTableBlocks(xml, 'Table6')
    .map((block) => ({
      jobId: extractTagValue(block, 'JobId'),
      title: extractTagValue(block, 'title'),
      designation: extractTagValue(block, 'designation'),
      department: extractTagValue(block, 'department'),
      experience: extractTagValue(block, 'experience'),
      employmentType: extractTagValue(block, 'employee_type'),
      totalPositions: extractTagValue(block, 'total_positions'),
      locationCity: extractTagValue(block, 'location_city'),
      nativeWorksite: extractTagValue(block, 'Joblocation'),
      companyToken: extractTagValue(block, 'company'),
    }))
    .filter((job) => normalizeWhitespace(job.companyToken) === PORTAL_COMPANY_TOKEN)
    .map((job) => ({
      ...job,
      locationLabel: job.nativeWorksite || toLocationLabel(job.locationCity),
    }))
    .filter((job) => job.jobId && job.title)

export const extractJobDetail = (xml = '') => {
  const block = extractTableBlocks(xml, 'Table')[0]
  if (!block) return null

  const descriptionHtml = extractTagValue(block, 'description')
  const jobDescription = stripTags(descriptionHtml)

  return {
    jobId: extractTagValue(block, 'JobId'),
    officialCompanyName: extractTagValue(block, 'company'),
    title: extractTagValue(block, 'title'),
    designation: extractTagValue(block, 'designation'),
    department: extractTagValue(block, 'department'),
    employmentType: extractTagValue(block, 'employee_type') || extractTagValue(block, 'employee_type1'),
    experience: extractTagValue(block, 'experience'),
    locationCity: extractTagValue(block, 'location_city'),
    minimumQualification: extractMinimumQualificationFromDescription(descriptionHtml),
    jobDescription,
  }
}

export const createStridesPharmaScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    if (maxJobs != null && (!Number.isSafeInteger(maxJobs) || maxJobs < 1)) throw new RangeError('Invalid Strides result limit')
    return collectStridesNative({...options,maxJobs}, {
      careers: CAREERS_URL, portal: OFFICIAL_CAREERS_HANDOFF_URL,
      service: PORTAL_JOBS_SERVICE_URL, companyToken: PORTAL_COMPANY_TOKEN,
      listingKey: LISTING_KEY, detailKey: DETAIL_KEY, buildServiceRequestBody, buildApplyUrl,
    })
  },
})
export const run = async (options = {}) => createStridesPharmaScraper(options).run(options)

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
