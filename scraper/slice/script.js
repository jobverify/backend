import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {SLICE_CATALOG as PROVIDER_METADATA} from './catalog.js'

const currentDir=path.dirname(fileURLToPath(import.meta.url))
export {PROVIDER_METADATA}
export const SOURCE=PROVIDER_METADATA.source
export const COMPANY=PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME=PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON=PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY=PROVIDER_METADATA.verifiedSurfaceSummary
export const SLICE_BANK_CAREERS_URL=PROVIDER_METADATA.companyCareerPage
export const SLICE_BANK_OPEN_POSITIONS_URL=PROVIDER_METADATA.officialBankOpenPositionsUrl
export const SLICE_KULA_BOARD_URL=PROVIDER_METADATA.publicBoardUrl
export const SLICE_JOBS_API_URL=PROVIDER_METADATA.jobsApiUrl
const ACCOUNT_ID=1528
const PAGE_SIZE=99

const normalizeWhitespace=value=>String(value??'')
  .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,' ')
  .replace(/<[^>]+>/g,' ')
  .replace(/&nbsp;/gi,' ').replace(/&amp;|&#038;/gi,'&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi,'"').replace(/&apos;|&rsquo;|&#39;/gi,"'")
  .replace(/&mdash;/gi,'—').replace(/&ndash;/gi,'–')
  .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
  .replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const code=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return code>0&&code<=0x10ffff?String.fromCodePoint(code):' '})
  .replace(/\s+/g,' ').trim()
const titleText=html=>normalizeWhitespace(String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])
const trustedUrl=(value,expected)=>{
  try{const url=new URL(value);const target=new URL(expected);return url.origin===target.origin&&url.pathname.replace(/\/$/,'')===target.pathname.replace(/\/$/,'')&&!url.username&&!url.password&&url.search===target.search}catch{return false}
}
const pageIdentity=(page,expected)=>page?.status===200&&trustedUrl(page.url,expected)
const signalFor=signal=>signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)
const defaultFetchPage=async(url,{signal}={})=>{
  const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',Accept:'text/html'},signal:signalFor(signal),redirect:'follow'})
  return {status:response.status,url:response.url,html:await response.text()}
}
const defaultFetchJson=async(url,{signal}={})=>{
  const response=await fetch(url,{headers:{Accept:'application/json'},signal:signalFor(signal),redirect:'follow'})
  if(!response.ok||!trustedUrl(response.url,url))throw new Error('Slice native API HTTP or redirect identity failure: '+response.status)
  return response.json()
}

export const hasVerifiedSliceBankCareersSignal=(html='')=>{
  const text=normalizeWhitespace(html)
  return /^careers \| we go big\. we go beyond \| slice$/i.test(titleText(html))
    &&text.includes('Unleash your potential.')&&text.includes('See all open positions')&&text.includes('slice small finance bank ltd')
    &&[...String(html).matchAll(/href=["']([^"']+)["']/gi)].some(m=>{try{return trustedUrl(new URL(m[1],SLICE_BANK_CAREERS_URL).href,SLICE_BANK_OPEN_POSITIONS_URL)}catch{return false}})
}
export const hasVerifiedSliceBankOpenPositionsSignal=(html='')=>{
  const links=[...String(html).matchAll(/(?:href|src)=["']([^"']+)["']/gi)].map(m=>m[1].replaceAll('&amp;','&'))
  const kulaLinks=links.filter(link=>/^https:\/\/careers\.kula\.ai\//i.test(link))
  return /^open positions \| careers \| slice$/i.test(titleText(html))
    &&normalizeWhitespace(html).includes('slice small finance bank ltd')
    &&kulaLinks.length>0&&kulaLinks.every(link=>trustedUrl(link,SLICE_KULA_BOARD_URL))
}
const verifyBoard=html=>{
  const organizations=[]
  for(const m of String(html).matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    let value;try{value=JSON.parse(m[1])}catch{throw new Error('Slice Kula employer identity payload is malformed')}
    for(const item of Array.isArray(value)?value:[value])if(item?.['@type']==='Organization')organizations.push(item)
  }
  if(titleText(html)!=='slice Careers | Open Jobs'||organizations.length!==1||organizations[0].name!=='slice'
    ||!trustedUrl(organizations[0].url,'https://slice.bank.in/')||!trustedUrl(organizations[0].sameAs,'https://slice.bank.in/'))throw new Error('Slice Kula board employer identity changed')
  const links=new Map()
  for(const m of String(html).matchAll(/href=["']([^"']+)["']/gi)){
    const value=m[1].replaceAll('&amp;','&');let url;try{url=new URL(value,SLICE_KULA_BOARD_URL)}catch{continue}
    const match=url.pathname.match(/^\/slice\/([1-9]\d*)(?:-[a-z0-9-]+)?$/)
    if(!match)continue
    if(url.origin!=='https://careers.kula.ai'||url.username||url.password||url.search!=='?jobs=true')throw new Error('Slice apply URL identity changed')
    if(links.has(match[1])&&links.get(match[1])!==url.href)throw new Error('Slice duplicate apply URL identity')
    links.set(match[1],url.href)
  }
  return links
}
// This is the published Kula client R7 canonical job-link algorithm (80-character word boundary).
const jobPath=(id,title)=>{
  let slug=title.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')
  if(slug.length>80){const prefix=slug.slice(0,80);const last=prefix.lastIndexOf('-');slug=slug[80]==='-'?prefix:last>0?prefix.slice(0,last):prefix}
  return '/slice/'+id+(slug?'-'+slug:'')+'?jobs=true'
}
const validatePayload=(payload,page,total,pages)=>{
  const m=payload?.meta
  if(!Array.isArray(payload?.data)||!Array.isArray(payload.errors)||payload.errors.length||!m
    ||!Number.isInteger(m.count)||m.count<0||m.page!==page||m.items!==PAGE_SIZE
    ||!Number.isInteger(m.pages)||m.pages<0||m.pages>1000
    ||(m.count>0&&m.pages!==Math.ceil(m.count/PAGE_SIZE))||(m.count===0&&m.pages>1)
    ||(total!==null&&total!==m.count)||(pages!==null&&pages!==m.pages)
    ||payload.data.length!==Math.min(PAGE_SIZE,Math.max(0,m.count-(page-1)*PAGE_SIZE)))throw new Error('Slice native inventory count, pagination or error payload changed')
  return m
}
const normalizeJob=(row,applyUrl,scrapedAt)=>{
  if(!Number.isSafeInteger(row?.id)||row.id<1||row.account_id!==ACCOUNT_ID||row.listed!==true||row.is_confidential!==false
    ||!['internal_and_external','external'].includes(row.kind)||!normalizeWhitespace(row.title))throw new Error('Slice public job tenant or identity changed')
  const ats=row.ats_job
  if(!ats||typeof ats.job_description!=='string'||/^\$/.test(ats.job_description.trim())||!normalizeWhitespace(ats.job_description))throw new Error('Slice full job description is absent or unresolved')
  if(!Array.isArray(ats.offices)||!ats.offices.length)throw new Error('Slice job geography has no verified office location')
  for(const office of ats.offices){
    if(!/^[A-Z]{2}$/.test(office.country_code||'')||!normalizeWhitespace(office.country)||!normalizeWhitespace(office.location)
      ||((office.country_code==='IN')!==(/^India$/i.test(office.country)))|| (office.country_code==='IN'&&!/\bIndia\b/i.test(office.location)))throw new Error('Slice job geography is missing or contradictory')
  }
  const offices=ats.offices.filter(o=>o.country_code==='IN')
  if(!offices.length)return null
  const cities=[...new Set(offices.map(o=>normalizeWhitespace(o.city)).filter(Boolean))]
  const remote=ats.workplace==='remote'||offices.every(o=>o.remote===true)
  return {jobId:String(row.id),requisitionId:String(row.id),title:normalizeWhitespace(row.title),company:COMPANY,
    department:normalizeWhitespace(ats.ats_department?.name)||null,location:[...new Set(offices.map(o=>normalizeWhitespace(o.location)))].join('; '),
    city:cities.length===1?cities[0]:null,country:'India',remoteStatus:remote?'Remote':ats.workplace==='hybrid'?'Hybrid':'On-site',
    employmentType:({full_time:'Full-time',part_time:'Part-time',contract:'Contract',internship:'Internship',temporary:'Temporary',seasonal:'Seasonal'})[ats.employment_type]||normalizeWhitespace(ats.work_type_name)||null,
    jobDescription:normalizeWhitespace(ats.job_description),postingDate:row.launch_at||null,closingDate:row.end_at||null,
    source:SOURCE,sourceUrl:applyUrl,applyUrl,link:applyUrl,scrapedAt,requiredSkills:[],attachmentUrl:null,
    experienceRequired:null,minimumQualification:null,preferredQualification:null}
}

export const createSliceScraper=()=>({
  async run({fetchPage=defaultFetchPage,fetchJson=defaultFetchJson,signal,now=()=>new Date().toISOString()}={}){
    signal?.throwIfAborted()
    const careers=await fetchPage(SLICE_BANK_CAREERS_URL,{signal})
    if(!pageIdentity(careers,SLICE_BANK_CAREERS_URL)||!hasVerifiedSliceBankCareersSignal(careers.html))throw new Error('Slice verified bank careers identity or redirect changed')
    const positions=await fetchPage(SLICE_BANK_OPEN_POSITIONS_URL,{signal})
    if(!pageIdentity(positions,SLICE_BANK_OPEN_POSITIONS_URL)||!hasVerifiedSliceBankOpenPositionsSignal(positions.html))throw new Error('Slice verified bank Kula handoff identity changed')
    const board=await fetchPage(SLICE_KULA_BOARD_URL,{signal})
    if(!pageIdentity(board,SLICE_KULA_BOARD_URL))throw new Error('Slice verified Kula board redirect identity changed')
    const links=verifyBoard(board.html),jobs=[],seen=new Set()
    let total=null,pages=null,pagesFetched=0
    do{
      signal?.throwIfAborted()
      const page=pagesFetched+1
      const url=SLICE_JOBS_API_URL+'?'+new URLSearchParams({accountName:'slice',page:String(page),type:'ats_job_post.index',items:String(PAGE_SIZE)})
      const payload=await fetchJson(url,{signal})
      const meta=validatePayload(payload,page,total,pages);total=meta.count;pages=meta.pages;pagesFetched++
      if(page===1&&(links.size!==payload.data.length||payload.data.some(row=>!links.has(String(row.id)))))throw new Error('Slice board and native inventory count or identity disagree')
      for(const row of payload.data){
        const id=String(row.id)
        if(seen.has(id))throw new Error('Slice duplicate job identity in paginated inventory')
        seen.add(id)
        const applyUrl=new URL(jobPath(id,row.title),SLICE_KULA_BOARD_URL).href
        if(links.has(id)&&links.get(id)!==applyUrl)throw new Error('Slice native job apply slug disagrees with verified board')
        const job=normalizeJob(row,applyUrl,now());if(job)jobs.push(job)
      }
    }while(pagesFetched<pages)
    if(seen.size!==total)throw new Error('Slice native inventory is incomplete')
    if(total===0&&!/No jobs found/i.test(normalizeWhitespace(board.html)))throw new Error('Slice empty inventory has no explicit verified board zero state')
    return attachInventoryEvidence(jobs,{status:total===0?'verified-empty':'complete-inventory',surface:SLICE_JOBS_API_URL,firstParty:true,
      listingComplete:true,pagesFetched,reportedTotal:total,indiaFacetCount:jobs.length,verifiedAt:now(),
      reason:'Exact bank-to-Kula handoff and bank employer identity; exhaustive native API totals, first-page apply links, explicit India offices and full descriptions'})
  },
})
export const run=async(options={})=>createSliceScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
  const jobs=await run()
  if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
  else await saveToDB(jobs,SOURCE)
}
