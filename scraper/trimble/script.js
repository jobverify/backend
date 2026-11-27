import {createHash} from 'node:crypto'
import {readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {parseBoundedProgram,parseRemoteLiteral} from '../../scraper-support/utils/remoteScriptData.js'
import {parseEightfoldJson} from '../../scraper-support/utils/recruitmentEightfoldData.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const OFFICIAL='https://www.trimble.com/en/careers',ORIGIN='https://trimblecareers.trimble.com',BOARD=ORIGIN+'/jobs'
const sha=value=>createHash('sha256').update(value).digest('hex')
const text=v=>typeof v==='string'?v.replace(/\s+/gu,' ').trim():''
const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)
const need=(ok,message)=>{if(!ok)throw Object.assign(new Error('[trimble] '+message),{abortRetries:true,softFailure:true,failureKind:'surface_drift_or_fail_closed'})}
const https=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash?u:null}catch{return null}}
const classIs=(node,name)=>(node.attrs.class||'').split(/\s+/).includes(name)
const schemas=doc=>doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'&&!n.attrs.src).map(n=>parseEightfoldJson(n.raw))
const member=(node,name)=>node?.type==='MemberExpression'&&!node.computed&&!node.optional
 &&node.object.type==='Identifier'&&node.object.name==='window'&&node.property.name===name
const treeNodes=(document,predicate)=>{
 const visit=node=>[...(predicate(node)?[node]:[]),...node.children.filter(child=>typeof child!=='string').flatMap(visit)]
 return document.nodes(node=>node.tag==='root').flatMap(visit)
}
function stateOf(document){
 const scripts=document.nodes(n=>n.tag==='script'&&!n.attrs.src&&/\bwindow\.__PRELOAD_STATE__\s*=/.test(n.raw||''))
 need(scripts.length===1,'native public state missing or ambiguous')
 need(!['src','nomodule','language'].some(key=>Object.hasOwn(scripts[0].attrs,key))
  &&/^(?:|text\/javascript|application\/javascript)$/i.test(scripts[0].attrs.type||''),'native state execution mode changed')
 const raw=scripts[0].raw,program=parseBoundedProgram(raw)
 need(program.body.length===2&&program.body.every(s=>s.type==='ExpressionStatement'&&s.expression.type==='AssignmentExpression'&&s.expression.operator==='='),'native state grammar changed')
 const [state,build]=program.body.map(s=>s.expression)
 need(member(state.left,'__PRELOAD_STATE__')&&member(build.left,'__BUILD__')&&build.right.type==='Literal'
  &&typeof build.right.value==='string'&&/^[a-f\d]{10}$/.test(build.right.value),'native state assignment changed')
 return parseRemoteLiteral(raw.slice(state.right.start,state.right.end))
}
// These whole stylesheets were reviewed. November19 adds utility/control styles
// and new font deployment URLs; .hidden and the later80rem .xl:flex rule retain
// their original semantics. November25 changes only the ten font URL deployment
// query values. No unknown stylesheet may use this projection.
const corporateStyles=new Set([
 '51ca5bcbb028725fb506394bf76060e2a8a8f0385dd7f3e3aff373834848c641',
 '86b0208a28eaa744b30ae0984930dd6f77cca968a09228dea41adacffd98b34f',
 '83be3ecd7fb8752d0184c587768671cefb230823f4d968aa0362641bde18d36c',
])
// The current counted native feed retains one unavailable role. This exact
// branded404 frame was observed on its own listed URL. Only that URL's literal
// occurrences are neutralized; this grants no job, eligibility or scope proof.
const missingRoleFrame='27484258da2f7418eb9a8e6582ad4c26715214bec583bdde71550def535b1d9c'
const corporateOf=page=>{
 const original=readNativeDocument(page.html)
 need(!treeNodes(original,n=>n.tag==='base').length,'corporate handoff base requires review')
 const styles=treeNodes(original,n=>n.tag==='style'),wrapper='hidden xl:flex flex-shrink-0 mr-[21px]'
 const desktop=original.nodes(n=>n.tag==='div'&&n.attrs.class===wrapper),start='<div class="'+wrapper+'">'
 need(styles.length===1&&Object.keys(styles[0].attrs).sort().join()==='data-href,data-precedence'
  &&styles[0].attrs['data-precedence']==='next'&&corporateStyles.has(sha(styles[0].raw))
  &&desktop.length===1&&Object.keys(desktop[0].attrs).join()==='class'&&page.html.split(start).length===2,'corporate responsive stylesheet/handoff contract changed')
 // This exact native stylesheet sets .hidden to display:none, then the later
 // @media(min-width:80rem) .xl\\:flex rule to display:flex. Qualify only that
 // observed desktop wrapper; all other native hiding rules remain in force.
 const document=readVisibleNativeDocument(page.html.replace(start,'<div class="'+wrapper.slice(7)+'">'),{strict:true})
 need(document.nodes(n=>n.tag==='title').some(n=>/Trimble/i.test(n.raw)&&/Careers/i.test(n.raw)),'corporate Trimble careers identity changed')
 const declarations=document.nodes(n=>n.tag==='a'&&/Search jobs/i.test(document.text(n))).filter(n=>https(n.attrs.href)?.href===BOARD)
 need(declarations.length>0,'current corporate Search jobs handoff missing')
 return {officialURL:OFFICIAL,declaredURL:BOARD,labels:[...new Set(declarations.map(n=>document.text(n)))],
  nativeStylesheetSHA256:sha(styles[0].raw),qualifiedCorporateViewport:'min-width:80rem',reviewedResponsiveWrapper:wrapper}
}
function listingOf(page){
 const document=readNativeDocument(page.html),visible=readVisibleNativeDocument(page.html,{strict:true}),schema=schemas(document)
 need(!treeNodes(document,n=>n.tag==='base').length,'native base requires review')
 need(schema.some(s=>s['@type']==='Organization'&&s.name==='Trimble'&&s.url==='https://www.trimble.com/'
  &&s['@id']==='https://www.trimble.com/#organization'),'native publisher identity changed')
 const state=stateOf(document),search=state.jobSearch
 need(search&&search.isLoading===false&&Number.isSafeInteger(search.totalJob)&&search.totalJob>=0&&search.totalJob<=2500
  &&Array.isArray(search.jobs)&&search.jobs.length<=10&&search.params&&stable(search.params.filter)==='{}','native unfiltered listing model changed')
 const address=new URL(page.url),pageNumber=address.pathname==='/jobs'?1:Number(address.pathname.split('/').at(-1))
 need(pageNumber===1?search.params.page_number==null||search.params.page_number===1:search.params.page_number===pageNumber,'native page selector changed')
 for(const row of search.jobs){
  need(row&&/^R\d+$/.test(row.requisitionID)&&row.reference===row.requisitionID&&text(row.sourceID)&&text(row.uniqueID)
   &&text(row.title)&&Array.isArray(row.locations)&&row.locations.length>0
   &&row.companyID==='PIJ-api.paradox.ai-17658-scrape-prod-58666'&&row.companyName==='api.paradox.ai-TR'
   &&row.postingType==='1'&&row.isInternal==='false','native public vacancy identity changed')
  const roleURL=roleURLOf(row)
  need(visible.nodes(n=>n.tag==='a'&&text(visible.text(n))===text(row.title))
   .some(n=>{try{return new URL(n.attrs.href,page.url).href===roleURL}catch{return false}}),'native vacancy visible link/title changed')
 }
 const next=[...new Set(visible.nodes(n=>n.tag==='a'&&/^\/jobs\/page\/[1-9][0-9]{0,2}$/.test(n.attrs.href||''))
  .map(n=>ORIGIN+n.attrs.href).filter(url=>!url.endsWith('/page/1')))]
 return {search,next}
}
function roleURLOf(row){
 const url=https(new URL(row.originalURL,ORIGIN+'/').href)
 need(url?.origin===ORIGIN&&new RegExp('^/(?:[\\p{L}\\p{N}-]+/)+job/'+row.requisitionID+'$','u').test(decodeURIComponent(url.pathname))&&!url.search,'native vacancy URL changed')
 return url.href
}
const indiaLocations=row=>row.locations.filter(l=>l.country==='India'&&l.countryAbbr==='IN')
function fieldsOf(row){
 need(Array.isArray(row.customFields)&&row.customFields.every(f=>f&&typeof f.cfKey==='string'&&typeof f.value==='string'&&text(f.key)),'native role custom metadata changed')
 const fields=new Map()
 for(const field of row.customFields){need(!fields.has(field.cfKey),'duplicate native custom metadata');fields.set(field.cfKey,field.value)}
 return fields
}
const nativeDate=value=>{
 const p=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value||'')
 need(p,'native publishing date model changed')
 const date=p[3]+'-'+p[1]+'-'+p[2]
 need(new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date,'native publishing date invalid')
 return date
}
function roleOf(page,row,now){
 const document=readVisibleNativeDocument(page.html,{strict:true}),posting=schemas(document).filter(s=>s['@type']==='JobPosting')
 need(!document.nodes(n=>n.tag==='base').length&&posting.length===1,'native full posting identity missing or ambiguous')
 const p=posting[0],url=roleURLOf(row),fields=fieldsOf(row),locations=indiaLocations(row)
 need(p.url===url&&p.title===row.title&&p.identifier?.['@type']==='PropertyValue'&&p.identifier.name==='Trimble'
  &&p.identifier.value===row.requisitionID&&p.hiringOrganization?.['@type']==='Organization'
  &&p.hiringOrganization.name==='Trimble'&&p.hiringOrganization.sameAs==='https://www.trimble.com/','native full role employer/title/ID changed')
 need(document.nodes(n=>['h1','h2'].includes(n.tag)&&text(document.text(n))===text(row.title)).length>0,'native visible role title changed')
 const schemaLocations=Array.isArray(p.jobLocation)?p.jobLocation:[p.jobLocation]
 need(locations.length===row.locations.length&&schemaLocations.length===row.locations.length
  &&schemaLocations.every(l=>l?.['@type']==='Place'&&l.address?.['@type']==='PostalAddress'
   &&l.address.addressCountry==='IN'&&locations.some(v=>text(v.city)===text(l.address.addressLocality))),'native role typed India country/location changed')
 const containers=document.nodes(n=>classIs(n,'jb__description'))
 need(containers.length===1,'native full visible criteria missing or ambiguous')
 const description=document.text(containers[0]),schemaDescription=extractActiveDescription(p.description)
 need(description.length>=200&&schemaDescription?.length>=200&&description.startsWith(schemaDescription),'native schema/visible authored criteria disagree')
 const apply=https(fields.get('cf_external_apply_url'))
 need(apply?.origin==='https://trimble.wd1.myworkdayjobs.com'&&apply.pathname.startsWith('/TrimbleCareers/job/')
  &&apply.pathname.endsWith('_'+row.requisitionID)&&!apply.search,'native Workday application account/ID changed')
 need(document.nodes(n=>n.tag==='a'&&n.attrs.href===apply.href&&/Standard Apply/.test(document.text(n))).length>0,'native visible Workday application changed')
 const chat=https(row.applyURL)
 need(chat?.origin==='https://olivia.paradox.ai'&&chat.pathname==='/co/Trimble1/Job'&&chat.searchParams.size===1
  &&chat.searchParams.get('job_id')===row.requisitionID+'_1'
  &&document.nodes(n=>n.tag==='a'&&n.attrs.href===chat.href&&/Chat to Apply/.test(document.text(n))).length>0,'native public role application identity changed')
 const start=nativeDate(fields.get('cf_start_date')),end=nativeDate(fields.get('cf_end_date'))
 need(start<=now.slice(0,10)&&end>now.slice(0,10)&&start<=end,'native publishing window expired or unresolved')
 need(!p.validThrough||Date.parse(p.validThrough)>Date.parse(now),'native role expiry passed')
 return {posting:p,description,applicationURL:apply.href,originalPublicPage:page,nativePublishingStart:start,nativePublishingEnd:end}
}

export async function run(options={}){
 const now=options.now||new Date().toISOString();need(Number.isFinite(Date.parse(now)),'invalid observation time')
 const signal=AbortSignal.any([...(options.signal?[options.signal]:[]),AbortSignal.timeout(240000)])
 const receipts=[];let requests=0
 const read=async (url,{missingRole=null}={})=>{
  signal.throwIfAborted();need(++requests<=100,'native public request budget reached')
  const response=await (options.fetchImpl||globalThis.fetch)(url,{redirect:'manual',credentials:'omit',signal:AbortSignal.any([signal,AbortSignal.timeout(20000)]),headers:{Accept:'text/html','User-Agent':'Mozilla/5.0'}})
  const html=await response.text();signal.throwIfAborted()
  const reviewedMissing=response.status===404&&missingRole&&roleURLOf(missingRole)===url
   &&!response.headers.get('cf-mitigated')&&sha(html.split(url).join('<own-missing-role-url>'))===missingRoleFrame
  need((response.status===200||reviewedMissing)&&response.url===url&&Buffer.byteLength(html)<=4*1024*1024,'current public response identity/status changed')
  const page={url,status:response.status,html};receipts.push({...page,sha256:sha(html)});return page
 }
 const corporate=corporateOf(await read(OFFICIAL))
 const listing=async()=>{
  const queue=[BOARD],seen=new Set(),ids=new Set(),rows=[];let total=null
  while(queue.length){const url=queue.shift();if(seen.has(url))continue
   need(seen.size<25,'native pagination exceeds reviewed bound');seen.add(url)
   const current=listingOf(await read(url))
   if(total===null)total=current.search.totalJob
   need(total===current.search.totalJob,'native total changed during listing')
   for(const row of current.search.jobs){need(!ids.has(row.requisitionID),'duplicate native vacancy');ids.add(row.requisitionID);rows.push(row)}
   for(const next of current.next)if(!seen.has(next)&&!queue.includes(next))queue.push(next)
  }
  need(rows.length===total,'native pagination stopped before reported total')
  return {rows,total,pages:seen.size}
 }
 const opening=await listing(),held=[],selected=[]
 for(const row of opening.rows){
  if(!indiaLocations(row).length)continue
  const page=await read(roleURLOf(row),{missingRole:row})
  if(page.status===404){held.push({row,reason:'native-listed-role-unavailable-404',httpStatus:404,
   sourceDetailComplete:false,publicEligibility:null,lifecycleCleanupAllowed:false,originalPublicPage:page});continue}
  try{selected.push({row,detail:roleOf(page,row,now)})}
  catch(error){if(!error.softFailure)throw error;held.push({row,reason:error.message,originalPublicPage:page})}
 }
 for(const item of selected){const closing=roleOf(await read(roleURLOf(item.row)),item.row,now)
  need(stable({posting:closing.posting,description:closing.description,applicationURL:closing.applicationURL})
   ===stable({posting:item.detail.posting,description:item.detail.description,applicationURL:item.detail.applicationURL}),'closing native full role criteria changed')
 }
 const closing=await listing()
 need(stable(closing.rows)===stable(opening.rows)&&closing.total===opening.total,'closing native listing changed')
 need(stable(corporateOf(await read(OFFICIAL)))===stable(corporate),'closing corporate handoff changed')
 need(selected.length>0,'coverage-gap: no verified native current India vacancies')
 const jobs=selected.map(({row,detail})=>({source:'trimble',company:'Trimble',title:row.title,jobId:row.requisitionID,requisitionId:row.requisitionID,
  sourceUrl:roleURLOf(row),applyUrl:detail.applicationURL,link:roleURLOf(row),country:'India',location:indiaLocations(row)[0].locationText,city:indiaLocations(row)[0].city,
  jobDescription:detail.description,sourceDescription:detail.description,sourceNativeRecord:row,sourceNativeJobPosting:detail.posting,
  sourceNativeEmployerHandoff:corporate,sourceNativePublishingStartDate:detail.nativePublishingStart,sourceNativePublishingEndDate:detail.nativePublishingEnd,
  nativePublishingDateSemantics:'native feed publishing window; original requisition publication and application deadline unqualified',
  postingDate:null,closingDate:null,employmentType:null,remoteStatus:null,sourcePublicationDateUnavailable:true,
  sourceDetailComplete:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
  companyCareerPage:OFFICIAL,companyDomain:'trimble.com',atsPlatform:'paradox-first-party-careers',scrapedAt:now}))
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{nativeRecords:opening.rows,heldRecords:held,receipts,reportedNativeTotal:opening.total,
  nativeListingPages:opening.pages,nativePaginationReconciled:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false}})
 attachSourceObservationEvidence(jobs,{source:'trimble',recordKind:'vacancy-rows',observedRecordCount:opening.rows.length,observedVacancyCount:opening.rows.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 return attachInventoryEvidence(jobs,{status:'discovery-only',surface:BOARD,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,
  reason:'current corporate Paradox handoff; own full visible criteria/schema/application; native cohort reconciled, whole-company scope unqualified'})
}
export default run
