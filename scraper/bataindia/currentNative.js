import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {nativeCountryName,nativeLocationCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {withCurrentBataRead,need,sha} from './publicRead.js'
import {inspectPublishedBataCriteria} from './publicCriteria.js'
export const BOARD='https://bata.sensehq.com/careers'
const COMPANY='Bata India',ORG=5079,PAGE_SIZE=10
const norm=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():null
const stable=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v)
const plain=html=>{const doc=readNativeDocument(String(html??''));return doc.text(doc.nodes(n=>n.tag==='root')[0])}
const publicFields=['id','code','title','department','job_status','created_on','organization_id','location','office','description_external','skills_and_expertise_external','experience_start','experience_end','job_type','workplace_type','is_published','is_deleted']
const publicModel=job=>Object.fromEntries(publicFields.filter(key=>Object.hasOwn(job,key)).map(key=>[key,job[key]]))
const countryEvidence=value=>{
 if(typeof value==='string'){const country=nativeCountryName(value);return{raw:value,country,unresolved:!country,conflict:false}}
 if(value&&typeof value==='object'&&!Array.isArray(value)){
  const values=Object.entries(value).filter(([key])=>['name','identifier','code','countryCode','value','label','addressCountry'].includes(key)).map(([,v])=>countryEvidence(v)),names=[...new Set(values.map(v=>v.country).filter(Boolean))]
  const unknownKeys=Object.keys(value).filter(key=>!['name','identifier','code','countryCode','value','label','addressCountry','@type','type'].includes(key))
  return{raw:value,country:names.length===1&&!unknownKeys.length&&!values.some(v=>v.unresolved||v.conflict)?names[0]:null,unresolved:!values.length||unknownKeys.length>0||values.some(v=>v.unresolved),conflict:names.length>1||values.some(v=>v.conflict)}
 }
 return{raw:value??null,country:null,unresolved:true,conflict:false}
}
const countryFor=record=>{
 const offices=record.office==null?[]:Array.isArray(record.office)?record.office:[record.office],alternatives=offices.map(office=>({nativeOffice:office,countryEvidence:countryEvidence(office?.country)})),location=nativeLocationCountryName(record.location),countries=[...new Set(alternatives.map(a=>a.countryEvidence.country).filter(Boolean))]
 const unresolved=alternatives.some(a=>a.countryEvidence.unresolved),conflict=countries.length>1||alternatives.some(a=>a.countryEvidence.conflict)||Boolean(location&&countries.some(country=>country!==location))
 return{country:conflict||unresolved?null:countries[0]??location??null,conflict,unresolved,nativeOfficeCountry:record.office?.country??null,nativeOfficeAlternatives:alternatives,nativeLocation:record.location??null}
}
const nextData=html=>{
 const doc=readNativeDocument(html),scripts=doc.nodes(n=>n.tag==='script'&&n.attrs.id==='__NEXT_DATA__'&&n.attrs.type==='application/json')
 need(scripts.length===1,'missing or ambiguous current public Next data')
 let data;try{data=JSON.parse(scripts[0].raw)}catch{need(false,'invalid current public Next data')}
 const props=data.props?.pageProps,organization=props?.organization
 const errorState=[data,data.props,props].some(object=>object&&['error','err','errors'].some(key=>object[key]!=null&&object[key]!==false))
 const continuation=[data,data.props,props,props?.jobsData].some(object=>object&&Object.entries(object).some(([key,value])=>/^(?:hasMore|has_more|hasNext|has_next|next|nextCursor|next_cursor|nextPage|next_page|continuation(?:Token)?)$/i.test(key)&&value!=null&&value!==false&&value!==''))
 need(!data.notFound&&!errorState&&!continuation&&props?.preview===false&&organization?.id===ORG&&organization.name==='Bata','public employer, preview, error or continuation state changed')
 need(/Bata India/i.test(plain(organization.description)),'current native employer description no longer identifies Bata India')
 return{doc,data,props,organization:{id:organization.id,name:organization.name,registeredName:organization.registered_name??null,subdomain:organization.career_page_subdomain??organization.subdomain}}
}
const listing=(html,page)=>{
 const model=nextData(html),{data,props}=model,jobs=props.jobsData
 need(jobs&&Object.keys(jobs).every(key=>['rows','count'].includes(key))&&Array.isArray(jobs.rows)&&Number.isSafeInteger(jobs.count)&&jobs.count>=0&&jobs.count<=10000,'native listing count/rows or terminal envelope is unqualified')
 need(page===0?data.page==='/'&&Object.keys(data.query??{}).length===0&&props.isIframe===false:data.page==='/jobs'&&data.query?.page===String(page)&&data.query?.isIframe==='true'&&props.isIframe==='true','native pagination query identity changed')
 need(jobs.rows.length===Math.min(PAGE_SIZE,Math.max(0,jobs.count-page*PAGE_SIZE)),'native page length contradicts its offset/count')
 for(const row of jobs.rows)need(Number.isSafeInteger(row.id)&&row.id>0&&row.organization_id===ORG&&row.job_status==='OPEN'&&norm(row.title),'native row identity, employer or public state changed')
 return{organization:model.organization,total:jobs.count,rows:jobs.rows}
}
const detail=(html,row)=>{
 const {data,props,organization}=nextData(html),job=props.job
 need(data.page==='/job'&&data.query?.id===String(row.id)&&job?.id===row.id&&job.organization_id===ORG,'native own-role route/employer identity changed')
 need(norm(job.title)===norm(row.title)&&job.code===row.code&&job.created_on===row.created_on&&job.job_status==='OPEN'&&job.is_published===true&&job.is_deleted===false,'native detail/listing identity, original publication or public posting state changed')
 const country=countryFor(job),listingCountry=countryFor(row),countryConflict=country.conflict||listingCountry.conflict||Boolean(country.country&&listingCountry.country&&country.country!==listingCountry.country)
 const sourceDescription=typeof job.description_external==='string'?job.description_external:'',descriptionText=plain(sourceDescription),visible=readVisibleNativeDocument(html,{strict:true}),visibleText=visible.text(visible.nodes(n=>n.tag==='root')[0]),skills=typeof job.skills_and_expertise_external==='string'?job.skills_and_expertise_external:''
 const descriptionFlow=inspectPublishedBataCriteria(html,descriptionText),publicDescriptionComplete=descriptionFlow.qualified,publicSkillsText=plain(skills)
 const skillsPublished=!publicSkillsText||visibleText.includes(publicSkillsText)
 const knownCriteria=new Set(['description_external','skills_and_expertise_external','experience_start','experience_end'])
 const unsupportedCriteria=Object.keys(job).filter(key=>/description|skills|qualif|requir|responsib|benefit/i.test(key)&&!/_internal$|application|referral/i.test(key)&&!knownCriteria.has(key)&&job[key]!=null&&job[key]!=='')
 const complete=publicDescriptionComplete&&skillsPublished&&!unsupportedCriteria.length
 return{organization,job,country:{...country,country:countryConflict?null:country.country,conflict:countryConflict},descriptionText,sourceDescription,skills,descriptionFlow,publicDescriptionComplete,skillsPublished,unsupportedCriteria,complete}
}
const mapJob=(model,now)=>{
 const {job,country}=model,employment={FULLTIME:'Full-time',PARTTIME:'Part-time',CONTRACT:'Contract',INTERNSHIP:'Internship'},experience=Number.isFinite(job.experience_start)&&Number.isFinite(job.experience_end)?job.experience_start+'-'+job.experience_end+' years':null
 const date=Number.isSafeInteger(job.created_on)?new Date(job.created_on):null,postingDate=date&&Number.isFinite(date.getTime())?date.toISOString():null
 return{source:'bataindia',company:COMPANY,title:job.title.trim(),jobId:String(job.id),requisitionId:norm(job.code),department:norm(job.department),location:job.location??null,city:job.office?.city??null,country:country.country,sourceUrl:BOARD+'/jobs/'+job.id,applyUrl:BOARD+'/jobs/'+job.id,link:BOARD+'/jobs/'+job.id,employmentType:employment[job.job_type]??job.job_type??null,experienceRequired:experience,minimumQualification:null,preferredQualification:null,requiredSkills:[],postingDate,closingDate:null,jobDescription:model.complete?model.sourceDescription+(plain(model.skills)?'\n<h3>Skills and expertise</h3>'+model.skills:''):null,sourceDetailComplete:model.complete,fullNativeCriteriaAvailable:model.complete,scrapedAt:now,sourceScopeComplete:false,lifecycleCleanupAllowed:false,nativePostingDate:job.created_on,nativeCountryEvidence:country,nativeCriteriaVisibility:model.descriptionFlow,nativePublicJob:job}
}
export const createCurrentBataIndiaScraper=(defaults={})=>({async run(passed={}){
 const options={...defaults,...passed},cap=options.maxJobs??0
 need(Number.isSafeInteger(cap)&&cap>=0,'invalid caller job cap')
 return withCurrentBataRead(options,async({read,receipts,observe})=>{
  const snapshot=async phase=>{
   const root=listing(await read(BOARD,phase),0),rows=[...root.rows],pages=[{page:0,rows:root.rows.length}]
   for(let page=1;page*PAGE_SIZE<root.total;page++){
    const model=listing(await read(BOARD+'/iframe/jobs?page='+page+'&isIframe=true',phase),page)
    need(model.total===root.total&&stable(model.organization)===stable(root.organization),'native count or employer changed between pages')
    rows.push(...model.rows);pages.push({page,rows:model.rows.length})
   }
   need(rows.length===root.total&&new Set(rows.map(r=>r.id)).size===rows.length,'native unique ID inventory does not reconcile')
   return{organization:root.organization,total:root.total,rows,pages}
  }
  const first=await snapshot('opening'),models=[]
  for(const row of first.rows)models.push(detail(await read(BOARD+'/jobs/'+row.id,'opening-detail'),row))
  for(let i=0;i<first.rows.length;i++){
   const closing=detail(await read(BOARD+'/jobs/'+first.rows[i].id,'closing-detail'),first.rows[i])
   need(stable({...models[i],job:publicModel(models[i].job)})===stable({...closing,job:publicModel(closing.job)}),'closing own-role criteria, workplace or original fields changed')
  }
  const final=await snapshot('final-inventory')
  need(stable({...first,rows:first.rows.map(publicModel)})===stable({...final,rows:final.rows.map(publicModel)}),'final native cohort, employer or public fields changed after closing details')
  const stamp=typeof options.now==='function'?options.now():options.now??new Date().toISOString();need(typeof stamp==='string'&&Number.isFinite(Date.parse(stamp)),'invalid observation clock')
  const observations=models.map(model=>mapJob(model,stamp)),detailGaps=observations.filter(row=>!row.sourceDetailComplete).map(row=>({jobId:row.jobId,reason:'full-public-description-or-separate-criteria-unavailable'})),countryGaps=observations.filter(row=>!row.country).map(row=>({jobId:row.jobId,evidence:row.nativeCountryEvidence})),publicationDateGaps=observations.filter(row=>row.postingDate===null).map(row=>({jobId:row.jobId,reason:'native-original-publication-date-unavailable'})),qualified=observations.filter(row=>row.sourceDetailComplete&&row.country&&!row.nativeCountryEvidence.conflict&&row.postingDate!==null),selected=cap?qualified.slice(0,cap):qualified
  const complete=!detailGaps.length&&!countryGaps.length&&!publicationDateGaps.length&&selected.length===qualified.length,evidence={status:complete?'complete-inventory':'coverage-gap',surface:BOARD,firstParty:true,listingComplete:complete,pagesFetched:receipts.length,reportedTotal:complete?first.total:null,indiaFacetCount:complete?observations.filter(r=>r.country==='India').length:null,verifiedAt:stamp,reason:complete?'configured-native-board-full-inventory-details-and-final-cohort-reconciled':'native-board-reconciled;public-description-workplace-date-or-caller-cap-gaps-retained'}
  const audit={source:'bataindia',nativeTotal:first.total,observations,detailGaps,countryGaps,publicationDateGaps,fullDescriptions:qualified.length,publicEmployer:first.organization,openingPages:first.pages,finalPages:final.pages,finalInventoryAfterClosingDetails:true,publicPages:receipts,inventoryEvidence:evidence,companyGlobalTotal:null,companyIndiaTotal:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,productionWrites:false}
  await observe(()=>options.onAudit?.(structuredClone(audit)));await observe(()=>options.onRecords?.(structuredClone(observations)))
  const jobs=attachInventoryEvidence(selected,evidence);attachSourceObservationEvidence(jobs,{source:'bataindia',recordKind:'vacancy-rows',observedRecordCount:observations.length,observedVacancyCount:observations.length,sourceScopeComplete:false});Object.defineProperty(jobs,'sourceAudit',{value:audit});return jobs
 })
}})
