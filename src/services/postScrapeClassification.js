import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { buildClassificationInput, hashClassificationInput, resolveClassification, getAuthoritativeClassification, RUNTIME_HASH, CLASSIFICATION_FIELDS } from './jobClassificationPolicy.js'
import { recoverClassificationSourceTitle } from './classificationSourceTitle.js'
import { normalizePublicJobType } from '../utils/publicJobTypeLabel.js'
import { collectRecruitmentFacts, entryLevelVacancyTitle, fresherVacancyTitle, hasAlternativeFresherPath, hasFiniteAppointment } from './jobRecruitmentPolicy.js'
import { isExplicitTestPosting } from './classificationSourceQuality.js'

export const GLICLASS_CONFIG = JSON.parse(readFileSync(new URL('../../classification/gliclass/model.json', import.meta.url)))
const runtimeHash = createHash('sha256').update(RUNTIME_HASH).update([
  '../../classification/gliclass/model.json', '../../classification/gliclass/requirements.txt',
  '../../classification/gliclass/worker.py', '../../classification/gliclass/runtime.py', './postScrapeClassification.js', './classificationSourceTitle.js',
  '../../scripts/gliclassWorker.js',
].map(file => readFileSync(new URL(file, import.meta.url)).toString().replace(/\r\n/g, '\n')).join('\n')).digest('hex')
export const GLICLASS_IDENTITY = {
  modelRevision: GLICLASS_CONFIG.revision, runtimeVersion: GLICLASS_CONFIG.runtimeVersion,
  runtimeHash, calibrationHash: 'uncalibrated',
}

const employerEmploymentFacts = input => {
  // Keep metadata interpretation consistent for source policy and model vetoes.
  const fieldValue = match => ({ field: match[1], value: /^contractual$/i.test(match[2]) ? 'contract' : match[2] })
  const fields = [...input.body.matchAll(/(?:^|\n)\s*(contract\s+type|employment\s+type|engagement\s+type|schedule|position\s+type)\s*[:\-]?\s*(internship|full[- ]time|part[- ]time|fixed[- ]term|contractual|contract|consultant|temporary|permanent)\b/gi)]
    .map(fieldValue)
  // Some employer pages flatten a metadata block beginning with Job Title.
  // A field mentioned in prose about maintaining vendor records is not a value.
  fields.push(...[...input.body.matchAll(/(?:^|\n)\s*job\s+title\s*:[^:\n.!?;]{1,200}?\b(engagement\s+type)\s*:\s*(internship|full[- ]time|part[- ]time|fixed[- ]term|contractual|contract|consultant|temporary|permanent)\b/gi)]
    .map(fieldValue))
  // "Job Type" may also name an occupation. Recognize the observed permanent
  // employment value without treating "Contract Accounting" as a contract.
  const permanentJobType = /(?:^|\n|\bRegular\s+)\s*job\s+type\s*[:\-]?\s*permanent(?:[\t ]+contract)?(?=[\t ]*(?:\n|$|job\s+posting\s+date\s*:))/i.test(input.body)
  // A complete "[employer] Contract Employee" value identifies employment;
  // occupation names such as Contract Accounting and Employee Relations do not.
  const contractEmployee = [...input.body.matchAll(/(?:^|\n)\s*job\s+type\s*[:\-]?\s*((?:[a-z][\w&.-]*[\t ]+)?contract[\t ]+employee)(?=[\t ]*(?:\n|$))/gi)]
    .some(match => !/^(?:permanent|regular|non|not|no|never)[\t ]/i.test(match[1]))
  const finiteFixedTermTitle = [...input.title.matchAll(/\b(?:\d+(?:\.\d+)?|one|two|three|six|twelve)[- ]+(?:years?|months?)[- ]+fixed[- ]term[- ]+contract\b/gi)]
    .some(match => !/\b(?:not|no|never)\s+(?:(?:on|an?|for)\s+){0,3}$/i.test(input.title.slice(0, match.index)))
  const finiteFixedTerm = finiteFixedTermTitle || hasFiniteAppointment(input.body)
  const contractField = fields.find(field => /^(?:contract|engagement)\s+type$/i.test(field.field))?.value
    || fields.find(field => /^employment\s+type$/i.test(field.field) && /^(?:contract|consultant|temporary|fixed[- ]term)$/i.test(field.value))?.value
    || (contractEmployee || finiteFixedTerm ? 'contract' : undefined)
  const hoursOnly = /^full[- ]?time$/i.test(input.sourceEmploymentType.trim())
  const permanent = permanentJobType || [input.sourceEmploymentType, ...fields.map(field => field.value)].some(value => /\bpermanent\b/i.test(value)
    && !/\b(?:non[- ]permanent|not\s+(?:a\s+)?permanent)\b/i.test(value))
  return {
    type: (hoursOnly && contractField ? contractField : input.sourceEmploymentType) || contractField || fields[0]?.value || (permanentJobType ? 'permanent' : undefined),
    permanent, conflicting: finiteFixedTerm && permanent,
  }
}

export const postScrapeInput = (job, { now = new Date(), identity = GLICLASS_IDENTITY } = {}) => {
  const input = buildClassificationInput(job, { now, identity })
  const sourceTitleRecovery = recoverClassificationSourceTitle(job)
  if (!sourceTitleRecovery) return input
  const recovered = { ...input, title: sourceTitleRecovery.recoveredTitle, sourceTitleRecovery }
  return { ...recovered, inputHash: hashClassificationInput(recovered) }
}

export function classificationShard(key, count) {
  if (!Number.isSafeInteger(count) || count < 1) throw new Error('Invalid shard count')
  return parseInt(createHash('sha256').update(String(key)).digest('hex').slice(0, 8), 16) % count
}

// Include every source input in the Mongo compare-and-set: a concurrent scrape
// or rewrite cannot publish a decision made from a different description.
export const SOURCE_INPUT_FIELDS = ['title', 'originalTitle', 'sourceDescription', 'description', 'jobDescription', 'sourceContentHash',
  'descriptionRewrite.status', 'descriptionRewrite.inputHash', 'descriptionRewrite.policyVersion',
  'descriptionRewrite.modelRevision', 'descriptionRewrite.runtimeTag', 'descriptionRewrite.publishedAt',
  'sourceUrl', 'applyUrl', 'link',
  'sourceEmploymentType', 'atsEmploymentType', 'rawEmploymentType', 'employmentTypeProvenance', 'employmentType',
  'minimumQualification', 'preferredQualification', 'qualifications', 'responsibilities', 'requirements',
  'sourceExperienceRequired', 'experienceRequired', 'experienceRequiredProvenance',
  'sourceNativeExperienceConflict.kind', 'sourceNativeExperienceConflict.sidebar', 'sourceNativeExperienceConflict.ownRoleRequirement',
  'postedAt', 'postingDate', 'postedAtProvenance', 'postedAtProvenanceValue', 'scrapedAt', 'scrapedTimestamp', 'eligibleBatches', 'eligibleBatchesProvenance', 'status']
export const sourceSnapshotFilter = job => ({ _id: job._id, $and: SOURCE_INPUT_FIELDS.map(field => {
  // Mongoose casts whole embedded documents into schema order, while MongoDB's
  // object equality depends on stored order. Guard the relevant leaf values.
  let value = job
  for (const key of field.split('.')) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) return { [field]: { $exists: false } }
    value = value[key]
  }
  return { [field]: { $eq: value } }
}) })

export const alreadyClassified = (job, input, mode) => job.postClassification?.inputHash === input.inputHash
  && job.postClassification?.status === 'completed' && job.postClassification?.mode === mode

// Refresh an unresolved saved decision using its cached prediction, without model inference.
// Rebuild the original input under its recorded identity so a runtime upgrade is
// distinguishable from a changed employer source or graduation cohort.
export function buildUnspecifiedPublicTypeRepair(job = {}) {
  const saved = job.classification
  const cache = job.postClassification
  const cached = cache?.result?.classification
  if (saved?.resolved?.jobType !== 'Unspecified' || !getAuthoritativeClassification(job)
    || saved.mode !== 'policy' || saved.complete !== true || cache?.mode !== 'policy' || cache.status !== 'completed'
    || !saved.inputHash || cache.inputHash !== saved.inputHash || cached?.inputHash !== saved.inputHash
    || cached.resolved?.jobType !== 'Unspecified' || !Number.isInteger(saved.referenceYear)
    || saved.referenceYear < 1990 || saved.referenceYear > 9999) return null
  const identity = Object.fromEntries(['modelRevision', 'runtimeVersion', 'runtimeHash', 'policyHash', 'calibrationHash']
    .map(key => [key, saved[key]]))
  if (Object.values(identity).some(value => typeof value !== 'string' || !value)) return null
  const referenceDate = new Date(`${saved.referenceYear}-07-01T00:00:00Z`)
  if (postScrapeInput(job, { now: referenceDate, identity }).inputHash !== saved.inputHash) return null
  let refreshed
  try {
    refreshed = resolvePostScrapeClassification(job, cache.result.prediction, { now: referenceDate, mode: 'policy' })
  } catch { return null }
  if (!GLICLASS_CONFIG.labels.includes(refreshed.resolved.jobType)) return null
  return {
    filter: { ...sourceSnapshotFilter(job), jobType: job.jobType,
      'classification.inputHash': saved.inputHash, 'classification.policyVersion': saved.policyVersion,
      'classification.authoritative': true, 'classification.mode': 'policy', 'classification.complete': true,
      'classification.status': saved.status, 'classification.resolved.jobType': 'Unspecified',
      'postClassification.mode': 'policy', 'postClassification.status': 'completed',
      'postClassification.inputHash': saved.inputHash,
      'postClassification.result.classification.inputHash': saved.inputHash,
      'postClassification.result.classification.resolved.jobType': 'Unspecified',
      'postClassification.result.prediction': cache.result.prediction },
    update: { $set: { classification: refreshed,
      ...Object.fromEntries(CLASSIFICATION_FIELDS.map(field => [field, refreshed.resolved[field] ?? null])),
      'postClassification.inputHash': refreshed.inputHash,
      'postClassification.result.classification': refreshed,
    } },
  }
}

export function postScrapePersistencePatch(job, previous, { now = new Date(), mode = 'shadow' } = {}) {
  const input = postScrapeInput(job, { now })
  const prior = previous?.postClassification
  if (alreadyClassified(previous || {}, input, mode)) {
    const classification = prior.result?.classification
    return { set: { postClassification: prior,
      ...(mode === 'policy' && classification?.complete === true ? {
        classification, ...Object.fromEntries(CLASSIFICATION_FIELDS.map(field => [field, classification.resolved[field] ?? null])),
        jobType: normalizePublicJobType(classification.resolved.jobType),
      } : {}),
    }, unset: mode === 'shadow' ? { classification: '' } : {} }
  }
  return { set: { postClassification: { inputHash: input.inputHash, mode, status: 'pending',
    attemptedAt: now, reason: input.incomplete ? 'missing_or_oversized_description' : 'source_requires_classification',
  } }, unset: { classification: '' } }
}

export function sourceGuardedClassification(job, { now = new Date(), mode = 'shadow' } = {}) {
  // Model input may use a validated rewrite; employer eligibility and source-quality
  // checks must use the original evidence even when the rewrite is current.
  const sourceJob = { ...job, descriptionRewrite: null }
  const input = postScrapeInput(sourceJob, { now })
  const guards = []
  if (input.sourceTitleRecovery) guards.push('overcaptured_title_recovered_from_ats_url')
  const description = input.sourceFields.description
  const roleFields = ['minimumQualification', 'qualifications', 'responsibilities', 'requirements']
    .some(field => input.sourceFields[field].length > 20)
  const roleSection = /\b(?:(?:roles?\s+and\s+|key\s+)?responsibilities|(?:minimum|basic|required)\s+qualifications|requirements)\s*:\s*(?!zoom\s+in\b)[a-z][^.\n]{20,}/i.test(description)
  const sourceQualityIssues = []
  if (isExplicitTestPosting(input.title)) sourceQualityIssues.push('non_vacancy_test_posting')
  if (!roleFields && !roleSection) {
    if (/\b(?:how did you know about this opportunity|choose how you'd like to (?:proceed|share your resume)|personal education skills others)\b/i.test(description)) {
      sourceQualityIssues.push('application_form_without_role_description')
    }
    const notices = new Set(description.match(/\bADVT\.\/\d{4}-\d{2}\/\d+\b/gi) || [])
    if (notices.size >= 3 && (description.match(/\bprint application\b/gi) || []).length >= 3) {
      sourceQualityIssues.push('multiple_recruitment_notices_without_role_description')
    }
    if (/\bzoom\s+in\s+zoom\s+out\s+short\s+info\b/i.test(description)
      && /\bexperience\s*:\s*0\s+years\s*-?\s*0\s+months\s+to\s+0\s+years\s*-?\s*0\s+months\b/i.test(description)) {
      sourceQualityIssues.push('empty_responsibilities_zero_experience_default')
    }
  }
  const title = input.title.replace(/_/g, ' ')
  const employmentFacts = employerEmploymentFacts(input)
  const employerType = employmentFacts.type
  if (employmentFacts.conflicting) sourceQualityIssues.push('conflicting_employment_terms')
  let policyJob = { ...sourceJob, title, originalTitle: title }
  if (title !== input.title) guards.push('title_word_separators')
  const policyDescription = input.sourceFields.description.replace(
    /\bexp\s*[-:]\s*(\d+(?:\.\d+)?\s*(?:(?:-|to)\s*\d+(?:\.\d+)?)?\s*(?:\+\s*)?(?:years?|yrs?|months?))\b/gi,
    'Experience: $1\n',
  )
  if (policyDescription !== input.sourceFields.description) {
    policyJob.sourceDescription = policyDescription
    guards.push('abbreviated_experience_field')
  }
  if (employerType && employerType !== input.sourceEmploymentType) {
    policyJob.sourceEmploymentType = employerType
    guards.push('employer_employment_field')
  }
  const occupationTitle = title.replace(/\b(?:service contracts?|contract accounting|contractual operations?|contract admin(?:istration|istrator)?|source[- ]to[- ]contract)\b/ig,
    phrase => phrase.replace(/\bcontracts?|contractual\b/ig, 'agreement'))
  const explicitContract = /\b(?:contractor|temporary|fixed[- ]term|freelance)\b|\(\s*contract\s*\)/i.test(title)
    || /\b(?:contract|temporary|fixed[- ]term)\b/i.test(employerType || '')
    || /\b(?:this (?:role|position|job) is (?:an? )?(?:contract|temporary)|(?:contract|temporary|fixed[- ]term) (?:role|position|employment))\b/i.test(input.body)
  if (occupationTitle !== title && !explicitContract) {
    policyJob = { ...policyJob, title: occupationTitle, originalTitle: occupationTitle }
    guards.push('contract_occupation')
  }
  let result = resolveClassification(policyJob, null, { now, mode, identity: GLICLASS_IDENTITY })
  // Some employers phrase explicit fresher recruitment as an opportunity for
  // freshers. Do not let that wording override a prior experience requirement.
  const fresherOpportunity = /\bwe\s+(?:have|offer)\b[^.\n]{0,100}\bopportunit(?:y|ies)\s+for\s+(?:[a-z]+\s+){0,5}freshers?\b/i.test(input.body)
  const fresherRecruitment = /\b(?:we\s+are\s+(?:currently\s+)?hiring\s+fresh\s+graduates?|freshers?\s+(?:can|may)\s+(?:also\s+)?apply)\b/i.test(description)
  if (!sourceQualityIssues.length && result.resolved.jobType === 'Unspecified' && !input.sourceExperienceRequired
    && (fresherOpportunity || fresherRecruitment)) {
    policyJob.sourceExperienceRequired = 'Fresher'
    result = resolveClassification(policyJob, null, { now, mode, identity: GLICLASS_IDENTITY })
    guards.push(fresherOpportunity ? 'employer_fresher_opportunity' : 'employer_fresher_recruitment')
  }
  if (fresherRecruitment && result.resolved.jobType === 'Full-time Fresher'
    && result.resolved.employerExperienceProfile?.minimumYears > 0) {
    sourceQualityIssues.push('conflicting_role_eligibility')
  }
  if (result.resolved.jobType === 'Full-time Fresher') {
    const facts = collectRecruitmentFacts({ ...input, title })
    if (facts.ambiguousDegreeHistory && hasAlternativeFresherPath({ ...input, title }, facts)) {
      sourceQualityIssues.push('conflicting_role_eligibility')
    }
  }
  if (fresherVacancyTitle(title) && !hasAlternativeFresherPath({ ...input, title })
    && (result.resolved.employerExperienceProfile?.minimumYears > 0
      || collectRecruitmentFacts({ ...input, title: '' }).experienced)) {
    sourceQualityIssues.push('conflicting_role_eligibility')
  }
  if (sourceQualityIssues.length) {
    const reason = sourceQualityIssues.includes('non_vacancy_test_posting') ? 'non_vacancy_test_posting'
      : sourceQualityIssues.includes('conflicting_employment_terms') ? 'conflicting_employment_terms'
      : sourceQualityIssues.includes('conflicting_role_eligibility') ? 'conflicting_role_eligibility' : 'insufficient_role_description'
    result = { ...result, status: 'uncertain', reason,
      resolved: { ...result.resolved, jobType: 'Unspecified', employmentType: null,
        seniority: 'Unknown', experienceLevel: null, experiencePolicy: 'not_stated',
        experienceYears: [], experienceBucket: 'unspecified', experienceBasis: 'unspecified',
        experienceRequired: null, policyEvidence: null,
        experienceProfile: { minimumYears: null, maximumYears: null, isOpenEnded: false,
          preferredMinimumYears: null, hasExplicitExperience: false, confidence: 'low', evidence: null, rawText: null },
      } }
    guards.push(reason)
  }
  // Numeric ambiguity does not erase independently supported employment or
  // eligibility. Withhold the numeric filter and retain the original evidence.
  if (result.numericSourceIssues?.length) {
    const codes = result.numericSourceIssues.map(issue => issue.code)
    sourceQualityIssues.push(...codes)
    guards.push(...codes)
    const profile = { minimumYears: null, maximumYears: null, isOpenEnded: false,
      preferredMinimumYears: result.resolved.experienceProfile?.preferredMinimumYears ?? null,
      hasExplicitExperience: true, confidence: 'low',
      evidence: result.numericSourceIssues.map(issue => issue.evidence).join('; ').slice(0, 160), rawText: null }
    result = { ...result, status: 'uncertain', reason: 'ambiguous_numeric_experience',
      resolved: { ...result.resolved, experienceYears: [], experienceBucket: 'unspecified',
        experienceProfile: profile, employerExperienceProfile: { ...profile, experienceBucket: 'unspecified' },
        experienceRequired: null, experienceBasis: 'unspecified' } }
  }
  // Provenance refers to the untouched employer input, including the original title.
  return { ...result, inputHash: postScrapeInput(job, { now }).inputHash, evidenceContext: input.body.slice(0, 160),
    ...(input.sourceTitleRecovery ? { sourceTitleRecovery: input.sourceTitleRecovery } : {}),
    sourceGuards: guards, sourceQualityIssues }
}

export function resolvePostScrapeClassification(job, prediction, { now = new Date(), mode = 'shadow' } = {}) {
  if (!['shadow', 'policy'].includes(mode)) throw new Error('Post-scrape mode must be shadow or policy')
  if (!prediction?.fullDescriptionCovered || !Number.isInteger(prediction.windows) || prediction.windows < 1) {
    throw new Error('Complete source coverage is required')
  }
  const entries = Object.entries(prediction.scores || {})
  if (entries.length !== 4 || GLICLASS_CONFIG.labels.some(label => !Number.isFinite(prediction.scores[label])
    || prediction.scores[label] < 0 || prediction.scores[label] > 1)
    || Math.abs(entries.reduce((sum, [, score]) => sum + score, 0) - 1) > .002) throw new Error('Invalid model scores')
  const ranked = entries.sort((a, b) => b[1] - a[1])
  if (prediction.modelLabel !== ranked[0][0]) throw new Error('Invalid model label')
  const base = sourceGuardedClassification(job, { now, mode })
  const input = postScrapeInput(job, { now })
  if (input.incomplete) throw new Error('Missing or oversized source description')
  const resolved = { ...base.resolved }
  const modelFallback = resolved.jobType === 'Unspecified' && !base.sourceQualityIssues.length
  let permanentEmploymentConflict = false
  if (modelFallback && prediction.modelLabel === 'Contract') {
    const employerInput = postScrapeInput({ ...job, descriptionRewrite: null }, { now })
    permanentEmploymentConflict = employerEmploymentFacts(employerInput).permanent
  }
  const acceptedModelFallback = modelFallback && !permanentEmploymentConflict
  if (acceptedModelFallback) resolved.jobType = prediction.modelLabel
  const sourceQualityIssues = [...base.sourceQualityIssues,
    ...(permanentEmploymentConflict ? ['model_conflicts_with_permanent_employment'] : [])]
  const reviewReasons = [...sourceQualityIssues]
  if (modelFallback && prediction.modelLabel === 'Full-time Experienced'
    && /\b(?:trainee|graduate|apprentice|entry[- ]level|freshers?)\b/i.test(input.title.replace(/_/g, ' '))) {
    reviewReasons.push('entry_level_title_with_experienced_prediction')
  }
  if (modelFallback && Buffer.byteLength(input.body, 'utf8') <= 100) reviewReasons.push('sparse_role_description')
  if (modelFallback && ranked[0][1] <= .5) reviewReasons.push('model_fallback_without_majority')
  if (resolved.jobType === 'Full-time Experienced' && entryLevelVacancyTitle(input.title)
    && (base.resolved.employerExperienceProfile?.minimumYears > 0
      || collectRecruitmentFacts({ ...input, title: '' }).experienced)) {
    reviewReasons.push('entry_level_title_with_required_experience')
  }
  // Source-backed rules guard numeric eligibility, contract roles, and internships.
  // The model supplies a category only when usable source text leaves it unresolved;
  // its uncalibrated score never establishes numeric experience or repairs bad input.
  return { ...base, resolved, reviewReasons, sourceQualityIssues, complete: true, windows: prediction.windows,
    status: permanentEmploymentConflict ? 'uncertain' : base.status,
    decisionSource: acceptedModelFallback ? 'model_fallback' : 'source_policy',
    reason: permanentEmploymentConflict ? 'model_conflicts_with_permanent_employment' : base.sourceQualityIssues.length ? base.reason : 'zero_shot_uncalibrated',
    comparison: { modelJobType: prediction.modelLabel, logicJobType: base.resolved.jobType,
      agreement: prediction.modelLabel === base.resolved.jobType },
    decisions: { jobType: { label: prediction.modelLabel, probability: ranked[0][1],
      probabilities: prediction.scores, margin: ranked[0][1] - ranked[1][1] } },
  }
}
