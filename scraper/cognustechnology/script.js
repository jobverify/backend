import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { parse } from 'acorn'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { nativeCountryName } from '../../scraper-support/shared/nativeJobPosting.js'

import { COGNUS_TECHNOLOGY_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = COGNUS_TECHNOLOGY_CATALOG.source
export const COMPANY = COGNUS_TECHNOLOGY_CATALOG.companyName
export const HOMEPAGE_URL = COGNUS_TECHNOLOGY_CATALOG.homepageUrl
export const CAREERS_URL = COGNUS_TECHNOLOGY_CATALOG.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const INPUT_TAG_PATTERN = /<input\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi
const ATTRIBUTE_PATTERN = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&quot;/gi, '"')
  .replace(/&#34;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&nbsp;|&#160;/gi, ' ')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value) || null

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|ul|ol|h[1-6])>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, CAREERS_URL).toString()
  } catch {
    return CAREERS_URL
  }
}

const extractHiddenInputValue = (html, id) => {
  for (const tag of String(html ?? '').match(INPUT_TAG_PATTERN) ?? []) {
    const attributes = {}

    for (const match of tag.matchAll(ATTRIBUTE_PATTERN)) {
      const [, key, doubleQuoted, singleQuoted, bareValue] = match
      attributes[key.toLowerCase()] = doubleQuoted ?? singleQuoted ?? bareValue ?? ''
    }

    if (attributes.id?.toLowerCase() === String(id).toLowerCase()) {
      return attributes.value ?? null
    }
  }

  return null
}

export const extractHiddenInputJson = (html, id) => {
  const rawValue = extractHiddenInputValue(html, id)
  if (!rawValue) return null

  try {
    return JSON.parse(decodeHtmlEntities(rawValue))
  } catch {
    return null
  }
}

const buildFieldApiMap = (moduleMeta = []) => {
  const map = new Map()
  const jobModule = Array.isArray(moduleMeta)
    ? moduleMeta.find((module) => module?.api_name === 'Job_Openings')
    : null

  const fieldEntries = [
    ...(jobModule?.fields ?? []),
    ...((jobModule?.layouts ?? []).flatMap((layout) =>
      (layout?.sections ?? []).flatMap((section) => section?.fields ?? []),
    )),
  ]

  for (const field of fieldEntries) {
    if (!field?.id || !field?.api_name) continue
    map.set(String(field.id), field.api_name)
  }

  return map
}

const normalizeZohoJobRecord = (rawJob = {}, fieldApiMap = new Map()) => {
  const normalized = {}

  for (const [key, value] of Object.entries(rawJob)) {
    normalized[key] = value

    const apiName = fieldApiMap.get(String(key))
    if (apiName && normalized[apiName] == null) {
      normalized[apiName] = value
    }
  }

  return normalized
}

const getFirstPresent = (record, keys) => {
  for (const key of keys) {
    if (record?.[key] != null && record[key] !== '') return record[key]
  }
  return null
}

const buildLocation = ({ city, state, country }) => {
  const parts = [normalizeText(city), normalizeText(state), normalizeText(country)]
    .filter(Boolean)
  if (parts.length === 0) return null
  return [...new Set(parts)].join(', ')
}

const parseInteger = (value) => {
  const match = String(value ?? '').match(/\d+/)
  return match ? Number.parseInt(match[0], 10) : null
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return normalized.includes('Life At Cognus')
    && normalized.includes('Join Us')
    && /cognustechnology\.zohorecruit\.in\/jobs\/Careers/i.test(page)
}

export const hasOfficialCareersSignal = (html = '') => {
  const pageJson = extractHiddenInputJson(html, 'pageJson')
  const meta = extractHiddenInputJson(html, 'meta')
  const jobsPayload = extractHiddenInputJson(html, 'jobs')

  return Array.isArray(jobsPayload)
    && meta?.org_info?.company_name === 'Cognus Technology'
    && meta?.list_url === CAREERS_URL
    && pageJson?.detail?.section?.data?.some((section) =>
      section?.blocktype === 'jobs'
      && /Join us/i.test(section?.title ?? '')
      && /Current Openings/i.test(section?.subtitle ?? ''),
    )
}

export const extractJobsFromOfficialBoard = (html = '') => {
  const moduleMeta = extractHiddenInputJson(html, 'moduleMeta') ?? []
  const jobsPayload = extractHiddenInputJson(html, 'jobs')

  if (!Array.isArray(jobsPayload)) return []

  const fieldApiMap = buildFieldApiMap(moduleMeta)

  return jobsPayload
    .map((rawJob) => {
      const record = normalizeZohoJobRecord(rawJob, fieldApiMap)
      const title = normalizeText(getFirstPresent(record, [
        'Job_Opening_Name',
        'Posting_Title',
        'Title',
        'job_title',
        'title',
      ]))

      if (!title) return null

      const cityValue = normalizeText(getFirstPresent(record, ['City', 'city']))
      const stateValue = normalizeText(getFirstPresent(record, ['State', 'state']))
      const countryValue = nativeCountryName(getFirstPresent(record, ['Country', 'country']))
      const location = buildLocation({
        city: cityValue,
        state: stateValue,
        country: countryValue,
      })
      const recordId = normalizeText(getFirstPresent(record, ['id', 'record_id', 'recordId']))
      const slug = slugify(recordId || title)

      return {
        title,
        jobId: `${SOURCE}-${slug}`,
        requisitionId: recordId || slug,
        sourceUrl: toAbsoluteUrl(getFirstPresent(record, ['applyUrl', 'sourceUrl']) || CAREERS_URL),
        applyUrl: toAbsoluteUrl(getFirstPresent(record, ['applyUrl', 'sourceUrl']) || CAREERS_URL),
        location: countryValue ? location : null,
        city: countryValue && cityValue ? normalizeCity(cityValue) || cityValue : null,
        state: countryValue ? stateValue : null,
        country: countryValue,
        postalCode: countryValue ? normalizeText(getFirstPresent(record, ['Zip_Code', 'postalCode'])) : null,
        employmentType: normalizeText(getFirstPresent(record, ['Job_Type', 'jobType', 'type'])),
        workplaceType: null,
        experienceRequired: normalizeText(getFirstPresent(record, ['Work_Experience', 'experience'])),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        compensation: null,
        postingDate: null,
        closingDate: null,
        openingsCount: parseInteger(getFirstPresent(record, ['Openings', 'Vacancies', 'no_of_openings'])),
        jobDescription: stripTags(getFirstPresent(record, ['Job_Description', 'jobDescription'])),
        nativeLocationEvidence: { City: record.City ?? null, State: record.State ?? null,
          Country: record.Country ?? null, Zip_Code: record.Zip_Code ?? null },
        nativeLocation: buildLocation({ city: cityValue, state: stateValue,
          country: getFirstPresent(record, ['Country', 'country']) }),
        sourceCountryScopeUnresolved: !countryValue,
        companyCareerPage: CAREERS_URL,
      }
    })
    .filter(Boolean)
}

const defaultFetchText = (url, { signal, includeResponseMetadata = false, redirect, timeoutMs = 15000 } = {}) => fetchTextWithRetry(url, {
  signal, includeResponseMetadata, redirect, attempts: 1,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs,
})

const defaultFetchDetail = (url, { signal }) => defaultFetchText(url, {
  signal, includeResponseMetadata: true, redirect: 'manual', timeoutMs: 10000,
})

// This tenant's rendered board advertises /{id}/{Posting-Title}?source=CareerSite.
// Keep the known contract narrow; malformed ids/titles never become fetch targets.
export const nativeDetailUrl = (job) => /^\d{8,30}$/.test(job.requisitionId || '')
  && /^[A-Za-z0-9]+(?:[ -][A-Za-z0-9]+)*$/.test(job.title || '')
  ? `${CAREERS_URL}/${job.requisitionId}/${job.title.replaceAll(' ', '-')}?source=CareerSite` : null

const INVALID_STATIC_VALUE = Symbol('invalid-static-value')
const staticValue = (node, depth = 0) => {
  if (!node || depth > 40) return INVALID_STATIC_VALUE
  if (node.type === 'Literal') {
    return node.value === null || ['string', 'boolean', 'number'].includes(typeof node.value)
      && !(typeof node.value === 'number' && !Number.isFinite(node.value)) ? node.value : INVALID_STATIC_VALUE
  }
  if (node.type === 'ArrayExpression') {
    const values = node.elements.map(element => staticValue(element, depth + 1))
    return values.includes(INVALID_STATIC_VALUE) ? INVALID_STATIC_VALUE : values
  }
  if (node.type === 'ObjectExpression') {
    const values = Object.create(null)
    for (const prop of node.properties) {
      if (prop.type !== 'Property' || prop.computed || prop.method || prop.shorthand || prop.kind !== 'init') return INVALID_STATIC_VALUE
      const key = prop.key.type === 'Identifier' ? prop.key.name : prop.key.type === 'Literal' ? prop.key.value : null
      if (typeof key !== 'string' || Object.hasOwn(values, key) || ['__proto__', 'constructor', 'prototype'].includes(key)) return INVALID_STATIC_VALUE
      const value = staticValue(prop.value, depth + 1)
      if (value === INVALID_STATIC_VALUE) return INVALID_STATIC_VALUE
      values[key] = value
    }
    return values
  }
  if (node.type === 'CallExpression' && !node.optional && node.arguments.length === 1
    && node.callee.type === 'MemberExpression' && !node.callee.computed
    && node.callee.object.type === 'Identifier' && node.callee.object.name === 'JSON'
    && node.callee.property.name === 'parse' && node.arguments[0].type === 'Literal'
    && typeof node.arguments[0].value === 'string') {
    try { return JSON.parse(node.arguments[0].value) } catch { return INVALID_STATIC_VALUE }
  }
  return INVALID_STATIC_VALUE
}

// Read the three native top-level data declarations; never execute source scripts.
export const extractNativeInlineData = html => {
  if (typeof html !== 'string' || html.length > 6000000) return null
  const data = Object.create(null), names = new Set(['jobs', 'meta', 'moduleMeta'])
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/i.test(match[1]) || !/\b(?:jobs|meta|moduleMeta)\s*=/.test(match[2])) continue
    if (match[2].length > 2000000) return null
    let ast
    try { ast = parse(match[2], { ecmaVersion: 'latest', sourceType: 'script' }) } catch { return null }
    for (const statement of ast.body) {
      if (statement.type !== 'VariableDeclaration') continue
      for (const declaration of statement.declarations) {
        if (declaration.id.type !== 'Identifier' || !names.has(declaration.id.name)) continue
        const name = declaration.id.name
        if (Object.hasOwn(data, name)) return null
        const value = staticValue(declaration.init)
        if (value === INVALID_STATIC_VALUE) return null
        data[name] = value
      }
    }
  }
  return [...names].every(name => Object.hasOwn(data, name)) ? data : null
}

export const extractVerifiedNativeDetail = (html, job, listingMeta, listingModules) => {
  const data = extractNativeInlineData(html), expectedUrl = nativeDetailUrl(job)
  if (!data || !expectedUrl || !Array.isArray(data.jobs) || data.jobs.length !== 1
    || data.meta?.org_info?.company_name !== COMPANY || data.meta.list_url !== CAREERS_URL
    || data.meta.detail_url !== expectedUrl || !Array.isArray(data.moduleMeta)) return null
  if (listingMeta?.org_info?.id && data.meta.org_info.id !== listingMeta.org_info.id) return null
  if (listingMeta?.page_id && data.meta.page_id !== listingMeta.page_id) return null
  const nativeModules = data.moduleMeta.filter(module => module?.api_name === 'Job_Openings')
  const sourceModules = Array.isArray(listingModules) ? listingModules.filter(module => module?.api_name === 'Job_Openings') : []
  if (nativeModules.length !== 1 || sourceModules.length !== 1 || nativeModules[0].id !== sourceModules[0].id) return null
  const record = normalizeZohoJobRecord(data.jobs[0], buildFieldApiMap(data.moduleMeta))
  if (record.id !== job.requisitionId || record.Posting_Title !== job.title
    || record.Job_Opening_Name !== job.title || record.Publish !== true || record.Is_Locked !== false) return null
  const description = typeof record.Job_Description === 'string' ? stripTags(record.Job_Description) : null
  const nativeDate = typeof record.Date_Opened === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(record.Date_Opened)
    && Number.isFinite(Date.parse(record.Date_Opened)) && new Date(record.Date_Opened).toISOString().slice(0, 10) === record.Date_Opened
    ? record.Date_Opened : null
  const country = nativeCountryName(record.Country), city = normalizeText(record.City), state = normalizeText(record.State)
  const countryUncertain = !country
  const contentComplete = Boolean(description && description.length >= 80)
  return {
    sourceUrl: expectedUrl, applyUrl: expectedUrl, sourceDetailUrl: expectedUrl,
    sourceDescription: contentComplete ? description : null,
    jobDescription: contentComplete ? description : null,
    ...(contentComplete ? { nativeDescriptionSHA256: createHash('sha256').update(record.Job_Description).digest('hex') } : {}),
    // Date_Opened is a requisition opening date, not a declared publication date.
    postingDate: null,
    ...(nativeDate ? { nativeDateOpened: nativeDate,
      sourceDateEvidence: 'native-requisition-date-opened;publication-date-unknown' } : {}),
    country, city: country && city ? normalizeCity(city) || city : null, state: country ? state : null,
    postalCode: country ? normalizeText(record.Zip_Code) : null,
    location: country ? buildLocation({ city, state, country }) : null,
    nativeLocation: buildLocation({ city, state, country: record.Country }),
    sourceCountryScopeUnresolved: countryUncertain,
    nativeLocationEvidence: { City: record.City ?? null, State: record.State ?? null,
      Country: record.Country ?? null, Zip_Code: record.Zip_Code ?? null },
    sourceDetailContentComplete: contentComplete,
    sourceDetailComplete: contentComplete && !countryUncertain,
    ...(!contentComplete ? { sourceDetailFailureKind: 'missing-authoritative-jobposting' }
      : countryUncertain ? { sourceDetailFailureKind: 'malformed-native-country' } : {}),
  }
}

export const createCognusTechnologyScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, fetchDetail = defaultFetchDetail, signal, now: overrideNow } = {}) {
    signal?.throwIfAborted()
    const homepageHtml = await fetchText(HOMEPAGE_URL, { signal })
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('The verified Cognus Technology homepage no longer exposes the trusted careers handoff')
    }

    const careersHtml = await fetchText(CAREERS_URL, { signal })
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Cognus Technology careers board no longer matches the trusted Zoho contract')
    }

    const meta = extractHiddenInputJson(careersHtml, 'meta') ?? {}
    const modules = extractHiddenInputJson(careersHtml, 'moduleMeta') ?? []
    const jobs = extractJobsFromOfficialBoard(careersHtml)

    if (jobs.length === 0) {
      if (meta?._no_longer !== 'zr.pos.no.act') {
        throw new Error('Cognus Technology careers board changed materially and requires manual review')
      }
      return []
    }

    const enriched = new Array(jobs.length), budget = AbortSignal.timeout(45000)
    const detailSignal = signal ? AbortSignal.any([signal, budget]) : budget
    const unambiguous = new Set(jobs.map(job => job.requisitionId)).size === jobs.length
    let cursor = 0
    await Promise.all(Array.from({ length: Math.min(3, jobs.length) }, async () => {
      while (cursor < jobs.length) {
        const index = cursor++, job = jobs[index], url = nativeDetailUrl(job)
        let detail = null, failureKind = 'missing-authoritative-jobposting'
        if (url && unambiguous && !detailSignal.aborted) {
          try {
            const requestSignal = AbortSignal.any([detailSignal, AbortSignal.timeout(10000)])
            const response = await fetchDetail(url, { signal: requestSignal })
            requestSignal.throwIfAborted()
            if (response?.status === 200 && response.url === url) detail = extractVerifiedNativeDetail(response.html, job, meta, modules)
            else failureKind = 'source-detail-access-failed'
          } catch {
            signal?.throwIfAborted()
            failureKind = 'source-detail-access-failed'
          }
        }
        enriched[index] = detail ? { ...job, ...detail, sourceDetailVerifiedAt: (overrideNow || now)() }
          : { ...job, sourceDescription: job.jobDescription || null, sourceDetailUrl: url,
            sourceDetailContentComplete: false, sourceDetailComplete: false, sourceDetailFailureKind: failureKind }
      }
    }))
    signal?.throwIfAborted()
    return enriched
      .sort((left, right) => left.title.localeCompare(right.title) || left.jobId.localeCompare(right.jobId))
      .map((job) => ({
        ...job,
        company: COMPANY,
        source: SOURCE,
        companyDomain: COGNUS_TECHNOLOGY_CATALOG.companyDomain,
        atsPlatform: COGNUS_TECHNOLOGY_CATALOG.atsPlatform,
        sourceScopeComplete: false,
        sourceListingComplete: false,
        lifecycleCleanupAllowed: false,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: (overrideNow || now)(),
      }))
  },
})

export const run = async (options = {}) => createCognusTechnologyScraper().run(options)

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
