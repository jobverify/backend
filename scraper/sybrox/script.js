import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'sybrox'
export const COMPANY = 'Sybrox Tech Pvt. Ltd.'
export const HOMEPAGE_URL = 'https://sybrox.com/'
export const ABOUT_URL = 'https://sybrox.com/about'
export const CONTACT_URL = 'https://sybrox.com/contact'
export const CAREERS_URL = 'https://sybrox.com/rpo%20partner%20vacancies'
export const APPLY_URL = 'https://forms.gle/o43Zh9YvfH4sRCvo8'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const FETCH_TIMEOUT_MS = 15000

const NON_JOB_TITLES = new Set([
  'RPO Partner Vacancies',
  'About Us',
  'Contact Us',
  'Our Company',
  'Our Services',
  'Contact Info',
])

const createFetchTimeoutSignal = signal => AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(FETCH_TIMEOUT_MS)])

export const hasDnsResolutionFailure = (error) => {
  const code = String(error?.cause?.code ?? error?.code ?? '')
  const message = String(error?.cause?.message ?? error?.message ?? error ?? '')

  return code === 'ENOTFOUND'
    || /\bgetaddrinfo ENOTFOUND sybrox\.com\b/i.test(message)
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&#x2013;|&ndash;/gi, '–')
  .replace(/&#8212;|&#x2014;|&mdash;/gi, '—')
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\s+/g, ' ')
  .trim() || null

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

export const defaultFetchPage = async (url, { signal } = {}) => {
  signal?.throwIfAborted()
  const response = await fetch(url, {
    signal: createFetchTimeoutSignal(signal),
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

const extractTextLines = (html) => decodeHtmlEntities(
  String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(?:br|\/p|\/div|\/section|\/article|\/main|\/header|\/footer|\/li|\/ul|\/ol|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<(?:p|div|section|article|main|header|footer|li|ul|ol|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)
  .split('\n')
  .map((line) => line.replace(/\s+/g, ' ').trim())
  .filter(Boolean)

const getNormalizedText = (html) => extractTextLines(html).join('\n')

const isJobMetaLine = (line) => /\|/.test(String(line ?? '')) && /\bExperience:/i.test(String(line ?? ''))
const isFooterLine = (line) => NON_JOB_TITLES.has(String(line ?? '')) || /^©\d{4}\b/.test(String(line ?? ''))
const isNoiseLine = (line) => line === '+' || /^Apply Now$/i.test(line)

const getLineValue = (line, prefix) => {
  const match = String(line ?? '').match(new RegExp(`^${prefix}:\\s*(.+)$`, 'i'))
  return normalizeWhitespace(match?.[1] ?? null)
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/full\s*time/.test(normalized)) return 'Full-time'
  if (/part\s*time/.test(normalized)) return 'Part-time'
  if (/contract/.test(normalized)) return 'Contract'
  if (/intern/.test(normalized)) return 'Internship'
  return normalizeWhitespace(value)
}

const extractCity = (value) => normalizeWhitespace(String(value ?? '').split(/,| – | - /)[0]) || null

const buildJobDescription = (lines = []) => lines
  .filter((line) => !isNoiseLine(line))
  .filter((line) => !/^Openings:/i.test(line))
  .filter((line) => !/^Job Description$/i.test(line))
  .join('\n') || null

const parseMetaLine = (line) => {
  const parts = String(line ?? '').split('|').map((part) => normalizeWhitespace(part)).filter(Boolean)
  const location = parts[0] || null
  const employmentType = normalizeEmploymentType(parts[1] || null)
  const experience = normalizeWhitespace(parts.find((part) => /^Experience:/i.test(part))?.replace(/^Experience:\s*/i, ''))

  return { location, employmentType, experience }
}

export const extractApplyUrls = (html) => [...new Set(
  [...String(html ?? '').matchAll(/https:\/\/forms\.gle\/[A-Za-z0-9_-]+/gi)].map((match) => match[0]),
)]

export const hasOfficialHomepageSignal = (html) => {
  const normalized = getNormalizedText(html)
  return /<title>\s*Sybrox Tech\s*<\/title>/i.test(String(html ?? ''))
    && normalized.includes('Empowering Businesses with Innovation & Technology')
    && normalized.includes('Sybrox is a next-generation IT training and career-launch platform built for the real world.')
    && normalized.includes('Paid Internships')
    && normalized.includes('Sybrox Tech Pvt. Ltd. is a fast-growing IT startup committed to building innovative mobile apps, software solutions and next-generation digital platforms.')
    && normalized.includes('careers@sybrox.com')
}

export const hasOfficialAboutSignal = (html) => {
  const normalized = getNormalizedText(html)
  return normalized.includes('About Us')
    && normalized.includes('Innovation. Integrity. Impact.')
    && normalized.includes('Sybrox is an integrated IT services, consulting, and training company that blends innovation with expertise to deliver impactful business and learning solutions.')
    && normalized.includes('We bring together IT services, consulting, training, and staffing under one roof.')
    && normalized.includes('Sybrox Tech Pvt. Ltd. is a fast-growing IT startup committed to building innovative mobile apps, software solutions and next-generation digital platforms.')
    && normalized.includes('careers@sybrox.com')
}

export const hasOfficialContactSignal = (html) => {
  const normalized = getNormalizedText(html)
  return normalized.includes('Contact Us')
    && normalized.includes('Let’s Build Something Great Together')
    && normalized.includes('Business Inquiries: info@sybrox.com')
    && normalized.includes('Join Our Team: careers@sybrox.com')
    && normalized.includes('Services Inquiries: services@sybrox.com')
    && normalized.includes('Working Hours: Mon–Sat, 9:00 AM – 6:00 PM IST')
    && normalized.includes('Sybrox Tech Pvt. Ltd. is a fast-growing IT startup committed to building innovative mobile apps, software solutions and next-generation digital platforms.')
}

const isPotentialJobStart = (line, nextLine) =>
  Boolean(line)
  && Boolean(nextLine)
  && !NON_JOB_TITLES.has(line)
  && isJobMetaLine(nextLine)

const buildJobObject = (blockLines = [], sharedApplyUrl) => {
  const heading = blockLines[0]
  const meta = parseMetaLine(blockLines[1])
  const title = getLineValue(blockLines.find((line) => /^Job:/i.test(line)), 'Job') || heading
  const company = getLineValue(blockLines.find((line) => /^Company:/i.test(line)), 'Company') || COMPANY
  const requiredSkills = (getLineValue(blockLines.find((line) => /^Required Skill:/i.test(line)), 'Required Skill') || '')
    .split(',')
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean)
  const minimumQualification =
    getLineValue(blockLines.find((line) => /^Eligibility:/i.test(line)), 'Eligibility')
    || getLineValue(blockLines.find((line) => /^Qualification:/i.test(line)), 'Qualification')
  const explicitLocation = getLineValue(blockLines.find((line) => /^Location:/i.test(line)), 'Location')
  const experienceRequired =
    meta.experience
    || getLineValue(blockLines.find((line) => /^Experience:/i.test(line)), 'Experience')
  const descriptionStart = blockLines.findIndex((line) => /^Job Description$/i.test(line))
  const descriptionLines = descriptionStart >= 0 ? blockLines.slice(descriptionStart + 1) : blockLines.slice(2)
  const location = explicitLocation || meta.location
  const city = extractCity(location)
  const jobId = `${SOURCE}-${slugify([company, title, location].filter(Boolean).join(' '))}`

  if (!title || !location || !jobId || !sharedApplyUrl) {
    return null
  }

  return {
    title,
    company,
    department: heading,
    location,
    city,
    state: null,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: CAREERS_URL,
    applyUrl: sharedApplyUrl,
    employmentType: meta.employmentType,
    experienceRequired,
    minimumQualification,
    preferredQualification: null,
    requiredSkills,
    postingDate: null,
    closingDate: null,
    jobDescription: buildJobDescription(descriptionLines),
    remoteStatus: 'On-site',
  }
}

export const extractJobs = (html) => {
  const lines = extractTextLines(html)
  const sharedApplyUrl = extractApplyUrls(html).length === 1 ? extractApplyUrls(html)[0] : null
  const jobs = []

  for (let index = 0; index < lines.length - 1; index += 1) {
    if (!isPotentialJobStart(lines[index], lines[index + 1])) continue

    const blockLines = [lines[index], lines[index + 1]]
    let cursor = index + 2

    while (cursor < lines.length && !isPotentialJobStart(lines[cursor], lines[cursor + 1]) && !isFooterLine(lines[cursor])) {
      blockLines.push(lines[cursor])
      cursor += 1
    }

    const job = buildJobObject(blockLines, sharedApplyUrl)
    if (job) jobs.push(job)

    index = cursor - 1
  }

  return jobs
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = getNormalizedText(html)
  const applyUrls = extractApplyUrls(html)

  return /<title>\s*RPO Partner Vacancies\s*<\/title>/i.test(String(html ?? ''))
    && normalized.includes('RPO Partner Vacancies')
    && normalized.includes('Discover exciting career opportunities with leading organizations through Sybrox RPO Services.')
    && normalized.includes('Openings: 200 Vacancies')
    && normalized.includes('Apply Now')
    && normalized.includes('Sybrox Tech Pvt. Ltd. is a fast-growing IT startup committed to building innovative mobile apps, software solutions and next-generation digital platforms.')
    && applyUrls.length === 1
    && applyUrls[0] === APPLY_URL
    && extractJobs(html).length > 0
}


export const DIVISION_IDENTITY_URL = 'https://in.linkedin.com/company/sybroxtech'
export const DIVISION_HOME_URL = 'https://sybroxtech.com/'
export const DIVISION_CAREERS_URL = 'https://sybroxtech.com/sybrox%20careers'
export const DIVISION_JOBS_URL = 'https://sybroxtech.com/explore%20sybrox'
const DIVISION_FORMS = new Map([
  ['https://forms.gle/zifYrSZj4MA1utAq8', 'https://docs.google.com/forms/d/e/1FAIpQLSeI7odXNq0XKmpS3W13m4r5haEnszJuKeQDV8WUtgshlY3hbw/viewform?usp=send_form'],
  ['https://forms.gle/ZBGy9QEpq4xupnQC6', 'https://docs.google.com/forms/d/e/1FAIpQLSdBPQgCCmUtHe9PHqpmz0J9Ed-PlgPQC7lGJn7zPjVvWedBVQ/viewform?usp=send_form'],
])
const divisionError = message => Object.assign(new Error('Sybrox verified division inventory: ' + message), { abortRetries: true, failureKind: 'unverified_inventory' })
const visiblePage = html => String(html ?? '').replace(/<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi, '')
const absoluteLinks = (html, base) => [...visiblePage(html).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)].map(match => {try{return new URL(decodeHtmlEntities(match[1]), base).href}catch{return null}}).filter(Boolean)
const legalDivision = html => getNormalizedText(visiblePage(html)).includes(COMPANY)
const verifyDivisionIdentity = (html, checkedAt) => {
  const page = String(html ?? '').replace(/<!--[\s\S]*?-->/g, '')
  if (!/<title>\s*Sybrox\s*\|\s*LinkedIn\s*<\/title>/i.test(page)
    || !/<link\b[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/in\.linkedin\.com\/company\/sybroxtech["']/i.test(page)) throw divisionError('employer profile identity changed')
  const posts = []
  const walk = value => {if (value && typeof value === 'object') {if(value['@type'] === 'SocialMediaPosting') posts.push(value);for(const child of Object.values(value)) walk(child)}}
  for(const match of page.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{walk(JSON.parse(match[1]))}catch{throw divisionError('employer profile structured identity is malformed')}}
  if(!posts.some(post => post.author?.['@type'] === 'Organization' && post.author.name === 'Sybrox' && post.author.url === DIVISION_IDENTITY_URL
    && Number.isFinite(Date.parse(post.datePublished)) && Date.parse(post.datePublished) <= Date.parse(checkedAt)
    && /SybroxTech \(www\.sybroxtech\.com\) is the technology and consulting division of Sybrox \(www\.sybrox\.com\)\./.test(post.text || '')
    && /^https:\/\/www\.linkedin\.com\/posts\/sybroxtech_[a-z0-9_-]+$/.test(post.mainEntityOfPage || ''))) throw divisionError('employer-authored technology division handoff is missing')
}
const parseDivisionRoles = html => {
  const page=visiblePage(html), sections=[...page.matchAll(/<section\b[^>]*class=["']job-listings["'][^>]*>([\s\S]*?)<\/section>/gi)]
  if(!/<title>\s*Explore Sybrox\s*<\/title>/i.test(page) || !legalDivision(page) || sections.length!==1) throw divisionError('own vacancy page identity changed; RPO client pages are excluded')
  const section=sections[0][1], starts=[...section.matchAll(/<div\b[^>]*class=["']job-card["'][^>]*>/gi)]
  if(!starts.length || starts.length>100) throw divisionError('nonempty bounded own vacancy cards are missing')
  if([...section.matchAll(/<div\b[^>]*class=["']job-header["'][^>]*>/gi)].length!==starts.length || [...section.matchAll(/<div\b[^>]*class=["']job-details["'][^>]*>/gi)].length!==starts.length || [...section.matchAll(/<div\b[^>]*class=["']job-actions["'][^>]*>/gi)].length!==starts.length) throw divisionError('own vacancy card structure count changed')
  const ids=new Set()
  return starts.map((start,index)=>{
    const block=section.slice(start.index,starts[index+1]?.index??section.length)
    const headings=[...block.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi)]
    const heading=normalizeWhitespace(headings[0]?.[1].replace(/<[^>]+>/g,' '))
    const metaMatch=block.match(/<div\b[^>]*class=["']job-info["'][^>]*>[\s\S]*?<h3\b[^>]*>[\s\S]*?<\/h3>\s*<p\b[^>]*>([\s\S]*?)<\/p>/i)
    const meta=parseMetaLine(getNormalizedText(metaMatch?.[1]))
    const details=block.match(/<div\b[^>]*class=["']job-details["'][^>]*>([\s\S]*?)<div\b[^>]*class=["']job-actions["']/i)?.[1]
    const lines=extractTextLines(details), title=getLineValue(lines.find(line=>/^Job:/i.test(line)),'Job'), id=getLineValue(lines.find(line=>/^Job Number:/i.test(line)),'Job Number')
    const jds=[...(details||'').matchAll(/<h4\b[^>]*>\s*Job Description\s*<\/h4>([\s\S]*)/gi)]
    const description=buildJobDescription(extractTextLines(jds[0]?.[1]))
    const applies=[...block.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*class=["']apply-btn["'][^>]*>\s*Apply Now\s*<\/a>/gi)].map(m=>decodeHtmlEntities(m[1]))
    const skillLine=extractTextLines(block).find(line=>/^Required Skill:/i.test(line))
    if(headings.length!==1 || !heading || !title || !/^ST(?:IT|HR)-[A-Z0-9]+-\d{3}$/.test(id||'') || ids.has(id)
      || meta.location!=='Chennai' || !meta.employmentType || !meta.experience || jds.length!==1 || !description || description.length<300
      || applies.length!==1 || !DIVISION_FORMS.has(applies[0])) throw divisionError('malformed, duplicate, unscoped, or missing native own role/JD/application')
    const explicitLocations=lines.filter(line=>/^(?:Job |Workplace |Work )?Location:/i.test(line)).map(line=>line.replace(/^[^:]+:\s*/,''))
    const explicitCompanies=lines.filter(line=>/^(?:Hiring )?Company:/i.test(line)).map(line=>line.replace(/^[^:]+:\s*/,''))
    if(explicitLocations.some(location=>!['Chennai','Chennai, India','Chennai, Tamil Nadu, India'].includes(location)) || explicitCompanies.some(company=>company!==COMPANY)) throw divisionError('conflicting native workplace or employer in own role detail')
    ids.add(id)
    return {title,company:COMPANY,department:heading,location:meta.location,city:'Chennai',state:null,country:'India',jobId:id,requisitionId:id,sourceUrl:DIVISION_JOBS_URL,applyUrl:applies[0],employmentType:meta.employmentType,experienceRequired:meta.experience,minimumQualification:null,preferredQualification:null,requiredSkills:(getLineValue(skillLine,'Required Skill')||'').split(',').map(s=>s.trim()).filter(Boolean),postingDate:null,closingDate:null,jobDescription:description,remoteStatus:null,sourceListingComplete:false}
  })
}
const verifyDivisionForm = (page,url) => {
  if(page.url!==DIVISION_FORMS.get(url)) throw divisionError('published application handoff redirects to a different native form')
  const text=getNormalizedText(page.html)
  if(/no longer accepting|not accepting responses|does not exist|form has been deleted|file does not exist|you need permission/i.test(text)) throw divisionError('published application form is removed, closed or inaccessible')
  if(page.status===401 && /Sign in to your Google Account/i.test(text) && /You must sign in to access this content/i.test(text)) return 'applicant-sign-in-required'
  throw divisionError('published native application response is not a verified form or applicant sign-in requirement (HTTP '+page.status+')')
}
export const createSybroxScraper = ({maxJobs=Number.isInteger(config.maxJobs)?config.maxJobs:null}={})=>({
 async run({fetchPage=defaultFetchPage,now=()=>new Date().toISOString(),signal}={}){
  const read=async(url,{form=false}={})=>{signal?.throwIfAborted();const page=await fetchPage(url,{signal});signal?.throwIfAborted();if(!form&&(page.status!==200||page.url!==url))throw divisionError('current published authority unavailable or final redirect changed: '+url+' -> '+page.url+' HTTP '+page.status);return page}
  const checkedAt=now();verifyDivisionIdentity((await read(DIVISION_IDENTITY_URL)).html,checkedAt)
  const home=(await read(DIVISION_HOME_URL)).html
  if(!/<title>\s*Sybrox Tech\s*<\/title>/i.test(home) || !legalDivision(home) || !normalizeWhitespace(getNormalizedText(visiblePage(home))).includes('Empowering Businesses with Innovation & Technology') || !absoluteLinks(home,DIVISION_HOME_URL).includes('mailto:careers@sybrox.com') || !absoluteLinks(home,DIVISION_HOME_URL).includes('https://sybroxtech.com/Sybrox%20Careers.html')) throw divisionError('current technology division homepage or careers handoff changed')
  const careers=(await read(DIVISION_CAREERS_URL)).html
  if(!/<title>\s*Careers at Sybrox\s*<\/title>/i.test(careers) || !legalDivision(careers) || !normalizeWhitespace(getNormalizedText(visiblePage(careers))).includes('Join Our Team of Innovators') || !absoluteLinks(careers,DIVISION_CAREERS_URL).includes('https://sybroxtech.com/Explore%20Sybrox.html')) throw divisionError('current own careers page or vacancy handoff changed')
  const jobs=parseDivisionRoles((await read(DIVISION_JOBS_URL)).html),formStates=[]
  for(const url of new Set(jobs.map(job=>job.applyUrl)))formStates.push(verifyDivisionForm(await read(url,{form:true}),url))
  const snapshot=parseDivisionRoles((await read(DIVISION_JOBS_URL)).html)
  if(JSON.stringify(jobs)!==JSON.stringify(snapshot)) throw divisionError('own vacancy listing changed during traversal')
  const selected=Number.isInteger(maxJobs)&&maxJobs>0?jobs.slice(0,maxJobs):jobs
  return attachInventoryEvidence(selected.map(job=>({...job,source:SOURCE,link:job.applyUrl,scrapedAt:checkedAt})),{status:'coverage-gap',surface:DIVISION_JOBS_URL,firstParty:true,listingComplete:false,pagesFetched:1,reportedTotal:null,indiaFacetCount:null,verifiedAt:checkedAt,reason:'Observed '+jobs.length+' employer-owned roles; country derived from each explicit job-specific Chennai workplace, not company headquarters. Whole employer inventory and country totals remain unknown; RPO client vacancies are excluded. Published Google Forms handoff '+(formStates.includes('applicant-sign-in-required')?'requires applicant sign-in; form content was not publicly validated.':'was publicly validated.')+(selected.length!==jobs.length?' Configured output cap preserves incomplete coverage.':'')})
 }
})

export const run=async(options={})=>createSybroxScraper(options).run(options)

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
