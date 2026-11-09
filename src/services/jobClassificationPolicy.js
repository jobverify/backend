import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { extractJobFilterSignals } from '../utils/jobFilterSignals.js';
import { selectClassificationDescription } from './classificationDescription.js';
import { JOB_CLASSIFICATION_POLICY_VERSION } from '../utils/jobClassificationVersion.js';
import { resolveRecruitmentPolicy, collectRecruitmentFacts } from './jobRecruitmentPolicy.js';
import { normalizePublicJobType, PUBLIC_JOB_TYPES } from '../utils/publicJobTypeLabel.js';
import { resolveJobPublicationDate } from '../utils/jobPublicationDate.js';
import { getSourceDescription } from '../utils/jobSourceContent.js';
import { isPlaceholderClassificationText, numericExperienceSourceIssues, maskFragmentedExperienceNumbers, companyHistoryExperienceField, maskScreenedThirdPartyDegreeRequirements } from './classificationSourceQuality.js';

const normalizedBytes = relative => readFileSync(new URL(`../../${relative}`, import.meta.url)).toString('utf8').replace(/\r\n/g, '\n');
const policyBytes = normalizedBytes('classification/policy.json');
export const CLASSIFICATION_POLICY = JSON.parse(policyBytes);
if (CLASSIFICATION_POLICY.version !== JOB_CLASSIFICATION_POLICY_VERSION) throw new Error('Classification policy version mismatch');
export const CLASSIFICATION_MODEL = JSON.parse(readFileSync(new URL('../../classification/gliclass/model.json', import.meta.url)));
export const POLICY_HASH = createHash('sha256').update(policyBytes).digest('hex');
export const RUNTIME_HASH = createHash('sha256').update(JSON.stringify([
  'classification/gliclass/model.json', 'classification/gliclass/requirements.txt', 'classification/gliclass/worker.py', 'classification/gliclass/runtime.py',
  'src/services/jobClassificationPolicy.js', 'src/services/classificationDescription.js', 'src/services/classificationSourceQuality.js', 'src/services/jobRecruitmentPolicy.js', 'src/utils/jobClassificationVersion.js', 'src/utils/jobFilterSignals.js', 'src/utils/jobSourceContent.js', 'src/utils/jobPublicationDate.js',
  'src/utils/publicJobTypeLabel.js', 'src/constants/preferredJobTypes.js',
].map(relative => [relative, createHash('sha256').update(normalizedBytes(relative)).digest('hex')]))).digest('hex');
const PUBLIC_TYPES = ['Intern', 'Full-time Fresher', 'Full-time Experienced', 'Contract', 'Others', 'Unspecified'];
export const CLASSIFICATION_FIELDS = ['jobType', 'employmentType', 'experienceLevel', 'seniority', 'experienceYears', 'experienceBucket', 'experienceProfile', 'experienceRequired', 'experienceBasis'];
const EMPLOYMENT = { full_time: 'Full-time', internship: 'Internship', contract: 'Contract', other: 'Other', unspecified: null };

export const cleanSourceText = (value) => {
  let text = Array.isArray(value) ? value.join('\n') : String(value ?? '');
  // Some ATS APIs return escaped (occasionally twice escaped) HTML. Decode
  // before recognizing tags so markup does not become model input or join sections.
  for (let pass = 0; pass < 3; pass++) {
    const decoded = text.replace(/&#(x[0-9a-f]+|\d+);/gi, (match, code) => {
      const point = code.toLowerCase().startsWith('x') ? parseInt(code.slice(1), 16) : Number(code);
      return point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
    }).replace(/&(nbsp|amp|lt|gt|quot|apos);/gi, (_, entity) => ({ nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[entity.toLowerCase()]);
    if (decoded === text) break;
    text = decoded;
  }
  if (!/<[a-z][\s\S]*>/i.test(text)) return text.replace(/\r/g, '').replace(/[\t ]+/g, ' ').trim();
  return text.replace(/<(script|style|nav|footer|header|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\/?(?:br|p|li|div|h[1-6]|section|tr)\b[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (match, code) => {
      const point = code.toLowerCase().startsWith('x') ? parseInt(code.slice(1), 16) : Number(code);
      return point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
    }).replace(/&(nbsp|amp|lt|gt|quot|apos);/gi, (_, entity) => ({ nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[entity.toLowerCase()])
    .replace(/\r/g, '').replace(/[\t ]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
};

export const hashClassificationInput = (input, identity = {}) => {
  const { inputHash: _inputHash, incomplete: _incomplete, ...canonical } = input;
  return createHash('sha256').update(JSON.stringify({ ...canonical, ...identity })).digest('hex');
};

export const isTitleOnlyClassificationSource = (job = {}) => {
  const caption = value => cleanSourceText(value).replace(/\s+/g, ' ').trim().toLowerCase();
  const source = caption(getSourceDescription(job));
  return Boolean(source && [job.originalTitle, job.title].some(title => source === caption(title)));
};

export const buildClassificationInput = (job = {}, { now = new Date(), identity = {} } = {}) => {
  const selectedDescription = selectClassificationDescription(job);
  const sourceDescription = cleanSourceText(getSourceDescription(job));
  const referenceYear = Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', year: 'numeric' }).format(now));
  // These opt-in fields are employer facts. employmentType/jobType/experienceLevel may already be inferred by a scraper.
  const sourceEmploymentType = cleanSourceText(job.sourceEmploymentType || job.atsEmploymentType || job.rawEmploymentType
    || (job.employmentTypeProvenance === 'source' ? job.employmentType : ''));
  const sourceFields = {
    // A role caption is not an employer description. An old rewrite cannot
    // supply missing source evidence; independently stated fields remain usable.
    description: isTitleOnlyClassificationSource(job) || isPlaceholderClassificationText(sourceDescription)
      ? '' : cleanSourceText(selectedDescription.text),
    minimumQualification: cleanSourceText(job.minimumQualification), preferredQualification: cleanSourceText(job.preferredQualification),
    qualifications: cleanSourceText(job.qualifications), responsibilities: cleanSourceText(job.responsibilities), requirements: cleanSourceText(job.requirements),
    experienceRequired: cleanSourceText([job.sourceExperienceRequired, job.experienceRequiredProvenance === 'source' ? job.experienceRequired : null]
      .find(value => value !== null && value !== undefined && value !== '')),
  };
  for (const [field, value] of Object.entries(sourceFields)) {
    if (isPlaceholderClassificationText(value) && !(field === 'experienceRequired' && /^\d$/.test(value))) sourceFields[field] = '';
  }
  const body = [...new Set([
    sourceFields.description,
    ...Object.entries(sourceFields).filter(([key, value]) => key !== 'description' && value).map(([key, value]) => `${{
      minimumQualification: 'Minimum qualifications', preferredQualification: 'Preferred qualifications', qualifications: 'Qualifications',
      responsibilities: 'Responsibilities', requirements: 'Requirements', experienceRequired: 'Required professional experience',
    }[key]}:\n${value}`),
  ].filter(Boolean))].join('\n');
  const publicationDate = resolveJobPublicationDate(job);
  const validPosted = publicationDate.provenance === 'source' && publicationDate.date
    ? publicationDate.date.toISOString().slice(0, 10) : null;
  const input = {
    title: cleanSourceText(job.originalTitle || job.title), body, sourceFields, sourceEmploymentType,
    descriptionOrigin: selectedDescription.origin, descriptionIdentity: selectedDescription.identity,
    sourceExperienceRequired: sourceFields.experienceRequired,
    eligibleBatches: [...new Set((job.eligibleBatchesProvenance === 'source' ? job.eligibleBatches || [] : []).map(Number).filter(year => Number.isInteger(year) && year >= 1990 && year <= referenceYear + 10))].sort(),
    postedDate: validPosted, referenceYear,
    eligibleBatchesProvenance: job.eligibleBatchesProvenance === 'source' ? 'source' : null,
  };
  const runtimeIdentity = {
    modelRevision: CLASSIFICATION_MODEL.revision, runtimeVersion: CLASSIFICATION_MODEL.runtimeVersion,
    policyHash: POLICY_HASH, runtimeHash: RUNTIME_HASH, calibrationHash: 'uncalibrated', ...identity,
  };
  const inputHash = hashClassificationInput(input, runtimeIdentity);
  return { ...input, ...runtimeIdentity, inputHash, incomplete: !body || Buffer.byteLength(body, 'utf8') > CLASSIFICATION_MODEL.maxInputBytes };
};

const finiteYear = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 40;
const emptyProfile = () => ({ minimumYears: null, maximumYears: null, isOpenEnded: false, preferredMinimumYears: null, hasExplicitExperience: false, confidence: 'low', evidence: null, rawText: null });
const splitPreferenceText = (text, input) => {
  const required = [], preferred = [];
  let preferredSection = false;
  let preferredQualificationSection = false;
  const sectionText = text
    // An explicitly labeled fresher-to-N interval starts at zero. Interpret
    // this only in numeric parsing; preserve the complete canonical source.
    .replace(/(^|\n)([\t ]*(?:[-*\u2022][\t ]+)?experience)[\t ]*[:=-][\t ]*freshers?[\t ]+to[\t ]+(\d+(?:\.\d+)?)[\t ]*(years?|yrs?|months?)\b/gi, '$1$2: 0-$3 $4')
    .replace(/\b(\d+(?:\.\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+or\s+more\s+(years?|yrs?|months?)\b/gi, '$1+ $2')
    .replace(/\b((?:(?:minimum|basic|required|preferred|desirable|desired|optional|nice[- ]to[- ]have|good[- ]to[- ]have|bonus)\s+)?(?:education\s+(?:and|&)\s+experience|experience|education|qualifications?|requirements?))\s*:/gi, '\n$1:\n')
    // Flattened industry preferences do not make a preceding work-history
    // requirement optional ("8 years ... Preferred Industry: ...").
    .replace(/\bpreferred\s+industr(?:y|ies)\s*:/gi, '\n$&')
    .replace(/\b((?:not\s+(?:(?:strictly|necessarily|always)\s+)?)?(?:mandatory|desirable|preferred|optional))\s*:/gi, '\n$1:\n')
    .replace(/\byou\s+will\s+be\s+successful\s+in\s+this\s+role\s+if\s+you\s+have\s*:/gi, '\nRequired qualifications:\n');
  const candidateQuantity = new RegExp('\\b(?:candidates?|applicants?|you)\\s+(?:must|need\\s+to|are\\s+required\\s+to)\\s+(?:have|bring|possess)\\s+('
    + NUMERIC_SOURCE_PATTERN.source + ')\\s+(?:of\\s+)?(?:(?:professional|work|relevant)\\s+)?(?:experience|background)\\b', 'gi');
  for (const segment of sectionText.split(/\n|(?<!\d)[.;](?=\s|$)|(?=\b(?:required|preferred|minimum qualifications?|preferred qualifications?)\s*:)/i).map(part => part.trim()).filter(Boolean)) {
    if (/^experience\s+range\s*:?\s*$/i.test(segment)
      || /^(?:minimum|basic|required|mandatory|qualifications|requirements|education|experience(?=\s*:)|responsibilities|duties|benefits|about|freshers?|graduates?|no (?:prior |previous )?experience)\b/i.test(segment)) {
      // A nested field retains its explicit Preferred Qualifications parent.
      // A separately required section still ends that parent's scope.
      if (!(preferredQualificationSection && /^experience\s*:/i.test(segment))) {
        preferredSection = false;
        preferredQualificationSection = false;
      }
    }
    if (/^preferred\s+qualifications?\s*:?\s*$/i.test(segment)) preferredQualificationSection = true;
    if (/^(?:not\s+(?:(?:strictly|necessarily|always)\s+)?mandatory|preferred|nice[- ]to[- ]have|desirable|desired|optional|bonus|good[- ]to[- ]have)\b/i.test(segment)) preferredSection = true;
    const preference = preferredSection || /\b(?:not\s+(?:(?:strictly|necessarily|always)\s+)?mandatory|preferred|desirable|desired|optional|nice[- ]to[- ]have|good[- ]to[- ]have|a plus|a bonus|an advantage)\b/i.test(segment);
    if (preference) {
      // Flattened ATS bullets can put a mandatory quantity and an optional
      // skill in one clause. Only an explicit applicant work requirement wins.
      let optional = segment.replace(candidateQuantity, (match, quantity) => { required.push(`${quantity} of experience`); return ''; });
      // Preserve an explicitly labeled work range before flattened desired
      // skills without creating a preference section inside ordinary prose.
      const desiredIndex = optional.search(/\bdesired\s+skills\b/i);
      if (!preferredSection && desiredIndex >= 0
        && !/\b(?:preferred|desirable|desired|optional|bonus|not\s+mandatory|nice[- ]to[- ]have|good[- ]to[- ]have)\b/i.test(optional.slice(0, desiredIndex))) {
        optional = optional.replace(new RegExp('\\bexperience\\s+range\\s*[:*=-]?\\s*(' + NUMERIC_SOURCE_PATTERN.source + ')', 'gi'), (match, quantity, offset) => {
          if (offset >= desiredIndex) return match;
          if (/^(?:0(?:\.0+)?|zero)(?=\s|[-+])/i.test(quantity) && input) {
            const facts = collectRecruitmentFacts(input);
            if (facts.requiredPriorHistory || facts.requiredProfessionalExperience) return match;
          }
          required.push(`${quantity} of experience`);
          return '';
        });
      }
      preferred.push(optional);
    } else required.push(segment);
  }
  return { required: required.join('\n'), preferred: preferred.join('\n') };
};
const NUMERIC_SOURCE_PATTERN = /\b(?:\d+(?:\.\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(?:(?:-|to)\s*(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*)?(?:\+\s*)?(?:years?|yrs?|months?)\b/i;
const sourceNumericFields = input => {
  const separated = splitPreferenceText(input.body.replace(/[\u2013\u2014]/g, '-'), input);
  separated.required = maskScreenedThirdPartyDegreeRequirements(separated.required);
  const numericSourceIssues = numericExperienceSourceIssues({ requiredText: separated.required,
    description: splitPreferenceText(input.sourceFields.description, input).required,
    experienceRequired: input.sourceFields.experienceRequired });
  separated.required = maskFragmentedExperienceNumbers(separated.required);
  const numericExperienceField = maskFragmentedExperienceNumbers(input.sourceFields.experienceRequired);
  // A break from work is not work experience, even if it is adjacent to an experience requirement.
  const breakWords = '(?:career (?:break|gap)|employment gap|break from (?:work|employment))';
  for (const key of ['required', 'preferred']) separated[key] = separated[key]
    // An education-to-joining interval is graduation recency, not employment.
    // Remove only that duration so a separate professional requirement survives.
    .replace(new RegExp(NUMERIC_SOURCE_PATTERN.source + '\\s+(?:of\\s+)?(?:difference|gap)\\s+between\\s+(?:(?:the|highest)\\s+)*(?:education(?:al)?\\s+)?(?:degree\\s+)?(?:completion|graduation)\\s+date\\s+and\\s+(?:the\\s+)?(?:joining|start)\\s+date', 'gi'), 'education-to-joining interval')
    // The length of a degree is education, not previous professional work.
    .replace(/\b(?:\d+(?:\.\d+)?|one|two|three|four|five|six)\s*(?:\+\s*)?(?:[- ]\s*)?(?:years?|yrs?)\s*(?:of\s+)?(?=(?:bachelor(?:['\u2019]s|s)?|master(?:['\u2019]s|s)?|[bm]\.?\s*tech|[bm]\.e\.?|degree|diploma)\b)/gi, 'degree duration ')
    // First-time people leaders can still need substantial professional work.
    // A zero-year leadership subset does not establish zero overall experience.
    .replace(/(?<![\d.])\b(?:0(?:\.0+)?|zero)\s*(?:(?:-|to)\s*(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*)?(?:\+\s*)?(?:years?|yrs?|months?)['\u2019]?\s+(?:of\s+)?(?:leadership|(?:people|staff|team|personnel|line)\s+management)\s+experience\b/gi, 'leadership tenure')
    .replace(new RegExp(NUMERIC_SOURCE_PATTERN.source + '\\s+(?:of\\s+)?' + breakWords + '\\b', 'gi'), 'career break')
    .replace(new RegExp('\\b' + breakWords + '\\s+(?:(?:of|for|up to|at most|maximum|minimum|between)\\s+)*' + NUMERIC_SOURCE_PATTERN.source, 'gi'), 'career break')
    .replace(new RegExp('^[\\t ]*(?:in|within|after|by|at)\\s+(?:the\\s+)?(?:(?:first|next|initial)\\s+)?' + NUMERIC_SOURCE_PATTERN.source + '[\\t ]*[:=-]?[\\t ]*$', 'gim'), 'performance milestone')
    .replace(new RegExp(NUMERIC_SOURCE_PATTERN.source + '\\s+(?:(?:of\\s+)?(?:service|employment|training)\\s+bond\\b|(?:of\\s+)?bond\\b(?=[\\t ]*(?:[,;.]|$)))', 'gim'), 'service bond');
  // The legacy bare-label parser reads only the first value of "Experience:
  // 0-2 years". Pass the whole source-backed quantity, including its unit.
  const labeledPhrase = separated.required.match(new RegExp('\\bexperience\\s*:\\s*(' + NUMERIC_SOURCE_PATTERN.source
    + '(?:\\s*(?:-|to|~)\\s*' + NUMERIC_SOURCE_PATTERN.source + ')?)', 'i'))?.[1];
  const requiredPhrase = separated.required.match(/\b(?:requir(?:ing|ed|es)|must have|at least|minimum(?: of)?)\s+(\d+(?:\.\d+)?(?:\s*(?:-|to)\s*\d+(?:\.\d+)?)?\s*(?:years?|yrs?|months?)\s+(?:of\s+)?[a-z -]{0,45}\bexperience)\b/i)?.[0]
    || (!labeledPhrase && separated.required.match(new RegExp(NUMERIC_SOURCE_PATTERN.source
      + '\\s+(?:of\\s+)?[a-z -]{0,45}\\b(?:experience|background)\\s+(?:is\\s+)?(?:required|mandatory)\\b', 'i'))?.[0]);
  const isolatedLabel = labeledPhrase && !numericExperienceField && !requiredPhrase;
  const signals = extractJobFilterSignals({ title: input.title, jobDescription: isolatedLabel || requiredPhrase ? '' : separated.required,
    experienceRequired: numericExperienceField || requiredPhrase || (labeledPhrase ? `${labeledPhrase} of experience` : null) });
  const profile = signals.experienceProfile || {};
  const preferredProfile = NUMERIC_SOURCE_PATTERN.test(separated.preferred)
    ? extractJobFilterSignals({ experienceRequired: separated.preferred }).experienceProfile : null;
  const preferredMinimumYears = finiteYear(preferredProfile?.minimumYears) ? Number(preferredProfile.minimumYears) : null;
  // The existing extractor may infer zero from a cohort or title. Only source-backed requirements count as numeric years.
  const text = `${input.title}\n${separated.required}`;
  const explicit = NUMERIC_SOURCE_PATTERN.test(text)
    || /^\d+(?:\.\d+)?(?:\s*(?:-|to|\+)\s*\d*(?:\.\d+)?)?$/.test(input.sourceFields.experienceRequired)
    || /\bno (?:prior |previous |professional |work )?experience (?:is )?(?:required|necessary)\b/i.test(text);
  if (!explicit || profile.confidence === 'low' || (!finiteYear(profile.minimumYears) && !finiteYear(profile.maximumYears))) {
    return { experienceYears: [], experienceBucket: 'unspecified', experienceProfile: { ...emptyProfile(), preferredMinimumYears }, numericSourceIssues };
  }
  return {
    experienceYears: (signals.experienceYears || []).filter(finiteYear).map(Number),
    experienceBucket: signals.experienceBucket || 'unspecified',
    experienceProfile: { ...emptyProfile(), ...profile, preferredMinimumYears, evidence: profile.evidence?.slice(0, 160) || null, rawText: null },
    numericSourceIssues,
  };
};
const decisionFor = (answer, key, thresholds, questions = CLASSIFICATION_POLICY.questions) => {
  const labels = Object.keys(questions[key].criteria);
  const p = answer?.probabilities;
  if (!p || typeof p !== 'object' || Object.keys(p).length !== labels.length || labels.some(label => !Object.hasOwn(p, label) || typeof p[label] !== 'number' || !Number.isFinite(p[label]) || p[label] < 0 || p[label] > 1)) return null;
  const sum = labels.reduce((total, label) => total + p[label], 0);
  if (Math.abs(sum - 1) > .002 || !labels.includes(answer.choice) || p[answer.choice] < Math.max(...Object.values(p)) - .00001) return null;
  return { label: answer.choice, probability: Math.round(p[answer.choice] * 10000) / 10000, confident: p[answer.choice] >= thresholds[key] };
};
export const snapshotClassificationFields = job => Object.fromEntries(CLASSIFICATION_FIELDS.map(field => [field, field === 'experienceProfile'
  ? { minimumYears: job.experienceProfile?.minimumYears ?? null, maximumYears: job.experienceProfile?.maximumYears ?? null, isOpenEnded: job.experienceProfile?.isOpenEnded === true, preferredMinimumYears: job.experienceProfile?.preferredMinimumYears ?? null, hasExplicitExperience: job.experienceProfile?.hasExplicitExperience === true, confidence: job.experienceProfile?.confidence || 'low' }
  : field === 'experienceYears' ? (job[field] || []).filter(finiteYear).slice(0, 41) : typeof job[field] === 'string' ? job[field].slice(0, 160) : job[field] ?? null]));

// Source rules determine public eligibility; model scores remain a comparison.
const resolveSourceClassification = (job, { now = new Date(), mode = 'shadow', identity = {}, reason, previous } = {}) => {
  const canonicalInput = buildClassificationInput(job, { now, identity });
  const rejectedCompanyField = companyHistoryExperienceField({ description: canonicalInput.sourceFields.description,
    experienceRequired: canonicalInput.sourceFields.experienceRequired });
  let input = canonicalInput;
  if (rejectedCompanyField) {
    const companyYears = /^\d+(?:\.\d+)?/.exec(rejectedCompanyField.value)[0].replace('.', '\\.');
    const companyDuration = new RegExp('\\b' + companyYears + '\\s*\\+?\\s*(?:years?|yrs?)\\b', 'i');
    // A sentence can contain company history and an applicant requirement.
    // Mask only the copied duration, preserving every adjacent role condition.
    const stripCompanyHistory = value => rejectedCompanyField.companyClauses.reduce((text, clause) =>
      text.replaceAll(clause, clause.replace(companyDuration, 'company history duration')), value);
    const nativeBlock = `\nRequired professional experience:\n${canonicalInput.sourceFields.experienceRequired}`;
    const body = canonicalInput.body.endsWith(nativeBlock) ? canonicalInput.body.slice(0, -nativeBlock.length) : canonicalInput.body;
    input = { ...canonicalInput, sourceExperienceRequired: '', body: stripCompanyHistory(body),
      sourceFields: Object.fromEntries(Object.entries(canonicalInput.sourceFields).map(([field, value]) =>
        [field, field === 'experienceRequired' ? '' : stripCompanyHistory(value)])) };
  }
  const { numericSourceIssues, ...numeric } = sourceNumericFields(input);
  const explicitInternTitle = /\bintern(?:ship)?(?:\s*\([^)]*\))?$/i.test(input.title)
    && !/\b(?:head|manager|director|coordinator|mentor|supervisor)\s+(?:of|for)\b/i.test(input.title);
  const sourceAllowsZero = numeric.experienceProfile.minimumYears === 0 || /^freshers?$/i.test(input.sourceExperienceRequired);
  const managerTitle = /\b(manager|director|vice president|chief|head of)\b/i.test(input.title)
    && !/\btrainee\b/i.test(input.title) && !explicitInternTitle;
  const explicitEmployment = input.sourceEmploymentType.toLowerCase().replace(/\b(non[- ]permanent|not\s+(?:a\s+)?permanent|permanent)\s+contract\b/g,
    (match, qualifier) => qualifier === 'permanent' ? 'permanent' : match)
    .replace(/\b(?:non[- ]+|not\s+(?:a\s+)?|never\s+)contractual\b/g, '');
  const sourceEmployment = /\bintern(?:ship)?\b/.test(explicitEmployment) ? 'internship'
    : /\b(apprentice(?:ship)?|part.?time|volunteer)\b/.test(explicitEmployment) ? 'other'
      : /\b(contract|contractual|contractor|consultant|temporary|fixed.?term|freelance)\b/.test(explicitEmployment) ? 'contract'
        : /\b(full.?time|permanent|regular)\b/.test(explicitEmployment) ? 'full_time' : explicitInternTitle ? 'internship' : null;
  const employment = sourceEmployment || 'unspecified';
  const experience = numeric.experienceProfile.minimumYears > 0 ? 'prior_required'
    : sourceAllowsZero ? 'fresher_eligible' : 'not_stated';
  const seniority = managerTitle ? 'Manager' : 'Unknown';
  const jobType = employment === 'internship' ? 'Intern' : employment === 'contract' ? 'Contract' : employment === 'other' ? 'Others'
    : employment === 'full_time' && experience === 'prior_required' ? 'Full-time Experienced'
      : employment === 'full_time' && ['fresher_eligible', 'mixed'].includes(experience) ? 'Full-time Fresher' : 'Unspecified';
  let resolved = { jobType, employmentType: EMPLOYMENT[employment], experienceLevel: managerTitle ? 'Senior Level' : null,
    seniority, experiencePolicy: experience, ...numeric,
    experienceBasis: numeric.experienceProfile.minimumYears === null ? 'unspecified' : 'employer_requirement' };
  const policy = resolveRecruitmentPolicy(input, { numeric, sourceEmployment });
  if (policy) {
    const { employment: policyEmployment, experience: policyExperience, evidence: policyEvidence, ...fields } = policy;
    const policyType = policyEmployment === 'internship' ? 'Intern' : policyEmployment === 'contract' ? 'Contract'
      : policyEmployment === 'other' ? 'Others' : policyExperience === 'prior_required' ? 'Full-time Experienced'
        : ['fresher_eligible', 'mixed'].includes(policyExperience) ? 'Full-time Fresher' : 'Unspecified';
    resolved = { ...resolved, ...fields, jobType: policyType, employmentType: EMPLOYMENT[policyEmployment], experiencePolicy: policyExperience,
      ...(policyType === 'Intern' ? { seniority: 'Internship', experienceLevel: 'Entry Level' }
        : policyType === 'Full-time Fresher' ? { seniority: 'Entry Level', experienceLevel: 'Entry Level' } : {}),
      policyEvidence: policyEvidence?.slice(0, 160) || null };
  }
  if (mode === 'policy' && input.incomplete) resolved = { ...resolved, jobType: 'Unspecified', employmentType: null, seniority: 'Unknown', experienceLevel: null };
  return {
    policyVersion: CLASSIFICATION_POLICY.version, inputHash: input.inputHash, modelRevision: input.modelRevision,
    runtimeVersion: input.runtimeVersion, runtimeHash: input.runtimeHash, policyHash: input.policyHash, calibrationHash: input.calibrationHash,
    referenceYear: input.referenceYear, mode, authoritative: ['enforce', 'policy'].includes(mode), decisionSource: policy ? 'policy' : 'fallback',
    status: 'fallback', reason: reason || 'unavailable', decisions: {}, complete: false, windows: 0,
    evidenceContext: input.body.slice(0, 160), classifiedAt: now.toISOString(), resolved,
    previous: snapshotClassificationFields(previous || job.classification?.previous || job),
    ...(numericSourceIssues.length ? { numericSourceIssues } : {}),
    ...(rejectedCompanyField ? { sourceEvidenceRepairs: [rejectedCompanyField] } : {}),
  };
};

export const resolveClassification = (job, prediction, options = {}) => {
  // This trial compares the model against rules without letting its prediction
  // influence the baseline. Numeric experience continues to come from source facts.
  const baseline = resolveSourceClassification(job, options);
  const input = buildClassificationInput(job, options);
  const sourceSeniority = baseline.resolved.seniority === 'Unknown' && !input.incomplete
    ? extractJobFilterSignals({ title: input.title, description: input.body }).seniority : baseline.resolved.seniority;
  const resolved = { ...baseline.resolved, seniority: sourceSeniority,
    experienceLevel: baseline.resolved.experienceLevel || (sourceSeniority === 'Mid Level' ? 'Mid Level'
      : ['Senior', 'Lead', 'Manager', 'Senior Manager', 'Director', 'Vice President', 'Executive'].includes(sourceSeniority) ? 'Senior Level' : null) };
  const decision = decisionFor(prediction?.answers?.jobType, 'jobType', options.thresholds || CLASSIFICATION_POLICY.thresholds);
  let reason = options.reason || (!prediction ? 'unavailable' : prediction.complete !== true || input.incomplete ? 'incomplete' : null);
  if (!reason && (!decision || Object.keys(prediction.answers).length !== 1)) reason = 'invalid_response';
  if (!reason && baseline.calibrationHash === 'uncalibrated') reason = 'model_unvalidated';
  if (!reason && (prediction.conflicts?.length || !decision.confident)) reason = 'uncertain';
  const modelJobType = decision?.label || null;
  return { ...baseline, resolved, reason,
    decisionSource: baseline.decisionSource === 'policy' ? 'policy' : 'fallback',
    status: !reason ? 'accepted' : ['model_unvalidated', 'uncertain', 'incomplete'].includes(reason) ? 'uncertain' : 'fallback',
    decisions: decision ? { jobType: { label: decision.label, probability: decision.probability,
      probabilities: { ...prediction.answers.jobType.probabilities } } } : {},
    complete: prediction?.complete === true && !input.incomplete,
    windows: Number.isInteger(prediction?.windows) ? Math.min(10000, Math.max(0, prediction.windows)) : 0,
    comparison: { modelJobType, logicJobType: baseline.resolved.jobType,
      agreement: modelJobType ? modelJobType === baseline.resolved.jobType : null },
  };
};

export const getAuthoritativeClassification = (job = {}) => {
  const result = job.classification;
  return result?.authoritative === true && ['enforce', 'policy'].includes(result.mode) && result.policyVersion === CLASSIFICATION_POLICY.version
    && ['accepted', 'uncertain', 'fallback'].includes(result.status) && PUBLIC_TYPES.includes(result.resolved?.jobType)
    ? { ...result.resolved, jobType: result.resolved.jobType === 'Unspecified' && result.complete === true && !result.sourceQualityIssues?.length
      && PUBLIC_JOB_TYPES.includes(result.decisions?.jobType?.label)
      ? result.decisions.jobType.label : normalizePublicJobType(result.resolved.jobType) } : null;
};

export const applyClassification = job => {
  const resolved = getAuthoritativeClassification(job);
  if (!resolved) return job;
  const rejectedCompanyField = job.classification?.sourceEvidenceRepairs?.some(repair => repair.code === 'company_history_experience_field_ignored');
  return { ...job, ...resolved, experienceRequired: job.classification?.numericSourceIssues?.length ? null
    : resolved.experienceRequired ?? (rejectedCompanyField ? null : job.sourceExperienceRequired ?? (job.experienceRequiredProvenance === 'source' ? job.experienceRequired : null))
      ?? resolved.experienceProfile.evidence ?? null };
};
