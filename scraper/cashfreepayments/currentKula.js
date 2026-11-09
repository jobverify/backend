import {activeHead,activeIframeSources,activeScripts,extractActiveDescription,readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {extractKulaNativeJobs,resolveKulaJobDescriptions} from '../../scraper-support/utils/kulaFlight.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

export const CASHFREE_CAREERS='https://www.cashfree.com/careers/'
export const CASHFREE_BOARD='https://careers.kula.ai/cashfree?jobs=true'
const LEGAL_COMPANY='Cashfree Payments India Private Limited',ACCOUNT_ID=1291
const clean=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const check=(ok,message)=>{if(!ok)throw Error('Cashfree native Kula: '+message)}
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item)
const corporate=html=>{
 const document=readNativeDocument(html)
 check(activeHead(html).titles.some(title=>/Career/i.test(title)&&/Cashfree Payments/.test(title)),'official careers employer identity changed')
 const links=document.nodes(node=>node.tag==='link'&&node.attrs.rel==='canonical')
 check(links.length===1&&links[0].attrs.href===CASHFREE_CAREERS,'official careers canonical identity changed')
 const frames=activeIframeSources(html)
 check(frames.filter(url=>url===CASHFREE_BOARD).length===1&&frames.filter(url=>/careers\.kula\.ai/.test(url)).every(url=>url===CASHFREE_BOARD),'current official Cashfree-to-Kula handoff is missing')
}
const rowsValid=rows=>{
 check(Array.isArray(rows)&&rows.length<=5000,'native inventory shape or size invalid')
 check(rows.every(row=>Number.isSafeInteger(row?.id)&&row.id>0&&clean(row.title))&&new Set(rows.map(row=>row.id)).size===rows.length,'native posting identity missing or repeated')
 check(rows.every(row=>row.account_id===ACCOUNT_ID),'native employer account identity does not match Cashfree')
 check(rows.every(row=>row.listed===true&&row.is_confidential===false&&row.on_career_page===true&&['external','internal_and_external'].includes(row.kind)),'native public listing flags conflict')
 return rows
}
const board=html=>{
 const document=readNativeDocument(html),head=activeHead(html)
 check(head.metas.some(meta=>meta.name==='application-name'&&meta.content===LEGAL_COMPANY)
  &&head.metas.some(meta=>meta.property==='og:site_name'&&meta.content===LEGAL_COMPANY),'native board employer identity changed')
 const links=document.nodes(node=>node.tag==='link'&&node.attrs.rel==='canonical')
 check(links.length===1&&links[0].attrs.href==='https://careers.kula.ai/cashfree','native board canonical identity changed')
 const frames=activeScripts(html).map(raw=>'<script>'+raw+'</script>').join('')
 const rows=rowsValid(resolveKulaJobDescriptions(frames,extractKulaNativeJobs(frames,{accountName:'cashfree'})))
 const urls=new Map()
 for(const anchor of document.nodes(node=>node.tag==='a'&&/^\/cashfree\/[1-9]\d*-[a-z0-9-]+\?jobs=true$/.test(node.attrs.href||''))){
  const id=Number(anchor.attrs.href.match(/^\/cashfree\/(\d+)-/)[1]),url=new URL(anchor.attrs.href,CASHFREE_BOARD).href
  check(!urls.has(id)||urls.get(id)===url,'native same-posting public URLs conflict');urls.set(id,url)
 }
 check(urls.size===rows.length&&rows.every(row=>urls.has(row.id)),'native public role links and rendered account inventory do not reconcile')
 return{rows,urls}
}
const model=row=>canonical({id:row.id,account_id:row.account_id,title:row.title,listed:row.listed,kind:row.kind,is_confidential:row.is_confidential,on_career_page:row.on_career_page,
 launch_at:row.launch_at,end_at:row.end_at,ats_job:row.ats_job})
const regions=new Intl.DisplayNames(['en'],{type:'region',fallback:'none'})
const countryOf=office=>{
 const code=office?.country_code,name=clean(office?.country)
 if(!/^[A-Z]{2}$/.test(code||'')||['ZZ','XA','XB','UN','EU','EZ','QO'].includes(code))return null
 const country=regions.of(code);return country&&country===name?country:null
}
const nativeDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value))?value:null
const detail=(row,url)=>{
 const value=row.ats_job,description=extractActiveDescription(value?.job_description)
 check(description?.length>=300,'full native public role criteria missing or incomplete')
 check(Array.isArray(value?.offices)&&value.offices.length>0,'native worksite inventory missing')
 const countries=value.offices.map(countryOf),country=countries.every(Boolean)&&new Set(countries).size===1?countries[0]:null
 check(row.launch_at==null||nativeDate(row.launch_at),'native publication date malformed')
 check(row.end_at==null||nativeDate(row.end_at),'native closing date malformed')
 const offices=country==='India'?value.offices.filter(office=>office.country_code==='IN'):value.offices
 const places=offices.map(office=>clean(office.location)).filter(Boolean)
 return{source:'cashfreepayments',company:'Cashfree Payments',atsPlatform:'kula',jobId:String(row.id),requisitionId:null,title:clean(row.title),
  department:clean(value.ats_department?.name)||null,country,location:places.join('; ')||null,city:offices.length===1?clean(offices[0].city)||null:null,
  state:offices.length===1?clean(offices[0].state)||null:null,sourceUrl:url,applyUrl:url,link:url,companyCareerPage:CASHFREE_CAREERS,
  employmentType:clean(value.work_type_name)||null,remoteStatus:({office:'On-site',remote:'Remote',hybrid:'Hybrid'})[value.workplace]||null,
  experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],postingDate:row.launch_at||null,closingDate:row.end_at||null,
  jobDescription:description,sourceDescription:description,sourceNativeDescriptionHTML:value.job_description,sourceNativeAccountId:row.account_id,
  sourceNativeRecord:structuredClone(row),sourceCountryEvidence:country?'Explicit native same-ID worksite country_code and country agree.':null,
  sourceDetailComplete:true,sourceListingComplete:false,sourceCompanyWideScopeComplete:false}
}

export async function runCurrentCashfree(options={}){
 const timeout=Number.isSafeInteger(options.timeoutMs)&&options.timeoutMs>0?options.timeoutMs:120000
 const signal=AbortSignal.any([AbortSignal.timeout(timeout),...(options.signal?[options.signal]:[])])
 check(options.maxJobs==null||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>=0,'invalid result cap')
 const wait=value=>new Promise((resolve,reject)=>{let done=false;const finish=(fn,result)=>{if(done)return;done=true;signal.removeEventListener('abort',abort);fn(result)},abort=()=>finish(reject,signal.reason);signal.addEventListener('abort',abort,{once:true});Promise.resolve(value).then(value=>finish(resolve,value),error=>finish(reject,error));if(signal.aborted)abort()})
 let requests=0
 const read=async(url,json=false)=>{
  signal.throwIfAborted();requests++
  const page=await wait(Promise.resolve().then(async()=>{
   if(options.fetchPage)return options.fetchPage(url,{signal})
   const requestSignal=AbortSignal.any([signal,AbortSignal.timeout(25000)]),response=await fetch(url,{signal:requestSignal,redirect:'manual',headers:{'User-Agent':'Mozilla/5.0',Accept:json?'application/json':'text/html'}})
   const html=await response.text();requestSignal.throwIfAborted();return{status:response.status,url:response.url,html}
  }))
  signal.throwIfAborted();check(page?.status===200&&(!page.url||page.url===url),'HTTP status or native endpoint identity changed at '+url)
  check(typeof page.html==='string'&&Buffer.byteLength(page.html)<=10000000,'invalid or oversized public response')
  if(!json)return page.html
  let payload;try{payload=JSON.parse(page.html)}catch{throw Error('Cashfree native Kula: invalid public JSON')};return payload
 }
 const apiURL=page=>'https://careers.kula.ai/api/internal/ats_job_posts?accountName=cashfree&page='+page+'&type=ats_job_post.index&items=99'
 const inventory=async()=>{
  let meta=null;const rows=[]
  for(let page=1;page<=(meta?.pages||1);page++){
   const payload=await read(apiURL(page),true),current=payload?.meta
   check(Array.isArray(payload?.data)&&Array.isArray(payload.errors)&&payload.errors.length===0&&Number.isSafeInteger(current?.count)&&current.count>=0&&current.count<=5000
    &&current.page===page&&current.items===99&&current.pages===Math.ceil(current.count/99),'native API count, pagination or error contract changed')
   check(!meta||meta.count===current.count&&meta.pages===current.pages,'native inventory totals changed during pagination');meta=current
   check(payload.data.length===Math.min(99,Math.max(0,current.count-(page-1)*99)),'native page inventory and total count do not reconcile')
   rows.push(...payload.data)
  }
  rowsValid(rows);check(rows.length===meta.count,'native complete inventory count mismatch');return{rows,total:meta.count,pages:meta.pages}
 }
 corporate(await read(CASHFREE_CAREERS))
 const openingBoard=board(await read(CASHFREE_BOARD)),opening=await inventory(),nativeByID=new Map(openingBoard.rows.map(row=>[row.id,row]))
 check(opening.rows.length===openingBoard.rows.length&&opening.rows.every(row=>nativeByID.has(row.id)),'rendered and API complete inventory identities differ')
 const failures=[],observedDetails=[],candidates=new Map()
 for(const row of opening.rows){try{
  const job=detail(row,openingBoard.urls.get(row.id));observedDetails.push(job)
  check(job.country,'native role country missing or conflicting')
  check(model(row)===model(nativeByID.get(row.id)),'native rendered and API role criteria or publication model conflict')
  candidates.set(row.id,job)
 }catch(error){failures.push({stage:'native-detail',nativeJobId:String(row.id),message:error.message})}}
 const closing=await inventory(),closingBoard=board(await read(CASHFREE_BOARD));corporate(await read(CASHFREE_CAREERS))
 const closingByID=new Map(closing.rows.map(row=>[row.id,row])),closingNativeByID=new Map(closingBoard.rows.map(row=>[row.id,row]))
 const models=rows=>canonical([...rows].sort((a,b)=>a.id-b.id).map(row=>({id:row.id,model:model(row)})))
 const stable=models(opening.rows)===models(closing.rows)&&models(openingBoard.rows)===models(closingBoard.rows)
  &&canonical([...openingBoard.urls])===canonical([...closingBoard.urls])
 const qualified=[]
 for(const row of opening.rows){const job=candidates.get(row.id);if(!job)continue
  if(closingByID.has(row.id)&&closingNativeByID.has(row.id)&&model(row)===model(closingByID.get(row.id))&&model(row)===model(closingNativeByID.get(row.id))
    &&openingBoard.urls.get(row.id)===closingBoard.urls.get(row.id))qualified.push(job)
  else failures.push({stage:'closing-detail',nativeJobId:String(row.id),message:'native role removed, changed or publication/country/criteria conflict at closing'})
 }
 const unknown=observedDetails.filter(job=>!job.country),exclusions=qualified.filter(job=>job.country!=='India').map(job=>({id:job.jobId,country:job.country,reason:'explicit native non-India worksite'}))
 const allJobs=qualified.filter(job=>job.country==='India'),jobs=options.maxJobs==null?allJobs:allJobs.slice(0,options.maxJobs)
 const complete=stable&&!failures.length&&!unknown.length&&jobs.length===allJobs.length
 const summary=pass=>({reportedTotal:pass.total,uniqueRoleIds:pass.rows.map(row=>String(row.id)),pages:pass.pages})
 const audit={source:'cashfreepayments',observedListingCount:opening.total,observedIndiaListingCount:observedDetails.filter(job=>job.country==='India').length,
  candidateDetails:opening.total,extractedDetailJobs:jobs.length,unknownCountryListingCount:unknown.length,nonIndiaListingCount:exclusions.length,
  opening:summary(opening),closing:summary(closing),closingInventoryMatches:stable,listingPaginationComplete:true,sourceScopeComplete:complete,
  sourceDeclaredBoardScopeComplete:complete,sourceCompanyWideScopeComplete:false,failures,exclusions,observedDetails,jobs:jobs.map(job=>({id:job.jobId}))}
 for(const job of jobs)Object.assign(job,{scrapedAt:new Date().toISOString(),sourceListingComplete:complete,sourceDeclaredBoardScopeComplete:complete})
 if(jobs.length)jobs[0].nativeCollectionEvidence={...audit,observedDetails:observedDetails.map(job=>({id:job.jobId,country:job.country,sourceUrl:job.sourceUrl}))}
 attachInventoryEvidence(jobs,{firstParty:true,surface:CASHFREE_BOARD,status:complete?(opening.total?'complete-inventory':'verified-empty'):'coverage-gap',listingComplete:complete,
  reportedTotal:opening.total,indiaFacetCount:unknown.length?null:allJobs.length,pagesFetched:requests,verifiedAt:new Date().toISOString(),
  reason:`Declared current official Cashfree Kula account1291; full public API pages and same-ID rendered native descriptions/flags/offices/URLs; closing full models match=${stable}; native failures=${failures.length}; country gaps=${unknown.length}; company-wide scope remains unknown`})
 if(options.onAudit)await wait(Promise.resolve().then(()=>options.onAudit(audit)))
 signal.throwIfAborted();return jobs
}
