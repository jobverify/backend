import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {isRecruitmentIntakeTitle} from '../../scraper-support/utils/recruitmentObservationAccounting.js'
import {readNativeRSS} from './literalRSS20261107.js'
import {failure} from './runtime20261107.js'
import {CAREERS_URL} from './native20261107.js'
const CURRENT='https://www.tscti.com/current-openings',sha=v=>createHash('sha256').update(v).digest('hex')
const need=(ok,message)=>{if(!ok)throw failure('22nd Century native '+message,'TSCTI_NATIVE_PROOF')}
const cleanURL=value=>{need(typeof value==='string'&&value.length>0&&value.length<4096&&!/[\u0000-\u0020\u007f]/.test(value),'URL scalar unavailable');let u;try{u=new URL(value)}catch{need(false,'URL malformed')}need(u.protocol==='https:'&&!u.username&&!u.password&&!u.port,'URL authority mismatch');return u}
const sameParams=(left,right)=>{const a=[...left.searchParams].sort(),b=[...right.searchParams].sort();return JSON.stringify(a)===JSON.stringify(b)}
const literal=(node,value)=>node?.type==='Literal'&&node.value===value
const identifier=(node,name)=>node?.type==='Identifier'&&node.name===name
const member=(node,name)=>node?.type==='MemberExpression'&&!node.computed&&identifier(node.property,name)
const key=(node,name)=>node?.type==='Property'&&!node.computed&&(identifier(node.key,name)||literal(node.key,name))
// Parse publisher bytes as bounded syntax/data only. No evaluation, imports,
// function calls, browser, cookie handling or publisher program execution.
function syntax(code){
 need(typeof code==='string'&&Buffer.byteLength(code)<=16777216,'static syntax data exceeds bound')
 let tree;try{tree=parse(code,{ecmaVersion:2024,sourceType:'script',allowHashBang:false})}catch(cause){throw Object.assign(failure('22nd Century native static script syntax unavailable','TSCTI_NATIVE_PROOF'),{cause})}
 const nodes=[],parents=new Map(),pending=[tree]
 while(pending.length){const node=pending.pop();nodes.push(node);need(nodes.length<=1200000,'static syntax node bound exceeded');for(const value of Object.values(node))for(const child of Array.isArray(value)?value:[value])if(child&&typeof child==='object'&&typeof child.type==='string'){parents.set(child,node);pending.push(child)}}
 const ancestor=(node,predicate)=>{for(let at=parents.get(node);at;at=parents.get(at))if(predicate(at))return at;return null}
 return{tree,nodes,parents,ancestor}
}
function portalDeclaration(html,tenant){
 const scripts=readVisibleNativeDocument(html,{strict:true}).nodes(n=>n.tag==='script'&&!n.attrs.src),tenants=[],paths=[],loads=[]
 for(const script of scripts){
  const kind=(script.attrs.type??'').trim().toLowerCase()
  if(!['','text/javascript','application/javascript'].includes(kind)||Object.hasOwn(script.attrs,'nomodule'))continue
  const{tree}=syntax(script.raw??'')
  for(const statement of tree.body){
   if(statement.type==='FunctionDeclaration'&&identifier(statement.id,'openPrivacyPolicy'))for(const declaration of statement.body.body){
    if(declaration.type==='VariableDeclaration'&&declaration.kind==='const')for(const binding of declaration.declarations)if(identifier(binding.id,'a')&&binding.init?.type==='Literal'&&typeof binding.init.value==='string')tenants.push(binding.init.value)
   }
   if(statement.type==='VariableDeclaration'&&statement.kind==='var')for(const binding of statement.declarations)if(identifier(binding.id,'jsFilePath1')&&binding.init?.type==='Literal'&&typeof binding.init.value==='string')paths.push(binding.init.value)
   const call=statement.type==='ExpressionStatement'?statement.expression:null
   if(call?.type==='CallExpression'&&identifier(call.callee,'loadScriptFile')&&call.arguments.length===1&&identifier(call.arguments[0],'jsFilePath1'))loads.push(call)
  }
 }
 need(tenants.length===1&&tenants[0]===tenant&&paths.length===1&&/^\/portal\/index_bundle\.js\.gz\?v=\d{8}_\d+$/.test(paths[0])&&loads.length===1,'portal account or operative data-resource declaration changed')
 return paths[0]
}
function rssDeclaration(code){
 const marker='/candidates/myjobs/getjobsrssfeed.jsp?a=',{nodes,parents,ancestor}=syntax(code),markers=nodes.filter(n=>literal(n,marker))
 need(markers.length===1,'public RSS protocol declaration ambiguous')
 const declaration=ancestor(markers[0],n=>n.type==='VariableDeclarator'),handler=ancestor(markers[0],n=>n.type==='FunctionExpression'),assignment=parents.get(handler)
 need(declaration?.id?.type==='Identifier'&&declaration.init?.type==='BinaryExpression'&&declaration.init.operator==='+'&&assignment?.type==='AssignmentExpression'&&assignment.right===handler&&member(assignment.left,'onSubmit'),'RSS URL is not an operative onSubmit declaration')
 const parts=[],pending=[declaration.init]
 while(pending.length){const node=pending.pop();if(node.type==='BinaryExpression'&&node.operator==='+'){pending.push(node.right,node.left)}else parts.push(node)}
 const strings=parts.filter(n=>n.type==='Literal'&&typeof n.value==='string').map(n=>n.value),expected=['https://',marker,'&noofjobs=','&country=','&states=','&zip=','&miles=','&postype=','&divisions=','&SearchString=','&versionid=2']
 need(JSON.stringify(strings)===JSON.stringify(expected),'RSS query declaration vocabulary changed')
 const parameter=parts[parts.findIndex(n=>literal(n,marker))+1]
 need(parameter?.type==='CallExpression'&&parameter.arguments.length===2&&literal(parameter.arguments[0],'a')&&literal(parameter.arguments[1],''),'RSS tenant parameter declaration changed')
 need(nodes.some(n=>n.start>handler.start&&n.end<handler.end&&n.type==='CallExpression'&&member(n.callee,'open')&&identifier(n.callee.object,'window')&&identifier(n.arguments[0],declaration.id.name)),'RSS declared URL is not used by its native handler')
 const factory=ancestor(handler,n=>n.type==='FunctionExpression'&&parents.get(n)?.type==='ArrayExpression')
 need(factory,'RSS module declaration context unavailable')
 const moduleNodes=nodes.filter(n=>n.start>=factory.start&&n.end<=factory.end),capDeclarations=moduleNodes.filter(n=>key(n,'counts')&&n.value.type==='ArrayExpression'),caps=capDeclarations[0]?.value.elements.map(n=>n?.type==='Literal'?n.value:null)
 need(capDeclarations.length===1&&caps?.length&&caps.every(n=>Number.isSafeInteger(n)&&n>0&&n<=1000),'RSS requested caps declaration unavailable')
 return{marker,caps,routeDeclared:nodes.some(n=>key(n,'path')&&literal(n.value,'/jobs/:jobid')),syntaxValidation:'bounded-static-ast-no-execution'}
}
const rssModel=item=>({nativeRecordKind:'unqualified-rss-record',nativeFields:item.fields,duplicateFields:item.duplicateFields,originalXML:item.originalXML,nativeRoleId:null,country:null,city:null,requisitionId:null,sourceDetailComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,nativeVacancyCandidate:false,nativeIdentityUnresolved:true,representationCount:1})
const fieldsSignature=fields=>JSON.stringify(Object.keys(fields).sort().map(k=>[k,fields[k]]))
function resolveItems(items,models,state,portal,tenant){
 const distinct=[],groups=new Map()
 for(let index=0;index<items.length;index++){
  const item=items[index],model=models[index];let id
  try{
   const u=cleanURL(item.fields.link),keys=[...u.searchParams.keys()].sort()
   need(u.origin===portal.origin&&u.pathname==='/candidates/myjobs/openjob_outside.jsp'&&!u.hash&&keys.join(',')==='a,id'&&u.searchParams.get('a')===tenant&&/^[1-9]\d{0,18}$/.test(u.searchParams.get('id')??'')&&typeof item.fields.title==='string'&&item.fields.title.trim()&&item.duplicateFields.length===0,'RSS role identity unverified')
   id=u.searchParams.get('id')
  }catch{distinct.push(model);continue}
  const signature=fieldsSignature(item.fields),existing=groups.get(id)
  if(existing){
   existing.model.representationCount++
   existing.contradictory ||= existing.signature!==signature
   const duplicate={nativeRoleId:id,firstOrdinal:existing.ordinal,observedOrdinal:index+1,nativeFields:item.fields,originalXML:item.originalXML,contradictory:existing.contradictory}
   existing.duplicates.push(duplicate);state.rssDuplicateRepresentations.push(duplicate)
  }else{groups.set(id,{id,model,signature,ordinal:index+1,contradictory:false,duplicates:[]});distinct.push(model)}
 }
 for(const group of groups.values()){
  if(group.contradictory){
   group.model.conflictingNativeIdentity={tenant,roleId:group.id}
   for(const duplicate of group.duplicates){duplicate.contradictory=true;duplicate.conflictingNativeRoleId=group.id;duplicate.nativeRoleId=null}
  }else{
   group.model.nativeRoleId=group.id;group.model.nativeIdentityUnresolved=false
   group.model.nativeRecordKind=isRecruitmentIntakeTitle(group.model.nativeFields.title)?'hiring-signal':'vacancy-candidate'
   group.model.nativeVacancyCandidate=group.model.nativeRecordKind==='vacancy-candidate'
  }
 }
 state.observedRSSRecords=distinct
 state.nativeRSS.distinctResolvedVacancyCount=distinct.filter(m=>m.nativeVacancyCandidate).length
 state.nativeRSS.distinctObservedModelCount=distinct.length
}
export async function readPublishedJobDiva(io,intakeHTML,state){
 const intake=readVisibleNativeDocument(intakeHTML,{strict:true}),links=intake.nodes(n=>n.tag==='a'&&intake.text(n)==='Current Openings')
 need(links.length===1,'Current Openings handoff ambiguous')
 const current=cleanURL(new URL(links[0].attrs.href,CAREERS_URL).href);need(current.href===CURRENT,'Current Openings handoff identity changed')
 state.handoffs.push({kind:'company-current-openings',from:CAREERS_URL,to:current.href,nativeHref:links[0].attrs.href})
 const page=await io.read(current.href,'html','company-current-openings'),d=readVisibleNativeDocument(page.body,{strict:true}),canonical=d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),titles=activeHead(page.body).titles
 need(canonical.length===1&&canonical[0].attrs.href===current.href&&titles.length===1&&/^Current Openings\s*\|\s*22nd Century Technologies Inc\.$/.test(titles[0].trim()),'Current Openings publisher or canonical identity mismatch')
 const frames=d.frames().filter(n=>(n.attrs.class??'').split(/\s+/).includes('jobPostingIframe'))
 need(frames.length===1&&typeof frames[0].attrs.src==='string','job portal frame unavailable or ambiguous')
 if(Object.hasOwn(frames[0].attrs,'srcdoc')){
  state.unqualifiedHandoffs.push({kind:'conflicting-frame-srcdoc',from:current.href,src:frames[0].attrs.src,srcdoc:frames[0].attrs.srcdoc})
  need(false,'portal frame src is superseded by srcdoc')
 }
 const portal=cleanURL(frames[0].attrs.src),keys=[...portal.searchParams.keys()].sort()
 need(portal.origin==='https://www1.jobdiva.com'&&portal.pathname==='/portal/'&&['','#/'].includes(portal.hash)&&keys.join(',')==='a,compid,divisions2'&&/^[a-z0-9]{16,160}$/i.test(portal.searchParams.get('a')??'')&&portal.searchParams.get('compid')==='0'&&portal.searchParams.get('divisions2')==='2','portal tenant/division scope unavailable')
 const tenant=portal.searchParams.get('a'),nativeFrameURL=portal.href;portal.hash=''
 state.handoffs.push({kind:'company-published-jobdiva-frame',from:current.href,to:portal.href,nativeFrameURL,companyPageBodySHA256:sha(page.body),compid:'0',divisions2:'2'})
 const shell=await io.read(portal.href,'html','native-jobdiva-portal'),head=activeHead(shell.body).titles
 need(head.length===1&&head[0].trim()==='Candidate Portal','native portal publisher shell unavailable')
 const scriptURL=new URL(portalDeclaration(shell.body,tenant),portal).href
 state.handoffs.push({kind:'publisher-declared-script-data',from:portal.href,to:scriptURL,publisherCodeExecuted:false,syntaxValidation:'bounded-static-ast-no-execution'})
 const original=await io.read(scriptURL,'gzip-script','native-script-data');need(typeof original.rawBodyBase64==='string','original native script bytes unavailable')
 const compressed=Buffer.from(original.rawBodyBase64,'base64');need(compressed.toString('base64')===original.rawBodyBase64,'native script byte encoding invalid')
 let decoded,code
 try{decoded=compressed[0]===0x1f&&compressed[1]===0x8b?gunzipSync(compressed,{maxOutputLength:16777216}):compressed;need(decoded.length<=16777216,'decoded script data exceeds bound');code=new TextDecoder('utf-8',{fatal:true}).decode(decoded)}catch(cause){throw Object.assign(failure('22nd Century gzip/decoded script data unavailable','TSCTI_NATIVE_PROOF'),{cause})}
 const{marker,caps,routeDeclared,syntaxValidation}=rssDeclaration(code),rss=new URL(marker.split('?')[0],portal);rss.searchParams.set('a',tenant)
 for(const[k,v]of[['noofjobs',String(Math.max(...caps))],['country',''],['states',''],['zip',''],['miles',''],['postype',''],['divisions',''],['SearchString','India'],['versionid','2']])rss.searchParams.set(k,v)
 state.nativeScriptContract={url:scriptURL,rawBodySHA256:sha(compressed),decodedSHA256:sha(decoded),decodedBytes:decoded.length,publisherCodeExecuted:false,nativeRSSPath:marker.split('?')[0],declaredUIRequestedCaps:caps,requestedCap:Math.max(...caps),routeDeclared,syntaxValidation}
 state.handoffs.push({kind:'publisher-declared-rss-keyword-read',from:scriptURL,to:rss.href,keyword:'India',nativeCountryFacetApplied:false,portalDivisionFilterNotRepresentedByRSS:true,requestedCap:Math.max(...caps),requestedCapIsCompanyTotal:false})
 const document=await io.read(rss.href,'rss','native-rss'),parsed=readNativeRSS(document.body)
 state.nativeRSS={requestURL:rss.href,channel:parsed.channel,records:parsed.items,observedItemCount:parsed.items.length,keyword:'India',nativeCountryFacetApplied:false,portalDivisionFilterNotRepresentedByRSS:true,companyGlobalTotal:null,companyIndiaTotal:null,requestedCap:Math.max(...caps),requestedCapIsCompanyTotal:false,sourceScopeComplete:false}
 // Keep all original items unresolved before any channel/tenant admission.
 const models=parsed.items.map(rssModel);state.observedRSSRecords=models
 need(parsed.channel.duplicateFields.length===0&&parsed.channel.fields.title==='22nd Century Technologies, Inc. Jobs'&&parsed.channel.fields.description==='Newly Issued Jobs','RSS publisher or channel identity changed')
 const search=cleanURL(parsed.channel.fields.link)
 need(search.origin===rss.origin&&search.pathname==='/candidates/myjobs/searchjobsdone_outside.jsp'&&!search.hash&&sameParams(search,rss),'RSS channel search link changed tenant or query')
 resolveItems(parsed.items,models,state,portal,tenant)
 if(parsed.items.length){state.reason='native-rss-rows-await-role-country-and-publication-proof';return}
 state.handoffs.push({kind:'rss-channel-native-search-link',from:rss.href,to:search.href,scopeAndQueryUnchanged:true})
 const result=await io.read(search.href,'html','native-search-results')
 state.nativeSearch={url:search.href,bodySHA256:sha(result.body),scopeAndQueryUnchanged:true,sourceScopeComplete:false}
 state.reason='keyword-rss-empty-without-native-india-facet-or-company-total'
}
