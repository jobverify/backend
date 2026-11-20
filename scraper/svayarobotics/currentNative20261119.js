import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {setTimeout as delay} from 'node:timers/promises'
import {decodeHTML} from 'entities'
import {boundedDeclaredPublicGet} from '../../scraper-support/native-sources/boundedDeclaredPublicGet.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {qualifiedFirstPartyHTML,retained,nativeText,nativeLines,clean} from '../../scraper-support/native-sources/firstPartyNativeHtml.js'
import {readOriginalNativeCriteria} from '../../scraper-support/native-sources/currentNativeCriteria20261106.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

export const SOURCE='svayarobotics',COMPANY='Svaya Robotics',COMPANY_DOMAIN='svayarobotics.com'
export const HOMEPAGE_URL='https://svayarobotics.com/',CAREERS_URL=HOMEPAGE_URL+'careers/'
const PROFILE=JSON.parse(readFileSync(new URL('./currentProfile20261119.json',import.meta.url),'utf8'))
const sha=value=>createHash('sha256').update(value).digest('hex')
const failure=message=>firstPartyFailure(SOURCE,message,{nativeAuthorityFailure:true})
const need=(ok,message)=>{if(!ok)throw failure(message)}
const cls=(node,value)=>(node.attrs.class||'').split(/\s+/).includes(value)
const key=value=>decodeHTML(clean(value)).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'')
const one=(rows,label)=>{need(rows.length===1,'Missing or ambiguous '+label);return rows[0]}
const label=node=>clean(decodeHTML(nativeText(node)))
const descendants=(node,predicate)=>retained(node,predicate)
const roleURL=url=>/^https:\/\/svayarobotics\.com\/job\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/.test(url)
const resourceKey=value=>{
 const url=new URL(value)
 if(url.origin===HOMEPAGE_URL.slice(0,-1)&&PROFILE.wordpressCacheBusterPaths.includes(url.pathname)){
  need(/^\?ver=\d{10}$/.test(url.search)&&!url.hash,'Unreviewed native theme cache-buster declaration')
  url.search='?ver=WORDPRESS_CACHE_BUSTER'
 }
 return url.href
}
const normalizeInline=node=>{
 const text=node.raw||''
 if(node.attrs.id==='ultimate-post-list-js-extra'){
  need(/^\s*var upl_vars = \{"upl_nonce":"[a-z0-9]+","ajaxurl":"https:\/\/svayarobotics\.com\/wp-admin\/admin-ajax\.php"\};\s*\/\/# sourceURL=ultimate-post-list-js-extra\s*$/.test(text),'Unreviewed native nonce declaration')
  return text.replace(/"upl_nonce":"[a-z0-9]+"/,'"upl_nonce":"VOLATILE_NATIVE_NONCE"')
 }
 return text
}
const resources=new Map(PROFILE.resources.map(row=>[row.url,row]))
const presentationAttributes=new Set(PROFILE.criticalPresentationAttributes)
function qualifyCriticalPresentation(page){
 const all=node=>[node,...node.children.filter(child=>typeof child!=='string').flatMap(all)]
 const root=one(page.raw.nodes(node=>node.tag==='root'),'original role presentation root'),parents=new Map()
 for(const node of all(root))for(const child of node.children)if(typeof child!=='string')parents.set(child,node)
 const selected=new Set()
 for(const node of page.raw.nodes(node=>cls(node,'main_job_singal')||cls(node,'career-block-3'))){
  for(const child of all(node))selected.add(child)
  for(let parent=node;parent;parent=parents.get(parent))selected.add(parent)
 }
 for(const node of selected)for(const [name,raw]of Object.entries(node.attrs))if(['class','style','hidden','inert','aria-hidden','disabled','readonly','aria-disabled'].includes(name)){
  const value=node.tag==='body'&&name==='class'?raw.replace(/\bpostid-\d+\b/g,'postid-NATIVE_POST_ID'):raw
  need(presentationAttributes.has(JSON.stringify([node.tag,name,value])),'Critical native presentation attribute requires review')
 }
}
function inspect(html,url,kind){
 const page=qualifiedFirstPartyHTML(html,url,failure)
 const executable=page.raw.nodes(node=>node.tag==='script'&&/^(?:|module|(?:text|application)\/(?:java|ecma)script)$/i.test(node.attrs.type||''))
 const styles=page.raw.nodes(node=>node.tag==='link'&&node.attrs.rel==='stylesheet').map(node=>node.attrs)
 const programs=executable.map(node=>node.attrs.src?{src:resourceKey(new URL(node.attrs.src,url).href)}:{id:node.attrs.id||null,inlineSHA256:sha(normalizeInline(node))})
 const signature={styles,programs,inlineStyles:[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].map(match=>sha(match[1])),
  events:page.raw.nodes(()=>true).flatMap(node=>Object.entries(node.attrs).filter(([name])=>name.startsWith('on')).map(([attribute,value])=>({tag:node.tag,attribute,value})))}
 need(JSON.stringify(signature)===JSON.stringify(PROFILE.signatures[kind]),'Native presentation or complete renderer declaration requires review')
 need(!page.raw.nodes(node=>['base','iframe','frame','frameset','object','embed'].includes(node.tag)||Object.hasOwn(node.attrs,'srcdoc')||node.tag==='meta'&&(node.attrs['http-equiv']||'').toLowerCase()==='refresh').length,'Delegated native document requires review')
 const declared=[...styles.map(node=>new URL(node.href,url).href),...executable.filter(node=>node.attrs.src&&new URL(node.attrs.src,url).host==='svayarobotics.com').map(node=>new URL(node.attrs.src,url).href)]
 need(declared.every(value=>resources.has(resourceKey(value))),'Unreviewed native executable or stylesheet')
 return {...page,html,url,declared}
}
export function readSvayaHomepage(html){
 const page=inspect(html,HOMEPAGE_URL,'home')
 need(page.title==='Leading Collaborative Robot Manufacturers - Svaya Robotics','Native homepage publisher changed')
 const links=page.visible.nodes(node=>node.tag==='a'&&node.attrs.href===CAREERS_URL)
 need(links.some(node=>/^Careers$/i.test(label(node))),'Homepage no longer links the own careers page')
 return page
}
export function readSvayaListing(html){
 const page=inspect(html,CAREERS_URL,'careers')
 need(page.title==='Careers - Product - svayarobotics','Native careers publisher changed')
 const container=one(page.visible.nodes(node=>cls(node,'career-job-list')),'native own vacancy list')
 const cards=descendants(container,node=>cls(node,'job-row'))
 need(cards.length>0&&cards.length<=100,'Native positive inventory missing or unbounded; company zero unproven')
 const ids=new Set(),records=cards.map(card=>{
  const title=label(one(descendants(card,node=>cls(node,'text-1')),'native role title'))
  const location=label(one(descendants(card,node=>cls(node,'city')),'native role location'))
  const anchor=one(descendants(card,node=>node.tag==='a'),'native own role link'),url=anchor.attrs.href
  need(roleURL(url)&&label(anchor)==='Apply Now'&&!Object.hasOwn(anchor.attrs,'disabled')&&anchor.attrs['aria-disabled']!=='true','Native own role link changed')
  need(title&&location&&!ids.has(url),'Missing or duplicate native role identity');ids.add(url)
  return {title,location,url}
 })
 return {...page,records}
}
function originalCriteriaHTML(html){
 const matches=[...html.matchAll(/<div\s+class=["']singal_job_details["'][^>]*>/g)]
 need(matches.length===1,'Original own criteria carrier missing or ambiguous')
 const start=matches[0].index,tokens=/<\/?div\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/g
 tokens.lastIndex=start;let depth=0
 for(let token;(token=tokens.exec(html));){depth+=token[0].startsWith('</')?-1:1;if(depth===0)return html.slice(start,tokens.lastIndex)}
 throw failure('Unbounded original own criteria carrier')
}
export function readSvayaRole(html,record){
 need(roleURL(record.url),'Unbound native own role URL')
 const page=inspect(html,record.url,'role')
 qualifyCriticalPresentation(page)
 const owner=one(page.visible.nodes(node=>cls(node,'main_job_singal')),'native own role owner')
 const heading=one(descendants(owner,node=>cls(node,'top_hedding')),'native own role heading')
 const title=label(one(descendants(heading,node=>node.tag==='h2'),'own detail title'))
 const location=label(one(descendants(heading,node=>node.tag==='strong'),'own detail location'))
 need(title===record.title&&location===record.location,'Native listing/detail identity or whole location conflict')
 need(key(page.title)===key(title+' - Product - svayarobotics'),'Native role document title contradicts its role')
 need(['Hyderabad','Medchal-Hyderabad'].includes(location),'Unknown, remote, foreign or mixed whole native location')
 const criteriaOwner=one(descendants(owner,node=>cls(node,'singal_job_details')),'own full criteria owner')
 const sections=descendants(criteriaOwner,node=>cls(node,'jobdics_row'))
 need(sections.every(section=>section.attrs.class==='jobdics_row wow fadeInUp'),'Native reviewed WOW section activation changed')
 const headings=sections.map((section,index)=>{
  const rows=descendants(section,node=>node.tag==='h3')
  if(index===0&&!rows.length&&/^Svaya works at the cutting edge of embodied-AI robotics,/.test(label(section)))return null
  return label(one(rows,'native criteria heading'))
 })
 need(headings.length>=4&&headings.some(value=>/^About (?:the )?Role$/i.test(value))
  &&headings.includes('Your Work')&&headings.some(value=>/^What We[’']re Looking For$/i.test(value))
  &&headings.some(value=>/^(?:Experience (?:&|and) Qualification|Education)$/i.test(value)),'Native complete criteria sections missing')
 const criteriaHTML=originalCriteriaHTML(html),criteria=readOriginalNativeCriteria(criteriaHTML,failure)
 const text=nativeLines(criteriaOwner).map(decodeHTML).join('\n')
 need(criteria.sourceDetailComplete&&text.length>=1000&&key(text)===key(criteria.sourceDescription),'Native full criteria are hidden, shortened or incomplete')
 need(!/\b(?:this (?:position|role|job) is (?:closed|filled)|no longer accepting applications|applications (?:are )?closed)\b/i.test(text),'Native own role explicitly closed')
 for(const line of text.split('\n')){
  for(const match of line.matchAll(/\b(?:work(?:place)?\s+country|job\s+country|country)\s*:\s*([^.;]+)/gi))need(/^(?:India|IN)$/i.test(match[1].trim()),'Native detail country contradicts its location')
  for(const match of line.matchAll(/\b(?:employer|hiring\s+(?:company|organization))\s*:\s*([^;]+)/gi))need(['svayarobotics','svayaroboticsprivatelimited','svayaroboticspvtltd'].includes(key(match[1])),'Native detail employer contradicts Svaya')
 }
 const appOwner=one(page.visible.nodes(node=>cls(node,'career-block-3')),'native own application owner')
 const form=one(descendants(appOwner,node=>node.tag==='form'),'native own application form')
 need(form.attrs.action===new URL(record.url).pathname+'#wpcf7-f448-o1'&&form.attrs.method==='post'
  &&form.attrs.enctype==='multipart/form-data'&&form.attrs['data-status']==='init','Native own application form context changed')
 const controls=descendants(form,node=>['input','textarea','select','button','fieldset'].includes(node.tag))
 need(controls.every(node=>!Object.hasOwn(node.attrs,'disabled')&&!Object.hasOwn(node.attrs,'readonly')&&node.attrs['aria-disabled']!=='true'),'Native candidate controls disabled or readonly')
 for(const name of ['first_name','last_name','email','phone','job_position','attach_file']){
  const control=one(controls.filter(node=>node.attrs.name===name),'candidate '+name)
  need(control.attrs['aria-required']==='true'&&control.tag==='input'&&!control.inert,'Native required candidate field changed')
  if(!['email','attach_file'].includes(name))need(control.attrs.type==='text','Native candidate text field changed')
  if(name==='email')need(control.attrs.type==='email','Native candidate email field changed')
  if(name==='attach_file')need(control.attrs.type==='file'&&control.attrs.accept==='.pdf,.doc,.docx','Native candidate CV field changed')
 }
 const submit=one(controls.filter(node=>node.attrs.type==='submit'),'native candidate submission control')
 need(submit.attrs.value==='Apply Now','Native candidate submit label changed')
 const application={attrs:structuredClone(form.attrs),controls:controls.map(node=>({tag:node.tag,attrs:structuredClone(node.attrs)})),
  nativeFormId:'448',positionPrefilled:false,backendSubmissionVerified:false,applicationSubmitted:false}
 return {...page,record:{...record,criteriaHTML,criteriaLines:criteria.sourceDescriptionLines,form:application},description:criteria.sourceDescription,
  experience:sections.filter((_,index)=>/^Experience (?:&|and) Qualification$/i.test(headings[index])).map(section=>nativeLines(section).slice(1).join(' ')).join(' ')||null}
}

export async function runCurrentSvaya(options={}){
 options.signal?.throwIfAborted()
 const sourceTimeoutMs=options.sourceTimeoutMs??180000,requestTimeoutMs=options.requestTimeoutMs??15000
 need(Number.isSafeInteger(sourceTimeoutMs)&&sourceTimeoutMs>0&&sourceTimeoutMs<=180000&&Number.isSafeInteger(requestTimeoutMs)&&requestTimeoutMs>0&&requestTimeoutMs<=15000,'Invalid source or request deadline')
 need(options.maxJobs==null||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>0,'Invalid caller job limit')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(new DOMException('Svaya native source deadline','TimeoutError')),sourceTimeoutMs)
 const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const audit={source:SOURCE,nativeEmployerDisplayName:COMPANY,companyScopeComplete:false,lifecycleCleanupAllowed:false,
  applicationSubmitted:false,backendSubmissionVerified:false,receipts:[],heldNativeRoles:[],cacheBusterQualification:PROFILE.cacheBusterEvidence,
  criteriaPresentationReview:PROFILE.criteriaPresentationReview}
 const allowed=new Set([HOMEPAGE_URL,CAREERS_URL]);let bytes=0,nextStart=0
 const read=async(url,type)=>{
  signal.throwIfAborted();need(allowed.has(url)&&audit.receipts.length<96,'Unbound native URL or read budget exceeded')
  if(nextStart>performance.now())await delay(nextStart-performance.now(),undefined,{signal})
  signal.throwIfAborted();nextStart=performance.now()+500
  const response=await boundedDeclaredPublicGet(url,{signal,timeoutMs:requestTimeoutMs,overflowError:failure('Native entity byte ceiling exceeded'),
   fetchImpl:(requested,init)=>(options.fetchImpl||globalThis.fetch)(requested,{...init,credentials:'omit',cache:'no-store'})})
  const body=Buffer.from(response.bodyBase64,'base64');bytes+=body.length
  audit.receipts.push({requestedUrl:url,url:response.url,status:response.status,bytes:body.length,sha256:sha(body),contentType:response.headers['content-type']||null})
  need(bytes<=16*1024*1024&&response.status===200&&response.url===url,'Native HTTP authority or aggregate byte budget changed')
  need((type==='css'?/^text\/css(?:;|$)/i:type==='javascript'?/^(?:text|application)\/(?:java|ecma)script(?:;|$)/i:/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i).test(response.headers['content-type']||''),'Native MIME changed')
  return new TextDecoder('utf-8',{fatal:true}).decode(body)
 }
 const qualifyResources=async(page,cache)=>{
  for(const url of page.declared){const id=resourceKey(url);if(cache.has(id))continue
   const profile=resources.get(id);need(profile,'Unreviewed physical native asset');allowed.add(url)
   const body=await read(url,profile.type)
   need(Buffer.byteLength(body)===profile.bytes&&sha(body)===profile.sha256,'Complete native client or stylesheet changed')
   cache.add(id)
  }
 }
 const collect=async()=>{
  const cache=new Set(),home=readSvayaHomepage(await read(HOMEPAGE_URL,'html'));await qualifyResources(home,cache)
  const listing=readSvayaListing(await read(CAREERS_URL,'html'));await qualifyResources(listing,cache)
  const roles=[]
  for(const record of listing.records){allowed.add(record.url)
   const page=readSvayaRole(await read(record.url,'html'),record);await qualifyResources(page,cache);roles.push(page)
  }
  return {listing:listing.records,roles}
 }
 try{
  const opening=await collect();audit.nativeOpeningRecords=opening.roles.map(page=>page.record);audit.nativeInventoryCount=opening.listing.length
  const closing=await collect();audit.nativeClosingRecords=closing.roles.map(page=>page.record)
  need(JSON.stringify(opening.listing)===JSON.stringify(closing.listing)&&JSON.stringify(audit.nativeOpeningRecords)===JSON.stringify(audit.nativeClosingRecords),'Closing native inventory, full criteria or application context changed')
  audit.closingReconciled=true;audit.decodedBytes=bytes
  const at=typeof options.now==='function'?options.now():new Date(),scrapedAt=new Date(at).toISOString()
  const jobs=opening.roles.map(page=>({source:SOURCE,company:COMPANY,companyDomain:COMPANY_DOMAIN,companyCareerPage:CAREERS_URL,
   atsPlatform:'official-company-careers',title:page.record.title,jobId:'svayarobotics-'+new URL(page.url).pathname.split('/')[2],
   sourceNativeJobId:null,requisitionId:null,jobIdentifierProvenance:'derived own native role path; no native requisition ID exposed',legalEmployer:null,
   location:page.record.location+', Telangana, India',sourceLocation:page.record.location,city:page.record.location==='Hyderabad'?'Hyderabad':'Medchal',state:'Telangana',country:'India',
   sourceGeographyEvidence:{kind:'finite-whole-native-location',nativeLocation:page.record.location,references:['https://hyderabad.telangana.gov.in/about-district/','https://medchal-malkajgiri.telangana.gov.in/']},
   sourceUrl:page.url,applyUrl:page.url,link:page.url,jobDescription:page.description,sourceDescription:page.description,nativeRoleRecord:page.record,
   experienceRequired:page.experience,requiredSkills:[],minimumQualification:null,employmentType:null,workplaceType:null,postingDate:null,closingDate:null,
   sourceDetailComplete:true,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,nativeRoleClosingReconciled:true,
   sourceApplicationHandoff:'Own native role page and active candidate form; applicant must enter job_position; backend delivery unverified',
   applicationVisited:false,applicationSubmitted:false,backendSubmissionVerified:false,scrapedAt}))
  const selected=options.maxJobs==null?jobs:jobs.slice(0,options.maxJobs)
  attachSourceObservationEvidence(selected,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:opening.listing.length,observedVacancyCount:opening.listing.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(selected,'nativeCollectionEvidence',{value:audit,configurable:true})
  signal.throwIfAborted()
  return attachInventoryEvidence(selected,{status:'discovery-only',surface:CAREERS_URL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:audit.receipts.length,reportedTotal:opening.listing.length,indiaFacetCount:jobs.length,verifiedAt:scrapedAt,reason:'Own employer native roles, whole criteria and candidate form reconciled at closing; whole company inventory and backend submission remain unproven'})
 }catch(error){options.signal?.throwIfAborted();if(error&&typeof error==='object')error.sourceAudit=audit;throw error}
 finally{clearTimeout(timer);controller.abort()}
}
