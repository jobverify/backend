// These checks identify missing content and explicit non-vacancies, not job types.
export const isPlaceholderClassificationText = value => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text.length <= 1 || !/[\p{L}\p{N}]/u.test(text)
    || /^(?:n\s*\/?\s*a|not\s+(?:available|applicable|provided|specified)|tbd|tba|to\s+be\s+(?:announced|determined)|coming\s+soon|(?:enter\s+(?:the\s+)?)?job\s+description|description)[\s.!:]*$/i.test(text)
}

export const isExplicitTestPosting = title => /\b(?:job|posting|vacancy|requisition)\s+(?:is\s+)?(?:for\s+)?(?:a\s+)?system\s+test\s+only\d*\b|\b(?:this\s+is\s+(?:a\s+)?)?(?:dummy|test)\s+(?:job|posting|vacancy|requisition)\s*[-:,(]?\s*(?:only|do\s+not\s+apply)\b/i
  .test(String(title ?? '').replace(/_/g, ' '))

export function sourceAvailabilityIssues(input, { unresolved = false } = {}) {
  const issues = []
  const description = input.sourceFields.description
  const closures = description.matchAll(/\b(?:this|the)\s+(?:position|vacancy|role|job)\s+(?:is\s+)?(?:no\s+longer\s+(?:accepting\s+applications|available|open)|closed|has\s+been\s+(?:closed|filled))\b/gi)
  for (const closure of closures) {
    const prefix = description.slice(0, closure.index).split(/[.!?;\n]/).at(-1)
    const suffix = description.slice(closure.index + closure[0].length)
    if (/\b(?:if|when|whenever|unless|whether|should|in\s+case)\b/i.test(prefix)
      || /^\s+(?:if|when|unless|provided|subject\s+to)\b/i.test(suffix)) continue
    issues.push('closed_vacancy')
    break
  }
  if (/\bscholarship(?:\s+for\b|\s+program(?:me)?\s*$|\s*$)/i.test(input.title)
    && /\b(?:students?|university|college|workshop|award|grant|tuition)\b/i.test(description)) issues.push('non_vacancy_programme')
  if (unresolved) {
    // Education alone or a rewritten caption cannot supply missing job duties.
    // Explicit source eligibility has already been resolved by the caller.
    const roleText = [description, input.sourceFields.responsibilities, input.sourceFields.requirements].filter(Boolean).join('\n')
    const placeholder = !roleText || isPlaceholderClassificationText(roleText)
      || /^(?:apply\b[^.!?]{0,150}\b(?:careers?\s+(?:page|form)|first[- ]party\b[^.!?]{0,50}\bform)|to\s+be\s+updated\s+by\s+(?:the\s+)?recruiter|posted\s+by\s*:|\d{4}-\d{2}-\d{2}\s*\||(?:category|position)\s*:|job\s+description\s+\S|(?:must\s+have|primary\s+skills?|specializations?)\s*:)/i.test(roleText)
    if (placeholder && Buffer.byteLength(roleText, 'utf8') <= 200) issues.push('sparse_role_description')
    else if (roleText.length < 400 && /(?:\.{3}|\u2026)\s*$/.test(roleText)) issues.push('truncated_role_description')
    else if (/\bcareer\s+site\s+cookie\s+settings\b/i.test(roleText)
      && !/\b(?:responsibilities|qualifications|requirements|you\s+will|this\s+role)\b/i.test(roleText)) issues.push('missing_role_description')
  }
  return issues
}

const fragmentedQuantity = () => /\b\d[\t ]+\d[\t ]*\+[\t ]*(?:years?|yrs?)\b/gi

// Do not read the last digit of an unresolved number, or join its digits.
// This is used only for numeric extraction; the employer input stays intact.
export const maskFragmentedExperienceNumbers = value => String(value ?? '')
  .replace(fragmentedQuantity(), 'unresolved experience duration')

// A numeric employer field may have been copied from the company biography.
// Reject it only when the same quantity occurs solely in explicit company
// history; an independent applicant occurrence keeps the native field intact.
export const companyHistoryExperienceField = ({ description = '', experienceRequired = '' } = {}) => {
  const native = /^(\d+(?:\.\d+)?)\s*(\+)?\s*(?:years?|yrs?)\.?$/i.exec(String(experienceRequired).trim())
  if (!native) return null
  const number = native[1].replace('.', '\\.')
  const quantity = new RegExp('\\b' + number + '\\s*\\+?\\s*(?:years?|yrs?)\\b', 'i')
  const segments = String(description).split(/\n|[.!?](?=\s|$)/).map(value => value.trim()).filter(Boolean)
  const occurrences = segments.filter(segment => quantity.test(segment)
    && /\bexperience\b/i.test(segment))
  const company = segment => !/\b(?:applicants?|candidates?|you)\b/i.test(segment)
    && (/\b(?:our|the|this)\s+(?:company|business|organization|organisation)\s+(?:has|have|with|brings?)\b/i.test(segment)
      || /\bwe\s+(?:have|are\s+a\s+company\s+with)\b/i.test(segment)
      || (/^now\s+with\s+(?:(?:almost|over|about)\s+)?/i.test(segment)
        && /\bemployees\b/i.test(segment) && /\bwe\s+(?:provide|offer|serve)\b/i.test(segment)))
  if (!occurrences.length || occurrences.some(segment => !company(segment))) return null
  return { code: 'company_history_experience_field_ignored', field: 'sourceExperienceRequired',
    value: String(experienceRequired), companyClauses: occurrences }
}

// An explicit no-work master's branch is usable even when it comes first.
// Callers still establish the vacancy's own required-qualification context.
export const explicitMasterFirstZeroExperienceRoute = value => {
  const text = String(value).trim()
  if (/\b(?:not|never|no longer|ineligible|cannot|can't|need not|if|unless|provided|subject\s+to|only\s+with|regardless|irrespective)\b/i.test(text)) return null
  return /^(?:[-*\u2022]\s*)?((?:a\s+)?master(?:['\u2019]s|s)?\s+degree\s+(?:with\s+no|without)\s+(?:(?:any|prior|previous|professional|work)\s+)*experience(?:\s+(?:is\s+)?(?:required|necessary))?)\s+or\s+(?:a\s+)?bachelor(?:['\u2019]s|s)?\s+degree\s+with\s+\d+(?:\.\d+)?(?:\s*(?:-|to)\s*\d+(?:\.\d+)?)?\s*\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:professional\s+)?experience\b/i.exec(text)
}

// A degree rule for people the employee screens is not that employee's tenure.
// Remove the foreign condition only from interpretation. A shared duration or
// any adjacent own-applicant work requirement remains available to the rules.
export const maskScreenedThirdPartyDegreeRequirements = value => String(value).replace(
  /(^|\n)([\t ]*(?:[-*\u2022]\s*)?(?:master(?:['\u2019]s|s)?\s+degree[^\n.;]{0,120}?\s+or\s+)?bachelor(?:['\u2019]s|s)?\s+degree\s+with\s+)(\d+(?:\.\d+)?(?:\s*(?:-|to)\s*\d+(?:\.\d+)?)?\s*\+?\s*(?:years?|yrs?))(\s+(?:of\s+)?(?:professional\s+)?experience\s+(?:is\s+)?required\s+for\s+(?:the\s+)?(?:customers?|clients?|suppliers?|vendors?|students?|candidates?|applicants?)\s+you\s+(?:screen|assess|evaluate|review|teach|train)\b)/gim,
  (match, boundary, _prefix, _quantity, _scope, offset, text) => {
    const tail = text.slice(offset + match.length).split(/[.;\n]/, 1)[0]
    if (/^\s*(?:and|,)\s+(?:also\s+)?for\s+(?:all\s+)?(?:applicants?|candidates?)\s+(?:to|for)\s+(?:this|the)\s+(?:role|position|job)\b/i.test(tail)) return match
    return `${boundary}screened third-party education condition`
  })

export const numericExperienceSourceIssues = ({ requiredText = '', description = '', experienceRequired = '' } = {}) => {
  const issues = []
  const required = String(requiredText)
  for (const match of required.matchAll(fragmentedQuantity())) {
    const before = required.slice(0, match.index)
    const requiredHeading = [...before.matchAll(/\b(?:(?:required|minimum|basic)\s+)?(?:qualifications?|requirements?)\b|\b(?:required|minimum|basic)\s+(?:professional\s+)?experience\b/gi)].at(-1)?.index ?? -1
    const companyHeading = [...before.matchAll(/\b(?:about\s+(?:(?:our|the)\s+)?company|company\s+(?:overview|profile))\b/gi)].at(-1)?.index ?? -1
    const dutiesHeading = [...before.matchAll(/\b(?:responsibilities|duties|what\s+you(?:['\u2019]ll|\s+will)\s+do)\b/gi)].at(-1)?.index ?? -1
    const clauseBefore = before.slice(Math.max(before.lastIndexOf('\n'), before.lastIndexOf('.'), before.lastIndexOf(';')) + 1)
    const foreignSubject = /\b(?:suppliers?|vendors?|clients?|customers?|partners?|we|our\s+(?:company|team))\s+(?:(?:must|should|need\s+to)\s+)?(?:have|has|bring|possess)[^.;\n]*$/i.test(clauseBefore)
    const applicant = /\b(?:applicants?|candidates?|you)\s+(?:must|need\s+to|are\s+required\s+to)\s+(?:have|bring|possess)[^.;\n]{0,100}$/i.test(before)
    const employment = /^\s+(?:of\s+)?(?:[a-z-]+\s+){0,6}experience\b/i.test(required.slice(match.index + match[0].length))
    if (employment && !foreignSubject && (applicant || requiredHeading > Math.max(companyHeading, dutiesHeading))) {
      issues.push({ code: 'fragmented_experience_number', evidence: match[0] })
      break
    }
  }
  if (String(experienceRequired).match(fragmentedQuantity()) && !issues.length) {
    issues.push({ code: 'fragmented_experience_number', evidence: String(experienceRequired) })
  }

  // A bare closing range has no specialty or degree-branch scope. When it is
  // disjoint from the explicit overall requirement, neither can be a firm filter.
  const text = String(description).replace(/[\u2013\u2014]/g, '-')
  const overall = [...text.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(\+)?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:overall|total)\s+(?:(?:IT|professional|work|industry)\s+)?experience\b/gi)]
  const closing = /(?:^|[.!?\n])\s*(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(\+)?\s*(?:years?|yrs?)(?:\s+(?:of\s+)?experience)?[.!?]?\s*(?:(?:we\s+are\s+(?:an?\s+)?)?equal[- ]opportunity\s+employer\b[\s\S]*)?$/i.exec(text)
  if (closing) {
    const low = Number(closing[1]), high = closing[3] ? Infinity : Number(closing[2])
    const conflict = overall.find(match => match.index < closing.index
      && Number(match[2]) >= Number(match[1]) && high >= low
      && (Number(match[1]) > high || (!match[3] && Number(match[2]) < low)))
    if (conflict) issues.push({ code: 'conflicting_experience_ranges', evidence: `${conflict[0]}; ${closing[0].trim()}` })
  }
  // A bare master's route does not inherit the years attached to its bachelor
  // alternative. Domain-specific experience elsewhere is not an overall cap.
  const degreeBranches = /(?:^|\n)\s*(master(?:['\u2019]s|s)?\s+degree[^\n.;]{0,120}?)\s+or\s+bachelor(?:['\u2019]s|s)?\s+degree\s+with\s+((\d+(?:\.\d+)?)(?:\s*(?:-|to)\s*\d+(?:\.\d+)?)?\s*\+?\s*(?:years?|yrs?))\s+(?:of\s+)?experience\b[^\n.;]*/gi
  for (const branch of required.matchAll(degreeBranches)) {
    if (/\b\d+(?:\.\d+)?\s*(?:years?|yrs?|months?)\b/i.test(branch[1])) continue
    const before = required.slice(0, branch.index)
    const educationHeading = [...before.matchAll(/\b(?:education(?:al)?|qualifications?|requirements?)\b/gi)].at(-1)?.index ?? -1
    const dutiesHeading = [...before.matchAll(/\b(?:responsibilities|duties|what\s+you(?:['\u2019]ll|\s+will)\s+do)\b/gi)].at(-1)?.index ?? -1
    if (educationHeading < 0 || educationHeading < dutiesHeading) continue
    if (explicitMasterFirstZeroExperienceRoute(branch[0])) continue
    // The branch may share a sentence with an independent universal condition.
    // Keep the complete required text so the branch match cannot swallow it.
    const universal = [...required.matchAll(/(?:^|[;.,\n]|\band\s+)\s*(?:all\s+)?(?:candidates?|applicants?|you)\s+(?:must|need\s+to|are\s+required\s+to)\s+(?:have|possess|bring)\s+(?:(?:at\s+least|a\s+minimum\s+of)\s+)?(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:professional|work|industry|commercial)\s+experience\b/gim)]
    if (universal.some(match => Number(match[1]) === Number(branch[3]))) continue
    const nativeUniversal = /^(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)(?:\s+(?:of\s+)?(?:professional|work|industry|commercial)\s+experience)?\.?$/i.exec(String(experienceRequired).trim())
    if (nativeUniversal && Number(nativeUniversal[1]) === Number(branch[3])) continue
    issues.push({ code: 'qualification_branch_experience', evidence: branch[0].trim() })
    break
  }
  return issues
}
