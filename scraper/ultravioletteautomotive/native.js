import { document, norm, decode } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { nativeCountryName, nativeLocationCountryName } from '../../scraper-support/shared/nativeJobPosting.js'

export const LEGAL_EMPLOYER = 'Ultraviolette Automotive Private Limited'
export const BOARD_URL = 'https://ultraviolette.zohorecruit.in/jobs/Careers'
export const API_URL = 'https://ultraviolette.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite'
const requireNative = (ok, message) => { if (!ok) throw new Error('Ultraviolette native contract: ' + message) }
const one = (items, name) => { requireNative(items.length === 1, 'missing or ambiguous ' + name); return items[0] }
export const nativeDocument = html => document(String(html).replace(/content-visibility\s*:\s*hidden/gi, 'display:none'))
const input = (doc, id) => JSON.parse(one(doc.nodes(n => n.tag === 'input' && n.attrs.id === id), id).attrs.value)
export const roleId = value => {
  const url = new URL(value)
  requireNative(url.origin === new URL(BOARD_URL).origin && /^\/jobs\/Careers\/\d+\/[^/]+$/.test(url.pathname), 'unapproved native role URL')
  return url.pathname.split('/')[3]
}
const meta = (doc, property) => one(doc.nodes(n => n.tag === 'meta' && n.attrs.property === property), property).attrs.content
const indiaStates = new Set('Andhra Pradesh|Arunachal Pradesh|Assam|Bihar|Chhattisgarh|Goa|Gujarat|Haryana|Himachal Pradesh|Jharkhand|Karnataka|Kerala|Madhya Pradesh|Maharashtra|Manipur|Meghalaya|Mizoram|Nagaland|Odisha|Punjab|Rajasthan|Sikkim|Tamil Nadu|Telangana|Tripura|Uttar Pradesh|Uttarakhand|West Bengal|Andaman and Nicobar Islands|Chandigarh|Dadra and Nagar Haveli and Daman and Diu|Delhi|Jammu and Kashmir|Ladakh|Lakshadweep|Puducherry'.toLowerCase().split('|'))
const foreignStates = new Map([['california','United States'], ['ca','United States'], ['ontario','Canada'], ['on','Canada'], ['quebec','Canada'], ['british columbia','Canada']])
function validateGeography(record, kind) {
  const allowed = new Set(kind === 'listing' ? ['Country','City','Country1'] : ['Country','Country1','City','State','Zip_Code'])
  for (const key of Object.keys(record)) requireNative(!/country|countrie|state|province|location|address|city|postal|zip|region|office|workplace|remote/i.test(key) || allowed.has(key), 'unreviewed geographic field ' + key)
  const rawCountries = [record.Country, record.Country1].filter(value => value != null && value !== '')
  const countries = rawCountries.map(nativeCountryName)
  requireNative(countries.length > 0 && countries.every(country => country && country === countries[0]), 'missing or contradictory explicit country')
  const country = countries[0]
  for (const key of ['City','State']) {
    if (record[key] == null || record[key] === '') continue
    requireNative(typeof record[key] === 'string', 'invalid geographic ' + key)
    const explicit = nativeLocationCountryName(record[key])
    requireNative(!explicit || explicit === country, 'geographic ' + key + '/country contradiction')
  }
  if (record.State) {
    const state = norm(record.State).toLowerCase()
    const stateCountry = indiaStates.has(state) ? 'India' : foreignStates.get(state) || nativeLocationCountryName(record.State)
    requireNative(stateCountry && stateCountry === country, 'unreviewed or contradictory geographic state/country')
  }
  return country
}
export function readBoard(html) {
  const doc = nativeDocument(html)
  requireNative(meta(doc, 'og:site_name') === LEGAL_EMPLOYER, 'board employer changed')
  const page = input(doc, 'pageJson')
  requireNative(page.detail.section.header.links.some(link => link.linkurl === 'https://www.ultraviolette.com/careers/'), 'native official backlink changed')
  const blocks = page.detail.section.data.filter(block => block.blocktype === 'jobs' && block.isenabled === true)
  requireNative(blocks.length === 1 && blocks[0].layout === 1, 'unreviewed board jobs layout')
  const jobs = input(doc, 'jobs')
  requireNative(Array.isArray(jobs), 'board jobs missing')
  return jobs
}
export function readAPI(body, boardRows) {
  const payload = JSON.parse(body)
  requireNative(payload.code === 'success' && payload.info?.page_name === 'Careers' && payload.info.layout === 1 && Array.isArray(payload.data), 'API shape changed')
  for (const container of [payload, payload.info]) for (const key of ['more_records','next_page','hasMore','has_more','next','nextPage','nextPageToken','continuationToken']) requireNative(!container[key], 'unexpected API pagination')
  const ids = rows => rows.map(row => row.id).sort()
  requireNative(new Set(ids(payload.data)).size === payload.data.length, 'duplicate native IDs')
  requireNative(JSON.stringify(ids(payload.data)) === JSON.stringify(ids(boardRows)), 'API/embedded complete board ID mismatch')
  for (const row of payload.data) {
    const board = boardRows.find(item => item.id === row.id)
    validateGeography(row, 'listing')
    validateGeography(board, 'listing')
    requireNative(typeof row.id === 'string' && roleId(row.$url) === row.id && norm(row.Posting_Title) && row.Publish === true && row.Is_Locked === false, 'invalid or inactive native listing')
    for (const key of ['Posting_Title', 'Country', 'City', 'Job_Type']) requireNative(row[key] === board[key], 'API/board ' + key + ' mismatch')
  }
  return payload.data
}
const decodeLiteral = value => value.replace(/\\(x[\da-f]{2}|u[\da-f]{4}|[\s\S])/gi, (_, value) => value[0] === 'x' ? String.fromCharCode(parseInt(value.slice(1), 16)) : value[0] === 'u' ? String.fromCharCode(parseInt(value.slice(1), 16)) : ({ n:'\n', r:'\r', t:'\t', b:'\b', f:'\f', v:'\v', 0:'\0' }[value] ?? value))
export function descriptionText(html, title) {
  if (typeof html !== 'string') return null
  const doc = nativeDocument(html)
  const text = node => node.inactive || ['script','style','title','strong','b'].includes(node.tag) || /^h[1-6]$/.test(node.tag) ? '' : node.children.map(child => typeof child === 'string' ? decode(child) : text(child)).join(' ')
  const prose = norm(text(doc.root)).replace(/\b(?:job description|job responsibilities|responsibilities|requirements|qualifications|job summary)\s*[:\-]?/gi, '').trim()
  const content = norm(doc.text(doc.root))
  return prose.length >= 30 && content !== norm(title) && !/^(?:job description|description|coming soon|apply now|tbd|placeholder)[\s.!:\-]*$/i.test(prose) ? content : null
}
export function readDetail(html, row) {
  const doc = nativeDocument(html)
  requireNative(meta(doc, 'og:site_name') === LEGAL_EMPLOYER, 'detail employer changed')
  requireNative(roleId(meta(doc, 'og:url')) === row.id, 'detail URL ID mismatch')
  const scripts = doc.nodes(n => n.tag === 'script' && !n.attrs.src).map(node => node.raw || '')
  const matches = scripts.flatMap(script => [...script.matchAll(/var\s+jobs\s*=\s*JSON\.parse\(\s*'((?:\\.|[^'\\])*)'\s*\)/g)])
  const jobs = JSON.parse(decodeLiteral(one(matches, 'native role data')[1]))
  requireNative(Array.isArray(jobs) && jobs.length === 1, 'ambiguous detail jobs')
  const detail = jobs[0]
  const detailCountry = validateGeography(detail, 'detail')
  validateGeography(row, 'listing')
  requireNative(detail.id === row.id && norm(detail.Posting_Title) === norm(row.Posting_Title), 'detail identity mismatch')
  requireNative(detail.Publish === true && detail.Is_Locked === false, 'detail closed or locked')
  requireNative(meta(doc, 'og:title') === LEGAL_EMPLOYER + ' - ' + detail.Posting_Title + ' in ' + detail.City, 'detail title changed')
  for (const field of ['City','Country','Job_Type']) requireNative(detail[field] === row[field], 'listing/detail ' + field + ' contradiction')
  const countries = [detail.Country, detail.Country1, row.Country, row.Country1].filter(value => value != null && value !== '').map(nativeCountryName)
  requireNative(countries.length > 0 && countries.every(country => country && country === countries[0]), 'missing or contradictory explicit country')
  const description = descriptionText(detail.Job_Description, detail.Posting_Title)
  return { detail, country: detailCountry, description }
}
