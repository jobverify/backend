import { decodeHTML } from 'entities'
import { readFileSync } from 'node:fs'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

const shape = JSON.parse(readFileSync(new URL('./reviewedModelShape20261113.json', import.meta.url)))

const fields = new Set(('_key _offset _operation _partition application_type benefits category city contact_email country created_at '
  + 'description disclaimers environments hiring_type i18n is_expired is_hidden is_hot job_specialization locale metadata name '
  + 'permalink_key posting_type primary_skill referral_campaign relocation relocation_destination request_id sd_pool_id '
  + 'sd_position_id sd_requisition_id seniority seo skill_spec skills tags tenant tests text uid unique_id updated_at vacancy_type').split(' '))
const categoryFields = new Set(['about_the_customer', 'about_the_project', 'nice_to_have', 'requirements', 'responsibilities', 'technologies'])
const metadataFields = new Set(['city', 'country', 'job_specialization', 'primary_skill', 'seniority', 'skill_spec', 'skills', 'vacancy_type'])
const plainTags = new Set(['root', 'p', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'br', 'span', 'sup', 'sub'])
const normalize = value => decodeHTML(String(value ?? '')).replace(/\s+/g, ' ').trim()
const fail = code => { throw Object.assign(new Error(code), { code }) }
const check = (condition, code) => { if (!condition) fail(code) }
const object = value => value && typeof value === 'object' && !Array.isArray(value)
const exactKeys = (value, allowed) => object(value) && Object.keys(value).every(key => allowed.has(key))
const walk = node => [node, ...node.children.filter(child => typeof child !== 'string').flatMap(walk)]

const validateShape = (value, path = 'role') => {
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value
  const expected = shape[path]
  check(expected && expected.types.includes(type), 'native-unreviewed-nested-value:' + path)
  if (type === 'string' && !/^role\.(?:description|(?:benefits|disclaimers)\[\]\.content|category\.[a-z_]+\[\])$/.test(path)) {
    check(!/<\/?[a-z!][^>]*>/i.test(decodeHTML(value))
      && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value),
    'native-non-criteria-markup-unqualified:' + path)
  }
  if (type === 'object') {
    check(Object.keys(value).length === expected.keys.length
      && Object.keys(value).every(key => expected.keys.includes(key)), 'native-unreviewed-nested-member:' + path)
    for (const [key, child] of Object.entries(value)) validateShape(child, path + '.' + key)
  } else if (type === 'array') {
    for (const child of value) validateShape(child, path + '[]')
  }
}

// Only the original plain formatting vocabulary is qualified. Word layout,
// visibility attributes, scripts, classes and new authored markup stay held.
// No metadata text or generated heading can replace an unqualified fragment.
export function readCurrentEpamCriterion(value) {
  check(typeof value === 'string' && normalize(value), 'native-criterion-text-missing')
  const doc = readNativeDocument(value)
  const root = doc.nodes(node => node.tag === 'root')[0]
  check(root && walk(root).every(node => plainTags.has(node.tag) && !node.inert
    && Object.keys(node.attrs).length === 0 && !node.raw), 'native-criterion-markup-unqualified')
  const text = doc.text(root)
  check(text && text.length <= 500000, 'native-criterion-text-unqualified')
  return text
}

function supplementCountries(row, record, label) {
  check(Array.isArray(row.country) && row.country.length > 0 && row.country.every(country => object(country)
    && Object.keys(country).every(key => ['id', 'name', 'type'].includes(key))
    && country.id === '4060741400035606931' && country.name === 'India'
    && (country.type == null || country.type === 'Country')), label + '-country-unqualified')
  check(row.state == null, label + '-state-restriction-unqualified')
  if (Object.hasOwn(row, 'city')) {
    check(Array.isArray(row.city) && row.city.length > 0 && row.city.every(city => object(city)
      && Object.keys(city).every(key => ['id', 'name'].includes(key))
      && record.city.some(known => known.id === city.id && known.name === city.name)), label + '-city-restriction-unqualified')
  }
}

export function qualifyCurrentEpamModel(record) {
  validateShape(record)
  check(exactKeys(record, fields), 'native-unreviewed-role-member')
  check(record.hiring_type === 'vacancy' && record.posting_type === 'Standard'
    && record.tenant === 'epamgdo' && record.locale === 'en-us'
    && record.application_type === 'full-self-service'
    && record.is_hidden === false && record.is_expired === false,
  'native-current-vacancy-or-application-unqualified')
  check(record.relocation === false && Array.isArray(record.relocation_destination)
    && record.relocation_destination.length === 0, 'native-relocation-criteria-unqualified')
  check(exactKeys(record.tests, new Set(['required'])) && record.tests.required == null,
    'native-additional-application-test-unqualified')
  check(exactKeys(record.metadata, metadataFields), 'native-unreviewed-role-metadata')
  check(Array.isArray(record.country) && record.country.length > 0
    && record.country.every(country => country?.id === '4060741400035606931' && country?.name === 'India'),
  'native-non-india-criterion-alternative-unqualified')
  check(typeof record.created_at === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(record.created_at)
    && Number.isFinite(Date.parse(record.created_at)) && new Date(record.created_at).toISOString() === record.created_at,
  'native-original-posting-date-unqualified')
  for (const localized of Object.values(record.i18n)) {
    check(Array.isArray(localized.country) && localized.country.length === 1
      && localized.country[0].split('#')[0] === '4060741400035606931', 'native-localized-country-alternative-unqualified')
    check(localized.city.every(city => {
      const [countryId, stateId, cityId] = city.split('#')
      return countryId === '4060741400035606931'
        && record.city.some(known => known.id === cityId && known.state?.id === stateId)
    }), 'native-localized-city-alternative-unqualified')
  }
  check(exactKeys(record.category, categoryFields), 'native-unreviewed-criteria-section')
  const introduction = readCurrentEpamCriterion(record.description)
  check(typeof record.text === 'string' && !/<\/?[a-z!][^>]*>/i.test(record.text), 'native-plain-criteria-model-unqualified')
  const originalText = normalize(record.text)
  check(originalText.length > 100 && originalText.includes(introduction), 'native-full-description-missing')
  let sections = 0
  for (const value of Object.values(record.category)) {
    if (value == null) continue
    check(Array.isArray(value) && value.length > 0, 'native-criterion-section-shape-unqualified')
    for (const original of value) {
      const text = readCurrentEpamCriterion(original)
      check(originalText.includes(text), 'native-full-description-section-missing')
      sections++
    }
  }
  check(sections > 0, 'native-full-description-role-sections-missing')
  check(Array.isArray(record.benefits) && record.benefits.length > 0
    && Array.isArray(record.disclaimers), 'native-original-supplements-missing')
  const benefits = []
  for (const benefit of record.benefits) {
    check(exactKeys(benefit, new Set(['content', 'country', 'state', 'title'])), 'native-unreviewed-benefit-member')
    supplementCountries(benefit, record, 'native-benefit')
    benefits.push(readCurrentEpamCriterion(benefit.content))
  }
  const disclaimers = []
  for (const disclaimer of record.disclaimers) {
    check(exactKeys(disclaimer, new Set(['city', 'content', 'country', 'name', 'order', 'position', 'state', 'title']))
      && disclaimer.position === 'bdt' && Number.isSafeInteger(disclaimer.order), 'native-unreviewed-disclaimer-member')
    supplementCountries(disclaimer, record, 'native-disclaimer')
    disclaimers.push({ order: disclaimer.order, text: readCurrentEpamCriterion(disclaimer.content) })
  }
  // The current producer names bdt "Before Description - Top". Identical prose
  // repeated for several explicit work cities is preserved once in the text;
  // every original city-specific object remains in the untouched native model.
  const description = [...disclaimers.sort((a, b) => a.order - b.order).map(row => row.text),
    originalText, ...benefits]
  return { jobDescription: [...new Set(description)].join('\n\n'),
    applicationType: record.application_type, originalIntroduction: introduction }
}
