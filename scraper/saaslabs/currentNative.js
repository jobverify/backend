import {isDeepStrictEqual} from 'node:util'
import {extractKulaNativeJobs,resolveKulaJobDescriptions} from '../../scraper-support/utils/kulaFlight.js'
import {readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {inspectSaaSLabsApplication} from './applicationCriteria.js'

const BOARD='https://careers.kula.ai/saas-labs'
const fail=(condition,reason)=>{if(!condition)throw Error('[saaslabs] '+reason)}
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const text=value=>typeof value==='string'&&value.trim().length>0
const normalize=value=>value.replace(/\s+/g,' ').trim()
const roleKeys=['id','account_id','title','listed','kind','is_confidential','launch_at','end_at','eeoc','coordinator_enabled','jobs_cbv_settings_enabled','ats_job']
const jobKeys=['job_description','workplace','employment_type','work_type_name','ats_department','offices']
const officeKeys=['id','name','location','location_key','country','country_code','state','city','remote','workplace']
const extra=(value,keys,path,issues)=>{for(const key of Object.keys(value))if(!keys.includes(key))issues.push('unreviewed-native-field:'+path+'.'+key)}
const timestamp=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))return false
 const day=value.slice(0,10);return new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day
}
const countries=new Map(),names=new Intl.DisplayNames(['en'],{type:'region'})
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){
 const code=String.fromCharCode(a,b),name=names.of(code)
 if(name&&name!==code&&!['ZZ','EU','UN','XA','XB','QO'].includes(code)){countries.set(code.toLowerCase(),code);countries.set(name.toLowerCase(),code)}
}

export async function readCurrentSaaSLabs({fetchText,signal,onAudit=()=>{}}){
 signal?.throwIfAborted()
 const html=await fetchText(BOARD,{signal})
 signal?.throwIfAborted()
 fail(typeof html==='string','native document unavailable')
 const document=readNativeDocument(html)
 const frames=document.nodes(node=>node.tag==='script'&&node.raw?.trim().startsWith('self.__next_f.push('))
 const rawFrames=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].filter(([,body])=>body.trim().startsWith('self.__next_f.push('))
 fail(frames.length>0&&frames.length===rawFrames.length&&frames.every(node=>Object.keys(node.attrs).length===0),'unreviewed or inactive native Flight activation')
 const native=extractKulaNativeJobs(html,{accountName:'saas-labs'})
 const resolved=resolveKulaJobDescriptions(html,native),byId=new Map(resolved.map(row=>[row.id,row]))
 const visible=readVisibleNativeDocument(html,{strict:true}),parents=new Map()
 const root=visible.nodes(node=>node.tag==='root')[0]
 const titles=document.nodes(node=>node.tag==='title')
 fail(titles.length===1&&normalize(titles[0].raw||'')==='Work at SaaS Labs | Careers for Innovators'
  &&visible.text(root).includes('SaaS Labs Careers')&&visible.text(root).includes('Open Positions'),'native publisher identity or active careers heading changed')
 const index=node=>{for(const child of node.children||[])if(typeof child!=='string'){parents.set(child,node);index(child)}}
 index(root)
 const links=new Map()
 for(const anchor of visible.nodes(node=>node.tag==='a'&&node.attrs.href)){
  let url;try{url=new URL(anchor.attrs.href,BOARD)}catch{continue}
  if(url.origin!=='https://careers.kula.ai')continue
  const match=url.pathname.match(/^\/saas-labs\/(\d+)-[a-z0-9][a-z0-9-]*\/?$/i)
  if(!match)continue
  fail(!url.username&&!url.password&&!url.search&&!url.hash,'ambiguous native application identity')
  const id=match[1],prior=links.get(id)
  fail(!prior||prior.url===url.href,'conflicting native role application links')
  let card=anchor
  while(card&&!String(card.attrs.class||'').split(/\s+/).includes('chakra-card'))card=parents.get(card)
  fail(card,'native role link is not bound to a rendered role card')
  // This dedicated paragraph is the observed renderer's role title, separate
  // from department/location text elsewhere in the same card.
  const headings=visible.nodes(node=>{
   if(node.tag!=='p'||!['chakra-text','css-1ttm4yl'].every(name=>String(node.attrs.class||'').split(/\s+/).includes(name)))return false
   let parent=node;while(parent&&parent!==card)parent=parents.get(parent)
   return parent===card
  })
  fail(headings.length===1&&text(visible.text(headings[0])),'native role lacks one dedicated visible title')
  links.set(id,{url:url.href,href:anchor.attrs.href,renderedTitle:visible.text(headings[0])})
 }
 const offices=new Map(),jobs=[],unknownCountryIds=[],criteriaUnknownIds=[],nativeApplicationDetails=[]
 for(const row of native){
  signal?.throwIfAborted()
  fail(plain(row)&&Number.isSafeInteger(row.id)&&row.id>0&&row.account_id===1364&&text(row.title),'native role/account identity changed')
  fail(row.listed===true&&row.kind==='internal_and_external'&&row.is_confidential===false,'native role is not an advertised public vacancy')
  fail(timestamp(row.launch_at)&&Date.parse(row.launch_at)<=Date.now()&&row.end_at===null,'unreviewed native launch/end lifecycle')
  const link=links.get(String(row.id))
  fail(link&&normalize(link.renderedTitle)===normalize(row.title),'native role lacks exact visible employer title/application binding')
  const issues=[];extra(row,roleKeys,'role',issues)
  fail(plain(row.eeoc)&&typeof row.eeoc.enabled==='boolean','invalid native EEOC schema')
  extra(row.eeoc,['enabled'],'eeoc',issues)
  if(row.eeoc.enabled!==false||row.coordinator_enabled!==null||row.jobs_cbv_settings_enabled!==false)issues.push('unreviewed-native-application-settings')
  const ats=row.ats_job,full=byId.get(row.id)?.ats_job
  fail(plain(ats)&&plain(full)&&Array.isArray(ats.offices)&&ats.offices.length>0,'native office inventory unavailable')
  extra(ats,jobKeys,'ats_job',issues)
  fail(['office','remote','hybrid'].includes(ats.workplace)&&text(ats.employment_type)&&text(ats.work_type_name),'invalid native employment/workplace')
  fail(plain(ats.ats_department)&&Number.isSafeInteger(ats.ats_department.id)&&text(ats.ats_department.name)&&Number.isSafeInteger(ats.ats_department.depth),'invalid native department')
  extra(ats.ats_department,['id','name','depth'],'department',issues)
  let india=false,countryComplete=true
  for(const office of ats.offices){
   fail(plain(office)&&Number.isSafeInteger(office.id)&&office.id>0&&['name','location','location_key','country','country_code','state','city'].every(key=>text(office[key]))&&typeof office.remote==='boolean'&&['office','remote','hybrid'].includes(office.workplace),'invalid native office/country shape')
   const prior=offices.get(office.id);fail(!prior||isDeepStrictEqual(prior,office),'conflicting native office identity')
   offices.set(office.id,structuredClone(office));extra(office,officeKeys,'office',issues)
   const code=/^[A-Z]{2}$/.test(office.country_code)?countries.get(office.country_code.toLowerCase()):null
   const name=countries.get(office.country.trim().toLowerCase())
   fail(!code||!name||code===name,'native country/code contradiction')
   const labelCountry=countries.get(office.location.split(',').at(-1).trim().toLowerCase())
   fail(!code||!labelCountry||code===labelCountry,'native office country/location contradiction')
   fail(!(office.remote&&office.workplace==='office'),'native office workplace contradiction')
   if(!code||!name){countryComplete=false;issues.push('unreviewed-native-country')}
   if(code==='IN'&&name==='IN')india=true
  }
  if(!countryComplete)unknownCountryIds.push(String(row.id))
  fail(text(full.job_description),'native full description unavailable')
  const jd=readVisibleNativeDocument(full.job_description,{strict:true}),jdRoot=jd.nodes(node=>node.tag==='root')[0]
  const description=jd.text(jdRoot),active=extractActiveDescription(full.job_description)
  const hiddenMarkup=/<(?:script|style|template|iframe|object|noscript)\b|<[^>]*\b(?:hidden|inert|aria-hidden)\b/i.test(full.job_description)
  const descriptionComplete=Boolean(active&&description&&normalize(description)===normalize(active)&&!hiddenMarkup)
  if(!descriptionComplete)issues.push('native-visible-full-description-unreviewed')
  const job={jobId:String(row.id),requisitionId:null,title:row.title,sourceNativeTitle:row.title,sourceRenderedTitle:link.renderedTitle,company:'SaaS Labs',sourcePublisher:'SaaS Labs',legalHiringEmployer:null,source:'saaslabs',country:'India',
   location:ats.offices.map(office=>office.location).join(' / '),locations:ats.offices.map(office=>office.location),sourceUrl:link.url,applyUrl:link.url,link:link.url,sourceObservedHref:link.href,
   department:ats.ats_department.name,employmentType:ats.work_type_name,remoteStatus:({office:'On-site',remote:'Remote',hybrid:'Hybrid'})[ats.workplace],postingDate:null,closingDate:null,
   sourceNativeLaunchAt:row.launch_at,sourceNativeEndAt:row.end_at,sourceNativeRecord:structuredClone(row),sourceNativeDescription:full.job_description,sourceNativeOffices:structuredClone(ats.offices),
   jobDescription:description||null,sourceDescription:description||null,sourceCriteriaIssues:issues,sourceListingDescriptionComplete:descriptionComplete,sourceDetailComplete:false,
   sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,sourceGlobalJobCount:null,scrapedAt:new Date().toISOString()}
  let detail,detailHTML=null
  try{
   signal?.throwIfAborted()
   detailHTML=await fetchText(link.url,{signal});signal?.throwIfAborted()
   detail=inspectSaaSLabsApplication(detailHTML,{url:link.url,listing:job});signal?.throwIfAborted()
  }catch(error){
   signal?.throwIfAborted()
   detail={requestedUrl:link.url,rawHTML:detailHTML,rawProps:null,resolvedProps:null,issues:['native-application-detail-unavailable'],literalCriteriaCopyComplete:false,applicationDataRetained:false,fullCriteriaQualified:false,
    failure:{name:error.name,message:error.message,code:error.code??null}}
  }
  nativeApplicationDetails.push({id:String(row.id),url:link.url,evidence:detail})
  issues.push(...detail.issues)
  job.sourceNativeApplication=detail
  job.sourceNativeApplicationDataRetained=detail.applicationDataRetained===true
  job.sourceNativeCriteriaCopyComplete=detail.literalCriteriaCopyComplete===true
  job.sourceNativeApplicationIdentityReconciled=detail.identityReconciled===true
  job.sourceNativeApplicationCountryReconciled=detail.countryReconciled===true
  job.sourceNativeApplicationCriteriaReconciled=detail.criteriaAttributable===true
  // Unbound account/job/country data remains in raw evidence; it cannot replace
  // criteria attributed to this listed role.
  const boundForm=detail.criteriaAttributable===true?detail.resolvedProps?.form:null
  job.sourceApplicationStaticFields=structuredClone(boundForm?.static_fields??null)
  job.sourceApplicationCustomFields=structuredClone(boundForm?.ats_custom_fields??null)
  job.sourceApplicationRejectionRules=structuredClone(boundForm?.ats_auto_rejection_rules??null)
  if(issues.length)criteriaUnknownIds.push(String(row.id))
  if(india)jobs.push(job)
 }
 const ids=new Set(native.map(row=>String(row.id)))
 const audit={source:'saaslabs',originalNativeHTML:html,nativeRecords:structuredClone(native),observedNativeCount:native.length,observedIndiaRecords:jobs.length,
  employerRoleIds:[...links.keys()],unreconciledEmployerRoleIds:[...links.keys()].filter(id=>!ids.has(id)),unknownCountryIds,criteriaUnknownIds,nativeApplicationDetails,
  sourceScopeComplete:false,lifecycleCleanupAllowed:false,authoritativeSourceTotal:null,authoritativeIndiaFacetCount:null,noClosingProof:true,currentLiveQualification:false,legalHiringEmployer:null,
  missingProofs:['current corporate delegation and all hiring channels','native client/program/style/form activation and conditional rule predicates','fetchText does not expose final response URL/MIME to this reader','fresh opening/closing global inventory and native details']}
 Object.defineProperty(jobs,'sourceAudit',{value:audit})
 await onAudit(structuredClone(audit));signal?.throwIfAborted()
 return attachInventoryEvidence(jobs,{status:'discovery-only',surface:BOARD,firstParty:false,listingComplete:false,pagesFetched:1+nativeApplicationDetails.filter(d=>typeof d.evidence.rawHTML==='string').length,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'saaslabs-native-role-and-application-criteria-retained-activation-rules-and-source-scope-unresolved'})
}
