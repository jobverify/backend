import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {readNativeDocument,activeHead,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {requireNativeHttpResponse} from '../../scraper-support/shared/nativeHttpResponse.js'
import {disposeResponseBody,disposeResponseReader} from '../../scraper-support/shared/responseBodyDisposal.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const profile=JSON.parse(readFileSync(new URL('./currentProfile20261117.json',import.meta.url),'utf8'))
const CAREERS='https://funplus.com/careers/',BOARD='https://funplus.factorialhr.com/embed/jobs'
const DETAIL='https://funplus.factorialhr.com/embed/job_posting/senior-level-artist-329858'
const APPLY='https://funplus.factorialhr.com/embed/apply/senior-level-artist-329858'
const CLIENT=Object.keys(profile.assets).find(url=>url.includes('/CompanyPages/'))
const LAZY=Object.keys(profile.assets).find(url=>url.includes('/includes/lazysizes'))
const allowed=new Set([CAREERS,BOARD,DETAIL,APPLY,CLIENT,LAZY])
const sha=value=>createHash('sha256').update(value).digest('hex')
const requireCurrent=(ok,message)=>{if(!ok)throw Object.assign(Error('FunPlus current native contract: '+message),{abortRetries:true,incompleteScope:true})}
const passiveLogo=value=>{
 try{
  const url=new URL(value),reference=new URL(profile.passiveLogo.originalURL)
  if(url.origin!==reference.origin||url.pathname!==reference.pathname||url.hash||url.username||url.password)return value
  if(!isDeepStrictEqual([...url.searchParams.keys()],[...reference.searchParams.keys()]))return value
  for(const [key,expected]of reference.searchParams){
   const actual=url.searchParams.get(key)
   if(key==='X-Amz-Date'){
    if(!new RegExp('^'+profile.passiveLogo.reviewedSigningDay+'T(?:[01]\\d|2[0-3])[0-5]\\d[0-5]\\dZ$').test(actual))return value
   }else if(key==='X-Amz-Signature'){if(!/^[0-9a-f]{64}$/.test(actual))return value}
   else if(actual!==expected)return value
  }
  reference.searchParams.set('X-Amz-Date','[reviewed-day-signing-time]');reference.searchParams.set('X-Amz-Signature','[signed-passive-image]')
  return reference.href
 }catch{return value}
}
// Complete original HTML remains in the receipt. Only the known request CSRF
// token is omitted from the equality model, never a vacancy or application field.
const canonical=node=>typeof node==='string'?node.replace(/\s+/g,' ').trim():({tag:node.tag,
 attrs:Object.fromEntries(Object.entries(node.attrs).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>
  [key,node.tag==='meta'&&node.attrs.name==='csrf-token'&&key==='content'?'[volatile-csrf-token]'
   :node.tag==='meta'&&node.attrs.property==='og:image'&&key==='content'?passiveLogo(value):value])),
 ...(node.raw!==undefined?{raw:node.raw.trim()}:{}),children:node.children.map(canonical).filter(value=>value!=='')})
const documentModel=html=>canonical(readNativeDocument(html).nodes(node=>node.tag==='root')[0])
const modelSHA=model=>sha(JSON.stringify(model))
const one=(nodes,label)=>{requireCurrent(nodes.length===1,'unique '+label);return nodes[0]}
const activeFrames=node=>node.activeFrame?[node]:node.inert?[]:node.children.filter(value=>typeof value!=='string').flatMap(activeFrames)

function validateCareers(html){
 const doc=readNativeDocument(html),root=doc.nodes(node=>node.tag==='root')[0]
 requireCurrent(isDeepStrictEqual(activeHead(html).titles,['Careers - FunPlus']),'corporate title')
 const section=one(doc.nodes(node=>node.tag==='section'&&doc.hasClass(node,'career-list')),'corporate career section')
 requireCurrent(modelSHA(canonical(section))===profile.corporate.sectionSHA256,'corporate handoff section profile')
 const frame=one(activeFrames(root),'active corporate iframe')
 requireCurrent(frame.attrs['data-src']===BOARD&&!Object.hasOwn(frame.attrs,'src')&&!Object.hasOwn(frame.attrs,'srcdoc')
  &&doc.hasClass(frame,'lazyload'),'declared lazy iframe handoff')
 const programs=doc.nodes(node=>node.tag==='script')
 requireCurrent(modelSHA(programs.map(canonical))===profile.corporate.programPlanSHA256,'corporate program declaration profile')
 requireCurrent(programs.filter(node=>node.attrs.src===LAZY).length===1,'declared lazy activation program')
 return {section:canonical(section),programs:programs.map(canonical),boardURL:BOARD,browserEquivalenceComplete:false}
}
function validatePage(url,html){
 const model=documentModel(html),expected=profile.pageModels[url]
 requireCurrent(expected&&modelSHA(model)===expected.canonicalDocumentSHA256,'complete native document model profile '+url)
 return model
}
function parseNative(boardHTML,detailHTML,applyHTML){
 const board=readNativeDocument(boardHTML),detail=readNativeDocument(detailHTML),application=readNativeDocument(applyHTML)
 const row=one(board.nodes(node=>node.tag==='li'&&board.hasClass(node,'job-offer-item')),'published native vacancy row')
 requireCurrent(row.attrs['data-job-postings-url']==='/embed/job_posting/senior-level-artist-329858'
  &&row.attrs['data-controller']==='job-postings'&&row.attrs['data-action']?.includes('click->job-postings#goToJob'),'declared native role route')
 const title=detail.text(one(detail.nodes(node=>node.tag==='h1'),'native role heading'))
 requireCurrent(title==='Senior Level Artist'&&board.text(row).includes(title),'native role title binding')
 const description=one(detail.nodes(node=>node.tag==='div'&&detail.hasClass(node,'styledText')),'full authored description')
 const jobDescription=extractActiveDescription(detail.text(description))
 requireCurrent(jobDescription&&jobDescription.length>500,'full authored criteria')
 const placements=detail.nodes(node=>node.tag==='span'&&/^Hybrid\s*\(/.test(detail.text(node))).map(node=>detail.text(node))
 requireCurrent(placements.length===2&&placements.every(value=>value==='Hybrid (Lisbon, Lisbon, Portugal)'),'explicit native placement binding')
 requireCurrent(detail.nodes(node=>node.tag==='strong'&&detail.text(node)==='Studio Ellipsis',description).length===1,'authored hiring organization')
 const links=[...new Set(detail.nodes(node=>node.tag==='a'&&node.attrs.href?.includes('/embed/apply/')).map(node=>new URL(node.attrs.href,DETAIL).href))]
 requireCurrent(isDeepStrictEqual(links,[APPLY]),'native application route')
 requireCurrent(application.text(one(application.nodes(node=>node.tag==='h2'),'application role heading'))===title,'application title binding')
 const form=one(application.nodes(node=>node.tag==='form'),'native application form')
 requireCurrent(form.attrs.method==='POST'&&form.attrs.action===''&&form.attrs['data-controller']==='application-form'
  &&form.attrs['data-action']==='application-form#submit'&&form.attrs.enctype==='multipart/form-data','native application declaration')
 const fields=application.nodes(node=>['input','textarea','select'].includes(node.tag),form).map(canonical)
 requireCurrent(fields.some(field=>field.attrs.name==='cv'&&Object.hasOwn(field.attrs,'required')),'native required CV field')
 return {title,jobDescription,nativeRow:canonical(row),description:canonical(description),placement:placements,
  application:{url:APPLY,form:canonical(form),fields,entryVerified:true,submissionPerformed:false}}
}

function transport({fetchImpl=globalThis.fetch,signal:callerSignal,requestIntervalMs=1000,timeoutMs=120000}={}){
 requireCurrent(Number.isSafeInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=180000&&Number.isSafeInteger(requestIntervalMs)
  &&requestIntervalMs>=0&&(requestIntervalMs>=1000||fetchImpl!==globalThis.fetch),'configured transport limits')
 const owner=new AbortController(),timer=setTimeout(()=>owner.abort(Error('FunPlus current source deadline exceeded')),timeoutMs)
 const signal=callerSignal?AbortSignal.any([callerSignal,owner.signal]):owner.signal,prior=new Map()
 let reads=0,total=0
 const race=async(pending,requestSignal)=>{
  let listener
  try{return await Promise.race([pending,new Promise((_,reject)=>{
   listener=()=>reject(requestSignal.reason);requestSignal.addEventListener('abort',listener,{once:true});if(requestSignal.aborted)listener()
  })])}finally{if(listener)requestSignal.removeEventListener('abort',listener)}
 }
 return {close(){clearTimeout(timer);owner.abort()},async read(url){
  callerSignal?.throwIfAborted();signal.throwIfAborted()
  requireCurrent(allowed.has(url)&&++reads<=16,'bounded declared request URL/count')
  const origin=new URL(url).origin,wait=requestIntervalMs-(Date.now()-(prior.get(origin)||0))
  if(wait>0)await delay(wait,undefined,{signal});prior.set(origin,Date.now())
  const requestSignal=AbortSignal.any([signal,AbortSignal.timeout(20000)])
  let response,reader,complete=false
  const pending=Promise.resolve().then(()=>fetchImpl(url,{method:'GET',credentials:'omit',redirect:'manual',signal:requestSignal,
   headers:{Accept:profile.assets[url]?'application/javascript,text/javascript':'text/html,application/xhtml+xml'}}))
  pending.then(value=>{if(!response&&requestSignal.aborted)disposeResponseBody(value,{bestEffort:true}).catch(()=>{})},()=>{})
  try{
   response=await race(pending,requestSignal)
   await requireNativeHttpResponse(response,url,{context:'FunPlus current native read',signal:requestSignal,callerSignal:callerSignal??null})
   const mime=response.headers.get('content-type')||''
   requireCurrent(profile.assets[url]?/(?:application|text)\/(?:x-)?(?:java|ecma)script/i.test(mime):/text\/html|application\/xhtml\+xml/i.test(mime),'native MIME')
   requireCurrent(Boolean(response.body),'native response body')
   reader=response.body.getReader();let bytes=0;const chunks=[]
   for(;;){const part=await race(reader.read(),requestSignal);requestSignal.throwIfAborted();if(part.done){complete=true;break}
    bytes+=part.value.byteLength;total+=part.value.byteLength;requireCurrent(bytes<=2000000&&total<=10000000,'native byte limits');chunks.push(Buffer.from(part.value))}
   const body=Buffer.concat(chunks,bytes)
   return {url,status:response.status,bytes,sha256:sha(body),html:body.toString('utf8')}
  }catch(error){
   const cleanup=reader&&!complete?disposeResponseReader(reader,{bestEffort:true}):!reader&&response&&!response.bodyUsed?disposeResponseBody(response,{bestEffort:true}):null
   if(callerSignal?.aborted){cleanup?.catch(()=>{});callerSignal.throwIfAborted()}
   if(cleanup)await cleanup
   throw error
  }finally{try{reader?.releaseLock()}catch{}}
 }}
}

export async function runCurrentFunPlus(options={}){
 options.signal?.throwIfAborted()
 const now=options.now??(()=>new Date().toISOString())
 requireCurrent(options.maxJobs==null||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>=0&&options.maxJobs<=10000,'configured vacancy cap')
 if(options.maxJobs===0){
  const jobs=attachInventoryEvidence([],{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,
   pagesFetched:0,verifiedAt:now(),reason:'caller-cap-zero-no-public-reads'})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{configurable:true,value:{source:'funplus',sourceScopeComplete:false,lifecycleCleanupAllowed:false,configuredLimit:0}})
  return jobs
 }
 const io=transport(options)
 const readRound=async()=>{
  const careers=await io.read(CAREERS),handoff=validateCareers(careers.html)
  const lazy=await io.read(LAZY);requireCurrent(lazy.sha256===profile.assets[LAZY].sha256&&lazy.bytes===profile.assets[LAZY].bytes,'exact lazy activation program')
  const board=await io.read(BOARD),boardModel=validatePage(BOARD,board.html)
  const client=await io.read(CLIENT);requireCurrent(client.sha256===profile.assets[CLIENT].sha256&&client.bytes===profile.assets[CLIENT].bytes,'exact native client program')
  const detail=await io.read(DETAIL),detailModel=validatePage(DETAIL,detail.html)
  const application=await io.read(APPLY),applicationModel=validatePage(APPLY,application.html)
  const parsed=parseNative(board.html,detail.html,application.html)
  return {models:{handoff,board:boardModel,detail:detailModel,application:applicationModel},parsed,
   originals:{careers,board,detail,application,programs:[{url:lazy.url,sha256:lazy.sha256,bytes:lazy.bytes},{url:client.url,sha256:client.sha256,bytes:client.bytes}]}}
 }
 try{
  const opening=await readRound(),closing=await readRound()
  requireCurrent(isDeepStrictEqual(opening.models,closing.models)&&isDeepStrictEqual(opening.parsed,closing.parsed),'full opening/closing native models')
  const parsed=opening.parsed,job={jobId:'329858',requisitionId:'329858',title:parsed.title,company:'FunPlus',nativeEmployerName:'Studio Ellipsis',
   nativePublisherEmployer:'FunPlus',employerRelationshipComplete:false,location:'Lisbon, Lisbon, Portugal',city:'Lisbon',country:'Portugal',
   department:null,employmentType:'Full-time',workplaceType:'Hybrid',experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],
   sourceUrl:DETAIL,applyUrl:APPLY,link:APPLY,source:'funplus',companyCareerPage:CAREERS,companyDomain:'funplus.com',atsPlatform:'factorialhr-embed-jobs-html',
   jobDescription:parsed.jobDescription,postingDate:null,closingDate:null,scrapedAt:now(),sourceDetailComplete:true,sourceDescriptionInspected:true,
   sourceFullDescriptionPresent:true,nativeRoleClosingReconciled:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
   sourceNativePublicCriteria:{description:parsed.description,placement:parsed.placement,application:parsed.application},
   nativeSourceRecord:{nativeRow:parsed.nativeRow,application:parsed.application,opening,closing},nativeSourceContextComplete:false,browserEquivalenceComplete:false}
  const jobs=[job]
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,
   pagesFetched:12,reportedTotal:null,verifiedAt:now(),reason:'one-reconciled-native-Factorial-vacancy;company-employer-and-passive-renderer-scope-not-certified'})
  attachSourceObservationEvidence(jobs,{source:'funplus',recordKind:'vacancy-rows',observedRecordCount:1,observedVacancyCount:1,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  const audit={...jobs.nativeCollectionEvidence,source:'funplus',observedListingCount:1,observedIndiaListingCount:0,nonIndiaListingCount:1,
   candidateDetails:1,extractedDetailJobs:1,excludedDetailJobs:0,failures:[],nativeOpeningInventory:opening.models,
   nativeClosingInventory:closing.models,closingFullNativeInventoryMatch:true,listingPaginationComplete:true,closingInventoryMatches:true,
   employerRelationshipComplete:false,unknownPassiveContextComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
  Object.defineProperty(jobs,'nativeCollectionEvidence',{configurable:true,value:audit})
  job.nativeCollectionEvidence=audit
  return jobs
 }finally{io.close()}
}
