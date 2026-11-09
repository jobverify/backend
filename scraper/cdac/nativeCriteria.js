import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

const check = (ok, message) => { if (!ok) throw new Error(`C-DAC native: ${message}`) }
const descendants = (node, predicate) => node?.inert ? [] : [...(node && predicate(node) ? [node] : []), ...(node?.children || []).filter(child => typeof child !== 'string').flatMap(child => descendants(child, predicate))]
const key = value => String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase()
const cells = row => (row.children || []).filter(child => typeof child !== 'string' && ['td', 'th'].includes(child.tag))
const fields = (table, document) => descendants(table, node => node.tag === 'tr').map(row => cells(row).map(cell => document.text(cell))).filter(row => row.length === 2)
const findField = (rows, pattern) => rows.find(([label]) => pattern.test(label))?.[1] || null

export const nativeMainText = html => {
  const document = readNativeDocument(html)
  const main = document.nodes(node => node.tag === 'main')
  check(main.length === 1, 'expected one active first-party content region')
  return document.text(main[0])
}

export const readCaeInventory = (html, url) => {
  const document = readNativeDocument(html)
  const text = nativeMainText(html)
  check(/C-DAC Adjunct Engineer.*Scheme/i.test(text) && /engagement is tenable only in India/i.test(text)
    && /ongoing\/rolling advertisement/i.test(text), 'current rolling scheme identity, country or ongoing status changed')
  const termsStart = text.indexOf('Who will be eligible to apply?')
  check(termsStart > 0 && /minimum eight years/i.test(text.slice(termsStart)), 'published complete common criteria are missing')
  const rows = document.nodes(node => node.tag === 'tr').flatMap(row => {
    const links = descendants(row, node => node.tag === 'a' && document.text(node) === 'View Details')
    if (!links.length) return []
    const values = cells(row).map(cell => document.text(cell))
    check(links.length === 1 && values.length === 4, 'native role inventory row changed')
    const detailURL = new URL(links[0].attrs.href, url)
    check(detailURL.origin === 'https://cdac.in' && detailURL.pathname === '/index.aspx' && detailURL.searchParams.has('id'), 'native detail link left its declared first-party surface')
    return [{ title: values[0], vacancies: Number(values[1]), location: values[2], url: detailURL.href }]
  })
  check(rows.length > 0 && new Set(rows.map(row => row.url)).size === rows.length
    && rows.every(row => row.title && row.location && Number.isInteger(row.vacancies) && row.vacancies > 0), 'native role row identities or counts are incomplete')
  return { rows, terms: text.slice(termsStart) }
}

export const readCaeDetails = (html, listing, terms) => {
  const document = readNativeDocument(html)
  const tables = document.nodes(node => node.tag === 'table').filter(table => fields(table, document).some(([label]) => /^(?:Name of (?:the )?Post|Position)$/i.test(label)))
  check(tables.length > 0, 'full post-specific criteria table is missing')
  const applications = document.nodes(node => node.tag === 'a' && document.text(node) === 'Apply Now').map(node => new URL(node.attrs.href, listing.url))
  check(applications.length >= tables.length && applications.every(url => url.origin === 'https://cdac.in' && /(?:cae|ads)_resume/.test(url.searchParams.get('id') || '')), 'published post application binding is missing')
  const jobs = tables.map((table, index) => {
    const rows = fields(table, document)
    const post = findField(rows, /^(?:Name of (?:the )?Post|Position)$/i)
    const domain = findField(rows, /Specialization\s*\/\s*Domain/i)
    const qualification = findField(rows, /(?:Educational|Essential) Qualification/i)
    const experience = findField(rows, /(?:post qualification|minimum).*experience/i)
    const profile = findField(rows, /(?:Proposed )?Job Profile/i)
    const vacancies = Number.parseInt(findField(rows, /No\. of (?:Requirements|Positions)/i), 10)
    const nativeLocation = findField(rows, /Job Location/i) || listing.location
    const body = document.text(table)
    check(post && qualification && profile && body.length > 500 && experience, 'complete published qualification, experience or role profile is missing')
    check(vacancies > 0, 'native post count is missing')
    const pageId = new URL(listing.url).searchParams.get('id')
    return { jobId: `cdac-${pageId}-${key(post)}`, requisitionId: null, sourcePostingKey: `${pageId}:${post}`,
      title: domain || post, company: 'C-DAC', source: 'cdac', department: findField(rows, /^Group$/i),
      location: /\bIndia\b/i.test(nativeLocation) ? nativeLocation : `${nativeLocation}, India`, city: null, country: 'India', sourceNativeLocation: nativeLocation,
      sourceUrl: listing.url, applyUrl: applications[index].href, link: applications[index].href,
      employmentType: 'Contract', experienceRequired: experience, minimumQualification: qualification,
      preferredQualification: null, requiredSkills: [], postingDate: null, closingDate: null,
      numberOfOpenings: vacancies, jobDescription: `${body}\n\nPublished common CAE scheme criteria and terms:\n${terms}`,
      sourceDetailComplete: true, sourceCountryEvidence: 'Current native CAE scheme expressly states engagement is tenable only in India; individual post is linked from that scheme.' }
  })
  const detailedPositions = jobs.reduce((sum, job) => sum + job.numberOfOpenings, 0)
  if (detailedPositions !== listing.vacancies) for (const job of jobs) {
    job.sourceNativeVacancyCounts = { listing: listing.vacancies, detailed: detailedPositions, conflicting: true }
    job.numberOfOpenings = null
  }
  check(new Set(jobs.map(job => job.jobId)).size === jobs.length, 'native post keys repeat within detail page')
  return jobs
}

const iso = (year, month, day) => {
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 23, 59, 59))
  return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day) ? date.toISOString().slice(0, 10) : null
}
const monthNumber = word => ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'].indexOf(word.toLowerCase()) + 1
export const publishedClosingDate = text => {
  const numeric = /(?:on or before|Last date of Registration)\s+(\d{1,2})[./](\d{1,2})[./](20\d{2})/i.exec(text)
  if (numeric) return iso(numeric[3], numeric[2], numeric[1])
  const words = /(?:Last Date to Send Updated Resumes with Application Form:|Date:\s*\d{1,2}\s*(?:st|nd|rd|th)?\s+[A-Za-z]+\s+20\d{2}\s+to)\s*(\d{1,2})\s*(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(20\d{2})/i.exec(text)
  return words && monthNumber(words[2]) ? iso(words[3], monthNumber(words[2]), words[1]) : null
}
