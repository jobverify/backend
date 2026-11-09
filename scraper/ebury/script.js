import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { document, visibleDocument, text, remix } from './nativeHtml.js'

export const SOURCE='ebury'
export const COMPANY='Ebury'
export const CAREERS_URL='https://ebury.com/company/careers'
export const CORPORATE_BOARD=CAREERS_URL+'/job-board'
export const NATIVE_BOARD='https://job-boards.eu.greenhouse.io/ebury'
export const API_URL='https://boards-api.greenhouse.io/v1/boards/ebury/jobs?content=true'
const BOARD_ROUTE='routes/$url_token'
const DETAIL_ROUTE='routes/$url_token_.jobs_.$job_post_id'
const need=(value,message)=>{if(!value)throw Error('Ebury native: '+message)}
const sorted=values=>[...values].map(String).sort()
const equal=(a,b)=>JSON.stringify(sorted(a))===JSON.stringify(sorted(b))
const idValue=value=>(typeof value==='string'&&/^\d+$/.test(value))||(typeof value==='number'&&Number.isSafeInteger(value)&&value>0)
const countryNames=new Map()
const regions=new Intl.DisplayNames(['en'],{type:'region'})
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){
  const code=String.fromCharCode(a,b),name=regions.of(code)
  if(name&&name!==code&&!['ZZ','EU','UN','XA','XB','QO'].includes(code)){countryNames.set(code.toLowerCase(),name);countryNames.set(name.toLowerCase(),name)}
}
for(const [label,country]of Object.entries({IND:'India',USA:'United States',GBR:'United Kingdom',UK:'United Kingdom',UAE:'United Arab Emirates','United States of America':'United States','Czech Republic':'Czechia','Hong Kong':'Hong Kong'}))countryNames.set(label.toLowerCase(),country)
const countryName=label=>typeof label==='string'?countryNames.get(label.trim().toLowerCase())||null:null
const apiStates=jobs=>jobs.map(j=>Object.fromEntries(['id','internal_job_id','requisition_id','title','company_name','absolute_url','first_published','updated_at','application_deadline','content','offices','departments','metadata','language','ai_disclaimer','include_ai_disclaimer'].map(k=>[k,j[k]??null]))).sort((a,b)=>String(a.id).localeCompare(String(b.id)))
const boardStates=pages=>({roles:pages.flatMap(b=>b.jobPosts.data).sort((a,b)=>String(a.id).localeCompare(String(b.id))),offices:pages.map(b=>b.offices),boards:pages.map(b=>b.board)})
const canonical=url=>{let u;try{u=new URL(url)}catch{need(false,'invalid role URL identity')};need(u.origin==='https://job-boards.eu.greenhouse.io'&&!u.search&&!u.hash&&!u.username&&!u.password&&/^\/ebury\/jobs\/\d+$/.test(u.pathname),'foreign role URL identity');return u.href}
const roleId=url=>canonical(url).split('/').at(-1)
const rawDate=value=>value==null||value===''?null:typeof value==='string'&&Number.isFinite(Date.parse(value))?value:null
const defaultPage=async(url,{signal}={})=>{const response=await fetch(url,{method:'GET',redirect:'manual',signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(60000)])});return {status:response.status,body:await response.text(),location:response.headers.get('location')}}
const hiringLinksFrom=html=>{
  const d=document(html),native=/greenhouse|lever\.co|ashbyhq|workday|smartrecruiters|workable|recruitee|icims|successfactors|taleo|teamtailor|personio|bamboohr|freshteam|applytojob|breezy\.hr|jobvite/i
  return d.nodes(n=>n.tag==='a'&&n.attrs.href||['iframe','script'].includes(n.tag)&&n.attrs.src).filter(n=>native.test(n.attrs.href||n.attrs.src)||n.tag==='a'&&(/careers|job-board/i.test(n.attrs.href)||/\b(?:apply(?: now)?|open (?:roles|positions)|(?:view|search|browse) (?:open )?(?:jobs|roles|positions)|vacancies)\b/i.test(d.text(n)))).map(n=>new URL(n.attrs.href||n.attrs.src,CAREERS_URL).href)
}
const officeIndex=tree=>{
  need(Array.isArray(tree),'office hierarchy missing')
  const byId=new Map(),byName=new Map()
  const walk=(node,path=[])=>{
    need(node&&typeof node.name==='string'&&node.id!=null&&Array.isArray(node.children),'malformed office hierarchy')
    const names=[...path,node.name.trim()]
    // The current native hierarchy is region > country > city. No HQ/city default.
    const country=names.length===2||names.length===3&&!node.children.length?countryName(names[1]):null
    const value={officeId:String(node.id),location:node.name.trim(),country,sourceCountryLabel:path.length>=1?names[1]:null,officePath:names}
    need(!byId.has(value.officeId),'duplicate native office identity')
    byId.set(value.officeId,value)
    const key=value.location.toLowerCase();byName.set(key,[...(byName.get(key)||[]),value])
    node.children.forEach(child=>walk(child,names))
  }
  tree.forEach(n=>walk(n));return {byId,byName}
}
const corporatePage=(html,url)=>{
  const d=document(html),links=d.nodes(n=>n.tag==='a'&&n.attrs.href)
  const roles=[...new Set(links.filter(n=>n.attrs.href.startsWith(NATIVE_BOARD+'/jobs/')).map(n=>canonical(n.attrs.href)))]
  const paging=d.nodes(n=>n.attrs['aria-label']&&/^Page \d+ of \d+$/.test(n.attrs['aria-label']))
  need(paging.length===1,'corporate pagination state missing')
  const [,page,totalPages]=paging[0].attrs['aria-label'].match(/^Page (\d+) of (\d+)$/)
  const next=links.filter(n=>n.attrs['aria-label']==='Next Page')
  need(next.length<=1,'ambiguous corporate next page')
  const nextUrl=next.length?new URL(next[0].attrs.href,url).href:null
  if(nextUrl)need(new URL(nextUrl).origin==='https://ebury.com'&&new URL(nextUrl).pathname===new URL(CORPORATE_BOARD).pathname,'foreign corporate pagination')
  need(Number(page)===Number(totalPages)?nextUrl===null:Boolean(nextUrl),'corporate pagination truncated')
  return {url,page:Number(page),totalPages:Number(totalPages),roles,next:nextUrl}
}

export async function run({fetchPage=defaultPage,signal,onAudit}={}) {
  const calls=[],reasons=new Set(),closedPostingIds=[],nativeJobs=[]
  const get=async url=>{
    signal?.throwIfAborted();const response=await fetchPage(url,{method:'GET',signal});calls.push({url,status:response.status})
    need(Number.isInteger(response.status)&&typeof response.body==='string','transport envelope missing')
    if([401,403,429].includes(response.status))throw Error(`Ebury HTTP ${response.status}; stopped without retry`)
    if(/verify you are human|checking your browser|access denied|just a moment\.\.\./i.test(response.body.slice(0,8000)))throw Error('Ebury explicit bot gate; stopped without retry')
    need(response.status===200||response.status===302,'HTTP '+response.status)
    return response
  }
  const careers=await get(CAREERS_URL)
  need(careers.status===200,'corporate careers unavailable')
  const hiringLinks=hiringLinksFrom(careers.body)
  need(hiringLinks.includes(CORPORATE_BOARD)&&hiringLinks.some(u=>u.startsWith(NATIVE_BOARD+'/jobs/')),'current corporate native handoff missing')
  if(hiringLinks.some(u=>![CAREERS_URL,CORPORATE_BOARD,NATIVE_BOARD].includes(u)&&!u.startsWith(NATIVE_BOARD+'/jobs/')))reasons.add('additional-advertised-hiring-channel-unresolved')
  const corporate=[];let url=CORPORATE_BOARD
  while(url){need(corporate.length<50&&!corporate.some(p=>p.url===url),'corporate pagination cycle/limit');const r=await get(url);need(r.status===200,'corporate board redirected');const p=corporatePage(r.body,url);need(p.page===corporate.length+1&&(!corporate.length||p.totalPages===corporate[0].totalPages),'corporate pagination identity');corporate.push(p);url=p.next}
  const corporateIds=new Set(corporate.flatMap(p=>p.roles).map(roleId))
  need(corporate.flatMap(p=>p.roles).length===corporateIds.size,'corporate duplicate page roles')
  const readBoard=async page=>{
    const r=await get(NATIVE_BOARD+(page===1?'':'?page='+page));need(r.status===200,'native board redirected')
    const b=remix(r.body,BOARD_ROUTE),j=b.jobPosts
    need(b.urlToken==='ebury'&&b.board?.name===COMPANY&&b.board.public_url===NATIVE_BOARD&&!b.board.redirect_to,'native employer/board identity')
    need(j&&Array.isArray(j.data)&&j.page===page&&Number.isInteger(j.total)&&j.total>=0&&Number.isInteger(j.total_pages)&&j.total_pages>=1&&j.count===j.data.length,'native pagination envelope')
    need(j.data.every(r=>idValue(r.id)&&idValue(r.internal_job_id)&&String(r.id)===roleId(r.absolute_url)&&typeof r.title==='string'),'native posting/internal identity')
    return b
  }
  const first=await readBoard(1),nativePages=[first]
  need(first.jobPosts.total_pages<=100,'native page limit')
  let nativePageLimit=first.jobPosts.total_pages
  for(let page=2;page<=nativePageLimit;page++){const b=await readBoard(page);need(b.jobPosts.total_pages<=100,'native page limit');if(b.jobPosts.total!==first.jobPosts.total||b.jobPosts.total_pages!==first.jobPosts.total_pages)reasons.add('inventory-drift-native-pagination');nativePageLimit=Math.max(nativePageLimit,b.jobPosts.total_pages);nativePages.push(b)}
  const listed=nativePages.flatMap(b=>b.jobPosts.data),listedById=new Map(listed.map(j=>[String(j.id),j]))
  if(listed.length!==listedById.size||listed.length!==first.jobPosts.total)reasons.add('inventory-drift-native-page-identities')
  const offices=officeIndex(first.offices)
  const response=await get(API_URL);need(response.status===200,'native API unavailable')
  const api=JSON.parse(response.body)
  need(Array.isArray(api.jobs)&&Number.isInteger(api.meta?.total)&&api.meta.total===api.jobs.length&&!api.hasMore,'native API truncation')
  const apiById=new Map(api.jobs.map(j=>[String(j.id),j]))
  need(apiById.size===api.jobs.length,'duplicate native API posting identity')
  for(const j of api.jobs)need(idValue(j.id)&&idValue(j.internal_job_id)&&roleId(j.absolute_url)===String(j.id)&&j.company_name===COMPANY,'native API employer/role/internal identity')
  if(!equal(apiById.keys(),listedById.keys()))reasons.add('inventory-drift-native-api')
  const union=new Set([...corporateIds,...listedById.keys(),...apiById.keys()])
  for(const id of union){
    const sourceUrl=NATIVE_BOARD+'/jobs/'+id,r=await get(sourceUrl)
    if(r.status===302){need(r.location==='/ebury?error=true','unknown native redirect state');if(listedById.has(id)||apiById.has(id))reasons.add('inventory-drift-closed-listed-role');closedPostingIds.push(id);continue}
    const model=remix(r.body,DETAIL_ROUTE),j=model.jobPost,a=apiById.get(id),listing=listedById.get(id)
    need(String(model.jobPostId)===id&&model.urlToken==='ebury'&&idValue(j?.hiring_plan_id)&&j?.public_url===sourceUrl&&j.company_name===COMPANY&&j.post_type==='job_post'&&!j.redirect_to,'native detail employer/role/internal identity')
    if(a)need(String(a.internal_job_id)===String(j.hiring_plan_id)&&a.title===j.title,'native detail/listing identity differs')
    if(listing)need(String(listing.internal_job_id)===String(j.hiring_plan_id)&&listing.title===j.title,'native detail/board identity differs')
    if(!a||!listing)reasons.add('inventory-drift-corporate-native-synchronization')
    const parts=[j.introduction,j.content,j.conclusion].map(v=>typeof v==='string'?v:'')
    if(j.include_ai_disclaimer&&typeof j.ai_disclaimer==='string')parts.push(j.ai_disclaimer)
    const sourceDescriptionHtml=parts.join('\n'),sourceDescription=text(sourceDescriptionHtml)
    const d=visibleDocument(r.body),visible=d.nodes(n=>d.hasClass(n,'job__description')).map(d.text).join(' ')
    const headers=d.nodes(n=>d.hasClass(n,'job__header'))
    const within=(node,target)=>node===target||node.children?.some(child=>typeof child!=='string'&&within(child,target))
    const header=d.nodes(n=>n.tag==='h1'&&headers.some(h=>within(h,n)))
    need(header.length===1&&d.text(header[0])===j.title.replace(/\s+/g,' ').trim(),'visible native title identity differs')
    const detailComplete=Boolean(text(j.content||'')&&sourceDescription.length>=100&&visible.replace(/\s+/g,' ').includes(sourceDescription.replace(/\s+/g,' ')))
    if(!detailComplete)reasons.add('native-role-detail-incomplete')
    let locations=(a?.offices||[]).map(o=>offices.byId.get(String(o.id))).filter(Boolean)
    if(a?.offices?.some(o=>!offices.byId.has(String(o.id))))reasons.add('native-office-geography-unresolved')
    if(!locations.length){const matches=offices.byName.get(String(j.job_post_location||'').trim().toLowerCase())||[];if(matches.length===1)locations=matches}
    const countries=[...new Set(locations.map(l=>l.country).filter(Boolean))]
    if(!locations.length||locations.some(l=>!l.country))reasons.add('native-country-scope-unresolved')
    const india=locations.find(l=>l.country==='India')
    const sourcePublishedAt=rawDate(a?.first_published??listing?.published_at??j.published_at)
    nativeJobs.push({source:SOURCE,company:j.company_name,sourceEmployerName:j.company_name,title:j.title,originalTitle:j.title,jobId:id,nativePostingId:id,nativeInternalJobId:String(j.hiring_plan_id),nativeRequisitionId:a?.requisition_id??listing?.requisition_id??null,requisitionId:a?.requisition_id??listing?.requisition_id??null,location:india?india.location+', India':j.job_post_location||null,country:india?'India':countries.length===1?countries[0]:null,sourceCountries:countries,sourceLocations:locations,nativeLocation:j.job_post_location||null,nativeOffices:a?.offices||[],sourceUrl,applyUrl:j.public_url,link:j.public_url,sourceDescription,jobDescription:sourceDescription,description:sourceDescription,sourceDescriptionHtml,nativeDescriptionParts:parts,sourcePublishedAt,postingDate:sourcePublishedAt,sourcePublicationDatePrecision:sourcePublishedAt?/T/.test(sourcePublishedAt)?'timestamp':'date':null,nativePublishedAt:rawDate(j.published_at),nativeUpdatedAt:rawDate(a?.updated_at??listing?.updated_at),closingDate:rawDate(j.application_deadline??a?.application_deadline),sourceClosingDateIsExact:Boolean(/T/.test(j.application_deadline||a?.application_deadline||'')),nativeEmployment:j.employment??null,sourceDetailComplete:detailComplete,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,scrapedAt:new Date().toISOString()})
  }
  // Recheck finite inventories after all details and before any output cap.
  const closingCorporate=[]
  for(const p of corporate){const r=await get(p.url);need(r.status===200,'closing corporate inventory unavailable');const c=corporatePage(r.body,p.url);closingCorporate.push(c);if(!equal(c.roles,p.roles)||c.totalPages!==p.totalPages||c.next!==p.next)reasons.add('inventory-drift-closing-corporate')}
  const closingNative=[]
  for(let page=1;page<=nativePageLimit;page++)closingNative.push(await readBoard(page))
  if(!equal(closingNative.flatMap(b=>b.jobPosts.data.map(j=>j.id)),listedById.keys())||closingNative.some(b=>b.jobPosts.total!==first.jobPosts.total))reasons.add('inventory-drift-closing-native')
  const closingNativeIds=closingNative.flatMap(b=>b.jobPosts.data.map(j=>String(j.id)))
  if(closingNative.length!==closingNative[0].jobPosts.total_pages
    ||closingNative.some((b,index)=>b.jobPosts.total_pages!==nativePageLimit
      ||b.jobPosts.total_pages!==nativePages[index].jobPosts.total_pages
      ||b.jobPosts.count!==nativePages[index].jobPosts.count)
    ||closingNativeIds.length!==new Set(closingNativeIds).size
    ||closingNativeIds.length!==closingNative[0].jobPosts.total)reasons.add('inventory-drift-closing-native-pagination-envelope')
  const last=await get(API_URL);need(last.status===200,'closing API unavailable');const closingApi=JSON.parse(last.body)
  need(Array.isArray(closingApi.jobs),'closing API inventory missing')
  if(!Number.isInteger(closingApi.meta?.total)||closingApi.meta.total!==closingApi.jobs.length||closingApi.hasMore)reasons.add('closing-api-truncation')
  if(!equal(closingApi.jobs.map(j=>j.id),apiById.keys()))reasons.add('inventory-drift-closing-api')
  if(JSON.stringify(apiStates(closingApi.jobs))!==JSON.stringify(apiStates(api.jobs)))reasons.add('inventory-drift-closing-api-role-state')
  if(JSON.stringify(boardStates(closingNative))!==JSON.stringify(boardStates(nativePages)))reasons.add('inventory-drift-closing-native-role-state')
  const closingCareers=await get(CAREERS_URL);need(closingCareers.status===200,'closing corporate handoff unavailable')
  const closingHiringLinks=hiringLinksFrom(closingCareers.body)
  if(!equal(closingHiringLinks,hiringLinks))reasons.add('inventory-drift-closing-corporate-handoff')
  const companyComplete=reasons.size===0
  for(const job of nativeJobs){job.sourceListingComplete=companyComplete;job.sourceScopeComplete=companyComplete;job.lifecycleCleanupAllowed=companyComplete}
  const healthy=nativeJobs.filter(j=>j.sourceDetailComplete&&j.sourceCountries.includes('India'))
  const audit={observedAt:new Date().toISOString(),companyComplete,hiringLinks,closingHiringLinks,corporatePages:corporate,closingCorporatePages:closingCorporate,corporatePostingIds:sorted(corporateIds),nativeOpeningTotal:first.jobPosts.total,nativeOpeningPostingIds:sorted(listedById.keys()),nativeClosingTotal:closingNative[0].jobPosts.total,nativeClosingPostingIds:sorted(closingNative.flatMap(b=>b.jobPosts.data.map(j=>j.id))),apiOpeningTotal:api.jobs.length,apiClosingTotal:closingApi.jobs.length,closedPostingIds,nativeJobs,reasons:[...reasons],calls}
  await onAudit?.(audit)
  return attachInventoryEvidence(healthy,{status:companyComplete?nativeJobs.length?'complete-inventory':'verified-empty':'discovery-only',surface:CAREERS_URL,firstParty:true,listingComplete:companyComplete,pagesFetched:calls.length,reportedTotal:companyComplete?nativeJobs.length:null,indiaFacetCount:companyComplete?healthy.length:null,verifiedAt:audit.observedAt,reason:companyComplete?'ebury-current-corporate-native-full-role-inventory-reconciled':'ebury-native-partial:'+audit.reasons.join(';')})
}
