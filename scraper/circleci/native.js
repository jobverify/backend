import { createHash } from 'node:crypto'
import { activeHead, decodeNativeEntities, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'

export const NATIVE_API_URL = 'https://boards-api.greenhouse.io/v1/boards/circleci/jobs?content=true'
export const CAREERS_URL = 'https://circleci.com/careers/jobs/'
export const check = (ok, message) => { if (!ok) throw Object.assign(new Error('[circleci] Current native contract: ' + message), { abortRetries: true, failureKind: 'parser_or_contract_error' }) }
export const norm = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value
export const digest = value => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')
const within = (node, predicate) => node.inert ? [] : [...(predicate(node) ? [node] : []), ...node.children.filter(child => typeof child !== 'string').flatMap(child => within(child, predicate))]
export const roleUrl = record => {
  let url
  try { url = new URL(record.absolute_url) } catch { check(false, 'native role URL is invalid') }
  check(['http:', 'https:'].includes(url.protocol) && ['circleci.com', 'www.circleci.com'].includes(url.hostname)
    && !url.username && !url.password && !url.port && url.pathname === `/careers/jobs/${record.id}/`
    && url.searchParams.getAll('gh_jid').length === 1 && url.searchParams.get('gh_jid') === String(record.id)
    && [...url.searchParams.keys()].every(key => key === 'gh_jid') && !url.hash, 'native role URL employer or role identity changed')
  return `https://circleci.com/careers/jobs/${record.id}/?gh_jid=${record.id}`
}
export const readCorporateRoles = html => {
  const doc = readVisibleNativeDocument(html, { strict: true })
  check(activeHead(html).titles.some(title => title === 'Career Opportunities - CircleCI')
    && doc.nodes(node => /^h[12]$/.test(node.tag) && /Current open roles/i.test(doc.text(node))).length > 0
    && doc.nodes(node => node.attrs.id === 'jobs-list').length === 1, 'official current open roles scope changed')
  const ids = new Set(), roles = []
  for (const node of doc.nodes(node => node.tag === 'a' && /\/careers\/jobs\/\d+/.test(node.attrs.href || ''))) {
    const url = new URL(node.attrs.href, CAREERS_URL), id = url.pathname.match(/^\/careers\/jobs\/(\d+)\/$/)?.[1]
    check(url.origin === 'https://circleci.com' && id && url.searchParams.getAll('gh_jid').length === 1
      && url.searchParams.get('gh_jid') === id && !ids.has(id), 'corporate role URL is foreign, duplicate or malformed')
    const titles = within(node, child => child.tag === 'h3'), locations = within(node, child => child.tag === 'p')
    check(titles.length === 1 && locations.length === 1 && doc.text(titles[0]) && doc.text(locations[0]), 'corporate role title or location is missing')
    ids.add(id); roles.push({ id, title: doc.text(titles[0]), location: doc.text(locations[0]), url: url.href })
  }
  check(roles.length > 0, 'corporate role inventory is absent')
  return roles
}
export const verifyNativeRoleBinding = (html, row, native) => {
  const doc = readVisibleNativeDocument(html, { strict: true })
  const heads = doc.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical')
  check(heads.length === 1 && new URL(heads[0].attrs.href, row.url).href === row.url
    && doc.nodes(node => node.tag === 'h1' && doc.text(node) === row.title).length === 1
    && doc.nodes(node => node.attrs.id === 'grnhse_app').length === 1, 'official role canonical/title/application scope changed')
  const embeds = doc.nodes(node => node.tag === 'script' && node.attrs.src === 'https://boards.greenhouse.io/embed/job_board/js?for=circleci')
  check(embeds.length === 1, 'active current role Greenhouse board handoff is absent or foreign')
  const articles = doc.nodes(node => node.tag === 'article')
  check(articles.length === 1 && doc.text(articles[0]) === extractActiveDescription(decodeNativeEntities(native.content)), 'official/native full role criteria disagree')
}
export const validateNativeRecords = payload => {
  check(Array.isArray(payload?.jobs) && Number.isSafeInteger(payload?.meta?.total) && payload.meta.total === payload.jobs.length, 'native inventory count is absent or truncated')
  const ids = new Set()
  for (const record of payload.jobs) {
    check(Number.isSafeInteger(record?.id) && record.id > 0 && !ids.has(record.id) && norm(record.title), 'native role identity is missing or duplicated')
    ids.add(record.id); roleUrl(record)
    if (record.first_published != null) check(typeof record.first_published === 'string' && /^\d{4}-\d\d-\d\dT/.test(record.first_published) && Number.isFinite(Date.parse(record.first_published)), 'native original publication date is malformed')
  }
  return payload.jobs
}
export const reviewDescription = html => {
  if (typeof html !== 'string') return null
  const text = extractActiveDescription(html)
  if (!text || /^(?:please\s+)?enter\s+(?:the\s+)?job\s+description[.!]*$/i.test(text)
    || /<[^>]+\b(?:hidden|inert)(?:\s|=|>)|display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0|(?:height|width|font-size)\s*:\s*0\b/i.test(html)) return null
  return html
}

export const reviewApplicationDetail = (payload, record) => {
  check(payload?.id === record.id && payload.company_name === 'CircleCI' && norm(payload.title) === norm(record.title)
    && roleUrl(payload) === roleUrl(record) && digest(payload.location) === digest(record.location)
    && digest(payload.offices) === digest(record.offices)
    && (record.first_published == null || Date.parse(payload.first_published) === Date.parse(record.first_published)), 'native application detail employer, role, date or country identity disagrees')
  const description = reviewDescription(decodeNativeEntities(payload.content || ''))
  const listing = reviewDescription(decodeNativeEntities(record.content || ''))
  check(!description || !listing || extractActiveDescription(description) === extractActiveDescription(listing), 'listing/detail full native job criteria disagree')
  const fieldTypes = new Set(['input_text', 'input_file', 'textarea', 'multi_value_single_select', 'multi_value_multi_select'])
  const validQuestion = question => typeof question?.label === 'string' && norm(question.label)
    && typeof question.required === 'boolean' && Array.isArray(question.fields) && question.fields.length > 0
    && question.fields.every(field => field && typeof field.name === 'string' && fieldTypes.has(field.type)
      && (field.values == null || Array.isArray(field.values)))
  const standardLocationInput = question => question?.required === true && question.description == null
    && Array.isArray(question.fields) && question.fields.length === 1
    && ['location', 'latitude', 'longitude'].includes(question.fields[0]?.name)
    && norm(question.label).toLowerCase() === question.fields[0].name
    && question.fields[0].type === (question.fields[0].name === 'location' ? 'input_text' : 'input_hidden')
    && Array.isArray(question.fields[0].values) && question.fields[0].values.length === 0
  const questionShape = Array.isArray(payload.questions) && payload.questions.every(validQuestion)
    && Array.isArray(payload.location_questions) && payload.location_questions.every(question => standardLocationInput(question) || validQuestion(question))
  const personal = /(?:first|last|preferred)\s+name|pronouns?|\b(?:email|phone|linkedin|website)\b/i
  const questions = questionShape ? [...payload.questions.filter(question => !personal.test(question.label)
    && question.fields.some(field => /^question_\d+$/.test(field.name))),
    ...payload.location_questions.filter(question => !standardLocationInput(question))] : null
  const deadline = payload.application_deadline
  if (deadline != null) check(typeof deadline === 'string' && /^\d{4}-\d\d-\d\d(?:T|$)/.test(deadline) && Number.isFinite(Date.parse(deadline)), 'native application deadline is malformed')
  return { payload, description, questions, complete: !!description && questionShape,
    snapshot: digest(payload), applicationDeadline: deadline ?? null,
    ...(!questionShape ? { failureKind: 'unreviewed-native-application-question-shape' } : {}) }
}
