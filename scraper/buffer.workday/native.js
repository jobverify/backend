import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {activeScripts,decodeNativeEntities,readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

export const SOURCE='buffer'
export const CAREERS_URL='https://buffer.com/journey'
const TITLE='Join the Buffer journey - Jobs at Buffer'
const EMPTY='There are currently no open roles.'
const ALL_ROLES='We post all open roles here, and only accept job applications through the forms on this page.'
const NATIVE_SCOPE='Please be aware: we\u2019ve received a few concerning reports that scammers are falsely using Buffer\u2019s name and reaching out to people about fake job opportunities. '+ALL_ROLES
const MAX_BYTES=1_000_000,MAX_AGE=48*3600000
const norm=value=>decodeNativeEntities(value).replace(/\s+/g,' ').trim()
const children=node=>node.children.filter(child=>typeof child!=='string'&&!child.inert)
const within=(node,predicate)=>node.inert?[]:[...(predicate(node)?[node]:[]),...children(node).flatMap(child=>within(child,predicate))]
const rawWithin=(node,predicate)=>[...(predicate(node)?[node]:[]),...node.children.filter(child=>typeof child!=='string').flatMap(child=>rawWithin(child,predicate))]
const gap=()=>({status:'coverage-gap',surface:CAREERS_URL,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null})
const failure=(message,extra={})=>Object.assign(Error('Buffer native: '+message),{abortRetries:true,inventoryEvidence:gap(),...extra})
const need=(condition,message)=>{if(!condition)throw failure(message)}
const one=(nodes,label)=>{need(nodes.length===1,'missing or ambiguous '+label);return nodes[0]}
const cls=(node,prefix)=>(node.attrs.class||'').split(/\s+/).some(value=>value.startsWith(prefix))
const iso=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value))return null
 const canonical=value.replace(/(?:\.(\d{1,3}))?Z$/,(_match,fraction)=>'.'+(fraction||'').padEnd(3,'0')+'Z')
 const date=new Date(canonical)
 return Number.isFinite(+date)&&date.toISOString()===canonical?canonical:null
}
const sameURL=value=>{try{return new URL(value).href===CAREERS_URL}catch{return false}}

// Read only the demonstrated literal Flight carrier. No website JavaScript is
// executed. Nonempty summary rows are observations until role details and
// country scope can be qualified independently.
const clientInventory=html=>{
 const scripts=activeScripts(html).filter(script=>script.includes('jobPostingList'))
 if(!scripts.length)return {qualified:false,count:null,reason:'missing-native-role-list-proof'}
 need(scripts.length===1,'ambiguous native jobPostingList carriers')
 let ast
 try{ast=parse(scripts[0],{ecmaVersion:'latest'})}catch{throw failure('unsupported native role-data script')}
 const call=ast.body[0]?.expression,member=call?.callee,object=member?.object
 need(ast.body.length===1&&call?.type==='CallExpression'&&member?.type==='MemberExpression'&&!member.computed&&member.property?.name==='push'&&object?.type==='MemberExpression'&&!object.computed&&object.property?.name==='__next_f'&&object.object?.name==='self','unsupported native role-data carrier')
 const argument=call.arguments[0]
 need(call.arguments.length===1&&argument?.type==='ArrayExpression'&&argument.elements.length===2&&argument.elements[0]?.value===1&&argument.elements[1]?.type==='Literal'&&typeof argument.elements[1].value==='string','unsupported native role-data payload')
 const data=argument.elements[1].value
 need([...data.matchAll(/"jobPostingList"\s*:/g)].length===1,'ambiguous native jobPostingList')
 const lines=data.split('\n'),records=lines.filter(line=>line.includes('"jobPostingList"'))
 // Flight may declare shared chunk strings in an earlier literal push. Read
 // the same bounded stream without evaluating any website program.
 const referenceLines=activeScripts(html).flatMap(script=>{
  if(script===scripts[0])return lines
  let program
  try{program=parse(script,{ecmaVersion:'latest'})}catch{return []}
  const call=program.body[0]?.expression,member=call?.callee,object=member?.object,arg=call?.arguments?.[0]
  if(program.body.length!==1||call?.type!=='CallExpression'||member?.type!=='MemberExpression'||member.computed
   ||member.property?.name!=='push'||object?.type!=='MemberExpression'||object.computed
   ||object.property?.name!=='__next_f'||object.object?.name!=='self'||call.arguments.length!==1
   ||arg?.type!=='ArrayExpression'||arg.elements.length!==2||arg.elements[0]?.value!==1
   ||arg.elements[1]?.type!=='Literal'||typeof arg.elements[1].value!=='string')return []
  return arg.elements[1].value.split('\n')
 })
 need(records.length===1,'ambiguous native role inventory records')
 need([...records[0].matchAll(/"pageClass"\s*:/g)].length===1,'ambiguous native page identity fields')
 let record
 try{record=JSON.parse(records[0].replace(/^[\da-f]+:/i,''))}catch{throw failure('unsupported native role inventory record')}
 const props=record?.[3],roleNode=props?.children,roleProps=roleNode?.[3],roles=roleProps?.jobPostingList
 need(Array.isArray(roles),'unsupported native jobPostingList shape')
 need(roles.length<=250&&roles.every(role=>role&&typeof role==='object'&&!Array.isArray(role)
  &&Object.keys(role).length===3&&['id','title','departmentName'].every(key=>Object.hasOwn(role,key))
  &&typeof role.id==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(role.id)
  &&typeof role.title==='string'&&role.title.trim()&&role.title===norm(role.title)
  &&typeof role.departmentName==='string'&&role.departmentName.trim())
  &&new Set(roles.map(role=>role.id)).size===roles.length,'malformed or duplicate native role summaries')
 need(Array.isArray(record)&&record.length===4&&record[0]==='$'&&props?.pageClass==='/journey'&&props.locale==='en'&&Array.isArray(roleNode)&&roleNode.length===4&&roleNode[0]==='$'&&typeof roleNode[1]==='string'&&/^\$L[\da-f]+$/i.test(roleNode[1]),'native role inventory page binding contradiction')
 const moduleId=roleNode[1].slice(2),imports=referenceLines.filter(line=>line.startsWith(moduleId+':I'))
 need(imports.length===1,'ambiguous native role inventory module binding')
 let imported
 try{imported=JSON.parse(imports[0].slice(moduleId.length+2))}catch{throw failure('unsupported native role module binding')}
 need(Array.isArray(imported)&&imported[2]==='default'&&Array.isArray(imported[1]),'unsupported native role module chunks')
 const chunks=imported[1].map(chunk=>{
  if(typeof chunk!=='string'||!/^\$[\da-f]+$/i.test(chunk))return chunk
  const id=chunk.slice(1),records=referenceLines.filter(line=>line.startsWith(id+':'))
  need(records.length===1,'missing or ambiguous native module chunk reference')
  let value
  try{value=JSON.parse(records[0].slice(id.length+1))}catch{throw failure('nonliteral native module chunk reference')}
  need(typeof value==='string'&&/^static\/chunks\/[\w/%.-]+\.js$/.test(value),'unsupported native module chunk reference')
  return value
 })
 need(chunks.some(chunk=>typeof chunk==='string'&&/^static\/chunks\/app\/%5Blocale%5D\/journey\/page-[\da-f]+\.js$/i.test(chunk)),'native role inventory employer route contradiction')
 return {qualified:true,count:roles.length,roles,pageClass:props.pageClass,moduleReference:roleNode[1],moduleChunks:chunks}
}

export const inspectCurrentRoleSummaries=html=>{
 need(typeof html==='string'&&Buffer.byteLength(html)<=MAX_BYTES,'missing or oversized native body')
 const inventory=clientInventory(html)
 if(!inventory.qualified||inventory.count===0)return null
 const raw=readNativeDocument(html),doc=readVisibleNativeDocument(html,{strict:true})
 need(norm(one(raw.nodes(node=>node.tag==='title'),'native employer title').raw)===TITLE,'native employer title identity contradiction')
 need(sameURL(one(raw.nodes(node=>node.tag==='link'&&(node.attrs.rel||'').split(/\s+/).includes('canonical')),'native canonical').attrs.href),'native canonical identity contradiction')
 need(doc.text(one(doc.nodes(node=>node.tag==='h1'),'native employer heading'))==='Join the Buffer Journey','visible employer identity contradiction')
 const main=one(doc.nodes(node=>node.tag==='main'),'visible main')
 const section=one(within(main,node=>node.tag==='section'&&node.attrs.id==='open-roles'),'visible open-roles section')
 need(doc.text(one(within(section,node=>node.tag==='h2'),'open-roles heading'))==='Open roles','open-roles heading identity contradiction')
 const links=within(section,node=>node.tag==='a'&&node.attrs.href)
 need(links.length===inventory.count,'native role summaries and visible links disagree')
 const observations=inventory.roles.map(role=>{
  const href='/journey/'+role.id
  need(links.filter(node=>node.attrs.href===href&&doc.text(node)===role.title).length===1,'native role summary identity disagrees with visible title/link')
  return {...role,sourceUrl:'https://buffer.com'+href,country:null,sourceDetailComplete:false}
 })
 return {nativeRoles:inventory,observations}
}

export const inspectEmptyPage=html=>{
 need(typeof html==='string'&&Buffer.byteLength(html)<=MAX_BYTES,'missing or oversized native body')
 const raw=readNativeDocument(html),root=one(raw.nodes(node=>node.tag==='root'),'document'),head=one(raw.nodes(node=>node.tag==='head'),'native head')
 const title=one(within(head,node=>node.tag==='title'),'native employer title')
 need(norm(title.raw)===TITLE,'native employer title identity contradiction')
 const canonical=one(within(head,node=>node.tag==='link'&&(node.attrs.rel||'').split(/\s+/).includes('canonical')),'canonical')
 need(sameURL(canonical.attrs.href),'native canonical identity contradiction')
 for(const [property,value]of[['og:url',CAREERS_URL],['og:title',TITLE]]){
  const meta=one(within(head,node=>node.tag==='meta'&&node.attrs.property===property),'native '+property)
  need(meta.attrs.content===value,'native '+property+' identity contradiction')
 }
 const visible=readVisibleNativeDocument(html,{strict:true}),main=one(visible.nodes(node=>node.tag==='main'),'visible main')
 need(visible.nodes(node=>node.tag==='h1').length===1&&visible.text(visible.nodes(node=>node.tag==='h1')[0])==='Join the Buffer Journey','visible employer identity contradiction')
 need(rawWithin(root,node=>node.attrs.id==='open-roles').length===1,'ambiguous open-roles section')
 const section=one(within(main,node=>node.attrs.id==='open-roles'&&node.tag==='section'),'visible open-roles section')
 const container=one(children(section),'native empty-inventory container')
 need(container.tag==='div'&&cls(container,'OpenRolesSection_container__'),'unsupported native empty-inventory container')
 const heading=one(children(container).filter(node=>node.tag==='h2'),'open-roles heading')
 need(visible.text(heading)==='Open roles'&&section.attrs['aria-labelledby']===heading.attrs.id&&rawWithin(root,node=>node.attrs.id===heading.attrs.id).length===1,'open-roles heading identity contradiction')
 const empty=one(children(container).filter(node=>node.tag==='p'&&visible.text(node)===EMPTY),'visible explicit empty statement')
 const disclaimer=children(container).filter(node=>node.tag==='p'&&cls(node,'OpenRolesSection_disclaimer__'))
 need(disclaimer.length<=1,'ambiguous whole-hiring scope statement')
 const signup=one(children(container).filter(node=>node.tag==='div'&&cls(node,'OpenRolesSection_emailSignupContainer__')),'native newsletter container')
 need(children(container).every(node=>node===heading||node===empty||node===signup||disclaimer.includes(node))&&container.children.filter(child=>typeof child==='string').every(value=>!value.trim()),'unsupported additional native role content contradicts empty inventory')
 const signupHeading=one(within(signup,node=>node.tag==='h3'),'newsletter heading')
 need(visible.text(signupHeading)==='Be the first to know about new roles at Buffer','unsupported newsletter identity')
 const form=one(visible.nodes(node=>node.tag==='form'),'native form')
 need(within(signup,node=>node===form).length===1&&!form.attrs.action&&!form.attrs.method,'unknown hiring or application form contradicts empty inventory')
 const inputs=within(form,node=>['input','select','textarea'].includes(node.tag)),buttons=within(form,node=>node.tag==='button')
 need(inputs.length===1&&inputs[0].tag==='input'&&inputs[0].attrs.type==='email'&&inputs[0].attrs.name==='email'&&buttons.length===1&&buttons[0].attrs.type==='submit'&&visible.text(buttons[0])==='Subscribe','unknown hiring form controls contradict empty inventory')
 need(visible.frames().length===0,'active hiring frame contradicts empty inventory')
 const hiring=/\b(?:jobs?|careers?|hiring|vacanc(?:y|ies)|recruit(?:ment|ing)?|apply|open\s+(?:roles|positions)|join\s+(?:our|the)\s+team)\b/i
 for(const link of visible.nodes(node=>node.tag==='a'&&node.attrs.href)){
  const href=link.attrs.href,text=visible.text(link)
  if(!hiring.test(href+' '+text)&&!/^\/journey\//.test(href)&&!/ashbyhq|greenhouse|lever\.co|myworkdayjobs|smartrecruiters/i.test(href))continue
  const allowed=href==='#open-roles'&&text==='See our open roles'||href==='/journey'&&text==='Careers'
  need(allowed,'additional active hiring channel or role link contradicts empty inventory')
 }
 const pageBody=one(visible.nodes(node=>node.tag==='body'),'visible page body')
 need(!/\b(?:we(?:\s+are|['\u2019]re)\s+(?:currently\s+)?hiring|(?:currently|now)\s+hiring|job\s+openings|open\s+positions|apply\s+now)\b/i.test(visible.text(pageBody)),'additional active hiring statement contradicts empty inventory')
 need(!activeScripts(html).some(script=>/JobPosting\b/.test(script)),'contradictory native structured role data')
 const nativeRoles=clientInventory(html),scopeStatement=disclaimer[0]?visible.text(disclaimer[0]):null
 // A changed warning can be observed, but extra limitations cannot inherit the
 // demonstrated paragraph's whole-hiring scope merely by retaining one clause.
 const scopeQualified=scopeStatement===NATIVE_SCOPE
 return {title:TITLE,canonical:CAREERS_URL,heading:'Open roles',emptyStatement:EMPTY,scopeStatement,scopeQualified,nativeRoles,contract:JSON.stringify({title:TITLE,canonical:CAREERS_URL,heading:'Open roles',empty:EMPTY,scopeStatement,nativeRoleCount:nativeRoles.count,nativeRoleQualified:nativeRoles.qualified,newsletter:'email-only-subscribe'})}
}

const packet=raw=>{
 need(raw&&typeof raw==='object','native response metadata missing')
 const values=Object.create(null)
 for(const [key,descriptor]of Object.entries(Object.getOwnPropertyDescriptors(raw))){
  if(Object.hasOwn(descriptor,'value'))values[key]=descriptor.value
 }
 raw=values
 need(raw&&typeof raw==='object'&&raw.status===200,'native response status metadata missing or unsuccessful')
 need(sameURL(raw.url)&&sameURL(raw.finalUrl??raw.url)&&!raw.redirectLocation,'unexpected native response URL or redirect')
 need(typeof raw.body==='string'&&Buffer.byteLength(raw.body)<=MAX_BYTES,'missing or oversized native response body')
 const sha256=createHash('sha256').update(raw.body).digest('hex'),bytes=Buffer.byteLength(raw.body)
 need(raw.sha256==null||raw.sha256===sha256,'native response body fingerprint contradiction')
 need(raw.bytes==null||raw.bytes===bytes,'native response byte count contradiction')
 return {...raw,url:CAREERS_URL,finalUrl:CAREERS_URL,status:200,bytes,sha256,capturedAt:iso(raw.capturedAt),captureStartedAt:iso(raw.captureStartedAt??raw.startedAt)}
}
const fresh=(page,reference)=>page.capturedAt!=null&&+reference>=+new Date(page.capturedAt)&&+reference-+new Date(page.capturedAt)<=MAX_AGE&&(!page.captureStartedAt||+new Date(page.captureStartedAt)<=+new Date(page.capturedAt))
const result=(opening,openingProof,{closing=null,closingProof=null,complete=false,reason}={})=>{
 const jobs=[],audit={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:0,observedVacancyCount:0,observedListingCount:0,sourceScopeComplete:complete,reportedTotal:complete?0:null,indiaFacetCount:complete?0:null,closingInventoryMatches:closingProof?openingProof.contract===closingProof.contract:null,nativeJobPostingCount:openingProof.nativeRoles.count,opening,closing,openingProof,closingProof,rawProvenanceLimit:'Only the exact current native employer page and independently timed closing can establish empty scope; historical ATS metadata and unsupported future role schemas confer no authority'}
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit})
 if(!complete)attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:0,observedVacancyCount:0,sourceScopeComplete:false})
 return attachInventoryEvidence(jobs,{...gap(),status:complete?'verified-empty':'coverage-gap',listingComplete:complete,pagesFetched:closing?2:1,reportedTotal:complete?0:null,indiaFacetCount:complete?0:null,verifiedAt:opening.capturedAt,reason})
}

const raceAbort=(promise,signal)=>new Promise((resolve,reject)=>{
 const abort=()=>reject(signal.reason)
 signal.addEventListener('abort',abort,{once:true})
 if(signal.aborted){signal.removeEventListener('abort',abort);reject(signal.reason);return}
 Promise.resolve(promise).then(value=>{signal.removeEventListener('abort',abort);resolve(value)},error=>{signal.removeEventListener('abort',abort);reject(error)})
})

export const fetchNativePage=async(url=CAREERS_URL,{signal,requestTimeoutMs=20000}={})=>{
 signal?.throwIfAborted()
 need(sameURL(url),'unadvertised native request URL')
 need(Number.isInteger(requestTimeoutMs)&&requestTimeoutMs>0&&requestTimeoutMs<=20000,'invalid native request deadline')
 const own=new AbortController(),deadline=failure('native request deadline exceeded',{name:'TimeoutError',code:'native_timeout'})
 const timer=setTimeout(()=>own.abort(deadline),requestTimeoutMs),attempt=signal?AbortSignal.any([signal,own.signal]):own.signal
 const aborted=()=>{signal?.throwIfAborted();attempt.throwIfAborted()}
 const captureStartedAt=new Date().toISOString()
 let response,reader,cancelled=false
 const cancel=reason=>{if(cancelled)return;cancelled=true;try{Promise.resolve(reader?reader.cancel(reason):response?.body?.cancel(reason)).catch(()=>{})}catch{}}
 try{
  response=await raceAbort(fetch(CAREERS_URL,{method:'GET',redirect:'manual',headers:{'User-Agent':'Mozilla/5.0',Accept:'text/html'},signal:attempt}),attempt)
  aborted()
  if(response.status!==200)throw failure('native HTTP '+response.status,{status:response.status,code:[401,403].includes(response.status)?'access_denied':response.status===429?'rate_limited':'native_unavailable'})
  need(sameURL(response.url||CAREERS_URL),'unexpected native final URL')
  need(/^text\/html(?:\s*;|$)/i.test(response.headers?.get('content-type')||''),'unexpected native content type')
  const length=response.headers.get('content-length')
  need(length==null||/^\d+$/.test(length)&&Number(length)<=MAX_BYTES,'oversized native body content length')
  need(response.body?.getReader,'missing native response body')
  reader=response.body.getReader()
  const chunks=[];let size=0
  for(;;){const chunk=await raceAbort(reader.read(),attempt);aborted();if(chunk.done)break;need(chunk.value instanceof Uint8Array,'unsupported native body chunk');size+=chunk.value.byteLength;need(size<=MAX_BYTES,'oversized native body');chunks.push(Buffer.from(chunk.value))}
  const body=Buffer.concat(chunks).toString('utf8');aborted()
  need(!/<title\b[^>]*>\s*(?:Access Denied|Forbidden|Just a moment|Attention Required)|<Code>\s*AccessDenied/i.test(body),'native access denial or challenge')
  return {url:CAREERS_URL,finalUrl:response.url||CAREERS_URL,status:200,captureStartedAt,capturedAt:new Date().toISOString(),bytes:Buffer.byteLength(body),sha256:createHash('sha256').update(body).digest('hex'),body}
 }catch(error){cancel(error);aborted();if(error?.abortRetries)throw error;throw failure(error?.message||'native transport unavailable',{cause:error})}
 finally{clearTimeout(timer);try{reader?.releaseLock()}catch{}}
}

export const collect=async({fetchPage,signal,now=()=>new Date(),requestTimeoutMs}={})=>{
 signal?.throwIfAborted()
 const read=fetchPage||((url,options)=>fetchNativePage(url,{...options,requestTimeoutMs}))
 const opening=packet(await read(CAREERS_URL,{signal}));signal?.throwIfAborted()
 const reference=new Date(now())
 need(!Number.isNaN(+reference),'invalid inventory reference clock')
 const currentRoles=inspectCurrentRoleSummaries(opening.body)
 if(currentRoles){
  const jobs=[]
  attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:currentRoles.observations.length,
   observedVacancyCount:currentRoles.observations.length,sourceScopeComplete:false})
  Object.defineProperty(jobs,'nativeRoleObservations',{value:currentRoles.observations})
  return attachInventoryEvidence(jobs,{...gap(),pagesFetched:1,verifiedAt:opening.capturedAt,
   reason:'current-visible-native-open-roles;role-details-and-India-country-scope-unqualified;observed-vacancies='+currentRoles.observations.length})
 }
 const proof=inspectEmptyPage(opening.body)
 if(!proof.scopeQualified)return result(opening,proof,{reason:'explicit-visible-empty-observed-with-unqualified-whole-company-scope'})
 if(!proof.nativeRoles.qualified)return result(opening,proof,{reason:proof.nativeRoles.reason})
 if(!fresh(opening,reference))return result(opening,proof,{reason:'native-opening-capture-time-missing-stale-or-future'})
 const closing=packet(await read(CAREERS_URL,{signal}));signal?.throwIfAborted()
 const closeProof=inspectEmptyPage(closing.body)
 need(closeProof.scopeQualified&&closeProof.nativeRoles.qualified&&proof.contract===closeProof.contract,'closing native empty inventory contract changed')
 const completedReference=new Date(now())
 const independent=fresh(opening,completedReference)&&fresh(closing,completedReference)&&closing.capturedAt!==opening.capturedAt&&+new Date(closing.capturedAt)>+new Date(opening.capturedAt)&&(!closing.captureStartedAt||+new Date(closing.captureStartedAt)>=+new Date(opening.capturedAt))
 if(!independent)return result(opening,proof,{closing,closingProof:closeProof,reason:'matching-native-zero-with-unqualified-opening-or-independent-closing-time'})
 return result(opening,proof,{closing,closingProof:closeProof,complete:true,reason:'visible-explicit-employer-wide-native-zero-with-matching-fresh-independent-closing'})
}
