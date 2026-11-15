import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {parseEightfoldJson} from '../../scraper-support/utils/recruitmentEightfoldData.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const profile=JSON.parse(fs.readFileSync(new URL('./currentProfile20261115.json',import.meta.url),'utf8'))
const sha=value=>createHash('sha256').update(value).digest('hex')
const nativeByteLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get
const problem=message=>Object.assign(Error('RxLogix current native: '+message),{softFailure:true,abortRetries:true,failureKind:'coverage_gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false})
const need=(value,message)=>{if(!value)throw problem(message)}
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const one=(values,label)=>{need(values.length===1,'missing or ambiguous '+label);return values[0]}
const all=(node,out=[])=>{out.push(node);for(const child of node.children||[])if(typeof child==='object')all(child,out);return out}
const rawText=node=>typeof node==='string'?node:['script','style'].includes(node.tag)?'':node.children.map(rawText).join(' ')
const norm=value=>decodeNativeEntities(value).replace(/\s+/g,' ').trim()
const unavailable=/\b(?:(?:applications\s+are|recruitment\s+is)\s+(?:(?:now|currently)\s+)?closed|applications\s+are\s+no\s+longer\s+(?:being\s+)?accepted|(?:we\s+are\s+)?no\s+longer\s+accepting\s+applications|(?:this|the)\s+(?:job|position|role)\s+is\s+(?:closed|filled|unavailable|not\s+available|no\s+longer\s+available))\b/i
const rootOf=doc=>one(doc.nodes(node=>node.tag==='root'),'native document root')

// Full documents remain pinned. Only the six coupled translator references and
// initial values of the exact immediately overwritten hidden inputs may vary.
function documentProof(html,url){
 const expected=profile.documents[url],doc=readNativeDocument(html),nodes=all(rootOf(doc))
 need(expected&&!html.includes('RXLOGIX_EXACT_TRANSLATOR_ID')&&!html.includes('RXLOGIX_EXACT_INITIAL_SEED'),'unreviewed document context')
 const mount=one(nodes.filter(node=>node.attrs.id?.startsWith('gt-wrapper-')),'current translator mount')
 const token=mount.attrs.id.slice('gt-wrapper-'.length)
 need(/^\d{8}$/.test(token),'unreviewed translator identity')
 const bindings=[`<div class="gtranslate_wrapper" id="gt-wrapper-${token}"></div>`,`<script id="gt_widget_script_${token}-js-before">`,`window.gtranslateSettings['${token}'] = `,`"wrapper_selector":"#gt-wrapper-${token}"`,`//# sourceURL=gt_widget_script_${token}-js-before`,`data-gt-widget-id="${token}"`]
 need(bindings.every(value=>html.split(value).length===2)&&html.split(token).length===7,'translator references are not exactly coupled')
 let normalized=html.replaceAll(token,'RXLOGIX_EXACT_TRANSLATOR_ID')
 const seeds=[...html.matchAll(/(<input type="hidden" id="(ak_js_[12])" name="_wpcf7_ak_js" value=")([0-9]{1,13})("\/>)/g)]
 const nativeSeeds=nodes.filter(node=>node.tag==='input'&&node.attrs.name==='_wpcf7_ak_js')
 need(equal(seeds.map(match=>match[2]),Object.keys(expected.seedSetters))&&nativeSeeds.length===seeds.length,'unreviewed initial native antispam field')
 for(const match of seeds){
  const script=/^<script>([\s\S]*?)<\/script>/.exec(html.slice(match.index+match[0].length))?.[1]
  need(script&&sha(script)===expected.seedSetters[match[2]]&&html.split(match[0]).length===2,'initial seed has no exact immediate reviewed overwrite program')
  normalized=normalized.replace(match[0],match[1]+'RXLOGIX_EXACT_INITIAL_SEED'+match[4])
 }
 need(sha(normalized)===expected.normalizedSHA256,'full original publisher, criteria, control, attribute, style mode or inline program changed')
 const canonical=doc.nodes(node=>node.tag==='link'&&node.attrs.rel==='canonical'),title=doc.nodes(node=>node.tag==='title')
 need(canonical.length===expected.nativeCanonicalCopies&&canonical.every(node=>node.attrs.href===url),'own canonical publisher context changed')
 const wantedTitle=url===profile.board?'Careers at RxLogix | Join Our Team':profile.roleModels.find(model=>model.url===url)?.title+' - Rxlogix'
 need(title.length===expected.nativeTitleCopies&&title.every(node=>node.raw===wantedTitle),'own native document title context changed')
 const schemas=doc.nodes(node=>node.tag==='script'&&node.attrs.type==='application/ld+json').map(node=>parseEightfoldJson(node.raw))
 need(schemas.length===expected.nativeSchemaCopies,'original native schema context changed')
 for(const schema of schemas){
  need(schema['@context']==='https://schema.org'&&Array.isArray(schema['@graph']),'native publisher schema context missing')
  const organization=one(schema['@graph'].filter(row=>row['@type']==='Organization'),'own native publisher')
  need(organization['@id']===profile.corporate+'#organization'&&organization.name===profile.publisher&&organization.url===profile.corporate,'native publisher/account mismatch')
  const page=one(schema['@graph'].filter(row=>row['@type']==='WebPage'),'native own page')
  need(page.url===url&&page['@id']===url+'#webpage','native full page identity changed')
 }
 return{doc,nodes,normalizedSHA256:sha(normalized),schemas,passiveBindings:{translatorIdentity:token,initialAntispamSeeds:seeds.map(match=>({id:match[2],initialValue:match[3]}))}}
}
function cards(proof){
 const {doc}=proof,rows=doc.nodes(node=>node.tag==='a'&&doc.hasClass(node,'job_tab')).map((node,index)=>{
  const title=doc.text(one(doc.nodes(child=>doc.hasClass(child,'title'),node),'native card title'))
  const location=doc.text(one(doc.nodes(child=>doc.hasClass(child,'loc'),node),'native card location'))
  const url=new URL(node.attrs.href,profile.board).href
  need(new URL(url).origin===new URL(profile.corporate).origin&&url.endsWith('/')&&!new URL(url).search&&!new URL(url).hash,'unbound native card role URL')
  return{ordinal:index,title,location,url,originalCardText:doc.text(node),originalCardModel:structuredClone(node)}
 })
 need(rows.length===profile.rawCardCount&&new Set(rows.map(row=>row.url)).size===profile.uniqueRoleURLCount,'native original membership changed; no zero proof')
 return rows
}
function role(html,proof,model,card){
 const {doc,nodes}=proof,detail=one(doc.nodes(node=>doc.hasClass(node,'job-detail')),'complete own native role')
 const header=one(doc.nodes(node=>doc.hasClass(node,'apply_card'),detail),'native role application header')
 need(doc.text(one(doc.nodes(node=>doc.hasClass(node,'title'),header),'native role title'))===model.title&&card.title===model.title,'native card and own role title conflict')
 const location=doc.text(one(doc.nodes(node=>doc.hasClass(node,'loc'),header),'own complete country label'))
 need(location===model.location&&card.location===location&&location==='Noida, India','both independent native work-country labels must explicitly be India')
 const department=doc.text(one(doc.nodes(node=>node.tag==='h4',detail),'native own department'))
 need(department===model.department,'native own role department changed')
 const criteria=doc.text(detail),description=one(doc.nodes(node=>doc.hasClass(node,'job_des'),detail),'complete original criterion section')
 need(criteria.length===model.criteriaCharacters&&doc.text(description).length>1500&&!unavailable.test(criteria),'complete original criteria missing or explicitly unavailable')
 const employment=/\bJob Status:\s*(Full Time)\b/.exec(criteria)?.[1]||null
 need(employment===model.employmentType,'own role employment criteria changed')
 const apply=one(doc.nodes(node=>node.tag==='a'&&doc.text(node)==='Apply',header),'own native Apply control')
 need(apply.attrs.href==='#'&&apply.attrs['data-bs-toggle']==='modal'&&apply.attrs['data-bs-target']==='#applyModal','native modal application handoff changed')
 const modal=one(nodes.filter(node=>node.attrs.id==='applyModal'),'original own application modal'),children=all(modal)
 const label=one(children.filter(node=>node.attrs.id==='applyModalLabel'),'exact native application role label')
 need(norm(rawText(label))==='Application for '+model.title&&modal.attrs['aria-labelledby']==='applyModalLabel','native application title does not bind this role')
 const form=one(children.filter(node=>node.tag==='form'),'native own application form'),unit='wpcf7-f1112-p'+model.nativeDocumentPostContext+'-o1'
 need(form.attrs.action===new URL(model.url).pathname+'#'+unit&&form.attrs.method==='post'&&form.attrs.enctype==='multipart/form-data','native own application account/page mismatch')
 const fields=all(form).filter(node=>['input','select','textarea','button'].includes(node.tag))
 const field=name=>one(fields.filter(node=>node.attrs.name===name),'original native form field '+name)
 need(field('_wpcf7').attrs.value==='1112'&&field('_wpcf7_container_post').attrs.value===model.nativeDocumentPostContext&&field('_wpcf7_unit_tag').attrs.value===unit,'native application document identity mismatch')
 need(one(children.filter(node=>node.attrs.id==='meta_title2'),'native application title context').attrs.value===model.title,'native application hidden role title mismatch')
 const preferred=one(fields.filter(node=>node.tag==='select'),'own native preferred-location application condition')
 const preferredLocations=all(preferred).filter(node=>node.tag==='option').map(node=>norm(rawText(node))).filter(Boolean)
 need(equal(preferredLocations,['Select*','India','Japan','United Kingdom','United States']),'original application location preferences changed')
 const conditions=norm(rawText(form))
 need(conditions.includes('Only PDF or DOCX type files are allowed')&&!unavailable.test(conditions),'full original application conditions missing or explicitly unavailable')
 const application={rolePage:model.url,authoredHref:apply.attrs.href,target:apply.attrs['data-bs-target'],modalAttributes:structuredClone(modal.attrs),formAttributes:structuredClone(form.attrs),nativeDocumentPostContext:model.nativeDocumentPostContext,
  originalModalModel:structuredClone(modal),originalFields:structuredClone(fields),originalConditions:conditions,preferredLocations:preferredLocations.slice(1),preferredLocationsAreWorksites:false,submissionPerformed:false,renderedApplicationQualified:false}
 return{url:model.url,title:model.title,location,department,employmentType:employment,criteria,description:criteria+'\n\nNative application conditions:\n'+conditions,application,originalOwnRoleHTML:html,originalSchemas:proof.schemas,
  originalNativeRoleModel:structuredClone(detail),nativeLegalEmployerInCriteria:criteria.includes('RxLogix Corporation')?'RxLogix Corporation':null,passiveBindings:proof.passiveBindings}
}

export async function runCurrentRxLogix(options={}){
 options.signal?.throwIfAborted()
 need(!(options.fetchPage||options.fetchText||options.fetchJson)||options.fetchImpl,'original HTTP metadata required')
 const duration=options.sourceDeadlineMs??85000,interval=options.requestIntervalMs??500
 need(Number.isSafeInteger(duration)&&duration>0&&duration<=85000,'invalid source deadline')
 need(Number.isSafeInteger(interval)&&interval>=0&&interval<=60000&&(interval>=500||options.fetchImpl),'invalid native host pacing')
 const observedAt=typeof options.now==='function'?options.now():new Date().toISOString();need(Number.isFinite(Date.parse(observedAt)),'invalid observation clock')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(problem('source deadline exceeded')),duration)
 const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal,receipts=[],last=new Map(),allowed=new Set([profile.board])
 let reads=0,total=0
 const read=async url=>{
  signal.throwIfAborted();need(allowed.has(url)&&Object.hasOwn(profile.originalPackets,url)&&++reads<=72,'unbound current public URL or request cap')
  const origin=new URL(url).origin,wait=Math.max(0,interval-(performance.now()-(last.get(origin)??-Infinity)))
  if(wait)await delay(wait,undefined,{signal});last.set(origin,performance.now())
  const p=await boundedDeclaredPublicRead(url,{signal,timeoutMs:15000,overflowError:problem('native stream byte bound'),fetchImpl:async(value,init)=>{
   const response=await(options.fetchImpl||globalThis.fetch)(value,{...init,cache:'no-store',credentials:'omit'});let size=0
   const body=response.body===null?null:{cancel:reason=>response.body.cancel(reason),getReader(){const reader=response.body.getReader();return{
    async read(){const part=await reader.read();if(!part.done){need(types.isUint8Array(part.value),'original stream must contain bytes');const length=nativeByteLength.call(part.value);need(length<=4000000-size&&length<=16000000-total,'native stream byte bound');size+=length;total+=length}return part},
    cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}}}
   return{status:response.status,url:response.url,headers:response.headers,body}
  }})
  const bytes=Buffer.from(p.bodyBase64,'base64'),expected=profile.originalPackets[url],digest=sha(bytes)
  receipts.push({requestedURL:url,...p,bytes:bytes.length,sha256:digest})
  need(p.status===200&&p.status===expected.status&&p.url===expected.finalURL&&!p.headers.location,'native HTTP status/final URL or redirect context changed')
  need((p.headers['content-type']||'').split(';')[0].trim().toLowerCase()===expected.mime,'native MIME changed')
  need(equal(Object.fromEntries(Object.keys(expected.effectiveHeaders).map(name=>[name,p.headers[name]??null])),expected.effectiveHeaders),'native navigation, CSP, disposition, Link or declared charset changed')
  if(!profile.documents[url])need((profile.reviewedWholeProgramVariants[url]||[expected]).some(program=>program.bytes===bytes.length&&program.sha256===digest),'whole current declared client or style changed')
  try{return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)}catch{throw problem('original native UTF8 unavailable')}
 }
 const pass=async()=>{
  const pages=new Map(),proofs=new Map(),board=await read(profile.board);pages.set(profile.board,board);proofs.set(profile.board,documentProof(board,profile.board))
  const nativeRows=cards(proofs.get(profile.board)),selected=[]
  for(const model of profile.roleModels){
   const card=one(nativeRows.filter(row=>row.url===model.url),'selected current own published card');allowed.add(model.url)
   const html=await read(model.url),proof=documentProof(html,model.url);pages.set(model.url,html);proofs.set(model.url,proof);selected.push(role(html,proof,model,card))
  }
  const declared=[...new Set([...proofs].flatMap(([url,proof])=>proof.nodes.filter(node=>node.tag==='script'&&node.attrs.src||node.tag==='link'&&node.attrs.rel==='stylesheet').map(node=>new URL(node.attrs.src||node.attrs.href,url).href)))]
  const imported=new Set(Object.values(profile.cssImports).flat()),direct=profile.assetURLs.filter(url=>!imported.has(url))
  need(equal(declared,direct),'current declared native client/style cohort changed')
  for(let index=0;index<declared.length;index++){
   const url=declared[index];allowed.add(url);const content=await read(url)
   const imports=[...content.matchAll(/@import\s+(?:url\(\s*)?["']([^"']+)["']/gi)].map(match=>new URL(match[1],url).href)
   need(equal(imports,profile.cssImports[url]||[]),'current literal stylesheet dependency changed')
   for(const target of imports)if(!declared.includes(target))declared.push(target)
  }
  need(equal(declared,profile.assetURLs),'full declared external context not reconciled')
  return{nativeRows,selected,documentProofs:[...proofs].map(([url,proof])=>({url,normalizedSHA256:proof.normalizedSHA256}))}
 }
 try{
  const opening=await pass(),closing=await pass()
  need(equal(opening.nativeRows,closing.nativeRows)&&equal(opening.documentProofs,closing.documentProofs),'fresh full original board/role/application closing mismatch');signal.throwIfAborted()
  const selectedURLs=new Set(profile.roleModels.map(model=>model.url)),holds=opening.nativeRows.filter(row=>!selectedURLs.has(row.url)).map(row=>({originalCard:row,reason:'full-own-native-role-and-independent-closing-not-qualified-in-bounded-subset'}))
  const jobs=opening.selected.map((r,index)=>({source:profile.source,company:profile.company,companyDomain:'rxlogix.com',companyCareerPage:profile.board,title:r.title,department:r.department,
   jobId:null,requisitionId:null,sourceNativeIdentifier:null,sourceNativeIdentity:{kind:'current-own-canonical-role-url',value:r.url},sourceCanonicalRoleURL:r.url,
   sourceUrl:r.url,link:r.url,applyUrl:r.url,country:'India',city:null,location:r.location,employmentType:r.employmentType,remoteStatus:null,jobDescription:r.description,sourceDescription:r.description,
   postingDate:null,firstEverPostedAt:null,closingDate:null,sourceDateSemanticsUnresolved:true,
   nativeSourceRecord:{originalOwnRoleHTML:r.originalOwnRoleHTML,closingOwnRoleHTML:closing.selected[index].originalOwnRoleHTML,originalNativeFullCriteria:r.criteria,originalNativeRoleModel:r.originalNativeRoleModel,originalPublishedApplication:r.application,closingPublishedApplication:closing.selected[index].application,originalDocumentSchemas:r.originalSchemas},
   sourceNativeEmployerBinding:{configuredCorporateURL:profile.corporate,currentNativeCareers:profile.board,publisher:profile.publisher,nativeLegalEmployerInOwnFullCriteria:r.nativeLegalEmployerInCriteria},
   sourceNativeCountryProof:{nativeCardCountry:opening.nativeRows.find(row=>row.url===r.url).location,ownRoleHeaderCountry:r.location,applicationPreferencesAreWorksites:false,cityDictionaryUsed:false},
   sourceDetailComplete:true,sourceNativeClosingReconciled:true,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,sourceRenderedApplicationQualified:false,scrapedAt:observedAt}))
  const evidence={source:profile.source,observedAt,recordKind:'vacancy-rows',observedRecordCount:opening.nativeRows.length,observedVacancyCount:opening.nativeRows.length,nativeRows:opening.nativeRows,closingNativeRows:closing.nativeRows,holds,
   originalResponses:receipts,fullOriginalCriteriaPreserved:true,applicationPreferenceCountriesRetained:true,companyGlobalTotal:null,companyIndiaTotal:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,verifiedZero:false,applicationSubmitted:false}
  attachSourceObservationEvidence(jobs,{source:profile.source,recordKind:'vacancy-rows',observedRecordCount:opening.nativeRows.length,observedVacancyCount:opening.nativeRows.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:evidence,configurable:true})
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:profile.board,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reads,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,
   reason:'current-own-two-full-native-India-roles+all-original-criteria-and-application-conditions+whole-declared-client/style-and-independent-full-document-closing;other-cards-held;company-inventory-and-zero-unqualified'})
 }catch(error){
  if(options.signal?.aborted)throw options.signal.reason
  if(error&&typeof error==='object'&&Object.isExtensible(error))try{Object.assign(error,{softFailure:true,abortRetries:true,failureKind:error.failureKind||'coverage_gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false,sourceAudit:{source:profile.source,originalResponses:receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false}})}catch{}
  throw error
 }finally{clearTimeout(timer)}
}
