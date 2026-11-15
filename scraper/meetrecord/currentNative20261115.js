import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {normalizeNativeAttributeBoundaries} from '../../scraper-support/utils/nativeHtmlAttributes.js'
import {parseEightfoldJson} from '../../scraper-support/utils/recruitmentEightfoldData.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const profile=JSON.parse(readFileSync(new URL('./currentProfile20261115.json',import.meta.url)))
const SOURCE='meetrecord',COMPANY='MeetRecord',CONFIGURED=profile.configured,BOARD=profile.board,LEGAL=profile.legal
const sha=value=>createHash('sha256').update(value).digest('hex')
const problem=message=>Object.assign(Error('MeetRecord native: '+message),{softFailure:true,abortRetries:true,failureKind:'coverage_gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false})
const need=(condition,message)=>{if(!condition)throw problem(message)}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const one=(rows,label)=>{need(rows.length===1,'missing or ambiguous '+label);return rows[0]}
const elements=node=>node.children.filter(n=>typeof n!=='string')
const retained=(node,ancestors=[])=>[{node,ancestors},...elements(node).flatMap(n=>retained(n,[...ancestors,node]))]
const within=(node,predicate)=>node.inert?[]:[...(predicate(node)?[node]:[]),...elements(node).flatMap(n=>within(n,predicate))]
const cls=(node,name)=>(node.attrs.class||'').split(/\s+/).includes(name)
const authority=key=>/^data-cms-|^itemscope$|^itemprop$|^itemtype$|country|qualif|location|employer|requirement|credential|responsibilit|experience/i.test(key)
const modifiers='(?:(?:already|now|currently)\\s+)*'
const state='(?:closed|filled|withdrawn|cancelled|canceled|expired|removed|unavailable|not\\s+available|no\\s+longer\\s+(?:available|active|open))'
const verb='(?:(?:is|was|are|were|has|have)\\s+'+modifiers+'(?:been\\s+)?)?'+modifiers
const unavailable=new RegExp('\\b(?:(?:(?:this|the)\\s+)?(?:job|role|position|vacancy|opening|opportunity)\\s+'+verb+state+'|(?:no\\s+longer|not(?:\\s+currently)?)\\s+accepting\\s+(?:(?:any|new)\\s+)?applications|(?:applications|recruitment|hiring)\\s+(?:for\\s+(?:(?:this|the)\\s+)?(?:role|position|job|vacancy)\\s+)?'+verb+'(?:closed|ended|stopped|suspended))\\b','i')
const closureOnly=new RegExp('^(?:'+unavailable.source+')[.!]?$','i')
const encode=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;')
const voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'])
const bytePrototype=Object.getPrototypeOf(Uint8Array.prototype)
const byteLength=Object.getOwnPropertyDescriptor(bytePrototype,'byteLength').get
// This guards the whole authored publication, including ARIA/inert/template
// contexts, without promoting any hidden text as country or JD proof. Only a
// complete isolated notice in a definite native hiding wrapper is excluded.
export function currentRetainedAuthorContext(root){
 const plain=node=>typeof node==='string'?decodeNativeEntities(node):['script','style','meta','link'].includes(node.tag)?'':Object.hasOwn(node,'raw')?decodeNativeEntities(node.raw||''):node.children.map(plain).join(' ')
 const normalize=value=>value.replace(/\s+/g,' ').trim()
 const isolated=node=>{
  const keys=Object.keys(node.attrs),style=(node.attrs.style||'').replace(/\s+/g,'').toLowerCase()
  if(['template','noscript'].includes(node.tag))return keys.length===0
  if(!['p','div','section','span'].includes(node.tag)||keys.some(k=>!['hidden','style'].includes(k)))return false
  if(Object.hasOwn(node.attrs,'hidden'))return !style||/^display:none(?:!important)?;?$/.test(style)
  return keys.length===1&&/^display:none(?:!important)?;?$/.test(style)
 }
 const text=node=>{
  if(typeof node==='string')return decodeNativeEntities(node)
  if(['script','style','meta','link'].includes(node.tag))return''
  if(isolated(node)&&closureOnly.test(normalize(plain(node))))return''
  if(Object.hasOwn(node,'raw'))return decodeNativeEntities(node.raw||'')
  return node.children.map(text).join(' ')
 }
 return normalize(text(root))
}
function presentation(raw,css){
 // This exact selector occurs three times in the pinned current site CSS.
 // :where(.class) and .class select the same elements; the conservative
 // hiding projection does not use specificity. All other CSS is retained.
 css=css.replaceAll(':where(.v2-sib-form-message-panel)','.v2-sib-form-message-panel')
 const render=node=>{
  if(typeof node==='string')return node
  if(['script','template','noscript','object','textarea','xmp','noembed','noframes','plaintext'].includes(node.tag))return''
  if(node.tag==='root')return node.children.map(render).join('')
  const start='<'+node.tag+Object.entries(node.attrs).map(([key,value])=>' '+key+'="'+encode(value)+'"').join('')+'>'
  if(voids.has(node.tag))return start
  const body=node.tag==='style'?node.raw||'':node.tag==='title'?encode(node.raw||''):node.tag==='iframe'?'':node.children.map(render).join('')
  return start+(node.tag==='head'?'<style>'+css+'</style>':'')+body+'</'+node.tag+'>'
 }
 return readVisibleNativeDocument(render(one(raw.nodes(n=>n.tag==='root'),'document root')),{strict:true})
}
function header(page){
 const main=one(page.raw.nodes(n=>n.tag==='main'),'own published main'),visible=one(page.visible.nodes(n=>n.tag==='main'),'visible own main')
 need(same(main.attrs,page.model.mainAttributes),'unreviewed main attributes')
 const path=one(page.rows.filter(x=>x.node===main),'main ancestry').ancestors.map(n=>({tag:n.tag,attrs:n.attrs}))
 need(same(path,page.model.mainAncestors),'unreviewed own publisher ancestor')
 need(one(page.raw.nodes(n=>n.tag==='title'),'own title').raw===page.model.title,'own publisher title changed')
 need(same(page.raw.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical').map(n=>n.attrs),page.model.canonical),'own canonical metadata changed')
 need(page.model.canonical.length===1&&page.model.canonical[0].href===page.url,'own canonical URL unqualified')
 need(sha(page.raw.text(main))===page.model.mainTextSHA256,'unreviewed current main criteria or publisher content')
 need(sha(page.raw.text(one(page.raw.nodes(n=>n.tag==='body'),'authored body')))===page.model.bodyTextSHA256,'unreviewed current hiring conditions outside main')
 need(sha(currentRetainedAuthorContext(one(page.raw.nodes(n=>n.tag==='body'),'retained authored body')))===page.model.retainedAuthorContextSHA256,'unreviewed retained author requirements or ambiguous hidden/inert context')
 need(sha(page.visible.text(visible))===page.model.visibleMainTextSHA256,'own current criteria or hiring context hidden')
 const root=one(page.visible.nodes(n=>n.tag==='root'),'visible document')
 need(!unavailable.test(page.visible.text(root)),'current role explicitly unavailable, filled or closed')
 return{main,visible}
}
function publisher(configured,legal){
 header(configured);const scope=header(legal)
 const own=configured.visible.text(one(configured.visible.nodes(n=>n.tag==='main'),'configured publisher main'))
 need(own.includes('Outdoo (formerly MeetRecord)'),'original configured employer relationship missing')
 const text=legal.visible.text(scope.visible)
 need(text.includes('“Outdoo” is the brand name of the services provided by MeetRecord Inc.')&&text.includes('This website is owned and operated by MeetRecord Inc.')&&text.includes('Formal legal notices to Outdoo must be sent in writing to MeetRecord Inc.,'),'current legal original employer and Outdoo binding missing')
 return{originalCompany:COMPANY,legalCompany:'MeetRecord Inc.',currentBrand:'Outdoo AI',configuredPublisher:CONFIGURED,currentLegalPublication:LEGAL,originalEmployerBinding:'current own brand-name,operated-by and legal-notice statements',wholeCompanyInventoryQualified:false}
}
function board(page){
 const {main,visible}=header(page),section=one(within(main,n=>n.tag==='section'&&n.attrs.id==='positions'),'own current role cards')
 const cards=within(section,n=>n.tag==='a'&&typeof n.attrs.href==='string'&&n.attrs.href.startsWith('https://www.outdoo.ai/positions/'))
 need(cards.length===7,'changed or empty current role publication; no zero qualification')
 const rows=cards.map(n=>({url:n.attrs.href,text:page.raw.text(n),attrs:n.attrs,visibleText:page.visible.text(one(page.visible.nodes(v=>v.tag==='a'&&v.attrs.href===n.attrs.href&&cls(v,'v2-pg-so-role')),'visible own current role card'))}))
 need(same(rows,profile.cards),'current role membership, native country or full card context changed')
 for(const row of rows){
  const own=one(page.visible.nodes(n=>n.tag==='a'&&n.attrs.href===row.url&&cls(n,'v2-pg-so-role')),'visible own current role card')
  need(page.visible.text(own)===row.visibleText,'current role card hidden or incomplete')
  row.title=page.visible.text(one(within(own,n=>n.tag==='h3'&&n.attrs['data-cms-field']==='name'),'own role card title'))
  row.location=page.visible.text(one(within(own,n=>n.tag==='span'&&n.attrs['data-cms-field']==='location'),'own native card location'))
  row.nativeCard=cards.find(n=>n.attrs.href===row.url)
 }
 const common=structuredClone(main),positions=one(within(common,n=>n.tag==='section'&&n.attrs.id==='positions'),'common hiring context boundary');positions.children=[]
 // Standard FAQ details publish additional hiring conditions and a native
 // email alternative. Retain all authored answers alongside visible benefits.
 const commonHiringContext=page.raw.text(common)
 need(commonHiringContext.includes('Health Care Insurance')&&commonHiringContext.includes('Each role lists its location.')&&commonHiringContext.includes('careers@outdoo.ai'),'complete current common hiring conditions missing')
 const nativeDeclaredCount=within(visible,n=>n.attrs.id==='role-count').map(n=>page.visible.text(n))
 return{cards:rows,commonHiringContext,nativeDeclaredCount,main}
}
function role(page,card,commonHiringContext,employer){
 const expected=profile.roles.find(x=>x.url===card.url);need(expected,'unreviewed own role URL')
 const {main,visible}=header(page)
 need(card.title===expected.title&&card.location==='Bengaluru, India','current card lacks exact own title or assigned India country')
 const h1=one(within(visible,n=>n.tag==='h1'&&n.attrs['data-cms-field']==='name'),'own visible title')
 need(page.visible.text(h1)===expected.title,'own role title mismatch')
 const head=one(within(main,n=>n.tag==='section'&&cls(n,'v2-pg-cmsb-head')),'own labelled role header')
 const fields=within(head,n=>['b','dd'].includes(n.tag)&&n.attrs['data-cms-field']&&n.attrs['data-cms-field']!=='name').map(n=>({field:n.attrs['data-cms-field'],value:page.raw.text(n)}))
 need(same(fields,expected.nativeFields),'own native country,employment,compensation,skills or experience changed')
 const locations=within(head,n=>n.attrs['data-cms-field']==='location').map(n=>page.raw.text(n))
 need(locations.length===2&&locations.every(x=>x==='Bengaluru, India'),'missing or conflicting own assigned work-country')
 const visibleLocations=page.visible.nodes(n=>n.attrs['data-cms-field']==='location'&&['b','dd'].includes(n.tag))
 need(visibleLocations.length>=1&&visibleLocations.every(n=>page.visible.text(n)==='Bengaluru, India'),'own native country not visible')
 const jd=one(within(main,n=>n.attrs['data-cms-field']==='about-the-meetrecord'),'complete authored role criteria'),shown=one(page.visible.nodes(n=>n.attrs['data-cms-field']==='about-the-meetrecord'),'visible authored role criteria')
 const shape=retained(jd).map(({node:n})=>({tag:n.tag,attrs:n.attrs,inert:!!n.inert,raw:n.raw??null})),path=one(page.rows.filter(x=>x.node===jd),'role criteria ancestry').ancestors.map(n=>({tag:n.tag,attrs:n.attrs}))
 need(same(shape,expected.jdShape)&&same(path,expected.jdAncestors),'unreviewed or hidden full native criterion structure')
 const description=page.raw.text(jd)
 need(sha(description)===expected.jdTextSHA256&&description.length===expected.jdCharacters&&page.visible.text(shown)===description,'missing,truncated or hidden authored full criteria')
 need(description.includes('Key Responsibilities')&&description.includes('Requirements')&&description.includes('About Outdoo AI:'),'native role employer or complete mandatory sections missing')
 const applies=within(main,n=>n.tag==='a'&&n.attrs['data-cms-field']==='application-link')
 need(applies.length===3&&applies.every(n=>n.attrs.href===expected.applyURL&&!Object.hasOwn(n.attrs,'disabled')&&n.attrs['aria-disabled']!=='true'),'own exact role-specific application identity changed')
 const appURL=new URL(expected.applyURL)
 need(appURL.origin==='https://wellfound.com'&&/^\/jobs\/\d+-[a-z0-9-]+$/.test(appURL.pathname)&&!appURL.search&&!appURL.hash,'unreviewed current external application URL')
 const currentEmail=one(within(shown,n=>n.tag==='a'&&n.attrs.href==='mailto:'+expected.email),'current native email application alternative')
 need(page.visible.text(currentEmail)===expected.email&&description.includes('Apply online or drop your resume at '+expected.email),'native email application not current and role-owned')
 const compensation=one(fields.filter(x=>x.field==='compensation'),'native compensation').value
 return{url:page.url,title:expected.title,nativeFields:fields,compensation,description,commonHiringContext,nativeListingCard:card,fullOwnedRoleMain:page.raw.text(main),rawAuthoredRole:jd,
  rawPublishedSchemas:page.raw.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>parseEightfoldJson(n.raw)),employer,
  countryProof:{cardURL:BOARD,cardTitle:card.title,nativeCardLocation:card.location,nativeRoleLocations:locations,sourceCountry:'India',countryInferredFromCity:false},
  application:{externalURL:expected.applyURL,email:expected.email,emailURL:'mailto:'+expected.email,publicationURL:page.url,nativeRoleSpecificExternalURL:expected.applyURL,currentRoleOwnedEmailAlternative:true,externalApplicationRead:false,applicationSubmissionPerformed:false}}
}

export async function runCurrentMeetrecord(options={}){
 need(!options.fetchText&&!options.fetchPage,'current full HTTP metadata required; body-only legacy transport cannot qualify roles')
 const duration=options.sourceDeadlineMs??85000;need(Number.isSafeInteger(duration)&&duration>0&&duration<=85000,'invalid source deadline')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(problem('source deadline exceeded')),duration),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const fetchImpl=options.fetchImpl||globalThis.fetch,receipts=[],allowed=new Set([CONFIGURED]),seenConditionalPrograms=new Set();let count=0,total=0
 const read=async(url,kind)=>{
  signal.throwIfAborted();need(allowed.has(url)&&++count<=40,'declared native public URL or read bound')
  const packet=await boundedDeclaredPublicRead(url,{signal,timeoutMs:15000,overflowError:problem('native response byte bound'),fetchImpl:async(value,init)=>{
   const response=await fetchImpl(value,{...init,cache:'no-store',credentials:'omit',headers:{...init.headers,'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'}})
   const body=response.body===null?null:{cancel:reason=>response.body.cancel(reason),getReader(){const reader=response.body.getReader();let bytes=0;return{async read(){const part=await reader.read();if(!part.done){need(types.isUint8Array(part.value),'native response chunk type');const size=byteLength.call(part.value);need(size<=4000000-bytes&&size<=24000000-total,'native stream byte bound');bytes+=size;total+=size}return part},cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}}}
   return{status:response.status,url:response.url,headers:response.headers,body}
  }})
  const bytes=Buffer.from(packet.bodyBase64,'base64'),html=new TextDecoder('utf-8',{fatal:true}).decode(bytes)
  receipts.push({requestedURL:url,...packet,body:html,bodySHA256:sha(bytes)})
  need(packet.url===url&&packet.status===200,'native URL or public HTTP '+packet.status+' changed')
  const mime=(packet.headers['content-type']||'').split(';')[0].trim().toLowerCase()
  need(kind==='style'?mime==='text/css':kind==='program'?['application/javascript','text/javascript'].includes(mime):['text/html','application/xhtml+xml'].includes(mime),'native public response type changed')
  return{url,html}
 }
 const phase=async()=>{
  const resources=new Map()
  const page=async url=>{
   const result=await read(url,'html'),raw=readNativeDocument(normalizeNativeAttributeBoundaries(result.html)),root=one(raw.nodes(n=>n.tag==='root'),'authored document root'),rows=retained(root),model=profile.pages[url]
   need(model,'unreviewed own HTML publication')
   need(!rows.some(({node:n})=>n.tag==='base'||Object.keys(n.attrs).some(k=>/^on[a-z]/i.test(k))),'unreviewed native activation or base declaration')
   const programs=rows.filter(x=>x.node.tag==='script'&&!Object.hasOwn(x.node.attrs,'src')).map(({node:n,ancestors})=>({attrs:n.attrs,sha256:sha(n.raw||''),ancestors:ancestors.map(n=>({tag:n.tag,attrs:n.attrs}))}))
   need(same(programs,model.inlinePrograms),'current complete inline/schema programs changed or unreviewed')
   // JSON is parsed without evaluation and duplicate object keys are rejected.
   for(const node of raw.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'))parseEightfoldJson(node.raw)
   need(same(rows.map(x=>x.node).filter(n=>n.tag==='meta'||Object.keys(n.attrs).some(authority)).map(n=>({tag:n.tag,attrs:n.attrs})),model.authorityCarriers),'unreviewed retained native employer,country or criterion carrier')
   const carriers=rows.filter(({node:n})=>['iframe','object','embed','form','input','button','select','textarea','img','picture','video','audio','source'].includes(n.tag)).map(({node:n,ancestors})=>({tag:n.tag,attrs:n.attrs,raw:n.raw??null,ancestors:ancestors.map(n=>({tag:n.tag,attrs:n.attrs}))}))
   need(same(carriers,model.publicationCarriers),'unreviewed native embedded context,media or application control')
   const inline=rows.filter(({node:n,ancestors})=>n.tag==='style'&&!ancestors.some(a=>a.inert)||!n.inert&&Object.hasOwn(n.attrs,'style')).map(({node:n})=>({tag:n.tag,attrs:n.tag==='style'?n.attrs:{style:n.attrs.style},sha256:n.tag==='style'?sha(n.raw||''):null}))
   need(same(inline,model.inlineStyles),'native inline hiding/style inventory changed')
   const styles=raw.nodes(n=>n.tag==='link'&&n.attrs.rel==='stylesheet').map(n=>n.attrs),scripts=raw.nodes(n=>n.tag==='script'&&Object.hasOwn(n.attrs,'src')).map(n=>n.attrs)
   const conditional=scripts.filter(s=>profile.optionalExternalPrograms.some(p=>p.src===s.src))
   need(conditional.length<=1&&conditional.every(s=>profile.optionalExternalPrograms.some(p=>same(p,s))),'unreviewed or duplicate conditional analytics program')
   need(same(styles,model.stylesheets)&&same(scripts.filter(s=>!conditional.includes(s)),model.externalPrograms),'current declared native styles or external programs changed')
   for(const s of conditional)seenConditionalPrograms.add(s.src)
   for(const[kind,list]of[['style',styles.map(x=>x.href)],['program',scripts.map(x=>x.src)]])for(const declared of list){
    const address=new URL(declared,url).href,reviewed=profile.resources[address]
    need(reviewed?.kind===kind,'unreviewed native public resource');allowed.add(address)
    if(!resources.has(address)){const resource=await read(address,kind);need(sha(resource.html)===reviewed.sha256&&Buffer.byteLength(resource.html)===reviewed.bytes,'current declared '+kind+' bytes changed');resources.set(address,resource.html)}
   }
   const visible=presentation(raw,styles.map(x=>resources.get(new URL(x.href,url).href)).join('\n'))
   return{...result,raw,visible,rows,model}
  }
  const configured=await page(CONFIGURED);header(configured)
  for(const url of[BOARD,LEGAL]){need(configured.raw.nodes(n=>n.tag==='a'&&n.attrs.href===url).length>=1,'current configured own careers/legal link changed');allowed.add(url)}
  const career=await page(BOARD),legal=await page(LEGAL),employer=publisher(configured,legal),publication=board(career),roles=[]
  for(const card of publication.cards){
   if(card.location!=='Bengaluru, India')continue
   need(profile.roles.some(x=>x.url===card.url),'new own explicit-country role requires review');allowed.add(card.url)
   roles.push(role(await page(card.url),card,publication.commonHiringContext,employer))
  }
  need(roles.length===2,'current fully qualified own India roles missing; no empty inventory claim')
  // The exact current non-authoritative analytics insertion may disappear
  // between HTTP representations. If it was observed, still freshly close
  // its pinned whole bytes; it supplies no recruitment proof.
  for(const url of seenConditionalPrograms)if(!resources.has(url)){
   const resource=await read(url,'program'),reviewed=profile.resources[url]
   need(sha(resource.html)===reviewed.sha256&&Buffer.byteLength(resource.html)===reviewed.bytes,'closing conditional analytics program bytes changed');resources.set(url,resource.html)
  }
  return{roles,cards:publication.cards,commonHiringContext:publication.commonHiringContext,nativeDeclaredCount:publication.nativeDeclaredCount,employer,
   heldRecords:publication.cards.filter(card=>card.location!=='Bengaluru, India').map(card=>({...card,reason:'native-assigned-work-country-not-published'}))}
 }
 try{
  signal.throwIfAborted();const opening=await phase(),closing=await phase()
  need(same(opening,closing),'closing full role,application,publisher,country,criteria or membership changed');signal.throwIfAborted()
  const jobs=opening.roles.map(r=>{
   const nativeFields=r.nativeFields.map(f=>f.field+': '+f.value).join('\n'),description=r.commonHiringContext+'\n\n'+r.nativeListingCard.text+'\n'+nativeFields+'\n\n'+r.description
   return{source:SOURCE,company:COMPANY,title:r.title,jobId:r.url,requisitionId:null,sourceNativeIdentifier:null,sourceCanonicalRoleURL:r.url,sourceUrl:r.url,link:r.url,applyUrl:r.application.externalURL,
    country:'India',city:'Bengaluru',location:'Bengaluru, India',employmentType:'Full Time',remoteStatus:null,jobDescription:description,sourceDescription:description,
    sourceNativeCommonHiringContext:r.commonHiringContext,sourceNativeListingCard:r.nativeListingCard,sourceNativeFullOwnedMain:r.fullOwnedRoleMain,sourceNativeRole:r.rawAuthoredRole,sourceNativeFields:r.nativeFields,sourceNativeCompensationRaw:r.compensation,sourceNativePublishedSchemas:r.rawPublishedSchemas,
    sourceNativeCountryProof:r.countryProof,sourceNativeEmployerProof:r.employer,sourceNativeApplication:r.application,postingDate:null,firstEverPostedAt:null,closingDate:null,sourcePostedDateRaw:null,
    sourceDetailComplete:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,scrapedAt:new Date().toISOString()}
  })
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{source:SOURCE,originalResponses:receipts,openingCards:opening.cards,closingCards:closing.cards,heldRecords:opening.heldRecords,currentFullClosingReconciled:true,
   nativeDeclaredRoleCountLabels:opening.nativeDeclaredCount,nativeDeclaredCountIsInventoryTotal:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,renderedApplicationClaim:false}})
  attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:opening.cards.length,observedVacancyCount:opening.cards.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,reportedTotal:null,indiaFacetCount:null,pagesFetched:count,verifiedAt:new Date().toISOString(),reason:'two own current full roles with explicit native work-country,current original legal employer and role-owned application alternative independently closed; five city-only cards held; whole-company scope and zero unqualified'})
 }catch(error){
  if(options.signal?.aborted)throw options.signal.reason
  try{if(error&&typeof error==='object'&&Object.isExtensible(error))Object.defineProperty(error,'sourceAudit',{value:{source:SOURCE,originalResponses:receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false},enumerable:true,configurable:true,writable:true})}catch{}
  throw error
 }finally{clearTimeout(timer)}
}
