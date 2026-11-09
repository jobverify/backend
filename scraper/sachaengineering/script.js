import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { nativeCountryName, nativeLocationCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'sachaengineering'
export const COMPANY = 'SACHA Engineering'
export const COMPANY_DOMAIN = 'sacha.group'
export const HOMEPAGE_URL = 'https://sacha.group/'
export const CAREERS_URL = 'https://sacha.group/careers/'
export const BELL_COMPANY_URL = 'https://bell.careers/company/sacha'
export const BELL_JOBS_URL = 'https://bell.careers/company/sacha?tab=jobs'
export const BELL_COMPANY_API_URL = 'https://api.bell.careers/api/company/companies/sacha/'

const ATS_PLATFORM = 'bell-careers-via-first-party-company-handoff'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&#039;|&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ldquo;|&rdquo;|&quot;/gi, '"')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(value)
    .replace(/\u00a0|\u202f/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|\/section)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
) || ''

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'full_time' || normalized === 'full-time' || normalized === 'full time') {
    return 'Full-time'
  }
  if (normalized === 'part_time' || normalized === 'part-time' || normalized === 'part time') {
    return 'Part-time'
  }
  return normalized
    .split(/[\s_-]+/)
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join('-')
}

const normalizeExperience = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/years?/i.test(normalized)) return normalized
  if (/^\d+\s*-\s*\d+$/.test(normalized)) return `${normalized} Years`
  return normalized
}

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

const splitSkills = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return []

  return [...new Set(
    normalized
      .split(',')
      .map((part) => normalizeWhitespace(part))
      .filter(Boolean),
  )]
}

const inferRemoteStatus = (description) => {
  const normalized = normalizeWhitespace(description)?.toLowerCase()
  if (!normalized) return null
  if (/\bhybrid\b/.test(normalized)) return 'Hybrid'
  if (/\bremote\b/.test(normalized)) return 'Remote'
  return null
}

const nativeLocationFailure = message => Object.assign(Error('SACHA Engineering native workplace: '+message), {abortRetries:true})
const explicitCountry = value => {
  const parts=value.split(',').map(part=>part.trim())
  const countries=parts.filter(part=>part.length>2).map(nativeCountryName).filter(Boolean)
  if(new Set(countries).size>1)throw nativeLocationFailure('conflicting explicit countries')
  return parts.at(-1).length>2?nativeLocationCountryName(value):null
}
const roleWorkplace = (description,expectedTitle) => {
  const text=normalizeWhitespace(description)||'',values=[],unresolved=[]
  const titleKey=value=>(normalizeWhitespace(value)||'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'')
  const summaryIndex=text.search(/\bJob Summary\b/i),prefix=summaryIndex<0?'':text.slice(0,summaryIndex)
  const prefixOK=!prefix||['jobdescription',titleKey(expectedTitle),titleKey(expectedTitle)+'jobdescription'].includes(titleKey(prefix))
  const advertised=text.match(/^(.+?\bis hiring)\s*[–—:-]\s*(.+?)(?=\s+(?:Work )?Location\s*:)/i)
  const titleConflict=advertised&&titleKey(advertised[2])!==titleKey(expectedTitle)||summaryIndex>=0&&!prefixOK
  const add=(rawLabel,statement,kind)=>{
    const label=rawLabel.replace(/(?:,?\s+within|,\s+in the)\b[\s\S]*$/i,'')
      .replace(/\s+and (?:have|possess|bring|contribute|support)\b[\s\S]*$/i,'').trim()
    if(!label)return
    if(titleConflict){unresolved.push({location:null,country:null,rawLabel:label,statement,kind:'unmatched-advertised-role-title',advertisedTitle:advertised?.[2]??prefix});return}
    if(/^Any\b/i.test(label)||/^(?:[A-Z]{2,4}\s*[/|]\s*)+[A-Z]{2,4}$/.test(label)){
      unresolved.push({location:null,country:null,rawLabel:label,statement,kind:'unresolved-native-office-scope'});return
    }
    const range=label.match(/^one of our multiple locations across ([A-Za-z ]+), including (.+)$/i)
    if(range){values.push({location:label,rawLabel:label,country:nativeCountryName(range[1]),multi:true,statement,kind});return}
    const remote=label.match(/^Remote\s*[/,]\s*([A-Za-z ]+)$/i),pan=/^Pan India$/i.test(label)
    if(remote||pan){values.push({location:label,rawLabel:label,country:pan?'India':nativeCountryName(remote[1]),multi:true,statement,kind});return}
    if(/^(?:a|an|the|one)\b/i.test(label)||/\b(?:industry|environment|work mode|workplace|onsite role|remote role|hybrid role|sector)\b/i.test(label))return
    if(!/^[\p{Lu}][\p{L}\p{M} ',()&/-]{2,180}$/u.test(label))return
    values.push({location:label,rawLabel:label,country:explicitCountry(label),multi:/[;&|]|\s+and\s+/i.test(label),statement,kind})
  }
  for(const match of text.matchAll(/\b(?:Work )?Location\s*:\s*([\s\S]+?)(?=\s+(?:(?:Experience|Education|Designation|Communication|Notice Period|Shift(?: Timing)?|UK Shift|US Shift|Salary|Budget|Role|NP|JD)\s*:|Key Responsibilities\b)|$)/gi)){
    const before=text.slice(0,match.index),bodyStart=text.search(/\b(?:Key Responsibilities|Required Skills|What We Offer|Responsibilities)\b/i)
    if(/(?:corporate contact|contact|headquarters|office address|company address)\s*$/i.test(before))continue
    if(bodyStart>=0&&match.index>bodyStart&&!/\bAdditional Info\b/i.test(before)&&!/^Work Location/i.test(match[0])){
      unresolved.push({location:null,country:null,rawLabel:match[1].trim(),statement:match[0],kind:'unreviewed-role-footer-location'});continue
    }
    add(match[1],match[0],'labeled-role-workplace')
  }
  if(summaryIndex>=0&&prefixOK){
    const summary=text.slice(summaryIndex).split(/\b(?:Key Responsibilities|Required Skills|What We Offer|Responsibilities)\b/i)[0]
    for(const match of summary.matchAll(/\bjoin our(?: [\p{L}/&-]+){0,4} team in ([^.!?]+)(?:[.!?]|$)/giu))add(match[1],match[0],'role-summary-team-workplace')
    for(const match of summary.matchAll(/\bteam\b[^.!?]{0,120},\s*located in ([^.!?]+)(?:[.!?]|$)/gi))add(match[1],match[0],'role-summary-located-team')
    for(const match of summary.matchAll(/\b(?:the ideal candidate|the successful candidate|the candidate|this role|this position|you) (?:will be|is|are) based in ([^.!?]+)(?:[.!?]|$)/gi))add(match[1],match[0],'role-summary-candidate-workplace')
    for(const match of summary.matchAll(/\bremote position open to candidates located throughout (Pan India)\b/gi))add(match[1],match[0],'explicit-remote-country-eligibility')
  }
  if(values.length>1||values.length&&unresolved.length)throw nativeLocationFailure('ambiguous duplicate role workplaces')
  return values[0]||unresolved[0]||null
}
const parseBellLocation = (value, description, title) => {
  const typed=normalizeWhitespace(value),declared=roleWorkplace(description,title)
  const field=typed&&!/^none$/i.test(typed)?typed:null
  if(field&&declared&&(!declared.location||field.toLowerCase()!==declared.location.toLowerCase()))throw nativeLocationFailure('conflicting typed and role-summary workplaces')
  const location=field||declared?.location||null
  if(!location)return{location:null,city:null,country:null}
  const country=field?explicitCountry(field):declared.country
  const city=declared?.multi||/[|;&/]|\s+and\s+/i.test(location)||country&&nativeCountryName(location)===country
    ?null:normalizeWhitespace(location.split(',')[0])
  return{location,city,country}
}

const decodeFlightChunk = (value) => {
  const literal = `"${String(value ?? '')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')}"`

  try {
    return JSON.parse(literal)
  } catch {
    return null
  }
}

const extractFlightChunks = (html) =>
  [...String(html ?? '').matchAll(/self\.__next_f\.push\(\[1,"((?:\\.|[^"])*)"\]\)/g)]
    .map((match) => decodeFlightChunk(match[1]))
    .filter(Boolean)

const extractBellPayload = (chunks) => {
  const payloadChunk = chunks.find((chunk) =>
    chunk.startsWith('{')
    && chunk.includes('"name":"SACHA Engineering"')
    && chunk.includes(`"url":"${BELL_COMPANY_URL}"`)
    && chunk.includes('"job_posts":['),
  )

  if (!payloadChunk) {
    throw new Error('SACHA Engineering verified Bell company jobs payload is missing from the public page')
  }

  let payload
  try {
    payload = JSON.parse(payloadChunk)
  } catch {
    throw new Error('SACHA Engineering verified Bell company jobs payload is no longer valid JSON')
  }

  if (payload?.name !== COMPANY || !Array.isArray(payload?.job_posts)) {
    throw new Error('SACHA Engineering verified Bell company jobs payload no longer matches the expected company identity')
  }

  return payload
}

const extractDescriptionMap = (chunks, jobs) => {
  const wantedTokens = new Set(
    jobs
      .map((job) => normalizeWhitespace(job?.description)?.replace(/^\$/, '').toLowerCase())
      .filter(Boolean),
  )

  const descriptions = new Map()
  let pendingToken = null

  for (const chunk of chunks) {
    const tokenMatch = chunk.match(/^([0-9a-f]+):T[0-9a-f]+,$/i)
    if (tokenMatch) {
      const token = tokenMatch[1].toLowerCase()
      pendingToken = wantedTokens.has(token) ? token : null
      continue
    }

    if (pendingToken) {
      const text = normalizeWhitespace(chunk)
      if (text) {
        descriptions.set(pendingToken, text)
      }
      pendingToken = null
    }
  }

  return descriptions
}

const normalizeBellJobDescription = (description, descriptions = null) => {
  const descriptionKey = normalizeWhitespace(description)?.replace(/^\$/, '').toLowerCase()
  if (descriptionKey && descriptions?.has(descriptionKey)) {
    return descriptions.get(descriptionKey) || null
  }

  return normalizeWhitespace(description)
}

const normalizeBellJobPosts = (jobPosts, { descriptions = null } = {}) => {
  const normalizedJobs = jobPosts.map((job) => {
    const title = normalizeWhitespace(job?.job_post_title)
    const postId = normalizeWhitespace(job?.post_id)
    const jobDescription = normalizeBellJobDescription(job?.description, descriptions)
    const location = parseBellLocation(job?.location, jobDescription, title)

    if (!title || !postId) {
      return null
    }

    return {
      jobId: `${SOURCE}-${postId}`,
      requisitionId: String(postId),
      title,
      company: COMPANY,
      department: null,
      location: location.location,
      city: location.city,
      country: location.country,
      sourceUrl: BELL_JOBS_URL,
      applyUrl: BELL_JOBS_URL,
      employmentType: normalizeEmploymentType(job?.job_type),
      experienceRequired: normalizeExperience(job?.experience_level),
      minimumQualification: normalizeWhitespace(job?.qualifications),
      preferredQualification: null,
      requiredSkills: splitSkills(job?.skills),
      postingDate: normalizeDate(job?.published_date || job?.date),
      closingDate: null,
      jobDescription,
      remoteStatus: inferRemoteStatus(jobDescription),
    }
  }).filter(Boolean)

  if (jobPosts.length > 0 && normalizedJobs.length === 0) {
    throw new Error('SACHA Engineering verified Bell company jobs payload no longer produces normalized openings')
  }

  return normalizedJobs
}

const parseBellCompanyApiPage = (payloadValue) => {
  let payload = payloadValue
  if (typeof payloadValue === 'string') {
    try {
      payload = JSON.parse(payloadValue)
    } catch {
      throw new Error('SACHA Engineering Bell company API payload is no longer valid JSON')
    }
  }

  let website
  try { website = new URL(payload?.results?.website) } catch {}
  if (payload?.results?.id !== 1 || payload?.results?.name !== COMPANY || website?.hostname !== COMPANY_DOMAIN || !Array.isArray(payload?.results?.job_posts)) {
    throw new Error('SACHA Engineering Bell company API payload no longer matches the expected company identity')
  }

  return payload
}

const fetchBellCompanyApiJobPosts = async (fetchBellCompanyApiPage, initialUrl = BELL_COMPANY_API_URL, signal) => {
  const allJobPosts = []
  const seenPostIds = new Set()
  let nextUrl = initialUrl
  const seenPages = new Set(), reportedCounts = new Set()

  while (nextUrl) {
    signal?.throwIfAborted()
    const url = new URL(nextUrl)
    if(url.origin!==new URL(BELL_COMPANY_API_URL).origin||url.pathname!==new URL(BELL_COMPANY_API_URL).pathname
      ||url.hash||url.username||url.password||[...url.searchParams.keys()].some(key=>key!=='page')
      ||url.searchParams.getAll('page').length>1||url.search&& !/^[1-9]\d*$/.test(url.searchParams.get('page')||'')
      ||seenPages.has(nextUrl)||seenPages.size>=50)throw nativeLocationFailure('unbound, cyclic or excessive native pagination')
    seenPages.add(nextUrl)
    const payloadValue = await fetchBellCompanyApiPage(nextUrl, {signal})
    signal?.throwIfAborted()
    const payload = parseBellCompanyApiPage(payloadValue)
    if(payload.count!=null){if(!Number.isSafeInteger(payload.count)||payload.count<0)throw nativeLocationFailure('invalid reported native count');reportedCounts.add(payload.count)}
    if(reportedCounts.size>1)throw nativeLocationFailure('reported native count changed across pages')

    for (const jobPost of payload.results.job_posts) {
      const postId = normalizeWhitespace(jobPost?.post_id)
      if (!postId || seenPostIds.has(postId)) {
        throw nativeLocationFailure('missing or duplicate native role identity')
      }

      seenPostIds.add(postId)
      allJobPosts.push(jobPost)
    }

    nextUrl = payload.next ? new URL(payload.next, BELL_COMPANY_API_URL).toString() : null
  }

  return {jobPosts:allJobPosts,apiPages:seenPages.size,nativeReportedCount:[...reportedCounts][0]??null}
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)
  const visible = readVisibleNativeDocument(page,{strict:true})

  return (
    /<title>\s*SACHA Group \| Innovative Engineering &amp; Digital Solutions\s*<\/title>/i.test(page)
    && /<link rel="canonical" href="https:\/\/sacha\.group\/"\s*\/?>/i.test(page)
    && /Discover SACHA Group'?s expertise in delivering advanced engineering, IT, and digital innovation services/i.test(text)
    && visible.nodes(node=>node.tag==='a'&&['/careers/',CAREERS_URL,BELL_JOBS_URL].includes(node.attrs.href)&&visible.text(node)).length>0
    && (
      /href=["']\/careers\/["']/i.test(page)
      || /href=["']https:\/\/sacha\.group\/careers\/["']/i.test(page)
      || /href=["']https:\/\/bell\.careers\/company\/sacha\?tab=jobs["']/i.test(page)
    )
  )
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)
  const visible = readVisibleNativeDocument(page,{strict:true})

  return (
    /<title>\s*Careers - SACHA\s*<\/title>/i.test(page)
    && /<link rel="canonical" href="https:\/\/sacha\.group\/careers\/"\s*\/?>/i.test(page)
    && /Career Search/i.test(text)
    && /Current openings/i.test(text)
    && /bell\.careers\/company\/sacha\?tab=jobs/i.test(page)
    && /bell\.careers\/upload-cv/i.test(page)
    && visible.nodes(node=>node.tag==='a'&&node.attrs.href===BELL_JOBS_URL&&visible.text(node)).length>0
  )
}

export const hasVerifiedBellJobsSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return (
    /<title>\s*SACHA Engineering - (?:Bell Careers|bell\.careers)\s*<\/title>/i.test(page)
    && /<link rel="canonical" href="https:\/\/bell\.careers\/company\/sacha"\s*\/?>/i.test(page)
    && /SACHA Engineering/i.test(text)
    && /job_posts/i.test(page)
  )
}

export const extractBellJobPosts = (html) => {
  if (!hasVerifiedBellJobsSignal(html)) {
    throw new Error('SACHA Engineering verified Bell company jobs payload no longer matches the known public surface')
  }

  const chunks = extractFlightChunks(html)
  const payload = extractBellPayload(chunks)
  const descriptions = extractDescriptionMap(chunks, payload.job_posts)
  return normalizeBellJobPosts(payload.job_posts, { descriptions })
}

const defaultFetchText = (url, {signal} = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchBellCompanyApiPage = (url, {signal} = {}) => fetchJsonWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-bell-api`,
  timeoutMs: 15000,
})

export const createSachaEngineeringScraper = ({
  fetchText = defaultFetchText,
  fetchBellCompanyApiPage = defaultFetchBellCompanyApiPage,
  now = () => new Date().toISOString(),
} = {}) => ({
  run: async ({ fetchText: overrideFetchText, fetchBellCompanyApiPage: overrideFetchBellCompanyApiPage, now: overrideNow, signal } = {}) => {
    signal?.throwIfAborted()
    const fetchImpl = overrideFetchText || fetchText
    const fetchBellApiPageImpl = overrideFetchBellCompanyApiPage || overrideFetchText || fetchBellCompanyApiPage

    const homepageHtml = await fetchImpl(HOMEPAGE_URL,{signal})
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('SACHA Engineering verified official homepage no longer matches the known first-party surface')
    }

    const careersHtml = await fetchImpl(CAREERS_URL,{signal})
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('SACHA Engineering verified official careers handoff no longer matches the known first-party Bell surface')
    }

    const bellJobsHtml = await fetchImpl(BELL_JOBS_URL,{signal})
    const scrapedAt = (overrideNow || now)()

    if (!hasVerifiedBellJobsSignal(bellJobsHtml)) {
      throw new Error('SACHA Engineering verified Bell company jobs payload no longer matches the known public surface')
    }

    const collection = await fetchBellCompanyApiJobPosts(fetchBellApiPageImpl,BELL_COMPANY_API_URL,signal)
    const bellApiJobPosts=collection.jobPosts,byId=new Map(bellApiJobPosts.map(job=>[String(job.post_id),job]))

    const result = normalizeBellJobPosts(bellApiJobPosts)
      .map((job) => ({
      ...job,
      source: SOURCE,
      companyCareerPage: CAREERS_URL,
      companyDomain: COMPANY_DOMAIN,
      atsPlatform: ATS_PLATFORM,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
      sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
      sourceDetailComplete:Boolean(job.jobDescription),
      nativeLocationEvidence:{nativeRoleId:byId.get(job.requisitionId).post_id,locationField:byId.get(job.requisitionId).location??null,
        currency:byId.get(job.requisitionId).currency??null,roleSummaryStatement:roleWorkplace(job.jobDescription,job.title)?.statement??null,
        roleWorkplaceEvidence:roleWorkplace(job.jobDescription,job.title),
        countryQualified:Boolean(job.country),currencyIsCountryEvidence:false},
      nativePublicationDateRaw:byId.get(job.requisitionId).published_date||byId.get(job.requisitionId).date||null,
      }))
    const audit={source:SOURCE,observedListingCount:bellApiJobPosts.length,reportedTotal:null,indiaFacetCount:null,
      candidateDetails:bellApiJobPosts.length,extractedDetailJobs:result.filter(job=>job.sourceDetailComplete).length,excludedDetailJobs:0,
      failures:result.filter(job=>!job.sourceDetailComplete).map(job=>({stage:'native-detail',nativeRoleId:job.requisitionId,kind:'missing-content'})),
      listingPaginationComplete:null,closingInventoryMatches:null,sourceScopeComplete:false,nativeObservedRecordCount:bellApiJobPosts.length,
      nativeReportedRecordCount:collection.nativeReportedCount,nativeExplicitIndiaRoleCount:result.filter(job=>job.country==='India').length,
      nativeUnknownCountryRoleCount:result.filter(job=>!job.country).length,nativeMissingWorkplaceCount:result.filter(job=>!job.location).length,
      authoritativeIndiaTotalUnknown:true,closingCohortValidated:false}
    if(result.length)result[0].nativeCollectionEvidence=audit
    Object.defineProperty(result,'nativeCollectionEvidence',{value:audit})
    signal?.throwIfAborted()
    return attachInventoryEvidence(result,{status:'coverage-gap',surface:BELL_COMPANY_API_URL,firstParty:true,listingComplete:false,
      pagesFetched:3+collection.apiPages,reportedTotal:null,indiaFacetCount:null,verifiedAt:scrapedAt,
      reason:'Bound public employer feed retained without salary-currency country inference. '+result.filter(job=>!job.country).length+' role countries and '+result.filter(job=>!job.location).length+' workplaces remain unknown; exact India scope, per-role application and closing proof remain unqualified.'})
  },
})

export const run = async (options = {}) => createSachaEngineeringScraper().run(options)

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
