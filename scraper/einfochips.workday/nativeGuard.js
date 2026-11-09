import {extractOfficialRecruitmentLinks} from '../../scripts/officialRecruitmentLinks.js'
import {workdaySections,activeArrowModel,extractActiveDescription} from './nativeContent.js'
export const CORPORATE='https://www.einfochips.com/careers/',ARROW='https://careers.arrow.com/us/en/search-results?keywords=einfochips',BOARD='https://arrow.wd1.myworkdayjobs.com/AC',API='https://arrow.wd1.myworkdayjobs.com/wday/cxs/arrow/AC/jobs',INDIA='c4f78be1a8f14da0ab49ce1162348a5e'
const proof=(ok,message)=>{if(!ok)throw new Error('eInfochips native guard: '+message)}
const norm=s=>typeof s==='string'?s.replace(/\s+/g,' ').trim():''
// Current native primary offices carry explicit India country objects. Exact
// secondary labels are corroborated by the same current native office catalog;
// a new unknown office must be reviewed instead of defaulted to India.
// R249865's current exact primary descriptor is also independently typed IN
// by jobRequisitionLocation.country (retained in the 2026-11-07 regression).
const INDIA_OFFICES=new Set(['Ahmedabad, India','Bangalore, India','Bangalore, Karnataka','Pune, India','Noida, India','Hyderabad, Kondapur','Pune, Blue Ridge-Hinjewadi','IN-MP-Indore, India-Vijaynagar (eInfochips)','IN-TN-Chennai, India-OMR Road (eInfochips)','X-DoNotUse-IN-MH-Pune, India-Baner (eInfochips)'])
function dates(value,now,publication=false){proof(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value),'Native date unavailable');const n=new Date(value+'T00:00:00.000Z');proof(Number.isFinite(n.getTime())&&n.toISOString().slice(0,10)===value,'Invalid native calendar');proof(!publication||n.getTime()<=Date.parse(now),'Future native publication');return n.toISOString()}
function canonical(value){proof(typeof value==='string','Native canonical unavailable');const u=new URL(value);proof(u.origin==='https://arrow.wd1.myworkdayjobs.com'&&!u.search&&!u.hash&&!u.username&&!u.password&&/^\/(?:en-US\/)?AC\/job\/[^/]+\/[^/]+_R\d+(?:-\d+)?$/.test(u.pathname),'Native board canonical mismatch');return u.origin+u.pathname.replace('/en-US/AC/','/AC/')}
export function verifyCurrentHandoff(corporate,arrow){
 proof(extractOfficialRecruitmentLinks(corporate,CORPORATE).some(l=>l.href===ARROW),'Current corporate keyword handoff unavailable')
 const model=activeArrowModel(arrow),matches=[]
 function walk(value){if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach(walk);return}if(typeof value.applyUrl==='string'&&typeof value.title==='string'){const url=value.applyUrl.replace(/\/apply$/,'');try{if(canonical(url)&&/einfochips/i.test([value.title,value.descriptionTeaser,value.cityStateCountry].join(' ')))matches.push({title:value.title,applyUrl:value.applyUrl})}catch{}}
  Object.values(value).forEach(v=>{if(v&&typeof v==='object')walk(v)})}
 walk(model);proof(matches.length>0,'Current native eInfochips role apply handoff unavailable')
 return{board:BOARD,mode:'active-corporate-href-and-native-public-Arrow-model-apply-links',roleHandoffs:matches}
}
export function validateNativeDetail(payload,job,{now=new Date().toISOString()}={}){
 proof(payload&&typeof payload==='object'&&!Array.isArray(payload),'Malformed native response')
 for(const key of ['error','Error','errors','Errors','message','Message'])if(payload[key]!=null)proof(payload[key]===''||(Array.isArray(payload[key])&&payload[key].length===0),'Native error envelope')
 for(const key of ['success','Success'])if(payload[key]!=null)proof(payload[key]===true,'Native failure envelope')
 for(const key of ['status','Status','statusCode','StatusCode'])if(payload[key]!=null)proof(payload[key]===200,'Native failure status')
 const info=payload.jobPostingInfo,employer=payload.hiringOrganization?.name
 proof(info&&typeof info.id==='string'&&/^[a-f\d]{32}$/.test(info.id)&&info.jobPostingSiteId==='AC','Native board/UID mismatch')
 proof(typeof info.jobReqId==='string'&&info.jobReqId===job.requisitionId&&info.title===job.title,'Native requisition/title mismatch')
 proof(info.posted===true&&info.canApply===true,'Native public apply status unavailable')
 proof(canonical(info.externalUrl)===canonical(job.link)&&info.jobPostingId===new URL(info.externalUrl).pathname.split('/').at(-1),'Native canonical identity mismatch')
 proof(info.country?.descriptor==='India'&&info.country?.id===INDIA&&info.jobRequisitionLocation?.country?.descriptor==='India'&&info.jobRequisitionLocation.country.id===INDIA&&info.jobRequisitionLocation.country.alpha2Code==='IN','Native country mismatch')
 proof(info.location===info.jobRequisitionLocation.descriptor&&Array.isArray(job.locations)&&job.locations.some(l=>l===info.location||l===info.location+', India'),'Native primary location mismatch')
 proof(info.additionalLocations==null||Array.isArray(info.additionalLocations),'Native secondary location malformed')
 const locations=[info.location,...(info.additionalLocations||[])];proof(locations.every(l=>typeof l==='string'&&INDIA_OFFICES.has(l)),'Unverified or conflicting native office location')
 const uniqueLocations=[...new Set(locations)]
 proof(uniqueLocations.length===job.locations.length&&uniqueLocations.every((l,i)=>job.locations[i]===l||job.locations[i]===l+', India'),'Mapped/native secondary locations mismatch')
 proof(job.location===job.locations.join(' / '),'Mapped singular location disagrees with native offices')
 const expectedCity=info.location.split(',')[0].replace(/^(?:X-DoNotUse-)?IN-[A-Z]{2}-/,'')
 proof(job.city===expectedCity,'Mapped city disagrees with native primary office')
 proof(typeof info.jobDescription==='string','Native full description field unavailable')
 const sections=workdaySections(info.jobDescription);proof(norm(sections['position:'])===norm(info.title),'Native description title mismatch')
 proof(typeof employer==='string'&&(!employer.trim()||/^eInfochips(?:\s+Private)?\s+Limited$/i.test(employer.trim())),'Native employer mismatch')
 if(!employer.trim())proof(/\(eInfochips\)\s*$/i.test(sections['location:'])&&/^IN-[A-Z]{2}-/.test(sections['location:']),'Native employer brand corroboration unavailable')
 const description=extractActiveDescription(sections['job description:']),postedAt=dates(info.startDate,now,true),closingDate=info.endDate==null?null:dates(info.endDate,now)
 return{...job,jobId:info.jobReqId,country:'India',nativeLocations:uniqueLocations,sourceUrl:info.externalUrl,applyUrl:info.externalUrl+'/apply',link:info.externalUrl+'/apply',postedAt,postingDate:postedAt,closingDate,sourceClosingDateIsExact:false,nativeEmployer:employer.trim()||null,sourceEmployerProof:employer.trim()?'native-hiring-organization':'official-keyword-handoff-and-native-branded-location',jobDescription:description?extractActiveDescription(info.jobDescription):null,sourceDescription:description?info.jobDescription:null,sourceDetailComplete:Boolean(description),sourceDetailStatus:description?'complete':'native-job-description-section-empty',sourceListingComplete:false,sourceNativePostingUid:info.id}
}
