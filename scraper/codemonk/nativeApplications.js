import { isDeepStrictEqual } from 'node:util'
import { readNativeDocument, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'

const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const text = value => typeof value === 'string' && value.trim().length > 0
const questionKeys = ['uuid', 'name', 'label', 'question', 'choices', 'mandatory', 'maximum_range', 'minimum_range', 'open_range', 'disqualifying_value']
const definitionKeys = ['id', 'name', 'input_type', 'label', 'placeholder', 'grid', 'group']
const selectionKeys = ['id', 'job', 'application_field', 'mandatory']
const companyKeys = ['id', 'name', 'url', 'slug', 'description', 'location', 'address', 'primary_brand_colour', 'secondary_brand_colour', 'image_path', 'image_url',
  'uuid', 'phone_number', 'email', 'banner_image_path', 'size', 'country', 'show_company_name_on_career_page', 'allow_resume_drop_when_no_jobs',
  'publish_jobs_to_ziprecruiter', 'is_careers_page_department_drop_down_disabled']
const fieldNames = ['DESIGNATION', 'FIRST_NAME', 'LAST_NAME', 'PHONE', 'EMAIL', 'WORK_EXPERIENCE', 'OTHER_LINKS', 'FACEBOOK_URL', 'TWITTER_URL',
  'GITHUB_URL', 'LINKEDIN_URL', 'EDUCATION', 'RESUME', 'PHOTO', 'NOTICE_PERIOD', 'CTC', 'PREFERRED_LOCATION', 'ONLINE_PORTFOLIO', 'ADDRESS', 'TOTAL_WORK_EXPERIENCE', 'GENDER']
const roleKeys = ['id', 'uuid', 'title', 'job_type', 'max_salary', 'min_salary', 'max_experience', 'min_experience', 'skill', 'education', 'seniority',
  'industry', 'country', 'location', 'other_locations', 'description', 'department', 'department_name', 'remote', 'created_at', 'salary_type',
  'is_salary_visible', 'published_internally', 'job_screening_questions', 'workplace_type', 'currency', 'company_country', 'is_hr_job',
  'referral_email', 'email_domain', 'email_provider', 'is_employee_referral_flow_enabled', 'company_career_page_url', 'is_seo_indexable', 'valid_through']
const walk = node => [node, ...(node.children || []).filter(child => typeof child !== 'string').flatMap(walk)]
const countryCodes = new Map(), countryLabels = new Map(), regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b), name = regionNames.of(code)
  if (name && name !== code && !['ZZ', 'EU', 'UN', 'XA', 'XB', 'QO'].includes(code)) {
    countryCodes.set(code.toLowerCase(), code); countryCodes.set(name.toLowerCase(), code); countryLabels.set(name.toLowerCase(), code)
  }
}

// JSON.parse alone silently chooses the last occurrence of a duplicate key.
// Check decoded member names (including \u escapes) before attributing any
// current application criteria. The untouched original stays in the audit.
const duplicateJSONKeys = source => {
  let offset = 0
  const duplicates = [], whitespace = () => { while (/\s/.test(source[offset] || '') && offset < source.length) offset++ }
  const string = () => {
    const start = offset++
    while (offset < source.length) {
      const char = source[offset++]
      if (char === '\\') offset++
      else if (char === '"') return JSON.parse(source.slice(start, offset))
    }
    throw Error('Unterminated JSON string')
  }
  const value = (path = '', depth = 0) => {
    if (depth >= 128) throw Error('Native JSON nesting exceeds reader limit')
    whitespace()
    if (source[offset] === '{') {
      offset++; whitespace()
      const keys = new Set()
      if (source[offset] === '}') { offset++; return }
      while (offset < source.length) {
        whitespace(); const key = string(), child = path + '/' + key.replaceAll('~', '~0').replaceAll('/', '~1')
        if (keys.has(key)) duplicates.push(child)
        keys.add(key); whitespace(); offset++
        value(child, depth + 1); whitespace()
        if (source[offset++] === '}') return
      }
    } else if (source[offset] === '[') {
      offset++; whitespace()
      if (source[offset] === ']') { offset++; return }
      let index = 0
      while (offset < source.length) {
        value(path + '/' + index++, depth + 1); whitespace()
        if (source[offset++] === ']') return
      }
    } else if (source[offset] === '"') string()
    else while (offset < source.length && !/[\s,\]}]/.test(source[offset])) offset++
  }
  value()
  return duplicates
}

export const inspectCodemonkApplication = (html, corporate) => {
  const result = { sourceURL: corporate.apply_link, originalNativeHTML: html, rawPageProps: null, nextData: null,
    bound: false, schemaComplete: false, countryLocationConsistent: null, selectedFields: [], schemaIssues: [] }
  const note = (ok, reason) => { if (!ok) result.schemaIssues.push(reason); return ok }
  const extra = (value, keys, path) => {
    if (!plain(value)) return
    for (const key of Object.keys(value)) if (!keys.includes(key)) result.schemaIssues.push('unreviewed-native-field:' + path + '.' + key)
  }
  if (!note(typeof html === 'string' && Buffer.byteLength(html, 'utf8') <= 5 * 1024 * 1024, 'native-application-document-unavailable')) return result
  const document = readNativeDocument(html), root = document.nodes(node => node.tag === 'root')[0]
  const all = walk(root), scripts = all.filter(node => node.tag === 'script' && node.attrs.id === '__NEXT_DATA__')
  if (!note(scripts.length === 1 && !scripts[0].inert && scripts[0].attrs.type === 'application/json', 'native-next-data-activation-unreviewed')) return result
  try {
    result.nextData = JSON.parse(scripts[0].raw)
    const duplicates = duplicateJSONKeys(scripts[0].raw)
    if (duplicates.length) {
      result.rawPageProps = result.nextData?.props?.pageProps ?? null
      result.schemaIssues.push(...duplicates.map(path => 'duplicate-native-json-key:' + path))
      return result
    }
  }
  catch { note(false, 'native-next-data-not-json'); return result }
  const data = result.nextData, props = data?.props?.pageProps
  result.rawPageProps = props ?? null
  if (!note(plain(props) && plain(props.companyDetails) && plain(props.jobDetails), 'native-account-or-role-props-unavailable')) return result
  const company = props.companyDetails, role = props.jobDetails, query = data.query
  let reciprocal = false
  try {
    const website = new URL(company.url)
    reciprocal = website.origin === 'https://codemonk.io' && website.pathname === '/' && !website.username && !website.password && !website.search && !website.hash
  } catch {}
  result.bound = company.id === 13055 && company.name === 'CODEMONK' && company.slug === 'codemon' && reciprocal
    && props.companySlug === 'codemon' && data.page === '/[company]/[jobId]/apply' && data.isFallback === false && data.gssp === true
    && plain(query) && query.company === 'codemon' && query.jobId === corporate.slug && query.source === 'DIRECT'
    && role.uuid === corporate.uuid && role.title === corporate.title && Number.isSafeInteger(role.id) && role.id > 0
  note(result.bound, 'native-account-route-or-role-binding-unresolved')
  if (!result.bound) return result
  extra(props, ['companyDetails', 'jobDetails', 'companySlug', 'applicationFormFields', 'jobApplicationFormFields'], 'pageProps')
  extra(query, ['company', 'jobId', 'source'], 'query')
  extra(company, companyKeys, 'companyDetails')
  extra(role, roleKeys, 'jobDetails')
  note(text(role.description) && text(role.country) && text(role.location) && Array.isArray(role.other_locations), 'native-description-or-country-shape-unreviewed')
  const primaryCountry = text(role.country) ? countryCodes.get(role.country.trim().toLowerCase()) : null
  const locationCountry = text(role.location) ? countryLabels.get(role.location.split(',').at(-1).trim().toLowerCase()) : null
  result.countryLocationConsistent = Boolean(primaryCountry && (!locationCountry || primaryCountry === locationCountry))
  note(result.countryLocationConsistent, 'native-role-country-location-conflict-or-unknown')
  note(['FULLTIME', 'INTERN'].includes(role.job_type) && ['ON_SITE', 'HYBRID', 'REMOTE'].includes(role.workplace_type)
    && typeof role.remote === 'boolean' && !(role.remote && role.workplace_type === 'ON_SITE')
    && !(!role.remote && role.workplace_type === 'REMOTE'), 'native-employment-or-workplace-contract-unreviewed')
  note(typeof role.is_salary_visible === 'boolean' && typeof role.is_hr_job === 'boolean' && typeof role.is_seo_indexable === 'boolean', 'native-boolean-role-contract-unreviewed')
  note(text(role.currency) && ['ANNUAL', 'MONTHLY'].includes(role.salary_type) && text(role.department_name)
    && Number.isSafeInteger(role.department) && role.department > 0, 'native-compensation-or-department-contract-unreviewed')
  for (const key of ['created_at', 'valid_through']) note(typeof role[key] === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(role[key])
    && Number.isFinite(Date.parse(role[key])), 'native-date-field-unreviewed:' + key)
  if (text(role.description)) {
    try {
      const description = readVisibleNativeDocument(role.description, { strict: true })
      const visible = description.text(description.nodes(node => node.tag === 'root')[0])
      const active = extractActiveDescription(role.description)
      note(Boolean(visible && active && visible === active)
        && !/<(?:script|style|template|iframe|object|noscript)\b|<[^>]*\b(?:hidden|inert|aria-hidden)\b/i.test(role.description), 'native-visible-description-unreviewed')
    } catch { note(false, 'native-visible-description-unreviewed') }
  }
  if (Array.isArray(role.other_locations) && role.other_locations.length) note(false, 'native-country-alternatives-unreviewed')
  note(role.published_internally === false && role.is_employee_referral_flow_enabled === false, 'native-application-workflow-unreviewed')
  for (const field of ['skill', 'education', 'seniority']) note(Array.isArray(role[field]) && role[field].every(text), 'native-' + field + '-unreviewed')
  for (const [minimum, maximum] of [['min_salary', 'max_salary'], ['min_experience', 'max_experience']]) {
    const valid = value => value === null || typeof value === 'number' && Number.isFinite(value) && value >= 0 && (!Number.isInteger(value) || Number.isSafeInteger(value))
    note(valid(role[minimum]) && valid(role[maximum]) && (role[minimum] == null || role[maximum] == null || role[minimum] <= role[maximum]), 'native-criteria-range-unreviewed:' + minimum)
  }
  const questions = role.job_screening_questions
  note(Array.isArray(questions), 'native-screening-questions-unavailable')
  const questionIds = new Set()
  for (const question of Array.isArray(questions) ? questions : []) {
    const valid = plain(question) && text(question.uuid) && !questionIds.has(question.uuid) && text(question.question)
      && text(question.label) && typeof question.mandatory === 'boolean' && Array.isArray(question.choices) && question.choices.every(text)
    note(valid, 'native-screening-schema-unreviewed')
    if (!plain(question)) continue
    questionIds.add(question.uuid)
    extra(question, questionKeys, 'screening')
    note(['multi_choice', 'multi_line_text', 'single_text', 'yes_no_option'].includes(question.name), 'native-screening-input-unreviewed')
    for (const key of ['maximum_range', 'minimum_range', 'open_range', 'disqualifying_value']) {
      if (Object.hasOwn(question, key)) note(question[key] === null, 'native-screening-conditional-rule-unreviewed:' + key)
    }
  }
  const definitions = props.applicationFormFields, selections = props.jobApplicationFormFields
  note(Array.isArray(definitions) && Array.isArray(selections) && selections.length > 0, 'native-form-definition-or-selection-unavailable')
  const byId = new Map()
  for (const field of Array.isArray(definitions) ? definitions : []) {
    note(plain(field) && Number.isSafeInteger(field.id) && field.id > 0 && text(field.name) && text(field.input_type) && text(field.label), 'native-field-definition-schema-unreviewed')
    if (!plain(field)) continue
    extra(field, definitionKeys, 'applicationField')
    note(fieldNames.includes(field.name) && ['ADDRESS', 'CTC', 'EMAIL', 'FILE', 'PHONE', 'ROW', 'SELECT', 'TEXT'].includes(field.input_type), 'native-field-input-contract-unreviewed')
    note((field.placeholder === null || typeof field.placeholder === 'string') && Number.isSafeInteger(field.grid) && field.grid > 0
      && Number.isSafeInteger(field.group) && field.group >= 0, 'native-field-known-property-types-unreviewed')
    byId.set(field.id, [...(byId.get(field.id) || []), field])
  }
  const selectionIds = new Set(), selectedDefinitions = new Set()
  for (const selection of Array.isArray(selections) ? selections : []) {
    note(plain(selection) && Number.isSafeInteger(selection.id) && selection.id > 0 && !selectionIds.has(selection.id)
      && selection.job === role.id && Number.isSafeInteger(selection.application_field) && selection.application_field > 0 && !selectedDefinitions.has(selection.application_field)
      && typeof selection.mandatory === 'boolean', 'native-job-field-selection-unreviewed')
    if (!plain(selection)) continue
    selectionIds.add(selection.id); selectedDefinitions.add(selection.application_field)
    extra(selection, selectionKeys, 'jobApplicationField')
    const matches = byId.get(selection.application_field) || []
    note(matches.length === 1, 'native-selected-definition-missing-or-ambiguous')
    result.selectedFields.push(matches.length === 1
      ? { ...structuredClone(matches[0]), mandatory: selection.mandatory, nativeSelection: structuredClone(selection) }
      : { nativeSelection: structuredClone(selection), definitionCandidates: structuredClone(matches), mandatory: selection.mandatory })
  }
  result.schemaComplete = result.schemaIssues.length === 0
  return result
}

// Preserve schema absence as well as changed wording; never normalize away an
// old disqualification/mandatory field while comparing the two actual copies.
export const compareCodemonkQuestions = (corporate, native) => {
  const differences = [], left = new Map((Array.isArray(corporate) ? corporate : []).map(row => [row?.uuid, row]))
  const right = new Map((Array.isArray(native) ? native : []).map(row => [row?.uuid, row]))
  for (const id of new Set([...left.keys(), ...right.keys()])) {
    const a = left.get(id), b = right.get(id)
    if (!plain(a) || !plain(b)) {
      differences.push({ path: '/job_screening_questions/' + id, corporate: a ?? null, native: b ?? null,
        corporateAbsent: !left.has(id), nativeAbsent: !right.has(id) })
      continue
    }
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) if (!isDeepStrictEqual(a[key], b[key])) {
      differences.push({ path: '/job_screening_questions/' + id + '/' + key,
        corporate: a[key] ?? null, native: b[key] ?? null,
        corporateAbsent: !Object.hasOwn(a, key), nativeAbsent: !Object.hasOwn(b, key) })
    }
  }
  return differences
}
