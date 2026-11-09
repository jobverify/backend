import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const COMPANY_NAME = 'Vimaana Aerospace Technologies'
const SOURCE = 'vimaanaaerospacetechnologies'

export const CAREER_PAGE_URL = 'https://www.vimaanatech.com/career'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8212;|&mdash;/gi, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return new URL(normalized, CAREER_PAGE_URL).toString()
}

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'role'

export const pageIndicatesJobs = (html) => {
  const content = String(html ?? '')
  return (
    /Vimaana Aerospace Technologies/i.test(content)
    && /\bCAREER\b/i.test(content)
    && /Click Here To Apply/i.test(content)
  )
}

export const buildPageDataUrls = (html) => {
  const matches = String(html ?? '').match(
    /https:\/\/siteassets\.parastorage\.com\/pages\/pages\/thunderbolt\?[^"'<>]*module=thunderbolt-features[^"'<>]*/gi,
  ) || []

  return [...new Set(matches.map((url) => url.replace(/&amp;/g, '&')))]
}

export const extractRoleCardsFromPagePayload = (payload) => {
  const structure = payload?.structure?.components
  const compProps = payload?.props?.render?.compProps

  if (!structure || !compProps) return []

  const seenTitles = new Set()
  const roles = []
  const pageIds = Object.entries(structure)
    .filter(([, component]) => component?.componentType === 'Page')
    .map(([componentId]) => componentId)

  const visited = new Set()
  const visit = (componentId) => {
    if (!componentId || visited.has(componentId)) return
    visited.add(componentId)

    const component = structure[componentId]
    if (!component) return

    if (component.componentType === 'Container') {
      const childIds = Array.isArray(component.components) ? component.components : []
      const richTextIds = childIds.filter((childId) => (
        structure[childId]?.componentType === 'WRichText'
        && typeof compProps[childId]?.html === 'string'
      ))
      const buttonId = childIds.find((childId) => (
        structure[childId]?.componentType === 'SiteButton'
        && /click here to apply/i.test(compProps[childId]?.label || '')
      ))

      if (richTextIds.length >= 2 && buttonId) {
        const title = stripTags(compProps[richTextIds[0]].html)
        const description = stripTags(compProps[richTextIds[1]].html)

        if (title && description && !seenTitles.has(title.toLowerCase())) {
          seenTitles.add(title.toLowerCase())
          roles.push({
            title,
            description,
            applyUrl: toAbsoluteUrl(compProps[buttonId]?.link?.href),
          })
        }
      }
    }

    for (const childId of component.components || []) {
      visit(childId)
    }
  }

  if (pageIds.length) {
    for (const pageId of pageIds) visit(pageId)
  } else {
    for (const componentId of Object.keys(structure)) visit(componentId)
  }

  return roles
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

const buildJobFromRole = (role) => ({
  title: role.title,
  company: COMPANY_NAME,
  department: role.title,
  location: 'India',
  city: null,
  country: 'India',
  jobId: `${SOURCE}-${slugify(role.title)}`,
  requisitionId: null,
  sourceUrl: CAREER_PAGE_URL,
  applyUrl: role.applyUrl,
  employmentType: null,
  experienceRequired: null,
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: [],
  postingDate: null,
  closingDate: null,
  jobDescription: normalizeWhitespace(
    `${role.description} Apply via the ${COMPANY_NAME} career page.`,
  ),
})

export const createVimaanaAerospaceTechnologiesScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const fetchJson = options.fetchJson || defaultFetchJson

    const careerHtml = await fetchText(CAREER_PAGE_URL)

    if (!pageIndicatesJobs(careerHtml)) {
      throw new Error(
        'Vimaana Aerospace Technologies career page no longer exposes the expected first-party identity and apply signals',
      )
    }

    const pageDataUrls = buildPageDataUrls(careerHtml)
    if (!pageDataUrls.length) {
      throw new Error(
        'Vimaana Aerospace Technologies career page no longer exposes the expected Wix page-data URLs',
      )
    }

    let roles = []
    let lastPayloadError = null

    for (const pageDataUrl of pageDataUrls) {
      try {
        const payload = await fetchJson(pageDataUrl)
        roles = extractRoleCardsFromPagePayload(payload)
        if (roles.length) break
      } catch (error) {
        lastPayloadError = error
      }
    }

    if (!roles.length) {
      if (lastPayloadError) {
        throw new Error(
          `Vimaana Aerospace Technologies career page no longer exposes the expected public role cards: ${lastPayloadError.message}`,
        )
      }

      throw new Error(
        'Vimaana Aerospace Technologies career page no longer exposes the expected public role cards',
      )
    }

    const selectedRoles = maxJobs ? roles.slice(0, maxJobs) : roles
    return selectedRoles.map((role) => {
      const job = buildJobFromRole(role)
      return {
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: new Date().toISOString(),
      }
    })
  },
})

export const run = async () => createVimaanaAerospaceTechnologiesScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running ${COMPANY_NAME} scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
