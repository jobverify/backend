import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {nativeLocationCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'dineshchandraragrawalinfracon'
export const COMPANY = 'Dineshchandra R. Agrawal Infracon Private Limited'
export const HOMEPAGE_URL = 'https://www.draipl.com/'
export const CAREERS_URL = 'https://www.draipl.com/careers.html'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_ERROR =
  'DRA Infracon verified official homepage no longer matches the trusted first-party surface'
const CAREERS_ERROR =
  'DRA Infracon verified public careers page no longer matches the verified first-party page with public job openings'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&#8211;|&#x2013;/gi, '-')
  .replace(/&mdash;|&#8212;|&#x2014;/gi, '-')
  .replace(/[–—]/g, '-')
  .replace(/[â€“â€”]/g, '-')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtml(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeOptionalField = (value) => {
  const normalized = normalizeWhitespace(value)
  return normalized === '-' ? null : normalized
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '').replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/['"]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const countMatches = (value, pattern) => [...String(value ?? '').matchAll(pattern)].length
const activeListingHTML=html=>{
 const doc=readVisibleNativeDocument(html,{strict:true})
 const render=node=>typeof node==='string'?node:node.inert||['script','style','title'].includes(node.tag)?'':node.tag==='root'?node.children.map(render).join(''):'<'+node.tag+'>'+node.children.map(render).join('')+'</'+node.tag+'>'
 return doc.nodes(n=>n.tag==='root').map(render).join('')
}

const htmlToLines = (html) => decodeHtml(
  String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|li|h[1-6]|option|button|a|select)>/gi, '\n')
    .replace(/<(p|div|section|li|h[1-6]|option|button|a|select)\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, ' '),
)
  .replace(/\r/g, '')
  .split('\n')
  .map((line) => line.replace(/\s+/g, ' ').trim())
  .filter(Boolean)

const normalizeLocationString = (value) => {
  const normalized = normalizeOptionalField(value)
  return normalized ? normalized.replace(/\s*-\s*/g, ' - ') : null
}

const parseLocation = (value) => {
  const location = normalizeLocationString(value)
  if (!location) {
    return { location: null, city: null, state: null }
  }

  if (/^head office$/i.test(location)) {
    return { location, city: null, state: null }
  }

  const parts = location.split(/\s+-\s+/)
  if (parts.length === 2) {
    const [first, second] = parts.map((part) => normalizeWhitespace(part))

    if (/project/i.test(second || '') && /^[a-z .]+$/i.test(first || '')) return { location: `${first} - ${second}`, city: first, state: null }
    if (/^[a-z .]+$/i.test(first || '') && /^[a-z .]+$/i.test(second || '')) {
      return { location: `${first} - ${second}`, city: first, state: second }
    }

    if (/project/i.test(second || '') && /^[a-z .]+$/i.test(first || '')) {
      return { location: `${first} - ${second}`, city: first, state: null }
    }
  }

  if (/^[a-z .]+$/i.test(location)) {
    return { location, city: location, state: null }
  }

  return { location, city: null, state: null }
}

const extractPositionsFromApplyForm = (html) => {
  const selectHtml = String(html ?? '').match(/<select\b[^>]*>([\s\S]*?)<\/select>/i)?.[1]
  if (!selectHtml) {
    throw new Error(CAREERS_ERROR)
  }

  return [...selectHtml.matchAll(/<option[^>]*>([\s\S]*?)<\/option>/gi)]
    .map((match) => normalizeOptionalField(stripTags(match[1])))
    .filter((value) => value && !/^select position$/i.test(value))
}

const extractListingLines = (html) => {
  const lines = htmlToLines(html)
  const introIndex = lines.findIndex((line) =>
    /^Currently,\s*we are looking for applicants for the following positions\.$/i.test(line),
  )
  const firstPositionIndex = lines.findIndex((line) => /^Position:\s*/i.test(line))
  const endIndex = lines.findIndex((line) => /^Please fill your Details$/i.test(line))
  const startIndex = firstPositionIndex !== -1 ? firstPositionIndex : introIndex + 1

  if ((introIndex === -1 && firstPositionIndex === -1) || endIndex === -1 || endIndex <= startIndex) {
    throw new Error(CAREERS_ERROR)
  }

  return lines.slice(startIndex, endIndex)
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''
  const hasLegacyCompanyIntro =
    /Dineshchandra R\. Agrawal Infracon Private Limited, which has been operating successfully over five decades/i.test(text)
  const hasCurrentCompanyIntro =
    /Our Vision for better tomorrow/i.test(text)
    && /About Dineshchandra R\. Agrawal Infracon Pvt\. Ltd\./i.test(text)

  return /DINESHCHANDRA R\. AGRAWAL INFRACON PVT\. LTD\./i.test(text)
    && (hasLegacyCompanyIntro || hasCurrentCompanyIntro)
    && /The fundamental premise of the Company is built on integrity, commitment to quality and excellence/i.test(text)
    && /href=["'](?:(?:https:\/\/www\.draipl\.com\/)|\/)?careers\.html["']/i.test(page)
    && /info@draipl\.com/i.test(text)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*DRA\s*\|\s*We build future\s*-\s*Dineshchandra R\.\s*Agrawal Infracon Pvt\.\s*Ltd\.\s*<\/title>/i.test(page)
    && /<h[1-4]\b[^>]*>\s*Careers\s*<\/h[1-4]>/i.test(page)
    && /Currently,\s*we are looking for applicants for the following positions\./i.test(text)
    && /Please fill your Details/i.test(text)
    && /Upload Your Resume/i.test(text)
    && countMatches(page, />\s*Apply Now\s*</gi) >= 15
    && countMatches(page, /<option\b/gi) >= 16
}

export const extractPublicListings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error(CAREERS_ERROR)
  }

  const active=activeListingHTML(html),lines = extractListingLines(active)
  const formTitles = extractPositionsFromApplyForm(active)
  const jobs = []

  for (let index = 0; index < lines.length; index += 1) {
    if (!/^Position:\s*/i.test(lines[index])) continue

    const titleParts = [
      normalizeOptionalField(lines[index].replace(/^Position:\s*/i, '')),
    ].filter(Boolean)
    let experienceIndex = index + 1

    while (experienceIndex < lines.length && !/^Experience:\s*/i.test(lines[experienceIndex] || '')) {
      const continuation = normalizeOptionalField(lines[experienceIndex])
      if (continuation) {
        titleParts.push(continuation)
      }
      experienceIndex += 1
    }

    const title = normalizeOptionalField(titleParts.join(' '))
    const experienceLine = lines[experienceIndex]
    const experienceParts = [
      normalizeOptionalField(experienceLine?.replace(/^Experience:\s*/i, '')),
    ].filter(Boolean)
    let locationIndex = experienceIndex + 1

    while (locationIndex < lines.length && !/^Location:\s*/i.test(lines[locationIndex] || '')) {
      const continuation = normalizeOptionalField(lines[locationIndex])
      if (continuation) {
        experienceParts.push(continuation)
      }
      locationIndex += 1
    }

    const locationLine = lines[locationIndex]
    const locationParts = [
      normalizeOptionalField(locationLine?.replace(/^Location:\s*/i, '')),
    ].filter(Boolean)
    let descriptionIndex = locationIndex + 1

    while (descriptionIndex < lines.length && !/^Description:\s*/i.test(lines[descriptionIndex] || '')) {
      const continuation = normalizeOptionalField(lines[descriptionIndex])
      if (continuation) {
        locationParts.push(continuation)
      }
      descriptionIndex += 1
    }

    const descriptionLine = lines[descriptionIndex]

    if (
      !title
      || !/^Experience:\s*/i.test(experienceLine || '')
      || !/^Location:\s*/i.test(locationLine || '')
      || !/^Description:\s*/i.test(descriptionLine || '')
    ) {
      throw new Error(CAREERS_ERROR)
    }

    const descriptionParts = [
      normalizeOptionalField(descriptionLine.replace(/^Description:\s*/i, '')),
    ].filter(Boolean)
    let applyIndex = descriptionIndex + 1

    while (applyIndex < lines.length && !/^Apply Now$/i.test(lines[applyIndex] || '')) {
      const continuation = normalizeOptionalField(lines[applyIndex])
      if (continuation) {
        descriptionParts.push(continuation)
      }
      applyIndex += 1
    }

    if (!/^Apply Now$/i.test(lines[applyIndex] || '')) {
      throw new Error(CAREERS_ERROR)
    }

    const locationFields = parseLocation(locationParts.join(' '))
    const jobId = `${SOURCE}-${slugify(title)}`

    if (!jobId) {
      throw new Error(CAREERS_ERROR)
    }

    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location: locationFields.location,
      city: locationFields.city,
      state: locationFields.state,
      country: nativeLocationCountryName(locationFields.location),
      jobId,
      requisitionId: null,
      sourceUrl: CAREERS_URL,
      applyUrl: CAREERS_URL,
      employmentType: null,
      experienceRequired: normalizeOptionalField(experienceParts.join(' ')),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: normalizeOptionalField(descriptionParts.join(' ')),
      rawNativeRoleEvidence:{title,locationField:normalizeLocationString(locationParts.join(' ')),experienceField:normalizeOptionalField(experienceParts.join(' ')),descriptionField:normalizeOptionalField(descriptionParts.join(' ')),nativeRequisitionId:null,identityQualified:true,applicationSubmissionQualified:false},
    })

    index = applyIndex
  }

  if (jobs.length === 0 || jobs.length !== formTitles.length) {
    throw new Error(CAREERS_ERROR)
  }

  const jobTitles = jobs.map((job) => job.title)
  if(new Set(jobTitles).size!==jobTitles.length)throw Object.assign(Error('DRA native duplicate role identity'),{abortRetries:true})
  if (jobTitles.some((title, index) => title !== formTitles[index])) {
    throw new Error(CAREERS_ERROR)
  }

  return jobs
}

const defaultFetchText = async (url,{signal}={}) => {
 const request=new URL(url),surface=CAREERS_URL
 const fail=(message,fields={})=>{throw Object.assign(Error('dineshchandraragrawalinfracon native input: '+message),{abortRetries:true,...fields,inventoryEvidence:{status:'coverage-gap',surface,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null}})}
 signal?.throwIfAborted()
 let response;try{response=await fetch(url,{headers:{'User-Agent':USER_AGENT,Accept:'text/html,application/javascript,application/json;q=0.9,*/*;q=0.8'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)})}catch(error){if(signal?.aborted)throw signal.reason;fail(error.message,{cause:error})}
 if(!response.ok){await response.body?.cancel();fail('HTTP '+response.status,{status:response.status,code:[401,403].includes(response.status)?'access_denied':'native_unavailable',finalUrl:response.url})}
 const final=new URL(response.url||url),samePath=final.pathname.replace(/\/$/,'')===request.pathname.replace(/\/$/,'')
 if(final.origin!==request.origin||!samePath||final.search!==request.search){await response.body?.cancel();fail('unexpected native redirect',{status:response.status,finalUrl:response.url})}
 const body=await response.text();signal?.throwIfAborted();if(/<title\b[^>]*>\s*(?:Access\s*Denied|Forbidden)\s*<\/title>|<Code>\s*AccessDenied\s*<\/Code>/i.test(body))fail('native access denial returned HTTP200',{status:response.status,code:'access_denied',finalUrl:response.url});return body
}

export const createDineshchandraRAgrawalInfraconScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow, signal } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL,{signal})
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error(HOMEPAGE_ERROR)
    }

    const careersHtml = await fetchText(CAREERS_URL,{signal})
    const jobs = extractPublicListings(careersHtml)

    const result=jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: (overrideNow || now)(),
      companyCareerPage: CAREERS_URL,
      companyDomain: 'draipl.com',
      atsPlatform: 'official-company-careers',
    }))
    return finishNativeCollection(result,{now:overrideNow||now,pagesFetched:2,explicitlyUnspecifiedWorkplaces:jobs.filter(j=>!j.location).length,headOfficeResolutionQualified:false})
  },
})

const finishNativeCollection=(jobs,{observedListingCount=jobs.length,pagesFetched=1,now=()=>new Date().toISOString(),...extra}={})=>{
 const failures=jobs.filter(j=>!j.jobDescription||j.rawNativeRoleEvidence?.identityQualified===false).map(j=>({stage:'native-detail',nativeRoleId:j.jobId??j.sourceUrl,kind:j.rawNativeRoleEvidence?.identityQualified===false?'identity-conflict':'missing-content'}))
 const audit={source:'dineshchandraragrawalinfracon',observedListingCount,candidateDetails:observedListingCount,extractedDetailJobs:jobs.length-failures.length,excludedDetailJobs:0,failures,reportedTotal:null,indiaFacetCount:null,listingPaginationComplete:null,closingInventoryMatches:null,sourceScopeComplete:false,observedMissingWorkplaces:jobs.filter(j=>!j.location).length,observedUnknownCountries:jobs.filter(j=>!j.country).length,rawProvenanceLimit:'Observed native rows only; employer-wide scope, exact India count, closing inventory and active application submission remain unqualified',...extra}
 for(const job of jobs){job.sourceListingComplete=false;job.sourceDetailComplete=Boolean(job.jobDescription)&&job.rawNativeRoleEvidence?.identityQualified!==false}
 if(jobs.length)jobs[0].nativeCollectionEvidence=audit
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit})
 return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS_URL,firstParty:true,listingComplete:false,pagesFetched,reportedTotal:null,indiaFacetCount:null,verifiedAt:now(),reason:'observed-native-subset-with-unqualified-employer-scope'})
}

export const run = async (options = {}) => createDineshchandraRAgrawalInfraconScraper().run(options)

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
