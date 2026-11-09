import {buildWorkdayAppliedFacets,buildWorkdayDetailApiUrl,extractWorkdayStructuredDetail} from '../../scraper-support/myworkday/engine.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {EMPLOYER_PATTERN,BOARD,validateCarrierMappedJobs} from './nativeBinding.js'
import {readNativeDocument} from './nativeHtml.js'
export const API='https://carrier.wd5.myworkdayjobs.com/wday/cxs/carrier/jobs/jobs',INDIA='c4f78be1a8f14da0ab49ce1162348a5e'
const check=(ok,message)=>{if(!ok)throw Error('Carrier native CXS: '+message)},space=x=>String(x).replace(/\s+/g,' ').trim(),object=x=>x&&typeof x==='object'&&!Array.isArray(x)
const failure=value=>!object(value)||Object.entries(value).some(([key,v])=>{
 const k=key.toLowerCase().replace(/[_\s-]/g,'')
 if(['error','errors','errorcode','errormessage','exception','fault'].includes(k))return true
 if(k==='success')return v!==true
 if(['status','statuscode','httpstatus','httpstatuscode'].includes(k))return !((typeof v==='string'||typeof v==='number')&&['200','ok','success','successful'].includes(String(v).toLowerCase()))
 return ['meta','metadata','response','result'].includes(k)&&v!=null&&failure(v)
})
const date=(v,now,publication=false)=>{check(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v),'native calendar date missing');const d=new Date(v+'T00:00:00.000Z');check(Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v,'invalid native calendar date');check(!publication||d.getTime()<=Date.parse(now),'future native publication');return d.toISOString()}
const country=c=>object(c)&&c.id===INDIA&&c.descriptor==='India'&&(c.alpha2Code==null||c.alpha2Code==='IN')
// Only explicit country segments contradict the independently typed India country.
// Do not infer a city from a street address or treat ambiguous Indian state codes as countries.
const codes='AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ')
const indiaStates=new Set('AN AP AR AS BR CG CH DD DL DN GA GJ HP HR JH JK KA KL LA LD MH ML MN MP MZ NL OD OR PB PY RJ SK TN TR TS UK UP UT WB'.split(' ')),names=new Intl.DisplayNames(['en'],{type:'region'}),foreign=new Set(codes.flatMap(c=>[names.of(c).toLowerCase(),...(!indiaStates.has(c)?[c.toLowerCase()]:[])]).concat(['usa','united states of america','uk','turkey','south korea','north korea']))
const escapeRegex=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
const countryNames=codes.map(c=>names.of(c)).concat(['United States of America','USA','U.S.A.','U.S.','UAE','Great Britain','Turkey','South Korea','North Korea'])
const countryNameMarker=new RegExp('(?:^|[^\\p{L}])(?:'+countryNames.map(escapeRegex).join('|')+')(?:$|[^\\p{L}])','iu')
const unambiguousCodes=codes.filter(c=>!indiaStates.has(c)).join('|')
// A leading office word such as IT Park is not an explicit country code.
// Codes require a standalone segment or punctuation-delimited country format.
const countryCodeMarker=new RegExp('(?:^(?:'+unambiguousCodes+')(?:$|\\s*[,;:|()/.-])|(?:^|[,;:|()/.-])\\s*(?:'+unambiguousCodes+')$)','i')
const office=label=>{check(typeof label==='string'&&label.trim()&&label.length<2000,'native office missing');check(!/\b(?:worldwide|anywhere|global remote|unspecified|unknown)\b/i.test(label),'native office scope unknown');check(!countryNameMarker.test(label)&&!countryCodeMarker.test(label.replace(/^No\.?\s*(?=\d)/i,'building-number '))&&!label.split(/[,;|()]/).some(s=>foreign.has(s.trim().toLowerCase())&&!indiaStates.has(s.trim().toUpperCase())),'native office country contradicts typed India country');return label}
function canonical(value){check(typeof value==='string','native canonical missing');const u=new URL(value);check(u.origin===new URL(BOARD).origin&&!u.search&&!u.hash&&!u.username&&!u.password&&/^\/jobs\/job\/[^/]+\/[^/]+_\d{5,}(?:-\d+)?$/.test(u.pathname),'native canonical board mismatch');return u.href}
function listing(row){check(object(row)&&typeof row.title==='string'&&row.title.trim()&&Array.isArray(row.bulletFields)&&row.bulletFields.length===1&&typeof row.bulletFields[0]==='string'&&/^\d{5,}$/.test(row.bulletFields[0]),'native listing identity missing');check(typeof row.externalPath==='string'&&/^\/job\/[^/]+\/[^/]+_\d{5,}(?:-\d+)?$/.test(row.externalPath),'native listing path invalid');const url=canonical(BOARD+row.externalPath);check(url.match(/_(\d+)(?:-\d+)?$/)?.[1]===row.bulletFields[0],'native listing requisition disagrees');check(typeof row.locationsText==='string'&&row.locationsText.trim(),'native listing location missing');return{row,url,id:row.bulletFields[0]}}
export function validateCarrierDetail(payload,listed,now,indiaOffices=new Set()){
 check(!failure(payload),'native detail error envelope');const j=payload.jobPostingInfo,e=payload.hiringOrganization?.name
 check(object(j)&&typeof j.id==='string'&&/^[a-f0-9]{32}$/.test(j.id)&&j.jobReqId===listed.id&&j.title===listed.row.title&&j.jobPostingSiteId==='jobs','native detail identity changed')
 check(j.canApply===true&&j.posted===true,'native role is not active and publicly applicable')
 check(canonical(j.externalUrl)===listed.url&&j.jobPostingId===new URL(listed.url).pathname.split('/').at(-1),'native canonical/apply identity changed')
 check(typeof e==='string'&&EMPLOYER_PATTERN.test(e),'native legal employer changed')
 check(country(j.country)&&country(j.jobRequisitionLocation?.country)&&j.jobRequisitionLocation.country.alpha2Code==='IN','native India countries missing or conflicting')
 const primary=office(j.location),structuredOffice=office(j.jobRequisitionLocation.descriptor)
 check(j.additionalLocations==null||Array.isArray(j.additionalLocations),'native secondary offices malformed');check(j.additionalLocationObjects==null,'unrecognized secondary country objects')
 const locations=[primary,...(j.additionalLocations||[]).map(label=>{office(label);check(/(?:,\s*|\s)India\s*$/i.test(label)||indiaOffices.has(space(label)),'secondary native office lacks explicit India scope');return label})]
 check(new Set(locations.map(space)).size===locations.length,'duplicate native offices')
 check(listed.row.locationsText===primary||listed.row.locationsText===locations.length+' Locations','native listing and detail offices disagree')
 const titleDoc=readNativeDocument(j.title);check(titleDoc.text(titleDoc.nodes(n=>n.tag==='root')[0])===space(j.title)&&!/[<>]/.test(j.title),'native title is not active plain text')
 const d=extractWorkdayStructuredDetail(payload);check(d&&typeof j.jobDescription==='string','full native description missing')
 return{...d,source:'carrier',company:'Carrier',jobId:j.jobReqId,requisitionId:j.jobReqId,title:j.title,link:j.externalUrl,sourceUrl:j.externalUrl,applyUrl:j.externalUrl,country:'India',city:null,location:primary,locations,nativePrimaryLocation:primary,nativeStructuredLocation:structuredOffice,nativeLocationDiscrepancy:structuredOffice===primary?null:{primary,structured:structuredOffice,scopeAgreement:'India'},nativePrimaryCountry:j.country,nativeStructuredCountry:j.jobRequisitionLocation.country,nativeEmployer:e,nativePostingUid:j.id,postedAt:date(j.startDate,now,true),closingDate:j.endDate==null?null:date(j.endDate,now),sourceClosingDateIsExact:false,sourceDescription:j.jobDescription,sourceDetailComplete:true,sourceListingComplete:false,sourceCompanyCoverageComplete:false,sourceScopeComplete:false,scrapedAt:now}
}
export async function runCarrierNative({binding,signal,now}){
 const detailsController=new AbortController();signal=AbortSignal.any([signal,detailsController.signal])
 const facets=buildWorkdayAppliedFacets(BOARD,INDIA,'location_Country')
 async function get(url,init={}){
  signal.throwIfAborted();const requestSignal=AbortSignal.any([signal,AbortSignal.timeout(25000)]);let listener
  try{return await Promise.race([(async()=>{const r=await fetch(url,{...init,signal:requestSignal,redirect:'error',headers:{Accept:'application/json','Content-Type':'application/json','User-Agent':'Mozilla/5.0'}});requestSignal.throwIfAborted();check(r.status===200&&r.url===url,'native HTTP status/final URL unavailable');const payload=await r.json();requestSignal.throwIfAborted();check(!failure(payload),'native error envelope');return payload})(),new Promise((_,reject)=>{listener=()=>reject(requestSignal.reason);requestSignal.addEventListener('abort',listener,{once:true})})])}finally{requestSignal.removeEventListener('abort',listener);signal.throwIfAborted()}
 }
 async function inventory(){let total=null,offset=0,pages=0;const rows=[],ids=new Set(),urls=new Set();do{
  const p=await get(API,{method:'POST',body:JSON.stringify({appliedFacets:facets,limit:20,offset,searchText:''})});check(Number.isSafeInteger(p.total)&&p.total>=0&&p.total<=500,'native total unavailable or bounded limit exceeded');if(total==null)total=p.total;else check(p.total===total||p.total===0,'native total drift')
  check(Array.isArray(p.jobPostings)&&p.jobPostings.length===Math.min(20,total-offset),'native page missing rows');for(const raw of p.jobPostings){const row=listing(raw);check(!ids.has(row.id)&&!urls.has(row.url),'duplicate native identity across pages');ids.add(row.id);urls.add(row.url);rows.push(row)}offset+=p.jobPostings.length;pages++
 }while(offset<total);check(rows.length===total,'native full inventory mismatch');return{rows,total,pages}}
 const initial=await inventory(),jobs=new Array(initial.rows.length),payloads=new Array(initial.rows.length);let next=0
 const workers=Array.from({length:Math.min(3,initial.rows.length)},async()=>{try{while(next<initial.rows.length){signal.throwIfAborted();const i=next++,row=initial.rows[i],url=buildWorkdayDetailApiUrl(row.url,API);check(url,'native detail URL unavailable');payloads[i]=await get(url)}}catch(error){detailsController.abort(error);throw error}})
 const settled=await Promise.allSettled(workers),failed=settled.find(x=>x.status==='rejected');if(failed)throw failed.reason
 const indiaOffices=new Set();for(const payload of payloads){const j=payload?.jobPostingInfo;if(country(j?.country)&&country(j?.jobRequisitionLocation?.country)&&j.jobRequisitionLocation.country.alpha2Code==='IN'){indiaOffices.add(space(office(j.location)));indiaOffices.add(space(office(j.jobRequisitionLocation.descriptor)))}}
 for(let i=0;i<payloads.length;i++)jobs[i]=validateCarrierDetail(payloads[i],initial.rows[i],now,indiaOffices)
 check(new Set(jobs.map(j=>j.nativePostingUid)).size===jobs.length,'duplicate native posting UID')
 const final=await inventory();check(initial.total===final.total&&JSON.stringify(initial.rows.map(r=>r.row))===JSON.stringify(final.rows.map(r=>r.row)),'native complete inventory changed on final recheck')
 validateCarrierMappedJobs(jobs,binding);signal.throwIfAborted()
 const inventories=[{tenant:'carrier',site:'jobs',scope:'india-country-facet',appliedFacets:facets,reportedTotal:initial.total,observedIndia:jobs.length,pagesFetched:initial.pages,stableReportedTotal:true,fullListingRechecked:true}]
 for(const j of jobs){j.sourceOfficialBinding=binding;j.sourceGlobalJobCount=null;j.sourceObservedIndiaJobCount=jobs.length;j.sourceBoardInventories=inventories;j.nativeBoardProvenance=[{tenant:'carrier',site:'jobs',nativePostingUid:j.nativePostingUid,requisitionId:j.requisitionId,canonicalUrl:j.link,nativeEmployer:j.nativeEmployer}]}
 return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,pagesFetched:initial.pages,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,reason:'verified-current-Carrier-native-India-country-facet-not-whole-company'})
}
