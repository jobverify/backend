import { decodeJavaScriptStringLiteral } from '../../scraper-support/utils/safeLiteral.js'

const ORIGIN = 'https://www.sakarrobotics.com'
const ZOHO = 'https://sakarrobotics.zohorecruit.in'
const PAGE = 'sakarrobotics-career'
// Unrecognized country labels are incomplete scope, never an empty India result.
const VERIFIED_COUNTRIES = new Set(['India', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 'Singapore', 'United Arab Emirates', 'Saudi Arabia', 'Japan', 'Netherlands', 'Ireland', 'New Zealand', 'China', 'Italy', 'Spain', 'Sweden', 'Switzerland'].map(country => country.toLowerCase()))
const decode = value => String(value || '').replace(/&#(\d+);/g,(_,code)=>String.fromCodePoint(Number(code))).replace(/&quot;/g,'"').replace(/&amp;/g,'&')

export const readCurrentSakarInventory = async ({ html, readText, readJson }) => {
  const asset = name => {
    const src = String(html).match(new RegExp('src=["\'](/build/' + name + '\\.js\\?v=\\d+)["\']'))?.[1]
    if (!src) throw new Error('Sakar current application bundle is missing')
    return new URL(src, ORIGIN).href
  }
  const company = await readText(asset('pages/company'))
  const app = await readText(asset('app'))
  if (!/function Careers\(/.test(company) || !/page_name:\s*["']sakarrobotics-career["']/.test(company) || !/site:\s*["']https:\/\/sakarrobotics\.zohorecruit\.in["']/.test(company) || !/source:\s*["']CareerSite["']/.test(company) || !/p\s*===\s*["']\/company\/careers["']/.test(app) || !/createElement\(Careers\b/.test(app)) throw new Error('Sakar current careers route or exact Zoho handoff is unverified')
  const board = await readText(ZOHO + '/jobs/' + PAGE)
  if (!/<title>\s*Careers at Sakar Robotics\s*<\/title>/i.test(board)) throw new Error('Sakar invalid current Zoho board identity')
  const tag = String(board).match(/<input\b(?=[^>]*id=["']jobs["'])[^>]*>/i)?.[0]
  let records
  try {records=JSON.parse(decode(tag?.match(/value=["']([^"']*)["']/i)?.[1]))} catch {throw new Error('Sakar invalid embedded jobs inventory')}
  const payload = await readJson(ZOHO + '/recruit/v2/public/Job_Openings?pagename=' + PAGE + '&source=CareerSite&extra_fields=%5B%22Work_Experience%22,%22Job_Description%22,%22Date_Opened%22%5D')
  if (!Array.isArray(records) || payload?.code !== 'success' || !Array.isArray(payload.data) || payload.info?.page_name !== PAGE || payload.info?.more_records) throw new Error('Sakar invalid or incomplete pagination payload')
  const check = rows => {
    const ids=new Set()
    for(const row of rows) {
      if (!row?.id || !row.Posting_Title || typeof row.Country !== 'string' || !row.Country.trim() || row.Publish === false) throw new Error('Sakar invalid job identity or country scope')
      if (!VERIFIED_COUNTRIES.has(row.Country.trim().toLowerCase())) throw Object.assign(new Error('Sakar job country scope is unverified'), { code: 'SAKAR_LOCATION_UNVERIFIED', softFailure: true, failureKind: 'upstream_scope_unverified', abortRetries: true })
      if (ids.has(row.id)) throw new Error('Sakar duplicate inventory job')
      ids.add(row.id)
    }
    return ids
  }
  const boardIds=check(records),apiIds=check(payload.data)
  if(boardIds.size!==apiIds.size || [...apiIds].some(id=>!boardIds.has(id)))throw new Error('Sakar incomplete API inventory disagrees with embedded board')
  const details=[]
  for(const row of payload.data) {
    const existing=records.find(record=>record.id===row.id)
    if(existing.Posting_Title!==row.Posting_Title || existing.Country!==row.Country) throw new Error('Sakar inconsistent board snapshot')
    const url=new URL(row.$url || 'https://invalid.example/')
    if(url.origin!==ZOHO || !url.pathname.startsWith('/jobs/'+PAGE+'/'+row.id+'/'))throw new Error('Sakar invalid job URL identity')
    if(!/^India$/i.test(row.Country.trim())) {details.push(row);continue}
    const detailHtml=await readText(row.$url)
    const literal=String(detailHtml).match(/(?:var|let|const)\s+jobs\s*=\s*JSON\.parse\(\s*((?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'))\s*\)/)?.[1]
    let parsed
    try {parsed=JSON.parse(decodeJavaScriptStringLiteral(literal))}catch{throw new Error('Sakar invalid job detail data')}
    const detail=parsed?.[0]
    if(!Array.isArray(parsed)||parsed.length!==1||detail.id!==row.id||detail.Posting_Title!==row.Posting_Title||detail.Country!==row.Country||typeof detail.Job_Description!=='string'||detail.Job_Description.length<40)throw new Error('Sakar mismatched or incomplete job detail identity')
    if(detail.Date_Opened && (!/^\d{4}-\d{2}-\d{2}$/.test(detail.Date_Opened)||!Number.isFinite(Date.parse(detail.Date_Opened))||new Date(detail.Date_Opened).toISOString().slice(0,10)!==detail.Date_Opened))throw new Error('Sakar invalid job detail posting date')
    details.push({...detail,$url:row.$url})
  }
  return {code:'success',data:details}
}