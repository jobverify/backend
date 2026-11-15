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
// These exact declarations are retained in the full authored documents. Their
// unexecuted response bodies supply no input to this native metadata reader.
const unrequestedExternalProgramURLs=Object.freeze([
 'https://www.realpage.com/z8dY/FVtI/B4C/hGu/c73w/OSEmfGJ7hOb7Jcuw/Xmlu/Y1Eje/3UNNxk',
 'https://www.googletagmanager.com/gtm.js?id=GTM-MDKXBGH',
 'https://www.googletagmanager.com/gtm.js?id=GTM-W8W92P'
])
const sha=value=>createHash('sha256').update(value).digest('hex')
const byteLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get
const problem=message=>Object.assign(Error('RealPage current native: '+message),{softFailure:true,abortRetries:true,failureKind:'coverage_gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false})
const need=(value,message)=>{if(!value)throw problem(message)}
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const one=(values,label)=>{need(values.length===1,'missing or ambiguous '+label);return values[0]}
const all=(node,list=[])=>{list.push(node);for(const child of node.children||[])if(typeof child==='object')all(child,list);return list}
const norm=value=>decodeNativeEntities(value).replace(/\s+/g,' ').trim()
const rawText=node=>typeof node==='string'?node:['script','style'].includes(node.tag)?'':node.children.map(rawText).join(' ')
const unavailable=/\b(?:(?:applications\s+are|recruitment\s+is)\s+(?:(?:now|currently)\s+)?closed|applications\s+are\s+no\s+longer\s+(?:being\s+)?accepted|(?:we\s+are\s+)?no\s+longer\s+accepting\s+applications|(?:this|the)\s+(?:job|position|role)\s+is\s+(?:closed|filled|unavailable|not\s+available|no\s+longer\s+available))\b/i
const relativeAgeMarker='REALPAGE_BOUND_NATIVE_RELATIVE_POSTED_AGE'

function relativeAgeProjection(originalCard){
 const carrier=profile.relativePostedAgeCarrier,card=structuredClone(originalCard),nodes=all(card)
 need(card.tag==='li'&&!card.inert&&equal(card.attrs,{class:'iCIMS_JobCardItem'}),'unqualified relative posted-age card')
 need(nodes.filter(node=>node.tag==='a'&&node.attrs.href===carrier.roleURL).length===1,'unbound relative posted-age own role')
 const header=one(nodes.filter(node=>node.tag==='div'&&node.attrs.class==='col-xs-6 header right'),'exact own posted-date header')
 need(!header.inert&&equal(header.attrs,{class:'col-xs-6 header right'}),'unreviewed posted-date carrier context')
 const posted=one(all(header).filter(node=>node.tag==='span'&&Object.hasOwn(node.attrs,'title')),'exact native absolute posted-date carrier')
 need(!posted.inert&&equal(posted.attrs,{title:carrier.absoluteTimestampText})&&posted.children.length===2,'native absolute posted-date carrier changed')
 const [label,absolute]=posted.children
 need(typeof label==='string'&&/^\n(?:1 (?:day|week|month|year)|(?:[2-9]|[1-9]\d{1,2}) (?:days|weeks|months|years)) ago$/.test(label),'unknown or extra native relative display-age values')
 need(absolute&&typeof absolute==='object'&&!absolute.inert&&absolute.tag==='span'&&equal(absolute.attrs,{class:'sr-only'})&&equal(absolute.children,['('+carrier.absoluteTimestampText+')']),'native sr-only absolute posted date changed')
 const relativeDisplayText=label.slice(1);posted.children[0]='\n'+relativeAgeMarker
 need(equal(card,carrier.projectedOriginalCardModel),'full own posted-date carrier/card context changed')
 return{projectedCardModel:card,relativeDisplayText,absoluteTimestampText:carrier.absoluteTimestampText,sourceURL:carrier.sourceURL,roleURL:carrier.roleURL,publicationInstantInferred:false}
}
function nativeRowsForClosing(rows){
 return rows.map(row=>{
  if(row.page!==profile.relativePostedAgeCarrier.sourceURL||row.url!==profile.relativePostedAgeCarrier.roleURL)return row
  const projected=relativeAgeProjection(row.originalCardModel)
  return{...row,originalCardText:profile.relativePostedAgeCarrier.projectedOriginalCardText,originalCardModel:projected.projectedCardModel}
 })
}

function documentProof(html,url){
 const expected=profile.documents[url],doc=readNativeDocument(html),nodes=all(one(doc.nodes(node=>node.tag==='root'),'original native document root'))
 need(expected&&!html.includes('REALPAGE_CORPORATE_CSRF')&&!html.includes('REALPAGE_TALENT_SUBSCRIPTION_CSRF')&&!html.includes(relativeAgeMarker),'unreviewed document context')
 let normalized=html;const passiveBindings={}
 if(url===profile.corporate){
  const node=one(nodes.filter(node=>node.tag==='meta'&&node.attrs.name==='csrf-token'),'exact corporate csrf-token field')
  need(!node.inert&&equal(Object.keys(node.attrs),['name','content'])&&/^[A-Za-z0-9]{40}$/.test(node.attrs.content),'unreviewed corporate csrf field shape')
  const exact='<meta name="csrf-token" content="'+node.attrs.content+'">'
  need(html.split(exact).length===2,'unreviewed corporate csrf field representation')
  normalized=normalized.replace(exact,'<meta name="csrf-token" content="REALPAGE_CORPORATE_CSRF">');passiveBindings.corporateCsrf=node.attrs.content
 }
 if(expected.kind==='native-role'){
  const prefix="<script type=\"text/javascript\"> var link = '"+profile.account+'connect/interests?csrf=',suffix="&hashed=-625856947'; </script>"
  const start=html.indexOf(prefix),token=html.slice(start+prefix.length,start+prefix.length+16)
  need(start>=0&&html.split(prefix).length===2&&/^[A-F0-9]{16}$/.test(token)&&html.slice(start+prefix.length+16).startsWith(suffix)&&html.split(token).length===2,'unreviewed separate talent subscription field shape/count/context')
  const script=one(nodes.filter(node=>node.tag==='script'&&node.raw===` var link = '${profile.account}connect/interests?csrf=${token}&hashed=-625856947'; `),'exact separate talent subscription declaration')
  need(!script.inert&&equal(script.attrs,{type:'text/javascript'}),'unqualified separate talent subscription declaration')
  normalized=normalized.replace(prefix+token+suffix,prefix+'REALPAGE_TALENT_SUBSCRIPTION_CSRF'+suffix);passiveBindings.talentSubscriptionCsrf=token
 }
 if(url===profile.relativePostedAgeCarrier.sourceURL){
  const carrier=profile.relativePostedAgeCarrier,card=one(doc.nodes(node=>node.tag==='li'&&doc.hasClass(node,'iCIMS_JobCardItem')&&doc.nodes(child=>child.tag==='a'&&child.attrs.href===carrier.roleURL,node).length===1),'bound own card relative posted-age context'),projected=relativeAgeProjection(card)
  const prefix='<span title="'+carrier.absoluteTimestampText+'">\n',suffix='<span class="sr-only">('+carrier.absoluteTimestampText+')</span></span>',original=prefix+projected.relativeDisplayText+suffix
  need(html.split(original).length===2,'relative posted-age source representation/count changed')
  normalized=normalized.replace(original,prefix+relativeAgeMarker+suffix);passiveBindings.nativeRelativePostedAgeDisplay=projected
 }
 const schemas=doc.nodes(node=>node.tag==='script'&&node.attrs.type==='application/ld+json').map(node=>parseEightfoldJson(node.raw))
 need(schemas.length===expected.jsonldCount,'original native schema context changed')
 need(equal(doc.nodes(node=>node.tag==='title').map(node=>node.raw),expected.titles)&&equal(doc.nodes(node=>node.tag==='link'&&node.attrs.rel==='canonical').map(node=>node.attrs.href),expected.canonicals),'full native publisher/title/canonical context changed')
 need(sha(normalized)===expected.normalizedSHA256,'full original country/criteria/account/control/attribute/style/inline-program context changed')
 return{doc,nodes,schemas,normalizedSHA256:sha(normalized),passiveBindings}
}
function cards(proof,url){
 const {doc}=proof
 return doc.nodes(node=>node.tag==='li'&&doc.hasClass(node,'iCIMS_JobCardItem')).map((node,index)=>{
  const anchor=one(doc.nodes(child=>child.tag==='a'&&/\/jobs\/\d+\//.test(child.attrs.href||''),node),'original own card role link'),link=new URL(anchor.attrs.href,url)
  need(link.origin===new URL(profile.account).origin&&/^\/jobs\/\d+\/[^/]+\/job$/.test(link.pathname)&&!link.search&&!link.hash,'unbound current native card role URL')
  const title=doc.text(one(doc.nodes(child=>child.tag==='h3',anchor),'full own card title')),originalText=doc.text(node),requisition=/Job ID\s+(\d{4}-\d+)/.exec(originalText)?.[1]
  const id=/^\/jobs\/(\d+)\//.exec(link.pathname)[1];need(requisition?.endsWith('-'+id)&&title,'own card requisition identity conflict')
  return{page:url,ordinal:index,url:link.href,title,id,requisition,country:null,originalCardText:originalText,originalCardModel:structuredClone(node)}
 })
}
function date(value,label){
 need(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value,'invalid native '+label+' calendar/time')
 return Date.parse(value)
}
export function validateCurrentRealPageDateWindow(schema,model,observedAt){
 need(schema.url===model.url&&equal(schema,model.originalJobPosting),'native date source/full model identity changed')
 const rendered=model.reviewedRenderedContext,withoutDates=value=>({...value,datePosted:null,validThrough:null})
 need(rendered?.runtimeFrameReadsPerformed===false&&Array.isArray(rendered.originalNativeHTTPModels)&&rendered.originalNativeHTTPModels.length>0,'reviewed own native frame/date context unavailable')
 const contexts=[{kind:'canonical-own-native-JobPosting',sourceURL:model.url,originalDatePosted:schema.datePosted,originalValidThrough:schema.validThrough}]
 for(const original of rendered.originalNativeHTTPModels){
  need(equal(withoutDates(original.wholeOriginalJobPosting),withoutDates(schema)),'reviewed whole native HTTP model differs beyond unresolved dates')
  contexts.push({kind:'reviewed-browser-native-HTTP-JobPosting',sourceURL:original.sourceURL,observedAt:original.observedAt,originalDatePosted:original.wholeOriginalJobPosting.datePosted,originalValidThrough:original.wholeOriginalJobPosting.validThrough})
 }
 need(equal(withoutDates(rendered.wholeOriginalJobPosting),withoutDates(schema)),'reviewed whole rendered model differs beyond unresolved dates')
 contexts.push({kind:'reviewed-rendered-native-frame-JobPosting',sourceURL:rendered.sourceURL,observedAt:rendered.observedAt,originalDatePosted:rendered.wholeOriginalJobPosting.datePosted,originalValidThrough:rendered.wholeOriginalJobPosting.validThrough})
 for(const original of model.supplementalReviewedNativeDateModels||[]){
  need(equal(withoutDates(original.wholeOriginalJobPosting),withoutDates(schema)),'supplemental whole native model differs beyond unresolved dates')
  contexts.push({kind:original.kind,sourceURL:original.sourceURL,observedAt:original.observedAt,originalDatePosted:original.wholeOriginalJobPosting.datePosted,originalValidThrough:original.wholeOriginalJobPosting.validThrough})
 }
 need(equal(contexts,model.originalNativeDateContexts),'every original native date/source context must remain reconciled')
 const now=Date.parse(observedAt);need(Number.isFinite(now),'invalid native observation clock')
 const closing=contexts.map(context=>{
  const url=new URL(context.sourceURL)
  need(url.origin===new URL(profile.account).origin&&url.pathname===new URL(model.url).pathname&&!url.hash&&!url.username&&!url.password,'native date context belongs to another role/account')
  const posted=date(context.originalDatePosted,'datePosted'),closes=date(context.originalValidThrough,'validThrough')
  need(posted<=now&&closes>posted,'known native publication date is not currently qualified')
  need(closes>now,'known native closing instant has passed')
  return closes
 })
 return{originalNativeDateContexts:structuredClone(contexts),earliestObservedNativeClosingGuard:new Date(Math.min(...closing)).toISOString(),sourceDateSemanticsUnresolved:true,scalarPublicationDateQualified:false,scalarClosingDateQualified:false,runtimeFrameReadsPerformed:false}
}
function role(html,proof,model,card,observedAt){
 const {doc,schemas}=proof,schema=one(schemas,'own full native JobPosting'),detail=one(doc.nodes(node=>doc.hasClass(node,'iCIMS_JobContent')),'complete own native full role')
 need(schema['@type']==='JobPosting'&&schema['@context']==='http://schema.org'&&schema.url===model.url&&schema.title===model.title&&card.title===model.title&&card.id===model.id&&card.requisition===model.requisition,'native full role/card/schema identity conflict')
 need(schema.hiringOrganization?.['@type']==='Organization'&&schema.hiringOrganization.name===profile.nativeLegalEmployer&&schema.hiringOrganization.sameAs===profile.corporateRoot,'native employer/publisher conflict')
 need(Array.isArray(schema.jobLocation)&&schema.jobLocation.length>0&&schema.jobLocation.every(location=>location['@type']==='Place'&&location.address?.['@type']==='PostalAddress'&&location.address.addressCountry==='IN'),'every native alternative work-country must explicitly be IN')
 const title=doc.text(one(doc.nodes(node=>node.tag==='h1'&&doc.hasClass(node,'iCIMS_Header'),detail),'native own role title')),criteria=doc.text(detail)
 need(title===model.title&&criteria.includes('Req # '+model.requisition)&&criteria.includes('Job Locations '+model.locationLabel),'native own header country/requisition conflict')
 need(criteria.length===model.criteriaCharacters&&typeof schema.description==='string'&&schema.description.length>2000&&!unavailable.test(criteria)&&!unavailable.test(schema.description),'original full native criteria missing or explicitly unavailable')
 need(equal(schema,model.originalJobPosting),'full original native JobPosting model/criteria changed')
 const dateWindow=validateCurrentRealPageDateWindow(schema,model,observedAt)
 const sections=detail.children.filter(node=>typeof node==='object'&&doc.hasClass(node,'iCIMS_InfoMsg')).map(node=>({tag:node.tag,attributes:structuredClone(node.attrs),text:doc.text(node),originalModel:structuredClone(node)}))
 need(equal(sections.filter(node=>node.tag==='h2').map(node=>node.text),['Overview','Responsibilities','Qualifications']),'original full criteria sections changed')
 const schemaText=readNativeDocument(schema.description),schemaDescription=schemaText.text(one(schemaText.nodes(node=>node.tag==='root'),'schema full criteria root'))
 need(sections.filter(node=>node.tag==='div').every(node=>schemaDescription.includes(node.text)),'native schema omits original full published criterion')
 need(equal(sections.filter(node=>node.tag==='div').map(node=>node.text),model.reviewedRenderedContext.allOriginalCriterionTexts),'complete reviewed rendered criterion comparison changed')
 const apply=one(doc.nodes(node=>node.tag==='a'&&doc.hasClass(node,'iCIMS_ApplyOnlineButton'),detail),'own current Apply control')
 need(apply.attrs.href===model.applyURL&&doc.text(apply)===model.applyControlText,'native own application role/account conflict')
 return{url:model.url,title,criteria,sections,schemaDescription,dateWindow,originalNativeJobPosting:structuredClone(schema),originalNativeRoleModel:structuredClone(detail),originalOwnRoleHTML:html,applyAttributes:structuredClone(apply.attrs),passiveBindings:proof.passiveBindings}
}
function application(proof,model){
 const {doc}=proof,form=one(doc.nodes(node=>node.tag==='form'&&node.attrs.id==='enterEmailForm'),'own native public application email form')
 need(form.attrs.action===model.applicationURL+'?step=email&hashed=-625856947'&&form.attrs.method==='post'&&form.attrs['accept-charset']==='utf-8'&&form.attrs.enctype==='multipart/form-data','own native application form/account/role conflict')
 const controls=all(form).filter(node=>['input','select','textarea','button'].includes(node.tag)),conditions=norm(rawText(form))
 need(controls.some(node=>node.tag==='input'&&node.attrs.name==='css_loginName'&&node.attrs.type==='email')&&conditions.includes('European Union (EU) or United Kingdom (UK) resident')&&!unavailable.test(conditions),'full own native application condition missing or unavailable')
 return{authoredApplyURL:model.applyURL,publicLoginURL:model.applicationURL,originalForm:structuredClone(form),originalFormAttributes:structuredClone(form.attrs),originalControls:structuredClone(controls),originalConditions:conditions,preferenceCountriesAreWorksites:false,submissionPerformed:false,renderedApplicationQualified:false}
}
function resources(proofs){
 const urls=[],unrequestedDeclarations=[],add=(url,sourceURL,declaration,sourceNormalizedSHA256)=>{
  need(new URL(url).protocol==='https:','unreviewed non-HTTPS native resource');if(!urls.includes(url))urls.push(url)
  if(unrequestedExternalProgramURLs.includes(url))unrequestedDeclarations.push({resourceURL:url,sourceURL,originalDeclaration:structuredClone(declaration),sourceNormalizedSHA256})
 }
 for(const [url,proof]of proofs){
  for(const node of proof.nodes.filter(node=>node.tag==='script'&&node.attrs.src||node.tag==='link'&&node.attrs.rel==='stylesheet'))add(new URL(node.attrs.src||node.attrs.href,url).href,url,node,proof.normalizedSHA256)
  for(const node of proof.nodes.filter(node=>node.tag==='script'&&!node.attrs.src)){
   const code=node.raw||''
   for(const match of code.matchAll(/icimsAsyncLoadScript\(['"]([^'"]+)['"]\)/g))add(new URL(match[1],url).href,url,node,proof.normalizedSHA256)
   if(code.includes('googletagmanager.com/gtm.js?id=')){const ids=[...code.matchAll(/['"](GTM-[A-Z0-9]+)['"]/g)].map(match=>match[1]);need(ids.length===1,'ambiguous exact native analytics bootstrap');add('https://www.googletagmanager.com/gtm.js?id='+ids[0],url,node,proof.normalizedSHA256)}
   if(code.includes("'.pardot.com/pd.js'")&&code.includes("'https://pi'"))add('https://pi.pardot.com/pd.js',url,node,proof.normalizedSHA256)
   for(const match of code.matchAll(/s\.src\s*=\s*['"](https:\/\/acsbapp\.com\/apps\/app\/dist\/js\/app\.js)['"]/g))add(match[1],url,node,proof.normalizedSHA256)
  }
 }
 need(equal(urls,profile.assetURLs),'whole declared native script/style/loader cohort changed')
 need(equal(profile.metadataAuthorityScope.unrequestedExternalProgramURLs,unrequestedExternalProgramURLs)&&unrequestedExternalProgramURLs.every(url=>urls.includes(url)&&unrequestedDeclarations.some(node=>node.resourceURL===url)),'exact unrequested external-program declaration scope changed')
 return{requiredURLs:urls.filter(url=>!unrequestedExternalProgramURLs.includes(url)),allDeclaredURLs:urls,unrequestedDeclarations}
}

export async function runCurrentRealPage(options={}){
 options.signal?.throwIfAborted()
 need(!(options.fetchPage||options.fetchText||options.fetchJson)||options.fetchImpl,'original HTTP metadata required')
 const duration=options.sourceDeadlineMs??285000,interval=options.requestIntervalMs??500
 need(Number.isSafeInteger(duration)&&duration>0&&duration<=285000,'invalid source deadline')
 need(Number.isSafeInteger(interval)&&interval>=0&&interval<=60000&&(interval>=500||options.fetchImpl),'invalid native host pacing')
 const readClock=()=>{
  const clock=typeof options.now==='function'?options.now():new Date(),value=clock instanceof Date?clock.toISOString():clock
  need(typeof value==='string'&&Number.isFinite(Date.parse(value)),'invalid native observation clock');return value
 },observedAt=readClock()
 const reviewedComparisons=profile.roleModels.map(model=>({canonicalSourceURL:model.url,frameSourceURL:model.reviewedRenderedContext.sourceURL,originalCompleteCriterionTexts:model.reviewedRenderedContext.allOriginalCriterionTexts,allOriginalCriterionSectionsVisible:true,allOriginalCriterionSectionsMatchRendered:true,completeNativeModelOtherwiseIdentical:true,originalNativeDateContexts:model.originalNativeDateContexts}))
 need(sha(JSON.stringify(reviewedComparisons))===profile.completeRenderedCriterionComparisonsSHA256,'complete reviewed rendered criterion/date comparison is not pinned')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(problem('source deadline exceeded')),duration),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const receipts=[],allowed=new Set([profile.corporate]),last=new Map();let reads=0,total=0
 const read=async url=>{
  signal.throwIfAborted();need(allowed.has(url)&&Object.hasOwn(profile.originalPackets,url)&&++reads<=144,'unbound current public URL/request cap')
  const origin=new URL(url).origin,wait=Math.max(0,interval-(performance.now()-(last.get(origin)??-Infinity)));if(wait)await delay(wait,undefined,{signal});last.set(origin,performance.now())
  const p=await boundedDeclaredPublicRead(url,{signal,timeoutMs:15000,overflowError:problem('native stream byte bound'),fetchImpl:async(value,init)=>{
   const response=await(options.fetchImpl||globalThis.fetch)(value,{...init,credentials:'omit',cache:'no-store'});let size=0
   const body=response.body===null?null:{cancel:reason=>response.body.cancel(reason),getReader(){const reader=response.body.getReader();return{
    async read(){const part=await reader.read();if(!part.done){need(types.isUint8Array(part.value),'original native stream must contain bytes');const length=byteLength.call(part.value);need(length<=4000000-size&&length<=32000000-total,'native stream byte bound');size+=length;total+=length}return part},
    cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}}}
   return{status:response.status,url:response.url,headers:response.headers,body}
  }})
  const bytes=Buffer.from(p.bodyBase64,'base64'),digest=sha(bytes),expected=profile.originalPackets[url];receipts.push({requestedURL:url,...p,bytes:bytes.length,sha256:digest})
  need(p.status===expected.status&&p.url===expected.finalURL,'native HTTP status/final URL changed')
  need(equal(Object.fromEntries(Object.keys(expected.effectiveHeaders).map(name=>[name,p.headers[name]??null])),expected.effectiveHeaders),'native navigation/CSP/disposition/Link/charset/account metadata changed')
  if(!profile.documents[url])need((profile.reviewedWholeProgramVariants[url]||[expected]).some(variant=>variant.bytes===bytes.length&&variant.sha256===digest),'whole current declared program/style/redirect or unavailable-dependency context changed')
  try{return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)}catch{throw problem('original native UTF8 unavailable')}
 }
 const readDocument=async(url,proofs)=>{allowed.add(url);const html=await read(url),proof=documentProof(html,url);proofs.set(url,proof);return{html,proof}}
 const pass=async()=>{
  const proofs=new Map(),corporate=await readDocument(profile.corporate,proofs)
  need(profile.corporateInternationalCopies>0&&corporate.proof.doc.nodes(node=>node.tag==='a'&&node.attrs.href===profile.account&&corporate.proof.doc.text(node)==='International').length===profile.corporateInternationalCopies,'current corporate International account delegation missing/ambiguous')
  allowed.add(profile.account);await read(profile.account);const jobs=profile.account+'jobs';allowed.add(jobs);await read(jobs)
  const first=await readDocument(profile.board,proofs),next=one(first.proof.doc.nodes(node=>node.tag==='a'&&first.proof.doc.text(node)==='Next page of results'),'native advertised next page')
  need(new URL(next.attrs.href,profile.board).href===profile.nextPage,'native next-page membership context changed')
  const second=await readDocument(profile.nextPage,proofs),nativeRows=[...cards(first.proof,profile.board),...cards(second.proof,profile.nextPage)]
  need(nativeRows.length===profile.rawCardCount&&new Set(nativeRows.map(row=>row.url)).size===profile.rawCardCount,'native current original membership changed; no zero proof')
  const selected=[]
  for(const model of profile.roleModels){
   const card=one(nativeRows.filter(row=>row.url===model.url),'selected current own published card'),page=await readDocument(model.url,proofs),full=role(page.html,page.proof,model,card,observedAt)
   allowed.add(model.applyURL);await read(model.applyURL);const login=await readDocument(model.applicationURL,proofs)
   selected.push({...full,application:application(login.proof,model),originalApplicationHTML:login.html})
  }
  const declaredResources=resources(proofs)
  for(const url of declaredResources.requiredURLs){allowed.add(url);await read(url)}
  return{nativeRows,selected,declaredResources,uninterpretedNativeRelativeAgeDisplay:first.proof.passiveBindings.nativeRelativePostedAgeDisplay,documentProofs:[...proofs].map(([url,p])=>({url,normalizedSHA256:p.normalizedSHA256}))}
 }
 try{
  const opening=await pass(),closing=await pass()
  need(equal(nativeRowsForClosing(opening.nativeRows),nativeRowsForClosing(closing.nativeRows))&&equal(opening.documentProofs,closing.documentProofs)&&equal(opening.declaredResources,closing.declaredResources),'fresh full native cards/criteria/public application closing changed');signal.throwIfAborted()
  const closingDateGuardObservedAt=readClock()
  for(const [index,model]of profile.roleModels.entries())validateCurrentRealPageDateWindow(closing.selected[index].originalNativeJobPosting,model,closingDateGuardObservedAt)
  signal.throwIfAborted()
  const selectedURLs=new Set(profile.roleModels.map(model=>model.url)),holds=opening.nativeRows.filter(row=>!selectedURLs.has(row.url)).map(row=>({originalCard:row,reason:'country-absent-card;full-own-native-role+independent-closing-not-qualified-in-bounded-subset'}))
  const jobs=opening.selected.map((role,index)=>{
   const model=profile.roleModels[index],schema=role.originalNativeJobPosting,description=role.criteria+'\n\nNative public application conditions:\n'+role.application.originalConditions
   return{source:profile.source,company:profile.company,companyDomain:'realpage.com',companyCareerPage:profile.corporate,title:role.title,department:schema.occupationalCategory,nativeLegalEmployer:schema.hiringOrganization.name,
    jobId:model.id,requisitionId:model.requisition,sourceNativeIdentifier:model.id,sourceNativeIdentity:{kind:'own-published-iCIMS-role-and-requisition',nativeJobID:model.id,requisition:model.requisition},sourceCanonicalRoleURL:model.url,
    sourceUrl:model.url,link:model.url,applyUrl:model.applyURL,country:'India',city:schema.jobLocation[0].address.addressLocality,location:model.locationLabel,employmentType:schema.employmentType,remoteStatus:null,jobDescription:description,sourceDescription:description,
    postingDate:null,closingDate:null,firstEverPostedAt:null,sourceDateSemanticsUnresolved:true,sourceNativeClosingDateGuardObservedAt:closingDateGuardObservedAt,
    nativeSourceRecord:{originalNativeJobPosting:schema,closingNativeJobPosting:closing.selected[index].originalNativeJobPosting,originalNativeFullCriteria:role.criteria,originalNativeCriterionSections:role.sections,originalNativeRoleModel:role.originalNativeRoleModel,originalOwnRoleHTML:role.originalOwnRoleHTML,closingOwnRoleHTML:closing.selected[index].originalOwnRoleHTML,originalPublishedApplication:role.application,closingPublishedApplication:closing.selected[index].application,originalApplicationHTML:role.originalApplicationHTML,closingApplicationHTML:closing.selected[index].originalApplicationHTML,passiveContext:role.passiveBindings,originalNativeDateContexts:role.dateWindow.originalNativeDateContexts,reviewedBrowserNativeFrame:model.reviewedRenderedContext,supplementalReviewedNativeDateModels:model.supplementalReviewedNativeDateModels,ordinaryRenderedSectionReview:model.ordinaryRenderedSectionReview,nativeDateWindowGuard:role.dateWindow,currentClosingScope:'independent runtime canonical models/public login/native authority clients;three exact external programs unrequested and unused;reviewed browser frames are separately dated,not runtime frame reads'},
    sourceNativeEmployerBinding:{currentCorporateURL:profile.corporate,authoredInternationalAccount:profile.account,nativeHiringOrganization:schema.hiringOrganization},sourceNativeCountryProof:{allOriginalLocations:schema.jobLocation,ownHeaderLabel:model.locationLabel,cardCountryAbsent:true,UIFilterUsedAsCountryProof:false,applicationResidencyConditionsAreWorksites:false},
    sourceDetailComplete:true,sourceNativeClosingReconciled:true,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,sourceRenderedApplicationQualified:false,scrapedAt:observedAt}
  })
  const evidence={source:profile.source,observedAt,recordKind:'vacancy-rows',observedRecordCount:opening.nativeRows.length,observedVacancyCount:opening.nativeRows.length,nativeRows:opening.nativeRows,closingNativeRows:closing.nativeRows,holds,originalResponses:receipts,
   fullOriginalCriteriaPreserved:true,allNativeApplicationConditionsPreserved:true,unavailableDeclaredResources:profile.unavailableDeclaredResources,
   originalDeclaredResourceURLs:opening.declaredResources.allDeclaredURLs,requiredNativeAuthorityResourceURLs:opening.declaredResources.requiredURLs,
   unrequestedExternalPrograms:{exactURLs:unrequestedExternalProgramURLs,openingOriginalDeclarations:opening.declaredResources.unrequestedDeclarations,closingOriginalDeclarations:closing.declaredResources.unrequestedDeclarations,requested:false,executed:false,suppliesExtractedMetadata:false,programEquivalenceClaimed:false,renderedExecutionQualified:false},
   uninterpretedNativeRelativeAgeDisplays:{opening:opening.uninterpretedNativeRelativeAgeDisplay,closing:closing.uninterpretedNativeRelativeAgeDisplay,scalarDateInferred:false},
   sourceRenderedApplicationQualified:false,companyGlobalTotal:null,companyIndiaTotal:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,verifiedZero:false,applicationSubmitted:false}
  attachSourceObservationEvidence(jobs,{source:profile.source,recordKind:'vacancy-rows',observedRecordCount:opening.nativeRows.length,observedVacancyCount:opening.nativeRows.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:evidence,configurable:true})
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:profile.account,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reads,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,
   reason:'current-corporate International delegation+two full own native typed-IN JobPosting models+all criteria/public login conditions+independent full closing;57 raw cards held;three exact unused external programs unrequested;declared locale script unavailable;rendered operation/company inventory/zero unqualified'})
 }catch(error){
  if(options.signal?.aborted)throw options.signal.reason
  if(error&&typeof error==='object'&&Object.isExtensible(error))try{Object.assign(error,{softFailure:true,abortRetries:true,failureKind:error.failureKind||'coverage_gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false,sourceAudit:{source:profile.source,originalResponses:receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false}})}catch{}
  throw error
 }finally{clearTimeout(timer)}
}
