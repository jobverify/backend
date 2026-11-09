import { resolveEmployerPostedAt } from '../../src/utils/employerPostingDate.js';
import { withSourceDescription } from '../../src/utils/jobSourceContent.js';
import { normalizePublicJobType } from '../../src/utils/publicJobTypeLabel.js';
import { extractJobFilterSignals, hasEntryLevelCue } from '../../src/utils/jobFilterSignals.js'
import { applyClassification, getAuthoritativeClassification } from '../../src/services/jobClassificationPolicy.js'
import { resolveJobPublicationDate } from '../../src/utils/jobPublicationDate.js'

const normalizeString = (value) => {
  if (value == null) return null
  const normalized = String(value).replace(/\s+/g, ' ').trim()
  return normalized || null
}

// Employer text is scan evidence; preserve paragraphs and Unicode whitespace.
const preserveSourceText = value => {
  if (value == null) return null
  const text = (Array.isArray(value) ? value.join('\n') : String(value)).trim()
  return text || null
}

const stripHtmlTags = (value) => {
  if (value == null) return null
  return String(value).replace(/<[^>]+>/g, ' ')
}

const normalizeInlineText = (value) => normalizeString(stripHtmlTags(value))

const DESCRIPTION_SECTION_LABELS = [
  'Network & Links',
  'Overall Purpose Of The Role',
  'Responsibilities',
  'Behavioral Competencies',
  'Technical Competencies & Experience',
  'Technical Competencies',
  'Software Skills',
  'IT Skills',
  'Language & Skills',
  'Preferred Qualifications',
  'Minimum Qualifications',
  'Qualifications',
  'Education',
  'Role',
]

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildFlexibleLabelPattern = (label) => label
  .split(/(\s+|&)/)
  .filter(Boolean)
  .map((part) => {
    if (part === '&') return '\\s*&\\s*'
    if (/^\s+$/.test(part)) return '\\s+'
    return escapeRegex(part)
  })
  .join('')

const normalizeDescription = (value) => {
  if (value == null) return null

  let normalized = String(value)
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()

  if (!normalized) return null

  normalized = normalized
    .replace(/^about\s+(?:this|the)\s+role\s*:?\s*/i, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  for (const label of DESCRIPTION_SECTION_LABELS) {
    const labelPattern = new RegExp(`\\s*${buildFlexibleLabelPattern(label)}\\s*:`, 'gi')
    normalized = normalized.replace(labelPattern, (match, offset) => {
      const labelText = match.replace(/\s*:\s*$/u, '').replace(/\s+/g, ' ').trim().toUpperCase()
      return `${offset === 0 ? '' : '\n\n'}${labelText}:\n`
    })
  }

  normalized = normalized
    .replace(/(ROLE:\n[^\n]{1,80})\s+(?=(?:As|The|Candidate|You|We|This|Our)\b)/g, '$1\n')
    .replace(/\s+(?=\d+\.\s)/g, '\n')
    .replace(/\s+(?=-\s+)/g, '\n')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return normalized || null
}

const normalizeUrl = (value) => {
  const normalized = normalizeString(value)
  if (!normalized) return null

  try {
    const parsed = new URL(normalized)
    if (!['http:', 'https:'].includes(parsed.protocol)) return null
    if (parsed.pathname === '/' && !parsed.search && !parsed.hash) {
      return parsed.origin
    }
    return parsed.toString()
  } catch {
    return null
  }
}

// Identity-only normalization is shared with run analytics. It intentionally
// avoids description parsing and classification when only counting roles.
export const normalizeScrapedJobIdentity = (job = {}, provider = {}) => {
  const applyUrl = normalizeUrl(job.applyUrl || job.link || job.sourceUrl)
  const sourceUrl = normalizeUrl(job.sourceUrl || job.link || job.applyUrl)
  return {
    title: normalizeInlineText(job.originalTitle || job.title),
    company: normalizeString(job.company || provider.companyName),
    location: normalizeString(job.location), city: normalizeString(job.city),
    jobId: normalizeString(job.jobId), requisitionId: normalizeString(job.requisitionId || job.reqId),
    applyUrl, sourceUrl: sourceUrl || applyUrl,
  }
}

const normalizeStringArray = (value) => {
  if (Array.isArray(value)) {
    return [...new Set(value.map(normalizeString).filter(Boolean))]
  }

  if (typeof value === 'string') {
    return [...new Set(
      value
        .split(/[,\n|/]/)
        .map(normalizeString)
        .filter(Boolean),
    )]
  }

  return []
}

const SKILL_NAME_FILTER_SOURCES = new Set([
  '7edgesolutions',
  'acciojob',
  'americanchase',
  'arisinfra',
  'bhanzu',
  'c3ihub',
  'cloudthat',
  'cognida',
  'epaylater',
  'hiveminds',
  'impactanalytics',
  'isocrates',
  'kapture',
  'openfinancialtechnologies',
  'rapteehv',
  'relanto',
  'sisainformationsecurity',
  'surveysparrow',
  'unboxrobotics',
])

const LIKELY_TECHNICAL_ACRONYMS = new Set([
  'AWS',
  'GCP',
  'SQL',
  'CAD',
  'ROS',
  'SAP',
  'ERP',
  'ETL',
  'API',
  'SDK',
  'CI/CD',
])

const TECHNICAL_SKILL_PATTERNS = [
  { pattern: /\bnode\.?js\b/i, value: 'Node.js' },
  { pattern: /\breact(?:\.js)?\b/i, value: 'React' },
  { pattern: /\btypescript\b/i, value: 'TypeScript' },
  { pattern: /\bjavascript\b/i, value: 'JavaScript' },
  { pattern: /\bpython\b/i, value: 'Python' },
  { pattern: /\bjava\b/i, value: 'Java' },
  { pattern: /\bkotlin\b/i, value: 'Kotlin' },
  { pattern: /\bandroid\b/i, value: 'Android' },
  { pattern: /\bc\+\+\b/i, value: 'C++' },
  { pattern: /\bc#\b/i, value: 'C#' },
  { pattern: /(?:^|[^a-z])\.net\b/i, value: '.NET' },
  { pattern: /\bphp\b/i, value: 'PHP' },
  { pattern: /\bgolang\b/i, value: 'Golang' },
  { pattern: /\baws\b/i, value: 'AWS' },
  { pattern: /\bazure\b/i, value: 'Azure' },
  { pattern: /\bgcp\b|google cloud/i, value: 'GCP' },
  { pattern: /\bdatabricks\b/i, value: 'Databricks' },
  { pattern: /\bspark\b/i, value: 'Spark' },
  { pattern: /\bmongodb\b/i, value: 'MongoDB' },
  { pattern: /\bpostgres(?:ql)?\b/i, value: 'PostgreSQL' },
  { pattern: /\bmysql\b/i, value: 'MySQL' },
  { pattern: /\bsql\b/i, value: 'SQL' },
  { pattern: /\bfigma\b/i, value: 'Figma' },
  { pattern: /\bhubspot\b/i, value: 'HubSpot' },
  { pattern: /\bsalesforce\b/i, value: 'Salesforce' },
  { pattern: /\bsolidworks\b/i, value: 'SolidWorks' },
  { pattern: /\bcad\b/i, value: 'CAD' },
  { pattern: /\bros\b/i, value: 'ROS' },
  { pattern: /\bdocker\b/i, value: 'Docker' },
  { pattern: /\bkubernetes\b/i, value: 'Kubernetes' },
  { pattern: /\bterraform\b/i, value: 'Terraform' },
  { pattern: /\bjenkins\b/i, value: 'Jenkins' },
  { pattern: /\blinux\b/i, value: 'Linux' },
  { pattern: /\bredis\b/i, value: 'Redis' },
  { pattern: /\bkafka\b/i, value: 'Kafka' },
  { pattern: /\bairflow\b/i, value: 'Airflow' },
  { pattern: /\bsnowflake\b/i, value: 'Snowflake' },
  { pattern: /\btableau\b/i, value: 'Tableau' },
  { pattern: /\bpower\s*bi\b/i, value: 'Power BI' },
  { pattern: /\bsap\b/i, value: 'SAP' },
  { pattern: /\boracle\b/i, value: 'Oracle' },
  { pattern: /\bokta\b/i, value: 'Okta' },
  { pattern: /\bjamf\b/i, value: 'Jamf' },
  { pattern: /\bgoogle workspace\b/i, value: 'Google Workspace' },
  { pattern: /\btensorflow\b/i, value: 'TensorFlow' },
  { pattern: /\bpytorch\b/i, value: 'PyTorch' },
  { pattern: /\bopenai\b/i, value: 'OpenAI' },
]

const EXPERIENCE_RANGE_PATTERN = /(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\b/i
const EXPERIENCE_VALUE_PATTERN = /(\d+(?:\.\d+)?)\s*(\+|plus)?\s*(?:years?|yrs?)\b/i

const normalizeSourceId = (value) => normalizeString(value)?.toLowerCase() || null

const isGenericWorkableJobUrl = (value) => /^https:\/\/apply\.workable\.com\/j\/[A-Z0-9]+(?:\/apply)?$/i.test(value)
const isAccountWorkableJobUrl = (value, accountName) => (
  new RegExp(`^https://apply\\.workable\\.com/${escapeRegex(accountName)}/j/[A-Z0-9]+(?:/apply)?$`, 'i')
).test(value)

const hasTrustedPublicExperienceSurface = (job = {}, provider = {}) => {
  const source = normalizeSourceId(job.source || provider.source)
  const sourceUrl = normalizeUrl(job.sourceUrl || job.link || job.applyUrl) || ''
  const applyUrl = normalizeUrl(job.applyUrl || job.link || job.sourceUrl) || ''

  switch (source) {
    case 'amrita':
      return /^https:\/\/www\.amrita\.edu\/job\/.+/i.test(sourceUrl)
        && /^https:\/\/careers\.amrita\.edu\/client\/job-search/i.test(applyUrl)
    case 'bankofamerica':
      return /^https:\/\/careers\.bankofamerica\.com\//i.test(sourceUrl)
    case 'bitsilica':
      return /^https:\/\/bitsilica\.com\/(?!careers(?:\/|$)).+/i.test(sourceUrl)
    case 'buyhatke':
      return /^https:\/\/compare\.buyhatke\.com\/company\/.+\.php$/i.test(sourceUrl)
    case 'innovaccer':
      return (
        isAccountWorkableJobUrl(sourceUrl, 'innovaccer-analytics')
        || isGenericWorkableJobUrl(sourceUrl)
      ) && (
        isAccountWorkableJobUrl(applyUrl, 'innovaccer-analytics')
        || isGenericWorkableJobUrl(applyUrl)
      )
    case 'jubilantfoodworks':
      return /^https:\/\/fa-exph-saasfaprod1\.fa\.ocs\.oraclecloud\.com\/hcmUI\/CandidateExperience\/en\/sites\/jubilant\/job\//i.test(sourceUrl)
    case 'novartis':
      return /^https:\/\/www\.novartis\.com\/careers\/career-search\/job\/details\//i.test(sourceUrl)
    case 'nucleussoftware':
      return /^https:\/\/nucleussoftware\.zohorecruit\.in\/jobs\/Careers/i.test(sourceUrl)
    case 'nurturefarm':
      return /^https:\/\/nurture\.skillate\.com(?:\/|$)/i.test(sourceUrl)
    case 'nxtwave':
      return /^https:\/\/nxtwave\.freshteam\.com\/jobs\//i.test(sourceUrl)
    case 'plumhq':
      return /^https:\/\/careers\.kula\.ai\/plumhq(?:\/|$)/i.test(sourceUrl)
    default:
      return false
  }
}

const looksLikeTechnicalSkillToken = (value) => {
  const normalized = normalizeString(value)
  if (!normalized) return false

  if (LIKELY_TECHNICAL_ACRONYMS.has(normalized.toUpperCase())) return true
  if (/[.+#]/.test(normalized)) return true
  if (/[a-z][A-Z]/.test(normalized)) return true

  return false
}

const extractTechnicalSkillNames = (skill) => {
  const normalized = normalizeString(skill)
  if (!normalized) return []

  const matches = TECHNICAL_SKILL_PATTERNS
    .filter(({ pattern }) => pattern.test(normalized))
    .map(({ value }) => value)

  if (matches.length > 0) return [...new Set(matches)]
  if (looksLikeTechnicalSkillToken(normalized)) return [normalized]

  return []
}

const filterSkillNamesTagsForSource = (skills = [], source) => {
  if (!SKILL_NAME_FILTER_SOURCES.has(normalizeSourceId(source))) {
    return skills
  }

  return [...new Set(skills.flatMap((skill) => extractTechnicalSkillNames(skill)))]
}

const isPartTimeLabel = (value) => /part[\s_-]?time/i.test(String(value ?? ''))
const hasInternshipCue = (value) => /\b(?:intern(?:ship)?s?|trainee(?:ship)?s?|apprentice(?:ship)?s?)\b/i.test(String(value ?? ''))

const normalizeEmploymentType = (value) => {
  const label = normalizeString(value)
  if (!label) return null
  if (isPartTimeLabel(label)) return null

  const normalized = label.toLowerCase().replace(/[\s_-]+/g, ' ').trim()
  if (/\b(contract|contractual|contractor|freelance|temporary|fixed term)\b/.test(normalized)) return 'Contract'
  if (/\b(intern|internship|trainee|apprentice)\b/.test(normalized)) return 'Internship'
  if (/\b(full ?time|fulltime|permanent|regular|unlimited|staff|employee|professional|white collar|on ?roll|on site with flexibility|fte)\b/.test(normalized)) {
    return 'Full-time'
  }

  // Labels such as "Hybrid" and "Onsite" describe work arrangement, not
  // employment. Let the experience/title inference determine the job type.
  return null
}

const inferEmploymentType = (job = {}) => {
  const explicitType = normalizeEmploymentType(job.employmentType)
  if (explicitType) return explicitType

  const title = normalizeString(job.title) || ''
  if (hasInternshipCue(title)) return 'Internship'

  if (job.jobType === 'Full-time Fresher' || job.jobType === 'Full-time Experienced') {
    return 'Full-time'
  }
  if (job.jobType === 'Intern' || job.jobType === 'Internship' || job.jobType === 'Contract') {
    return job.jobType === 'Intern' ? 'Internship' : job.jobType
  }
  if (isPartTimeLabel(job.jobType)) return null

  const normalizedTitle = title.toLowerCase()
  if (/contract|contractor|freelance/i.test(title)) return 'Contract'
  if (/part.?time/i.test(normalizedTitle)) return null
  if (/\bfull[\s-]*time\b/i.test(title) && !/\b(?:not|non|no)[-\s]+(?:a\s+)?full[\s-]*time\b/i.test(title)) return 'Full-time'
  // Literal native readers can preserve an absent source field without taking
  // the legacy generic default. Explicit field/title evidence above still works.
  return job.sourceEmploymentTypeUnresolved === true ? null : 'Full-time'
}

const hasFresherCue = (job = {}) => {
  const haystack = [
    job.title,
    job.department,
    job.description,
    job.jobDescription,
    job.minimumQualification,
    job.preferredQualification,
    job.experienceRequired,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return [
    /\bfresher\b/,
    /\bcampus\b/,
    /\bentry level\b/,
    /\bnew grad\b/,
    /\btrainee\b/,
    /\bapprentice\b/,
    /\b0\s*-\s*1\s+years?\b/,
    /\b0\s+to\s+1\s+years?\b/,
    /\b0\s+years?\b/,
  ].some((pattern) => pattern.test(haystack))
    || hasEntryLevelCue(haystack)
}

const getExperienceBounds = (job = {}) => {
  const profileMinimumYears = Number.parseFloat(job?.experienceProfile?.minimumYears)
  const profileMaximumSource = job?.experienceProfile?.maximumYears
  const profileMaximumYears = profileMaximumSource == null
    ? null
    : Number.parseFloat(profileMaximumSource)

  if (Number.isFinite(profileMinimumYears) || Number.isFinite(profileMaximumYears)) {
    return {
      minimumYears: Number.isFinite(profileMinimumYears) ? Math.floor(profileMinimumYears) : null,
      maximumYears: Number.isFinite(profileMaximumYears) ? Math.ceil(profileMaximumYears) : null,
      isOpenEnded: job?.experienceProfile?.isOpenEnded === true,
    }
  }

  const experienceText = normalizeString(job.experienceRequired)?.toLowerCase() || ''
  if (!experienceText) {
    return {
      minimumYears: null,
      maximumYears: null,
      isOpenEnded: false,
    }
  }

  const rangeMatch = experienceText.match(EXPERIENCE_RANGE_PATTERN)
  if (rangeMatch) {
    return {
      minimumYears: Math.floor(Number.parseFloat(rangeMatch[1])),
      maximumYears: Math.ceil(Number.parseFloat(rangeMatch[2])),
      isOpenEnded: false,
    }
  }

  const valueMatch = experienceText.match(EXPERIENCE_VALUE_PATTERN)
  if (valueMatch) {
    const years = Math.floor(Number.parseFloat(valueMatch[1]))
    return {
      minimumYears: years,
      maximumYears: valueMatch[2] ? null : years,
      isOpenEnded: Boolean(valueMatch[2]),
    }
  }

  return {
    minimumYears: null,
    maximumYears: null,
    isOpenEnded: false,
  }
}

const hasPositiveExperienceRequirement = ({ minimumYears, maximumYears, isOpenEnded } = {}) =>
  (Number.isFinite(minimumYears) && minimumYears > 0)
  // A 0-1 range is an entry-level range, not a positive-experience
  // requirement. A maximum without a stated minimum remains experienced.
  || (!Number.isFinite(minimumYears) && Number.isFinite(maximumYears) && maximumYears > 0)
  || (isOpenEnded === true && Number.isFinite(minimumYears) && minimumYears > 0)

const inferExperienceLevel = (job = {}) => {
  const explicitLevel = normalizeString(job.experienceLevel)
  const { minimumYears, maximumYears } = getExperienceBounds(job)
  const hasPositiveExperienceYears = hasPositiveExperienceRequirement({ minimumYears, maximumYears })

  // Explicit entry-level requirements outrank a previously inferred title level.
  // Seniority (for example Associate) remains a separate filter signal.
  if (minimumYears === 0 && Number.isFinite(maximumYears) && maximumYears <= 1) {
    return 'Entry Level'
  }

  if (explicitLevel && !(explicitLevel === 'Entry Level' && hasPositiveExperienceYears)) {
    return explicitLevel
  }

  if (job.jobType === 'Full-time Fresher' && !hasPositiveExperienceYears) return 'Entry Level'
  if (job.jobType === 'Full-time Experienced') return 'Mid Level'

  if (!hasPositiveExperienceYears && hasFresherCue(job)) return 'Entry Level'

  const title = (job.title || '').toLowerCase()
  if (/\b(senior|sr\.?|staff|lead|principal|architect|manager|director|head|vp|vice president)\b/.test(title)) {
    return 'Senior Level'
  }

  if (Number.isFinite(minimumYears) || Number.isFinite(maximumYears)) {
    if (!hasPositiveExperienceYears) {
      return 'Entry Level'
    }

    const anchorYears = Number.isFinite(minimumYears) && minimumYears > 0
      ? minimumYears
      : maximumYears
    if (anchorYears <= 2) return 'Junior Level'
    if (anchorYears >= 3) return 'Mid Level'
  }

  if (/\b(junior|jr\.?|associate)\b/.test(title)) return 'Junior Level'
  if (/\b(ii|iii|iv|2|3|4)\b/.test(title)) return 'Mid Level'
  return null
}

const composeJobType = ({ employmentType, experienceLevel, hasPositiveExperienceYears = false }) => {
  if (!employmentType) return null
  if (employmentType === 'Internship' && hasPositiveExperienceYears) return 'Full-time Experienced'
  if (employmentType !== 'Full-time') return employmentType
  if (hasPositiveExperienceYears) return 'Full-time Experienced'
  return experienceLevel === 'Entry Level'
    ? 'Full-time Fresher'
    : ['Junior Level', 'Mid Level', 'Senior Level'].includes(experienceLevel)
      ? 'Full-time Experienced'
      : 'Unspecified'
}

export const resolveJobType = (job = {}) => {
  job = withSourceDescription(job);
  const classified = getAuthoritativeClassification(job)
  if (classified) return classified.jobType
  if (normalizeString(job.jobType)?.toLowerCase() === 'unspecified') return 'Unspecified'
  const employmentType = inferEmploymentType(job)
  const experienceLevel = inferExperienceLevel(job)
  const hasPositiveExperienceYears = hasPositiveExperienceRequirement(getExperienceBounds(job))
  return composeJobType({ employmentType, experienceLevel, hasPositiveExperienceYears })
}

const TITLE_NORMALIZATION_RULES = [
  { pattern: /\b(sde|software developer|software engineer|backend engineer|back-end engineer|frontend engineer|front-end engineer|front end engineer|full[-\s]?stack engineer|application developer|web developer)\b/i, value: 'Software Engineer' },
  { pattern: /\b(data engineer)\b/i, value: 'Data Engineer' },
  { pattern: /\b(machine learning engineer|ml engineer)\b/i, value: 'Machine Learning Engineer' },
  { pattern: /\b(devops engineer|site reliability engineer|sre)\b/i, value: 'DevOps Engineer' },
  { pattern: /\b(security engineer|cybersecurity engineer)\b/i, value: 'Security Engineer' },
  { pattern: /\b(network(?: administrator| admin)?(?:\/engineer)?|network engineer)\b/i, value: 'Network Engineer' },
  { pattern: /\b(qa engineer|quality engineer|test engineer|sdet)\b/i, value: 'Verification Engineer' },
  { pattern: /\b(firmware developer|firmware engineer)\b/i, value: 'Firmware Engineer' },
  { pattern: /\b(embedded software engineer|embedded engineer)\b/i, value: 'Embedded Engineer' },
  { pattern: /\b(rtl design engineer|rtl engineer)\b/i, value: 'RTL Engineer' },
  { pattern: /\b(asic verification engineer|verification engineer)\b/i, value: 'Verification Engineer' },
  { pattern: /\b(mechanical design engineer|mechanical engineer)\b/i, value: 'Mechanical Engineer' },
  { pattern: /\b(electrical engineer)\b/i, value: 'Electrical Engineer' },
  { pattern: /\b(civil engineer)\b/i, value: 'Civil Engineer' },
  { pattern: /\b(automation engineer)\b/i, value: 'Automation Engineer' },
  { pattern: /\b(robotics engineer)\b/i, value: 'Robotics Engineer' },
]

const normalizeTitle = (title) => {
  const normalizedTitle = normalizeString(title)
  if (!normalizedTitle) return null

  const matchedRule = TITLE_NORMALIZATION_RULES.find((rule) => rule.pattern.test(normalizedTitle))
  return matchedRule ? matchedRule.value : normalizedTitle
}

const ENGINEERING_DOMAIN_RULES = [
  { pattern: /\b(machine learning|ml engineer|artificial intelligence|ai engineer|ai\/ml|consumer ai|ai unit|ai solutions?|ai architect|ai product|agentic ai|agentic solution|computer vision|perception(?: & intelligence)?|gen ai|generative ai|llm)\b/i, value: 'Machine Learning' },
  { pattern: /\b(data science|data scientist|applied scientist)\b/i, value: 'Machine Learning' },
  { pattern: /\b(d&a|data analyst|data engineer|data engineering|data architect|data analytics|data lakehouse|data migration|analytics engineer|bi architect|bi engineer|business intelligence|master data management|mdm\b|palantir|power ?bi|tableau|bods|bw\b|etl|data pipeline)\b/i, value: 'Data Engineering' },
  { pattern: /\b(devops|devsecops|site reliability|sre|kubernetes|terraform|control m|aiops)\b/i, value: 'DevOps' },
  { pattern: /\b(cloud|aws|azure|gcp|oci\b|infrastructure|tech ?ops|technical operations|linux administrator|database administrator|database engineer|\bdba\b|app support|support analyst|desktop support|desktop engineer|system administrator|it administrator|service desk|helpdesk engineer|it helpdesk|business systems administrator|enterprise application administrator|saas administrator|coveo administrator|storage & backup|data center operations|windows server|active directory|vpn connectivity)\b/i, value: 'Cloud' },
  { pattern: /\b(cyber\s*security|cybersecurity|cyber threat|security engineer|security analyst|application security|appsec|data loss prevention|identity management|non-human identities|\bnhi\b|pam\b|beyondtrust|ztna|cato|iam|pki|soc|secops|siem|soar|xdr)\b/i, value: 'Security' },
  { pattern: /\b(network(?: administrator| admin)?(?:\/engineer)?|network engineer|routing|switching|network security)\b/i, value: 'Networking' },
  { pattern: /\b(firmware)\b/i, value: 'Firmware' },
  { pattern: /\b(linux bsp|rtos)\b/i, value: 'Embedded Systems' },
  { pattern: /\b(embedded)\b/i, value: 'Embedded Systems' },
  { pattern: /\b(rtl)\b/i, value: 'RTL' },
  { pattern: /\b(verification|control testing|kenan testing|qe architect|qe engineer|workday testing|atf engineer|qa(?: engineer| engineering)?|quality engineer|quality analyst|quality assurance|qc engineer|test engineer|test lead|test manager|test analyst|test automation|testing services|software testing|performance testing|ott video testing|video streaming|settop box|\bstb\b|\bdvb\b|debug engineer|debug|ai testing|crash safety testing|sdet|validation|v&v|rams)\b/i, value: 'Verification' },
  { pattern: /\b(dft)\b/i, value: 'DFT' },
  { pattern: /\b(analog)\b/i, value: 'Analog Design' },
  { pattern: /\b(\brf\b|radio frequency)\b/i, value: 'RF' },
  { pattern: /\b(asic|vlsi|physical design|mixed signal|semiconductor|digital design|design enablement)\b/i, value: 'Semiconductor' },
  { pattern: /\b(software|business solutions engineer|application architect|technical architect|solutions? architect|enterprise architect|product architect|billing architect|oms architect|implementation(?: senior)? engineer|systems development|systems integration|integration engineer|developer|backend|front[-\s]?end|full[-\s]?stack|java|python|node\.?js|react|angular|typescript|javascript|c\+\+|c#|\.net|\.net maui|xamarin(?:\.forms)?|duck creek|labview|golang|guidewire|mulesoft|aem|d365|ms dynamics|salesforce|servicenow|murex|pega|boomi|oracle\b|oracle fusion|oracle health|sap\b|sap btp|sap s4 hana|documentum|adobe campaign|outsystem|uipath|rpa\b|abap|fico|ariba|ppqm|rmcs|mdg|cpi\b|sharepoint|netsuite|litmus edge|mes\b|legaltech|biztech|mainframe|application support|platform engineering)\b/i, value: 'Software Engineering' },
  { pattern: /\b(electrical|power electronics|power conversion|hardware design|electronics design|electronics engineer|control & instrumentation|instrumentation)\b/i, value: 'Electrical' },
  { pattern: /\b(mechanical|stress analysis|cfd|product design engineer|ergo|trims|jigs & fixtures|harness|hvac|mep)\b/i, value: 'Mechanical' },
  { pattern: /\b(civil)\b/i, value: 'Civil' },
  { pattern: /\b(construction|\bbim\b|bim modeller|structural engineer|rebar engineer|piping design|structural steel|formwork|site engineer|site execution|finishing|ehs engineer)\b/i, value: 'Construction' },
  { pattern: /\b(chemical|medicinal chemistry|peptide chemistry|analytical development)\b/i, value: 'Chemical' },
  { pattern: /\b(process)\b/i, value: 'Process' },
  { pattern: /\b(manufacturing)\b/i, value: 'Manufacturing' },
  { pattern: /\b(industrial|supply chain management|production planning|ppc engineer)\b/i, value: 'Industrial' },
  { pattern: /\b(automation|control systems?|controls project)\b/i, value: 'Automation' },
  { pattern: /\b(robotics)\b/i, value: 'Robotics' },
  { pattern: /\b(telecom|telecommunications|bss architect)\b/i, value: 'Telecommunications' },
  { pattern: /\b(power systems|power engineer|bess|bop engineer|hvdc|main circuit|protection & control|protection commissioning|lighting system)\b/i, value: 'Power Systems' },
  { pattern: /\b(renewable energy|solar|wind)\b/i, value: 'Renewable Energy' },
  { pattern: /\b(offshore engineer|jacket|fpso|topsides|oil|gas|petroleum)\b/i, value: 'Oil & Gas' },
  { pattern: /\b(automotive)\b/i, value: 'Automotive' },
  { pattern: /\b(ev|electric vehicle|battery)\b/i, value: 'EV' },
  { pattern: /\b(aerospace|avionics|composites|uav|drone|drone pilots|drone maintenance)\b/i, value: 'Aerospace' },
  { pattern: /\b(biomedical|medical device|dmpk)\b/i, value: 'Biomedical' },
  { pattern: /\b(mining)\b/i, value: 'Mining' },
  { pattern: /\b(materials)\b/i, value: 'Materials' },
  { pattern: /\b(research|r&d|quantum engineering|seaweed technology)\b/i, value: 'Research' },
]

const TECHNICAL_TITLE_HINT_PATTERN = /\b(engineer|developer|devops|sre|architect|programmer|scientist|data analyst|data analytics|data science|data engineering|d&a|consumer ai|ai unit|agentic ai|computer vision|gen ai|generative ai|llm|sap\b|oracle\b|palantir|power ?bi|linux bsp|rtos|mixed signal|guidewire|mulesoft|aem|d365|ms dynamics|react|node\.?js|documentum|adobe campaign|uipath|outsystem|rpa\b|mep|hvac|bim|power electronics|electronics|instrumentation|cyber\s*security|security analyst|qa|quality|test(?: lead| analyst| automation| engineer|ing)?|validation|network|cloud|infrastructure|platform engineer|support engineer|support analyst|field service|application engineer|administrator|sysadmin|embedded|firmware|semiconductor|pcb|electrical|mechanical|civil|automation|robotics|uav)\b/i

const ROLE_DOMAIN_TO_ENGINEERING_DOMAIN = Object.freeze({
  'Backend Engineering': 'Software Engineering',
  'Frontend Engineering': 'Software Engineering',
  'Full-Stack Engineering': 'Software Engineering',
  'Mobile Development': 'Software Engineering',
  'Software Engineering': 'Software Engineering',
  'Quality Engineering': 'Verification',
  'DevOps & SRE': 'DevOps',
  'Cloud & Infrastructure': 'Cloud',
  'Data Engineering': 'Data Engineering',
  'Data Science & AI': 'Machine Learning',
  'Cybersecurity': 'Security',
})

const SOURCE_ENGINEERING_DOMAIN_RULES = [
  {
    sources: new Set(['ansys', 'arm', 'onsemiindia', 'renesas', 'synopsys', 'texasinstruments']),
    pattern: /\b(engineer|architect|application engineer|applications engineering|design|design enablement|product|prod&test|test)\b/i,
    value: 'Semiconductor',
  },
  {
    sources: new Set(['aeriestechnology']),
    pattern: /\b(design engineer)\b/i,
    value: 'Software Engineering',
  },
  {
    sources: new Set(['allieddigitalservices']),
    pattern: /\b(rms|noc)\b/i,
    value: 'Cloud',
  },
  {
    sources: new Set(['amadeus.workday']),
    pattern: /\b(implementation(?: senior)? engineer)\b/i,
    value: 'Software Engineering',
  },
  {
    sources: new Set(['amrita']),
    pattern: /\b(seaweed technology engineer)\b/i,
    value: 'Research',
  },
  {
    sources: new Set(['apple']),
    pattern: /\b(product safety engineer|hardware)\b/i,
    value: 'Electrical',
  },
  {
    sources: new Set(['assaabloy']),
    pattern: /\b(staff engineer)\b/i,
    value: 'Software Engineering',
  },
  {
    sources: new Set(['aptiv']),
    pattern: /\b(engineer - scm|supply chain management)\b/i,
    value: 'Industrial',
  },
  {
    sources: new Set(['cmscomputers']),
    pattern: /\b(helpdesk|desktop support|field service|customer service engineer|support engineer)\b/i,
    value: 'Cloud',
  },
  {
    sources: new Set(['fortinet']),
    pattern: /\b(engineer|architect|technical support|secops|siem|soar|xdr)\b/i,
    value: 'Security',
  },
  {
    sources: new Set(['cmscomputers']),
    pattern: /\b(annotation engineer|engineer - ai|ai\/ml|engineer - ai\/ml)\b/i,
    value: 'Machine Learning',
  },
  {
    sources: new Set(['cmscomputers']),
    pattern: /\b(infra solution architect|it infra architect|solution architect|field services|maintenance|helpdesk|desktop|support engineer)\b/i,
    value: 'Cloud',
  },
  {
    sources: new Set(['cmscomputers']),
    pattern: /\b(ppc engineer)\b/i,
    value: 'Industrial',
  },
  {
    sources: new Set(['cmscomputers']),
    pattern: /\b(emv)\b/i,
    value: 'Software Engineering',
  },
  {
    sources: new Set(['hitachienergy']),
    pattern: /\b(telecommunication)\b/i,
    value: 'Telecommunications',
  },
  {
    sources: new Set(['hitachienergy']),
    pattern: /\b(control engineer|design engineer|project engineer|power conversion|hvdc|protection|main circuit|lighting system|technical application engineer)\b/i,
    value: 'Power Systems',
  },
  {
    sources: new Set(['hitachienergy']),
    pattern: /\bbim\b/i,
    value: 'Construction',
  },
  {
    sources: new Set(['atkinsrealis']),
    pattern: /\b(principal engineer|senior design manager|lead architect|architectural team|infrastructure|buildings commissions)\b/i,
    value: 'Construction',
  },
  {
    sources: new Set(['axtria']),
    pattern: /\b(product architect|datamax|salesiq)\b/i,
    value: 'Software Engineering',
  },
  {
    sources: new Set(['blackline']),
    pattern: /\b(system engineer)\b/i,
    value: 'Cloud',
  },
  {
    sources: new Set(['brigadegroup']),
    pattern: /\b(facility|shift engineer)\b/i,
    value: 'Construction',
  },
  {
    sources: new Set(['businessnext']),
    pattern: /\b(techno-functional roles|senior engineer|engineer)\b/i,
    value: 'Software Engineering',
  },
  {
    sources: new Set(['criamosengineeringpvtltd']),
    pattern: /\b(design engineer|tire|rubber|special purpose machines|material handling)\b/i,
    value: 'Mechanical',
  },
  {
    sources: new Set(['citius', 'citiustech']),
    pattern: /\b(ph-ort-aro|aro engineer)\b/i,
    value: 'Biomedical',
  },
  {
    sources: new Set(['wipro']),
    pattern: /\b(administrator)\b/i,
    value: 'Cloud',
  },
  {
    sources: new Set(['wipro']),
    pattern: /\b(beyondtrust|pam|workday testing)\b/i,
    value: 'Security',
  },
  {
    sources: new Set(['wipro']),
    pattern: /\b(solution architect|technical architect|control m|aiops|fde)\b/i,
    value: 'Software Engineering',
  },
  {
    sources: new Set(['wipro']),
    pattern: /\b(quantum engineering)\b/i,
    value: 'Research',
  },
  {
    sources: new Set(['jadeglobal.workday']),
    pattern: /\b(oci|administrator)\b/i,
    value: 'Cloud',
  },
  {
    sources: new Set(['jadeglobal.workday']),
    pattern: /\b(boomi|oracle fusion|workday qe|atf engineer|technical architect|solution architect)\b/i,
    value: 'Software Engineering',
  },
  {
    sources: new Set(['agilentindia.workday']),
    pattern: /\b(field service(?: application)? engineer|spectroscopy)\b/i,
    value: 'Electrical',
  },
  {
    sources: new Set(['agilentindia.workday']),
    pattern: /\b(coveo|administrator)\b/i,
    value: 'Cloud',
  },
  {
    sources: new Set(['arcticwolfindia.workday']),
    pattern: /\b(appsec|application security)\b/i,
    value: 'Security',
  },
  {
    sources: new Set(['arcticwolfindia.workday']),
    pattern: /\b(business systems administrator|enterprise application administrator)\b/i,
    value: 'Cloud',
  },
  {
    sources: new Set(['brainiuminformationtechnologies']),
    pattern: /\b(solutions architect)\b/i,
    value: 'Software Engineering',
  },
  {
    sources: new Set(['borgwarner']),
    pattern: /\b(functional safety|electric motor|system architect|model based system)\b/i,
    value: 'EV',
  },
  {
    sources: new Set(['ey']),
    pattern: /\b(xamarin(?:\.forms)?|\.net maui)\b/i,
    value: 'Software Engineering',
  },
  {
    sources: new Set(['flex.workday']),
    pattern: /\b(debug|testing)\b/i,
    value: 'Verification',
  },
  {
    sources: new Set(['flex.workday']),
    pattern: /\b(litmus edge|systems integration|technical design architect|engineer - it|mes\b)\b/i,
    value: 'Software Engineering',
  },
  {
    sources: new Set(['honeywell']),
    pattern: /\b(field service technician)\b/i,
    value: 'Electrical',
  },
  {
    sources: new Set(['honeywell']),
    pattern: /\b(advanced systems engineer)\b/i,
    value: 'Automation',
  },
  {
    sources: new Set(['ingersollrand']),
    pattern: /\b(engineer|application engineer|lab engineer)\b/i,
    value: 'Mechanical',
  },
  {
    sources: new Set(['kathirsudhirautomation']),
    pattern: /\b(graduate engineer trainee|get)\b/i,
    value: 'Automation',
  },
  {
    sources: new Set(['kathirsudhirautomation']),
    pattern: /\b(scm engineer)\b/i,
    value: 'Industrial',
  },
  {
    sources: new Set(['kbr']),
    pattern: /\b(offshore engineer)\b/i,
    value: 'Oil & Gas',
  },
  {
    sources: new Set(['finolexcables']),
    pattern: /\b(polymer compounding)\b/i,
    value: 'Chemical',
  },
  {
    sources: new Set(['hindusthannationalglassandindustrieslimited']),
    pattern: /\b(production|shift engineer)\b/i,
    value: 'Manufacturing',
  },
  {
    sources: new Set(['inmobi']),
    pattern: /\b(staff engineer)\b/i,
    value: 'Software Engineering',
  },
  {
    sources: new Set(['lindeindia']),
    pattern: /\b(systems engineer|hydrogen|petrochemical plants)\b/i,
    value: 'Process',
  },
  {
    sources: new Set(['mindaindustries']),
    pattern: /\b(production plan|ppc)\b/i,
    value: 'Manufacturing',
  },
  {
    sources: new Set(['mindaindustries']),
    pattern: /\b(oem|suzuki|maruti|tata motors|honda cars)\b/i,
    value: 'Automotive',
  },
  {
    sources: new Set(['novartis']),
    pattern: /\b(ai\s*\(?architect\)?|llmops|mlops|rag|vector databases?|hybrid search)\b/i,
    value: 'Machine Learning',
  },
  {
    sources: new Set(['m2nxt']),
    pattern: /\b(fixture|tooling)\b/i,
    value: 'Mechanical',
  },
  {
    sources: new Set(['newvisionsoftwareconsultancy']),
    pattern: /\b(ibm sterling oms|oms architect)\b/i,
    value: 'Software Engineering',
  },
  {
    sources: new Set(['nuberg']),
    pattern: /\b(piping|project engineer)\b/i,
    value: 'Process',
  },
  {
    sources: new Set(['numerosmotors']),
    pattern: /\b(powertrain|packaging & integration)\b/i,
    value: 'EV',
  },
  {
    sources: new Set(['publicissapient', 'tredence']),
    pattern: /\b(senior systems engineer|sr system engineer|system engineer)\b/i,
    value: 'Cloud',
  },
  {
    sources: new Set(['okta']),
    pattern: /\b(engineering architect|dx\/ax\/ux)\b/i,
    value: 'Software Engineering',
  },
  {
    sources: new Set(['omron']),
    pattern: /\b(system engineer)\b/i,
    value: 'Automation',
  },
  {
    sources: new Set(['orioninnovation']),
    pattern: /\b(deployment engineer)\b/i,
    value: 'Cloud',
  },
  {
    sources: new Set(['orbitouch']),
    pattern: /\b(site engineer|shop drawings|manpower at the site)\b/i,
    value: 'Construction',
  },
  {
    sources: new Set(['pragyarefrigerationandelectricalsprivatelimited']),
    pattern: /\b(product engineer|refrigeration|cooling industries)\b/i,
    value: 'Mechanical',
  },
  {
    sources: new Set(['rubrik']),
    pattern: /\b(corporate it architect|information technology & services)\b/i,
    value: 'Cloud',
  },
  {
    sources: new Set(['sakarrobotics']),
    pattern: /\b(perception & intelligence)\b/i,
    value: 'Machine Learning',
  },
  {
    sources: new Set(['sap']),
    pattern: /\b(non-human identities|identity management|\bnhi\b)\b/i,
    value: 'Security',
  },
  {
    sources: new Set(['sap']),
    pattern: /\b(enterprise architect)\b/i,
    value: 'Software Engineering',
  },
  {
    sources: new Set(['seclore']),
    pattern: /\b(product engineer|product engineering)\b/i,
    value: 'Software Engineering',
  },
  {
    sources: new Set(['sedintechnologies']),
    pattern: /\b(control engineer)\b/i,
    value: 'Automation',
  },
  {
    sources: new Set(['skyrootaerospace']),
    pattern: /\b(composites|methods engineer)\b/i,
    value: 'Aerospace',
  },
  {
    sources: new Set(['solitontechnologies']),
    pattern: /\b(labview)\b/i,
    value: 'Software Engineering',
  },
  {
    sources: new Set(['tatatechnologies']),
    pattern: /\b(cockpit|cad modelling|assemblies)\b/i,
    value: 'Automotive',
  },
  {
    sources: new Set(['tessolve']),
    pattern: /\b(lead engineer|manager - design engineering|pre-silicon|post-silicon|silicon bring-up|embedded|digital)\b/i,
    value: 'Semiconductor',
  },
  {
    sources: new Set(['tetrapak']),
    pattern: /\b(assistant engineer production|production)\b/i,
    value: 'Manufacturing',
  },
  {
    sources: new Set(['techversantinfotech']),
    pattern: /\b(database engineer)\b/i,
    value: 'Cloud',
  },
  {
    sources: new Set(['techversantinfotech']),
    pattern: /\b(technical lead|architect)\b/i,
    value: 'Software Engineering',
  },
  {
    sources: new Set(['techwaveconsulting']),
    pattern: /\b(ai architect)\b/i,
    value: 'Machine Learning',
  },
  {
    sources: new Set(['techwaveconsulting']),
    pattern: /\b(design engineer|fiber|long-haul|iqgeo|waldo|aramis|aotx)\b/i,
    value: 'Telecommunications',
  },
  {
    sources: new Set(['techwaveconsulting']),
    pattern: /\b(sharepoint architect|system engineer)\b/i,
    value: 'Software Engineering',
  },
  {
    sources: new Set(['tranetechnologies']),
    pattern: /\b(service engineer)\b/i,
    value: 'Mechanical',
  },
  {
    sources: new Set(['unstop']),
    pattern: /\b(principal architect|technology)\b/i,
    value: 'Software Engineering',
  },
  {
    sources: new Set(['tudiptechnologies']),
    pattern: /\b(spark engineer)\b/i,
    value: 'Data Engineering',
  },
  {
    sources: new Set(['tudiptechnologies']),
    pattern: /\b(fpga design engineer)\b/i,
    value: 'Semiconductor',
  },
  {
    sources: new Set(['valenta']),
    pattern: /\b(it administrator)\b/i,
    value: 'Cloud',
  },
  {
    sources: new Set(['yamaha']),
    pattern: /\b(brake design engineer|cv bd design engineer|suspension system design engineer|brake|suspension)\b/i,
    value: 'Automotive',
  },
  {
    sources: new Set(['ubgroup']),
    pattern: /\b(shift engineer)\b/i,
    value: 'Manufacturing',
  },
  {
    sources: new Set(['yamahamotorssolutions']),
    pattern: /\b(helpdesk engineer|service desk)\b/i,
    value: 'Cloud',
  },
  {
    sources: new Set(['zoom']),
    pattern: /\b(technical account engineer|voice|video|uc issues|sip traces|packet captures)\b/i,
    value: 'Telecommunications',
  },
  {
    sources: new Set(['yubi']),
    pattern: /\b(agentic ai)\b/i,
    value: 'Machine Learning',
  },
  {
    sources: new Set(['yubi']),
    pattern: /\b(engineer|technical architect)\b/i,
    value: 'Software Engineering',
  },
]

const inferSourceEngineeringDomain = (job = {}, normalizedTitle = null, providerSource = null) => {
  const sourceId = normalizeSourceId(job.source || providerSource)
  if (!sourceId) return null

  const haystack = [
    job.title,
    normalizedTitle,
    job.jobCategory,
    job.department,
    job.minimumQualification,
    job.preferredQualification,
    job.jobDescription,
    job.description,
  ]
    .filter(Boolean)
    .join(' ')

  const matchedRule = SOURCE_ENGINEERING_DOMAIN_RULES.find((rule) => (
    rule.sources.has(sourceId) && rule.pattern.test(haystack)
  ))

  return matchedRule ? matchedRule.value : null
}

const TECHNICAL_BODY_HINT_PATTERNS = [
  /\bcloud infrastructure\b/i,
  /\bkubernetes\b/i,
  /\bterraform\b/i,
  /\bdocker\b/i,
  /\bwindows server\b/i,
  /\bactive directory\b/i,
  /\bvpn connectivity\b/i,
  /\bnode\.?js\b/i,
  /\breact\b/i,
  /\btypescript\b/i,
  /\bjavascript\b/i,
  /\bpython\b/i,
  /\bjava\b/i,
  /\bkotlin\b/i,
  /\bandroid\b/i,
  /\bc\+\+\b/i,
  /\bc#\b/i,
  /\bgolang\b/i,
  /\baws\b/i,
  /\bazure\b/i,
  /\bgcp\b/i,
  /\bdatabricks\b/i,
  /\bspark\b/i,
  /\bmongodb\b/i,
  /\bpostgres(?:ql)?\b/i,
  /\bmysql\b/i,
  /\bredis\b/i,
  /\bkafka\b/i,
  /\bairflow\b/i,
  /\bsnowflake\b/i,
  /\bokta\b/i,
  /\bjamf\b/i,
  /\btensorflow\b/i,
  /\bpytorch\b/i,
  /\bmurex\b/i,
  /\bunix\b/i,
  /\blinux\b/i,
  /\bpki\b/i,
  /\bsoc\b/i,
  /\biam\b/i,
  /\btest automation\b/i,
  /\bquality assurance\b/i,
  /\bembedded\b/i,
  /\bfirmware\b/i,
  /\bsemiconductor\b/i,
  /\bpcb\b/i,
  /\buav\b/i,
  /\biec 61850\b/i,
  /\bopc\b/i,
  /\bmodbus\b/i,
  /\bdnp3\b/i,
  /\bprofinet\b/i,
  /\bfieldbus\b/i,
]

const hasTechnicalDomainEvidence = (job = {}, normalizedTitle = null) => {
  const titleEvidence = [
    job.title,
    normalizedTitle,
    job.jobCategory,
    job.department,
  ]
    .filter(Boolean)
    .join(' ')

  const hasTechnicalTitleHint = TECHNICAL_TITLE_HINT_PATTERN.test(titleEvidence)
  if (hasTechnicalTitleHint) {
    return true
  }

  const bodyEvidence = [
    job.minimumQualification,
    job.preferredQualification,
    job.description,
    job.jobDescription,
    // Only trust structured skill tags when the title already looks technical.
    hasTechnicalTitleHint ? normalizeStringArray(job.requiredSkills).join(' ') : null,
  ]
    .filter(Boolean)
    .join(' ')

  const matchedBodyHints = TECHNICAL_BODY_HINT_PATTERNS
    .filter((pattern) => pattern.test(bodyEvidence))

  return matchedBodyHints.length >= 2
}

const inferEngineeringDomain = (job = {}, normalizedTitle, providerSource = null) => {
  const explicitDomain = normalizeString(job.engineeringDomain)
  if (explicitDomain && explicitDomain !== 'Unknown') return explicitDomain

  const titleBasedDomain = {
    'Software Engineer': 'Software Engineering',
    'Data Engineer': 'Data Engineering',
    'Machine Learning Engineer': 'Machine Learning',
    'DevOps Engineer': 'DevOps',
    'Security Engineer': 'Security',
    'Network Engineer': 'Networking',
    'Firmware Engineer': 'Firmware',
    'Embedded Engineer': 'Embedded Systems',
    'RTL Engineer': 'RTL',
    'Verification Engineer': 'Verification',
    'Mechanical Engineer': 'Mechanical',
    'Electrical Engineer': 'Electrical',
    'Civil Engineer': 'Civil',
    'Automation Engineer': 'Automation',
    'Robotics Engineer': 'Robotics',
  }
  if (normalizedTitle && titleBasedDomain[normalizedTitle]) {
    return titleBasedDomain[normalizedTitle]
  }

  const roleDomain = normalizeString(job.primaryRoleDomain)
  if (roleDomain && ROLE_DOMAIN_TO_ENGINEERING_DOMAIN[roleDomain]) {
    return ROLE_DOMAIN_TO_ENGINEERING_DOMAIN[roleDomain]
  }

  if (!hasTechnicalDomainEvidence(job, normalizedTitle)) {
    return 'Unknown'
  }

  const haystack = [
    job.title,
    normalizedTitle,
    job.jobCategory,
    job.department,
    job.minimumQualification,
    job.preferredQualification,
    job.description,
    job.jobDescription,
    normalizeStringArray(job.requiredSkills).join(' '),
  ]
    .filter(Boolean)
    .join(' ')

  const sourceBasedDomain = inferSourceEngineeringDomain(job, normalizedTitle, providerSource)
  if (sourceBasedDomain) return sourceBasedDomain

  const matchedRule = ENGINEERING_DOMAIN_RULES.find((rule) => rule.pattern.test(haystack))
  if (matchedRule) return matchedRule.value

  return 'Unknown'
}

const inferRemoteStatus = (job = {}) => {
  const explicitStatus = normalizeString(job.remoteStatus)
  if (explicitStatus) return explicitStatus

  const values = [
    job.location,
    ...(Array.isArray(job.locations) ? job.locations : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (!values) return null
  if (job.sourceRemoteStatusUnresolved === true) {
    // Opted-in literal readers require bounded positive arrangement markers.
    // Remove locally negated markers before combining distinct arrangements.
    const positive = values.replace(/\b(?:not|non|no)[-\s]+(?:an?[-\s]+)?(?:remote|hybrid|on[\s-]*site|office)\b/g, ' ')
    const remote = /\bremote\b/.test(positive), hybrid = /\bhybrid\b/.test(positive)
    const onsite = /\bon[\s-]*site\b/.test(positive), office = /\boffice\b/.test(positive)
    if (hybrid || remote && (onsite || office)) return 'Hybrid'
    if (remote) return 'Remote'
    return onsite ? 'On-site' : null
  }
  if (values.includes('remote') && (values.includes('hybrid') || values.includes('office') || values.includes('on-site') || values.includes('onsite'))) {
    return 'Hybrid'
  }
  if (values.includes('hybrid')) return 'Hybrid'
  if (values.includes('remote')) return 'Remote'
  if (/\bon[\s-]*site\b/i.test(values) && !/\b(?:not|non|no)[-\s]+(?:an?\s+)?on[\s-]*site\b/i.test(values)) return 'On-site'
  return job.sourceRemoteStatusUnresolved === true ? null : 'On-site'
}

const inferCountry = (job = {}, provider = {}) => {
  // An adapter's explicit null/blank is unknown source data. The provider's
  // target filter must not manufacture a country for that individual vacancy.
  if (Object.hasOwn(job, 'country')) return normalizeString(job.country)
  if (job.sourceCountryScopeUnresolved === true) return null
  const explicitCountry = normalizeString(provider.countryFilter)
  if (explicitCountry) return explicitCountry

  const location = normalizeString(job.location)
  if (/india/i.test(location || '')) return 'India'
  return null
}

const extractCompanyDomain = (job = {}, provider = {}) => {
  const explicitDomain = normalizeString(job.companyDomain || provider.companyDomain)
  if (explicitDomain) return explicitDomain.toLowerCase()

  for (const candidate of [
    job.companyCareerPage,
    provider.companyCareerPage,
    job.applyUrl,
    job.link,
    job.sourceUrl,
  ]) {
    const url = normalizeUrl(candidate)
    if (!url) continue
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase()
  }

  return null
}

const normalizeDate = (value) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const GENERIC_EXPERIENCE_LABEL_PATTERN = /^(?:experienced professionals?|professional(?:s)?|entry level|junior level|mid(?:-| )level|senior(?:-| )level|associate(?: level)?)$/i
const NUMERIC_EXPERIENCE_PATTERN = /\d+(?:\.\d+)?\s*(?:-|to|\+)?\s*\d*(?:\.\d+)?\s*(?:years?|yrs?|months?)\b/i
const BARE_NUMERIC_EXPERIENCE_PATTERN = /^\d+(?:\.\d+)?\s*(?:-|to|\+)?\s*\d*(?:\.\d+)?$/i
const EXPERIENCE_CONTEXT_PATTERN = /\b(?:experience|exp\.?|required|preferred|minimum|desired|hands[- ]on|relevant|overall|fresher|graduate|entry[- ]level|intern(?:ship)?|apprentice)\b/i
const INVALID_EXPERIENCE_RANGE_PATTERN = /(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\b/i
const PROFILE_NON_REQUIREMENT_CONTEXT_PATTERN = /\b(?:privacy policy|recruitment purposes|job application|retained for a period|time period|profitability|horizon|next\s+\d+\s+days|planning cycles?|roadmap(?: reviews?)?|quarterly roadmap reviews?|leave\s+per\s+year|contract\s*\(\s*\d+\s*years?\s*\))\b/i
const STRONG_PROFILE_REQUIREMENT_PATTERN = /\b(?:minimum(?:\s+of)?|at[\s-]*least|required|preferred)\s*(?:[a-z]+\s*\(\s*)?\d+(?:\s*\))?(?:\+)?\s*(?:months?|years?|yrs?)\b|\b(?:[a-z]+\s*\(\s*)?\d+(?:\s*\))?(?:\+)?\s*(?:months?|years?|yrs?)\s+of\s+(?:relevant\s+|professional\s+|hands[- ]on\s+|related\s+)?experience\b/i
const MEDIUM_CONFIDENCE_PROFILE_REQUIREMENT_PATTERN = /\b(?:prior|previous|relevant|strong|extensive|demonstrated|demonstrable|proven|hands[- ]on|solid|significant|practical|professional)\b(?:\s+[a-z-]+){0,4}\s+experience\b|\bexperience\s+(?:in|with|as|managing|mentoring|driving|building|leading|working|designing|troubleshooting|conducting|hiring|aligning|partnering|using|developing|untangling|influencing|executing|running|owning)\b/i
const PROFILE_EVIDENCE_TRIM_PATTERNS = [
  /\s+[•·▪●]\s+/u,
  /\s+(?=(?:Responsibilities?|Requirements?|Qualifications?|Preferred Qualifications?|What you(?:'ll| will)\s+bring|What you've got|Why Collaborate|Opportunity to)\b)/i,
]

const trimProfileEvidence = (value) => {
  const normalized = normalizeString(value)
  if (!normalized) return null

  let cutoffIndex = normalized.length
  for (const pattern of PROFILE_EVIDENCE_TRIM_PATTERNS) {
    const match = pattern.exec(normalized)
    if (!match || match.index <= 0) continue
    cutoffIndex = Math.min(cutoffIndex, match.index)
  }

  return normalizeString(normalized.slice(0, cutoffIndex)) || normalized
}

const normalizeMediumConfidenceProfileEvidence = (experienceProfile = {}, evidence = null) => {
  if (experienceProfile.confidence !== 'medium' || experienceProfile.hasExplicitExperience !== true) {
    return null
  }

  const normalizedEvidence = trimProfileEvidence(evidence ?? experienceProfile.evidence)
  if (!normalizedEvidence) return null
  if (!MEDIUM_CONFIDENCE_PROFILE_REQUIREMENT_PATTERN.test(normalizedEvidence)) return null
  if (
    !NUMERIC_EXPERIENCE_PATTERN.test(normalizedEvidence)
    && !/\bno experience required\b/i.test(normalizedEvidence)
  ) {
    return null
  }
  if (
    PROFILE_NON_REQUIREMENT_CONTEXT_PATTERN.test(normalizedEvidence)
    && !STRONG_PROFILE_REQUIREMENT_PATTERN.test(normalizedEvidence)
  ) {
    return null
  }

  return normalizedEvidence
}

const normalizeProfileEvidence = (experienceProfile = {}) => {
  const evidence = trimProfileEvidence(experienceProfile.evidence)
  if (!evidence) return null
  if (experienceProfile.confidence !== 'high') {
    return normalizeMediumConfidenceProfileEvidence(experienceProfile, evidence)
  }

  const rangeMatch = evidence.match(INVALID_EXPERIENCE_RANGE_PATTERN)
  if (rangeMatch) {
    const minimumYears = Number.parseFloat(rangeMatch[1])
    const maximumYears = Number.parseFloat(rangeMatch[2])
    if (Number.isFinite(minimumYears) && Number.isFinite(maximumYears) && maximumYears < minimumYears) {
      return null
    }
  }

  return evidence
}

const sanitizeExperienceProfile = (experienceProfile = {}) => {
  const evidence = normalizeProfileEvidence(experienceProfile)
  if (!evidence) {
    if (!normalizeString(experienceProfile.evidence)) return experienceProfile

    return {
      ...experienceProfile,
      minimumYears: null,
      maximumYears: null,
      isOpenEnded: false,
      preferredMinimumYears: null,
      hasExplicitExperience: false,
      confidence: 'low',
      evidence: null,
      experienceBucket: 'unspecified',
    }
  }

  const minimumYears = Number.parseFloat(experienceProfile.minimumYears)
  const maximumYears = Number.parseFloat(experienceProfile.maximumYears)
  if (!Number.isFinite(minimumYears) || (Number.isFinite(maximumYears) && maximumYears !== minimumYears) || minimumYears > 2) {
    return experienceProfile
  }

  const rawText = normalizeString(experienceProfile.rawText)
  if (!rawText) return experienceProfile

  if (
    PROFILE_NON_REQUIREMENT_CONTEXT_PATTERN.test(rawText)
    && !STRONG_PROFILE_REQUIREMENT_PATTERN.test(rawText)
  ) {
    return {
      ...experienceProfile,
      minimumYears: null,
      maximumYears: null,
      isOpenEnded: false,
      hasExplicitExperience: false,
      confidence: 'low',
      evidence: null,
      experienceBucket: 'unspecified',
    }
  }

  const roundedYears = Math.round(minimumYears)
  const yearPattern = roundedYears === 1
    ? /\b(?:one\s*\(\s*1\s*\)|1)\s*years?\b/i
    : new RegExp(`\\b${roundedYears}\\s*years?\\b`, 'i')
  const match = yearPattern.exec(rawText)
  if (!match) return experienceProfile

  const context = rawText.slice(
    Math.max(0, match.index - 140),
    Math.min(rawText.length, match.index + match[0].length + 180),
  )
  if (PROFILE_NON_REQUIREMENT_CONTEXT_PATTERN.test(context) && !STRONG_PROFILE_REQUIREMENT_PATTERN.test(context)) {
    return {
      ...experienceProfile,
      minimumYears: null,
      maximumYears: null,
      isOpenEnded: false,
      hasExplicitExperience: false,
      confidence: 'low',
      evidence: null,
      experienceBucket: 'unspecified',
    }
  }

  return experienceProfile
}

const sanitizeSignalsExperience = (signals = {}) => {
  const experienceProfile = sanitizeExperienceProfile(signals.experienceProfile || {})
  if (experienceProfile === signals.experienceProfile) return signals

  return {
    ...signals,
    experienceProfile,
    experienceBucket: experienceProfile.experienceBucket || 'unspecified',
    experienceYears: [],
    confidence: {
      ...(signals.confidence || {}),
      experience: experienceProfile.confidence || 'low',
    },
  }
}

const shouldPreferProfileEvidence = (explicitExperience, experienceProfile = {}) => {
  const evidence = normalizeProfileEvidence(experienceProfile)
  if (!evidence) return false
  if (GENERIC_EXPERIENCE_LABEL_PATTERN.test(String(explicitExperience ?? ''))) {
    return NUMERIC_EXPERIENCE_PATTERN.test(evidence)
  }

  const explicitProfile = extractJobFilterSignals({
    experienceRequired: explicitExperience,
  })?.experienceProfile || {}
  const explicitEvidence = normalizeString(explicitProfile.evidence)

  if (explicitEvidence && BARE_NUMERIC_EXPERIENCE_PATTERN.test(String(explicitExperience ?? ''))) {
    return true
  }
  if (!explicitEvidence) return true
  if (explicitProfile.confidence === 'high') return false

  return !EXPERIENCE_CONTEXT_PATTERN.test(String(explicitExperience ?? ''))
    && explicitEvidence !== evidence
}

export const inferMissingExperienceRequired = (job = {}, experienceRequired, experienceProfile = {}) => {
  const hasHighConfidenceNoExperienceProfile = (
    experienceProfile.confidence === 'high'
    && experienceProfile.minimumYears === 0
    && experienceProfile.maximumYears === 0
  )
  const explicitExperience = normalizeString(experienceRequired)
  const profileEvidence = normalizeProfileEvidence(experienceProfile)
  if (explicitExperience) {
    return shouldPreferProfileEvidence(explicitExperience, experienceProfile)
      ? (hasHighConfidenceNoExperienceProfile
          ? 'No experience required'
          : profileEvidence)
      : explicitExperience
  }

  if (job.publicExperienceChecked === true) {
    return profileEvidence
      ? (hasHighConfidenceNoExperienceProfile ? 'No experience required' : profileEvidence)
      : null
  }

  if (profileEvidence) {
    return hasHighConfidenceNoExperienceProfile
      ? 'No experience required'
      : profileEvidence
  }

  if (job.jobType === 'Internship' || job.employmentType === 'Internship') {
    return 'No experience required'
  }

  return null
}

export const normalizeScrapedJob = (job = {}, provider = {}) => {
  job = withSourceDescription(job);
  const identity = normalizeScrapedJobIdentity(job, provider)
  // Keep the employer title as scan evidence; display whitespace may differ.
  const sourceTitle = String(job.originalTitle || job.title || '').trim() || null
  const originalTitle = identity.title
  const normalizedTitle = normalizeTitle(originalTitle)
  const applyUrl = identity.applyUrl
  const sourceUrl = identity.sourceUrl
  const hasEmailApplication = /^mailto:/i.test(String(job.applyUrl || job.link || '').trim())
  const scrapedTimestamp = normalizeDate(job.scrapedTimestamp || job.scrapedAt) || new Date()
  const publicExperienceChecked = (
    job.publicExperienceChecked === true
    || hasTrustedPublicExperienceSurface({
      ...job,
      applyUrl,
      sourceUrl,
    }, provider)
  )
  const publicationDate = resolveJobPublicationDate(job, { observationDate: scrapedTimestamp })
  const resolvedPostedAt = publicationDate.date || scrapedTimestamp
  const requiredSkills = filterSkillNamesTagsForSource(
    normalizeStringArray(job.requiredSkills),
    job.source || provider.source,
  )
  const employmentType = inferEmploymentType(job)
  const experienceLevel = inferExperienceLevel(job)
  const normalizedJob = {
    ...job,
    sourceDescription: job.jobDescription,
    ...normalizeEmployerDisclosures(job),
    sourceEmploymentType: preserveSourceText(job.sourceEmploymentType || job.atsEmploymentType || job.rawEmploymentType
      || (job.employmentTypeProvenance === 'source' ? job.employmentType : null)),
    sourceExperienceRequired: preserveSourceText([job.sourceExperienceRequired, job.experienceRequiredProvenance === 'source' ? job.experienceRequired : null]
      .find(value => value !== null && value !== undefined && value !== '')),
    title: originalTitle,
    company: identity.company,
    originalTitle: sourceTitle,
    normalizedTitle,
    jobCategory: normalizeInlineText(job.jobCategory) || normalizedTitle,
    engineeringDomain: inferEngineeringDomain(job, normalizedTitle, job.source || provider.source),
    employmentType,
    experienceLevel,
    jobType: resolveJobType({ ...job, employmentType, experienceLevel }),
    location: identity.location,
    city: identity.city,
    state: normalizeString(job.state),
    country: inferCountry(job, provider),
    remoteStatus: inferRemoteStatus(job),
    department: normalizeString(job.department),
    jobDescription: normalizeDescription(job.jobDescription || job.description),
    minimumQualification: preserveSourceText(job.minimumQualification),
    preferredQualification: preserveSourceText(job.preferredQualification),
    requiredSkills,
    experienceRequired: normalizeString(job.experienceRequired),
    salary: normalizeString(job.salary),
    jobId: identity.jobId,
    requisitionId: identity.requisitionId,
    employerPostedAt: resolveEmployerPostedAt(job),
    postedAt: resolvedPostedAt,
    postingDate: resolvedPostedAt,
    postedAtProvenance: publicationDate.provenance,
    postedAtProvenanceValue: resolvedPostedAt.toISOString(),
    closingDate: normalizeDate(job.closingDate),
    applyUrl,
    ...(hasEmailApplication && sourceUrl ? { applicationUrlIsGeneric: true } : {}),
    sourceUrl: sourceUrl || applyUrl,
    companyCareerPage: normalizeUrl(job.companyCareerPage || provider.companyCareerPage),
    companyDomain: extractCompanyDomain(job, provider),
    atsPlatform: normalizeString(job.atsPlatform || provider.atsPlatform),
    publicExperienceChecked,
    scrapedAt: scrapedTimestamp,
    scrapedTimestamp,
  }

  const signals = sanitizeSignalsExperience(extractJobFilterSignals(normalizedJob))
  const inferredExperienceRequired = inferMissingExperienceRequired(
    normalizedJob,
    normalizedJob.experienceRequired,
    signals.experienceProfile,
  )
  const finalSignals = inferredExperienceRequired !== normalizedJob.experienceRequired
    ? sanitizeSignalsExperience(extractJobFilterSignals({
        ...normalizedJob,
        experienceRequired: inferredExperienceRequired,
      }))
    : signals
  const finalJob = {
    ...normalizedJob,
    experienceRequired: inferredExperienceRequired,
    ...finalSignals,
  }
  const finalExperienceLevel = inferExperienceLevel(finalJob)

  const classifiedJob = applyClassification({
    ...finalJob,
    experienceLevel: finalExperienceLevel,
    jobType: resolveJobType({
      ...finalJob,
      experienceLevel: finalExperienceLevel,
    }),
  })
  return { ...classifiedJob, jobType: normalizePublicJobType(classifiedJob.jobType) }
}
import { normalizeEmployerDisclosures } from '../../src/utils/employerDisclosures.js'
