import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {readNativeDocument,decodeNativeEntities,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {literalRecruitmentPageData} from '../../scraper-support/utils/recruitmentPageData.js'
import {readJibeRecruitment} from '../../scraper-support/utils/recruitmentJibe.js'
import {parseEightfoldJson} from '../../scraper-support/utils/recruitmentEightfoldData.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const SOURCE='ellucianhighereducationsystems',COMPANY='Ellucian Higher Education Systems'
const ORIGIN='https://careers.ellucian.com',PAGE=ORIGIN+'/jobs/locations/country/India'
const CLIENT='https://app.jibecdn.com/prod/search/4.11.226/main.js'
const CLIENT_SHA='64df0d1d3d65b28b8ebe0d9ccd08d776ffb092486633fb72f91f26e6c9950f56'
const FIELDS=new Set(('additional_locations apply_url applyable ats_code benefits categories category city client_code country country_code create_date department description employment_type external full_location hiring_flow_name hiring_organization internal isApplyFlowJob isFrontLineAIJob lang language languages latitude location_name location_type longitude meta_data postal_code posted_date preferred_qualifications posting_expiry_date qualifications req_id responsibilities searchable short_location slug state street_address tags1 tags2 tags3 title update_date').split(' '))
const CRITERIA=['description','responsibilities','qualifications','benefits','preferred_qualifications']
const unavailable=/\b(?:(?:this|the)\s+)?(?:job|position|role|vacancy|opening|requisition)\s+(?:(?:has|have)\s+(?:now\s+)?been|is|was|has)\s+(?:(?:now|currently|temporarily|already)\s+)*(?:filled|closed|expired|withdrawn|cancelled|canceled|unavailable|not\s+(?:(?:currently|now)\s+)?(?:available|open)|no\s+longer\s+(?:available|open|accepting\s+applications))\b/i
const sha=value=>createHash('sha256').update(value).digest('hex')
const normalized=value=>String(value??'').replace(/\s+/g,' ').trim()
const canonical=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item)
const problem=(message,kind='coverage_gap')=>Object.assign(Error('Ellucian current native: '+message),{softFailure:true,abortRetries:true,failureKind:kind,sourceScopeComplete:false,lifecycleCleanupAllowed:false})
const need=(ok,message)=>{if(!ok)throw problem(message)}
const one=(values,label)=>{need(values.length===1,'missing or ambiguous '+label);return values[0]}
const walk=node=>[node,...node.children.filter(child=>typeof child!=='string').flatMap(walk)]
const retainedText=node=>typeof node==='string'?decodeNativeEntities(node):node.raw===undefined?node.children.map(retainedText).join(' '):decodeNativeEntities(node.raw)

function publisher(html){
 const document=readNativeDocument(html)
 const head=one(document.nodes(node=>node.tag==='head'),'publisher head'),bases=document.nodes(node=>node.tag==='base')
 need(bases.length===1&&head.children.includes(bases[0])&&canonical(bases[0].attrs)===canonical({href:'/'}),'unreviewed publisher base')
 const title=one(head.children.filter(node=>typeof node!=='string'&&node.tag==='title'),'publisher title')
 need(title.raw==='Ellucian Careers','publisher brand changed')
 const account=literalRecruitmentPageData(document,'_jibe')?.config
 const config=literalRecruitmentPageData(document,'searchConfig')?.config
 need(account?.cid==='ellucian'&&Object.keys(account).length===1,'current native employer account changed')
 need(config?.path==='/jobs/locations/country/India'&&config.query?.country==='India'&&config.query.internal==='false'
  &&config.externalSearch===true&&config.isLoggedIn===false&&config.jobDescriptionAtsOverride===false
  &&config.useCustomJDUrl!==true&&config.locale==='en-US'&&config.numRowsPerPage===10
  &&(!config.searchOverride||Object.keys(config.searchOverride).length===0)
  &&(!config.contextSettings?.currentContext),'current anonymous India search contract changed')
 const clients=document.nodes(node=>node.tag==='script'&&Object.hasOwn(node.attrs,'src')&&!Object.hasOwn(node.attrs,'nomodule')
  &&/^(?:|module|text\/javascript|application\/javascript)$/.test(node.attrs.type||''))
  .map(node=>new URL(node.attrs.src,PAGE).href).filter(url=>/^https:\/\/app\.jibecdn\.com\/prod\/search\/\d+\.\d+\.\d+\/main\.js$/.test(url))
 need(clients.length===1&&clients[0]===CLIENT,'current declared native client changed')
 return{account,config,search:{origin:ORIGIN,pageURL:PAGE,searchPageURL:PAGE,clientURL:CLIENT,cid:account.cid,
  locale:config.locale,pageSize:config.numRowsPerPage,context:'',rolePrefix:'/jobs/'}}
}

function criteria(detail){
 need(Object.keys(detail).every(key=>FIELDS.has(key)),'additional native criterion or status requires review')
 const original={},sections=[]
 for(const field of CRITERIA){
  if(!Object.hasOwn(detail,field))continue
  const html=detail[field];original[field]=structuredClone(html)
  if(html==null||html==='')continue
  if(Array.isArray(html)){need(html.length===0,'nonempty native criterion list requires review: '+field);continue}
  need(typeof html==='string'&&html.length<=250000,'native criterion field changed: '+field)
  const raw=readNativeDocument(html),visible=readVisibleNativeDocument(html,{strict:true})
  const root=one(raw.nodes(node=>node.tag==='root'),'native criterion root')
  need(walk(root).every(node=>!node.inert&&node.raw===undefined&&!['script','style','template','noscript','iframe','object','embed','svg','math'].includes(node.tag)),
   'native criterion contains unreviewed program or inert content: '+field)
  const whole=normalized(retainedText(root)),shown=normalized(visible.text(one(visible.nodes(node=>node.tag==='root'),'visible native criterion root')))
  need(whole===shown&&whole.length>0,'native criterion hidden or incomplete: '+field)
  const text=extractActiveDescription(html)
  need(text&&text.length>0,'native criterion unavailable: '+field)
  sections.push(field.replaceAll('_',' ')+':\n'+text)
 }
 need(typeof detail.description==='string'&&extractActiveDescription(detail.description)?.length>=200,'full original description unavailable')
 return{original,description:sections.join('\n\n')}
}

function project(native,now){
 const {row,detail}=native.record,data=row.data
 need(data.hiring_organization==='Ellucian'&&detail.hiring_organization==='Ellucian','own native employer mismatch')
 need(data.client_code==='ellucian'&&detail.client_code==='ellucian'&&detail.meta_data?.client_code==='ellucian','own native account mismatch')
 need(data.country==='India'&&data.country_code==='IN'&&detail.country==='India'&&detail.country_code==='IN','native country conflict')
 need(data.multipleLocations===false&&Array.isArray(detail.additional_locations)&&detail.additional_locations.length===0,'additional native worksite scope unresolved')
 const canonicalURL=ORIGIN+'/jobs/'+encodeURIComponent(detail.slug)+'?lang='+detail.language
 need(data.meta_data?.canonical_url===canonicalURL&&(detail.meta_data?.canonical_url==null||detail.meta_data.canonical_url===canonicalURL),'own native role URL mismatch')
 need(native.applyURL==='https://india-ellucian.icims.com/jobs/'+detail.slug+'/login'&&data.apply_url===native.applyURL,'own native application account or ID mismatch')
 need(detail.meta_data?.icims?.jps_is_public===true&&detail.internal===false&&detail.applyable===true&&detail.searchable===true,'native public role unavailable')
 const posted=Date.parse(detail.posted_date)
 need(typeof detail.posted_date==='string'&&Number.isFinite(posted)&&posted<=now,'native posted date unavailable or future')
 if(detail.posting_expiry_date!=null)need(Number.isFinite(Date.parse(detail.posting_expiry_date))&&Date.parse(detail.posting_expiry_date)>now,'native role expired')
 const full=criteria(detail)
 need(!unavailable.test(full.description),'native role explicitly filled, closed or unavailable')
 return{source:SOURCE,company:COMPANY,companyDomain:'careers.ellucian.com',companyCareerPage:PAGE,atsPlatform:'official-jibe-search',
  jobId:detail.req_id,requisitionId:detail.req_id,title:detail.title,department:detail.department||detail.categories?.[0]?.name||null,
  country:'India',city:detail.city,location:[detail.city,detail.state,detail.country].filter(Boolean).join(', '),
  sourceUrl:canonicalURL,sourceURL:canonicalURL,link:canonicalURL,applyUrl:native.applyURL,
  jobDescription:full.description,sourceDescription:full.description,sourceNativeFullCriteria:full.original,
  postingDate:new Date(posted).toISOString(),sourcePostedDateRaw:detail.posted_date,closingDate:detail.posting_expiry_date||null,
  firstEverPostedAt:null,employmentType:detail.employment_type==='FULL_TIME'?'Full-time':detail.employment_type,remoteStatus:null,
  sourceNativeListing:data,sourceNativeDetail:detail,sourceNativeCountryEvidence:{method:'matching-own-native-list-and-full-detail-country-and-country-code',country:detail.country,countryCode:detail.country_code},
  sourceNativeEmployerEvidence:{method:'current-own-Ellucian-publisher-account-and-native-employer',configuredCompanyName:COMPANY,nativeEmployer:detail.hiring_organization,currentAccount:'ellucian'},
  sourceDetailComplete:true,sourceNativeCriteriaComplete:true,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,
  sourceRenderedApplicationQualified:false,sourceApplicationSubmitted:false}
}

export async function runCurrentEllucian(options={}){
 need(!(options.fetchText||options.fetchJson)||options.fetchImpl,'current native HTTP metadata required; body-only overrides cannot qualify roles')
 const clock=typeof options.now==='function'?options.now():options.now??new Date().toISOString(),now=Date.parse(clock)
 need(Number.isFinite(now),'invalid observation clock')
 const duration=options.sourceDeadlineMs??90000
 need(Number.isSafeInteger(duration)&&duration>0&&duration<=90000,'invalid source deadline')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(problem('source deadline exceeded','network_or_timeout')),duration)
 const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const fetchImpl=options.fetchImpl||globalThis.fetch,allowed=new Set([PAGE]),receipts=[],passes=[],lastRead=new Map();let totalBytes=0
 const read=async(url,mime)=>{
  signal.throwIfAborted();need(allowed.has(url)&&receipts.length<60,'public read URL or count bound')
  const target=new URL(url)
  need(url===PAGE||url===CLIENT||target.origin===ORIGIN&&/^\/api\/jobs(?:\/[a-zA-Z0-9_-]+\/[a-z]{2}-[a-z]{2})?$/.test(target.pathname),'read outside declared public native account')
  const wait=options.fetchImpl?0:Math.max(0,500-(performance.now()-(lastRead.get(target.origin)??-Infinity)))
  if(wait)await delay(wait,undefined,{signal});lastRead.set(target.origin,performance.now())
  const nativeFetch=async(value,init)=>{
   const response=await fetchImpl(value,{...init,cache:'no-store',credentials:'omit'})
   const body=response.body===null?null:{cancel:reason=>response.body.cancel(reason),getReader(){
    const reader=response.body.getReader();let bytes=0
    return{async read(){const next=await reader.read();if(!next.done){need(types.isUint8Array(next.value),'native byte chunk type');need(next.value.byteLength<=4000000-bytes&&next.value.byteLength<=32000000-totalBytes,'native streaming byte bound');bytes+=next.value.byteLength;totalBytes+=next.value.byteLength}return next},cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}
   }}
   return{status:response.status,url:response.url,headers:response.headers,body}
  }
  const packet=await boundedDeclaredPublicRead(url,{fetchImpl:nativeFetch,signal,overflowError:problem('native streaming byte bound'),timeoutMs:20000})
  const bytes=Buffer.from(packet.bodyBase64,'base64'),body=new TextDecoder('utf-8',{fatal:true}).decode(bytes)
  receipts.push({url,finalURL:packet.url,status:packet.status,headers:packet.headers,bytes:bytes.length,sha256:sha(bytes),body,checkedAt:new Date().toISOString()})
  if(packet.status!==200)throw problem('native HTTP '+packet.status,[401,403,429,451].includes(packet.status)?'blocked_or_access_denied':'upstream_unavailable')
  need(packet.url===url,'native final URL changed')
  need(mime.test(packet.headers['content-type']||''),'native response MIME changed')
  return body
 }
 const pass=async()=>{
  const publication=publisher(await read(PAGE,/^text\/html\b/i)),jobs=[],nativeRows=[],inventories=[],holds=[]
  const current={publication,jobs,nativeRows,inventories,holds};passes.push(current)
  await readJibeRecruitment(publication.search,{maxPages:4,maxDetails:40,canRead:()=>receipts.length<58,
   permit:url=>allowed.add(url),
   readRenderer:async url=>{const html=await read(url,/^(?:text|application)\/javascript\b/i);need(url===CLIENT&&sha(Buffer.from(html))===CLIENT_SHA,'current whole native client program changed');return{html}},
   readJson:async url=>{
    allowed.add(url)
    const body=await read(url,/^application\/json\b/i)
    try{return parseEightfoldJson(body)}catch(error){throw problem('native JSON invalid or ambiguous: '+error.message)}
   },
   inventoryRead:value=>inventories.push(value),recordRead:value=>nativeRows.push(structuredClone(value)),
   unresolved:reason=>holds.push({reason}),problem:(stage,error)=>{signal.throwIfAborted();throw Object.assign(error,{stage})},
   addJob:native=>{try{jobs.push(project(native,now))}catch(error){holds.push({nativeID:native.id,reason:error.message,originalNativeRecord:native.record})}}})
  return current
 }
 try{
  const opening=await pass(),closing=await pass()
  need(canonical(opening)===canonical(closing),'closing current publisher, full native models, criteria or inventory changed')
  const jobs=opening.jobs.map(job=>({...job,scrapedAt:new Date().toISOString(),sourceNativeClosingReconciled:true}))
  const audit={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:opening.nativeRows.length,observedVacancyCount:opening.nativeRows.length,
   passes,openingClosingMatched:true,publicRequestReceipts:receipts,nativeClient:{url:CLIENT,sha256:CLIENT_SHA},
   sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,
   sourceRenderedApplicationQualified:false,applicationSubmitted:false,reason:'current-own-native-account-and-typed-country-full-detail-models-rechecked;company-scope-and-rendered-application-unqualified'}
  attachSourceObservationEvidence(jobs,audit);Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  options.onAudit?.(structuredClone(audit))
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:PAGE,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,
   pagesFetched:receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:audit.reason})
 }catch(error){
  if(options.signal?.aborted)throw options.signal.reason
  if(error&&typeof error==='object'&&Object.isExtensible(error)){
   try{error.sourceAudit={source:SOURCE,passes,publicRequestReceipts:receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false}}catch{}
  }
  throw error
 }
 finally{clearTimeout(timer)}
}
