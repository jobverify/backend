import {explicitMasterFirstZeroExperienceRoute, maskScreenedThirdPartyDegreeRequirements} from './classificationSourceQuality.js';

// Product filter defaults are kept separate from employer-stated work experience.
const degree = /\b(?:bachelor(?:'s|s)?|master(?:'s|s)?|b\.?tech|m\.?tech|b\.e\.?|m\.e\.?|degree)\b/i;
const seniorRole = /\b(?:manager|director|vice president|chief|head of|senior|sr|principal|staff|lead|supervisor|expert)\b/i;
const excludedStudentSubject = /\b(?:our (?:staff|employees|team)|employees|staff|mentoring|mentor|supervis(?:e|ing)|manage|managing|lead (?:our |the )?(?:graduate|student|intern)|recruitment programme|recruitment program|support (?:recent )?graduates)\b/i;
const employerExperienceSubject = /\b(?:our|the|this)\s+(?:company|business|organization|organisation)\s+(?:has|have|with|brings?)\b|\bwe\s+(?:have|are\s+a\s+company\s+with)\b/i;
const applicantExperienceRequirement = /\b(?:(?:applicants?|candidates?|you)\s+(?:(?:must|should)\s+)?|(?:must|should|required to)\s+)(?:have|possess|bring|demonstrate)\s+(?:(?:prior|previous|professional|relevant|work)\s+)*experience\b/i;
const normalize = value => String(value || '').replace(/[\u2018\u2019]/g, "'").replace(/[\u2013\u2014]/g, '-');
const clauses = text => normalize(text).split(/\n|[.;](?=\s|$)/).map(value => value.trim()).filter(Boolean);
const experienceQualification = text => text.replace(/^(?:(?:required|minimum|basic|mandatory)\s+)?(?:work\s+)?experience\s*:\s*/i, '');
const negated = text => /\b(?:not|never|no longer|ineligible|cannot|can't|need not)\b/i.test(text);
const finiteAppointment = /^(?:(?:this|the)\s+(?:role|position|job)|employment)\s+is\s+(?:based\s+in\s+[^.;\n]{1,80}?\s+and\s+is\s+)?for\s+(?:a\s+)?fixed[- ]term\s+of\s+(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:years?|months?|weeks?)\b/i;
const contractualAppointment = /^(?:this\s+is\s+(?:a|an)\s+(?:(?:purely|strictly)\s+)?contractual\s+(?:role|position|job|employment|engagement)|(?:(?:this|the)\s+(?:role|position|job|employment|engagement)|employment)\s+is\s+(?:(?:a|an|purely|strictly)\s+)*contractual(?:\s+(?:role|position|job|employment|engagement))?)\b/i;
const appointmentClauses = text => {
  const segments = [];
  let start = 0, protectedUntil = 0;
  for (let index = 0; index < text.length; index++) {
    if (index === start) {
      const opening = text.slice(start, start + 240);
      const bulletLength = /^\s*[-*•]\s+/.exec(opening)?.[0].length || 0;
      const heading = appointmentHeading(opening.slice(bulletLength));
      protectedUntil = heading ? start + bulletLength + heading.end : 0;
    }
    // Preserve punctuation only inside a recognized heading. Parenthetical
    // notes in ordinary prose retain the existing sentence boundaries.
    if (index < protectedUntil) continue;
    const char = text[index];
    if (char === '\n' || (/[.;]/.test(char) && /\s|^$/.test(text[index + 1] || ''))) {
      const segment = text.slice(start, index).trim();
      if (segment) segments.push(segment);
      start = index + 1;
    }
  }
  const tail = text.slice(start).trim();
  if (tail) segments.push(tail);
  return segments;
};
const appointmentHeading = segment => {
  let label = '', depth = 0;
  for (let index = 0; index < Math.min(segment.length, 240); index++) {
    const char = segment[index];
    if (char === '(') {
      if (depth === 0) label += ' ';
      depth++;
      continue;
    }
    if (char === ')') { depth = Math.max(0, depth - 1); continue; }
    if (depth > 0) continue;
    if (char !== ':') { label += char; continue; }
    label = label.trim().replace(/\s+/g, ' ');
    if (/^(?:(?:for\s+)?example|sample|illustrative|hypothetical)$/i.test(label)) {
      return { scope: 'other', content: segment.slice(index + 1).trim(), end: index + 1 };
    }
    // Other details of this job are not another vacancy. Require the explicit
    // vacancy/role topic, and allow identifiers or a short purpose annotation.
    const heading = /^(?:(current|actual|this|our)|((?:for\s+)?example|sample|illustrative|hypothetical|other|separate))\s+(?:vacanc(?:y|ies)|roles?|positions?|jobs?(?:\s+descriptions?)?)\b(.*)$/i.exec(label);
    if (!heading) return null;
    const tail = heading[3].trim().replace(/^-\s*/, '');
    if (!/^(?:(?:\d+|details)(?:\s+|$)){0,3}(?:for\s+[^:\n]{1,80})?$/i.test(tail)) return null;
    return { scope: heading[1] ? 'current' : 'other', content: segment.slice(index + 1).trim(), end: index + 1 };
  }
  return null;
};
const ownAppointmentClause = (body, statementPattern, hintPattern) => {
  const text = normalize(body);
  if (!hintPattern.test(text)) return null;
  let otherVacancy = false;
  for (let segment of appointmentClauses(text)) {
    segment = segment.replace(/^[-*•]\s+/, '');
    const heading = appointmentHeading(segment);
    if (heading?.scope === 'other') {
      otherVacancy = true;
      continue;
    }
    if (heading?.scope === 'current') {
      otherVacancy = false;
      segment = heading.content;
    }
    if (otherVacancy) continue;
    // A generic field label does not reset an example-vacancy section.
    // The anchored affirmative statement itself excludes "is not for";
    // unrelated negatives about skills or relocation do not negate its term.
    segment = segment.replace(/^employment\s+terms\s*:\s*/i, '');
    const statement = statementPattern.exec(segment);
    if (!statement) continue;
    const suffix = segment.slice(statement[0].length);
    // A withdrawal must refer to the offered statement/term itself. Negating
    // a later promotion or renewal does not withdraw the initial appointment.
    const withdrawals = suffix.matchAll(/\b(?:this|that|the)\s+(?:(initial|fixed)\s+)?(?:statement|term|option|appointment)\s+(?:is\s+(?:not\s+(?:applicable|available|offered)|no\s+longer\s+(?:available|offered))|has\s+been\s+withdrawn)\b/gi);
    const laterWithdrawalTarget = /^\s+(?:to|for|from)\s+(?:(?:an?|the|this|that|another)\s+)?(?:renewal|extension|promotion|transfer|future|later|subsequent|eventual|promoted)\b/i;
    let initialAppointmentWithdrawn = false;
    for (const withdrawal of withdrawals) {
      const prefix = suffix.slice(0, withdrawal.index);
      const directlyReferencesTerm = /^\s*(?:,\s*)?(?:(?:but|and)\s+)?$/i.test(prefix);
      if (!directlyReferencesTerm && !withdrawal[1]) continue;
      const target = suffix.slice(withdrawal.index + withdrawal[0].length);
      if (laterWithdrawalTarget.test(target)) continue;
      initialAppointmentWithdrawn = true;
      break;
    }
    const exampleStatement = /^\s*(?:,\s*)?(?:(?:but|and)\s+)?(?:an?\s+)?(?:sentence|statement)\s+used\s+only\s+as\s+an?\s+example\b/i;
    if (initialAppointmentWithdrawn || exampleStatement.test(suffix)) continue;
    // Selection into a different job does not establish this vacancy's term.
    // Routine funding or selection conditions for this same job stay intact.
    const conditions = suffix.matchAll(/\b(?:only\s+if|only\s+when|if|unless|provided\s+that|(?:subject\s+to|contingent\s+(?:on|upon))\s+(?:(?:your|the|successful)\s+)*(?:selection|appointment|being\s+(?:selected|appointed))\s+(?:for|to|into)\s+(?:another|a\s+(?:different|separate))\s+(?:client\s+)?(?:vacancy|role|position|job))\b/gi);
    // A condition on renewal leaves today's finite appointment intact;
    // a preceding project name containing "renewal" does not establish it.
    const renewalCondition = /(?:\b(?:renewable|extendable|renewed|extended)|(?:^|,\s*|\b(?:with|subject\s+to)\s+)(?:an?\s+)?(?:option\s+(?:for|of)\s+)?(?:(?:possible|potential)\s+)?(?:renewal|extension)(?:\s+(?:is\s+)?(?:possible|available|permitted))?)\s*$/i;
    // Only a separate opportunity adjunct preserves the current appointment.
    // An initial appointment offered through a transfer remains conditional;
    // merely mentioning promotion or transfer does not establish a later offer.
    const laterOpportunity = /(?:,\s*|\band\s+)(?:with\s+)?(?:(?:an?|the)\s+)?(?:(?:opportunity|possibility|chance|option|prospect)\s+(?:for|of|to)\s+(?:(?:an?|the)\s+)?)?(?:(?:optional|possible|potential|future|later|subsequent|eventual|internal|international|overseas)\s+)*(?:promotion|transfer|access\s+to\s+(?:(?:an?|the|another)\s+)?(?:(?:future|later|subsequent|eventual|internal|international|overseas|different|separate)\s+)*(?:role|position|job|opportunity))(?:\s+(?:(?:that|which)\s+is\s+)?(?:available|possible|offered))?\s*$/i;
    const relocationBenefit = /(?:,\s*|\band\s+)(?:offers?|provides?|includes?)\s+relocation\s+(?:assistance|support)\s*$/i;
    let initialAppointmentConditional = false;
    let previousSecondaryConditionEnd = null;
    for (const condition of conditions) {
      const conditionPrefix = suffix.slice(0, condition.index);
      // Coordinated conditions retain their secondary subject. A new initial
      // appointment predicate no longer ends in this coordinating conjunction.
      const continuedSecondaryCondition = previousSecondaryConditionEnd !== null
        && /\b(?:and|or)\s+(?:also\s+)?$/i.test(suffix.slice(previousSecondaryConditionEnd, condition.index));
      if (renewalCondition.test(conditionPrefix) || laterOpportunity.test(conditionPrefix)
        || relocationBenefit.test(conditionPrefix) || continuedSecondaryCondition) {
        previousSecondaryConditionEnd = condition.index + condition[0].length;
        continue;
      }
      initialAppointmentConditional = true;
      break;
    }
    if (initialAppointmentConditional) continue;
    return segment;
  }
  return null;
};
const finiteAppointmentClause = body => ownAppointmentClause(body, finiteAppointment, /\bfixed[- ]term\s+of\b/i);
const contractualAppointmentClause = body => ownAppointmentClause(body, contractualAppointment, /\bcontractual\b/i);
export const hasFiniteAppointment = body => Boolean(finiteAppointmentClause(body));
const stripRecruitingDutyExperience = segment => {
  const ownScreeningExperience = /\b(?:experience|background)\s+(?:(?:in|with|of)\s+)?(?:assess(?:ing)?|evaluat(?:e|ing)|review(?:ing)?|screen(?:ing)?|verify(?:ing)?)\b/i.test(segment);
  // Preserve the recruiter's own experience performing screening, while
  // removing only the nested applicant work history from an assessment duty.
  return ownScreeningExperience ? segment : segment
    .replace(/\b(?:check|verify|assess|evaluate|review|screen)\s+(?:whether|that)\s+(?:the\s+)?(?:suppliers?|vendors?|clients?|customers?|candidates?|applicants?|employees?)\s+(?:have|possess|bring)\s+(?:(?:prior|previous|professional|work|relevant|industry|commercial)\s+)*experience\b/gi, 'check third-party credentials')
    .replace(/\b(?:assess(?:ing)?|evaluat(?:e|ing)|review(?:ing)?|screen(?:ing)?|verify(?:ing)?)\s+(?:(?:the|an?)\s+)?(?:applicants?|candidates?)'s?\s+(?:(?:relevant|previous|prior|professional|work)\s+)*experience\b/gi, 'assess applicant credentials');
};
// The vacancy's own eligibility, not an occupation that trains or recruits freshers.
export const fresherVacancyTitle = value => {
  const title = normalize(value);
  return /\bfreshers?\b/i.test(title)
    && !/\b(?:no|not|non|never|cannot|ineligible|excluding|except|excluded)\b|\b\w+n't\b/i.test(title)
    && !/\b(?:trainers?|training|mentors?|mentoring|instructors?|tutors?|coaches?|coaching|recruit(?:ers?|ment|ing)?|talent\s+acquisition|placements?)\b/i.test(title)
    ? title : null;
};
// Eligibility for the vacancy itself. Recruiting, supervising or training these
// applicants is an occupation, rather than evidence that the applicant is new.
export const entryLevelVacancyTitle = value => {
  const title = normalize(value).replace(/_/g, ' ');
  if (/\b(?:no|not|non|never|cannot|ineligible|excluding|except|excluded)\b|\b\w+n't\b/i.test(title)
    || /\b(?:for|of|manage|managing|mentor|mentoring|train|training|recruit|recruiting)\s+(?:(?:the|our|new|recent|college)\s+)*(?:graduates?|trainees?|apprentices?|entry[- ]level)\b/i.test(title)
    || /\b(?:graduate|trainee|apprentice(?:ship)?|entry[- ]level)\s+(?:(?:program(?:me)?|recruitment|training|relations|operations)\s+)*(?:recruiter|trainer|instructor|mentor|coordinator|director|supervisor)\b/i.test(title)
    || /\b(?:graduate|trainee|apprentice(?:ship)?)\s+(?:program(?:me)?|recruitment|training)\s+(?:manager|specialist|administrator|officer)\b/i.test(title)
    || (seniorRole.test(title) && !/\btrainee\b/i.test(title))) return null;
  return /\b(?:trainee|apprentice|entry[- ]level|(?:new|recent|fresh)\s+(?:(?:college|university)\s+)?grad(?:uate)?s?|graduate\s+(?:engineer(?:ing)?|developer|analyst|associate|trainee|programme?|program|role|position))\b/i.test(title)
    ? title : null;
};
const applicantContext = text => /\b(?:applicants?|candidates?|you)\s+(?:(?:who|must|should)\s+)?(?:(?:have|has|are|be)\s+)?(?:(?:currently|recently|just)\s+)?(?:pursuing|studying|enrolled|completed|finished|graduated|freshers?|fresh graduates?|recent graduates?|new graduates?)\b|\b(?:can|may|must|should|eligible to|encouraged to)\s+apply\b/i.test(text);
const startsQualification = text => /^(?:(?:required|minimum|basic)\s+(?:qualifications?|requirements?)\s*:\s*)?(?:(?:currently\s+)?(?:pursuing|studying|enrolled)|recently\s+completed|just\s+completed|freshers?|fresh graduates?|recent graduates?|new graduates?|no (?:prior |previous |professional |work )?experience (?:is )?(?:required|necessary))\b/i.test(text);
const mixedFresherWelcome = /\b(?:freshers?|(?:fresh|recent|new) graduates?)\s+(?:and|or)\s+experienced\s+(?:candidates?|applicants?)\s+(?:are\s+)?(?:welcome|eligible|(?:may|can)\s+apply)\b/i;
const advancedDegreeZeroPath = /\bor\s+(?:an?\s+)?advanced\s+degree\s+with\s+(?:little\s+or\s+)?no\s+(?:(?:prior|previous|professional|work)\s+)*experience\b(?!\s+(?:in|with|using|on)\b)/i;
// Explicit degree waivers retain qualification scope and separate work-history guards.
const explicitDegreeZeroPath = /\bor\s+(?:an?\s+)?(?:advanced|master(?:'s|s)?)\s+degree(?:\s+in\s+(?:a\s+)?(?:related|relevant)\s+field)?\s+(?:with\s+(?:little\s+or\s+)?no|without)\s+(?:(?:any|prior|previous|professional|work)\s+)*experience\b(?!\s+(?:in|with|using|on)\b)/i;
const academicExperienceScope = String.raw`(?:academic|student|coursework|internships?|apprenticeships?|co[- ]?ops?)(?:\s+(?:projects?|research|work|experience|training|placements?)){0,3}`;
const academicRequirementReference = /\b(?:academic|student|coursework|internships?|apprenticeships?|co[- ]?ops?)(?:\s+(?:projects?|research|work|experience|training|placements?)){0,3}\s+(?:also\s+)?(?:(?:may|can)\s+(?:be\s+used\s+to\s+)?)?(?:meets?|satisf(?:y|ies)|fulfils?|fulfills?)\s+(?:this|the)\s+(?:experience\s+)?requirement\b/i;
const academicExperienceExclusions = [
  new RegExp(String.raw`\b(?:excluding|except\s+for|not\s+(?:counting|including|accepting))\s+(?:any\s+)?${academicExperienceScope}\b`, 'gi'),
  new RegExp(String.raw`\b${academicExperienceScope}\s+(?:(?:is|are|will\s+be|shall\s+be)\s+)?(?:excluded|not\s+(?:accepted|allowed|counted)|(?:does|do)\s+not\s+(?:count|qualify))\b`, 'gi'),
];
// A rejection of academic credit does not negate the separate experience floor.
// Remove only the rejected academic phrase; retain negation of the floor itself.
const withoutAcademicExclusions = text => academicExperienceExclusions.reduce((value, pattern) => value.replace(pattern, ''), text);
const academicCreditCategory = text => {
  const category = /\b(?:academic|student|coursework|internships?|apprenticeships?|co[- ]?ops?)\b/i.exec(text)?.[0].toLowerCase();
  return /^(?:academic|student|coursework)$/.test(category || '') ? 'academic' : category?.replace(/[- ]/g, '').replace(/s$/, '');
};
// Academic experience must describe an allowed source of the applicant's
// experience. A research topic or excluded academic projects does not do so.
const permitsAcademicExperience = text => {
  const rejected = new Set(academicExperienceExclusions.flatMap(pattern => [...text.matchAll(pattern)].map(match => academicCreditCategory(match[0]))));
  const allowance = withoutAcademicExclusions(text);
  return [
  academicRequirementReference,
  /\b(?:academic|student|coursework|internships?|apprenticeships?|co[- ]?ops?)\s+(?:[a-z-]+\s+){0,3}experience\b/i,
  /\b(?:including|includes?|through|via|from|or)\s+(?:(?:an?|the|relevant|equivalent)\s+)*(?:academic|student|coursework|internships?|apprenticeships?|co[- ]?ops?)\b/i,
  /\b(?:academic|student|coursework|internships?|apprenticeships?|co[- ]?ops?)\s+(?:[a-z-]+\s+){0,3}(?:accepted|allowed|counts?|counted|qualif(?:y|ies))\b/i,
].some(pattern => {
  const match = pattern.exec(allowance);
  return match && !negated(match[0])
    && !rejected.has(academicCreditCategory(match[0]))
    && !/\b(?:no|not|without|excluding|except|non[- ]?)\s*(?:(?:any|prior|previous)\s+)*$/i.test(allowance.slice(0, match.index));
});
};
const thirdPartyDegreeSubject = /\b(?:recruit(?:ing)?|advis(?:e|ing)|counsell?ing|screen(?:ing)?|train(?:ing)?|teach(?:ing)?|mentor(?:ing)?|support(?:ing)?)\s+(?:(?:other|potential|prospective|eligible|new)\s+)*(?:candidates?|applicants?|graduates?|students?)\s+(?:with|holding|pursuing|who\s+(?:have|hold|are\s+pursuing))\b/i;
const mixedFresherEligibility = text => !negated(text) && !excludedStudentSubject.test(text)
  && !/\b(?:if|unless|provided|subject to|minimum|at least|required|mandatory)\b/i.test(text)
  && !applicantExperienceRequirement.test(text)
  && mixedFresherWelcome.test(text);
const unconditionalFresherEligibility = text => !negated(text) && !excludedStudentSubject.test(text)
  && !/\b(?:if|unless|provided|subject to)\b/i.test(text)
  && (/\b(?:freshers?|(?:fresh|recent|new) graduates?)\s+(?:are\s+)?(?:welcome|eligible|(?:may|can)\s+apply)\b/i.test(text)
    || /\b(?:welcomes?|open to|suitable for|seeking)\s+(?:freshers?|(?:fresh|recent|new) graduates?)\b/i.test(text));
// Some employers list separate education/credential routes instead of a single
// work-experience floor. Retain only explicit zero-work eligibility and the
// history attached to its alternative; other required history stays independent.
const explicitQualificationRoute = (segments, qualificationSegments) => {
  const duration = /\b\d+(?:\.\d+)?\s*\+?\s*(?:years?|yrs?|months?)\b/i;
  const conditional = /\b(?:if|unless|provided|subject\s+to|only\s+with|regardless|irrespective)\b/i;
  for (const [index, segment] of segments.entries()) {
    if (negated(segment) || excludedStudentSubject.test(segment) || thirdPartyDegreeSubject.test(segment)
      || conditional.test(segment)) continue;
    // Semicolons can separate work-history floors for the bachelor/master
    // routes from an explicit doctoral route that requires no work history.
    // Remove only those credential branches; later universal floors stay live.
    if (qualificationSegments.has(segment)) {
      const masterZero = explicitMasterFirstZeroExperienceRoute(segment.replace(/^(?:(?:required|minimum|basic)\s+)?(?:qualifications?|requirements?)\s*:\s*/i, ''));
      if (masterZero) return { evidence: masterZero[1], scopedSegments: [masterZero[0]] };
      const bachelor = /^(?:[-*\u2022\uF0B7]\s*)?(?:minimum\s+(?:of\s+)?)?\d+(?:\.\d+)?\s+years?\s+of\s+related\s+experience\s+with\s+(?:a\s+)?bachelor(?:'s|s)?\s+degree$/i.exec(segment);
      const master = segments[index + 1] || '';
      const doctoral = segments[index + 2] || '';
      const masterBranch = /^or\s+\d+(?:\.\d+)?\s+years?\s+and\s+(?:a\s*)?master(?:'s|s)?\s+degree$/i.exec(master);
      const doctoralBranch = /^or\s+(?:a\s+)?PhD\s+without\s+(?:(?:any|prior|previous|professional|work)\s+)*experience\b(?!\s+(?:in|with|using|on)\b)/i.exec(doctoral);
      if (bachelor && masterBranch && doctoralBranch
        && qualificationSegments.has(master) && qualificationSegments.has(doctoral)
        && ![master, doctoral].some(value => negated(value) || conditional.test(value)
          || excludedStudentSubject.test(value) || thirdPartyDegreeSubject.test(value))) {
        return { evidence: doctoralBranch[0], scopedSegments: [bachelor[0], masterBranch[0], doctoralBranch[0]] };
      }
    }
    const requirement = segment.replace(/^(?:(?:minimum\s+required|minimum|required|basic)\s+)?experience\s*:\s*/i, '');
    const bachelorZero = /^no\s+(?:(?:prior|previous|professional|work)\s+)*experience\s+(?:is\s+)?required\s+with\s+(?:a\s+)?bachelor(?:'s|s)?\s+degree\s+or\s+minimum\s+\d+(?:\.\d+)?\s*\+?\s*(?:years?|yrs?|months?)\s+of\s+experience\s+with\s+vocational\s+education\b/i.exec(requirement);
    const credentialZero = qualificationSegments.has(segment)
      && /^qualified\s+(?:cma|ca)(?:\s*\/\s*(?:cma|ca))*\s*(?:[-:]\s*)?freshers?(?:$|\s+or\s+(?:semi[- ]qualified|inter)\s+(?:cma|ca)\s+with\b[^.;\n]{1,160}?\bexperience\b)/i.exec(requirement);
    if (!bachelorZero && !credentialZero) continue;
    // Keep later universal requirements even when they share this sentence.
    const scopedSegments = [(bachelorZero || credentialZero)[0]];
    // A CA/CMA fresher line can be followed by sibling education routes. A
    // new heading or an ordinary work requirement ends this narrow grouping.
    if (credentialZero && !/\bor\b/i.test(requirement)) {
      for (const next of segments.slice(index + 1)) {
        if (!qualificationSegments.has(next) || negated(next) || conditional.test(next)
          || /\b(?:all|every|also|additionally)\b/i.test(next)
          || !/^(?:(?:inter|semi[- ]qualified)\s+(?:cma|ca)|[bm]\.?(?:\s*)com\b|mba\b)/i.test(next)
          || !/\bexperience\b/i.test(next) || !duration.test(next)) break;
        scopedSegments.push(next.slice(0, next.search(/\bexperience\b/i) + 'experience'.length));
      }
    }
    return { evidence: segment, scopedSegments };
  }
  return null;
};
const withoutQualificationAlternatives = (text, route) => route
  ? route.scopedSegments.reduce((body, segment) => body.replace(segment, ''), text)
  : text;
// A requirement verb and a work-history phrase must describe the same
// applicant condition. Flat ATS paragraphs can contain degree-specific
// conditions, unrelated must-have skills and ranges that explicitly start at
// zero. None of those establishes a universal positive employment floor.
const zeroWorkDuration = /\b(?:0|zero)\s*(?:(?:-|to|through)\s*(?:\d+(?:\.\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten)\s*)?\+?\s*(?:years?|yrs?|months?)\b/i;
const mandatoryProfessionalHistory = text => {
  const requirement = text.replace(/^(?:[-*\u2022]\s*|(?:(?:required|minimum|basic|mandatory)\s+)?(?:qualifications?|requirements?)\s*:\s*)+/i, '')
    .replace(/^(?:for|in)\s+(?:this|the)\s+(?:role|position|job)\s*,?\s*/i, '');
  const duration = '(?:\\d+(?:\\.\\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten)(?:\\s*(?:-|to|through)\\s*(?:\\d+(?:\\.\\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten))?\\s*\\+?\\s*(?:years?|yrs?|months?)';
  const quantified = '(?:(?:(?:a\\s+)?minimum\\s+(?:of\\s+)?|at\\s+least\\s+)?' + duration + '\\s+(?:of\\s+)?)?';
  const modifier = '(?!(?:and|or)\\b)[a-z-]+';
  const professional = '(?:(?:prior|previous|relevant)\\s+)*(?:professional|work|employment|industry|commercial)\\s+(?:' + modifier + '\\s+){0,4}experience';
  const academic = '(?:(?:prior|previous|relevant)\\s+)*(?:academic|student|coursework|internships?|apprenticeships?|co[- ]?ops?)(?:\\s+(?:projects?|research|work|training|placements?)){0,3}\\s+experience';
  const parallelAcademic = new RegExp('^\\s+and\\s+' + quantified + academic + '\\b(?=\\s*(?:$|[;,.]|and\\b|(?:(?:is|are)\\s+)?(?:required|mandatory|essential)\\b))', 'i');
  const evidenceFor = (match, work) => {
    const start = match.index + match[0].lastIndexOf(work);
    // An additive academic obligation is distinct from academic credit toward
    // this work condition. Retain any explicit acceptance/reference that follows.
    let remainder = requirement.slice(start + work.length);
    while (parallelAcademic.test(remainder)) remainder = remainder.replace(parallelAcademic, '');
    return work + remainder;
  };
  const direct = new RegExp('^(?:([^.;:\\n]{1,120}?)\\s+and\\s+)?(' + quantified + professional + ')(?:\\s+and\\s+[^.;:\\n]{1,120}?)?\\s+(?:(?:is|are)\\s+)?(?:required|mandatory|essential)\\b', 'i').exec(requirement);
  if (direct && !zeroWorkDuration.test(direct[2])
    && !/\b(?:applicants?|candidates?|you|clients?|suppliers?)\b/i.test(direct[1] || '')
    && !/\b(?:check|verify|assess|evaluate|review|screen|ensure|confirm)\s+(?:whether|that)\b/i.test(direct[1] || '')
    && !/\b(?:required|mandatory|essential)\s+only\s+for\b/i.test(requirement)) {
    return evidenceFor(direct, direct[2]);
  }
  const applicant = new RegExp('\\b(?:(all|every)\\s+)?(?:applicants?|candidates?|you)\\s+(?:must|need\\s+to|are\\s+required\\s+to)\\s+(?:have|bring|possess)\\s+(?:[^.;:\\n]{1,120}?\\s+and\\s+)?(' + quantified + '(?:' + modifier + '\\s+){0,3}' + professional + ')\\b', 'gi');
  for (const match of requirement.matchAll(applicant)) {
    const before = requirement.slice(0, match.index).trim();
    // A verification duty can describe the history of other applicants,
    // including a coordinated list. Its nested "all applicants" is not the
    // vacancy's own eligibility subject.
    if (/\b(?:check|verify|assess|evaluate|review|screen|ensure|confirm)\s+(?:whether|that)\s*$/i.test(before)) continue;
    // A preceding education subject (e.g. "Master graduate candidates")
    // restricts this condition. Explicit "all applicants" remains universal,
    // including after another statement in an unpunctuated paragraph.
    const universalSubject = match[1] || !before
      || /(?:^|\b)(?:to\s+qualify(?:\s+for\s+(?:the|this)\s+role)?|(?:required|minimum|basic|mandatory)\s+(?:qualifications?|requirements?))\s*[:,]?$/i.test(before);
    if (universalSubject && !zeroWorkDuration.test(match[2])) {
      // Keep the professional condition and its following qualifiers. A
      // preceding coordinated academic obligation is not a work-history waiver.
      return evidenceFor(match, match[2]);
    }
  }
  return false;
};
const bucket = years => years <= 1 ? '0-1' : years < 3 ? '1-3' : years <= 5 ? '3-5' : years <= 8 ? '5-8' : years <= 12 ? '8-12' : '12-plus';
const inferred = (minimumYears, maximumYears, basis, evidence) => ({
  experienceYears: Array.from({ length: maximumYears - minimumYears + 1 }, (_, index) => minimumYears + index),
  experienceBucket: bucket(minimumYears), experienceBasis: basis,
  experienceRequired: `${minimumYears === maximumYears ? minimumYears : `${minimumYears}-${maximumYears}`} ${maximumYears === 1 ? 'year' : 'years'} (inferred)`,
  experienceProfile: { minimumYears, maximumYears, isOpenEnded: false, preferredMinimumYears: null,
    hasExplicitExperience: false, confidence: 'medium', inferenceMethod: basis, evidence: evidence.slice(0, 160), rawText: null },
});

export const collectRecruitmentFacts = input => {
  const text = normalize(`${input.title}\n${input.body}`);
  let preferredSection = false;
  let preferredQualificationSection = false;
  // Some ATS pages flatten this heading and its requirements into one paragraph.
  // Restore a boundary only when qualification text follows, not in prose such
  // as "an equivalent combination of education and experience is considered".
  const sectionBody = normalize(maskScreenedThirdPartyDegreeRequirements(input.body)).replace(/\b((?:(?:preferred|desirable|optional|desired|nice[- ]to[- ]have|good[- ]to[- ]have|bonus)\s+)?Education\s+(?:and|&)\s+Experience)(?=\s*(?::|\n|[•-]|recommended\b|bachelor|master|degree|experience|relevant|previous|required))/gi, '\n$1\n')
    .replace(/\b(About\s+(?:the\s+)?ideal\s+candidate)\s*:/gi, '\n$1:\n')
    .replace(/\b(SKILLS\s+(?:AND|&)\s+COMPETENCIES)\b/g, '\n$1:\n')
    .replace(/\b((?:not\s+(?:(?:strictly|necessarily|always)\s+)?)?(?:mandatory|desirable|preferred|optional))\s*:/gi, '\n$1:\n')
    .replace(/\byou\s+will\s+be\s+successful\s+in\s+this\s+role\s+if\s+you\s+have\s*:/gi, '\nRequired qualifications:\n')
    .replace(/\b((?:work\s+)?experience|qualifications?)\s*:\s*(?=freshers?\b)/gi, '\n$1:\n');
  const segments = clauses(sectionBody).filter(segment => {
    if (/^preferred\s+qualifications?\s*:?\s*$/i.test(segment)) preferredQualificationSection = true;
    if (/^(?:not\s+(?:(?:strictly|necessarily|always)\s+)?mandatory|preferred|nice[- ]to[- ]have|desirable|optional|desired|bonus|good[- ]to[- ]have)\b/i.test(segment)) preferredSection = true;
    else if (unconditionalFresherEligibility(segment)
      || /^experience\s+range\s*:?\s*$/i.test(segment)
      || /^(?:minimum|basic|required|mandatory|qualifications?|requirements|(?:work\s+)?experience(?=\s*:)|education\s+(?:and|&)\s+experience|responsibilities|duties|benefits|about|more about us)\b/i.test(segment)) {
      if (!(preferredQualificationSection && /^(?:work\s+)?experience\s*:/i.test(segment))) {
        preferredSection = false;
        preferredQualificationSection = false;
      }
    }
    return !preferredSection && !/\{\s*insert\b[^}]*\}/i.test(segment);
  });
  let inQualifications = false;
  const qualificationSegments = new Set(segments.filter(segment => {
    if (/^experience\s+range\s*:?\s*$/i.test(segment)
      || /^(?:(?:minimum|basic|required)?\s*(?:qualifications?|requirements?|skills?\s*(?:and|&)\s*qualifications?)|mandatory(?=\s*:)|education\s+(?:and|&)\s+experience|background\s+(?:and|&)\s+experience|experience\s+(?:and|&)\s+knowledge|about\s+(?:the\s+)?ideal\s+candidate)(?:\b|:)/i.test(segment)) inQualifications = true;
    else if (/^(?:preferred|responsibilities|duties|benefits|functional skills?|skills\s*(?:and|&)\s*competencies|supervisory responsibilities|primary skills|more about us|about (?:us|the company)|company overview|diversity\s*(?:&|and)\s*inclusion|building a|recruitment fraud|what's in it|guidelines)\b/i.test(segment)) inQualifications = false;
    return inQualifications;
  }));
  const qualificationRoute = explicitQualificationRoute(segments, qualificationSegments);
  const isInternshipTitle = title => {
    const internOccupation = /\bintern(?:ship)?\s*(?:[-:\u2013\u2014]\s*)?(?:(?:program(?:me)?|recruitment|training|relations|operations)\s+)*(?:manager|director|coordinator|mentor|supervisor)\b/i.test(title)
      || /\binternship\s*(?:[-:\u2013\u2014]\s*)?(?:(?:program(?:me)?|recruitment|training|relations|operations)\s+)*(?:recruiter|specialist|administrator|officer)\b/i.test(title)
      || /\b(?:head|manager|director|coordinator|mentor|supervisor)\s+(?:of|for)\b/i.test(title)
      || /\b(?:manager|director|coordinator|mentor|supervisor)\b.{0,30}\bintern(?:ship)?\s+(?:program(?:me)?|recruitment|coordination)\b/i.test(title);
    const convertedIntern = /\bintern\s*[-(]?\s*converted\b|\bintern\s*(?:to|[-/]\s*to)\s*[-/]?\s*(?:fte|full[- ]time)\b/i.test(title);
    return /\bintern(?:ship)?\b/i.test(title) && !internOccupation && !convertedIntern;
  };
  const internshipTitle = isInternshipTitle(input.title);
  // An employer can state the actual placement title inside a broader ATS
  // caption, e.g. CA Industrial Trainee / "Job Title: Project Intern".
  const statedTitle = segments.find(segment => /^job\s+title\s*:/i.test(segment))?.replace(/^job\s+title\s*:\s*/i, '') || '';
  const statedInternship = isInternshipTitle(statedTitle) ? statedTitle : null;
  const internship = internshipTitle ? input.title : statedInternship || segments.find(segment => !negated(segment)
    && (/\b(?:this (?:role|position|vacancy|job) (?:is|offers)|employment(?: type)?\s*:|position(?: type)?\s*:)\s+(?:an? |paid |summer )?intern(?:ship)?\b/i.test(segment)
      || ((!seniorRole.test(input.title) || /\btrainee\b/i.test(input.title))
        && ((/\bwe (?:are (?:hiring|seeking|looking for)|offer)\s+(?:(?:an?|paid|summer|experienced)\s+){0,3}intern(?:ship)?\b/i.test(segment)
            && !/\bintern(?:ship)?\s+(?:(?:program(?:me)?|recruitment|training|relations|operations)\s+)*(?:manager|director|coordinator|mentor|supervisor|recruiter|specialist|administrator|officer)\b/i.test(segment))
          || (/\binternship duration\s*[:=-]\s*\d+\b/i.test(segment)
            && !/\b(?:manag(?:e|ing)|administer(?:ing)?|oversee(?:ing)?|coordinat(?:e|ing)|mentor(?:ing)?|supervis(?:e|ing))\s+(?:(?:this|the|our|an)\s+)?internship\b/i.test(segment))
          || /^this\s+(?:exciting |paid |summer )?internship\s+(?:will\s+(?:allow|give|offer|provide)|allows?|gives?|offers?|provides?)\b/i.test(segment)))));
  const fullTime = segments.find(segment => !negated(segment) && /\b(?:full[- ]time|permanent (?:role|position|job|employment))\b/i.test(segment));
  const contractBody = segments.find(segment => {
    // "Permanent contract Job Posting Date" is adjacent ATS metadata,
    // not a statement that the vacancy is a temporary "contract job".
    const employment = segment.replace(/\b(non[- ]permanent|not\s+(?:a\s+)?permanent|permanent)\s+contract\b/gi,
      (match, qualifier) => /^permanent$/i.test(qualifier) ? 'permanent employment' : match)
      .replace(/\b(?:job|position)\s+type\s*[:\-]?\s*contracts?\s+(accounting|management|administration|administrator|specialist|manager)\b/gi,
        'Occupation: agreement $1')
      // A manager's team may include contractors. Keep any separate statement
      // of the applicant's own contract position available for classification.
      .replace(/\b((?:manag(?:e|es|ing)|lead(?:s|ing)?|supervis(?:e|es|ing)|oversee(?:s|ing)?)\b[^.;\n]{0,180}\b(?:team|staff|employees|engineers|developers)\b[^.;\n]{0,120}\bacross\s+(?:(?:full[- ]time|permanent|regular)\s+and\s+)?)(?:contractor|contract)\s+(positions?|roles?|jobs?)\b/gi,
        '$1external $2');
    return !negated(employment) && /\b(?:contract(?:or)?|freelance|fixed[- ]term|temporary)\s+(?:role|position|job|employment)|\b(?:role|position|employment|job)(?: type)?\s*(?:is|:|on)?\s*(?:an? |six[- ]month |\d+[- ]month )?(?:contract|freelance|fixed[- ]term|temporary)\b/i.test(employment);
  });
  const contract = contractBody || finiteAppointmentClause(input.body) || contractualAppointmentClause(input.body) || (!fullTime && !/\b(?:full.?time|permanent|regular)\b/i.test(input.sourceEmploymentType)
    && !/\bcontract(?:s)? (?:manager|management|administrator|administration|specialist)|\btemporary works\b/i.test(input.title)
    && /\b(?:contract(?:or)?|freelance|fixed[- ]term|temporary)\b/i.test(input.title) ? input.title : null);
  const mixedStudentPath = /\b(?:completed|finished|graduated)\b[^.;]{0,110}\bor\b[^.;]{0,100}\b(?:currently\s+)?pursuing\b|\bpursuing\b[^.;]{0,100}\bor\b[^.;]{0,110}\b(?:completed|finished|graduated)\b/i.test(normalize(input.body));
  const studying = !mixedStudentPath && segments.find(segment => !negated(segment) && !excludedStudentSubject.test(segment) && degree.test(segment)
    && !/\b(?:desirable|preferred|optional|may|can|a plus|nice to have)\b/i.test(segment)
    && (applicantContext(segment) || startsQualification(segment) || /\b(?:students?|applicants?|candidates?)\s+(?:who\s+(?:are\s+)?)?(?:are\s+)?(?:currently\s+)?pursuing\b/i.test(segment))
    && !(/\bor\b/i.test(segment) && /\b(?:completed|finished|graduated|equivalent (?:work )?experience)\b/i.test(segment))
    && /\b(?:pursuing|studying|enrolled|still (?:in|attending) college)\b/i.test(segment));
  const recent = segments.find(segment => !negated(segment) && (!excludedStudentSubject.test(segment)
    || (/^freshers?\s+with\b/i.test(segment) && !/\b(?:our (?:staff|employees|team)|employees|staff)\b/i.test(segment)))
    && (applicantContext(segment) || startsQualification(segment) || mixedFresherEligibility(segment)
      || /\b(?:welcomes?|open to|suitable for|seeking)\s+(?:freshers?|fresh graduates?|recent graduates?|new graduates?)\b/i.test(segment))
    && (/\b(?:freshers?|fresh graduates?|recent graduates?|new graduates?|no (?:prior |previous |professional |work )?experience (?:is )?(?:required|necessary))\b/i.test(segment)
      || (degree.test(segment) && /\b(?:recently|just)\s+(?:(?:have|has)\s+)?(?:completed|finished|graduated)|\b(?:completed|finished)\b.{0,65}\brecently\b/i.test(segment))))
    || fresherVacancyTitle(input.title);
  // Keep an alternative degree route separate from unconditional fresher
  // eligibility until all of the vacancy's work-history requirements are known.
  const advancedDegreeRecent = [...qualificationSegments].find(segment => !negated(segment)
    && !excludedStudentSubject.test(segment) && !thirdPartyDegreeSubject.test(segment)
    && (advancedDegreeZeroPath.test(segment) || explicitDegreeZeroPath.test(segment))) || qualificationRoute?.evidence;
  const completed = segments.find(segment => !negated(segment) && !excludedStudentSubject.test(segment) && degree.test(segment)
    && /\b(?:completed|finished|graduated)\b/i.test(segment));
  const experienced = !internshipTitle && !/\btrainee\b/i.test(input.title) && seniorRole.test(input.title) ? input.title
    : /^experienced[.!]?$/i.test(normalize(input.sourceExperienceRequired).trim()) ? input.sourceExperienceRequired
    : segments.find(original => {
      // Ignore only the welcome phrase, retaining other requirements in the
      // same sentence and its original qualification-section context.
      const welcomeRemoved = mixedFresherEligibility(original) ? original.replace(mixedFresherWelcome, '') : original;
      const withoutWaivedExperience = welcomeRemoved.replace(/\bno\s+(?:prior|previous|professional|relevant)(?:\s+[a-z][a-z-]*){0,4}\s+experience(?:\s+is)?\s+(?:required|mandatory|necessary|essential)\b/gi, '');
      const segment = stripRecruitingDutyExperience(withoutWaivedExperience);
      return !negated(segment) && !excludedStudentSubject.test(segment)
      // A field heading is not its value. In particular, the structured
      // experience field may say "Fresher" or zero on the following line.
      // Actual numeric and nonnumeric requirements are evaluated separately.
      && !/^(?:(?:required|minimum|prior|previous|professional|relevant|work)\s+)*experience\s*:$/i.test(segment)
      && (!employerExperienceSubject.test(segment) || applicantExperienceRequirement.test(segment))
      && !/\b(?:preferred|desirable|desired|optional|a plus|a bonus|an advantage|nice[- ]to[- ]have|good[- ]to[- ]have)\b/i.test(segment)
      && (applicantExperienceRequirement.test(segment)
        || (!/\bintern(?:ship)?\b/i.test(segment) && /\bwe\s+(?:are\s+)?(?:looking\s+for|seeking|hiring)\s+(?:(?:an?|the)\s+)?experienced\b/i.test(segment))
        || /\b(?:prior|previous|professional|relevant)(?:\s+[a-z][a-z-]*){0,4}\s+experience\b.{0,60}\b(?:required|mandatory|must|essential)|\bexperienced (?:professionals?|applicants?|candidates?)\b/i.test(segment)
        || (qualificationSegments.has(original) && /\b(?:prior|previous|professional|relevant) (?:work )?experience\b|\bexperience\s+(?:in|with|on|of|as|related|working)\b|\bworked\s+(?:on|in|with|as)\b/i.test(segment)));
    });
  // An explicit reference in the next sentence can qualify the same history
  // requirement. Unrelated academic skills do not waive earlier work history.
  const universalHistorySegments = segments.map(segment => {
    const remaining = withoutQualificationAlternatives(segment, qualificationRoute);
    // A coordinated requirement after an education route still applies.
    // Strip its conjunction only after removing a matched route, retaining
    // unrelated alternatives and the original source text elsewhere.
    const universal = remaining === segment ? segment
      : remaining.replace(/^\s*,?\s*(?:(?:and|also|additionally)\s+)*/i, '').trim();
    // This combined section heading labels the following education and work
    // facts; its trailing "Work Experience Required" is not a work condition.
    return universal.replace(/\bEducation,\s*Certifications,\s*and\s*Work\s*Experience\s*Required\b\s*:?/gi, '').trim();
  });
  const historySegments = universalHistorySegments.map((segment, index) => {
    const next = (universalHistorySegments[index + 1] || '').replace(/^[-*\u2022]\s*/, '');
    const refersToRequirement = academicRequirementReference.exec(next)?.index === 0
      || (/^this\s+(?:experience|requirement)\b/i.test(next) && permitsAcademicExperience(next));
    return /\b(?:experience|employment)\b/i.test(segment) && refersToRequirement ? `${segment}; ${next}` : segment;
  });
  const requiredProfessionalExperience = historySegments.map(stripRecruitingDutyExperience)
    // A waiver can contain the words 'professional experience required'.
    // Remove the waived phrase while retaining separate mandatory work clauses.
    .map(segment => segment.replace(/\bno\s+(?:(?:prior|previous|professional|work|relevant)\s+)*experience\s+(?:is\s+)?(?:required|mandatory|necessary|essential)\b/gi, ''))
    .map(segment => !negated(segment) && mandatoryProfessionalHistory(segment)).find(Boolean)
    // A bare numeric professional-work floor inside required qualifications
    // applies independently of the preceding education alternative.
    || historySegments.filter((_, index) => qualificationSegments.has(segments[index])).find(segment => {
      const requirement = withoutAcademicExclusions(experienceQualification(segment));
      const floor = /^(?:[-*\u2022]\s*)?(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)(?:\s*(?:-|to)\s*\d+(?:\.\d+)?)?\s*\+?\s*(?:years?|yrs?|months?)\b/i.exec(requirement);
      return floor && (Number.isNaN(Number(floor[1])) || Number(floor[1]) > 0)
        && segment !== advancedDegreeRecent && !negated(requirement)
        && /\b(?:professional|work|employment|industry|commercial)\s+(?:[a-z-]+\s+){0,4}experience\b/i.test(requirement)
        && !/\b(?:academic|research|student|coursework|internships?|apprenticeships?|co[- ]?ops?|preferred|desirable|desired|optional|typical(?:ly)?|usually|normally|a plus|a bonus|an advantage|nice[- ]to[- ]have)\b/i.test(requirement)
        && !/\bonly\s+for\b[^.;]{0,100}\b(?:experience[- ]based|experienced)\b/i.test(segment)
        && !thirdPartyDegreeSubject.test(segment);
    });
  // A separate statement of required prior employment also applies to degree
  // alternatives. Keep this distinct from academic experience or a recruiter's
  // duty to verify somebody else's employment history.
  const requiredPriorHistory = historySegments.map(stripRecruitingDutyExperience).find(segment => {
    const requirement = withoutAcademicExclusions(segment.replace(/^(?:[-*\u2022]\s*|\d+[.)]\s+|(?:(?:required|minimum|basic|mandatory)\s+)?(?:qualifications?|requirements?)\s*:\s*)+/i, ''));
    const academicPath = /\b(?:academic|research|student|coursework|internships?|apprenticeships?|co[- ]?ops?)\b/i;
    // Retain qualifiers after "experience" or "required": they may explicitly
    // allow academic projects or restrict the requirement to an alternate route.
    // Coordinated preferences are separate from a mandatory work clause. The
    // full applicable clause still retains academic/internship qualifications.
    const statements = requirement.split(/,\s*(?:while|and)\s+/i).reduce((items, clause) => {
      const refersToExperience = !negated(clause) && (
        (/^it\s+(?:may|can|could|must|should|will|would|is|was|has)\b/i.test(clause) && academicPath.test(clause))
        || /^this\s+(?:experience|requirement)\b/i.test(clause)
        || /^(?:academic|research|coursework|internships?)\b[^.;]{0,100}\b(?:meet|satisfy|fulfil|fulfill)\s+(?:this|the)\s+requirement\b/i.test(clause)
        || (/^(?:academic|research|student|coursework|internships?|apprenticeships?|co[- ]?ops?)\b/i.test(clause)
          && permitsAcademicExperience(clause)
          && /\b(?:this|the)\s+(?:experience\s+)?requirement\b/i.test(clause)));
      if (items.length && refersToExperience) items[items.length - 1] += ', ' + clause;
      else items.push(clause);
      return items;
    }, []);
    return statements.some(statement => {
      if (negated(statement) || /\b(?:required|mandatory|essential)\s+only\s+for\b[^.;]{0,100}\b(?:experience[- ]based|experienced)\b/i.test(statement)) return false;
      const directRequirement = /^(?:(?:prior|previous|professional|work|industry|commercial|paid)\s+(?:[a-z-]+\s+){0,4}(?:employment|experience)|experience\s+in\s+account[- ]management)\b[^.;]{0,120}?\b(?:is\s+)?(?:required|mandatory|essential)\b/i.test(statement) ? statement : null;
      const applicantMatch = /^(?:all\s+)?(?:applicants?|candidates?|you)\s+(?:must|need\s+to|are\s+required\s+to)\s+(?:have|possess|bring|demonstrate)\s+(?:[a-z-]+\s+){0,3}(?:prior|previous|professional|work|industry|commercial|paid|account[- ]management)\s+(?:[a-z-]+\s+){0,4}(?:experience|employment)\b/i.exec(statement);
      const applicantRequirement = applicantMatch && !zeroWorkDuration.test(applicantMatch[0]) ? statement : null;
      const paidWorkRequirement = /^(?:all\s+)?(?:applicants?|candidates?|you)\s+must\s+have\s+(?:(?:spent|worked)\b[^.;]{0,100}?\b(?:years?|months?)\s+(?:in\s+)?paid\b|held\s+(?:an?\s+)?paid\s+(?:position|role|job)\b|\d+(?:\.\d+)?\s+(?:years?|months?)\s+working\s+in\s+(?:an?\s+)?paid\b)/i.test(statement) ? statement : null;
      const condition = statement.match(/\b(?:only\s+(?:if|with)|provided(?:\s+that)?|subject\s+to)\b[^.;]{0,100}?\b(?:(?:prior|previous)\s+(?:[a-z-]+\s+){0,4}(?:employment|experience)|(?:applicants?|candidates?|you)\s+have\s+held\s+(?:an?\s+)?paid\s+(?:position|role|job))\b/i);
      const workCondition = condition ? statement.slice(condition.index) : null;
      return [directRequirement, applicantRequirement, paidWorkRequirement, workCondition].some(evidence => evidence
        && !academicPath.test(evidence)
        && !/\b(?:no|optional|preferred|desirable)\b/i.test(evidence)
        && !thirdPartyDegreeSubject.test(evidence));
    });
  });
  // A separate numeric related-experience requirement may include academic
  // work, but the degree waiver alone does not establish that scope. Retain
  // this ambiguity for review instead of asserting either employment history
  // or eligibility without work. Definite professional floors remain separate.
  const academicExperience = /\b(?:academic|student|coursework|internships?|apprenticeships?|co[- ]?ops?)\b/i;
  const ambiguousDegreeHistory = advancedDegreeRecent && !requiredProfessionalExperience && !requiredPriorHistory
    && [...qualificationSegments].find((segment, index, all) => {
      const requirement = withoutAcademicExclusions(experienceQualification(segment));
      const floor = /^(?:[-*\u2022]\s*)?(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)(?:\s*(?:-|to)\s*\d+(?:\.\d+)?)?\s*\+?\s*(?:years?|yrs?|months?)\b/i.exec(requirement);
      const next = all[index + 1] || '';
      const nextAllowance = withoutAcademicExclusions(next);
      const academicAllowance = permitsAcademicExperience(segment) || (academicExperience.test(nextAllowance) && !negated(nextAllowance)
        && permitsAcademicExperience(next)
        && /^(?:this\s+experience\s+(?:may|can)\s+(?:be\s+)?(?:gained|acquired|obtained|met|satisfied|fulfilled)\s+(?:through|via|in|by)\b|(?:academic|research|student|coursework|internships?|apprenticeships?|co[- ]?ops?)\b[^.;]{0,100}\b(?:meets?|satisf(?:y|ies)|fulfils?|fulfills?)\s+(?:this|the)\s+requirement\b)/i.test(nextAllowance));
      return floor && (Number.isNaN(Number(floor[1])) || Number(floor[1]) > 0)
        && segment !== advancedDegreeRecent && !negated(requirement) && /\bexperience\b/i.test(requirement)
        && !qualificationRoute?.scopedSegments.includes(segment)
        && !academicAllowance && !thirdPartyDegreeSubject.test(segment)
        && !/\b(?:preferred|desirable|desired|optional|typical(?:ly)?|usually|normally|a plus|a bonus|an advantage|nice[- ]to[- ]have)\b/i.test(segment)
        && !/\bonly\s+for\b[^.;]{0,100}\b(?:experience[- ]based|experienced|bachelor(?:'s|s)?)\b/i.test(segment);
    });
  const graduationSegments = segments.filter(segment => !negated(segment) && !excludedStudentSubject.test(segment)
    && /\b(?:batch|cohort|graduat(?:e[sd]?|ing|ion)|pass[- ]?outs?)\b/i.test(segment));
  const cohorts = [...new Set([...(input.eligibleBatchesProvenance === 'source' ? input.eligibleBatches : []), ...graduationSegments.flatMap(segment => {
    const years = [];
    const group = '((?:19|20)\\d{2}(?:\\s*(?:,|/|or|and|-)\\s*(?:19|20)\\d{2})*)';
    const patterns = [new RegExp('\\b' + group + '\\s*(?:batch|cohort|graduates?|graduating|pass[- ]?outs?)\\b', 'gi'),
      new RegExp('\\b(?:batch|cohort|graduates?|graduat(?:ing|ed|ion)(?: year)?|pass[- ]?outs?)\\s*(?:(?:of|in|from|year|batch|by|required)\\s*)?' + group + '\\b', 'gi')];
    for (const pattern of patterns) for (const match of segment.matchAll(pattern)) years.push(...match[1].match(/(?:19|20)\d{2}/g).map(Number));
    return years;
  })])].filter(year => year >= 1990 && year <= input.referenceYear + 10).sort((a, b) => a - b);
  return { internship, contract, fullTime, studying, recent, advancedDegreeRecent, qualificationRoute, completed, experienced, requiredProfessionalExperience, requiredPriorHistory, ambiguousDegreeHistory,
    entryLevel: entryLevelVacancyTitle(input.title), cohorts, graduationEvidence: graduationSegments.join(' ').slice(0, 160), text };
};

// Optional experience on an alternative path is not mandatory for freshers.
export const hasAlternativeFresherPath = (input, facts = collectRecruitmentFacts(input)) => {
  const universalBody = withoutQualificationAlternatives(normalize(input.body), facts.qualificationRoute);
  return Boolean((facts.recent || facts.advancedDegreeRecent) && !input.sourceExperienceRequired
    && !facts.requiredProfessionalExperience
    && !facts.requiredPriorHistory
    && (/\bor\s+(?:\d+(?:\.\d+)?\s*(?:(?:-|to)\s*\d+(?:\.\d+)?\s*)?(?:\+\s*)?|one\s+|two\s+|three\s+)(?:years?|yrs?|months?)\b/i.test(facts.recent)
      || facts.advancedDegreeRecent)
    && !/\b(?:minimum(?: of)?|at least|requir(?:es|ed|ing)|must have)\s*:?\s*(?:\d|one\b|two\b|three\b)/i.test(universalBody)
    && !/\b(?:years?|yrs?|months?)\b[^.;\n]{0,70}\b(?:experience|background)\s+(?:is\s+)?(?:required|mandatory)\b/i.test(universalBody));
};

export const resolveRecruitmentPolicy = (input, { numeric, sourceEmployment, modelEmployment, modelExperience } = {}) => {
  if (input.incomplete) return null;
  const facts = collectRecruitmentFacts(input);
  const min = numeric.experienceProfile.minimumYears;
  const explicitZero = min === 0 || /^freshers?$/i.test(input.sourceExperienceRequired);
  const requiredWorkHistory = facts.requiredPriorHistory || (facts.requiredProfessionalExperience
    && !permitsAcademicExperience(facts.requiredProfessionalExperience) ? facts.requiredProfessionalExperience : null);
  const alternativeFresherPath = hasAlternativeFresherPath(input, facts);
  // User-approved category defaults override employer fields, which remain separately stored.
  const fullTimeHours = sourceEmployment === 'full_time' && /^full[- ]?time$/i.test(input.sourceEmploymentType.trim());
  const employment = facts.internship || facts.studying ? 'internship' : (facts.contract && fullTimeHours ? 'contract' : sourceEmployment) || (facts.contract ? 'contract'
    : facts.fullTime ? 'full_time'
      : (min !== null || explicitZero || facts.recent || (facts.advancedDegreeRecent && alternativeFresherPath) || facts.completed || facts.cohorts.length || facts.experienced || facts.entryLevel) ? 'full_time' : modelEmployment);
  if (!employment || employment === 'unspecified') return null;
  let fields = null;
  const preservePreferred = value => ({ ...value, experienceProfile: { ...value.experienceProfile, preferredMinimumYears: numeric.experienceProfile.preferredMinimumYears } });
  if (!fields) {
    if (employment === 'internship') fields = inferred(0, 0, 'internship_default', facts.internship || facts.studying || input.sourceEmploymentType);
    else if (facts.cohorts.length && !(explicitZero && (facts.recent || facts.entryLevel)
      && facts.cohorts.at(-1) < input.referenceYear)) {
      const newest = facts.cohorts.at(-1);
      if (newest > input.referenceYear && !sourceEmployment && !facts.fullTime) {
        return { ...preservePreferred(inferred(0, 0, 'student_eligibility', facts.graduationEvidence)), employment: 'internship', experience: 'fresher_eligible', evidence: facts.graduationEvidence };
      }
      const minimum = Math.max(0, Math.min(15, input.referenceYear - newest));
      const maximum = minimum === 0 ? 0 : Math.max(minimum, Math.min(15, input.referenceYear - facts.cohorts[0]));
      fields = inferred(minimum, maximum, 'graduation_cohort', facts.graduationEvidence || `Eligible graduation batches: ${facts.cohorts.join(', ')}`);
    } else if (min > 0 && !alternativeFresherPath) fields = { ...numeric, experienceBasis: 'employer_requirement', experienceRequired: input.sourceExperienceRequired || numeric.experienceProfile.evidence };
    else if (explicitZero && requiredWorkHistory) {
      fields = inferred(1, 15, 'experienced_role_default', requiredWorkHistory);
    }
    else if (facts.recent || (facts.advancedDegreeRecent && alternativeFresherPath)) fields = inferred(0, 0, 'graduate_eligibility', facts.recent || facts.advancedDegreeRecent);
    else if (explicitZero) fields = inferred(0, 0, 'fresher_eligibility', input.sourceExperienceRequired || numeric.experienceProfile.evidence);
    else if (min !== null) fields = { ...numeric, experienceBasis: 'employer_requirement', experienceRequired: input.sourceExperienceRequired || numeric.experienceProfile.evidence };
    else if (facts.experienced || facts.requiredPriorHistory) fields = inferred(1, 15, 'experienced_role_default', facts.experienced || facts.requiredPriorHistory);
    else if (facts.entryLevel) fields = inferred(0, 0, 'entry_level_title', facts.entryLevel);
    else if (facts.completed) fields = inferred(0, 0, 'graduate_eligibility', facts.completed);
    else if (modelExperience === 'prior_required') fields = inferred(1, 15, 'model_eligibility', 'Calibrated model: prior experience required.');
    else if (['fresher_eligible', 'mixed'].includes(modelExperience)) fields = inferred(0, 0, 'model_eligibility', 'Calibrated model: applicants without experience may qualify.');
  }
  fields = fields ? preservePreferred(fields) : { ...numeric, experienceBasis: 'unspecified' };
  if (employment === 'full_time' && fields.experienceProfile.minimumYears > 0) {
    // Short but positive experience can round to zero in the legacy extractor.
    // Only the product filter years are mapped; employer bounds stay preserved.
    fields = { ...fields, experienceYears: [...new Set(fields.experienceYears.map(year => Math.max(1, Math.min(15, Math.ceil(year)))))] };
  }
  const experience = fields.experienceProfile.minimumYears > 0 ? 'prior_required'
    : fields.experienceProfile.minimumYears === 0 ? 'fresher_eligible' : 'not_stated';
  return { ...fields, employerExperienceProfile: numeric.experienceProfile, employment, experience,
    evidence: facts.internship || facts.contract || facts.fullTime || facts.experienced || facts.recent || (alternativeFresherPath && facts.advancedDegreeRecent) || facts.completed || facts.studying || facts.graduationEvidence || input.sourceEmploymentType };
};
