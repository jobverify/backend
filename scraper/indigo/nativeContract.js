import crypto from 'node:crypto'
import {extractOfficialRecruitmentLinks} from '../../scripts/officialRecruitmentLinks.js'
import {readNativeDocument,extractActiveDescription} from './nativeHtml.js'
export const CORPORATE='https://www.goindigo.in/careers.html',BOARD='https://www.goindigo.in/careers/job-search.html',API='https://ms-careers-prod.goindigo.in/career-job-list'
export const REMOTE_ENTRY='https://mf-careers-prod.goindigo.in/job-search/remoteEntry.js',APP='https://mf-careers-prod.goindigo.in/job-search/360bc222f5c79ce20fd72ec.js'
const CLIENT_HASHES=['b7ca780e3d7c5cb3cc40ec3ff2798b3451fca317b9a7d7d0b1348ed3ca16838d','d6f35e328bf5c9222a4c08f23a26bff935f58e6552645c8960b282e5f77a73ae']
const APPLY_PREFIX='https://career-in10.hr.cloud.sap/careers?company=interglobe&correlation_Id=38774994&lang=en_GB&clientId=jobs2web&socialApply=false&career_ns=job_application&site=&career_job_req_id='
const APPLY_SUFFIX='&jobPipeline=Direct&isInternalUser=false&showAlertCreated=false'
const check=(ok,message)=>{if(!ok)throw new Error('Indigo native contract: '+message)}
export class IndigoUnsupportedOfficeError extends Error{
 constructor(offices){super('Indigo native contract: Unsupported native office requires country review');this.code='INDIGO_UNSUPPORTED_NATIVE_OFFICE';this.offices=offices}
}
const norm=x=>typeof x==='string'?x.replace(/\s+/g,' ').trim():''
const meaningfulDescription=value=>{
 const description=extractActiveDescription(value)
 if(!description)return null
 const remaining=description.replace(/\b(?:job\s+description\s+sample|sample\s+(?:job\s+)?description|test\s+description|job\s+description|apply\s+now|read\s+more|coming\s+soon)\b/gi,'')
 return /[\p{L}\p{N}]/u.test(remaining)?description:null
}
const obj=x=>x&&typeof x==='object'&&!Array.isArray(x)
const activeScript=n=>n.tag==='script'&&!Object.hasOwn(n.attrs,'nomodule')&&[undefined,'','text/javascript','application/javascript'].includes(n.attrs.type)
export function verifyIndigoBinding(corporate,board,remoteEntry,app){
 check(extractOfficialRecruitmentLinks(corporate,CORPORATE).some(l=>{const u=new URL(l.href);return u.origin==='https://www.goindigo.in'&&u.pathname==='/careers/job-search.html'}),'Current first-party job-search handoff unavailable')
 const doc=readNativeDocument(board)
 check(doc.nodes(n=>n.attrs['data-component']==='mf-job-search').length===1,'Native public job-search component unavailable')
 check(doc.nodes(n=>activeScript(n)&&n.attrs.src&&new URL(n.attrs.src,BOARD).href===REMOTE_ENTRY).length===1,'Current executable native client unavailable')
 const scripts=doc.nodes(n=>activeScript(n)&&!n.attrs.src&&n.raw?.includes('_env_career_job_search'))
 check(scripts.length===1,'Native public configuration ambiguous or unavailable')
 // Accept only the actual static object assignment, not comments, dead branches,
 // a second assignment or executable expressions masquerading as native config.
 const match=scripts[0].raw.match(/^\s*window\._env_career_job_search\s*=\s*\{([\s\S]*?)\}\s*;\s*$/)
 check(match,'Native public configuration is not a static object')
 const property=/\s*([A-Z][A-Z0-9_]*)\s*:\s*(['"])([^'"\\\r\n]*)\2\s*(,|$)/gy,config={};let pos=0
 while(pos<match[1].length){property.lastIndex=pos;const part=property.exec(match[1]);if(!part){check(!match[1].slice(pos).trim(),'Malformed native public configuration');break}check(!Object.hasOwn(config,part[1]),'Duplicate native configuration field');config[part[1]]=part[3];pos=property.lastIndex}
 check(config.CAREER_JOB_SEARCH_RESULT_LIST===API&&config.CAREER_APPLY_NOW_URL===APPLY_PREFIX,'Native endpoint or company apply binding changed')
 check(typeof config.CAREER_MS==='string'&&config.CAREER_MS.length>=10&&config.CAREER_MS.length<=256,'Native public client header unavailable')
 for(const [i,body]of [remoteEntry,app].entries())check(typeof body==='string'&&crypto.createHash('sha256').update(body).digest('hex')===CLIENT_HASHES[i],'Current native all-response pagination/apply client changed')
 return{api:API,applyUrlPrefix:APPLY_PREFIX,userKey:config.CAREER_MS,enumeration:'current-public-client-one-GET-and-local-array-slicing',nativeApplySuffix:APPLY_SUFFIX}
}
function sapDate(value,now,publication=false){
 check(typeof value==='string'&&/^\/Date\(\d{1,15}\)\/$/.test(value),'Native date unavailable or malformed')
 const n=Number(value.slice(6,-2));check(Number.isSafeInteger(n)&&n>=0&&n<=8640000000000000,'Native date invalid');const date=new Date(n);check(Number.isFinite(date.getTime()),'Native date invalid');check(!publication||n<=Date.parse(now),'Future native publication');return date.toISOString()
}
function countryFields(row){for(const [k,value]of Object.entries(row))if(['country','countrycode','country_code','addresscountry'].includes(k.toLowerCase())&&value!=null)check(typeof value==='string'&&['India','IN'].includes(value),'Conflicting or malformed native country')}
function locations(row){
 countryFields(row);check(obj(row.location_obj)&&Array.isArray(row.location_obj.results)&&row.location_obj.results.length>0,'Native office scope unavailable')
 const offices={'Pan-India':'Pan-India',BOM:'Mumbai',CORP:'Gurgaon',HBX:'Hubli',CCU:'Kolkata',MAA:'Chennai',BLR:'Bengaluru'},names=[],codes=new Set(),unsupported=[]
 for(const l of row.location_obj.results){
  check(obj(l)&&typeof l.externalCode==='string'&&l.externalCode===norm(l.externalCode)&&l.externalCode.length>0&&typeof l.name==='string'&&l.name===norm(l.name)&&l.name.length>0,'Malformed native office')
  countryFields(l);check(!names.includes(l.name)&&!codes.has(l.externalCode),'Duplicate native office');names.push(l.name);codes.add(l.externalCode)
  if(!Object.hasOwn(offices,l.externalCode)){check(!Object.values(offices).includes(l.name),'Unknown or conflicting native office');unsupported.push({externalCode:l.externalCode,name:l.name})}
  else check(offices[l.externalCode]===l.name,'Unknown or conflicting native office')
 }
 // An unknown office supplies no country. Validate every returned office
 // before exposing this precise, source-owned hold condition.
 if(unsupported.length)throw new IndigoUnsupportedOfficeError(unsupported)
 const nativeLocations=names.map(name=>name==='Pan-India'?name:name+', India')
 return{country:'India',city:names.length===1&&names[0]!=='Pan-India'?names[0]:null,location:nativeLocations.join(' / '),locations:nativeLocations,nativeOffices:row.location_obj.results.map(l=>({name:l.name,externalCode:l.externalCode}))}
}
function envelope(payload){
 check(obj(payload),'Malformed public inventory envelope')
 for(const [k,value]of Object.entries(payload)){
  if(['error','errors'].includes(k.toLowerCase())&&value!=null)check(value===''||Array.isArray(value)&&value.length===0,'Native error envelope')
  if(k.toLowerCase()==='success'&&value!=null)check(value===true,'Native failure envelope')
  if(['status','statuscode'].includes(k.toLowerCase())&&value!=null)check(value===200,'Native failure status')
 }
 check(payload.status===200&&payload.message==='Jobs list'&&Array.isArray(payload.result)&&payload.result.length<=500,'Native all-jobs inventory unavailable')
 for(const k of ['total','totalCount','count'])if(payload[k]!=null)check(typeof payload[k]==='number'&&Number.isSafeInteger(payload[k])&&payload[k]===payload.result.length,'Native count contradicts complete response')
 for(const k of ['next','nextPage','hasMore','continuationToken'])if(payload[k]!=null)check(payload[k]===false||payload[k]===0||payload[k]==='','Unexpected native continuation')
}
export function readIndigoJobs(payload,{now=new Date().toISOString(),config,onUnsupportedOffice}={}){
 envelope(payload);check(config?.api===API&&config.applyUrlPrefix===APPLY_PREFIX&&config.nativeApplySuffix===APPLY_SUFFIX,'Verified native config required');check(Number.isFinite(Date.parse(now)),'Invalid observation time')
 const seen=new Set()
 return payload.result.map(row=>{
  check(obj(row)&&typeof row.jobReqId==='string'&&/^[1-9]\d*$/.test(row.jobReqId)&&Number.isSafeInteger(Number(row.jobReqId))&&!seen.has(row.jobReqId),'Duplicate or malformed native job identity');seen.add(row.jobReqId)
  check(row.deleted==='Not Deleted','Native deleted status unknown');check(row.legalEntity_obj?.externalCode==='1000'&&row.legalEntity_obj?.name==='InterGlobe Aviation limited','Native legal employer identity mismatch')
  const status=row.status?.results;check(Array.isArray(status)&&status.length===1&&status[0].externalCode==='Open'&&status[0].status==='ACTIVE'&&status[0].mdfExternalCode==='Open','Native active-public status unavailable')
  let geo,officeError
  try{geo=locations(row)}catch(error){if(!(error instanceof IndigoUnsupportedOfficeError))throw error;officeError=error}
  const postings=row.jobReqPostings?.results;check(Array.isArray(postings)&&postings.every(obj),'Native public posting unavailable')
  const external=postings.filter(p=>p.boardId==='_external');check(external.length===1,'Expected one explicit native public external posting');const posting=external[0]
  check(posting.jobReqId===row.jobReqId&&['Success','Updated'].includes(posting.postingStatus),'Native public posting identity/status mismatch')
  const postedAt=sapDate(posting.postStartDate,now,true),closingDate=sapDate(posting.postEndDate,now);check(Date.parse(closingDate)>=Date.parse(postedAt),'Native date ordering invalid')
  const locales=row.jobReqLocale?.results;check(Array.isArray(locales)&&locales.length>0&&locales.length<=10,'Native locale details unavailable')
  const details=locales.map(l=>{check(obj(l)&&typeof l.externalTitle==='string'&&norm(l.externalTitle).length>2&&!/[<>]|&(?:lt|gt);|&#(?:0*60|0*62|x0*3c|x0*3e);/i.test(l.externalTitle)&&(l.externalJobDescription==null||typeof l.externalJobDescription==='string'),'Malformed native role title/description');return{title:norm(l.externalTitle),description:meaningfulDescription(l.externalJobDescription)}})
  check(details.every(d=>d.title===details[0].title&&d.description===details[0].description),'Conflicting returned native locale title/full description')
  const {title,description}=details[0],url=config.applyUrlPrefix+row.jobReqId+config.nativeApplySuffix
  // Do not let office quarantine conceal employer, identity, active status,
  // posting, date or locale errors. Those validations remain fatal above.
  if(officeError){if(typeof onUnsupportedOffice!=='function')throw officeError;onUnsupportedOffice({jobId:row.jobReqId,title,offices:officeError.offices,reason:'unsupported-native-office',sourceDetailComplete:Boolean(description)});return null}
  return{source:'indigo',company:'IndiGo',jobId:row.jobReqId,requisitionId:row.jobReqId,title,...geo,nativeEmployer:row.legalEntity_obj.name,nativeEmployerCode:row.legalEntity_obj.externalCode,nativeLocaleCount:locales.length,nativePostingBoard:posting.boardId,nativePostingStatus:posting.postingStatus,applyUrl:url,link:url,sourceUrl:url,postedAt,postingDate:postedAt,closingDate,sourceClosingDateIsExact:true,jobDescription:description,sourceDescription:description,sourceDetailComplete:Boolean(description),sourceDetailStatus:description?'complete':'native-full-description-missing-or-placeholder',sourceListingComplete:false,scrapedAt:now}
 }).filter(Boolean)
}
