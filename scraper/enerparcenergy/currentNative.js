import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {parse} from 'acorn'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {canonicalNativeRecord} from '../../scraper-support/native-sources/collectCurrentOriginalRecords20261106.js'
import {readOwnedCurrentDocument,readOriginalNativeCriteria} from '../../scraper-support/native-sources/currentNativeCriteria20261106.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {CURRENT_ENERPARC_PROFILE as PROFILE} from './currentProfile.js'

export const BOARD=PROFILE.boardURL
const CORPORATE='https://enerparc.in/apply-now/',SOURCE='enerparcenergy',ROLE=PROFILE.reviewedRoleURL
const COMMON=PROFILE.clients[0].url,DETAIL_CLIENT=PROFILE.clients[1].url
const hash=value=>createHash('sha256').update(value).digest('hex')
const same=(a,b)=>canonicalNativeRecord(a)===canonicalNativeRecord(b)
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const keys=(value,expected)=>object(value)&&same(Object.keys(value).sort(),[...expected].sort())
const fail=(message,fields={})=>firstPartyFailure(SOURCE,message,{nativeAuthorityFailure:true,sourceScopeComplete:false,...fields})
const need=(ok,message)=>{if(!ok)throw fail(message)}
const ignore=operation=>{try{Promise.resolve(operation()).catch(()=>{})}catch{}}
const typedArray=Object.getPrototypeOf(Uint8Array.prototype),byteLength=Object.getOwnPropertyDescriptor(typedArray,'byteLength').get
const defaults={sourceTimeoutMs:45000,requestTimeoutMs:15000,maxRequests:16,maxPages:6,maxDetails:8,maxEntityBytes:4000000,maxTotalBytes:24000000}

// The shared original-byte transport has a larger outer ceiling. This source
// interposes its original4,000,000/24,000,000 stream limits before any chunk is
// admitted to that transport's buffers, and retains its abort/late-body cleanup.
export function createEnerparcOriginalReader(options={}){
 const caller=options.signal;caller?.throwIfAborted()
 need(!options.fetchText&&!options.fetchJson,'Original HTTP metadata is required; body-only callbacks cannot certify a native source')
 for(const name of ['fetchImpl','fetchPage'])need(options[name]===undefined||typeof options[name]==='function','Invalid native transport callback')
 const limits=Object.fromEntries(Object.entries(defaults).map(([name,maximum])=>{
  const value=options[name]??maximum
  need(Number.isSafeInteger(value)&&value>0&&value<=maximum,'Invalid native '+name+' ceiling');return[name,value]
 }))
 const controller=new AbortController(),signal=caller?AbortSignal.any([caller,controller.signal]):controller.signal,started=performance.now(),receipts=[]
 let totalBytes=0,discoveryPages=0,detailReads=0,closed=false,inFlight=false
 const expire=()=>controller.abort(new DOMException('Enerparc original source deadline exceeded','TimeoutError'))
 const timer=setTimeout(expire,limits.sourceTimeoutMs)
 const check=()=>{caller?.throwIfAborted();if(performance.now()-started>=limits.sourceTimeoutMs&&!controller.signal.aborted)expire();signal.throwIfAborted();need(!closed,'Original native reader is closed')}
 const admitted=new Map([[BOARD,'html'],[COMMON,'javascript'],[DETAIL_CLIENT,'javascript'],[ROLE,'html']])
 return {check,limits,
  async read(url,{reserveBytes=0}={}){
   check();const kind=admitted.get(url),detail=url===ROLE
   need(kind&&!inFlight&&receipts.length<limits.maxRequests,'Unbound or excessive original native request')
   need(Number.isSafeInteger(reserveBytes)&&reserveBytes>=0&&totalBytes+reserveBytes<limits.maxTotalBytes,'Insufficient reserved closing byte budget')
   need(detail?detailReads<limits.maxDetails:discoveryPages<limits.maxPages,'Original native discovery/detail budget exceeded')
   if(detail)detailReads++;else discoveryPages++
   const receipt={requestedUrl:url,method:'GET',requestedAt:new Date().toISOString(),bodyComplete:false};receipts.push(receipt);inFlight=true
   try{
    const response=await boundedDeclaredPublicRead(url,{signal,timeoutMs:limits.requestTimeoutMs,overflowError:fail('Original native response byte budget exceeded'),fetchImpl:async(requested,init)=>{
     const verify=()=>{check();init.signal.throwIfAborted()};verify();let original
     const request={...init,redirect:'manual',credentials:'omit',cache:'no-store',headers:{...init.headers,'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36','Accept-Language':'en-IN,en-US;q=0.9,en;q=0.8',Referer:BOARD}}
     try{
      if(options.fetchImpl)original=await options.fetchImpl(requested,request)
      else if(options.fetchPage){
       const page=await options.fetchPage(requested,request);verify()
       need(page&&typeof page.bodyBase64==='string'&&Number.isInteger(page.status)&&typeof(page.finalUrl??page.url)==='string'&&object(page.headers),'Original entity bytes and HTTP metadata are required')
       need(page.redirected===false,'Original native redirect authority is required')
       need(page.bodyBase64.length<=Math.ceil(limits.maxEntityBytes/3)*4,'Original native entity byte budget exceeded')
       const bytes=Buffer.from(page.bodyBase64,'base64')
       need(bytes.toString('base64')===page.bodyBase64&&(!page.sha256||hash(bytes)===page.sha256)&&(!page.bytes||page.bytes===bytes.length),'Original native byte receipt mismatch')
       original=new Response(bytes,{status:page.status,headers:page.headers});Object.defineProperty(original,'url',{value:page.finalUrl??page.url})
      }else original=await fetch(requested,request)
      verify();need(original&&Number.isInteger(original.status)&&typeof original.url==='string'&&typeof original.headers?.get==='function','Original Response HTTP metadata is required')
      Object.assign(receipt,{status:original.status,finalUrl:original.url,redirected:original.redirected,contentType:original.headers.get('content-type')??''})
      need(original.redirected===false,'Original native redirect authority changed or unavailable')
      const body=original.body;let entityBytes=0
      return {status:original.status,url:original.url,headers:original.headers,body:body===null?null:{cancel:reason=>body.cancel(reason),getReader(){
       verify();const reader=body.getReader()
       return {async read(){verify();const chunk=await reader.read();verify();if(!chunk.done){
        need(types.isUint8Array(chunk.value),'Original native chunk is not a byte array')
        const length=byteLength.call(chunk.value);entityBytes+=length;totalBytes+=length;receipt.bytesReceived=entityBytes
        need(entityBytes<=limits.maxEntityBytes,'Original native entity byte budget exceeded')
        need(totalBytes+reserveBytes<=limits.maxTotalBytes,'Aggregate original native byte budget or closing reserve exceeded')
       }return chunk},cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}
      }}}
     }catch(error){ignore(()=>original?.body?.cancel(error));throw error}
    }})
    check();const bytes=Buffer.from(response.bodyBase64,'base64')
    Object.assign(receipt,{status:response.status,finalUrl:response.url,bytes:bytes.length,sha256:hash(bytes),bodyComplete:true})
    need(response.url===url,'Original native final URL changed')
    if(response.status!==200)throw fail('Original native HTTP '+response.status,{status:response.status,requestUrl:url})
    need(response.headers['content-type']===(kind==='html'?'text/html;charset=UTF-8':'text/javascript;charset=UTF-8'),'Original native '+kind+' MIME changed')
    const expected=PROFILE.clients.find(client=>client.url===url)
    if(expected)need(bytes.length===expected.bytes&&receipt.sha256===expected.sha256,'Declared critical client original entity changed')
    need(!(bytes[0]===239&&bytes[1]===187&&bytes[2]===191),'Original native BOM requires review')
    let body;try{body=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)}catch(cause){throw fail('Original native UTF8 entity is invalid',{cause})}
    check();return{url,body,bytes,sha256:receipt.sha256}
   }catch(error){caller?.throwIfAborted();check();throw error}
   finally{receipt.completedAt=new Date().toISOString();inFlight=false}
  },
  stats:()=>({...limits,requests:receipts.length,discoveryPages,detailReads,decodedBytes:totalBytes,receipts:structuredClone(receipts)}),
  close(){closed=true;clearTimeout(timer);controller.abort()},
 }
}

function literal(node){
 if(node?.type==='Literal'){need(node.regex===undefined&&(node.value===null||['string','number','boolean'].includes(typeof node.value)),'Unreviewed native literal');return node.value}
 if(node?.type==='ArrayExpression'){need(node.elements.every(Boolean),'Native sparse data requires review');return node.elements.map(literal)}
 need(node?.type==='ObjectExpression','Native data is not a complete literal')
 const result={}
 for(const field of node.properties){
  need(field.type==='Property'&&!field.computed&&!field.method&&field.kind==='init','Native computed data requires review')
  const name=field.key.name??field.key.value
  need(typeof name==='string'&&!['__proto__','constructor','prototype'].includes(name)&&!Object.hasOwn(result,name),'Duplicate or unsafe native field')
  result[name]=literal(field.value)
 }
 return result
}
function strictJSON(text){
 need(typeof text==='string'&&Buffer.byteLength(text)<=256*1024,'Missing or excessive native JSON data')
 let value,ast;try{value=JSON.parse(text);ast=parse('('+text+')',{ecmaVersion:'latest'})}catch(cause){throw fail('Malformed original native JSON',{cause})}
 need(ast.body.length===1&&ast.body[0].type==='ExpressionStatement','Changed original native JSON expression')
 need(same(value,literal(ast.body[0].expression)),'Native JSON data differs');return value
}
function carrierValue(program,expected){
 need(Buffer.byteLength(program)<=256*1024,'Excessive native carrier')
 let ast;try{ast=parse(program,{ecmaVersion:'latest'})}catch(cause){throw fail('Native carrier AST changed',{cause})}
 need(ast.body.length===expected.length,'Native complete carrier execution plan changed')
 const values={}
 for(const [index,plan]of expected.entries()){
  const statement=ast.body[index];need(statement.type===plan.type,'Native carrier statement changed')
  if(statement.type!=='VariableDeclaration'){need(hash(program.slice(statement.start,statement.end))===plan.sha256,'Native carrier executable statement changed');continue}
  need(statement.kind===plan.kind&&statement.declarations.length===plan.declarations.length,'Native carrier declarations changed')
  for(const [offset,field]of plan.declarations.entries()){
   const declaration=statement.declarations[offset];need(declaration.id.type==='Identifier'&&declaration.id.name===field.name,'Native carrier binding changed')
   if(field.kind==='uninitialized'){need(declaration.init===null,'Native uninitialized binding changed');continue}
   if(field.kind==='exact-original-expression'){need(declaration.init&&hash(program.slice(declaration.init.start,declaration.init.end))===field.sha256,'Native original carrier expression changed');continue}
   if(field.kind==='original-job-json'){
    const call=declaration.init
    need(call?.type==='CallExpression'&&call.callee.type==='MemberExpression'&&!call.callee.computed&&call.callee.object.name==='JSON'&&call.callee.property.name==='parse'&&call.arguments.length===1&&call.arguments[0].type==='Literal'&&typeof call.arguments[0].value==='string','Native complete original job JSON binding changed')
    values.jobs=strictJSON(call.arguments[0].value);continue
   }
   const value=literal(declaration.init)
   if(field.kind==='unconsumed-public-uuid'){need(typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value),'Unconsumed native public request-token shape changed');continue}
   need(field.kind==='complete-literal-data'&&hash(JSON.stringify(value))===field.sha256,'Native complete metadata/layout input changed');values[field.name]=value
  }
 }
 return values
}
function documentPlan(root,kind){
 const visit=node=>{
  const attrs={...node.attrs}
  if(kind==='listing'&&node.tag==='input'&&['pageJson','moduleMeta','jobs','meta'].includes(node.attrs.id))attrs.value={originalDataSlot:node.attrs.id}
  return{tag:node.tag,attrs,unqualifiedTag:Boolean(node.nativeTagUnqualified),...(['title','style'].includes(node.tag)?{rawSHA256:hash(node.raw??'')}:{ }),children:node.children.map(child=>typeof child==='string'?child:visit(child))}
 }
 return visit(root)
}
function criteriaPlan(root){return{tag:root.tag,attrs:root.attrs,unqualifiedTag:Boolean(root.nativeTagUnqualified),children:root.children.map(child=>typeof child==='string'?{originalTextSlot:true}:criteriaPlan(child))}}
function ownedDocument(body,kind){
 const expected=PROFILE.documents[kind],owned=readOwnedCurrentDocument(body,{failure:fail,title:expected.title,canonical:kind==='detail'?PROFILE.detailMetadata.meta.detail_url:BOARD,stylesheetFragment:true}),scripts=owned.nodes.filter(node=>node.tag==='script')
 need(same(documentPlan(owned.root,kind),expected.documentPlan),'Native complete raw document/owner/presentation input changed')
 need(scripts.length===expected.scripts.length,'Native raw executable owner inventory changed')
 let values
 for(const [index,script]of scripts.entries()){
  const plan=expected.scripts[index];need(same(script.attrs,plan.attrs),'Native exact script declarations changed')
  if(plan.carrier){need(!script.inert,'Native carrier is hidden or inert');values=carrierValue(script.raw,expected.carrierPlan)}
  else need(hash(script.raw??'')===plan.sha256,'Native original inline program changed')
 }
 need(values,'Native current carrier unavailable')
 const mounts=owned.nodes.filter(node=>node.attrs.id==='career-website-main')
 need(mounts.length===1&&mounts[0].tag==='div'&&!mounts[0].inert,'Native complete raw mount owner changed')
 return{owned,values,clients:scripts.filter(node=>node.attrs.src&&PROFILE.clients.some(client=>client.url===node.attrs.src)).map(node=>node.attrs.src)}
}
const listFields=['Industry','Remote_Job','Job_Type','Job_Opening_Name','Posting_Title','Country','Is_Locked','id','City','Publish','Keep_on_Career_Site']
const detailFields=[...listFields,'Job_Description','Work_Experience','State','Zip_Code','Date_Opened']
const booleanFields=['Remote_Job','Is_Locked','Publish','Keep_on_Career_Site']
function rowShape(row,fields){
 need(keys(row,fields),'Native full original role schema changed')
 need(/^748950\d{11}$/.test(row.id)&&row.Posting_Title===row.Job_Opening_Name&&row.Posting_Title.trim(),'Native role identity changed')
 need(Object.entries(row).every(([name,value])=>booleanFields.includes(name)?typeof value==='boolean':typeof value==='string'&&Buffer.byteLength(value)<=32000),'Native role field type changed')
}
export function readEnerparcListing(body){
 const {owned,clients}=ownedDocument(body,'listing'),values={}
 for(const name of ['pageJson','moduleMeta','jobs','meta']){
  const owners=owned.nodes.filter(node=>node.attrs.id===name)
  need(owners.length===1&&owners[0].tag==='input'&&owners[0].attrs.type==='hidden'&&typeof owners[0].attrs.value==='string','Native complete hidden '+name+' carrier owner changed')
  values[name]=strictJSON(owners[0].attrs.value)
 }
 for(const name of ['pageJson','moduleMeta','meta'])need(same(values[name],PROFILE.listingMetadata[name]),'Native own employer/whole listing model changed')
 need(Array.isArray(values.jobs)&&values.jobs.length===PROFILE.listingExpectedCount,'Native complete observed listing count changed')
 const ids=new Set()
 for(const row of values.jobs){rowShape(row,listFields);need(!ids.has(row.id),'Duplicate native listing role ID');ids.add(row.id)}
 need(same(clients,[COMMON]),'Native listing critical client declarations changed')
 return values
}
export function readEnerparcDetail(body,row){
 const {values,clients}=ownedDocument(body,'detail')
 need(Array.isArray(values.jobs)&&values.jobs.length===1,'Native original detail record count changed')
 const record=values.jobs[0];rowShape(record,detailFields)
 for(const name of listFields)need(record[name]===row[name],'Native listing/detail '+name+' mismatch')
 need(record.id===PROFILE.reviewedRoleID&&record.Posting_Title===PROFILE.reviewedRoleTitle,'Unreviewed native full role identity')
 need(record.Country==='India'&&record.Remote_Job===false,'Native explicit role country is unqualified')
 need(record.Publish===true&&record.Is_Locked===false,'Native role is unpublished or locked')
 need(values.public_attachments_info===null&&!Object.hasOwn(values.meta,'eeo_disclaimer'),'Unsupported native attachment or EEO criteria carrier')
 need(/^\d{4}-\d{2}-\d{2}$/.test(record.Date_Opened)&&Number.isFinite(Date.parse(record.Date_Opened))&&new Date(record.Date_Opened).toISOString().slice(0,10)===record.Date_Opened,'Invalid native Date_Opened')
 const criteria=readOriginalNativeCriteria(record.Job_Description,fail)
 need(criteria.sourceDetailComplete&&/Requirements/.test(criteria.sourceDescription)&&/Benefits/.test(criteria.sourceDescription),'Native full original criteria unavailable')
 need(!/\b(?:(?:this|the) (?:job|role|position|vacancy) (?:is |has been |has )?(?:closed|filled|expired)|(?:we are |we're )?no longer accepting applications|applications? (?:are |have been )?closed)\b/i.test(criteria.sourceDescription),'Explicit native closed role notice')
 need(same(criteriaPlan(readNativeDocument(record.Job_Description).nodes(node=>node.tag==='root')[0]),PROFILE.criteriaPlan),'Native complete criteria element/attribute presentation changed')
 need(same(clients,[COMMON,DETAIL_CLIENT]),'Native complete detail critical client declarations changed')
 return{record,criteria,metadata:values,clients}
}
function reviewedRole(listing){
 const row=listing.jobs.find(row=>row.id===PROFILE.reviewedRoleID)
 need(row&&row.Posting_Title===PROFILE.reviewedRoleTitle,'Reviewed native full-detail role is not in current inventory')
 need(row.Country==='India'&&row.Remote_Job===false&&row.Publish===true&&row.Is_Locked===false,'Native reviewed role country/publication is unqualified')
 const slug=encodeURIComponent(row.Posting_Title.replace(/["~`!@#$%^&*()=+[\]{}|:;<>\\/,.?'\s]+/g,'-')),url=listing.meta.list_url+'/'+row.id+'/'+slug+'?source='+encodeURIComponent(listing.meta.source)
 need(url===ROLE,'Native exact declared public role handoff changed');return row
}
export async function runCurrentEnerparc(options={}){
 const reader=createEnerparcOriginalReader(options)
 try{
  need(options.now===undefined||typeof options.now==='function','Invalid native observation clock')
  const observedAt=(options.now??(()=>new Date().toISOString()))()
  need(typeof observedAt==='string'&&Number.isFinite(Date.parse(observedAt)),'Invalid native observation clock')
  need(reader.limits.maxRequests>=8&&reader.limits.maxPages>=6&&reader.limits.maxDetails>=2,'Insufficient native budget for complete opening/closing qualification')
  const commonBytes=PROFILE.clients[0].bytes,detailBytes=PROFILE.clients[1].bytes,closingReserve=2*reader.limits.maxEntityBytes+commonBytes+detailBytes
  const opening=readEnerparcListing((await reader.read(BOARD,{reserveBytes:closingReserve})).body),row=reviewedRole(opening)
  await reader.read(COMMON,{reserveBytes:closingReserve})
  const first=readEnerparcDetail((await reader.read(ROLE,{reserveBytes:closingReserve})).body,row)
  need(Date.parse(first.record.Date_Opened)<=Date.parse(observedAt),'Native Date_Opened is in the future')
  await reader.read(DETAIL_CLIENT,{reserveBytes:closingReserve})
  const closing=readEnerparcListing((await reader.read(BOARD,{reserveBytes:reader.limits.maxEntityBytes+commonBytes+detailBytes})).body)
  need(same(opening,closing),'Native whole ordered listing/model changed at closing')
  await reader.read(COMMON,{reserveBytes:reader.limits.maxEntityBytes+detailBytes})
  const last=readEnerparcDetail((await reader.read(ROLE,{reserveBytes:detailBytes})).body,reviewedRole(closing))
  await reader.read(DETAIL_CLIENT)
  need(same(first.record,last.record)&&same(first.metadata,last.metadata),'Native complete original full detail changed at closing')
  need(Date.parse(first.record.Date_Opened)<=Date.parse(observedAt),'Native Date_Opened is in the future')
  const record=first.record,job={...first.criteria,sourceDescription:record.Job_Description,jobDescription:record.Job_Description,sourceDescriptionText:first.criteria.sourceDescription,
   source:SOURCE,company:'Enerparc Energy',title:record.Posting_Title,jobId:record.id,requisitionId:record.id,sourceUrl:ROLE,applyUrl:ROLE,link:ROLE,
   country:'India',location:[record.City,record.State,record.Country].filter(Boolean).join(', '),city:record.City||null,state:record.State||null,department:record.Industry,employmentType:record.Job_Type,
   experienceRequired:record.Work_Experience,postingDate:record.Date_Opened,nativeDateOpened:record.Date_Opened,nativePublicationDateProvenance:'original-public-Zoho-Date_Opened-displayed-with-native-postedon-label',nativeFirstEverPublicationUnverified:true,closingDate:null,
   sourceNativeListingRecord:row,sourceNativeDetailRecord:record,sourceNativeClosingListingRecord:reviewedRole(closing),sourceNativeClosingDetailRecord:last.record,
   nativeEmployerBinding:{method:'current-own-native-internal-legal-organization-and-official-website;historical-corporate-handoff',organization:first.metadata.meta.org_info},
   nativeApplyHandoff:{kind:'current-own-public-native-detail-page',url:ROLE,applicationActionVerified:false},
   sourceClosingReconciled:true,nativeCriteriaTextComplete:true,sourceCriteriaPresentation:'complete-original-native-criteria-data-and-finite-reviewed-inputs;current-external-CSS-and-rendered-activation-unverified',
   currentCSSCoverage:false,activationVerified:false,clientDependencyCoverage:false,applicationQuestionsCoverage:false,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,
   scrapedAt:observedAt,companyCareerPage:CORPORATE,companyDomain:'enerparc.in',atsPlatform:'zoho-recruit'}
  const jobs=[job],audit={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:opening.jobs.length,observedVacancyCount:opening.jobs.length,companyGlobalTotal:null,companyIndiaTotal:null,returnedCount:1,unhydratedRecordCount:opening.jobs.length-1,
   originalOpeningRecords:opening.jobs,originalClosingRecords:closing.jobs,unhydratedRecords:opening.jobs.filter(candidate=>candidate.id!==record.id),
   unknownCountryRecordCount:opening.jobs.filter(candidate=>candidate.Country!=='India').length,unpublishedOrLockedRecordCount:opening.jobs.filter(candidate=>!candidate.Publish||candidate.Is_Locked).length,
   sourceScopeComplete:false,lifecycleCleanupAllowed:false,currentCSSCoverage:false,activationVerified:false,clientDependencyCoverage:false,applicationQuestionsCoverage:false,
   currentCorporateBindingVerified:false,historicalCorporateHandoff:PROFILE.originalCorporateHandoff,observedCorporateBlock:PROFILE.observedCorporateBlock,
   nativeOrganization:first.metadata.meta.org_info,nativeSEO:opening.pageJson.detail.advsettings.meta,criteriaDiscrepancies:[{id:record.id,field:'Work_Experience',structuredValue:record.Work_Experience,currentOriginalDescription:record.Job_Description,reviewedObservedValues:{structured:'4-5 years',description:'5–8 years'},resolution:'All current original native criteria retained; the reviewed discrepancy is not reconciled or deleted.'}],
   publicationDateSemantics:'Native Date_Opened is displayed publicly as postedon; first-ever publication is unverified. All original dates retained and age policy unchanged.',
   holds:['unhydrated-native-role-records','historical-only-corporate-binding-current403','company-scope-unverified','current-CSS-and-dependency-closure-unverified','rendered-activation-unverified','application-questions-unobserved','lifecycle-cleanup-forbidden'],
   openingClosingListingMatch:true,openingClosingDetailMatch:true,reader:reader.stats(),observationTime:observedAt}
  attachSourceObservationEvidence(jobs,audit);Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,reportedTotal:null,indiaFacetCount:null,pagesFetched:audit.reader.requests,verifiedAt:observedAt,
   reason:'exact-own-native-complete-criteria-and-closing;24unhydrated;historical-corporate-binding;company-CSS-dependency-activation-application-cleanup-held'})
  need(Buffer.byteLength(JSON.stringify({jobs,audit}))<=8*1024*1024,'Native output byte budget exceeded');reader.check();return jobs
 }finally{reader.close()}
}
