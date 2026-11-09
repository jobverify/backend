import {extractWorkdayStructuredDetail} from '../../scraper-support/myworkday/engine.js'
import {toPlainText} from '../../scraper-support/detailExtractors/shared.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {BOARD} from './nativeBinding.js'

const API='https://allegion.wd5.myworkdayjobs.com/wday/cxs/allegion/careers'
const INDIA='c4f78be1a8f14da0ab49ce1162348a5e',BANGALORE='bcf71f1c5971014066533f84bf001941'
const FACETS={locations:[BANGALORE]},PAGE=20,MAX_PAGES=100
const check=(value,message)=>{if(!value)throw Error('Allegion native inventory: '+message)}
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)
const hasFailure=value=>!object(value)||Object.entries(value).some(([key,value])=>{
 const name=key.toLowerCase().replace(/[_\s-]/g,'')
 if(['error','errors','errorcode','errormessage','exception','fault'].includes(name))return true
 if(name==='success')return value!==true
 if(['status','statuscode','httpstatus','httpstatuscode'].includes(name))return !((typeof value==='number'&&value===200)||(typeof value==='string'&&['ok','success'].includes(value.toLowerCase())))
 return ['meta','metadata','response','result'].includes(name)&&value!=null&&hasFailure(value)
})
const date=(value,now,publication=false)=>{
 check(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value),'Native date missing')
 const d=new Date(value+'T00:00:00.000Z')
 check(Number.isFinite(+d)&&d.toISOString().slice(0,10)===value,'Invalid native calendar date')
 check(!publication||+d<=new Date(now).getTime(),'Future native publication')
 return d.toISOString()
}
// Current typed primary labels are Bangalore, India. Accept the demonstrated
// office/building prefixes without treating arbitrary other cities as Bangalore.
export function requireBangalore(value){
 check(typeof value==='string'&&/^(?:(?:No\s*[.:]\s*#?\s*\d+[a-z]?\s*,\s*)?(?:IT\s+Park\s*,\s*)?)?(?:Bangalore|Bengaluru)\s*,\s*India$/i.test(value.trim()),'Selected Bangalore facet contradicts native office')
}
function verifyDetail(payload,row){
 check(!hasFailure(payload),'Native detail error envelope')
 const v=payload.jobPostingInfo,employer=payload.hiringOrganization?.name
 check(!hasFailure(v),'Native posting error envelope')
 check(object(v)&&typeof v.id==='string'&&/^[a-f0-9]{32}$/.test(v.id),'Native posting UID missing')
 check(v.jobPostingSiteId==='careers'&&v.title===row.title&&v.jobReqId===row.bulletFields[0],'Native detail identity mismatch')
 check(v.externalUrl===BOARD+row.externalPath&&v.jobPostingId===row.externalPath.split('/').at(-1),'Native canonical/application identity mismatch')
 check(v.canApply===true&&v.posted===true,'Native role is closed or unavailable')
 check(employer==='Allegion India Private Limited','Native legal employer mismatch')
 check(v.country?.descriptor==='India'&&v.country.id===INDIA&&v.jobRequisitionLocation?.country?.descriptor==='India'&&v.jobRequisitionLocation.country.id===INDIA&&v.jobRequisitionLocation.country.alpha2Code==='IN','Native country mismatch')
 requireBangalore(v.location);requireBangalore(v.jobRequisitionLocation.descriptor)
 if(v.jobRequisitionLocation.id!=null)check(v.jobRequisitionLocation.id===BANGALORE,'Native primary location ID conflicts with selected facet')
 if(v.additionalLocations!=null){check(Array.isArray(v.additionalLocations),'Malformed secondary locations');for(const label of v.additionalLocations){check(typeof label==='string','Unqualified secondary location object');requireBangalore(label)}}
 check(typeof v.jobDescription==='string'&&v.jobDescription.trim(),'Native full description unavailable')
 return v
}
function stableDetail(payload){const v=payload.jobPostingInfo;return JSON.stringify([v.id,v.jobReqId,v.title,v.jobPostingSiteId,v.jobPostingId,v.externalUrl,v.canApply,v.posted,payload.hiringOrganization,v.country,v.location,v.jobRequisitionLocation,v.additionalLocations??null,v.jobDescription,v.startDate,v.endDate??null])}
async function bounded(signal,fn){signal.throwIfAborted();let listener;try{return await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{listener=()=>reject(signal.reason);signal.addEventListener('abort',listener,{once:true})})])}finally{signal.removeEventListener('abort',listener);signal.throwIfAborted()}}

export async function runAllegionNative({signal,now}){
 let cookie='',csrf=''
 async function request(url,body){
  const headers={Accept:body?'application/json':url===BOARD?'text/html':'text/html,application/json','User-Agent':'Mozilla/5.0',...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...(body&&csrf?{'x-calypso-csrf-token':csrf}:{})}
  return bounded(signal,async()=>{
   const response=await fetch(url,{method:body?'POST':'GET',headers,...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal})
   check(response.status===200&&response.url===url,'Native HTTP status or final URL failure')
   if(url===BOARD){const set=response.headers.getSetCookie?.()||[];cookie=set.map(v=>v.split(';')[0]).join('; ');csrf=set.find(v=>v.startsWith('CALYPSO_CSRF_TOKEN='))?.split(';')[0].slice('CALYPSO_CSRF_TOKEN='.length)||''}
   return await response.text()
  })
 }
 // Bootstrap anonymous public session only; never log cookies or CSRF values.
 const shell=await request(BOARD);check(shell.length>100&&shell.length<2000000,'Native public session shell missing')
 async function enumerate(){
  const rows=[],paths=new Set(),reqs=new Set();let total=null,pages=0
  do{
   check(pages<MAX_PAGES,'Native page bound exhausted')
   const data=JSON.parse(await request(API+'/jobs',{appliedFacets:FACETS,limit:PAGE,offset:rows.length,searchText:''}))
   check(!hasFailure(data)&&Number.isSafeInteger(data.total)&&data.total>=0&&data.total<=MAX_PAGES*PAGE&&Array.isArray(data.jobPostings),'Native listing envelope/count malformed')
   const selected=[]
   const inspect=value=>{if(!object(value))return;if(value.facetParameter==='locations'){check(Array.isArray(value.values),'Native location facets malformed');selected.push(...value.values.filter(v=>v?.id===BANGALORE))}if(Array.isArray(value.values))value.values.forEach(inspect)}
   check(Array.isArray(data.facets),'Native facets unavailable');data.facets.forEach(inspect)
   check(selected.length===1&&selected[0].descriptor==='Bangalore, India'&&selected[0].count===data.total,'Native selected Bangalore facet identity/count changed')
   total??=data.total;check(total===data.total,'Native listing count drift')
   check(data.jobPostings.length===Math.min(PAGE,total-rows.length),'Native listing truncated or overfull')
   for(const row of data.jobPostings){
    check(typeof row.title==='string'&&row.title.trim()&&typeof row.externalPath==='string'&&/^\/job\/[^?#]+_JR\d+$/.test(row.externalPath),'Native listing identity unavailable')
    check(Array.isArray(row.bulletFields)&&row.bulletFields.length===1&&/^JR\d+$/.test(row.bulletFields[0])&&row.externalPath.endsWith('_'+row.bulletFields[0]),'Native listing requisition mismatch')
    requireBangalore(row.locationsText)
    check(!paths.has(row.externalPath)&&!reqs.has(row.bulletFields[0]),'Duplicate native listing identity');paths.add(row.externalPath);reqs.add(row.bulletFields[0]);rows.push(row)
   }
   pages++
  }while(rows.length<total)
  return{rows,total,pages}
 }
 const first=await enumerate(),details=new Map(),uidOwners=new Map()
 for(const row of first.rows){
  const payload=JSON.parse(await request(API+row.externalPath)),v=verifyDetail(payload,row)
  check(!uidOwners.has(v.id),'Duplicate native posting UID across requisitions');uidOwners.set(v.id,v.jobReqId);details.set(v.jobReqId,payload)
 }
 const final=await enumerate()
 check(first.total===final.total&&first.pages===final.pages&&JSON.stringify(first.rows.map(r=>[r.externalPath,r.title,r.locationsText,r.bulletFields]))===JSON.stringify(final.rows.map(r=>[r.externalPath,r.title,r.locationsText,r.bulletFields])),'Native final listing identity/count drift')
 const jobs=[]
 for(const row of final.rows){
  const payload=JSON.parse(await request(API+row.externalPath)),v=verifyDetail(payload,row),prior=details.get(v.jobReqId)
  check(prior&&prior.jobPostingInfo.id===v.id&&uidOwners.get(v.id)===v.jobReqId,'Native posting UID changed across detail passes')
  check(stableDetail(prior)===stableDetail(payload),'Native detail fields changed across passes')
  const d=extractWorkdayStructuredDetail(payload);check(d,'Native description mapping unavailable')
  const location=row.locationsText,locations=d.indiaScopeLocations||d.locations
  check(Array.isArray(locations)&&locations.length>0,'Native locations unavailable');locations.forEach(requireBangalore)
  const inventory={site:'careers',tenant:'allegion',scope:'configured-native-location-subset',appliedFacets:FACETS,reportedTotal:first.total,observedIndia:first.total,pagesFetched:first.pages,stableReportedTotal:true,explicitGlobalEmpty:false}
  jobs.push({jobId:v.jobReqId,title:v.title,company:'Allegion',department:d.department,location,city:location.split(',')[0].trim(),locations,link:v.externalUrl,source:'allegion',postedAt:date(v.startDate,now(),true),closingDate:v.endDate==null?null:date(v.endDate,now()),jobDescription:toPlainText(v.jobDescription),sourceDetailComplete:true,minimumQualification:d.minimumQualification,preferredQualification:d.preferredQualification,requiredSkills:d.requiredSkills,experienceRequired:d.experienceRequired,publicExperienceChecked:true,requisitionId:v.jobReqId,scrapedAt:now(),country:'India',sourceUrl:v.externalUrl,applyUrl:v.externalUrl,sourceClosingDateIsExact:false,sourceDescription:v.jobDescription,nativeEmployer:payload.hiringOrganization.name,nativeBoardProvenance:[{site:'careers',tenant:'allegion',nativePostingUid:v.id,requisitionId:v.jobReqId,canonicalUrl:v.externalUrl,nativeEmployer:payload.hiringOrganization.name}],sourceListingComplete:false,sourceGlobalJobCount:null,sourceBoardInventories:[inventory],sourceBoardDuplicateCount:0,sourceObservedIndiaJobCount:first.total})
 }
 signal.throwIfAborted()
 return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD+'?locations='+BANGALORE,firstParty:true,listingComplete:false,pagesFetched:first.pages,reportedTotal:null,indiaFacetCount:null,verifiedAt:now(),reason:'official-native-Bangalore-facet-other-India-mixed-employer-role-and-company-coverage-unresolved'})
}
