import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'machglobaltechnologies'
export const COMPANY = 'Mach Global Technologies'
export const HOMEPAGE_URL = 'https://www.machglobaltech.com/'
export const CAREERS_URL = 'https://www.machglobaltech.com/careers.php'
export const CONTACT_URL = 'https://www.machglobaltech.com/contact-us.php'
export const COMPANY_DOMAIN = 'machglobaltech.com'
export const SHARED_APPLY_URL = 'mailto:info@machglobaltech.com'
export const MISSING_ROUTE_URLS = [
  'https://www.machglobaltech.com/careers',
  'https://www.machglobaltech.com/career',
  'https://www.machglobaltech.com/jobs',
  'https://www.machglobaltech.com/join-us',
  'https://www.machglobaltech.com/current-openings',
  'https://www.machglobaltech.com/openings',
  'https://www.machglobaltech.com/work-with-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const EXPECTED_OPENINGS = [
  {
    title: 'Avionics Software Engineer',
    department: 'Software Team',
    description:
      'Develop high-integrity embedded software for safety-critical aerospace applications. Work on real-time systems, RTOS integration, and DO-178C certified software.',
  },
  {
    title: 'Certification Engineer',
    department: 'Safety Team',
    description:
      'Lead certification activities for DO-178C, DO-254, and DO-160 standards. Interface with DERs and regulatory authorities to achieve audit-ready deliverables.',
  },
  {
    title: 'Hardware Engineer (FPGA/ASIC)',
    department: 'Hardware Team',
    description:
      'Design and develop DO-254 certified hardware for avionics systems. Work with VHDL, ASIC/FPGA design, and hardware-software integration.',
  },
  {
    title: 'Safety Engineer',
    department: 'Safety Team',
    description:
      'Conduct safety analysis, risk assessment, and validation for avionics systems. Ensure designs meet safety objectives and certification requirements.',
  },
  {
    title: 'Test Automation Engineer',
    department: 'QA Team',
    description:
      'Build automated test frameworks for HIL/SIL testing. Verify system requirements and ensure comprehensive test coverage.',
  },
  {
    title: 'Systems Engineer',
    department: 'Systems Team',
    description:
      'Define requirements, system architecture, and integration strategies. Ensure seamless operation of complex aerospace systems.',
  },
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&#8211;|&mdash;|&#8212;/gi, '-')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => String(value ?? '')
  .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/ul|\/ol|\/h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<(p|div|section|article|li|ul|ol|h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')

const normalizeVisibleText = (value) => normalizeWhitespace(stripTags(value)) || ''

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const extractFirstMatch = (value, pattern) => {
  const match = String(value ?? '').match(pattern)
  return match?.[1] ?? null
}

const getJobCardBlocks = (html) => {
  const page = String(html ?? '')
  const starts = [...page.matchAll(/<div class="job-card">/gi)]

  return starts.map((match, index) => {
    const start = match.index ?? 0
    const end = starts[index + 1]?.index ?? page.length
    return page.slice(start, end)
  })
}

const buildJob = ({ title, department, description }) => {
  const jobId = `${SOURCE}-${slugify(title)}`
  if (!jobId) {
    throw new Error(`Mach Global Technologies role could not be normalized: "${title}"`)
  }

  return {
    title,
    company: COMPANY,
    department,
    location: 'India',
    city: null,
    country: 'India',
    jobId,
    requisitionId: null,
    sourceUrl: CAREERS_URL,
    applyUrl: SHARED_APPLY_URL,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: description,
    publicExperienceChecked: true,
    remoteStatus: null,
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page).toLowerCase()

  return /<title>\s*Mach Global Technologies\s*<\/title>/i.test(page)
    && text.includes('since 2023, mach global technologies has specialized in delivering comprehensive certification and engineering services to the aviation industry')
    && text.includes('convergence of safety, engineering, and innovation')
    && text.includes('aerospace systems demand decades of reliability, zero tolerance for defects, and demonstrable compliance')
    && text.includes('global reach innovation driven')
    && text.includes('mach global technologies')
    && text.includes('trusted partner for aerospace and defense certification engineering')
    && hasVerifiedCareersLink(page)
}

export const hasVerifiedCareersLink = (html) =>
  /href=["'](?:https:\/\/www\.machglobaltech\.com\/careers\.php|careers\.php)["']/i.test(String(html ?? ''))

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page).toLowerCase()

  return /<title>\s*Careers\s*-\s*Mach Global Technologies\s*<\/title>/i.test(page)
    && text.includes('build your career at mach global')
    && text.includes('career opportunities')
    && text.includes('we offer structured career paths across multiple disciplines')
    && text.includes('ready to shape the future of aerospace')
    && /href=["']mailto:info@machglobaltech\.com["']/i.test(page)
}

export const hasOfficialContactSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page).toLowerCase()

  return /<title>\s*Contact Us\s*-\s*Mach Global Technologies\s*<\/title>/i.test(page)
    && text.includes('india')
    && text.includes('engineering & certification hub')
    && text.includes('india | australia')
    && text.includes('info@machglobaltech.com')
}

export const isVerifiedMissingRoute = ({ status }) => status === 404

export const extractPublicJobs = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Mach Global Technologies careers page no longer matches the verified official public surface')
  }

  const applyUrl = normalizeWhitespace(extractFirstMatch(html, /href=["'](mailto:info@machglobaltech\.com)["']/i))
  if (applyUrl !== SHARED_APPLY_URL) {
    throw new Error('Mach Global Technologies careers page no longer exposes the verified shared apply route')
  }

  const cards = getJobCardBlocks(html)
  if (cards.length !== EXPECTED_OPENINGS.length) {
    throw new Error('Mach Global Technologies public openings changed materially')
  }

  return cards.map((cardHtml, index) => {
    const expected = EXPECTED_OPENINGS[index]
    const title = normalizeWhitespace(extractFirstMatch(cardHtml, /<h3>\s*([\s\S]*?)\s*<\/h3>/i))
    const department = normalizeWhitespace(extractFirstMatch(cardHtml, /<span class="job-tag">\s*([\s\S]*?)\s*<\/span>/i))
    const description = normalizeVisibleText(extractFirstMatch(cardHtml, /<p>\s*([\s\S]*?)\s*<\/p>/i))

    if (!expected || title !== expected.title || department !== expected.department) {
      throw new Error(`Mach Global Technologies unexpected public opening "${title || department || 'unknown'}"`)
    }

    if (description !== expected.description) {
      throw new Error(`Mach Global Technologies job description drifted for "${title}"`)
    }

    return buildJob({ title, department, description })
  })
}

export const createMachGlobalTechnologiesScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchPage = defaultFetchPage, now: overrideNow } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Mach Global Technologies official homepage no longer matches the verified first-party surface')
    }

    if (!hasVerifiedCareersLink(homepage.html)) {
      throw new Error('Mach Global Technologies homepage no longer links to the verified careers page')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Mach Global Technologies careers page no longer matches the verified official public surface')
    }

    const contactPage = await fetchPage(CONTACT_URL)
    if (contactPage.status !== 200 || !hasOfficialContactSignal(contactPage.html)) {
      throw new Error('Mach Global Technologies contact page no longer matches the verified country signal')
    }

    for (const missingRouteUrl of MISSING_ROUTE_URLS) {
      const missingRoute = await fetchPage(missingRouteUrl)
      if (!isVerifiedMissingRoute(missingRoute)) {
        throw new Error(`Mach Global Technologies missing-route validation failed for ${missingRouteUrl}`)
      }
    }

    const scrapedAt = (overrideNow || now)()
    const jobs = extractPublicJobs(careersPage.html)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt,
      companyCareerPage: CAREERS_URL,
      companyDomain: COMPANY_DOMAIN,
      atsPlatform: 'official-company-careers',
    }))
  },
})

export const run = async (options = {}) => createMachGlobalTechnologiesScraper().run(options)

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
