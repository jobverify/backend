import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'precisionprecastsolutions'
export const COMPANY = 'Precision Precast Solutions'
export const HOMEPAGE_URL = 'https://ppspl.com/'
export const CAREERS_URL = 'https://ppspl.com/career.php'
export const APPLY_URL = 'https://ppspl.com/resume.php'

const COMPANY_DOMAIN = 'ppspl.com'
const ATS_PLATFORM = 'official-company-careers'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&mdash;|&#8211;|&#8212;/gi, '-')
  .replace(/&bull;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|ul|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const stripHtmlComments = (value) => String(value ?? '').replace(/<!--[\s\S]*?-->/g, ' ')

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/['"]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const buildJobId = (title) => `${SOURCE}-${slugify(title)}`

const cleanupLabelValue = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/^(?:designation|qualification|experience|required minimum)\s*[-:]\s*/i, '')
    .replace(/\s+of\s+experience$/i, '')
    .replace(/\.$/, ''),
)

const extractListItems = (html) => [...stripHtmlComments(html).matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const tokenizeBody = (html) => {
  const tokens = []

  for (const match of stripHtmlComments(html).matchAll(/<(p|ul)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const [, tag, innerHtml] = match

    if (tag.toLowerCase() === 'ul') {
      const items = extractListItems(innerHtml)
      if (items.length > 0) {
        tokens.push({ type: 'ul', items })
      }
      continue
    }

    const text = stripTags(innerHtml)
    if (text) {
      tokens.push({ type: 'p', text })
    }
  }

  return tokens
}

const extractCardFieldValue = (text, patterns) => {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      return cleanupLabelValue(match[1])
    }
  }

  return null
}

const normalizeTitle = (value) => normalizeWhitespace(value)
  ?.replace(/\s+\/\s+/g, ' / ')
  || null

const extractDesignationValue = (text) => {
  const match = String(text ?? '').match(
    /^designation\s*[-:]\s*(.+?)(?=\s+qualification\s*[-:]|\s+experience\s*[-:]|$)/i,
  )

  return match?.[1] ? normalizeTitle(match[1]) : null
}

const extractQualificationValue = (text) => {
  const match = String(text ?? '').match(/qualification\s*[-:]\s*(.+?)(?=\s+experience\s*[-:]|$)/i)
  return match?.[1] ? cleanupLabelValue(match[1]) : null
}

const extractExperienceValue = (text) => {
  const rawText = String(text ?? '')

  const directMatch = rawText.match(/experience\s*[-:]\s*(.+)$/i)
  if (directMatch?.[1]) {
    return cleanupLabelValue(directMatch[1])
  }

  const minimumMatch = rawText.match(/required minimum\s+(.+?)\s+of\s+experience$/i)
  return minimumMatch?.[1] ? cleanupLabelValue(minimumMatch[1]) : null
}

const buildDescription = ({ responsibilityIntro, experienceRequired, responsibilityItems }) => {
  const lines = []

  if (responsibilityIntro) lines.push(responsibilityIntro)
  if (experienceRequired && /^required minimum/i.test(experienceRequired.raw || '')) {
    lines.push(experienceRequired.raw)
  }

  for (const item of responsibilityItems) {
    if (!item) continue
    if (experienceRequired?.raw && item === experienceRequired.raw) continue
    lines.push(item.startsWith('- ') ? item : `- ${item}`)
  }

  return lines.join('\n') || null
}

const parseJobCard = ({ headingTitle, bodyHtml, activeBodyHtml, applyHref }) => {
  const tokens = tokenizeBody(activeBodyHtml)

  let title = null
  let qualification = null
  let experienceValue = null
  let experienceRawLine = null
  let responsibilityIntro = null
  const responsibilityItems = []
  const requiredSkills = []
  let inResponsibilities = false
  let inSkills = false

  for (const token of tokens) {
    if (token.type === 'p') {
      const text = token.text
      const designation = extractDesignationValue(text)
      const qualificationValue = extractQualificationValue(text)
      const experience = extractExperienceValue(text)

      if (designation) {
        title = normalizeTitle(designation)
      }

      if (qualificationValue) {
        qualification = qualificationValue
      }

      if (experience) {
        experienceValue = experience
        experienceRawLine = text
        if (inResponsibilities) {
          responsibilityItems.push(text)
        }
      }

      if (designation || qualificationValue || experience) continue

      if (/^broad responsibilities?:?$/i.test(text) || /^broad responsibility:?$/i.test(text)) {
        responsibilityIntro = 'Broad Responsibilities'
        inResponsibilities = true
        inSkills = false
        continue
      }

      if (/^job specific skills:?$/i.test(text)) {
        inResponsibilities = false
        inSkills = true
        continue
      }

      if (inResponsibilities && text) {
        responsibilityItems.push(text.replace(/^-+\s*/, '- '))
      }

      continue
    }

    if (token.type === 'ul') {
      if (inSkills) {
        requiredSkills.push(...token.items)
        continue
      }

      if (inResponsibilities) {
        responsibilityItems.push(...token.items)
      }
    }
  }

  const normalizedTitle = normalizeTitle(title || headingTitle)
  const applyUrl = toAbsoluteUrl(applyHref, CAREERS_URL)
  const jobId = buildJobId(normalizedTitle)

  if(applyUrl!==APPLY_URL)throw Object.assign(Error('Precision Precast native application route is not the advertised first-party form'),{abortRetries:true})
  if (!normalizedTitle || !applyUrl || !jobId) {
    throw new Error('Precision Precast Solutions careers surface no longer exposes stable public job fields')
  }

  return {
    title: normalizedTitle,
    company: COMPANY,
    location: null,
    city: null,
    country: null,
    jobId,
    requisitionId: null,
    sourceUrl: CAREERS_URL,
    applyUrl,
    employmentType: 'Full-time',
    experienceRequired: experienceValue,
    minimumQualification: qualification,
    preferredQualification: null,
    requiredSkills,
    postingDate: null,
    closingDate: null,
    jobDescription: stripTags(activeBodyHtml),
    rawNativeRoleEvidence:{headingTitle,designation:normalizedTitle,descriptionHtml:bodyHtml,nativeRequisitionId:null,identityQualified:true,applicationSubmissionQualified:false},
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*PPS - Precision Precast Solutions\s*<\/title>/i.test(page)
    && text.includes('Precision Precast Solutions Private Limited (PPS) is an Integrated Engineering consultancy company in the AEC segment')
    && text.includes('since our inception in June 2004 in Pune, India')
    && /marketing@ppspl\.in/i.test(page)
    && /href=["'](?:https:\/\/ppspl\.com\/|\/)?career\.php["']/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*PPS - Precision Precast Solutions\s*<\/title>/i.test(page)
    && /id=["']our-values-accordion["']/i.test(page)
    && /href=["']resume\.php["']/i.test(page)
    && /action=["']resume_email\.php["']/i.test(page)
    && text.includes('CLICK HERE TO FILL THE DETAILED FORM')
    && text.includes('SUBMIT YOUR RESUME')
    && /Designation\s*[-:]/i.test(text)
    && text.includes('Benefits')
}

export const extractPublicJobs = (html) => {
  const page = stripHtmlComments(String(html ?? ''))
  const jobs = []
  const doc=readVisibleNativeDocument(page,{strict:true}),within=(n,p)=>n.inert?[]:[...(p(n)?[n]:[]),...n.children.filter(c=>typeof c!=='string').flatMap(c=>within(c,p))]
  const cards=doc.nodes(n=>doc.hasClass(n,'card')).filter(n=>within(n,b=>b.tag==='button').some(b=>!/^benefits$/i.test(doc.text(b)))),bodies=new Map()
  const escape=value=>String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')
  const render=n=>typeof n==='string'?n:n.inert||['script','style'].includes(n.tag)||doc.hasClass(n,'general-btn')?'':'<'+n.tag+Object.entries(n.attrs).map(([k,v])=>' '+k+'="'+escape(v)+'"').join('')+'>'+n.children.map(render).join('')+'</'+n.tag+'>'
  for(const card of cards){const buttons=within(card,n=>n.tag==='button'),body=within(card,n=>doc.hasClass(n,'card-body')),title=buttons.length===1?normalizeTitle(doc.text(buttons[0])):null;if(!title||body.length!==1||bodies.has(title))throw Object.assign(Error('Precision Precast active role body/heading binding changed'),{abortRetries:true});bodies.set(title,render(body[0]))}

  for (const match of page.matchAll(
    /<div class="card">\s*<div class="card-header[\s\S]*?<button[^>]*>([\s\S]*?)<\/button>[\s\S]*?<div id="collapse[^"]*" class="collapse[\s\S]*?<div class="card-body">\s*([\s\S]*?)\s*<div class="general-btn[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>\s*Apply Now\s*<\/a>/gi,
  )) {
    const headingTitle = normalizeTitle(stripTags(match[1]))
    if (!headingTitle || /^benefits$/i.test(headingTitle)) continue

    jobs.push(parseJobCard({
      headingTitle,
      bodyHtml: match[2],
      activeBodyHtml:bodies.get(headingTitle),
      applyHref: match[3],
    }))
  }

  if (jobs.length === 0) {
    throw new Error('Precision Precast Solutions verified public careers surface returned no public jobs')
  }
  if(cards.length!==jobs.length)throw Object.assign(Error('Precision Precast inactive/ambiguous role inventory binding'),{abortRetries:true})
  for(const card of cards){const buttons=within(card,n=>n.tag==='button'),target=buttons[0]?.attrs['data-target'];if(buttons.length!==1||!/^#[\w-]+$/.test(target||'')||within(card,n=>n.attrs.id===target.slice(1)&&doc.hasClass(n,'collapse')).length!==1||doc.nodes(n=>n.attrs.id===target.slice(1)).length!==1)throw Object.assign(Error('Precision Precast role control/panel identity binding changed'),{abortRetries:true})}

  return jobs
}

const defaultFetchText = async (url,{signal}={}) => {
 const request=new URL(url),surface=CAREERS_URL
 const fail=(message,fields={})=>{throw Object.assign(Error('precisionprecastsolutions native input: '+message),{abortRetries:true,...fields,inventoryEvidence:{status:'coverage-gap',surface,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null}})}
 signal?.throwIfAborted()
 let response;try{response=await fetch(url,{headers:{'User-Agent':USER_AGENT,Accept:'text/html,application/javascript,application/json;q=0.9,*/*;q=0.8'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)})}catch(error){if(signal?.aborted)throw signal.reason;fail(error.message,{cause:error})}
 if(!response.ok){await response.body?.cancel();fail('HTTP '+response.status,{status:response.status,code:[401,403].includes(response.status)?'access_denied':'native_unavailable',finalUrl:response.url})}
 const final=new URL(response.url||url),samePath=final.pathname.replace(/\/$/,'')===request.pathname.replace(/\/$/,'')
 if(final.origin!==request.origin||!samePath||final.search!==request.search){await response.body?.cancel();fail('unexpected native redirect',{status:response.status,finalUrl:response.url})}
 const body=await response.text();signal?.throwIfAborted();if(/<title\b[^>]*>\s*(?:Access\s*Denied|Forbidden)\s*<\/title>|<Code>\s*AccessDenied\s*<\/Code>/i.test(body))fail('native access denial returned HTTP200',{status:response.status,code:'access_denied',finalUrl:response.url});return body
}

const buildNormalizedJob = (job, now) => {
  const normalized = normalizeScrapedJob({
    ...job,
    source: SOURCE,
    companyCareerPage: CAREERS_URL,
    companyDomain: COMPANY_DOMAIN,
    atsPlatform: ATS_PLATFORM,
    scrapedAt: now(),
  }, {
    companyName: COMPANY,
    companyCareerPage: CAREERS_URL,
    companyDomain: COMPANY_DOMAIN,
    atsPlatform: ATS_PLATFORM,
    countryFilter: null,
  })

  return {
    ...normalized,
    link: normalized.applyUrl || normalized.sourceUrl,
  }
}

export const createPrecisionPrecastSolutionsScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now: overrideNow, signal,
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL,{signal})
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Precision Precast Solutions verified official homepage no longer matches the known first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL,{signal})
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Precision Precast Solutions verified public careers surface no longer matches the known first-party jobs page')
    }

    const timestampFactory = overrideNow || now
    const result=extractPublicJobs(careersHtml).map((job) => ({...buildNormalizedJob(job,timestampFactory),country:null,location:job.location,city:job.city}))
    return finishNativeCollection(result,{now:timestampFactory,pagesFetched:2,roleOwnedWorkplacePresent:false})
  },
})

const finishNativeCollection=(jobs,{observedListingCount=jobs.length,pagesFetched=1,now=()=>new Date().toISOString(),...extra}={})=>{
 const failures=jobs.filter(j=>!j.jobDescription||j.rawNativeRoleEvidence?.identityQualified===false).map(j=>({stage:'native-detail',nativeRoleId:j.jobId??j.sourceUrl,kind:j.rawNativeRoleEvidence?.identityQualified===false?'identity-conflict':'missing-content'}))
 const audit={source:'precisionprecastsolutions',observedListingCount,candidateDetails:observedListingCount,extractedDetailJobs:jobs.length-failures.length,excludedDetailJobs:0,failures,reportedTotal:null,indiaFacetCount:null,listingPaginationComplete:null,closingInventoryMatches:null,sourceScopeComplete:false,observedMissingWorkplaces:jobs.filter(j=>!j.location).length,observedUnknownCountries:jobs.filter(j=>!j.country).length,rawProvenanceLimit:'Observed native rows only; employer-wide scope, exact India count, closing inventory and active application submission remain unqualified',...extra}
 for(const job of jobs){job.sourceListingComplete=false;job.sourceDetailComplete=Boolean(job.jobDescription)&&job.rawNativeRoleEvidence?.identityQualified!==false}
 if(jobs.length)jobs[0].nativeCollectionEvidence=audit
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit})
 return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS_URL,firstParty:true,listingComplete:false,pagesFetched,reportedTotal:null,indiaFacetCount:null,verifiedAt:now(),reason:'observed-native-subset-with-unqualified-employer-scope'})
}

export const run = async (options = {}) => createPrecisionPrecastSolutionsScraper().run(options)

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
