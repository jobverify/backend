import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {decodeHTML} from 'entities'
import {boundedDeclaredPublicGet} from '../../scraper-support/native-sources/boundedDeclaredPublicGet.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {canonicalNativeRecord} from '../../scraper-support/native-sources/collectCurrentOriginalRecords20261106.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readOriginalNativeCriteria} from '../../scraper-support/native-sources/currentNativeCriteria20261106.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {readSmartStreamJSON} from './currentNative.js'

const SOURCE='smartstreamtechnologies',BOARD='https://apply.workable.com/smartstream/'
const ACCOUNT='https://apply.workable.com/api/v1/accounts/smartstream?full=true'
const UID='fea2761c-b6ac-4917-bd56-2e96ddefe357',EMPLOYER='Smartstream Limited'
const DETAIL=code=>'https://apply.workable.com/api/v2/accounts/smartstream/jobs/'+code
const LIMITS={sourceTimeoutMs:240000,requestTimeoutMs:15000,maxRequests:160,maxRoles:32,maxEntityBytes:1024*1024,maxTotalBytes:16*1024*1024}
const fail=message=>firstPartyFailure(SOURCE,'Current declared Markdown: '+message)
const need=(ok,message)=>{if(!ok)throw fail(message)}
const same=(a,b)=>canonicalNativeRecord(a)===canonicalNativeRecord(b)
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const string=value=>typeof value==='string'&&value.length<=128000
const clean=value=>decodeHTML(String(value)).replace(/\\([\\`*_{}\[\]()#+.!|>~-])/g,'$1').trim()
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
const ignore=operation=>{try{Promise.resolve(operation()).catch(()=>{})}catch{}}
const byteLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get
const plain=value=>decodeHTML(value).normalize('NFKC').replace(/[\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g,'').replace(/\s+/g,' ').trim()
function markdownCriteria(text){
 const start=text.indexOf('\n## Description\n'),end=text.lastIndexOf('\n## Apply\n')
 if(start<0||end<=start)return null
 return plain(text.slice(start+1,end).replace(/^## (?:Description|Requirements|Benefits)\s*$/gm,'')
  .replace(/^#{1,6}\s+/gm,'').replace(/^\s*(?:[-+*]|\d+[.)])\s+/gm,'').replace(/\*\*|__|`/g,'')
  .replace(/(?<!\w)_([^_]+)_(?!\w)/g,'$1').replace(/(?<!\w)\*([^*]+)\*(?!\w)/g,'$1')
  .replace(/\\([\\`*_{}\[\]()#+.!|>~-])/g,'$1'))
}

// The board declares its first-party text discovery feed. Its public search
// documentation declares the country query, and each row declares its own
// full criteria and application link. No third-party script is executed.
function discovery(html){
 const document=readNativeDocument(html)
 const links=document.nodes(node=>node.tag==='link'&&!node.inert)
 need(links.filter(node=>node.attrs.rel==='canonical'&&node.attrs.href===BOARD).length===1,'native board canonical changed')
 const alternates=links.filter(node=>node.attrs.rel==='alternate'&&node.attrs.type==='text/plain'&&node.attrs.title==='LLMs')
 need(alternates.length===1&&alternates[0].attrs.href===BOARD+'llms.txt','native board text feed is missing or ambiguous')
 return alternates[0].attrs.href
}
function feedURL(text){
 need(text.startsWith('# '+EMPLOYER+' Careers\n'),'native discovery employer changed')
 const urls=[...text.matchAll(/`(https:\/\/apply\.workable\.com\/smartstream\/jobs\.md)`/g)]
 need(urls.length===1,'native full jobs feed declaration is ambiguous')
 return urls[0][1]
}
function filteredURL(text,url){
 need(text.startsWith('# '+EMPLOYER+' \u2014 Open Positions\n')
  &&text.includes('Send a **GET** request to `'+url+'`')&&text.includes('location[0][country]')
  &&text.includes('All parameters are optional.'),'native read-only country search declaration changed')
 const filtered=new URL(url);filtered.searchParams.set('location[0][country]','India');return filtered.href
}
function columns(line){
 const result=[];let cell='',escaped=false
 for(const character of line.slice(1,-1)){
  if(character==='|'&&!escaped){result.push(clean(cell));cell=''}else cell+=character
  escaped=character==='\\'&&!escaped
 }
 result.push(clean(cell));return result
}
export function readCurrentSmartStreamFeed(text){
 need(text.startsWith('# '+EMPLOYER+' \u2014 All Open Positions\n'),'native filtered feed employer changed')
 const lines=text.split(/\r?\n/),tables=lines.filter(line=>line.startsWith('|'))
 need(tables.length>=2&&tables.length<=5002,'native jobs table is absent or excessive')
 need(same(columns(tables[0]),['Title','Department','Location','Type','Salary','Posted','Details'])
  &&columns(tables[1]).length===7&&columns(tables[1]).every(value=>/^[-:]+$/.test(value)),'native jobs table schema changed')
 const seen=new Set()
 return tables.slice(2).map(line=>{
  const cells=columns(line)
  need(cells.length===7,'native role table columns changed')
  const [title,department,location,type,salary,posted,details]=cells
  const link=/^\[View\]\((https:\/\/apply\.workable\.com\/smartstream\/jobs\/view\/([A-F0-9]{10})\.md)\)$/.exec(details)
  need(link&&title&&date(posted)&&!seen.has(link[2]),'native row identity, date or link is invalid or duplicated')
  seen.add(link[2])
  return {title,department,location,type,salary,posted,url:link[1],shortcode:link[2],originalLine:line}
 })
}
function markdownRole(text,row){
 const header=/^# ([^\r\n]+)\r?\n\r?\n> ([^\r\n]+) \u00b7 ([^\r\n]+) \u00b7 ([^\r\n]+) \u00b7 Posted (\d{4}-\d{2}-\d{2})\r?\n/.exec(text)
 need(header&&clean(header[1])===row.title&&header[2]===EMPLOYER,'native full Markdown role title or employer disagrees')
 need(clean(header[3])===row.location&&clean(header[4])===row.type&&header[5]===row.posted,'native full Markdown workplace, type or date disagrees')
 const applications=[...text.matchAll(/^## Apply\r?\n\r?\n\[Apply at Smartstream Limited\]\(([^\r\n)]+)\)\r?\n\r?\n---\r?\nPowered by \[Workable\]\(https:\/\/www\.workable\.com\)\s*$/gm)]
 need(applications.length===1&&applications[0][1]===BOARD+'j/'+row.shortcode+'/apply','native own application URL is absent or contradictory')
 need((text.match(/^## Apply$/gm)??[]).length===1,'native application declaration is ambiguous')
 const descriptionStart=text.indexOf('\n## Description\n')
 const metadataText=text.slice(header[0].length,descriptionStart<0?text.indexOf('\n## Apply\n'):descriptionStart)
 const metadata={}
 for(const [,name,value] of metadataText.matchAll(/^\*\*([^\r\n*]+):\*\* ([^\r\n]*)$/gm)){
  need(!Object.hasOwn(metadata,name),'native Markdown metadata is ambiguous');metadata[name]=clean(value)
 }
 return {originalMarkdown:text,applicationURL:applications[0][1],header:header[0],metadata}
}
function account(body){
 const record=readSmartStreamJSON(body)
 need(record.id===734687&&record.uid===UID&&record.name===EMPLOYER&&record.subdomain==='smartstream'
  &&record.url==='https://smart.stream/','native legal employer/account/official website changed')
 return record
}
export function qualifyCurrentSmartStreamRole(model,employer,observedAt){
 const {listing:row,markdown,detail:record}=model
 need(object(record)&&Number.isSafeInteger(record.id)&&record.id>0&&record.shortcode===row.shortcode
  &&record.title===row.title,'native complete role identity disagrees')
 need(record.accountUid===employer.uid&&employer.uid===UID,'native role employer account disagrees')
 need(record.state==='published'&&record.approvalStatus==='approved'&&record.isInternal===false,'native role publication is unapproved, internal or unpublished')
 const india=location=>object(location)&&location.country==='India'&&location.countryCode==='IN'&&string(location.city)
  &&(location.region==null||string(location.region))
 need(india(record.location)&&Array.isArray(record.locations)&&record.locations.length>0&&record.locations.length<=64
  &&record.locations.every(location=>india(location)&&location.hidden===false),'native primary or secondary country is not explicit India')
 const expectedLocation=record.location.city+', India'+(record.workplace==='hybrid'?' (Hybrid)':record.workplace==='remote'?' (Remote)':'')
 need(row.location===expectedLocation,'native feed workplace disagrees with full India role')
 need(typeof record.published==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(record.published)
  &&Number.isFinite(Date.parse(record.published))&&new Date(record.published).toISOString()===record.published
  &&record.published.slice(0,10)===row.posted&&Date.parse(record.published)<=Date.parse(observedAt),'native original publication date is invalid or future')
 need(['description','requirements','benefits'].every(name=>string(record[name])),'native full criteria fields are unavailable')
 need(Array.isArray(record.department)&&record.department.every(string),'native department model changed')
 const originalMarkdown=markdownRole(markdown,row)
 need(['on_site','hybrid','remote'].includes(record.workplace)&&originalMarkdown.metadata.Workplace===record.workplace,
  'native Markdown workplace and full role disagree')
 need(row.department===(record.department.join(', ')||'\u2014')
  &&(originalMarkdown.metadata.Department??'\u2014')===row.department,'native Markdown department and full role disagree')
 const types={full:'Full-time',part:'Part-time',contract:'Contract',temporary:'Temporary',internship:'Internship',volunteer:'Volunteer',other:'Other'}
 need(record.type==null?row.type==='\u2014':typeof record.type==='string'&&types[record.type]===row.type,
  'native Markdown employment type and full role disagree')
 need((originalMarkdown.metadata.Salary??'\u2014')===row.salary,'native Markdown salary and listing disagree')
 const combined=[record.description,record.requirements,record.benefits].filter(Boolean).join('\n')
 const criteria=readOriginalNativeCriteria(combined,fail)
 const closureText=decodeHTML([row.title,criteria.sourceDescription??combined,markdown].join('\n')).replace(/[*_`]/g,'')
 need(!/\b(?:(?:this\s+|the\s+)?(?:position|role|job|vacancy)\s+(?:(?:is|was|has\s+been)\s+)?(?:now\s+)?(?:closed|filled|expired|no\s+longer\s+available)|no\s+longer\s+accepting\s+applications|applications\s+(?:(?:are|have\s+been)\s+)?closed)\b/i.test(closureText)
  &&!/(?:^|[\s[(])(?:closed|filled|expired)(?:$|[\s\])])/i.test(row.title),'native role is explicitly closed')
 // Missing rich criteria remain explicit partial records under current policy.
 // When both complete native projections exist, a content contradiction is
 // withheld rather than choosing one silently. Original formats remain intact.
 const markdownText=markdownCriteria(markdown)
 if(criteria.sourceDetailComplete&&markdownText)need(markdownText===plain(criteria.sourceDescription),'native full Markdown and API criteria disagree')
 return {criteria,combined,originalMarkdown}
}

function readerFor(options){
 options.signal?.throwIfAborted()
 need(!options.fetchText&&!options.fetchJson,'body-only callbacks cannot qualify original HTTP data')
 const limits=Object.fromEntries(Object.entries(LIMITS).map(([name,maximum])=>{
  const value=options[name]??maximum;need(Number.isSafeInteger(value)&&value>0&&value<=maximum,'invalid '+name+' ceiling');return[name,value]
 }))
 const signal=AbortSignal.any([...(options.signal?[options.signal]:[]),AbortSignal.timeout(limits.sourceTimeoutMs)])
 const originalResponses=[];let totalBytes=0
 const check=()=>{options.signal?.throwIfAborted();signal.throwIfAborted()}
 return {limits,check,originalResponses,async read(url,phase,kind){
  check();need(originalResponses.length<limits.maxRequests,'native request budget exceeded')
  const receipt={requestedUrl:url,phase,method:'GET',requestedAt:new Date().toISOString(),bodyComplete:false}
  originalResponses.push(receipt)
  const page=await boundedDeclaredPublicGet(url,{signal,timeoutMs:limits.requestTimeoutMs,overflowError:fail('original entity streaming ceiling exceeded'),fetchImpl:async(requested,init)=>{
   check();let response
   try{
    if(options.fetchPage){
     const supplied=await options.fetchPage(requested,init);check()
     need(supplied?.bodyUnavailable!==true&&Number.isInteger(supplied?.status)&&object(supplied.headers)
      &&typeof supplied.bodyBase64==='string'&&supplied.bodyBase64.length<=Math.ceil(limits.maxEntityBytes/3)*4
      &&supplied.redirected===false,'original entity bytes or HTTP metadata unavailable')
     const bytes=Buffer.from(supplied.bodyBase64,'base64')
     need(bytes.toString('base64')===supplied.bodyBase64,'original native base64 is invalid')
     response=new Response(bytes,{status:supplied.status,headers:supplied.headers})
     Object.defineProperty(response,'url',{value:supplied.url??supplied.finalUrl})
    }else response=await (options.fetchImpl??fetch)(requested,{...init,credentials:'omit',cache:'no-store'})
    check()
    need(response&&Number.isInteger(response.status)&&typeof response.url==='string'&&typeof response.headers?.get==='function','original Response metadata unavailable')
    Object.assign(receipt,{status:response.status,url:response.url,redirected:response.redirected,contentType:response.headers.get('content-type')??''})
    need(response.status===200&&response.url===url&&response.redirected===false,'native HTTP status, final URL or redirect changed')
    const mime=receipt.contentType.split(';')[0].trim().toLowerCase()
    need(kind==='html'?mime==='text/html':kind==='json'?mime==='application/json':['text/markdown','text/plain'].includes(mime),'native original MIME is unqualified')
    let entityBytes=0
    const body=response.body
    return {status:response.status,url:response.url,headers:response.headers,body:body===null?null:{cancel:reason=>body.cancel(reason),getReader(){
     const reader=body.getReader()
     return {async read(){
      check();init.signal.throwIfAborted();const chunk=await reader.read();check();init.signal.throwIfAborted()
      if(!chunk.done){
       need(types.isUint8Array(chunk.value),'native transport chunk is not bytes')
       const length=byteLength.call(chunk.value);entityBytes+=length;totalBytes+=length
       need(entityBytes<=limits.maxEntityBytes&&totalBytes<=limits.maxTotalBytes,'native entity or aggregate byte budget exceeded')
      }
      return chunk
     },cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}
    }}}
   }catch(error){ignore(()=>response?.body?.cancel(error));throw error}
  }})
  check();const bytes=Buffer.from(page.bodyBase64,'base64')
  Object.assign(receipt,{bytes:bytes.length,sha256:sha(bytes),bodyBase64:page.bodyBase64,bodyComplete:true,completedAt:new Date().toISOString()})
  let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{throw fail('original entity is not UTF8')}
  check();return text
 },stats:()=>({requests:originalResponses.length,decodedBytes:totalBytes,...limits})}
}

export async function runCurrentSmartStreamMarkdown(options={}){
 const reader=readerFor(options),phases=[],held=[]
 const observedAt=typeof options.now==='function'?options.now():options.now??new Date().toISOString()
 need(typeof observedAt==='string'&&Number.isFinite(Date.parse(observedAt)),'invalid observation clock')
 need(options.maxJobs==null||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>=0,'invalid output cap')
 try{
  for(const phase of ['opening','closing']){
   const board=await reader.read(BOARD,phase,'html'),llms=discovery(board)
   const discoveryText=await reader.read(llms,phase,'markdown'),jobsURL=feedURL(discoveryText)
   const documentation=await reader.read(jobsURL,phase,'markdown'),indiaURL=filteredURL(documentation,jobsURL)
   const listingText=await reader.read(indiaURL,phase,'markdown'),listing=readCurrentSmartStreamFeed(listingText)
   const employer=account(await reader.read(ACCOUNT,phase,'json')),models=[]
   const observation={phase,board,discoveryText,documentation,listingText,listing,employer,models}
   phases.push(observation)
   for(const row of listing.slice(0,reader.limits.maxRoles)){
    const markdown=await reader.read(row.url,phase,'markdown')
    const detail=readSmartStreamJSON(await reader.read(DETAIL(row.shortcode),phase,'json'))
    models.push({listing:row,markdown,detail})
   }
   const integerIDs=models.map(model=>model.detail.id)
   need(new Set(integerIDs).size===integerIDs.length,'duplicate original native integer identity')
  }
  const [opening,closing]=phases
  need(same(opening.employer,closing.employer),'whole native employer record changed at closing')
  const closingByCode=new Map(closing.models.map(model=>[model.listing.shortcode,model])),qualified=[]
  for(const original of opening.models){
   const shortcode=original.listing.shortcode,current=closingByCode.get(shortcode)
   try{
    const {criteria,combined,originalMarkdown}=qualifyCurrentSmartStreamRole(original,opening.employer,observedAt)
    need(current,'native role missing at closing')
    qualifyCurrentSmartStreamRole(current,closing.employer,observedAt)
    need(same(original,current),'whole native role, criteria, or application changed at closing')
    const record=original.detail
    qualified.push({...criteria,sourceDescription:combined,jobDescription:combined,sourceDescriptionHTML:combined,
     sourceDescriptionText:criteria.sourceDescription,sourceNativeDescription:record.description,sourceNativeRequirements:record.requirements,
     sourceNativeBenefits:record.benefits,sourceNativeMarkdown:originalMarkdown.originalMarkdown,
     source:SOURCE,company:'SmartStream Technologies',title:record.title,jobId:String(record.id),requisitionId:record.shortcode,
     sourceUrl:BOARD+'j/'+record.shortcode+'/',applyUrl:originalMarkdown.applicationURL,link:originalMarkdown.applicationURL,
     nativeApplicationURL:originalMarkdown.applicationURL,nativeApplicationActionVerified:false,backendApplicationActivationVerified:false,
     applicationSubmitted:false,country:'India',location:original.listing.location,city:record.location.city,state:record.location.region,
     employmentType:record.type??null,department:record.department,postingDate:record.published,nativePublished:record.published,closingDate:null,
     sourceNativeListingRecord:original.listing,sourceNativeDetailRecord:record,
     sourceNativeClosingListingRecord:current.listing,sourceNativeClosingDetailRecord:current.detail,
     nativeEmployerBinding:{accountId:opening.employer.id,uid:opening.employer.uid,legalName:opening.employer.name,
      officialWebsite:opening.employer.url,currentNativePublisherVerified:true,currentCorporateHandoffVerified:false},
     sourceClosingReconciled:true,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,
     sourceRenderedCriteriaComplete:false,sourceApplicationQualificationComplete:false,
     sourceDetailCompleteMeaning:'Original current full native description/requirements/benefits and every other native field retained; renderer and backend application activation unverified',
     nativeFirstEverPublicationUnverified:true,scrapedAt:observedAt,companyCareerPage:'https://smart.stream/careers/',
     companyDomain:'smart.stream',atsPlatform:'workable'})
   }catch(error){reader.check();held.push({shortcode,reason:error.message,openingRecord:original,closingRecord:current??null})}
  }
  for(const model of closing.models)if(!opening.models.some(original=>original.listing.shortcode===model.listing.shortcode))
   held.push({shortcode:model.listing.shortcode,reason:'new native role at closing',openingRecord:null,closingRecord:model})
  const jobs=options.maxJobs==null?qualified:qualified.slice(0,options.maxJobs)
  const audit={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:new Set(phases.flatMap(row=>row.listing.map(job=>job.shortcode))).size,
   observations:phases,heldNativeRows:held,unhydratedNativeRows:phases.flatMap(phase=>phase.listing.slice(reader.limits.maxRoles).map(row=>({phase:phase.phase,...row}))),
   qualifiedObservedRoles:qualified.length,originalResponses:reader.originalResponses,reader:reader.stats(),
   companyScopeComplete:false,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,companyIndiaZeroProven:false,
   lifecycleCleanupAllowed:false,backendApplicationActivationVerified:false,applicationSubmitted:false,
   holds:['company and corporate handoff inventory unverified','renderer, form questions and backend activation unverified','lifecycle cleanup forbidden']}
  attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:audit.observedRecordCount,
   observedVacancyCount:audit.observedRecordCount,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,
   reportedTotal:null,indiaFacetCount:null,pagesFetched:audit.reader.requests,verifiedAt:observedAt,
   reason:'current-declared-native-text-feed-full-india-records-and-own-application-links-reconciled;company-scope-and-cleanup-held'})
  await options.onAudit?.(structuredClone(audit));reader.check();return jobs
 }catch(error){
  reader.check()
  try{Object.defineProperty(error,'recruitmentObservations',{value:{source:SOURCE,phases,heldNativeRows:held,
   originalResponses:reader.originalResponses,lifecycleCleanupAllowed:false},enumerable:true,configurable:true})}catch{}
  throw error
 }
}
