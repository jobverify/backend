import {createHash} from 'node:crypto'
import {readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {createBoundedPublicCareerTransport} from '../../scraper-support/utils/boundedPublicCareerTransport.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {findExplicitNativeClosure} from '../../scraper-support/utils/sourceAvailability.js'
import {nativeCountryName,nativeLocationCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {buildHttpError,isHttpAccessChallenge} from '../../scraper-support/utils/fetch.js'
import {disposeResponseBody} from '../../scraper-support/shared/responseBodyDisposal.js'

export const SQUARE_CAREERS='https://www.squareyards.com/career'
const origin='https://www.squareyards.com',source='squareyards'
// Whole current program differs from the prior producer only in an image
// fallback and deferred analytics loader. The native GET/renderer is unchanged.
// Its application client is unreviewed: admit native criteria data only.
const currentCareerProgram=origin+'/assets/js/carriers-0811cca07c.min.js'
const programs=new Map([
 [origin+'/assets/js/carriers-cc4012780b.min.js','8fdf761fc326f5901517c7e23404b316664189463fa8361fb20b6afff82046df'],
 [origin+'/assets/js/career_form-40df87e33c.min.js','23ac3784f73df5d28a31e5b7891037ead88f31ec35fbb529fba602d2c4f389be'],
 [origin+'/assets/js/career_form-390e287ba4.min.js','3101c786b3c8cc7b7e0fc88800849bba4b3a3e3a636f12127076b53761ea8caa'],
 [currentCareerProgram,'6e1e4016672669220baf25fe8204fb8b42d0b13c42441790d2a5f9802d9a7078'],
])
const norm=x=>String(x??'').replace(/\s+/g,' ').trim()
const need=(ok,message)=>{if(!ok)throw Object.assign(Error('Square Yards current native: '+message),{abortRetries:true})}
const one=(xs,label)=>{need(xs.length===1,'missing or ambiguous '+label);return xs[0]}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const hash=x=>createHash('sha256').update(x).digest('hex')
const paths=['Sales','Technology','Marketing','Customer_Relations','Human_Resources','Interior_Company']
const municipal=new Map([
 ['Mumbai',['Mumbai','https://mumbaicity.gov.in/en/']],['Pune',['Pune','https://pune.gov.in/en/']],
 ['Bangalore',['Bangalore','https://bengaluruurban.nic.in/en/history/']],
 ['Gurgaon',['Gurgaon','https://gurugram.gov.in/history/']],['Noida',['Noida','https://gbnagar.nic.in/how-to-reach/']],
 ['Delhi NCR, Mumbai, Bangalore, Hyderabad',[null,'https://ncrpb.nic.in/districts.html']],
])
export function squareListing(html){
 const doc=readNativeDocument(html)
 need(doc.nodes(n=>n.tag==='meta'&&n.attrs.property==='og:site_name'&&n.attrs.content==='http://www.squareyards.com').length===1,'publisher metadata changed')
 const tabs=one(doc.nodes(n=>doc.hasClass(n,'departmentTabs')),'native department navigation')
 const names=doc.nodes(n=>n.tag==='button'&&doc.hasClass(n,'onClickLink'),tabs).map(n=>n.attrs['data-name'])
 need(same(names,['Sales','Technology','Marketing','CR','HR','Interior Company']),'native department inventory changed')
 const declarations=doc.nodes(n=>n.tag==='script'&&n.attrs.src&&(!n.attrs.type||/^(?:module|(?:text|application)\/(?:java|ecma)script)$/i.test(n.attrs.type)))
  .map(n=>new URL(n.attrs.src,SQUARE_CAREERS).href).filter(url=>programs.has(url)&&url.includes('/carriers-'))
 const program=one(declarations,'native career client declaration')
 return{departments:paths,labels:names,program}
}
const appURL=row=>origin+'/career_form/'+row.id+'?location='+row.location.split(' ').join('_')+'&dept='+row.department.split(' ').join('_')
function criteriaGuard(doc,country,workplace){
 const blocks=doc.nodes(n=>['p','li','b','strong','h1','h2','h3','h4','div'].includes(n.tag)).map(doc.text).filter(Boolean)
 need(!findExplicitNativeClosure(blocks),'native role explicitly closed')
 for(const block of blocks){
  const c=/^(?:(?:workplace|work|job)\s+)?country\s*:\s*(.+)$/i.exec(block)
  if(c)need(nativeCountryName(c[1])===country,'full native criteria country conflict')
  const location=/^(?:(?:work|job)\s+)?(?:workplace|location)\s*[:\-]\s*(.+)$/i.exec(block)
  if(location){const explicit=nativeLocationCountryName(location[1]);need(!explicit||explicit===country,'full native criteria workplace country conflict')}
  const employer=/^(?:hiring organization|legal employer|employer|company(?: name)?)\s*:\s*(.+)$/i.exec(block)
  if(employer)need(['Square Yards','Squareyards'].includes(employer[1]),'full native criteria employer conflict')
  const residence=/^(?:candidates?|applicants?|you|employees?)\s+(?:must|are required to)\s+(?:currently\s+)?(?:be\s+)?(?:reside|live|work|based)\s+in\s+(.+?)[.!]?$/i.exec(block)
  if(residence)need(residence[1]===workplace||nativeCountryName(residence[1])===country,'full native criteria residence conflict')
 }
}
export function squareRole(row,departmentPath){
 need(row&&Number.isSafeInteger(row.id)&&row.id>0&&/^JD\d+$/.test(row.jobId)&&norm(row.positionName),'native role identity unavailable')
 const keys=['id','jobId','positionName','openPosition','total','noOfClosePosition','remarks','status','verticalName','department','location','description','recuiterId','employeeName','isPublish','postedOn']
 need(same(Object.keys(row).sort(),keys.sort()),'new native role fields require country/employer/publication review')
 need(paths.includes(departmentPath)&&row.department===departmentPath.split('_').join(' '),'native department identity disagreement')
 need(row.department!=='Interior Company'&&row.verticalName!=='Interior'&&row.verticalName!=='Connect','native employer is a different brand')
 need(row.status==='Open'&&row.isPublish===1&&Number.isSafeInteger(row.openPosition)&&row.openPosition>0,'native role publication closed or unavailable')
 const geo=municipal.get(row.location);need(geo,'exact whole native workplace unqualified')
 const description=extractActiveDescription(row.description);need(description&&description.length>100,'full authored criteria unavailable')
 const doc=readNativeDocument(row.description);criteriaGuard(doc,'India',row.location)
 need(!doc.nodes(n=>n.tag==='script'||n.tag==='iframe').length,'unexpected active criteria program')
 const url=appURL(row)
 return{source,title:norm(row.positionName),company:'Square Yards',nativeEmployer:'Square Yards',nativeLegalEmployer:null,
  jobId:String(row.id),requisitionId:row.jobId,department:row.department,sourceUrl:SQUARE_CAREERS+'/'+departmentPath,applyUrl:url,link:url,
  country:'India',city:geo[0],state:null,location:row.location,sourceCountryScopeUnresolved:false,
  sourceCountryEvidence:{kind:'exact-whole-native-role-workplace',nativeLabel:row.location,country:'India',reference:geo[1],
   ...(row.location==='Delhi NCR, Mumbai, Bangalore, Hyderabad'?{references:['https://ncrpb.nic.in/districts.html','https://mumbaicity.gov.in/en/','https://bengaluruurban.nic.in/en/history/','https://hyderabad.telangana.gov.in/about-district/']}: {})},
  sourceDescription:description,jobDescription:description,sourceDetailComplete:true,publicExperienceChecked:true,
  nativeSourceRecord:row,sourceRawDescriptionHtml:row.description,postingDate:null,closingDate:null,
  sourceNativeDates:{postedOn:row.postedOn??null,interpretation:'empty-or-unreviewed-native-date-never-fabricated'},
  employmentType:null,remoteStatus:null,experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],
  sourceCompanyScopeUnresolved:false,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false}
}
export function squareApplication(html,row){
 const doc=readNativeDocument(html),area=one(doc.nodes(n=>doc.hasClass(n,'CareerFormSecond')),'native application area')
 const declared=doc.nodes(n=>n.tag==='script'&&n.attrs.src&&programs.has(new URL(n.attrs.src,SQUARE_CAREERS).href)&&n.attrs.src.includes('/career_form-'))
 need(declared.length===1,'native application client changed')
 const headings=doc.nodes(n=>doc.hasClass(n,'headingBox'),area)
 need(headings.some(n=>doc.nodes(c=>c.tag==='h2'&&doc.text(c)===row.department,n).length===1
  &&doc.nodes(c=>c.tag==='p'&&doc.text(c)===row.location,n).length===1),'native application department/workplace identity differs')
 need(headings.some(n=>doc.hasClass(n,'jobId')&&doc.text(n)==='Job Id: '+row.id),'native application visible job identity differs')
 const form=one(doc.nodes(n=>n.tag==='form'&&n.attrs.id==='main_form',area),'native candidate form')
 const identity=one(doc.nodes(n=>n.tag==='input'&&n.attrs.name==='job_id',form),'native application hidden identity')
 need(identity.attrs.type==='hidden'&&identity.attrs.value===String(row.id),'native application hidden identity differs')
 for(const name of ['name','email'])need(doc.nodes(n=>n.tag==='input'&&n.attrs.name===name&&Object.hasOwn(n.attrs,'required')&&!Object.hasOwn(n.attrs,'disabled')&&!Object.hasOwn(n.attrs,'readonly'),form).length===1,'enabled native candidate field unavailable')
 const submit=one(doc.nodes(n=>n.tag==='button'&&doc.hasClass(n,'finalSubmitBtn')),'native final application control')
 need(doc.text(submit)==='Submit Application'&&!Object.hasOwn(submit.attrs,'disabled'),'native application control disabled')
 need(!doc.nodes(n=>n.tag==='fieldset'&&Object.hasOwn(n.attrs,'disabled'),area).length,'native application fieldset disabled')
 criteriaGuard({nodes:fn=>doc.nodes(fn,area),text:doc.text},'India',row.location)
 // Retain conditionally hidden experience/education definitions as original
 // data. Their presence does not qualify an enabled application control.
 const walk=n=>[n,...(n.children||[]).filter(c=>typeof c!=='string').flatMap(walk)]
 const all=walk(one(doc.nodes(n=>n.tag==='root'),'native document'))
 const forms=['main_form','resume_upload','experienceForm','educationForm'].map(id=>one(all.filter(n=>n.tag==='form'&&n.attrs.id===id),'native '+id))
 const fields=forms.flatMap(f=>walk(f).filter(n=>['input','select','textarea','button','label'].includes(n.tag)).map(n=>({tag:n.tag,attrs:n.attrs,text:doc.text(n),inert:Boolean(n.inert)})))
 fields.push({tag:submit.tag,attrs:submit.attrs,text:doc.text(submit)})
 return{jobId:String(row.id),department:row.department,location:row.location,form:form.attrs,fields,submissionVerified:false,activationVerified:false}
}
export async function runSquareNative(options={}){
 options.signal?.throwIfAborted();need(!options.fetchText&&!options.fetchJson&&!options.fetchDepartmentListings,'metadata-free legacy callbacks cannot qualify current native reads')
 const selectedFetch=options.fetchImpl??globalThis.fetch
 need(!(selectedFetch===globalThis.fetch&&options.requestIntervalMs!==undefined&&options.requestIntervalMs<1000),'invalid public transport limits: minimum pacing')
 const fetchImpl=async(url,init)=>{
  const response=await selectedFetch(url,init)
  const interrupted=init.signal?.aborted
  const error=!interrupted&&(response.status!==200||isHttpAccessChallenge(response))?buildHttpError(response,url):null
  if(interrupted||error){
   try{await disposeResponseBody(response,{signal:init.signal,bestEffort:true})}catch{}
   options.signal?.throwIfAborted()
   if(error)throw error
   init.signal?.throwIfAborted()
  }
  return response
 }
 const io=createBoundedPublicCareerTransport({...options,fetchImpl,source,allowedURL:(u,m)=>m==='GET'&&(u===SQUARE_CAREERS||programs.has(u)||paths.some(p=>u===SQUARE_CAREERS+'/'+p)||u.startsWith(origin+'/career_form/')&&/^\/career_form\/\d+$/.test(new URL(u).pathname))})
 const rawPages=[],openingNativeRecords=[],closingNativeRecords=[],held=[],jobs=[],openingApplications=[],closingApplications=[]
 const load=async(u,kind='html')=>{const value=kind==='json'?await io.fetchJson(u):kind==='js'?await io.fetchScript(u):await io.fetchText(u);rawPages.push({url:u,kind,...(kind==='json'?{originalModel:value}:{html:value,sha256:hash(value)})});return value}
 const client=async listing=>{
  const selected=listing.program===currentCareerProgram?[[currentCareerProgram,programs.get(currentCareerProgram)]]:[...programs].filter(([url])=>url!==currentCareerProgram)
  for(const[u,expected]of selected)need(hash(await load(u,'js'))===expected,'whole declared program changed')
 }
 const inventory=async(target,currentClientPassiveDataOnly=false)=>{
  for(const path of paths){
   const packet=await load(SQUARE_CAREERS+'/'+path,'json')
   if(currentClientPassiveDataOnly)need(same(Object.keys(packet??{}).sort(),['data','message','status']),'unknown current department metadata requires country/employer/eligibility review')
   need(packet.status===1&&packet.message==='Successfully'&&Array.isArray(packet.data),'native department response unavailable');need(packet.data.length<=120,'native row budget exceeded');for(const row of packet.data)target.push({departmentPath:path,row})
  }
  need(target.length>0&&target.length<=200&&new Set(target.map(x=>x.row.id)).size===target.length,'missing or ambiguous native full inventory')
 }
 try{
  const listing=squareListing(await load(SQUARE_CAREERS)),currentClientPassiveDataOnly=listing.program===currentCareerProgram
  await client(listing);await inventory(openingNativeRecords,currentClientPassiveDataOnly)
  for(const{departmentPath,row}of openingNativeRecords){
   let job;try{
    if(currentClientPassiveDataOnly)need(['India Primary','Support','Services'].includes(row?.verticalName),'current native employer vertical is unqualified')
    job=squareRole(row,departmentPath)
   }catch(e){held.push({id:row?.id,reason:e.message,originalRecord:row});continue}
   if(currentClientPassiveDataOnly){
    Object.assign(job,{currentClientPassiveDataOnly:true,sourceDetailComplete:false,publicExperienceChecked:false,
     sourceBrowserRenderingQualified:false,sourceApplicationQualified:false,sourceAvailabilityQualified:false,sourceNativeApplication:null,
     sourceCompanyScopeUnresolved:true})
    jobs.push(job);continue
   }
   const html=await load(job.applyUrl),model=squareApplication(html,row);openingApplications.push({id:row.id,model,html});job.sourceNativeApplication=model;jobs.push(job)
  }
  await inventory(closingNativeRecords,currentClientPassiveDataOnly);need(same(openingNativeRecords,closingNativeRecords),'native closing full inventory differs')
  for(const job of jobs){
   if(currentClientPassiveDataOnly){job.sourceClosingQualified=true;continue}
   const row=job.nativeSourceRecord,html=await load(job.applyUrl),model=squareApplication(html,row);closingApplications.push({id:row.id,model,html});need(same(model,job.sourceNativeApplication),'native closing full application differs');job.sourceClosingQualified=true
  }
  await client(listing);need(same(listing,squareListing(await load(SQUARE_CAREERS))),'native closing publisher inventory differs')
  const summary={source,openingNativeRecords,closingNativeRecords,held,openingApplications,closingApplications,rawPages,openingClosingMatch:true,
   companyIndiaTotal:null,companyGlobalTotal:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,applicationSubmitted:false,
   currentClientPassiveDataOnly,currentDeclaredCareerProgram:listing.program}
  const now=(options.now||(()=>new Date().toISOString()))();need(Number.isFinite(Date.parse(now)),'invalid observation clock')
  for(const j of jobs)j.scrapedAt=now
  const selected=Number.isSafeInteger(options.maxJobs)&&options.maxJobs>=0?jobs.slice(0,options.maxJobs):jobs
  attachSourceObservationEvidence(selected,{source,recordKind:'vacancy-rows',observedRecordCount:openingNativeRecords.length,observedVacancyCount:openingNativeRecords.length,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null})
  Object.defineProperty(selected,'nativeCollectionEvidence',{value:summary,configurable:true})
  await options.onAudit?.(structuredClone(summary));io.signal.throwIfAborted()
  return attachInventoryEvidence(selected,{status:'coverage-gap',surface:SQUARE_CAREERS,firstParty:true,pagesFetched:rawPages.length,listingComplete:false,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,
   reason:currentClientPassiveDataOnly?'whole-current-native-criteria-closing-paired;browser-application-availability-formal-details-other-brands-company-scope-held':'whole-own-role-criteria-and-application-closing-qualified;other-brands-and-company-inventory-held'})
 }finally{io.close()}
}
