import {createHash} from 'node:crypto'
import {activeHead,readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {extractKulaNativeJobs,resolveKulaJobDescriptions} from '../../scraper-support/utils/kulaFlight.js'
import {countryName} from '../../scraper-support/native-sources/jobPostingData.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

export const CURRENT_CAREERS='https://www.moengage.com/careers/'
export const CURRENT_BOARD='https://careers.kula.ai/moengage'
export const CURRENT_API='https://careers.kula.ai/api/internal/ats_job_posts?accountName=moengage&page=1&type=ats_job_post.index&items=99'
const ACCOUNT=1553, PAGE_SIZE=99
const text=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const need=(condition,message)=>{if(!condition)throw Object.assign(Error('MoEngage public Kula: '+message),{
  softFailure:true,abortRetries:true,failureKind:'parser_or_contract_error',
})}
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)
  ?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item)
const model=row=>canonical({id:row.id,account_id:row.account_id,title:row.title,listed:row.listed,kind:row.kind,
  is_confidential:row.is_confidential,on_career_page:row.on_career_page,launch_at:row.launch_at,end_at:row.end_at,ats_job:row.ats_job})
const validateRows=rows=>{
  need(Array.isArray(rows)&&rows.length<=5000,'native inventory unavailable or oversized')
  need(rows.every(row=>Number.isSafeInteger(row?.id)&&row.id>0&&text(row.title))
    &&new Set(rows.map(row=>row.id)).size===rows.length,'missing or duplicate native role identity')
  need(rows.every(row=>row.account_id===ACCOUNT&&row.listed===true&&row.is_confidential===false
    &&row.on_career_page===true&&['external','internal_and_external'].includes(row.kind)),'foreign account or nonpublic role')
  return rows
}
const corporate=html=>{
  const document=readNativeDocument(html)
  need(activeHead(html).titles.some(title=>/MoEngage/i.test(title)&&/Career|Job/i.test(title)),'corporate brand identity missing')
  const canonicals=document.nodes(node=>node.tag==='link'&&node.attrs.rel==='canonical')
  need(canonicals.length===1&&canonicals[0].attrs.href===CURRENT_CAREERS,
    'corporate canonical identity missing')
  need(document.nodes(node=>node.tag==='a'&&node.attrs.href===CURRENT_BOARD).length>0,'active current employer handoff missing')
}
const board=html=>{
  const document=readNativeDocument(html),head=activeHead(html)
  need(head.metas.some(meta=>meta.name==='application-name'&&meta.content==='MoEngage')
    &&head.metas.some(meta=>meta.property==='og:site_name'&&meta.content==='MoEngage'),'native board employer identity changed')
  const canonicals=document.nodes(node=>node.tag==='link'&&node.attrs.rel==='canonical')
  need(canonicals.length===1&&canonicals[0].attrs.href===CURRENT_BOARD,
    'native board canonical identity changed')
  const scripts=document.nodes(node=>node.tag==='script'&&!node.attrs.src).map(node=>'<script>'+node.raw+'</script>').join('')
  const rows=validateRows(resolveKulaJobDescriptions(scripts,extractKulaNativeJobs(scripts,{accountName:'moengage'})))
  const urls=new Map()
  for(const anchor of document.nodes(node=>node.tag==='a'&&/^\/moengage\/[1-9]\d*-[a-z0-9-]+$/.test(node.attrs.href||''))){
    const id=Number(anchor.attrs.href.match(/^\/moengage\/(\d+)-/)[1]),url=new URL(anchor.attrs.href,CURRENT_BOARD).href
    need(!urls.has(id)||urls.get(id)===url,'conflicting native public role URLs');urls.set(id,url)
  }
  need(urls.size===rows.length&&rows.every(row=>urls.has(row.id)),'rendered public role links and native records differ')
  return{rows,urls}
}
const date=value=>{
  if(value==null)return null
  need(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    &&Number.isFinite(Date.parse(value)),'malformed native date')
  const [year,month,day]=value.slice(0,10).split('-').map(Number)
  const [hour,minute,second]=value.slice(11,19).split(':').map(Number)
  need(month>=1&&month<=12&&day>=1&&day<=new Date(Date.UTC(year,month,0)).getUTCDate(),'invalid native calendar date')
  need(hour<24&&minute<60&&second<60,'invalid native clock time')
  return value
}
const role=(row,url,at)=>{
  const value=row.ats_job,description=extractActiveDescription(value?.job_description)
  need(description?.length>=300,'full native criteria missing')
  need(Array.isArray(value.offices)&&value.offices.length,'native worksite scope missing')
  const locations=value.offices.map(office=>{
    let country=countryName(office.country);const code=office.country_code
    // One native Dubai office omits typed country fields but publishes its
    // full country before a postal value in this very role's worksite address.
    // A city, a postal value, or a conflicting typed field cannot supply it.
    const address=text(office.location).split(',').map(text)
    const addressCountry=office.country==null&&code==null&&address.length>=4&&address.every(Boolean)
      &&/^\d{5,6}$/.test(address.at(-1))&&address.at(-2).length>3?countryName(address.at(-2)):null
    if(addressCountry)country=addressCountry
    else need(typeof code==='string'&&/^[A-Z]{2}$/.test(code)&&country&&countryName(code)===country,'unknown or conflicting native country')
    need(country,'unknown or conflicting native country')
    const label=/^\d{5,6}$/.test(address.at(-1))?address.at(-2):address.at(-1)
    const explicitAddressCountry=label?.length>3?countryName(label):null
    need(!explicitAddressCountry||explicitAddressCountry===country,'native worksite address contradicts its country fields')
    need(text(office.location),'native worksite address missing')
    return{...office,country}
  })
  const postingDate=date(row.launch_at),closingDate=date(row.end_at)
  need(!postingDate||Date.parse(postingDate)<=at,'future native publication date')
  need(!closingDate||Date.parse(closingDate)>at,'native role closing date has passed')
  const india=locations.filter(office=>office.country==='India')
  const selected=india.length?india:locations
  return{title:text(row.title),company:'MoEngage',source:'moengage',jobId:String(row.id),requisitionId:null,
    department:text(value.ats_department?.name)||null,country:india.length?'India':locations[0].country,
    location:[...new Set(selected.map(office=>text(office.location)))].join('; '),
    city:selected.length===1?text(selected[0].city)||null:null,state:selected.length===1?text(selected[0].state)||null:null,
    locations:selected.map(office=>text(office.location)),sourceNativeOffices:structuredClone(value.offices),
    employmentType:text(value.work_type_name)||null,experienceRequired:null,minimumQualification:null,
    preferredQualification:null,requiredSkills:[],postingDate,closingDate,
    jobDescription:description,sourceDescription:description,sourceNativeDescriptionHTML:value.job_description,
    sourceUrl:url,applyUrl:url,link:url,companyCareerPage:CURRENT_CAREERS,atsPlatform:'kula',
    sourceNativeAccountId:ACCOUNT,sourceNativeRecordSha256:createHash('sha256').update(model(row)).digest('hex'),sourceDetailComplete:true}
}

export async function runCurrentMoEngage({fetchPage,signal,maxJobs=null,now=()=>new Date().toISOString()}={}){
  need(maxJobs==null||Number.isSafeInteger(maxJobs)&&maxJobs>=0,'invalid result cap')
  const at=Date.parse(now());need(Number.isFinite(at),'invalid observation date')
  let requests=0
  const read=async(url,json=false)=>{
    signal?.throwIfAborted();requests++
    const requestSignal=AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(20000)])
    let page
    if(fetchPage)page=await fetchPage(url,{signal:requestSignal})
    else{const response=await fetch(url,{signal:requestSignal,redirect:'manual',headers:{'User-Agent':'Mozilla/5.0 (compatible; Jobverify public careers)',Accept:json?'application/json':'text/html'}})
      page={status:response.status,url:response.url,html:await response.text()}}
    signal?.throwIfAborted();requestSignal.throwIfAborted()
    if(page?.status!==200)throw Object.assign(Error(`MoEngage public Kula: HTTP ${page?.status} at ${url}`),{
      status:page?.status,softFailure:true,abortRetries:true,
      failureKind:[401,403,429,451].includes(page?.status)?'blocked_or_access_denied':'http_error',
    })
    need(page.url===url&&typeof page.html==='string'&&Buffer.byteLength(page.html)<=3000000,'public response URL or body unavailable')
    return json?JSON.parse(page.html):page.html
  }
  const inventory=async()=>{
    const rows=[];let meta
    for(let page=1;page<=(meta?.pages||1);page++){
      const payload=await read(CURRENT_API.replace('page=1&','page='+page+'&'),true),current=payload?.meta
      need(Array.isArray(payload?.data)&&Array.isArray(payload.errors)&&!payload.errors.length&&!payload.error&&payload.success!==false
        &&(payload.status==null||[200,'ok','success'].includes(payload.status)),
        'native API error or missing data')
      need(Number.isSafeInteger(current?.count)&&current.count>=0&&current.count<=5000&&current.page===page
        &&current.items===PAGE_SIZE&&current.pages===Math.ceil(current.count/PAGE_SIZE),'native count or pagination contract changed')
      need(!meta||meta.count===current.count&&meta.pages===current.pages,'native totals changed during pagination')
      need(payload.data.length===Math.min(PAGE_SIZE,Math.max(0,current.count-(page-1)*PAGE_SIZE)),'native page truncated')
      meta=current;rows.push(...payload.data)
    }
    validateRows(rows);need(rows.length===meta.count,'native unique count mismatch');return rows
  }
  corporate(await read(CURRENT_CAREERS))
  const openingBoard=board(await read(CURRENT_BOARD)),opening=await inventory()
  const byId=new Map(openingBoard.rows.map(row=>[row.id,row]))
  need(opening.length===byId.size&&opening.every(row=>byId.has(row.id)),'rendered/API inventory IDs differ')
  const candidates=[],failures=[]
  for(const row of opening)try{
    need(model(row)===model(byId.get(row.id)),'rendered/API full native role models differ')
    candidates.push(role(row,openingBoard.urls.get(row.id),at))
  }catch(error){failures.push({stage:'native-detail',id:String(row.id),message:error.message})}
  let stable=false,closingById=null,closingBoardById=null,closingUrls=null
  try{
    const closing=await inventory();closingById=new Map(closing.map(row=>[row.id,row]))
    const closingBoard=board(await read(CURRENT_BOARD));closingBoardById=new Map(closingBoard.rows.map(row=>[row.id,row]));closingUrls=closingBoard.urls
    corporate(await read(CURRENT_CAREERS))
    const sorted=rows=>rows.slice().sort((a,b)=>a.id-b.id).map(model)
    stable=canonical(sorted(opening))===canonical(sorted(closing))&&canonical(sorted(openingBoard.rows))===canonical(sorted(closingBoard.rows))
      &&canonical([...openingBoard.urls])===canonical([...closingBoard.urls])
  }catch(error){signal?.throwIfAborted();failures.push({stage:'closing',message:error.message})}
  const openingById=new Map(opening.map(row=>[row.id,row]))
  const qualified=candidates.filter(job=>{
    const id=Number(job.jobId),original=openingById.get(id)
    const matches=(!closingById||closingById.has(id)&&model(original)===model(closingById.get(id)))
      &&(!closingBoardById||closingBoardById.has(id)&&model(original)===model(closingBoardById.get(id))&&job.sourceUrl===closingUrls.get(id))
    if(!matches)failures.push({id:job.jobId,stage:'closing-role',message:'Native role removed or changed at closing'})
    return matches
  })
  const india=qualified.filter(job=>job.country==='India'),jobs=maxJobs==null?india:india.slice(0,maxJobs)
  const complete=stable&&!failures.length&&jobs.length===india.length
  for(const job of jobs)Object.assign(job,{scrapedAt:new Date(at).toISOString(),sourceListingComplete:complete,
    sourceScopeComplete:complete,lifecycleCleanupAllowed:complete,sourceCompanyWideScopeComplete:false})
  if(jobs.length)jobs[0].nativeCollectionEvidence={source:'moengage',
    observedListingCount:opening.length,candidateDetails:opening.length,
    extractedDetailJobs:candidates.length,excludedDetailJobs:0,listingPaginationComplete:true,
    sourceScopeComplete:complete,observedIndiaListingCount:candidates.filter(job=>job.country==='India').length,
    nonIndiaListingCount:candidates.filter(job=>job.country!=='India').length,
    observedNativeRoles:opening.length,qualifiedIndiaRoles:india.length,
    nonIndiaRoles:qualified.length-india.length,closingInventoryMatches:stable,failures}
  signal?.throwIfAborted()
  return attachInventoryEvidence(jobs,{surface:CURRENT_BOARD,firstParty:true,listingComplete:complete,
    status:complete?(opening.length?'complete-inventory':'verified-empty'):'coverage-gap',reportedTotal:opening.length,
    indiaFacetCount:failures.length?null:india.length,pagesFetched:requests,verifiedAt:new Date(at).toISOString(),
    reason:`current-public-kula-account1553;full-rendered-and-api-native-role-models;closing-stable=${stable};failures=${failures.length};declared-board-scope`})
}
