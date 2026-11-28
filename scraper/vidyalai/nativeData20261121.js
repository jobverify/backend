import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {bounded} from '../bizongo/publicRead.js'
import profile from './native-profile-20261121.json' with {type:'json'}
const SOURCE='vidyalai',COMPANY='Vidyalai',HOME='https://www.vidyalai.com/',BOARD='https://erp.vidyalai.com/jobs'
const sha=value=>createHash('sha256').update(value).digest('hex'),norm=value=>String(value??'').replace(/\s+/g,' ').trim()
const fail=message=>Object.assign(Error('Vidyalai native data: '+message),{code:'VIDYALAI_NATIVE_DATA',abortRetries:true})
const need=(ok,message)=>{if(!ok)throw fail(message)},one=(nodes,label)=>{need(nodes.length===1,'expected one '+label);return nodes[0]}
const cls=(node,name)=>(node.attrs.class??'').split(/\s+/).includes(name)
const literal=(node,label)=>need(node.children.every(child=>typeof child==='string'),'nonliteral native '+label+' data slot')
const relativePublication=value=>/^(?:·\s*)?(?:(?:\d+|a|an)\s+(?:second|minute|hour|day|week|month|year)s?\s+ago)?$/.test(norm(value))
const tree=html=>readNativeDocument(html,{sourceRanges:true})
const inner=(html,node)=>{need(Number.isInteger(node.sourceCloseStart),'unterminated native data owner');return html.slice(node.sourceOpenEnd,node.sourceCloseStart)}
const raw=(html,node)=>html.slice(node.sourceStart,node.sourceEnd)
const splice=(html,ranges)=>{let end=0,result='';for(const range of ranges.sort((a,b)=>a.start-b.start)){need(range.start>=end&&range.end>=range.start,'overlapping native data owners');result+=html.slice(end,range.start)+range.value;end=range.end}return result+html.slice(end)}
const field=(html,node,name,value)=>{
 const opening=html.slice(node.sourceStart,node.sourceOpenEnd),pattern=new RegExp('(?:^|\\s)'+name+'\\s*=\\s*(["\\\'])([\\s\\S]*?)\\1','g'),matches=[...opening.matchAll(pattern)]
 need(matches.length===1,'ambiguous native attribute '+name)
 const match=matches[0],offset=match.index+match[0].indexOf(match[1])+1
 return{start:node.sourceStart+offset,end:node.sourceStart+offset+match[2].length,value}
}
const contents=(node,value)=>({start:node.sourceOpenEnd,end:node.sourceCloseStart,value})

// These pure projections expose DATA only. Every byte outside the explicitly
// mapped native values remains significant, including all inline programs,
// external declarations, styles, comments and the rest of the document.
export function projectNativeBoard(html){
 const doc=tree(html),cards=doc.nodes(n=>n.tag==='div'&&n.attrs.name==='card'),meta=one(doc.nodes(n=>n.tag==='meta'&&n.attrs.id==='data'),'board data record')
 need(meta.attrs['data-no-of-pages']==='1','unreviewed native pagination')
 const count=String(html).match(/Showing\s+(\d+)\s+results/);need(count&&Number(count[1])===cards.length&&cards.length>0&&cards.length<=64,'native row count or pagination mismatch')
 const ranges=[],records=cards.map(card=>{
  const titleNode=one(doc.nodes(n=>n.tag==='h4',card),'native card title'),title=doc.text(titleNode),route=card.attrs.id
  need(title&&titleNode.attrs.title===title,'native card title identity changed')
  need(typeof route==='string'&&/^(?:jobs\/vidyalai\/[a-z0-9()_-]+|academic-associate-[a-z0-9-]+)$/.test(route),'unreviewed role route')
  const url=new URL(route,BOARD).href;need(new URL(url).origin==='https://erp.vidyalai.com','native role origin changed')
  const company=one(doc.nodes(n=>n.tag==='span'&&cls(n,'font-weight-bold'),card),'native card employer');need(doc.text(company)===COMPANY,'native card employer changed')
  const details=doc.nodes(n=>n.tag==='div'&&n.attrs.class==='mt-3 flex align-items-center',card);need(details.length===2,'native card field schema changed')
  const badge=one(doc.nodes(n=>n.tag==='div'&&/(?:^|\s)[a-z-]+-badge(?:\s|$)/.test(n.attrs.class??''),card),'native employment badge')
  const publication=one(doc.nodes(n=>n.tag==='span'&&n.attrs.class==='text-secondary',card),'native publication label')
  literal(publication,'publication')
  need(relativePublication(doc.text(publication)),'native publication meaning changed')
  ranges.push({start:card.sourceStart,end:card.sourceEnd,value:'<VIDYALAI-NATIVE-CARD-DATA>'})
  const cardShellSHA256=sha(html.slice(card.sourceStart,publication.sourceOpenEnd)+'@NATIVE_PUBLICATION'+html.slice(publication.sourceCloseStart,card.sourceEnd))
  return{route,url,title,company:COMPANY,location:doc.text(details[0]),department:doc.text(details[1]),nativeEmploymentType:doc.text(badge).replace(/^[•·]\s*/,''),nativePublicationText:inner(html,publication),nativeCardHTML:raw(html,card),cardShellSHA256}
 })
 need(new Set(records.map(row=>row.route)).size===records.length,'duplicate native identities')
 return{shellSHA256:sha(splice(html,ranges)),records,originalHTMLSHA256:sha(html),rawFilters:meta.attrs['data-filters']}
}

export function projectNativeDetail(html,record){
 const doc=tree(html),ranges=[],main=one(doc.nodes(n=>n.tag==='main'),'native detail main'),title=one(doc.nodes(n=>n.tag==='title'),'native document title')
 need(norm(title.raw)===record.title,'native detail title mismatch');ranges.push(contents(title,'@NATIVE_TITLE'))
 const heading=one(doc.nodes(n=>n.tag==='h1',main),'native role heading');literal(heading,'heading');need(doc.text(heading)===record.title,'native role heading mismatch');ranges.push(contents(heading,'@NATIVE_TITLE'))
 const paths=doc.nodes(n=>n.attrs['data-path']!==undefined);need(paths.length===2,'native route owner count changed')
 for(const node of paths){need(node.attrs['data-path']===record.route,'native role route mismatch');ranges.push(field(html,node,'data-path','@NATIVE_ROUTE'))}
 const owner=one(paths.filter(n=>n.attrs['data-doctype']==='Job Opening'),'native Job Opening owner');need(owner.attrs.id==='page-'+record.title&&owner.attrs['source-type']==='Generator','native role type or identity changed');ranges.push(field(html,owner,'id','@NATIVE_PAGE_ID'))
 const metadata=doc.nodes(n=>n.tag==='meta'&&['title','og:title','twitter:title','description','og:description','twitter:description'].includes(n.attrs.name??n.attrs.property))
 need(metadata.length===6,'native metadata schema changed')
 for(const node of metadata){const name=node.attrs.name??node.attrs.property;if(name.endsWith('title'))need(node.attrs.content===record.title,'native metadata title mismatch');ranges.push(field(html,node,'content','@NATIVE_'+(name.endsWith('title')?'TITLE':'DESCRIPTION')))}
 const breadcrumb=one(doc.nodes(n=>n.tag==='span'&&n.attrs.itemprop==='name'&&doc.text(n)===record.title),'native breadcrumb title');literal(breadcrumb,'breadcrumb');ranges.push(contents(breadcrumb,'@NATIVE_TITLE'))
 const labels=doc.nodes(n=>n.tag==='div'&&cls(n,'text-uppercase'),main);need(labels.length===3,'native detail field schema changed')
 const parents=new WeakMap(),walk=node=>{for(const child of node.children??[])if(typeof child!=='string'){parents.set(child,node);walk(child)}};walk(main)
 const fields={}
 for(const label of labels){
  const name=doc.text(label);need(['Location','Department','Employment Type'].includes(name)&&!Object.hasOwn(fields,name),'native detail label changed')
  const siblings=parents.get(label)?.children.filter(child=>typeof child!=='string');need(siblings?.length===2&&siblings[0]===label&&cls(siblings[1],'font-weight-bold'),'native detail field ownership changed')
  literal(siblings[1],name);fields[name]=doc.text(siblings[1]);ranges.push(contents(siblings[1],'@NATIVE_'+name))
 }
 need(fields.Location===record.location&&fields.Department===record.department&&fields['Employment Type']===record.nativeEmploymentType,'native card/detail fields disagree')
 const employer=one(doc.nodes(n=>n.tag==='span'&&cls(n,'font-weight-bold')&&doc.text(n)===COMPANY,main),'native detail employer'),publicationOwner=parents.get(employer)
 literal(employer,'employer');need(Object.keys(employer.attrs).length===1&&employer.attrs.class==='font-weight-bold','native publication employer label markup changed')
 need(publicationOwner.children.filter(child=>typeof child!=='string').length===1,'native publication owner changed')
 need(relativePublication(doc.text(publicationOwner).slice(COMPANY.length)),'native detail publication meaning changed')
 const publicationHTML=inner(html,publicationOwner);ranges.push(contents(publicationOwner,'@NATIVE_EMPLOYER_AND_PUBLICATION'))
 const description=one(doc.nodes(n=>n.tag==='div'&&cls(n,'ql-editor')&&cls(n,'read-mode'),main),'full native criteria owner'),descriptionHTML=inner(html,description),descriptionText=extractActiveDescription(descriptionHTML)
 need(descriptionText,'full native criteria missing');need(!/<(?:script|iframe|object|template)\b/i.test(descriptionHTML),'unreviewed executable criteria data')
 ranges.push(contents(description,'@FULL_NATIVE_CRITERIA'))
 const applications=doc.nodes(n=>n.tag==='a'&&doc.text(n)==='Apply Now',main);need(applications.length===2,'native application declaration count changed')
 const applicationURLs=applications.map(node=>{const url=new URL(node.attrs.href,record.url);need(url.origin==='https://erp.vidyalai.com'&&!url.username&&!url.password&&url.searchParams.get('job_title')===record.title,'native application identity changed');ranges.push(field(html,node,'href','@NATIVE_APPLICATION'));return url.href})
 need(new Set(applicationURLs).size===1,'native application declarations disagree')
 return{shellSHA256:sha(splice(html,ranges)),originalHTMLSHA256:sha(html),record:{...record,nativeMetadata:metadata.map(n=>({...n.attrs})),nativeDetailPublicationHTML:publicationHTML,nativeDetailHTML:html,jobDescription:descriptionHTML,jobDescriptionText:descriptionText,applyUrl:applicationURLs[0],fields}}
}

export const inspectNativeBoard=html=>{
 const value=projectNativeBoard(html);need(profile.ready&&value.shellSHA256===profile.boardShellSHA256&&value.records.length===Object.keys(profile.roles).length,'whole native board/program/style contract changed')
 for(const record of value.records)need(profile.roles[record.route]?.cardShellSHA256===record.cardShellSHA256,'native card identity/employer/country/fields/markup changed')
 return value
}
export const inspectNativeDetail=(html,record)=>{
 const value=projectNativeDetail(html,record),reviewed=profile.roles?.[record.route]
 // Route-owned public session variants keep every program/style byte significant.
 need(profile.ready&&reviewed&&[reviewed.detailShellSHA256,...(reviewed.additionalReviewedDetailShellSHA256s??[])].includes(value.shellSHA256),'whole native detail/program/style contract changed')
 need(sha(value.record.jobDescription)===reviewed.criteriaSHA256&&sha(JSON.stringify(value.record.nativeMetadata))===reviewed.metadataSHA256,'full native criteria/metadata changed')
 need(value.record.applyUrl===reviewed.applicationDeclaration,'native application declaration changed')
 return value.record
}

export async function runNativeVidyalai(options={}){
 options.signal?.throwIfAborted()
 const cap=options.maxJobs,interval=options.requestIntervalMs??250
 need(cap==null||Number.isSafeInteger(cap)&&cap>=0,'invalid caller cap')
 need(Number.isSafeInteger(interval)&&interval>=0&&interval<=1000,'invalid request pacing')
 const budget=options.collectionBudgetMs??90000;need(Number.isSafeInteger(budget)&&budget>0&&budget<=90000,'invalid collection budget')
 const controller=new AbortController(),timeout=Object.assign(fail('collection deadline exceeded'),{name:'TimeoutError'}),timer=setTimeout(()=>controller.abort(timeout),budget),signals=[options.signal,controller.signal].filter(Boolean),receipts=[]
 const read=async(url,phase)=>{
  if(receipts.length&&interval)await bounded(()=>delay(interval),signals)
  const signal=AbortSignal.any([...signals,AbortSignal.timeout(10000)]),init={method:'GET',redirect:'manual',credentials:'omit',signal,headers:{Accept:'text/html,application/xhtml+xml,*/*','User-Agent':'Mozilla/5.0'}}
  const response=await bounded(()=>(options.fetchPage??options.fetchImpl??globalThis.fetch)(url,init),[...signals,signal])
  need(response&&typeof response==='object'&&response.status===200&&response.url===url&&response.redirected!==true,'public HTTP/URL hold; stopped without redirect or retry')
  const contentType=response.headers?.get?.('content-type')??response.headers?.['content-type'];need(typeof contentType==='string'&&/^text\/html(?:;|$)/i.test(contentType),'native HTML response metadata changed')
  let html
  if(response.body?.getReader){
   const reader=response.body.getReader(),chunks=[];let size=0,complete=false
   try{for(;;){const part=await bounded(()=>reader.read(),[...signals,signal]);if(part.done){complete=true;break}size+=part.value.byteLength;if(size>2*1024*1024)throw fail('public original byte bound exceeded');chunks.push(Buffer.from(part.value))}html=Buffer.concat(chunks,size).toString('utf8')}finally{if(!complete)void reader.cancel().catch(()=>{});reader.releaseLock()}
  }else html=response.html??(typeof response.body==='string'?response.body:await bounded(()=>response.text(),[...signals,signal]))
  need(typeof html==='string'&&Buffer.byteLength(html)<=2*1024*1024,'invalid public native original')
  need(!/<title>\s*(?:Login|Access Denied|Just a moment|Verify you are human)/i.test(html),'public access or login hold')
  receipts.push({url,phase,sha256:sha(html),bytes:Buffer.byteLength(html)});return html
 }
 try{
  for(const signal of signals)signal.throwIfAborted()
  need(profile.ready,'native deployment not qualified')
  // Each complete corporate original supplies static SSR delegation only.
  // Changed corporate programs are not executed or qualified as browser behavior.
  const home=await read(HOME,'initial');need([profile.homeSHA256,...profile.additionalReviewedCorporateSHA256s].includes(sha(home)),'whole current corporate native authority changed')
  const firstHTML=await read(BOARD,'initial'),first=inspectNativeBoard(firstHTML),records=[]
  for(const record of first.records)records.push(inspectNativeDetail(await read(record.url,'initial'),record))
  const closingHome=await read(HOME,'closing');need(closingHome===home,'corporate closing snapshot changed')
  const lastHTML=await read(BOARD,'closing'),last=inspectNativeBoard(lastHTML);need(lastHTML===firstHTML,'native listing closing snapshot changed')
  for(let index=0;index<last.records.length;index++){
   const current=inspectNativeDetail(await read(last.records[index].url,'closing'),last.records[index]);need(current.nativeDetailHTML===records[index].nativeDetailHTML,'full criteria/identity/fields closing snapshot changed')
  }
  const now=typeof options.now==='function'?options.now():options.now??new Date().toISOString();need(Number.isFinite(Date.parse(now)),'invalid observation clock')
  const verifiedAt=new Date(now).toISOString(),nativePayload=records.map(record=>({source:SOURCE,company:COMPANY,title:record.title,jobId:record.route,requisitionId:null,sourceUrl:record.url,link:null,applyUrl:null,nativeApplicationDeclaration:record.applyUrl,
   location:record.location,city:record.location==='Remote'?null:record.location,state:null,country:null,countryCode:null,sourceCountryScopeUnresolved:true,remoteStatus:record.location==='Remote'?'Remote':null,department:record.department,employmentType:record.nativeEmploymentType,
   jobDescription:record.jobDescription,postingDate:null,closingDate:null,sourcePublicationDateUnavailable:true,nativePublicationText:record.nativePublicationText,nativeDetailPublicationHTML:record.nativeDetailPublicationHTML,
   sourceScopeComplete:false,lifecycleCleanupAllowed:false,sourceListingComplete:false,sourceDetailComplete:false,criteriaComplete:true,renderedUIQualified:false,applicationVerified:false,scrapedAt:verifiedAt,nativeRawModel:record}))
  const observations={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:records.length,observedVacancyCount:records.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null}
  const evidence={...observations,nativePayload,fullRawCriteriaRecords:records.length,unknownWorkCountryRecords:records.length,configuredRawBoardComplete:true,completeInventory:false,closingReconciled:true,lifecycleCleanupAllowed:false,renderedUIQualified:false,applicationVerified:false,receipts}
  for(const callback of[options.onNativeEvidence,options.onAudit])if(callback)await bounded(()=>callback(structuredClone(evidence)),signals)
  if(options.onRecords)await bounded(()=>options.onRecords(structuredClone(nativePayload)),signals)
  const jobs=attachSourceObservationEvidence(cap==null?nativePayload:nativePayload.slice(0,cap),observations)
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:evidence,configurable:true})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt,reason:'full-native-SSR-data-only;work-country-unresolved;company-rendering-and-application-unqualified'})
  for(const signal of signals)signal.throwIfAborted();return jobs
 }finally{clearTimeout(timer);if(!controller.signal.aborted)controller.abort()}
}
