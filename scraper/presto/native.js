export const SOURCE="presto",SURFACE="https://www.presto-apps.com/careers",COMPANY="Presto"

import {readNativeDocument,activeHead,activeScripts,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {document as sourceDocument} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
export {readNativeDocument,activeHead,activeScripts,readVisibleNativeDocument,sourceDocument}
export const norm=value=>decodeNativeEntities(value).replace(/\s+/g,' ').trim()
export const cls=(node,value)=>(node.attrs.class||'').split(/\s+/).includes(value)
export const within=(node,predicate)=>node.inert?[]:[...(predicate(node)?[node]:[]),...node.children.filter(child=>typeof child!=='string').flatMap(child=>within(child,predicate))]
export const allRaw=(node,predicate)=>[...(predicate(node)?[node]:[]),...node.children.filter(child=>typeof child!=='string').flatMap(child=>allRaw(child,predicate))]
const gap=()=>({status:'coverage-gap',surface:SURFACE,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null})
export const need=(ok,message)=>{if(!ok)throw Object.assign(Error(SOURCE+' native: '+message),{abortRetries:true,inventoryEvidence:gap()})}
export const one=(rows,label)=>{need(rows.length===1,'missing/ambiguous '+label);return rows[0]}
export const parentsOf=root=>{const result=new Map();const walk=node=>{for(const child of node.children||[])if(typeof child!=='string'){result.set(child,node);walk(child)}};walk(root);return result}
export const rawSlice=(html,predicate)=>{const doc=sourceDocument(html),node=one(allRaw(doc.root,predicate),'raw role carrier');need(Number.isInteger(node.end),'unclosed raw role carrier');return doc.outer(node)}
export const canonical=(html,url,{required=true}={})=>{const doc=readNativeDocument(html),head=one(doc.nodes(n=>n.tag==='head'),'native head'),links=within(head,n=>n.tag==='link'&&(n.attrs.rel||'').split(/\s+/).includes('canonical'));need(links.length===(required?1:links.length),'missing native canonical');need(links.length<=1&&links.every(n=>n.attrs.href===url),'native canonical role identity conflict');return {titles:within(head,n=>n.tag==='title').map(n=>norm(n.raw)),metas:within(head,n=>n.tag==='meta').map(n=>n.attrs)}}
export const visible=html=>readVisibleNativeDocument(html,{strict:true})
export const role=(values={})=>({title:null,company:COMPANY,location:null,city:null,state:null,country:null,department:null,jobId:null,requisitionId:null,sourceUrl:SURFACE,applyUrl:null,employmentType:null,experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],postingDate:null,closingDate:null,jobDescription:null,remoteStatus:null,...values})
export const finish=(jobs,{observedVacancyCount=jobs.length,observedRecordCount=observedVacancyCount,recordKind=observedRecordCount===observedVacancyCount?'vacancy-rows':'mixed',pagesFetched=1,now=()=>new Date().toISOString(),failures=[],...extra}={})=>{
 const time=new Date(now());need(!Number.isNaN(+time),'invalid extraction clock')
 const audit={source:SOURCE,recordKind,observedRecordCount,observedVacancyCount,observedListingCount:observedVacancyCount,candidateDetails:observedVacancyCount,extractedDetailJobs:jobs.filter(j=>j.jobDescription&&j.rawNativeRoleEvidence?.identityQualified!==false).length,excludedDetailJobs:0,failures,reportedTotal:null,indiaFacetCount:null,listingPaginationComplete:null,closingInventoryMatches:null,sourceScopeComplete:false,observedMissingWorkplaces:jobs.filter(j=>!j.location).length,observedUnknownCountries:jobs.filter(j=>!j.country).length,rawProvenanceLimit:'Native source observations only. Employer-wide global/India counts, exact legal employer, closing inventory, unpublished role dates and successful application submission remain unqualified.',...extra}
 for(const job of jobs){job.source=SOURCE;job.companyCareerPage=SURFACE;job.companyDomain=new URL(SURFACE).hostname.replace(/^www\./,'');job.scrapedAt=time.toISOString();job.link=job.applyUrl||job.sourceUrl;job.sourceListingComplete=false;job.sourceDetailComplete=Boolean(job.jobDescription)&&job.rawNativeRoleEvidence?.identityQualified!==false}
 if(jobs.length)jobs[0].nativeCollectionEvidence=audit
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit})
 attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind,observedRecordCount,observedVacancyCount,sourceScopeComplete:false})
 return attachInventoryEvidence(jobs,{...gap(),pagesFetched,verifiedAt:time.toISOString(),reason:failures.length?'native-observations-with-unavailable-or-unqualified-details':'native-observed-subset-with-unqualified-company-scope'})
}
const arrangement=/^(?:remote|hybrid|on[ -]?site|work from home|multiple locations|not specified|tbd|n\/?a)$/i
export const geography=(statements,countryStatements=[])=>{
 const native=statements.map(norm).filter(Boolean),countries=countryStatements.map(norm).filter(Boolean),values=[...new Set(native.filter(value=>!arrangement.test(value)))],explicit=[]
 for(const value of countries){need(!arrangement.test(value),'arrangement used as native country');explicit.push(/^(?:India|IN)$/i.test(value)?'India':/^(?:US|USA|United States(?: of America)?)$/i.test(value)?'US':value)}
 for(const value of values){if(/^US\s*-\s*\S/.test(value))explicit.push('US');if(/^(?:India|IN)$/i.test(value)||/(?:^|,)\s*India\s*$/.test(value))explicit.push('India')}
 const uniqueCountries=[...new Set(explicit)];need(uniqueCountries.length<=1,'conflicting explicit native country/workplace statements')
 const most=values.slice().sort((a,b)=>b.length-a.length)[0]||null,consistent=values.every(value=>value===most||most?.split(/[,/]/).map(norm).includes(value))
 return {location:consistent?most:null,country:consistent?(uniqueCountries[0]||null):null,nativeWorkplaceStatements:native,nativeCountryStatements:countries,workplaceQualified:consistent,unqualifiedWorkplaceStatements:consistent?[]:native}
}
export const nativeFetch=async(url,{signal,metadata=false}={})=>{
 signal?.throwIfAborted();const target=new URL(url),origin=new URL(SURFACE);need(target.protocol==='https:'&&!target.username&&!target.password&&target.hostname.replace(/^www\./,'')===origin.hostname.replace(/^www\./,''),'unqualified native request route')
 const own=new AbortController(),timeout=Object.assign(Error(SOURCE+' native request timeout'),{name:'TimeoutError',abortRetries:true,inventoryEvidence:gap()}),timer=setTimeout(()=>own.abort(timeout),20000),attempt=signal?AbortSignal.any([signal,own.signal]):own.signal
 const aborted=()=>{signal?.throwIfAborted();attempt.throwIfAborted()};let response,reader
 const wait=promise=>new Promise((resolve,reject)=>{let settled=false;const cleanup=()=>attempt.removeEventListener('abort',abort),abort=()=>{if(settled)return;settled=true;cleanup();reject(signal?.aborted?signal.reason:attempt.reason)};attempt.addEventListener('abort',abort,{once:true});if(attempt.aborted)abort();Promise.resolve(promise).then(value=>{cleanup();if(settled){try{Promise.resolve(value?.body?.cancel()).catch(()=>{})}catch{}return}settled=true;resolve(value)},error=>{cleanup();if(settled)return;settled=true;reject(error)})})
 const cancel=()=>{try{Promise.resolve(reader?reader.cancel():response?.body?.cancel()).catch(()=>{})}catch{}}
 try{response=await wait(fetch(url,{method:'GET',redirect:'manual',headers:{'User-Agent':'Mozilla/5.0',Accept:'text/html,application/json,application/javascript,text/css;q=0.9,*/*;q=0.8'},signal:attempt}));aborted()
  if(response.status!==200){cancel();throw Object.assign(Error(SOURCE+' native HTTP '+response.status),{status:response.status,code:[401,403].includes(response.status)?'access_denied':response.status===429?'rate_limited':'native_unavailable',abortRetries:true,inventoryEvidence:gap()})}
  need(!response.url||response.url===url,'unqualified native final URL');need(!response.headers?.get('content-length')||Number(response.headers.get('content-length'))<=2_000_000,'oversized native body')
  reader=response.body?.getReader();need(reader,'missing native body');const chunks=[];let size=0
  for(;;){const chunk=await wait(reader.read());aborted();if(chunk.done)break;size+=chunk.value.byteLength;need(size<=2_000_000,'oversized native body');chunks.push(Buffer.from(chunk.value))}
  const html=Buffer.concat(chunks).toString('utf8');aborted();need(!/<title\b[^>]*>\s*(?:Access Denied|Forbidden|Just a moment|Attention Required)|<Code>\s*AccessDenied|cf-chl-/i.test(html),'native access denial or challenge');return metadata?{html,status:200,url:response.url||url}:html
 }catch(error){cancel();aborted();if(error.abortRetries)throw error;throw Object.assign(Error(SOURCE+' native transport: '+error.message),{abortRetries:true,cause:error,inventoryEvidence:gap()})}
 finally{clearTimeout(timer);try{reader?.releaseLock()}catch{}}
}

import {parse} from 'acorn'
export const SCRIPT='https://www.presto-apps.com/assets/js/js-p2023.js'
export const hasOfficialCareersPageSignal=html=>{try{const head=canonical(html,SURFACE,{required:false}),doc=visible(html);return head.titles.length===1&&head.titles[0]==='Careers | Presto'&&doc.nodes(n=>n.attrs.id==='job-listings').length===1&&doc.nodes(n=>n.tag==='script'&&n.attrs.src&&new URL(n.attrs.src,SURFACE).href===SCRIPT).length===1&&doc.nodes(n=>/^h[1-6]$/.test(n.tag)&&/Current openings/i.test(doc.text(n))).length===1}catch{return false}}
export const extractLinkedInJobId=value=>{try{const url=new URL(value);need(url.protocol==='https:'&&url.hostname==='www.linkedin.com'&&!url.username&&!url.password,'unqualified native LinkedIn role link');const match=url.pathname.match(/^\/jobs\/(?:cap\/)?view\/(\d+)\/?$/);need(match,'missing native LinkedIn role identity');const id=match[1],queries=url.searchParams.getAll('pathWildcard');need(queries.every(value=>value===id),'conflicting native application role IDs');return id}catch{return null}}
const nativeFunction=node=>['FunctionExpression','ArrowFunctionExpression','FunctionDeclaration'].includes(node?.type)
const literal=node=>node?.type==='Literal'&&['string','number','boolean'].includes(typeof node.value)
const directMember=(node,object,property)=>node?.type==='MemberExpression'&&!node.computed&&node.object?.name===object&&node.property?.name===property
// Support the finite UI setup actually preceding this native array. Unknown
// calls/control flow and DOM/global rebinding cannot prove the renderer is reached.
const finiteReadyPrefix=statements=>{
 const protectedNames=new Set(['document','window','$','jobPostings','jobListingsContainer']),bindings=new Map()
 const value=node=>literal(node)||node?.type==='Identifier'&&bindings.has(node.name)||node?.type==='BinaryExpression'&&['+','>','<','>=','<=','===','!=='].includes(node.operator)&&value(node.left)&&value(node.right)||directMember(node,'window','innerWidth')
 const jquery=node=>node?.type==='CallExpression'&&node.callee?.name==='$'&&node.arguments.length===1&&(node.arguments[0]?.name==='document'||value(node.arguments[0]))||node?.type==='Identifier'&&bindings.get(node.name)==='jquery'
 const domRead=node=>node?.type==='CallExpression'&&node.callee?.type==='MemberExpression'&&!node.callee.computed&&node.callee.object?.name==='document'&&['getElementById','getElementsByClassName'].includes(node.callee.property?.name)&&node.arguments.length===1&&typeof node.arguments[0]?.value==='string'
 const kind=node=>literal(node)?'literal':domRead(node)?'dom':jquery(node)?'jquery':null
 const expression=node=>{
  if(literal(node))return true
  if(node?.type==='AssignmentExpression'&&node.operator==='='&&nativeFunction(node.right))return node.left.type==='Identifier'&&!protectedNames.has(node.left.name)||directMember(node.left,'window','onload')
  if(node?.type!=='CallExpression'||node.callee?.type!=='MemberExpression'||node.callee.computed||!jquery(node.callee.object))return false
  const method=node.callee.property?.name
  return method==='addClass'&&node.arguments.every(literal)||method==='click'&&node.arguments.length===1&&nativeFunction(node.arguments[0])||method==='on'&&node.arguments.length===3&&node.arguments.slice(0,2).every(literal)&&nativeFunction(node.arguments[2])
 }
 const statement=node=>{
  if(node.type==='VariableDeclaration')return node.declarations.every(declaration=>{if(declaration.id?.type!=='Identifier'||protectedNames.has(declaration.id.name))return false;const type=kind(declaration.init);if(!type)return false;bindings.set(declaration.id.name,type);return true})
  if(node.type==='FunctionDeclaration')return Boolean(node.id)&&!protectedNames.has(node.id.name)
  if(node.type==='ExpressionStatement')return expression(node.expression)
  if(node.type==='BlockStatement')return node.body.every(statement)
  return node.type==='IfStatement'&&value(node.test)&&statement(node.consequent)&&(!node.alternate||statement(node.alternate))
 }
 return statements.every(statement)
}
const boundedNativeRenderer=loop=>{
 const declaration=loop.init?.declarations?.[0],index=declaration?.id?.name,test=loop.test,update=loop.update
 if(loop.init?.type!=='VariableDeclaration'||loop.init.declarations.length!==1||declaration.id.type!=='Identifier'||['document','window','$','jobPostings','jobListingsContainer'].includes(index)||declaration.init?.value!==0||test?.type!=='BinaryExpression'||test.operator!=='<'||test.left?.name!==index||!directMember(test.right,'jobPostings','length')||update?.type!=='UpdateExpression'||update.operator!=='++'||update.argument?.name!==index)return false
 const nodes=[],walk=node=>{if(!node||typeof node!=='object')return;nodes.push(node);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value)};walk(loop.body)
 if(nodes.some(node=>['WhileStatement','DoWhileStatement','ForStatement','ForInStatement','ForOfStatement','ReturnStatement','ThrowStatement','TryStatement','SwitchStatement','BreakStatement','ContinueStatement','AwaitExpression','YieldExpression','NewExpression','UpdateExpression'].includes(node.type)||nativeFunction(node)))return false
 const protectedNames=new Set(['document','window','$','jobPostings','jobListingsContainer',index]),domNames=new Set(nodes.filter(node=>node.type==='VariableDeclarator'&&node.id.type==='Identifier'&&node.init?.type==='CallExpression'&&directMember(node.init.callee,'document','createElement')&&node.init.arguments.length===1&&typeof node.init.arguments[0]?.value==='string').map(node=>node.id.name))
 const base=node=>node?.type==='MemberExpression'?base(node.object):node?.name
 if(nodes.some(node=>node.type==='VariableDeclarator'&&(!domNames.has(node.id?.name)||protectedNames.has(node.id.name))||node.type==='AssignmentExpression'&&protectedNames.has(base(node.left))))return false
 return nodes.filter(node=>node.type==='CallExpression').every(node=>directMember(node.callee,'document','createElement')||node.callee?.type==='MemberExpression'&&!node.callee.computed&&(node.callee.property?.name==='appendChild'&&(domNames.has(node.callee.object?.name)||node.callee.object?.name==='jobListingsContainer')||node.callee.property?.name==='add'&&node.callee.object?.type==='MemberExpression'&&!node.callee.object.computed&&node.callee.object.property?.name==='classList'&&domNames.has(node.callee.object.object?.name)))
}
export const extractInlineJobPostings=javascript=>{
 let ast;try{ast=parse(javascript,{ecmaVersion:'latest'})}catch{need(false,'invalid native job client syntax')}
 const nodes=[],parents=new Map(),walk=(node,parent)=>{if(!node||typeof node!=='object')return;nodes.push(node);if(parent)parents.set(node,parent);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(child=>walk(child,node));else if(value&&typeof value==='object')walk(value,node)};walk(ast)
 const declaration=one(nodes.filter(n=>n.type==='VariableDeclarator'&&n.id?.name==='jobPostings'),'native jobPostings binding');need(declaration.init?.type==='ArrayExpression'&&declaration.init.elements.length>0,'unsupported empty native job array')
 let owner=parents.get(declaration);while(owner&&!['FunctionExpression','ArrowFunctionExpression'].includes(owner.type))owner=parents.get(owner);need(owner&&!owner.async&&!owner.generator&&owner.params.length===0&&!['document','window','$'].includes(owner.id?.name)&&owner.body?.type==='BlockStatement','unqualified native synchronous role-data owner')
 const ready=parents.get(owner),callee=ready?.callee,jquery=callee?.object,registration=parents.get(ready)
 need(ready?.type==='CallExpression'&&ready.arguments.length===1&&ready.arguments[0]===owner&&callee?.type==='MemberExpression'&&!callee.computed&&callee.property?.name==='ready'&&jquery?.type==='CallExpression'&&jquery.callee?.name==='$'&&jquery.arguments.length===1&&jquery.arguments[0]?.name==='document'&&registration?.type==='ExpressionStatement'&&ast.body.includes(registration),'unbound native document-ready role-data owner')
 const statement=parents.get(declaration),index=owner.body.body.indexOf(statement);need(index>=0&&finiteReadyPrefix(owner.body.body.slice(0,index)),'unreachable or unsupported native job-data prefix')
 const owns=node=>{for(let n=node;n;n=parents.get(n))if(n===owner)return true;return false},containers=nodes.filter(n=>owns(n)&&n.type==='VariableDeclarator'&&n.init?.type==='CallExpression'&&n.init.callee?.object?.name==='document'&&n.init.callee.property?.name==='getElementById'&&n.init.arguments[0]?.value==='job-listings')
 const container=one(containers,'native role-list DOM carrier');need(container.id?.type==='Identifier','ambiguous role-list DOM binding')
 const loops=nodes.filter(n=>owns(n)&&n.type==='ForStatement'&&n.test?.right?.type==='MemberExpression'&&n.test.right.object?.name==='jobPostings'&&n.test.right.property?.name==='length');need(loops.length===1,'unbound native role array renderer')
 const loop=loops[0];let guard=parents.get(loop);while(guard&&guard.type==='BlockStatement')guard=parents.get(guard);need(guard?.type==='IfStatement'&&guard.test?.name===container.id.name,'unsupported native role-list conditional')
 need(ast.body.length===1&&statement.declarations.length===1&&owner.body.body[index+1]===parents.get(container)&&parents.get(container).declarations.length===1&&owner.body.body[index+2]===guard&&owner.body.body.length===index+3&&!guard.alternate&&guard.consequent?.type==='BlockStatement'&&guard.consequent.body.length===1&&guard.consequent.body[0]===loop&&boundedNativeRenderer(loop),'unsupported or unreachable native bounded renderer')
 const jobs=declaration.init.elements.map(element=>{need(element?.type==='ObjectExpression','nonliteral native role');const row={};for(const property of element.properties){need(property.type==='Property'&&!property.computed&&property.kind==='init'&&!property.method&&property.value.type==='Literal'&&typeof property.value.value==='string','nonliteral native role field');const key=property.key.name??property.key.value;need(!Object.hasOwn(row,key),'duplicate native role field');row[key]=property.value.value}need(Object.keys(row).sort().join(',')==='description,keywords,link,title'&&row.title.trim()&&extractLinkedInJobId(row.link),'native role fields/application identity changed');return row})
 need(new Set(jobs.map(row=>extractLinkedInJobId(row.link))).size===jobs.length,'duplicate native application role identity')
 return jobs
}
export const collect=async({fetchText=nativeFetch,signal,now,maxJobs=null}={})=>{
 signal?.throwIfAborted();const html=await fetchText(SURFACE,{signal});need(hasOfficialCareersPageSignal(html),'official careers identity/native client handoff');const javascript=await fetchText(SCRIPT,{signal});signal?.throwIfAborted();const records=extractInlineJobPostings(javascript),selected=Number.isInteger(maxJobs)&&maxJobs>=0?records.slice(0,maxJobs):records
 const jobs=selected.map(record=>{const id=extractLinkedInJobId(record.link);return role({title:record.title,jobId:id,requisitionId:id,sourceUrl:SURFACE,applyUrl:record.link,rawNativeRoleEvidence:{identityQualified:true,nativeRoleTitle:record.title,nativeApplicationRoleId:id,nativeKeywords:record.keywords,nativeApplicationUrl:record.link,nativeJobClient:SCRIPT,nativeRoleDataQualified:true,nativeRendererQualified:false,unqualifiedNativeDescription:record.description,descriptionQualification:'First-party summary only; no corroborated full role JD obtained',applicationAvailabilityQualified:false,applicationSubmissionQualified:false,exactLegalEmployerQualified:false}})})
 return finish(jobs,{observedVacancyCount:records.length,pagesFetched:2,now,failures:jobs.map(job=>({nativeRoleId:job.jobId,kind:'full-native-description-and-geography-unqualified'})),nativeRoleDataCount:records.length,applicationAvailabilityQualified:false})
}
