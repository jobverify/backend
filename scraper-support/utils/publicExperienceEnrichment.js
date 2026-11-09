import { createBrowserFetchSession } from '../shared/browserFetch.js'
import {
  extractTextFromPdfBuffer,
  resolvePdfTextExtractionTimeoutMs,
} from '../shared/pdfText.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'
import { normalizeScrapedJob } from './normalizeScrapedJob.js'
import { resolveJobPublicationDate, sourcePublicationDateFields } from '../../src/utils/jobPublicationDate.js'
import { hasSourceDescription, getSourceDescription } from '../../src/utils/jobSourceContent.js'
import { publicPostingDescription, isExactPublicJobUrl } from '../../rewriting/publicPostingDescription.js'
import { visiblePostingProfile } from '../../rewriting/visiblePostingDescription.js'
import { ActiveNativeContentError, activeIframeSources, extractActiveDescription, readNativeDocument } from './activeNativeHtml.js'
import { normalizeLifecycleDate } from '../../src/utils/jobLifecycle.js'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const BROWSER_FALLBACK_WAIT_UNTIL = 'networkidle2'
const BROWSER_FALLBACK_SETTLE_TIME_MS = 3000
const DEFAULT_BROWSER_FALLBACK_SESSION_LIMIT = 4
const DEFAULT_PUBLIC_EXPERIENCE_FETCH_TIMEOUT_MS = 15 * 1000
const PDF_CONTENT_TYPE_PATTERN = /application\/pdf/i

const BLOCK_TAG_PATTERN = /<\/?(?:article|aside|blockquote|br|dd|div|dl|dt|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|section|table|tbody|td|tfoot|th|thead|tr|ul)\b[^>]*>/gi
const SKIP_HOSTNAMES = new Set([
  'example.com',
  'www.example.com',
  'example.org',
  'www.example.org',
  'example.net',
  'www.example.net',
  'localhost',
  '127.0.0.1',
])
const PROVIDER_CACHE_TTL_MS = 5 * 60 * 1000
const createProviderCaches = () => ({ oracle: new Map(), fountain: new Map(), ceipal: new Map() })

export class PublicExperienceFetchTimeoutError extends Error {
  constructor(url, timeoutMs) {
    super(`Public experience fetch timed out after ${timeoutMs}ms for ${url}`)
    this.name = 'PublicExperienceFetchTimeoutError'
    this.localTimeout = true
    this.failureKind = 'public_experience_fetch_timeout'
  }
}

export const resolvePublicExperienceFetchTimeoutMs = (
  value = process.env.PUBLIC_EXPERIENCE_FETCH_TIMEOUT_MS,
  fallback = DEFAULT_PUBLIC_EXPERIENCE_FETCH_TIMEOUT_MS,
) => {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return parsed
}

const getAbortReason = (signal, fallbackMessage) => (
  signal?.reason || new Error(fallbackMessage)
)

const throwIfAborted = (signal, fallbackMessage = 'Public experience enrichment aborted') => {
  if (signal?.aborted) {
    throw getAbortReason(signal, fallbackMessage)
  }
}

const createLinkedRequestSignal = ({
  url,
  timeoutMs,
  signal,
} = {}) => {
  if (
    (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
    && !signal
  ) {
    return { signal: undefined, dispose: () => {} }
  }

  const controller = new AbortController()
  let timeoutId = null
  let removeParentAbort = null

  const abort = (reason) => {
    if (!controller.signal.aborted) {
      controller.abort(reason)
    }
  }

  if (signal) {
    if (signal.aborted) {
      abort(getAbortReason(signal, 'Public experience enrichment aborted'))
    } else {
      const onParentAbort = () => {
        abort(getAbortReason(signal, 'Public experience enrichment aborted'))
      }
      signal.addEventListener('abort', onParentAbort, { once: true })
      removeParentAbort = () => signal.removeEventListener('abort', onParentAbort)
    }
  }

  if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      abort(new PublicExperienceFetchTimeoutError(url, timeoutMs))
    }, timeoutMs)
  }

  return {
    signal: controller.signal,
    dispose: () => {
      if (timeoutId) clearTimeout(timeoutId)
      if (removeParentAbort) removeParentAbort()
    },
  }
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const collapseSplitUppercaseHeadings = (value) => {
  let normalized = String(value ?? '')
  let previous = null

  while (normalized !== previous) {
    previous = normalized
    normalized = normalized.replace(/\b([A-Z])\s+([A-Z]{2,}\b)/g, '$1$2')
  }

  return normalized
}

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = collapseSplitUppercaseHeadings(decodeHtmlEntities(value))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeExistingPublicEvidenceValue = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(BLOCK_TAG_PATTERN, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const GENERIC_PUBLIC_JOB_SHELL_PATTERNS = [
  /\bgroup of locations\b/i,
  /\bcopy to clipboard\b/i,
  /\bsimilar jobs\b/i,
  /\bwork summary\b/i,
  /\bthis summary is generated by ai assist\b/i,
  /\bare you still with us\b/i,
  /\bbe the first to apply\b/i,
  /\bcareers loaded\b/i,
]

const TRAILING_JOB_SITE_CHROME_PATTERNS = [
  /\bapply now\b/i,
  /\bjob info\b/i,
  /\bcopy to clipboard\b/i,
  /\bsimilar jobs\b/i,
  /\bi am an employee\b/i,
  /\bpage [a-z0-9 .'"()_-]{0,120} loaded\b/i,
]

const JOB_SPECIFIC_APPLY_FLOW_PATTERNS = [
  /\bapply now\b/i,
  /\beasy apply\b/i,
  /\bstart your application\b/i,
  /\bpersonal information\b/i,
  /\bresume\b/i,
  /\bupload resume\b/i,
  /\bjob identification\b/i,
  /\bposting date\b/i,
  /\bapply before\b/i,
  /\bjob schedule\b/i,
  /\bjob category\b/i,
  /\bdegree level\b/i,
  /\blocations?\b/i,
  /\baddress\b/i,
]

const JOB_METADATA_SHELL_PATTERNS = [
  /\bjob snapshot\b/i,
  /\bjob id\b/i,
  /\bemployee type\b/i,
  /\bupdated date\b/i,
  /\bdepartment\b/i,
  /\bwork location\b/i,
  /\bbusiness unit\b/i,
  /\bfunction\b/i,
  /\bbranch\b/i,
  /\breference no\.?\b/i,
  /\brequisition id\b/i,
  /\bjob requisition id\b/i,
  /\bjob req id\b/i,
  /\bposting date\b/i,
  /\bjob schedule\b/i,
  /\bemployee status\b/i,
  /\bposition type\b/i,
  /\bcountry\/region\b/i,
]

const NO_DESCRIPTION_PLACEHOLDER_PATTERNS = [
  /\bno job description at the moment\b/i,
  /\bif the details spark your interest, feel free to go ahead and apply\b/i,
]

const GENERIC_JOB_SUMMARY_PATTERN = /\b(?:career|careers|job|jobs|apply|application|portal|opening|openings)\b/i

const EMPTY_SECTION_HEADING_TEMPLATE_LABELS = [
  'job objective',
  'essential job tasks',
  'areas of responsibility',
  'required qualifications',
  'work experience',
  'languages needed in position',
  'key interfaces- external',
  'key interfaces- internal',
  'behavioural competencies',
  'equal opportunities employment',
]

const looksLikeEmptySectionHeadingTemplate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return false

  const lowercase = normalized.toLowerCase()
  const matchedLabelRanges = EMPTY_SECTION_HEADING_TEMPLATE_LABELS
    .map((label) => {
      const index = lowercase.indexOf(label)
      return index === -1 ? null : [index, index + label.length]
    })
    .filter(Boolean)

  if (
    matchedLabelRanges.length < 6
    || !lowercase.includes('job objective')
    || !lowercase.includes('work experience')
    || !lowercase.includes('behavioural competencies')
  ) {
    return false
  }

  matchedLabelRanges.sort((left, right) => left[0] - right[0])
  const firstIndex = matchedLabelRanges[0][0]
  const lastIndex = matchedLabelRanges[matchedLabelRanges.length - 1][1]
  const clusteredText = lowercase.slice(firstIndex, lastIndex)
  const sentencePunctuationCount = (clusteredText.match(/[.:;](?=\s|$)/g) || []).length

  return (lastIndex - firstIndex) <= 420 && sentencePunctuationCount <= 2
}

const looksLikeAmritaCampusShell = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return false

  const lowercase = normalized.toLowerCase()
  const campusLabelMatches = lowercase.match(/\bcampus:\s*[a-z]/g) || []
  const exploreCampusMatches = lowercase.match(
    /\bexplore\s+(?:amaravati|amritapuri|bengaluru|chennai|coimbatore|kochi|mysuru|nagercoil)\b/g,
  ) || []

  return lowercase.includes('requirements of future employers')
    && lowercase.includes('amrita vishwa vidyapeetham')
    && (campusLabelMatches.length >= 2 || exploreCampusMatches.length >= 3)
}

const NAGARRO_MOTIVATIONAL_SHELL_PHRASES = [
  'by this point in your career, it is not just about the tech you know or how well you can code',
  'you have begun to prove your worth in our industry',
  'at nagarro, we love breaking new ground and doing unprecedented stuff',
]

const RESULT_NOTICE_SHELL_PATTERNS = [
  /\bnotice regarding list of provisionally shortlisted candidates\b/i,
  /\bprovisionally shortlisted candidates\b/i,
  /\bshortlisted candidates\b/i,
  /\binterview call letters?\b/i,
  /\binterview schedule\b/i,
  /\bappear in interview\b/i,
  /\bfinal result\b/i,
]

const looksLikeNagarroMotivationalShell = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return false

  const lowercase = normalized.toLowerCase()
  return NAGARRO_MOTIVATIONAL_SHELL_PHRASES.some((phrase) => lowercase.includes(phrase))
}

const looksLikeResultNoticeShell = (value) => countPatternHits(
  RESULT_NOTICE_SHELL_PATTERNS,
  value,
) >= 1

const looksLikeBlockingPublicJobShell = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return false
  if (/\bpage not found\b/i.test(normalized)) return true
  if (/\byou do not have access to this page\b/i.test(normalized)) return true
  if (/\binvalid url argument\b/i.test(normalized)) return true
  if (looksLikeResultNoticeShell(normalized)) return true
  if (looksLikeEmptySectionHeadingTemplate(normalized)) return true
  if (looksLikeAmritaCampusShell(normalized)) return true
  return false
}

const looksLikeHardGenericPublicJobShell = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return false
  if (looksLikeBlockingPublicJobShell(normalized)) return true
  if (looksLikeNagarroMotivationalShell(normalized)) return true
  return false
}

const looksLikeGenericPublicJobShell = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return false
  if (looksLikeHardGenericPublicJobShell(normalized)) return true

  let matchedSignals = 0
  for (const pattern of GENERIC_PUBLIC_JOB_SHELL_PATTERNS) {
    if (!pattern.test(normalized)) continue
    matchedSignals += 1
    if (matchedSignals >= 2) return true
  }

  return false
}

const looksLikeTruncatedPublicPreview = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return false

  return normalized.length <= 220 && /(?:\.\.\.|…)\s*$/.test(normalized)
}

const AVATURE_TRANSIENT_BROWSER_SHELL_MARKERS = [
  'Skip to content',
  'Apply now',
  'Required education',
  'Your role and responsibilities',
]

const looksLikeTransientBrowserRenderShell = (html, jobUrl = '') => {
  const rawHtml = String(html ?? '')
  if (!rawHtml) return false

  if (/(?:awswafcookiedomainlist|gokuprops|challenge\.js)/i.test(rawHtml)) {
    return true
  }

  const normalizedJobUrl = String(jobUrl ?? '')
  const looksLikeAvatureJobDetailShell =
    /avature\.portal\.page/i.test(rawHtml)
    && /(?:\/|^)JobDetail(?:[/?-]|$)/i.test(rawHtml + normalizedJobUrl)

  if (!looksLikeAvatureJobDetailShell) {
    return false
  }

  if (rawHtml.length >= 20000) {
    return false
  }

  return !AVATURE_TRANSIENT_BROWSER_SHELL_MARKERS.some((marker) => rawHtml.includes(marker))
}

const shouldWarmBrowserFallbackSession = (url) => {
  try {
    const parsed = new URL(String(url ?? ''))
    return parsed.hostname.toLowerCase() === 'careers.ibm.com'
      && /\/careers\/JobDetail/i.test(parsed.pathname)
  } catch {
    return false
  }
}

const hasSufficientPublicJobEvidence = (job = {}) => !shouldRefreshPublicJobEvidence(job)

const getExistingPublicEvidenceParts = (job = {}) => (
  [
    job.description,
    job.jobDescription,
    job.minimumQualification,
    job.preferredQualification,
  ]
    .map((value) => normalizeExistingPublicEvidenceValue(value))
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
)

const buildExistingPublicEvidence = (job = {}) => {
  const normalizedJob = normalizeScrapedJob(job, {
    source: job.source || null,
  })
  const experienceText = normalizeWhitespace(normalizedJob.experienceRequired)
  const descriptionText = normalizeWhitespace(
    getExistingPublicEvidenceParts(normalizedJob).join(' '),
  )
  const hasRichDescription = Boolean(
    descriptionText
    && descriptionText.length >= 200
    && !looksLikeGenericPublicJobShell(descriptionText),
  )

  return {
    experienceText,
    descriptionText,
    hasRichDescription,
  }
}

const shouldRefreshPublicJobEvidence = (job = {}) => {
  // A display summary or experience label cannot supply the immutable employer
  // description required by public visibility. Keep trying verified role-page
  // and provider recovery even when earlier enrichment produced display text.
  if (!hasSourceDescription(job)) return true

  const {
    experienceText,
    descriptionText,
    hasRichDescription,
  } = buildExistingPublicEvidence(job)
  const hasProviderVerifiedPublicEvidence =
    job.publicExperienceChecked === true
    && descriptionText
    && !looksLikeGenericPublicJobShell(descriptionText)
    && !looksLikeTruncatedPublicPreview(descriptionText)

  if (hasProviderVerifiedPublicEvidence) return false
  if (experienceText && hasRichDescription) return false

  if (!experienceText) return true
  return !descriptionText || descriptionText.length < 200
}

const escapeRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const extractFirst = (pattern, value) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? match[1] : null
}

const extractAttributeValue = (tag, attributeName) => {
  const escapedName = escapeRegex(attributeName)
  const doubleQuoted = extractFirst(new RegExp(`${escapedName}\\s*=\\s*"([^"]*)"`, 'i'), tag)
  if (doubleQuoted != null) return normalizeWhitespace(doubleQuoted)

  const singleQuoted = extractFirst(new RegExp(`${escapedName}\\s*=\\s*'([^']*)'`, 'i'), tag)
  if (singleQuoted != null) return normalizeWhitespace(singleQuoted)

  return null
}

const extractMetaContent = (key, html) => {
  for (const match of String(html ?? '').matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0]
    const property = extractAttributeValue(tag, 'property')
    const name = extractAttributeValue(tag, 'name')

    if (property !== key && name !== key) {
      continue
    }

    const content = extractAttributeValue(tag, 'content')
    if (content) {
      return content
    }
  }

  return null
}

const extractTitle = (html) => normalizeWhitespace(
  extractMetaContent('og:title', html)
    || extractFirst(/<title[^>]*>\s*([\s\S]*?)\s*<\/title>/i, html),
)

const extractPageSummary = (html) => normalizeWhitespace(
  extractMetaContent('og:description', html)
    || extractMetaContent('description', html),
)

const stripHtmlToText = (html) => normalizeWhitespace(
  String(html ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(BLOCK_TAG_PATTERN, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractLabeledExperience = (text) => {
  const normalized = normalizeWhitespace(text)
  if (!normalized) return null

  const experienceProfile = extractJobFilterSignals({
    description: normalized,
  })?.experienceProfile
  const evidence = normalizeWhitespace(experienceProfile?.evidence)

  if (!evidence || experienceProfile?.confidence !== 'high') {
    return null
  }

  return (
    (
      experienceProfile.minimumYears === 0
      && experienceProfile.maximumYears === 0
    )
      ? 'No experience required'
      : evidence
  )
}

const RELEVANT_JOB_CONTENT_PATTERN = /\b(job description|job summary|about job|about the role|qualifications?|requirements?|responsibilities|required skills|preferred qualifications?|preferred experience|expertise|what will you do|what are we looking for|what you can expect|what we'?re looking for|key job details|what you bring|roles?\s*&\s*responsibilities|key skills required|functional area|must-?have skills?|nice to have|key responsibilities|role overview|role objective|reporting to|technical skills|education mandatory|minimum eligibility|eligibility|organization|title\s*&\s*(?:no|number)\s*of posts|term of appointment|scale of pay|specific requirements|service(?:\/department)?|duration)\b/i

const trimTrailingJobSiteChrome = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  let cutoffIndex = normalized.length
  for (const pattern of TRAILING_JOB_SITE_CHROME_PATTERNS) {
    const match = pattern.exec(normalized)
    if (!match || match.index <= 40) continue
    cutoffIndex = Math.min(cutoffIndex, match.index)
  }

  return normalizeWhitespace(normalized.slice(0, cutoffIndex)) || normalized
}

const extractRelevantJobSectionText = (pageText) => {
  const normalized = normalizeWhitespace(pageText)
  if (!normalized) return null

  const match = RELEVANT_JOB_CONTENT_PATTERN.exec(normalized)
  if (!match) return null

  return trimTrailingJobSiteChrome(normalized.slice(match.index))
}

const hasRelevantJobContent = (pageText) => RELEVANT_JOB_CONTENT_PATTERN.test(pageText || '')

const getExistingDescriptionEvidence = (job = {}) => (
  getExistingPublicEvidenceParts(job)
    .join('\n\n')
)

const normalizeComparablePageUrl = (value) => {
  try {
    const parsed = new URL(String(value ?? ''))
    parsed.hash = ''
    const normalized = parsed.toString().replace(/\/$/, '')
    return normalized || null
  } catch {
    return null
  }
}

const SHARED_CAREERS_LISTING_SEGMENTS = new Set([
  'career',
  'careers',
  'apply-now',
  'current-opening',
  'current-openings',
  'job-opening',
  'job-openings',
  'jobs',
  'join-us',
  'openings',
  'vacancies',
  'vacancy',
  'work-with-us',
])

const isSharedCareersAtsPlatform = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase()
  return !normalized
    || normalized.startsWith('official-company-careers')
    || normalized === 'official-first-party-current-openings-page'
    || normalized === 'official-first-party-static-careers-page'
}

const looksLikeSharedCareersListingUrl = (value) => {
  try {
    const parsed = new URL(String(value ?? ''))
    const pathname = parsed.pathname.toLowerCase()
    if (
      /(?:^|\/)(?:apply-now|career|careers|current[_-]?openings?|job[_-]?openings?|jobs|join-us(?:-\d+)?|openings|vacanc(?:y|ies)|work-with-us)(?:\.html?)?$/i.test(pathname)
    ) {
      return true
    }

    const pathnameSegments = pathname
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean)
    const lastSegment = pathnameSegments[pathnameSegments.length - 1]
      ?.replace(/\.html?$/i, '')
      ?.replace(/[_-]+/g, '-')
    return Boolean(lastSegment && SHARED_CAREERS_LISTING_SEGMENTS.has(lastSegment))
  } catch {
    return false
  }
}

const looksLikePublicApplicationHandoffUrl = (value) => {
  try {
    const parsed = new URL(String(value ?? ''))
    const hostname = parsed.hostname.toLowerCase()
    const pathname = parsed.pathname.toLowerCase()
    if (hostname === 'forms.gle') return true
    if (hostname === 'docs.google.com' && pathname.startsWith('/forms/')) return true
    if (hostname.endsWith('.typeform.com') || hostname === 'typeform.com') return true
    if (hostname.endsWith('.jotform.com') || hostname === 'jotform.com') return true
    return false
  } catch {
    return false
  }
}

const looksLikeThinApplyShellUrl = (value) => {
  try {
    const parsed = new URL(String(value ?? ''))
    const pathname = parsed.pathname.toLowerCase()
    return /\/login(?:\/|$)/i.test(pathname)
      || /\/oneclick-ui\//i.test(pathname)
  } catch {
    return false
  }
}

const looksLikeHostedJobDetailUrl = (value) => {
  try {
    const parsed = new URL(String(value ?? ''))
    const hostname = parsed.hostname.toLowerCase()
    const pathname = parsed.pathname.toLowerCase()
    if (/skillate\.com$/i.test(hostname) && /^\/jobs\/[^/]+/i.test(pathname)) return true
    if (/zappyhire\.com$/i.test(hostname) && /\/apply$/i.test(pathname) && parsed.searchParams.get('job')) return true
    return false
  } catch {
    return false
  }
}

const looksLikeSharedCareersListingDescription = (value, title = null) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return false

  const hasCurrentOpeningsSignals =
    /\bcurrent openings\b/i.test(normalized)
    && (
      /\bselect the team\b/i.test(normalized)
      || /\bselect the location\b/i.test(normalized)
      || (/\bteam\s*:/i.test(normalized) && /\blocation\s*:/i.test(normalized))
    )
  if (hasCurrentOpeningsSignals) return true

  const normalizedTitle = normalizeWhitespace(title)
  return Boolean(
    normalizedTitle
    && /\bofficial\b/i.test(normalized)
    && /\bopening published on the first-party apply form\b/i.test(normalized)
    && textContainsComparable(normalized, normalizedTitle),
  )
}

const isSamePublicPage = (left, right) => {
  const normalizedLeft = normalizeComparablePageUrl(left)
  const normalizedRight = normalizeComparablePageUrl(right)
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight)
}

const hasVerifiedExistingPublicDescription = (job = {}) => {
  const descriptionText = getExistingDescriptionEvidence(job)
  if (!descriptionText || descriptionText.length < 200) return false
  if (looksLikeGenericPublicJobShell(descriptionText)) return false
  if (looksLikeMultiJobListingPage(descriptionText)) return false
  return hasRelevantJobContent(descriptionText) || Boolean(extractLabeledExperience(descriptionText))
}

const hasVerifiedListingOnlyPublicSurface = (job = {}) => {
  const normalizedJob = normalizeScrapedJob(job, {
    source: job.source || null,
  })
  if (!isSharedCareersAtsPlatform(normalizedJob.atsPlatform)) return false
  if (!normalizedJob.title) return false

  const descriptionText = getExistingDescriptionEvidence(normalizedJob)
  const listingPageUrl = String(normalizedJob.companyCareerPage ?? normalizedJob.sourceUrl ?? '').trim()
  const hasSharedListingSurface =
    looksLikeSharedCareersListingUrl(listingPageUrl)
    || looksLikeSharedCareersListingDescription(descriptionText, normalizedJob.title)
  if (!hasSharedListingSurface) return false

  const applyUrl = String(normalizedJob.applyUrl ?? normalizedJob.sourceUrl ?? '').trim()
  const applyStaysOnListingPage = /^mailto:/i.test(applyUrl)
    || isSamePublicPage(applyUrl, listingPageUrl)
    || looksLikePublicApplicationHandoffUrl(applyUrl)
  if (!applyStaysOnListingPage) return false

  return !extractLabeledExperience(descriptionText)
}

const promoteExistingPublicEvidence = (job = {}) => {
  if (job.publicExperienceChecked === true) return job

  if (hasVerifiedExistingPublicDescription(job)) {
    return {
      ...job,
      publicExperienceChecked: true,
    }
  }

  if (hasVerifiedListingOnlyPublicSurface(job)) {
    return {
      ...job,
      publicExperienceChecked: true,
    }
  }

  return job
}

const preserveListingOnlyPublicVerification = (originalJob = {}, baseJob = {}, candidateJob = {}) => {
  if (candidateJob.publicExperienceChecked === true) return candidateJob
  if (
    !normalizeWhitespace(candidateJob.experienceRequired)
    && hasVerifiedListingOnlyPublicSurface(candidateJob)
  ) {
    return {
      ...candidateJob,
      publicExperienceChecked: true,
    }
  }
  if (baseJob.publicExperienceChecked !== true) return candidateJob
  if (
    originalJob.publicExperienceChecked !== true
    && !normalizeWhitespace(candidateJob.experienceRequired)
  ) {
    return {
      ...candidateJob,
      publicExperienceChecked: true,
    }
  }
  if (!hasVerifiedListingOnlyPublicSurface(candidateJob)) return candidateJob
  return {
    ...candidateJob,
    publicExperienceChecked: true,
  }
}

const extractPrimaryHeading = (html) => normalizeWhitespace(
  extractFirst(/<h1[^>]*>\s*([\s\S]*?)\s*<\/h1>/i, html)
    || extractFirst(/<h2[^>]*>\s*([\s\S]*?)\s*<\/h2>/i, html)
    || extractFirst(/<h3[^>]*>\s*([\s\S]*?)\s*<\/h3>/i, html),
)

const normalizeComparableText = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  || null

const findComparableTextIndex = (haystack, needle) => {
  const normalizedHaystack = normalizeComparableText(haystack)
  const normalizedNeedle = normalizeComparableText(needle)
  if (!normalizedHaystack || !normalizedNeedle) return -1
  return normalizedHaystack.indexOf(normalizedNeedle)
}

const textContainsComparable = (haystack, needle) => {
  return findComparableTextIndex(haystack, needle) !== -1
}

const countMatches = (pattern, value) => {
  const matches = String(value ?? '').match(pattern)
  return matches ? matches.length : 0
}

const countPatternHits = (patterns, value) => patterns.reduce(
  (total, pattern) => total + (pattern.test(String(value ?? '')) ? 1 : 0),
  0,
)

const looksLikeNoDescriptionPlaceholder = (value) => countPatternHits(
  NO_DESCRIPTION_PLACEHOLDER_PATTERNS,
  value,
) >= 1

const looksLikeMultiJobListingPage = (pageText) => {
  const normalized = normalizeWhitespace(pageText)
  if (!normalized) return false

  return /\bcurrent openings\b/i.test(normalized)
    && /\bRole\b/i.test(normalized)
    && /\bJob Details Apply\b/i.test(normalized)
}

const defaultFetchText = async (url, {
  signal = null,
  timeoutMs = resolvePublicExperienceFetchTimeoutMs(),
  pdfTextExtractionTimeoutMs = resolvePdfTextExtractionTimeoutMs(),
  includeResponseMetadata = false,
} = {}) => {
  throwIfAborted(signal)
  const request = createLinkedRequestSignal({ url, timeoutMs, signal })
  let response

  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      ...(request.signal ? { signal: request.signal } : {}),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`)
    }

    const contentType = response.headers?.get?.('content-type') || ''
    let html
    if (PDF_CONTENT_TYPE_PATTERN.test(contentType) || /\.pdf(?:$|\?)/i.test(String(url))) {
      html = await extractTextFromPdfBuffer(await response.arrayBuffer(), {
        signal,
        timeoutMs: pdfTextExtractionTimeoutMs,
      })
    } else {
      html = await response.text()
    }

    return includeResponseMetadata ? { html, url: response.url, status: response.status } : html
  } finally {
    request.dispose()
  }
}

const defaultFetchJson = async (url, options = {}) => {
  const signal = options.signal || null
  const timeoutMs = options.fetchTimeoutMs ?? options.timeoutMs ?? resolvePublicExperienceFetchTimeoutMs()
  throwIfAborted(signal)
  const request = createLinkedRequestSignal({ url, timeoutMs, signal })
  let response

  try {
    response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json,text/plain,*/*',
        ...(options.headers || {}),
      },
      ...(options.body != null ? { body: options.body } : {}),
      ...(request.signal ? { signal: request.signal } : {}),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`)
    }

    const payload = await response.json()
    return options.includeResponseMetadata ? { payload, url: response.url, status: response.status } : payload
  } finally {
    request.dispose()
  }
}

const shouldSkipDefaultFetch = (jobUrl) => {
  try {
    const parsed = new URL(jobUrl)
    return SKIP_HOSTNAMES.has(parsed.hostname.toLowerCase()) || parsed.hostname.endsWith('.example')
  } catch {
    return true
  }
}

const toAbsoluteUrl = (value, baseUrl = null) => {
  try {
    return new URL(String(value ?? ''), baseUrl || undefined).toString()
  } catch {
    return null
  }
}

const shouldPreferApplyUrl = (job = {}) => {
  const applyUrl = normalizeWhitespace(job.applyUrl)
  const sourceUrl = normalizeWhitespace(job.sourceUrl)
  if (!applyUrl) return false
  if (!sourceUrl) return true
  if (isSamePublicPage(applyUrl, sourceUrl)) return false
  if (looksLikeThinApplyShellUrl(applyUrl)) return false
  if (looksLikeHostedJobDetailUrl(applyUrl)) return true
  return looksLikeSharedCareersListingUrl(sourceUrl)
    && !/^mailto:/i.test(applyUrl)
    && !looksLikePublicApplicationHandoffUrl(applyUrl)
}

export const resolvePublicJobUrl = (job = {}) => {
  const sourceUrl = normalizeWhitespace(job.sourceUrl)
  const applyUrl = normalizeWhitespace(job.applyUrl)
  const link = normalizeWhitespace(job.link)
  if (shouldPreferApplyUrl(job)) return applyUrl || sourceUrl || link || null
  return sourceUrl || applyUrl || link || null
}

const isEmbeddedGreenhouseJobUrl = (jobUrl) => {
  try {
    const parsed = new URL(jobUrl)
    const hostname = parsed.hostname.toLowerCase()
    return (
      (hostname === 'boards.greenhouse.io' || hostname === 'job-boards.greenhouse.io')
      && /\/[a-z0-9-]+\/jobs\/\d+/i.test(parsed.pathname)
    )
  } catch {
    return false
  }
}

const extractEmbeddedPublicJobUrl = (html, baseUrl = null) => {
  let iframeSources
  try {
    iframeSources = activeIframeSources(html)
  } catch (error) {
    if (!(error instanceof ActiveNativeContentError)) throw error
    // Optional discovery cannot trust a malformed wrapper or cancel other jobs.
    return null
  }
  for (const src of iframeSources) {
    const candidateUrl = toAbsoluteUrl(src, baseUrl)
    if (candidateUrl && isEmbeddedGreenhouseJobUrl(candidateUrl)) {
      return candidateUrl
    }
  }

  return null
}

const isSmartRecruitersPublicJobUrl = (jobUrl) => {
  try {
    return new URL(jobUrl).hostname.toLowerCase() === 'jobs.smartrecruiters.com'
  } catch {
    return false
  }
}

const getOrCreateAsyncCacheEntry = (cache, key, loader) => {
  if (!key) return Promise.resolve().then(loader)
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.pending
  cache.delete(key)
  if (cache.size >= 128) cache.delete(cache.keys().next().value)

  const pending = Promise.resolve().then(loader)
  const entry = { pending, expiresAt: Date.now() + PROVIDER_CACHE_TTL_MS }
  cache.set(key, entry)
  pending.catch(() => {
    if (cache.get(key) === entry) cache.delete(key)
  })
  return pending
}

const providerPayload = response => response && Object.hasOwn(response, 'payload') ? response.payload : response
const verifiedProviderResponse = (response, url) => response?.status >= 200 && response.status < 300
  && Object.hasOwn(response, 'payload') && isExactPublicJobUrl(response.url, url)
const verifiedPageResponse = (response, url) => response?.status >= 200 && response.status < 300
  && typeof response.html === 'string' && isExactPublicJobUrl(response.url, url)
const sameNativeTitle = (left, right) => Boolean(normalizeWhitespace(left))
  && normalizeWhitespace(left).toLowerCase() === normalizeWhitespace(right)?.toLowerCase()
const joinProviderSourceParts = (...parts) => parts.filter(value => extractActiveDescription(value)).join('\n\n')

const joinProviderDescriptionParts = (...parts) => {
  const description = parts
    .map((part) => normalizeExistingPublicEvidenceValue(part))
    .filter(Boolean)
    .join('\n\n')

  return normalizeWhitespace(description)
}

const inferExperienceFromDescriptionText = (description) => {
  const normalized = normalizeWhitespace(description)
  if (!normalized) return null

  const explicitExperience = extractLabeledExperience(normalized)
  if (explicitExperience) return explicitExperience

  const experienceProfile = extractJobFilterSignals({
    description: normalized,
  })?.experienceProfile
  const evidence = normalizeWhitespace(experienceProfile?.evidence)
  if (!evidence || experienceProfile?.confidence !== 'high') {
    return null
  }

  return (
    experienceProfile.minimumYears === 0 && experienceProfile.maximumYears === 0
      ? 'No experience required'
      : evidence
  )
}

const buildNormalizedProviderEnrichedJob = (job = {}, updates = {}) => {
  const sourceDescription = hasSourceDescription(job) ? getSourceDescription(job)
    : (updates.sourceDescription || getSourceDescription(job))
  const normalized = normalizeScrapedJob({
    ...job,
    ...updates,
    sourceDescription,
  }, {
    source: job.source || null,
  })

  return {
    ...job,
    ...updates,
    sourceDescription,
    title: normalized.title,
    description: normalized.jobDescription || normalizeWhitespace(updates.description) || job.description || null,
    jobDescription: normalized.jobDescription || normalizeWhitespace(updates.jobDescription) || job.jobDescription || null,
    experienceRequired: normalized.experienceRequired,
    ...(updates.experienceRequired && { sourceExperienceRequired: normalizeWhitespace(updates.experienceRequired) }),
    publicExperienceChecked: true,
  }
}

const extractOracleCandidateExperienceSiteNumber = (job = {}) => {
  const explicitSiteNumber = normalizeWhitespace(job.siteNumber)
  if (explicitSiteNumber) return explicitSiteNumber

  const publicJobUrl = resolvePublicJobUrl(job)
  try {
    const parsed = new URL(String(publicJobUrl ?? ''))
    return normalizeWhitespace(
      parsed.pathname.match(/\/sites\/([^/?#]+)/i)?.[1] || null,
    )
  } catch {
    return null
  }
}

const extractOracleCandidateExperienceJobId = (job = {}) => {
  const explicitJobId = normalizeWhitespace(job.jobId || job.requisitionId)
  if (explicitJobId) return explicitJobId

  const publicJobUrl = resolvePublicJobUrl(job)
  try {
    const parsed = new URL(String(publicJobUrl ?? ''))
    return normalizeWhitespace(
      parsed.pathname.match(/\/job\/([^/?#]+)/i)?.[1] || null,
    )
  } catch {
    return null
  }
}

const buildOracleCandidateExperienceDetailApiUrl = (job = {}) => {
  const publicJobUrl = resolvePublicJobUrl(job)
  const siteNumber = extractOracleCandidateExperienceSiteNumber(job)
  const jobId = extractOracleCandidateExperienceJobId(job)
  if (!publicJobUrl || !siteNumber || !jobId) return null

  try {
    const parsed = new URL(String(publicJobUrl))
    const nativeSite = parsed.pathname.match(/\/hcmUI\/CandidateExperience\/[^/]+\/sites\/([^/]+)/i)?.[1]
    const nativeId = parsed.pathname.match(/\/job\/([^/]+)/i)?.[1]
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.oraclecloud.com') || !nativeSite
      || decodeURIComponent(nativeSite) !== siteNumber
      || (nativeId && decodeURIComponent(nativeId) !== jobId)) return null

    return `${parsed.origin}/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id=%22${encodeURIComponent(jobId)}%22,siteNumber=${encodeURIComponent(siteNumber)}`
  } catch {
    return null
  }
}

const extractOracleCandidateExperienceDetailRecord = (payload) => {
  if (Array.isArray(payload?.items)) return payload.items.length === 1 ? payload.items[0] : null
  return payload?.Id != null ? payload : null
}

const nativeOracleDate = value => {
  if (value == null || value === '') return null
  if (typeof value !== 'string') return undefined
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-](\d{2}):(\d{2})))?$/)
  if (!match) return undefined
  const [, year, month, day, hour, minute, second, offsetHour, offsetMinute] = match.map(Number)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (month < 1 || month > 12 || day < 1 || day > monthDays[month - 1]
    || hour > 23 || minute > 59 || second > 59 || offsetHour > 23 || offsetMinute > 59) return undefined
  return normalizeLifecycleDate(value) || undefined
}

const nativeDateConflicts = (suppliedValue, nativeDate, exactness) => {
  const supplied = normalizeLifecycleDate(suppliedValue)
  if (!supplied || !nativeDate) return false
  const calendarOnly = exactness === false || (exactness !== true && typeof suppliedValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(suppliedValue))
  return calendarOnly ? supplied.toISOString().slice(0, 10) !== nativeDate.toISOString().slice(0, 10)
    : supplied.getTime() !== nativeDate.getTime()
}

export const enrichJobWithOracleCandidateExperienceDetail = async (job = {}, {
  fetchJson = defaultFetchJson,
  cache = new Map(),
  signal = null,
} = {}) => {
  const detailApiUrl = buildOracleCandidateExperienceDetailApiUrl(job)
  if (!detailApiUrl) return job

  const response = await getOrCreateAsyncCacheEntry(
    cache,
    detailApiUrl,
    () => { throwIfAborted(signal); return fetchJson(detailApiUrl, { signal }) },
  )
  throwIfAborted(signal)
  if (Object.hasOwn(response || {}, 'payload') && !verifiedProviderResponse(response, detailApiUrl)) return job
  const detail = extractOracleCandidateExperienceDetailRecord(providerPayload(response))
  if (!detail || String(detail.Id) !== extractOracleCandidateExperienceJobId(job) || !sameNativeTitle(detail.Title, job.title)) return job
  if (detail.PrimaryLocationCountry && !/^(?:IN|IND|India)$/i.test(detail.PrimaryLocationCountry)) return job
  const lifecycle = {}
  if (verifiedProviderResponse(response, detailApiUrl)) {
    const start = nativeOracleDate(detail.ExternalPostedStartDate)
    const end = nativeOracleDate(detail.ExternalPostedEndDate)
    if (start === undefined || end === undefined) return job
    const suppliedPublication = resolveJobPublicationDate(job)
    if ((suppliedPublication.provenance === 'source'
      && nativeDateConflicts(suppliedPublication.date, start, job.sourcePostingDateIsExact))
      || nativeDateConflicts(job.closingDate, end, job.sourceClosingDateIsExact)) return job
    if (start) Object.assign(lifecycle, sourcePublicationDateFields(start))
    if (end) {
      lifecycle.closingDate = end.toISOString()
      lifecycle.sourceClosingDateIsExact = /T/i.test(String(detail.ExternalPostedEndDate))
    }
  }
  const sourceDescription = joinProviderSourceParts(detail.ExternalDescriptionStr, detail.ExternalResponsibilitiesStr,
    detail.ShortDescriptionStr, detail.ExternalQualificationsStr)
  const providerDescription = joinProviderDescriptionParts(
    detail.ExternalDescriptionStr,
    detail.ExternalResponsibilitiesStr,
    detail.ShortDescriptionStr,
    detail.ExternalQualificationsStr,
    detail.StudyLevel,
  )
  const providerExperience =
    normalizeWhitespace(job.experienceRequired)
    || inferExperienceFromDescriptionText(providerDescription)
  if (!providerDescription && !providerExperience) {
    return job
  }

  return buildNormalizedProviderEnrichedJob(job, {
    ...lifecycle,
    title: normalizeWhitespace(detail.Title) || job.title,
    description: providerDescription,
    jobDescription: providerDescription,
    ...(verifiedProviderResponse(response, detailApiUrl) && /^(?:IN|IND|India)$/i.test(detail.PrimaryLocationCountry || '')
      && sourceDescription ? { sourceDescription } : {}),
    experienceRequired: providerExperience,
  })
}

const fountainBoardConfig = value => {
  try {
    const parsed = new URL(value)
    const [accountSlug, brandId, extra] = parsed.pathname.split('/').filter(Boolean)
    const rekrutek = ['careers.rekrutek.ai', 'careers.hire.rekrutek.ai'].includes(parsed.hostname)
    const fountain = /^careers\.[a-z0-9-]+\.fountain\.com$/i.test(parsed.hostname)
    if (parsed.protocol !== 'https:' || parsed.search || parsed.hash || extra || (!rekrutek && !fountain)
      || !/^[a-z0-9-]+$/i.test(accountSlug || '') || !/^[0-9a-f-]{36}$/i.test(brandId || '')) return null
    return { accountSlug, brandId, boardUrl: parsed.href, rekrutek,
      apiOrigin: rekrutek ? 'https://hire.rekrutek.ai' : `https://${parsed.hostname.replace(/^careers\./i, '')}` }
  } catch { return null }
}

const extractFountainBoardConfig = html => {
  const configs = readNativeDocument(html).nodes(node => node.tag === 'a')
    .map(node => fountainBoardConfig(node.attrs.href)).filter(Boolean)
  const unique = [...new Map(configs.map(config => [config.boardUrl, config])).values()]
  return unique.length === 1 ? unique[0] : null
}

const loadFountainBoardConfig = async (job = {}, {
  fetchText = defaultFetchText,
  cache = new Map(),
  signal = null,
} = {}) => {
  const careersUrl = normalizeWhitespace(job.companyCareerPage)
  if (!careersUrl) return null

  return getOrCreateAsyncCacheEntry(
    cache,
    careersUrl,
    async () => {
      throwIfAborted(signal)
      const companyPage = await fetchText(careersUrl, { signal })
      throwIfAborted(signal)
      const declared = extractFountainBoardConfig(publicPageHtml(companyPage))
      if (!declared) return null
      if (!verifiedPageResponse(companyPage, careersUrl)) return { ...declared, verified: false }
      const board = await fetchText(declared.boardUrl, { signal })
      throwIfAborted(signal)
      const current = fountainBoardConfig(board?.url)
      const sameScope = current?.accountSlug === declared.accountSlug && current?.brandId === declared.brandId
      const verified = board?.status >= 200 && board.status < 300 && sameScope
        && (isExactPublicJobUrl(board.url, declared.boardUrl) || (!declared.rekrutek && current.rekrutek))
      return verified ? { ...current, verified: true } : { ...declared, verified: false }
    },
  )
}

const buildFountainPortalApplicationFormUrl = ({
  apiOrigin,
  accountSlug,
  brandId,
  jobId,
} = {}) => {
  if (!apiOrigin || !accountSlug || !brandId || !jobId) return null

  const url = new URL(`/internal_api/portal/${accountSlug}/application_forms/new`, apiOrigin)
  url.searchParams.set('funnel_id', String(jobId))
  url.searchParams.set('try_new_ui', 'true')
  url.searchParams.set('brand_id', String(brandId))
  return url.toString()
}

const enrichJobWithFountainPortalDetail = async (job = {}, {
  fetchText = defaultFetchText,
  fetchJson = defaultFetchJson,
  cache = new Map(),
  publicPageReceipt = null,
  signal = null,
} = {}) => {
  const publicJobUrl = resolvePublicJobUrl(job)
  const jobId = normalizeWhitespace(job.jobId || job.requisitionId)
  let roleUrl
  try { roleUrl = new URL(publicJobUrl) } catch { return job }
  const oldRole = roleUrl.pathname.match(/^\/([^/]+)\/apply\/([^/]+)\/?$/)
  const newRole = roleUrl.pathname.match(/^\/apply\/([^/]+)\/opening\/([^/]+)\/?$/)
  const role = roleUrl.hostname.endsWith('.fountain.com') ? oldRole
    : roleUrl.hostname === 'apply.rekrutek.ai' ? newRole : null
  if (!role || roleUrl.protocol !== 'https:' || !jobId) return job

  const boardConfig = await loadFountainBoardConfig(job, { fetchText, cache, signal })
  if (!boardConfig || boardConfig.accountSlug !== role[1]) return job
  const portalUrl = buildFountainPortalApplicationFormUrl({
    ...boardConfig,
    jobId,
  })
  if (!portalUrl) return job

  throwIfAborted(signal)
  const response = await fetchJson(portalUrl, { signal })
  throwIfAborted(signal)
  if (Object.hasOwn(response || {}, 'payload') && !verifiedProviderResponse(response, portalUrl)) return job
  const payload = providerPayload(response)
  const funnel = payload?.funnel
  if (!funnel || !sameNativeTitle(funnel.title, job.title)
    || (funnel.external_id != null && String(funnel.external_id) !== jobId)
    || (funnel.slug && funnel.slug !== role[2]) || funnel.active === false
    || (funnel.country_code && funnel.country_code !== 'IN')
    || (payload.brand?.external_id && payload.brand.external_id !== boardConfig.brandId)) return job
  const expectedRoleUrl = boardConfig.rekrutek
    ? `https://apply.rekrutek.ai/apply/${role[1]}/opening/${role[2]}` : publicJobUrl
  const verified = boardConfig.verified && verifiedPageResponse(publicPageReceipt, expectedRoleUrl)
    && verifiedProviderResponse(response, portalUrl) && String(funnel.external_id) === jobId
    && funnel.slug === role[2] && funnel.active === true && funnel.country_code === 'IN'
    && payload.brand?.external_id === boardConfig.brandId
  const sourceDescription = extractActiveDescription(funnel.position_description_html) ? funnel.position_description_html : null
  const providerDescription = joinProviderDescriptionParts(
    payload?.funnel?.position_description_html,
  )
  const providerExperience =
    normalizeWhitespace(job.experienceRequired)
    || inferExperienceFromDescriptionText(providerDescription)
  if (!providerDescription && !providerExperience) {
    return job
  }

  return buildNormalizedProviderEnrichedJob(job, {
    title: normalizeWhitespace(payload?.funnel?.title) || job.title,
    description: providerDescription,
    jobDescription: providerDescription,
    ...(verified && sourceDescription ? { sourceDescription } : {}),
    experienceRequired: providerExperience,
  })
}

const extractCeipalWidgetConfig = (html) => {
  const configs = readNativeDocument(html).nodes(node => node.tag === 'script'
    && node.attrs.src === 'https://jobsapi.ceipal.com/APISource/widget.js')
    .map(node => ({ apiKey: node.attrs['data-ceipal-api-key'], careerPortalId: node.attrs['data-ceipal-career-portal-id'] }))
    .filter(value => value.apiKey && value.careerPortalId)
  const unique = [...new Map(configs.map(value => [JSON.stringify(value), value])).values()]
  return unique.length === 1 ? unique[0] : null
}

const buildCeipalWidgetUrl = ({ apiKey, careerPortalId } = {}) =>
  `https://jobsapi.ceipal.com/APISource/v2/index.html?api_key=${apiKey}&cp_id=${careerPortalId}`

const buildCeipalCareerPortalApiUrl = ({ apiKey, page = 1 } = {}) =>
  `https://careerapi.ceipal.com/${apiKey}/CareerPortalJobPostings/?page=${page}`

const buildCeipalCareerPortalRequestOptions = ({
  apiKey,
  careerPortalId,
  page = 1,
} = {}) => ({
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    Origin: 'https://jobsapi.ceipal.com',
    Referer: buildCeipalWidgetUrl({ apiKey, careerPortalId }),
    'X-Requested-With': 'XMLHttpRequest',
  },
  body: new URLSearchParams({
    page: String(page),
    api_key: String(apiKey ?? ''),
    method: 'CareerPortalJobPostings',
    cp_id: String(careerPortalId ?? ''),
    from_career_portal: '1',
  }),
})

const extractCeipalCareerPortalSourceUrl = (job = {}) => normalizeWhitespace(
  job.campus_portal_job_details_url
  || job.apply_job_monster
  || job.apply_job
  || job.campus_portal_login_url,
)

const extractCeipalCareerPortalApplyUrl = (job = {}) => normalizeWhitespace(
  job.apply_job_monster
  || job.apply_job
  || job.campus_portal_login_url
  || job.campus_portal_job_details_url,
)

const loadCeipalCareerPortalJobs = async (job = {}, {
  fetchText = defaultFetchText,
  fetchJson = defaultFetchJson,
  cache = new Map(),
  signal = null,
} = {}) => {
  const careersUrl = normalizeWhitespace(job.companyCareerPage)
  if (!careersUrl) return { jobsByKey: new Map(), bindingVerified: false }

  return getOrCreateAsyncCacheEntry(
    cache,
    careersUrl,
    async () => {
      throwIfAborted(signal)
      const companyPage = await fetchText(careersUrl, { signal })
      throwIfAborted(signal)
      const widgetConfig = extractCeipalWidgetConfig(publicPageHtml(companyPage))
      if (!widgetConfig) return { jobsByKey: new Map(), bindingVerified: false }
      const bindingVerified = verifiedPageResponse(companyPage, careersUrl)

      const jobsByKey = new Map()
      const seenIds = new Set()
      for (let page = 1; page <= 100; page += 1) {
        throwIfAborted(signal)
        const apiUrl = buildCeipalCareerPortalApiUrl({ apiKey: widgetConfig.apiKey, page })
        const response = await fetchJson(
          apiUrl,
          { ...buildCeipalCareerPortalRequestOptions({
            apiKey: widgetConfig.apiKey,
            careerPortalId: widgetConfig.careerPortalId,
            page,
          }), signal },
        )
        throwIfAborted(signal)
        if (Object.hasOwn(response || {}, 'payload') && !verifiedProviderResponse(response, apiUrl)) throw new Error('CEIPAL native response identity changed')
        const payload = providerPayload(response)
        if (!Array.isArray(payload?.results)) throw new Error('CEIPAL native response has no job records')
        const results = Array.isArray(payload?.results) ? payload.results : []
        if (results.length === 0) break

        for (const rawJob of results) {
          const country = normalizeWhitespace(rawJob?.country)
          const jobId = normalizeWhitespace(rawJob?.job_id ?? rawJob?.id)
          if (jobId && seenIds.has(jobId)) throw new Error('CEIPAL native role identity is ambiguous')
          if (jobId) seenIds.add(jobId)
          const sourceUrl = extractCeipalCareerPortalSourceUrl(rawJob)
          const applyUrl = extractCeipalCareerPortalApplyUrl(rawJob)
          if (!jobId || !sourceUrl || !applyUrl || !/^India$/i.test(country || '')) {
            continue
          }

          const providerDescription = joinProviderDescriptionParts(
            rawJob?.public_job_desc,
            rawJob?.requistion_description,
          )
          const providerExperience = inferExperienceFromDescriptionText(providerDescription)
          const normalizedJob = {
            title: normalizeWhitespace(rawJob?.public_job_title || rawJob?.position_title),
            jobId,
            sourceUrl,
            applyUrl,
            jobDescription: providerDescription,
            sourceDescription: joinProviderSourceParts(rawJob?.public_job_desc, rawJob?.requistion_description),
            sourceVerified: bindingVerified && verifiedProviderResponse(response, apiUrl),
            experienceRequired: providerExperience,
          }

          for (const key of [jobId, sourceUrl, applyUrl]) {
            if (jobsByKey.has(key) && jobsByKey.get(key)?.jobId !== jobId) jobsByKey.set(key, null)
            else if (!jobsByKey.has(key)) jobsByKey.set(key, normalizedJob)
          }
        }

        const totalPages = Number.parseInt(String(payload?.num_pages ?? ''), 10)
        if (!payload?.next || !Number.isFinite(totalPages) || page >= totalPages) {
          break
        }
      }

      return { jobsByKey, bindingVerified }
    },
  )
}

const enrichJobWithCeipalCareerPortalDetail = async (job = {}, {
  fetchText = defaultFetchText,
  fetchJson = defaultFetchJson,
  cache = new Map(),
  signal = null,
} = {}) => {
  const publicJobUrl = resolvePublicJobUrl(job)
  try {
    const url = new URL(publicJobUrl)
    if (url.protocol !== 'https:' || !/\.ceipal\.(?:com|in)$/i.test(url.hostname)) return job
  } catch { return job }

  const { jobsByKey } = await loadCeipalCareerPortalJobs(job, {
    fetchText,
    fetchJson,
    cache,
    signal,
  })
  const matchedJob = jobsByKey.get(normalizeWhitespace(job.jobId))
    || jobsByKey.get(normalizeWhitespace(job.sourceUrl))
    || jobsByKey.get(normalizeWhitespace(job.applyUrl))
  if (!matchedJob?.jobDescription && !matchedJob?.experienceRequired) {
    return job
  }
  if (!sameNativeTitle(matchedJob.title, job.title)
    || (job.jobId != null && String(job.jobId) !== matchedJob.jobId)
    || ![job.sourceUrl, job.applyUrl, job.link].filter(Boolean).some(url =>
      [matchedJob.sourceUrl, matchedJob.applyUrl].some(nativeUrl => isExactPublicJobUrl(url, nativeUrl)))) return job

  return buildNormalizedProviderEnrichedJob(job, {
    title: matchedJob.title || job.title,
    description: matchedJob.jobDescription,
    jobDescription: matchedJob.jobDescription,
    ...(matchedJob.sourceVerified && matchedJob.sourceDescription ? { sourceDescription: matchedJob.sourceDescription } : {}),
    experienceRequired: normalizeWhitespace(job.experienceRequired) || matchedJob.experienceRequired,
  })
}

const enrichJobWithProviderSpecificPublicData = async (job = {}, {
  fetchText = defaultFetchText,
  fetchJson = defaultFetchJson,
  providerCaches = createProviderCaches(),
  publicPageReceipt = null,
  signal = null,
} = {}) => {
  let enriched = job

  if (!hasSufficientPublicJobEvidence(enriched)) {
    try {
      enriched = await enrichJobWithOracleCandidateExperienceDetail(enriched, {
        fetchJson,
        cache: providerCaches.oracle,
        signal,
      })
    } catch {
      throwIfAborted(signal)
      // Keep the best prior result when the public Oracle detail API cannot be reached.
    }
  }

  if (!hasSufficientPublicJobEvidence(enriched)) {
    try {
      enriched = await enrichJobWithFountainPortalDetail(enriched, {
        fetchText,
        fetchJson,
        cache: providerCaches.fountain,
        publicPageReceipt,
        signal,
      })
    } catch {
      throwIfAborted(signal)
      // Keep the best prior result when the public portal API cannot be reached.
    }
  }

  if (!hasSufficientPublicJobEvidence(enriched)) {
    try {
      enriched = await enrichJobWithCeipalCareerPortalDetail(enriched, {
        fetchText,
        fetchJson,
        cache: providerCaches.ceipal,
        signal,
      })
    } catch {
      throwIfAborted(signal)
      // Keep the best prior result when the public CEIPAL API cannot be reached.
    }
  }

  return enriched
}

const publicPageHtml = response => typeof response === 'object' && response !== null
  ? String(response.html ?? '') : String(response ?? '')

export const inferExperienceFromPublicPageHtml = (job = {}, html) => {
  const publicJobUrl = resolvePublicJobUrl(job)
  // Text-only injected fetches remain useful for experience inference, but
  // cannot prove where a canonical employer description was actually served.
  const responseUrl = html && typeof html === 'object' && html.status >= 200 && html.status < 300
    ? html.url : null
  html = publicPageHtml(html)
  // A normalized listing may explicitly carry a missing immutable description.
  // Only exact employer/role schemas or the bounded, source-specific visible
  // readers can fill that field. Other page text stays separate evidence.
  const scopedProfile = visiblePostingProfile(job, publicJobUrl)
  const posting = responseUrl && (!hasSourceDescription(job) || scopedProfile)
    ? publicPostingDescription({ ...job, sourceUrl: publicJobUrl }, html, responseUrl)
    : null
  if (scopedProfile && !posting) return { ...job }
  const titleOnlySource = job.source === 'tudiptechnologies'
    && normalizeExistingPublicEvidenceValue(getSourceDescription(job)) === normalizeExistingPublicEvidenceValue(job.title)
  const recoveredPosting = !hasSourceDescription(job) || titleOnlySource ? posting : null
  const sourceJob = recoveredPosting
    ? { ...job, sourceDescription: recoveredPosting.description }
    : job
  const pageText = stripHtmlToText(posting?.description || html)
  const trimmedPageText = trimTrailingJobSiteChrome(pageText) || pageText
  const pageSummary = posting ? null : extractPageSummary(html)
  const pageTitle = extractTitle(html)
  const primaryHeading = extractPrimaryHeading(html)
  const smartRecruitersJobAdId = extractMetaContent('sr:job-ad-id', html)
  const pageSummaryExperience = extractLabeledExperience(pageSummary)
  const explicitExperience = extractLabeledExperience(pageText) || pageSummaryExperience
  const pageTextHasBlockingGenericShell = looksLikeBlockingPublicJobShell(pageText)
  const pageTextHasHardGenericShell = looksLikeHardGenericPublicJobShell(pageText)
  const pageTextHasSmartRecruitersMotivationalShell =
    looksLikeNagarroMotivationalShell(pageText)
    && isSmartRecruitersPublicJobUrl(publicJobUrl)
  const pageTextLooksLikeGenericShell = looksLikeGenericPublicJobShell(pageText)
  const pageSummaryLooksLikeGenericShell = looksLikeGenericPublicJobShell(pageSummary)
  const relevantPageText = hasRelevantJobContent(pageText) || explicitExperience
    ? (extractRelevantJobSectionText(pageText) || pageText)
    : null
  const relevantPageSummary = (pageSummaryExperience || hasRelevantJobContent(pageSummary))
    ? (extractRelevantJobSectionText(pageSummary) || pageSummary)
    : null
  const relevantPageTextLooksLikeGenericShell = looksLikeGenericPublicJobShell(relevantPageText)
  const relevantPageSummaryLooksLikeGenericShell = looksLikeGenericPublicJobShell(relevantPageSummary)
  const relevantPageTextLooksLikeNoDescriptionPlaceholder =
    looksLikeNoDescriptionPlaceholder(relevantPageText)
  const hasJobSpecificPageTitle =
    Boolean(recoveredPosting)
    || textContainsComparable(pageTitle, job.title)
    || textContainsComparable(primaryHeading, job.title)
  const bodyTitleMatchIndex = findComparableTextIndex(trimmedPageText, job.title)
  const hasJobSpecificVisibleTitle = Boolean(
    hasJobSpecificPageTitle
    || (bodyTitleMatchIndex !== -1 && bodyTitleMatchIndex <= 220)
  )
  const hasJobSpecificMetaSummary = Boolean(
    hasJobSpecificPageTitle
    && pageSummary
    && pageSummary.length >= 10
    && !pageSummaryLooksLikeGenericShell
    && !GENERIC_JOB_SUMMARY_PATTERN.test(pageSummary)
  )
  const hasSmartRecruitersJobMetadata = Boolean(
    hasJobSpecificPageTitle
    && isSmartRecruitersPublicJobUrl(publicJobUrl)
    && smartRecruitersJobAdId
  )
  const hasJobSpecificApplyFlowEvidence = Boolean(
    hasJobSpecificVisibleTitle
    && !pageTextHasBlockingGenericShell
    && countPatternHits(JOB_SPECIFIC_APPLY_FLOW_PATTERNS, pageText) >= 2
  )
  const hasStructuredJobMetadataShell = Boolean(
    hasJobSpecificVisibleTitle
    && !pageTextHasBlockingGenericShell
    && countPatternHits(JOB_METADATA_SHELL_PATTERNS, pageText) >= 3
    && looksLikeNoDescriptionPlaceholder(pageText)
  )
  const hasGenericListingShell = looksLikeMultiJobListingPage(pageText)
  const hasRelevantPublicEvidence = !pageTextHasHardGenericShell && Boolean(
    explicitExperience
    || (
      relevantPageText
      && !relevantPageTextLooksLikeGenericShell
      && !relevantPageTextLooksLikeNoDescriptionPlaceholder
    )
    || (
      relevantPageSummary
      && !pageSummaryLooksLikeGenericShell
      && !relevantPageSummaryLooksLikeGenericShell
    )
  )
  const hasUsablePublicEvidence = Boolean(
    hasRelevantPublicEvidence
    || hasJobSpecificMetaSummary
  )
  const hasVerifiedPublicJobEvidence = Boolean(
    explicitExperience
    || (
      hasJobSpecificVisibleTitle
      && (
        hasRelevantPublicEvidence
        || hasJobSpecificMetaSummary
        || hasJobSpecificApplyFlowEvidence
        || pageTextHasSmartRecruitersMotivationalShell
        || hasSmartRecruitersJobMetadata
        || hasStructuredJobMetadataShell
      )
    ),
  )
  const preferredPublicTitle =
    (textContainsComparable(primaryHeading, job.title) ? primaryHeading : null)
    || (textContainsComparable(pageTitle, job.title) ? pageTitle : null)
    || null
  const retainedExistingDescriptionParts = [job.description, job.jobDescription]
    .map((value) => normalizeWhitespace(value))
    .filter((value) => value && !looksLikeGenericPublicJobShell(value))
    .filter((value) => job.publicExperienceChecked !== true || value.length >= 200)
  const retainedExistingDescription = retainedExistingDescriptionParts.join('\n\n') || null
  const hasTrustedPriorPublicEvidence =
    job.publicExperienceChecked === true
    && retainedExistingDescriptionParts.length > 0
  const composedPublicDescription = [
    ...retainedExistingDescriptionParts,
    hasJobSpecificMetaSummary
      ? pageSummary
      : (
          pageSummaryLooksLikeGenericShell || relevantPageSummaryLooksLikeGenericShell
            ? null
            : relevantPageSummary
        ),
    hasGenericListingShell
    || pageTextHasHardGenericShell
    || relevantPageTextLooksLikeGenericShell
    || relevantPageTextLooksLikeNoDescriptionPlaceholder
    || hasStructuredJobMetadataShell
      ? null
      : relevantPageText,
  ]
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean)
    .join('\n\n') || null

  const normalizationInput = {
    ...sourceJob,
    title: !recoveredPosting && hasUsablePublicEvidence && hasJobSpecificPageTitle ? (preferredPublicTitle || job.title) : job.title,
    experienceRequired: job.experienceRequired || null,
    description: composedPublicDescription,
    jobDescription: composedPublicDescription,
  }
  const provider = { source: job.source || null }
  let normalized = normalizeScrapedJob(normalizationInput, provider)
  // Whole-page labels may describe a summary above the actual job requirements.
  // Use them only when the selected job description has no usable requirement.
  if (!normalized.experienceRequired && explicitExperience) {
    normalized = normalizeScrapedJob({
      ...normalizationInput,
      experienceRequired: explicitExperience,
    }, provider)
  }

  return {
    ...sourceJob,
    title: normalized.title,
    description: normalized.jobDescription || retainedExistingDescription || null,
    jobDescription: normalized.jobDescription
      || retainedExistingDescription
      || relevantPageSummary
      || null,
    experienceRequired: normalized.experienceRequired,
    ...(explicitExperience && normalized.experienceRequired === explicitExperience
      && { sourceExperienceRequired: explicitExperience }),
    publicExperienceChecked: hasTrustedPriorPublicEvidence || hasVerifiedPublicJobEvidence,
  }
}

export const enrichJobWithPublicExperience = async (job = {}, {
  fetchText = null,
  fetchJson = null,
  fetchBrowserText = null,
  getBrowserText = null,
  fetchTimeoutMs = resolvePublicExperienceFetchTimeoutMs(),
  pdfTextExtractionTimeoutMs = resolvePdfTextExtractionTimeoutMs(),
  signal = null,
  providerCaches = createProviderCaches(),
} = {}) => {
  throwIfAborted(signal)
  // Verified listing-only adapters have no separate role detail to recover.
  // Refetching their shared page can import company history or another opening.
  if (job.skipPublicExperienceEnrichment === true) return job
  const promotedJob = promoteExistingPublicEvidence(job)
  if (!shouldRefreshPublicJobEvidence(promotedJob)) return promotedJob

  const jobUrl = resolvePublicJobUrl(promotedJob)
  if (!jobUrl) return promotedJob

  const fetchImpl = fetchText || ((url) => defaultFetchText(url, {
    signal,
    timeoutMs: fetchTimeoutMs,
    pdfTextExtractionTimeoutMs,
    includeResponseMetadata: true,
  }))
  const canUseDefaultFetch = !fetchText && !shouldSkipDefaultFetch(jobUrl)
  const canUseBrowserFetch = Boolean(fetchBrowserText || getBrowserText)
  if (!fetchText && !canUseDefaultFetch && !canUseBrowserFetch) return promotedJob

  let enriched = promotedJob
  let rawFetchedHtml = null
  try {
    throwIfAborted(signal)
    if (fetchText || canUseDefaultFetch) {
      rawFetchedHtml = await fetchImpl(jobUrl)
      enriched = inferExperienceFromPublicPageHtml(promotedJob, rawFetchedHtml)
    }
  } catch (error) {
    if (signal?.aborted) throw getAbortReason(signal, error?.message || 'Public experience enrichment aborted')
    enriched = promotedJob
  }

  throwIfAborted(signal)
  const hasVerifiedWrapperResponse = rawFetchedHtml && typeof rawFetchedHtml === 'object'
    && rawFetchedHtml.status >= 200 && rawFetchedHtml.status < 300
    && isExactPublicJobUrl(rawFetchedHtml.url, jobUrl)
  const embeddedPublicJobUrl = hasVerifiedWrapperResponse
    ? extractEmbeddedPublicJobUrl(publicPageHtml(rawFetchedHtml), jobUrl)
    : null
  if (
    embeddedPublicJobUrl
    && embeddedPublicJobUrl !== jobUrl
    && !hasSufficientPublicJobEvidence(enriched)
  ) {
    try {
      throwIfAborted(signal)
      const embeddedHtml = await fetchImpl(embeddedPublicJobUrl)
      enriched = inferExperienceFromPublicPageHtml({
        ...enriched,
        sourceUrl: embeddedPublicJobUrl,
        applyUrl: embeddedPublicJobUrl,
        link: embeddedPublicJobUrl,
      }, embeddedHtml)
    } catch (error) {
      if (signal?.aborted) throw getAbortReason(signal, error?.message || 'Public experience enrichment aborted')
      // Keep the wrapper-page result when the embedded board cannot be fetched.
    }
  }

  const providerFetchJson = fetchJson || (!fetchText
    ? (url, requestOptions = {}) => defaultFetchJson(url, {
        ...requestOptions,
        signal,
        fetchTimeoutMs,
        includeResponseMetadata: true,
      })
    : null)
  if (!hasSufficientPublicJobEvidence(enriched) && providerFetchJson) {
    throwIfAborted(signal)
    enriched = await enrichJobWithProviderSpecificPublicData(enriched, {
      fetchText: fetchImpl,
      fetchJson: providerFetchJson,
      providerCaches,
      publicPageReceipt: rawFetchedHtml,
      signal,
    })
    throwIfAborted(signal)
  }

  enriched = preserveListingOnlyPublicVerification(job, promotedJob, enriched)

  if (hasSufficientPublicJobEvidence(enriched) || !canUseBrowserFetch) {
    return enriched
  }

  // Preserve newly verified public pages that legitimately omit experience and
  // don't expose richer job text; an empty browser fallback should not
  // downgrade those raw-fetch verifications.
  if (
    enriched.publicExperienceChecked === true
    && promotedJob.publicExperienceChecked !== true
    && !normalizeWhitespace(enriched.description)
    && !normalizeWhitespace(enriched.jobDescription)
  ) {
    return enriched
  }

  try {
    throwIfAborted(signal)
    const browserFetchImpl = fetchBrowserText || await getBrowserText?.()
    if (!browserFetchImpl) return enriched

    const browserHtml = await browserFetchImpl(jobUrl)
    let browserEnriched = inferExperienceFromPublicPageHtml(enriched, browserHtml)

    if (
      !hasSufficientPublicJobEvidence(browserEnriched)
      && looksLikeTransientBrowserRenderShell(publicPageHtml(browserHtml), jobUrl)
    ) {
      const retriedBrowserHtml = await browserFetchImpl(jobUrl)
      browserEnriched = inferExperienceFromPublicPageHtml(browserEnriched, retriedBrowserHtml)
    }

    return preserveListingOnlyPublicVerification(job, promotedJob, browserEnriched)
  } catch (error) {
    if (signal?.aborted) throw getAbortReason(signal, error?.message || 'Public experience enrichment aborted')
    return enriched
  }
}

export const enrichJobsWithPublicExperience = async (jobs = [], options = {}) => {
  const concurrency = Math.max(1, Number.isInteger(options.concurrency) ? options.concurrency : 4)
  const providerCaches = createProviderCaches()
  const results = new Array(jobs.length)
  let cursor = 0
  let browserFallback = null

  const getBrowserFallback = async () => {
    if (options.fetchBrowserText) {
      return {
        fetchBrowserText: options.fetchBrowserText,
        close: async () => {},
      }
    }

    if (options.useBrowserFallback === false) {
      return null
    }

    if (browserFallback) return browserFallback

    const browserFallbackSessionCount = Math.max(
      1,
      Math.min(
        jobs.length,
        concurrency,
        Number.isInteger(options.browserFallbackConcurrency)
          ? Math.max(1, options.browserFallbackConcurrency)
          : DEFAULT_BROWSER_FALLBACK_SESSION_LIMIT,
      ),
    )
    const sessions = await Promise.all(
      Array.from({ length: browserFallbackSessionCount }, () => createBrowserFetchSession({
        userAgent: USER_AGENT,
        timeoutMs: 60000,
        waitUntil: BROWSER_FALLBACK_WAIT_UNTIL,
        settleTimeMs: BROWSER_FALLBACK_SETTLE_TIME_MS,
      })),
    )
    const queues = sessions.map(() => Promise.resolve())
    const warmedUrlsBySession = sessions.map(() => new Set())
    let sessionCursor = 0
    const fetchBrowserPage = async (sessionIndex, url) => {
      const page = await sessions[sessionIndex].fetchPage(url)
      if (!(page.status >= 200 && page.status < 300)) throw new Error(`HTTP ${page.status} for ${url}`)
      return page
    }

    const fetchBrowserText = (url) => {
      const sessionIndex = sessionCursor % sessions.length
      sessionCursor += 1
      const next = queues[sessionIndex].then(
        async () => {
          if (
            shouldWarmBrowserFallbackSession(url)
            && !warmedUrlsBySession[sessionIndex].has(url)
          ) {
            await sessions[sessionIndex].fetchPage(url)
            warmedUrlsBySession[sessionIndex].add(url)
          }

          return fetchBrowserPage(sessionIndex, url)
        },
        async () => {
          if (
            shouldWarmBrowserFallbackSession(url)
            && !warmedUrlsBySession[sessionIndex].has(url)
          ) {
            await sessions[sessionIndex].fetchPage(url)
            warmedUrlsBySession[sessionIndex].add(url)
          }

          return fetchBrowserPage(sessionIndex, url)
        },
      )
      queues[sessionIndex] = next.catch(() => {})
      return next
    }

    browserFallback = {
      fetchBrowserText,
      close: async () => {
        await Promise.allSettled(sessions.map((session) => session.close()))
      },
    }

    return browserFallback
  }

  const worker = async () => {
    while (cursor < jobs.length) {
      throwIfAborted(options.signal)
      const currentIndex = cursor
      cursor += 1
      results[currentIndex] = await enrichJobWithPublicExperience(jobs[currentIndex], {
        ...options,
        providerCaches,
        fetchBrowserText: options.fetchBrowserText || null,
        getBrowserText: options.fetchBrowserText
          ? null
          : async () => {
              const browserHandler = await getBrowserFallback()
              return browserHandler?.fetchBrowserText || null
            },
      })
      throwIfAborted(options.signal)
    }
  }

  try {
    await Promise.all(
      Array.from({ length: Math.min(concurrency, jobs.length) }, () => worker()),
    )
  } finally {
    if (browserFallback) {
      await browserFallback.close()
    }
  }

  return results
}
