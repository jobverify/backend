import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {decodeHTML} from 'entities'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {canonicalNativeRecord} from '../../scraper-support/native-sources/collectCurrentOriginalRecords20261106.js'
import {readOwnedCurrentDocument,readOriginalNativeCriteria} from '../../scraper-support/native-sources/currentNativeCriteria20261106.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {CURRENT_SOROCO_PROFILE as PROFILE} from './currentProfile.js'

export const CORPORATE='https://soroco.com/careers/',OPENINGS='https://soroco.com/all-job-openings/'
export const API='https://soroco.zohorecruit.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite'
const SITE='https://soroco.zohorecruit.com',BOARD=SITE+'/jobs/Careers'
const fail=(message,fields={})=>firstPartyFailure('soroco',message,{nativeAuthorityFailure:true,...fields})
const need=(ok,message)=>{if(!ok)throw fail(message)}
const hash=value=>createHash('sha256').update(value).digest('hex')
const same=(a,b)=>canonicalNativeRecord(a)===canonicalNativeRecord(b)
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const keys=(value,expected)=>object(value)&&same(Object.keys(value).sort(),[...expected].sort())
const client=url=>PROFILE.clients.find(row=>row.url===url)
const corporate=url=>PROFILE.corporate.find(row=>row.url===url)
const kindMime={html:/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i,json:/^application\/json(?:;|$)/i,
 javascript:/^(?:text|application)\/(?:java|ecma)script(?:;|$)/i,css:/^text\/css(?:;|$)/i}
const descriptor=url=>corporate(url)?'html':client(url)?.kind??(url===API?'json':null)

function reader(options){
 options.signal?.throwIfAborted()
 need(!options.fetchText&&!options.fetchJson,'Original HTTP metadata is required; body-only callbacks cannot certify a native source')
 const requestTimeoutMs=options.requestTimeoutMs??15000,sourceTimeoutMs=options.sourceTimeoutMs??180000,maxRequests=options.maxRequests??28
 need(Number.isSafeInteger(requestTimeoutMs)&&requestTimeoutMs>0&&requestTimeoutMs<=15000&&Number.isSafeInteger(sourceTimeoutMs)&&sourceTimeoutMs>0&&sourceTimeoutMs<=180000,'Invalid native source/request deadline')
 need(Number.isSafeInteger(maxRequests)&&maxRequests>0&&maxRequests<=28,'Invalid native request budget')
 const controller=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal,started=performance.now(),receipts=[],learned=new Set()
 let bytesRead=0,closed=false
 const expire=()=>controller.abort(new DOMException('Soroco source deadline exceeded','TimeoutError'))
 const timer=setTimeout(expire,sourceTimeoutMs)
 const check=()=>{options.signal?.throwIfAborted();if(performance.now()-started>=sourceTimeoutMs&&!controller.signal.aborted)expire();signal.throwIfAborted();need(!closed,'Native source reader is closed')}
 return{check,allow(url){checkedRoleURL(url);learned.add(url)},
  async read(url){
   check();const kind=descriptor(url)??(learned.has(url)?'html':null)
   need(kind&&receipts.length<maxRequests,'Unbound or excessive original native request')
   const receipt={requestedUrl:url,method:'GET',requestedAt:new Date().toISOString()};receipts.push(receipt)
   try{
    const response=await boundedDeclaredPublicRead(url,{signal,timeoutMs:requestTimeoutMs,overflowError:fail('Original native response exceeds16MiB'),fetchImpl:async(requested,init)=>{
     check()
     if(options.fetchPage){
      const page=await options.fetchPage(requested,{...init,credentials:'omit',cache:'no-store'})
      check();need(page&&typeof page.bodyBase64==='string'&&Number.isInteger(page.status)&&typeof(page.finalUrl??page.url)==='string'&&object(page.headers),'Original entity bytes and HTTP metadata are required')
      const bytes=Buffer.from(page.bodyBase64,'base64');need(bytes.toString('base64')===page.bodyBase64&&(!page.sha256||hash(bytes)===page.sha256)&&(!page.bytes||page.bytes===bytes.length),'Original native byte receipt mismatch')
      const wrapped=new Response(bytes,{status:page.status,headers:page.headers});Object.defineProperty(wrapped,'url',{value:page.finalUrl??page.url});return wrapped
     }
     return(options.fetchImpl??fetch)(requested,{...init,credentials:'omit',cache:'no-store'})
    }})
    check();const bytes=Buffer.from(response.bodyBase64,'base64');bytesRead+=bytes.length
    Object.assign(receipt,{status:response.status,finalUrl:response.url,contentType:response.headers['content-type']??'',bytes:bytes.length,sha256:hash(bytes)})
    need(bytesRead<=24*1024*1024,'Aggregate original native byte budget exceeded')
    need(response.url===url,'Original native final URL changed')
    const expected=corporate(url),redirect=expected?.status===308
    if(response.status!==(redirect?308:200))throw fail('Original native HTTP '+response.status,{status:response.status,requestUrl:url})
    need(kindMime[kind].test(response.headers['content-type']??''),'Original native '+kind+' MIME changed')
    need(!(bytes[0]===239&&bytes[1]===187&&bytes[2]===191),'Original native BOM requires review')
    const body=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)
    check();return{url,status:response.status,body,bytes,sha256:receipt.sha256,headers:response.headers}
   }catch(error){options.signal?.throwIfAborted();check();throw error}
   finally{receipt.completedAt=new Date().toISOString()}
  },
  stats:()=>({requests:receipts.length,decodedBytes:bytesRead,requestTimeoutMs,sourceTimeoutMs,maxRequests,perResponseBytes:16*1024*1024,aggregateBytes:24*1024*1024,receipts:structuredClone(receipts)}),
  close(){closed=true;clearTimeout(timer);controller.abort()},
 }
}
function exactEntity(page,profile,label){need(page.url===profile.url&&page.bytes.length===profile.bytes&&page.sha256===profile.sha256,label+' original entity changed')}
function literal(node){
 if(node?.type==='Literal'){need(node.regex===undefined&&(node.value===null||['string','boolean','number'].includes(typeof node.value)),'Unreviewed native literal');return node.value}
 if(node?.type==='ArrayExpression'){need(node.elements.every(Boolean),'Native sparse data requires review');return node.elements.map(literal)}
 need(node?.type==='ObjectExpression','Native data is not literal')
 const result={}
 for(const field of node.properties){
  need(field.type==='Property'&&!field.computed&&!field.method&&field.kind==='init','Native computed data requires review')
  const key=field.key.type==='Identifier'?field.key.name:field.key.value
  need(typeof key==='string'&&!['__proto__','constructor','prototype'].includes(key)&&!Object.hasOwn(result,key),'Duplicate or unsafe native data field')
  result[key]=literal(field.value)
 }
 return result
}
async function declaration(read){
 const pages=[]
 for(const root of [CORPORATE,OPENINGS]){
  const redirect=await read.read(root);exactEntity(redirect,corporate(root),'Corporate redirect')
  const target=new URL(corporate(root).location,root).href
  need(redirect.headers.location===corporate(root).location&&target===root.slice(0,-1),'Current corporate slash redirect changed')
  const page=await read.read(target);exactEntity(page,corporate(target),'Current corporate document');pages.push(page)
 }
 const careers=readVisibleNativeDocument(pages[0].body,{strict:true}),links=careers.nodes(n=>n.tag==='a'&&n.attrs.href==='./all-job-openings')
 need(links.length===2&&links.some(n=>careers.text(n)==='View Career Opportunities')&&links.some(n=>careers.text(n)==='View all openings'),'Current corporate native handoff changed')
 const framer=readNativeDocument(pages[0].body).nodes(n=>n.tag==='script'&&n.attrs['data-framer-bundle']==='main')
 need(framer.length===1&&client(framer[0].attrs.src),'Current declared corporate client changed')
 const frames=readVisibleNativeDocument(pages[1].body,{strict:true}).frames()
 need(frames.length===1&&typeof frames[0].attrs.srcdoc==='string'&&!frames[0].attrs.src,'Current own embedded native board changed')
 const embedded=readNativeDocument(frames[0].attrs.srcdoc),loads=[]
 for(const script of embedded.nodes(n=>n.tag==='script'&&!n.attrs.src&&n.attrs.type==='text/javascript')){
  const program=parse(script.raw,{ecmaVersion:'latest'})
  for(const node of program.body)if(node.type==='ExpressionStatement'&&node.expression.type==='CallExpression'){
   const call=node.expression
   if(call.callee.type==='MemberExpression'&&!call.callee.computed&&call.callee.object.name==='rec_embed_js'&&call.callee.property.name==='load'&&call.arguments.length===1)loads.push(literal(call.arguments[0]))
  }
 }
 need(loads.length===1&&same(loads[0],{widget_id:'rec_job_listing_div',page_name:'Careers',source:'CareerSite',site:SITE,brand_color:'#6875E2',empty_job_msg:'No current Openings'}),'Current embedded native load protocol changed')
 const scripts=embedded.nodes(n=>n.tag==='script'&&n.attrs.src),styles=embedded.nodes(n=>n.tag==='link'&&n.attrs.rel==='stylesheet')
 need(scripts.length===1&&styles.length===1&&client(scripts[0].attrs.src)?.kind==='javascript'&&client(styles[0].attrs.href)?.kind==='css','Current embedded client declarations changed')
 for(const url of [framer[0].attrs.src,scripts[0].attrs.src,styles[0].attrs.href])exactEntity(await read.read(url),client(url),'Declared current client')
 return{corporate:pages.map(page=>({url:page.url,sha256:page.sha256})),nativeLoad:loads[0],iframeHeightInitiallyZero:true,activationVerified:false}
}
const rowFields=['Posting_Title','Is_Locked','City','Industry','Job_Description','Job_Type','Job_Opening_Name','State','Currency','Country','$url','id','Publish','Date_Opened','Keep_on_Career_Site','Work_Experience']
function date(value,detail=false){
 const match=(detail?/^(\d{4})-(\d{2})-(\d{2})$/:/^(\d{2})\/(\d{2})\/(\d{4})$/).exec(value)
 need(match,'Invalid native Date_Opened')
 const iso=detail?value:match[3]+'-'+match[1]+'-'+match[2]
 need(Number.isFinite(Date.parse(iso))&&new Date(iso).toISOString().slice(0,10)===iso,'Impossible native Date_Opened');return iso
}
function checkedRoleURL(value,id){
 let url;try{url=new URL(value)}catch{throw fail('Invalid native role URL')}
 const match=/^\/jobs\/Careers\/(836634\d{12})\/[-A-Za-z0-9%]+$/.exec(url.pathname)
 need(url.href===value&&url.origin===SITE&&!url.username&&!url.password&&!url.hash&&match&&(!id||match[1]===id)&&url.search==='?source=CareerSite','Native role account/identity changed')
 return value
}
export function readSorocoListing(body){
 let payload;try{payload=JSON.parse(body)}catch{throw fail('Malformed original native listing')}
 need(keys(payload,['code','data','info'])&&payload.code==='success'&&Array.isArray(payload.data)&&payload.data.length<=200,'Native listing count/continuation contract changed')
 need(keys(payload.info,['layout','keys','page_name','brand_color','fields','facets'])&&payload.info.layout===3&&payload.info.page_name==='Careers'&&payload.info.brand_color==='#6875E2'
  &&hash(JSON.stringify(payload.info))===PROFILE.listingInfoSHA256,'Native listing metadata changed')
 const ids=new Set()
 for(const row of payload.data){
  need(object(row)&&Object.keys(row).every(key=>rowFields.includes(key))&&rowFields.filter(key=>key!=='Work_Experience').every(key=>Object.hasOwn(row,key)),'Native listing role schema changed')
  need(/^836634\d{12}$/.test(row.id)&&!ids.has(row.id)&&typeof row.Posting_Title==='string'&&row.Posting_Title.trim()&&row.Posting_Title===row.Job_Opening_Name,'Native listing role identity changed');ids.add(row.id)
  need(['Is_Locked','Publish','Keep_on_Career_Site'].every(key=>typeof row[key]==='boolean')&&Object.entries(row).every(([key,value])=>['Is_Locked','Publish','Keep_on_Career_Site'].includes(key)||typeof value==='string'&&Buffer.byteLength(value)<=256*1024),'Native listing role field type changed')
  checkedRoleURL(row.$url,row.id);date(row.Date_Opened)
 }
 return payload
}
function carrierValue(program,row){
 need(Buffer.byteLength(program)<=512*1024,'Excessive native data carrier')
 const ast=parse(program,{ecmaVersion:'latest'}),values={}
 need(ast.body.length===PROFILE.carrierPlan.length,'Native carrier execution plan changed')
 for(const[index,expected]of PROFILE.carrierPlan.entries()){
  const node=ast.body[index];need(node.type===expected.type,'Native carrier execution plan changed')
  if(expected.type!=='VariableDeclaration'){need(hash(program.slice(node.start,node.end))===expected.sha256,'Native carrier executable statement changed');continue}
  need(node.kind===expected.kind&&node.declarations.length===expected.declarations.length,'Native carrier declaration plan changed')
  for(const[offset,field]of expected.declarations.entries()){
   const declaration=node.declarations[offset];need(declaration.id.type==='Identifier'&&declaration.id.name===field.name,'Native carrier binding changed')
   if(field.kind==='exact-original-expression'){need(hash(program.slice(declaration.init.start,declaration.init.end))===field.sha256,'Native carrier expression changed');continue}
   if(field.kind==='original-json-array'){
    const call=declaration.init
    need(call?.type==='CallExpression'&&call.callee.type==='MemberExpression'&&!call.callee.computed&&call.callee.object.name==='JSON'&&call.callee.property.name==='parse'&&call.arguments.length===1&&call.arguments[0].type==='Literal'&&typeof call.arguments[0].value==='string','Native job JSON declaration changed')
    try{values.jobs=JSON.parse(call.arguments[0].value)}catch{throw fail('Malformed native original job data')}
    continue
   }
   const value=literal(declaration.init)
   if(field.kind==='unconsumed-public-csrf-data'){need(typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value),'Native public request-token data changed');continue}
   if(field.kind==='exact-json')need(hash(JSON.stringify(value))===field.sha256,'Native full field/layout metadata changed')
   else if(field.kind==='exact-literal')need(same(value,field.value),'Native literal program configuration changed')
   else if(field.kind==='controlled-native-meta'){
    const fixed=structuredClone(value);delete fixed.detail_url;delete fixed.shorten_url
    need(same(fixed,PROFILE.meta)&&value.detail_url===row.$url&&typeof value.shorten_url==='string'&&/^https:\/\/zurl\.to\/[A-Za-z0-9]{4}\?source=CareerSite$/.test(value.shorten_url),'Native exact employer/public detail metadata changed')
   }else throw fail('Unknown native carrier plan')
   values[field.name]=value
  }
 }
 need(Array.isArray(values.jobs)&&values.jobs.length===1,'Native exact job detail count changed')
 return values
}
function presentationPlan(root,row=null){
 const title=row?'Soroco - '+row.Posting_Title+' in '+row.City:null,description=row?('Soroco '+row.Job_Description).slice(0,150):null
 const visit=node=>{
  const attrs={...node.attrs}
  if(row&&node.tag==='meta'){
   const name=attrs.name??attrs.property
   if(['description','twitter:description','og:description'].includes(name)){need(attrs.content===description,'Native document presentation metadata changed');attrs.content={slot:'native-description-prefix'}}
   if(['twitter:title','twitter:image:alt','og:title'].includes(name)){need(attrs.content===title,'Native document presentation metadata changed');attrs.content={slot:'native-title'}}
   if(name==='og:url'){need(attrs.content===row.$url,'Native document presentation metadata changed');attrs.content={slot:'native-role-url'}}
  }
  return{tag:node.tag,attrs,unqualifiedTag:Boolean(node.nativeTagUnqualified),children:row&&['script','style','title'].includes(node.tag)?[]:node.children.map(child=>typeof child==='string'?(row?{exactText:child}:{slot:'original-native-criteria-text'}):visit(child))}
 }
 return visit(root)
}
export function readSorocoDetail(body,row){
 const title='Soroco - '+row.Posting_Title+' in '+row.City
 const owned=readOwnedCurrentDocument(body,{failure:fail,title,canonical:row.$url,stylesheetFragment:true,eventPrograms:[]}),visible=readVisibleNativeDocument(body,{strict:true})
 need(visible.nodes(n=>n.tag==='div'&&n.attrs.id==='career-website-main').length===1,'Native active detail mount unavailable')
 const scripts=owned.raw.nodes(n=>n.tag==='script')
 need(scripts.length===PROFILE.nativeScripts.length,'Native detail script declarations changed')
 let values,currentDeployment=false
 for(const[index,expected]of PROFILE.nativeScripts.entries()){
  const script=scripts[index];need(same(script.attrs,expected.attrs),'Native detail script attributes changed')
  if(expected.carrier)values=carrierValue(script.raw,row)
  else{
   const fingerprint=hash(script.raw||'')
   // The Nov16 literal CDN map has the same complete declaration envelope
   // and executable carrier plan as Nov14. Qualify only its reviewed bytes;
   // every other inline program and script attribute retains its exact pin.
   const currentMap=expected.sha256==='652e311ad823df25a17b6a85077d3def127f58a632f18534467dc09d449536a3'&&fingerprint==='9379df00e3d110cbe9d481a45f70764b39f6bbdce8ec0fb3b1693c8e270d5467'
   need(fingerprint===expected.sha256||currentMap,'Native inline program changed')
   if(currentMap)currentDeployment=true
  }
 }
 // Nov16 adds only static social-icon backgrounds to the brand CSS and
 // changes the two declared CDN stylesheet revisions. Keep the complete
 // CSS, declaration inventory and document plan paired to that map.
 const styles=owned.nodes.filter(n=>n.tag==='style').map(n=>({attrs:n.attrs,sha256:hash(n.raw||'')})),links=owned.nodes.filter(n=>n.tag==='link').map(n=>n.attrs)
 need(currentDeployment?hash(canonicalNativeRecord(styles))==='086e38dd49b92b92a57e8215bf324bb15cbc7f1118fdc78130940e928984ac38':same(styles,PROFILE.nativeStyles),'Native document CSS changed')
 need(currentDeployment?hash(canonicalNativeRecord(links))==='a61eef2a232e95ed085f527fb7f7a72651a0545a161f6b41ec8e7e971d85607a':same(links,PROFILE.nativeStylesheets),'Native stylesheet declarations changed')
 const owners=owned.nodes.filter(n=>n.attrs.id==='career-website-main')
 need(owners.length===1&&owners[0].tag==='div','Native detail owner inventory changed')
 const presentation=presentationPlan(owned.root,row)
 need(currentDeployment?hash(canonicalNativeRecord(presentation))==='cf6e1fbb80a2504d60f9b29e06a78b65442f42400c584869dc98ffc13c53f8f2':same(presentation,PROFILE.nativeDocumentPlan),'Native document presentation changed')
 const record=values.jobs[0],expected=Object.keys(row).filter(key=>key!=='$url').concat('Zip_Code')
 need(keys(record,expected),'Native full role field schema changed')
 for(const key of expected.filter(key=>!['Job_Description','Date_Opened','Zip_Code'].includes(key)))need(record[key]===row[key],'Native listing/detail '+key+' mismatch')
 need(record.Country==='India'&&row.Country==='India','Native explicit country is unqualified')
 need(record.Publish===true&&record.Is_Locked===false&&typeof record.Zip_Code==='string','Native detail publication state changed')
 need(date(record.Date_Opened,true)===date(row.Date_Opened),'Native listing/detail Date_Opened mismatch')
 const criteria=readOriginalNativeCriteria(record.Job_Description,fail)
 need(criteria.sourceDetailComplete&&/\b(?:responsibilities|requirements|qualifications|skills)\b/i.test(criteria.sourceDescription),'Native full original role criteria unavailable')
 need(!/\b(?:(?:this|the) (?:job|role|position|vacancy) (?:is |has been |has )?(?:closed|filled|expired)|(?:we are |we're )?no longer accepting applications|applications? (?:are |have been )?closed)\b/i.test(criteria.sourceDescription),'Explicit native closed role notice')
 const compact=value=>value.replace(/[\s\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g,'')
 need(compact(decodeHTML(row.Job_Description))===compact(decodeHTML(criteria.sourceDescription)),'Native complete criteria carriers disagree')
 const criteriaRoot=readNativeDocument(record.Job_Description).nodes(node=>node.tag==='root')[0]
 need(PROFILE.nativeCriteriaPlans.some(plan=>same(presentationPlan(criteriaRoot),plan)),'Native criteria presentation changed')
 return{record,criteria:{...criteria,sourceCriteriaPresentation:'complete-original-native-criteria-text-and-finite-reviewed-inputs;live-external-CSS-and-rendered-activation-unverified'},org:values.meta.org_info,clientURLs:scripts.filter(n=>n.attrs.src&&client(n.attrs.src)).map(n=>n.attrs.src)}
}
export async function runCurrentSoroco(options={}){
 const read=reader(options),observedAt=(options.now??(()=>new Date().toISOString()))(),facts=[],holds=[]
 try{
  need(typeof observedAt==='string'&&Number.isFinite(Date.parse(observedAt)),'Invalid source observation clock')
  const openingDeclaration=await declaration(read),opening=readSorocoListing((await read.read(API)).body)
  const collect=async(payload,closing=false)=>{
   const results=[],verifiedClients=new Set()
   for(const row of payload.data){
    read.check()
    if(row.Country!=='India'||row.Publish!==true||row.Is_Locked!==false){if(!closing)holds.push({id:row.id,reason:row.Country!=='India'?'native-country-unqualified':'native-unpublished-or-locked',record:row});continue}
    read.allow(row.$url);const detail=readSorocoDetail((await read.read(row.$url)).body,row)
    for(const url of detail.clientURLs)if(!verifiedClients.has(url)){exactEntity(await read.read(url),client(url),'Declared native full-detail client');verifiedClients.add(url)}
    need(verifiedClients.size===2,'Native full-detail client declarations changed')
    need(Date.parse(detail.record.Date_Opened)<=Date.parse(observedAt),'Native Date_Opened is in the future')
    results.push({row,...detail})
   }
   return results
  }
  facts.push(...await collect(opening))
  const closingDeclaration=await declaration(read),closing=readSorocoListing((await read.read(API)).body)
  need(same(openingDeclaration,closingDeclaration)&&same(opening,closing),'Native complete listing or corporate handoff changed at closing')
  const last=await collect(closing,true)
  need(facts.length===last.length&&facts.every((fact,index)=>same(fact.record,last[index].record)&&same(fact.org,last[index].org)),'Native full detail changed at closing')
  const jobs=facts.map((fact,index)=>{
   const record=fact.record,criteria=fact.criteria
   return{...criteria,jobDescription:record.Job_Description,sourceDescription:record.Job_Description,sourceDescriptionText:criteria.sourceDescription,
    source:'soroco',company:'Soroco',title:record.Posting_Title,jobId:record.id,requisitionId:record.id,
    sourceUrl:fact.row.$url,applyUrl:fact.row.$url,link:fact.row.$url,nativeApplyHandoff:{kind:'current-own-public-native-detail-page',url:fact.row.$url,applicationActionVerified:false},
    country:'India',location:[record.City,record.State,record.Country].filter(Boolean).join(', '),city:record.City||null,state:record.State||null,
    department:record.Industry||null,employmentType:record.Job_Type,experienceRequired:record.Work_Experience||null,remoteStatus:null,
    postingDate:record.Date_Opened,nativeDateOpened:record.Date_Opened,nativePublicationDateProvenance:'original-public-Zoho-Date_Opened',nativeFirstEverPublicationUnverified:true,closingDate:null,
    sourceNativeListingRecord:fact.row,sourceNativeDetailRecord:record,sourceNativeClosingListingRecord:last[index].row,sourceNativeClosingDetailRecord:last[index].record,
    nativeEmployerBinding:{method:'exact-current-corporate-srcdoc-native-internal-org',organization:fact.org,legalEmployer:null},
    sourceClosingReconciled:true,nativeCriteriaTextComplete:true,currentCSSCoverage:false,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,activationVerified:false,
    scrapedAt:observedAt,companyCareerPage:CORPORATE,companyDomain:'soroco.com',atsPlatform:'official-company-careers'}
  })
  const audit={source:'soroco',recordKind:'vacancy-rows',observedRecordCount:opening.data.length,observedVacancyCount:opening.data.length,returnedCount:jobs.length,
   sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,activationVerified:false,currentCSSCoverage:false,
   nativeCriteriaQualification:'Complete original native criteria text under finite reviewed document/criteria input envelopes; live external CSS and rendered activation remain unverified.',
   openingClosingListingMatch:true,originalOpeningRecords:opening.data,originalClosingRecords:closing.data,holds,
   publicationDateSemantics:'Original Date_Opened retained; first-ever public publication is unverified.',declaration:openingDeclaration,reader:read.stats(),observationTime:observedAt}
  attachSourceObservationEvidence(jobs,audit);Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:OPENINGS,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,reportedTotal:null,indiaFacetCount:null,
   pagesFetched:audit.reader.requests,verifiedAt:observedAt,reason:'exact-own-native-India-original-full-criteria-and-closing-reconciled;company-scope-current-CSS-and-rendered-activation-unverified'})
  need(Buffer.byteLength(JSON.stringify({jobs,audit}))<=8*1024*1024,'Native output byte budget exceeded');read.check();return jobs
 }finally{read.close()}
}
