import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'suryalogix'
export const COMPANY = 'SuryaLogix'
export const HOMEPAGE_URL = 'https://suryalogix.com/'
export const CAREERS_URL = 'https://suryalogix.com/career-opportunities/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&apos;|&rsquo;/gi, "'")
  .replace(/&ndash;|&mdash;/gi, '-')

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeMarkup = (value) => normalizeWhitespace(
  decodeHtmlEntities(value)
    .replace(/\u2019/g, "'")
    .replace(/[\u2013\u2014]/g, '-'),
)

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? ''))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u2019/g, "'")
    .replace(/[\u2013\u2014]/g, '-'),
)

const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const markup = normalizeMarkup(html)
  const text = stripTags(html)

  return /<title>\s*SuryaLogix\s*\|\s*(?:Monitoring\s*&\s*Controlling with AI|Renewable Energy Monitoring\s*&\s*Control Solutions)\s*<\/title>/i.test(markup)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/suryalogix\.com\/["']/i.test(markup)
    && /href=["'][^"']*\/career-opportunities\/["']/i.test(markup)
    && text.includes('SMART | RELIABLE | SUSTAINABLE')
    && (
      text.includes('Smart Renewable Energy Monitoring & Control Solutions')
      || /Smart Renewable Energy monitoring\s*&\s*Control\s*Solutions/i.test(text)
    )
    && text.includes('Trusted Across 30+ Countries')
    && (
      text.includes('Welcome to SuryaLogix Innovative Energy Solutions')
      || text.includes('Engineering the Future of Renewable Intelligence')
    )
    && text.includes('sales@suryalogix.com')
  }

export const hasOfficialCareersSignal = (html) => {
  const markup = normalizeMarkup(html)
  const text = stripTags(html)

  return /<title>\s*Join SuryaLogix\s*\|\s*Renewable Energy Careers\s*&\s*Opportunities\s*<\/title>/i.test(markup)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/suryalogix\.com\/career-opportunities\/["']/i.test(markup)
    && text.includes('CAREERS AT SURYALOGIX')
    && text.includes('Work with us')
    && text.includes('More Than Just A Job')
    && text.includes('Career In Suryalogix')
    && text.includes('We Believe in People, Purpose & Progress')
    && text.includes('At SuryaLogix, we believe great work is built by great teams.')
    && text.includes('Application Form')
  }

export const hasApplicationFormSurface = (html) => {
  const text = stripTags(html)

  return text.includes('Application Form')
    && text.includes('Your name')
    && text.includes('Your email')
    && text.includes('Phone')
    && text.includes('Applying for Position of')
    && text.includes('Upload Your Resume')
    && text.includes('Your message (optional)')
  }

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bcurrent vacancies\b/i,
  /\bopen positions\b/i,
  /\bopen roles\b/i,
  /\bjob openings\b/i,
  /\bvacancies\b/i,
  /\bview details\b/i,
  /\bjob description\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /darwinbox/i,
  /recruitcrm/i,
  /zohorecruit/i,
  /linkedin\.com\/jobs/i,
  /\/jobs\//i,
]

export const hasUnexpectedPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(normalizeMarkup(
    String(html ?? '')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' '),
  )))

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const attribute = (tag, name) => decodeHtmlEntities(String(tag ?? '').match(
  new RegExp('\\s' + name + '\\s*=\\s*(["\x27])([\\s\\S]*?)\\1', 'i'),
)?.[2] || '')

const extractVerifiedApplicationPopup = (html) => {
  const raw = String(html ?? '')
  const popupTags = [...raw.matchAll(/<div\b[^>]*>/gi)].filter(match =>
    attribute(match[0], 'data-elementor-type') === 'popup'
    && attribute(match[0], 'data-elementor-id') === '63761',
  )
  if (popupTags.length === 0) return null
  if (popupTags.length !== 1) throw new Error('SuryaLogix incomplete application popup association')
  const start = popupTags[0].index
  const end = raw.indexOf('</form>', start)
  if (end < 0) throw new Error('SuryaLogix incomplete application popup form')
  const popup = raw.slice(start, end + '</form>'.length)
  const forms = [...popup.matchAll(/<form\b[^>]*>/gi)]
  const form = forms[0]?.[0]
  if (forms.length !== 1 || !stripTags(popup).includes('Join Our Team')
    || attribute(form, 'method').toLowerCase() !== 'post'
    || attribute(form, 'enctype') !== 'multipart/form-data'
    || !/^\/career-opportunities\/#wpcf7-f63770-o[1-9]\d*$/.test(attribute(form, 'action'))) {
    throw new Error('SuryaLogix unverified application popup form')
  }
  const inputs = [...popup.matchAll(/<input\b[^>]*>/gi)].map(match => match[0])
  const formId = inputs.filter(tag => attribute(tag, 'name') === '_wpcf7')
  if (formId.length !== 1 || attribute(formId[0], 'value') !== '63770') throw new Error('SuryaLogix unverified application popup form ID')
  for (const [name, type] of [['your-name', 'text'], ['your-email', 'email'], ['your-phone', 'tel'], ['your-resume', 'file']]) {
    const fields = inputs.filter(tag => attribute(tag, 'name') === name)
    if (fields.length !== 1 || attribute(fields[0], 'type') !== type || attribute(fields[0], 'aria-required') !== 'true') {
      throw new Error('SuryaLogix incomplete application popup required fields')
    }
  }
  const selectors = [...popup.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)]
  if (selectors.length !== 1 || attribute('<select ' + selectors[0][1] + '>', 'name') !== 'job-position'
    || attribute('<select ' + selectors[0][1] + '>', 'aria-required') !== 'true') {
    throw new Error('SuryaLogix incomplete application popup position selector')
  }
  const options = [...selectors[0][2].matchAll(/<option\b[^>]*>([\s\S]*?)<\/option>/gi)]
  if (options.length < 2 || attribute(options[0][0].split('>')[0] + '>', 'value') !== ''
    || stripTags(options[0][1]) !== 'Select Job Position') throw new Error('SuryaLogix unverified application popup position selector')
  const positions = options.slice(1).map(option => {
    const title = stripTags(option[1])
    if (!title || attribute(option[0].split('>')[0] + '>', 'value') !== title) throw new Error('SuryaLogix incomplete application popup position association')
    return title
  })
  if (new Set(positions).size !== positions.length) throw new Error('SuryaLogix duplicate application popup position')
  return { positions }
}

const openingApplyHref = (section, title, popup) => {
  const links = [...String(section).matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)]
    .filter(match => stripTags(match[0]) === 'Apply Now')
  if (links.length !== 1) throw new Error('SuryaLogix incomplete opening application association')
  const href = attribute(links[0][0].split('>')[0] + '>', 'href')
  if (href === '#form') return href
  try {
    const decoded = decodeURIComponent(href)
    const prefix = '#elementor-action:action=popup:open&settings='
    if (!decoded.startsWith(prefix)) throw new Error('Unknown application action')
    const settings = JSON.parse(Buffer.from(decoded.slice(prefix.length), 'base64').toString('utf8'))
    if (settings.id !== '63761' || settings.toggle !== false || Object.keys(settings).length !== 2
      || !popup?.positions.includes(title)) throw new Error('Unverified popup association')
    return href
  } catch {
    throw new Error('SuryaLogix incomplete opening application popup association')
  }
}

const fullyHiddenSectionRanges = (html) => {
  const stack = []
  const ranges = []
  for (const match of String(html).matchAll(/<\/?section\b[^>]*>/gi)) {
    if (/^<\//.test(match[0])) {
      const section = stack.pop()
      if (!section) throw new Error('SuryaLogix incomplete section visibility association')
      if (section.hidden) ranges.push([section.start, match.index + match[0].length])
    } else {
      const classes = new Set(attribute(match[0], 'class').split(/\s+/))
      stack.push({ start: match.index, hidden: ['desktop', 'laptop', 'tablet', 'mobile'].every(device => classes.has('elementor-hidden-' + device)) })
    }
  }
  if (stack.length) throw new Error('SuryaLogix incomplete section visibility association')
  return ranges
}

export const extractPublicOpenings = (html) => {
  const popup = extractVerifiedApplicationPopup(html)
  const jobsByTitle = new Map()
  const sections = String(html ?? '').split(
    /<section\b[^>]*class=["'][^"']*elementor-inner-section[^"']*["'][^>]*>/i,
  )

  for (const section of sections) {
    const text = stripTags(section)
    if (!/\bOpenings:/i.test(text)) continue

    const title = stripTags(section.match(/<h2\b[^>]*class=["'][^"']*elementor-heading-title[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i)?.[1])
    const locationAndExperience = stripTags(
      section.match(/<span\b[^>]*class=["'][^"']*elementor-icon-list-text[^"']*["'][^>]*>([\s\S]*?Experience:[\s\S]*?)<\/span>/i)?.[1],
    )
    const location = locationAndExperience.match(/^(.+?)\s+Experience:/i)?.[1]?.trim()
    const experienceRequired = locationAndExperience.match(/Experience:\s*(.+)$/i)?.[1]?.trim()
    const expertise = text.match(/Expertise\s*-\s*(.+?)\s+Openings:/i)?.[1]?.trim()
    const openings = text.match(/Openings:\s*(\d+)/i)?.[1]

    if (!title || !location || !experienceRequired || !expertise || !Number(openings)) throw new Error('SuryaLogix incomplete listing: malformed opening')
    const applyHref = openingApplyHref(section, title, popup)
    if (!/^(?:Pune,\s*Maharashtra(?:,\s*India)?|.+,\s*India)$/i.test(location)) throw new Error('SuryaLogix opening location does not prove India scope')
    if (jobsByTitle.has(title)) throw new Error('SuryaLogix incomplete listing: duplicate opening')
    const jobId = slugify(title)
    jobsByTitle.set(title, {
      title,
      company: COMPANY,
      department: null,
      location: /\bindia\b/i.test(location) ? location : `${location}, India`,
      city: location.split(',')[0].trim(),
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREERS_URL,
      applyUrl: `${CAREERS_URL}${applyHref}`,
      employmentType: null,
      experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: expertise.split(',').map((skill) => skill.trim()).filter(Boolean),
      postingDate: null,
      closingDate: null,
      jobDescription: `${title}. Experience: ${experienceRequired}. Expertise: ${expertise}. Openings: ${openings}.`,
      source: SOURCE,
      link: `${CAREERS_URL}${applyHref}`,
    })
  }

  if ((stripTags(html).match(/\bOpenings:/gi) || []).length !== jobsByTitle.size) throw new Error('SuryaLogix incomplete opening count')
  return [...jobsByTitle.values()]
}

const getWalkInDeadline = (html) => {
  const text = stripTags(html)
  if (!/Walk-In Interviews/i.test(text)) return null
  const matches = [...text.matchAll(/Dates\s+(\d{1,2})(?:st|nd|rd|th)?\s+to\s+(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})\s+Time\s+\d{1,2}:\d{2}\s*[ap]m\s+to\s+(\d{1,2}):(\d{2})\s*([ap]m)/gi)]
  if (matches.length !== 1) throw new Error('SuryaLogix walk-in deadline dates are unrecognized')
  const [, start, day, monthName, year, hour, minute, period] = matches[0]
  const month = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(monthName.slice(0,3).toLowerCase())
  const utcDay = new Date(Date.UTC(Number(year), month, Number(day)))
  if (month < 0 || Number(start) < 1 || Number(start) > Number(day) || utcDay.getUTCDate() !== Number(day) || Number(hour) < 1 || Number(hour) > 12 || Number(minute) > 59) throw new Error('SuryaLogix invalid event deadline date')
  const closingDate = utcDay.toISOString().slice(0,10)
  const localHour = Number(hour) % 12 + (period.toLowerCase() === 'pm' ? 12 : 0)
  return { closingDate, timestamp: Date.parse(closingDate + 'T' + String(localHour).padStart(2,'0') + ':' + minute + ':00+05:30') }
}

export const createSuryaLogixScraper = () => ({
  async run({ fetchPage = defaultFetchPage, signal, now = () => new Date().toISOString() } = {}) {
    signal?.throwIfAborted()
    const homepage = await fetchPage(HOMEPAGE_URL, { signal })
    signal?.throwIfAborted()

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('SuryaLogix verified official homepage no longer matches the verified first-party surface')
    }

    const careersPage = await fetchPage(CAREERS_URL, { signal })
    signal?.throwIfAborted()

    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('SuryaLogix verified official careers page no longer matches the verified first-party surface')
    }

    if (!hasApplicationFormSurface(careersPage.html)) {
      throw new Error('SuryaLogix careers page no longer matches the verified non-listing application form surface')
    }

    if (!hasUnexpectedPublicJobsSignal(careersPage.html)) throw new Error('SuryaLogix application form does not prove a complete job inventory')
    const visibleMarkup = String(careersPage.html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    const links = [...visibleMarkup.matchAll(/href=["']([^"']+)["']/gi)].map(match => match[1])
    if (links.some(link => /\/jobs\/|lever\.co|greenhouse\.io|ashbyhq|workdayjobs|smartrecruiters|darwinbox|zohorecruit|turbohire|linkedin\.com\/jobs/i.test(link))) throw new Error('SuryaLogix incomplete listing: unexpected public hiring handoff')
    const jobs = extractPublicOpenings(careersPage.html)
    if (jobs.length === 0) {
      throw new Error('SuryaLogix public jobs are present but could not be parsed completely')
    }
    const scrapedAt = now()
    if (!Number.isFinite(Date.parse(scrapedAt))) throw new Error('SuryaLogix invalid observation date')
    const hiddenRanges = fullyHiddenSectionRanges(careersPage.html)
    const isHidden = index => hiddenRanges.some(([start, end]) => index >= start && index < end)
    const openingSignals = [...String(careersPage.html).matchAll(/\bOpenings:/gi)]
    const eventSignals = [...String(careersPage.html).matchAll(/Walk-In Interviews/gi)]
    const hiddenOpenings = openingSignals.filter(match => isHidden(match.index)).length
    const hiddenEvents = eventSignals.filter(match => isHidden(match.index)).length
    const popup = extractVerifiedApplicationPopup(careersPage.html)
    if (hiddenOpenings || hiddenEvents) {
      if (!popup || hiddenOpenings !== jobs.length || hiddenEvents !== eventSignals.length || eventSignals.length !== 1
        || popup.positions.length !== jobs.length || !jobs.every(job => popup.positions.includes(job.title))
        || !jobs.every(job => job.applyUrl.includes('#elementor-action%3Aaction%3Dpopup%3Aopen'))) {
        throw new Error('SuryaLogix hidden archive and current application inventory association is incomplete')
      }
      return attachInventoryEvidence([], {
        status: 'discovery-only', surface: CAREERS_URL, firstParty: true, listingComplete: false,
        pagesFetched: 1, reportedTotal: null, indiaFacetCount: null, verifiedAt: scrapedAt,
        reason: 'hidden-archived-openings-and-current-position-selector-do-not-prove-active-vacancy-inventory',
      })
    }
    if (popup) throw new Error('SuryaLogix current popup with visible openings requires a verified date and inventory association')
    const deadline = getWalkInDeadline(careersPage.html)
    if (deadline && Date.parse(scrapedAt) > deadline.timestamp) return []
    return jobs.map((job) => ({ ...job, closingDate: deadline?.closingDate || null, scrapedAt }))
  },
})

export const run = async (options = {}) => createSuryaLogixScraper().run(options)

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
