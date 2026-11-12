import {createHash} from 'node:crypto'
import {types,isDeepStrictEqual} from 'node:util'
import {parse} from 'acorn'
import {decodeHTML} from 'entities'
import {readNativeDocument,readNativeAttributeTokens} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {parseEightfoldJson} from '../../scraper-support/utils/recruitmentEightfoldData.js'

export const SOURCE='jasper',CORPORATE='https://www.jasper.ai/careers',BOARD='https://jobs.ashbyhq.com/Jasper%20AI'
export const API='https://api.ashbyhq.com/posting-api/job-board/Jasper%20AI'
export const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
export const sha=value=>createHash('sha256').update(value).digest('hex')
export const need=(ok,reason,message)=>{if(!ok)throw Object.assign(Error('[jasper] '+message),{
 code:'JASPER_PROGRAMME_HOLD',reason,softFailure:true,failureKind:'coverage_gap',abortRetries:true,upstreamOutage:false})}
const plain=value=>value!==null&&typeof value==='object'&&!types.isProxy(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value))
export function ownData(value,key,reason='input'){
 need(plain(value),reason,'Original own-data object unavailable')
 const descriptor=Object.getOwnPropertyDescriptor(value,key)
 need(descriptor&&Object.hasOwn(descriptor,'value'),reason,'Original data field unavailable: '+key)
 return descriptor.value
}
export function copyData(value,seen=new Set(),depth=0){
 need(depth<=80,'input','Original data nesting bound')
 if(value===null||['string','boolean'].includes(typeof value))return value
 if(typeof value==='number'){need(Number.isFinite(value),'input','Non-finite data');return value}
 need(typeof value==='object'&&!types.isProxy(value)&&!seen.has(value),'input','Unsupported, accessor or cyclic original data')
 const array=Array.isArray(value)
 need(array||plain(value),'input','Unsupported original object prototype')
 const keys=Reflect.ownKeys(value),result=array?[]:{};seen.add(value)
 need(keys.length<=100000,'input','Original data field bound')
 if(array)need(Object.getOwnPropertyDescriptor(value,'length')?.value===keys.length-1,'input','Sparse or decorated original array')
 for(const key of keys){
  if(array&&key==='length')continue
  need(typeof key==='string'&&(array?/^(?:0|[1-9]\d*)$/.test(key):key!=='toJSON'),'input','Unsupported original key')
  const d=Object.getOwnPropertyDescriptor(value,key)
  need(d&&Object.hasOwn(d,'value')&&d.enumerable,'input','Original accessor/nonenumerable data is unsupported')
  Object.defineProperty(result,key,{value:copyData(d.value,seen,depth+1),enumerable:true,writable:true,configurable:true})
 }
 seen.delete(value);return result
}
export function freezeData(value){if(value&&typeof value==='object'){for(const item of Object.values(value))freezeData(item);Object.freeze(value)}return value}
export const shape=(value,keys,reason)=>need(plain(value)&&isDeepStrictEqual(Object.keys(value).sort(),[...keys].sort()),reason,'Unreviewed original field model')
export function originalJSON(text){try{return parseEightfoldJson(text)}catch(error){need(false,'json','Original duplicate-free JSON unavailable: '+error.message)}}
const TypedArray=Object.getPrototypeOf(Uint8Array.prototype),lengthGetter=Object.getOwnPropertyDescriptor(TypedArray,'length').get,bufferGetter=Object.getOwnPropertyDescriptor(TypedArray,'buffer').get
function originalBytes(value){
 need(value&&!types.isProxy(value)&&types.isUint8Array(value),'response','Original complete entity bytes unavailable')
 let bytes
 try{
  need(!types.isSharedArrayBuffer(bufferGetter.call(value)),'response','Shared entity bytes unsupported')
  const length=lengthGetter.call(value);need(length>0&&length<=4194304,'response','Original entity bound')
  bytes=new Uint8Array(length);Uint8Array.prototype.set.call(bytes,value)
 }catch(error){if(error?.code==='JASPER_PROGRAMME_HOLD')throw error;need(false,'response','Original entity byte copy failed')}
 return bytes
}
const nativeHeaders='alt-svc ashby-session-expiry-alert-level cache-control cf-cache-status cf-ray connection content-encoding content-security-policy content-type date referrer-policy server strict-transport-security transfer-encoding x-ashby-request-id x-content-type-options x-frame-options'.split(' ')
const headerNames={
 C:'age alt-svc cf-cache-status cf-ray connection content-encoding content-security-policy content-type date last-modified link server set-cookie strict-transport-security surrogate-control surrogate-key transfer-encoding vary x-content-type-options x-frame-options x-lambda-id x-wf-region'.split(' '),
 B:nativeHeaders,O:nativeHeaders,A:[...nativeHeaders.filter(k=>k!=='content-security-policy'),'access-control-allow-origin','etag']
}
// Retained native API/HTML cache metadata only; no source-time or origin-freshness authority.
const validNativeAge=value=>typeof value==='string'&&value.length>=1&&value.length<=10&&!/[^0-9]/.test(value)&&Number(value)<=2147483648
const securityNames='content-security-policy content-security-policy-report-only strict-transport-security x-content-type-options x-frame-options referrer-policy cross-origin-embedder-policy cross-origin-opener-policy cross-origin-resource-policy permissions-policy document-policy access-control-allow-origin access-control-allow-credentials access-control-allow-headers access-control-allow-methods access-control-expose-headers access-control-max-age'.split(' ')
const policies={C:['6aa76fc3e13144739be0e5b62747d82d71be466f2429bffd672fdedc83ea3904'],B:['7c2ce1c512f71a0e7a35338dde41ce1a8299d52ac65ea1a7ff62c328fdaa0001'],
 A:['4b7a8ec1f68051695eecd520b8fb54d7ead3e8b822c09ef23cc6f91ebaea5b4a'],O:['7c2ce1c512f71a0e7a35338dde41ce1a8299d52ac65ea1a7ff62c328fdaa0001','23742ed04c9dfe67619e00b7d733cfb4ccbf2a53155b563ed3e82ed7c46d551a']}
function headers(input){
 const first=copyData(ownData(input,'headers','headers')),entries=copyData(ownData(input,'headerEntries','headers'))
 need(plain(first)&&Array.isArray(entries),'headers','Both original header views are required')
 const map={},second={}
 for(const [key,value]of Object.entries(first)){
  need(/^[a-z0-9!#$%&'*+.^_`|~-]+$/i.test(key)&&typeof value==='string'&&!/[\r\n\0]/.test(value)&&!Object.hasOwn(map,key.toLowerCase()),'headers','Ambiguous original header map')
  map[key.toLowerCase()]=value
 }
 for(const pair of entries){
  need(Array.isArray(pair)&&pair.length===2&&pair.every(v=>typeof v==='string')&&!Object.hasOwn(second,pair[0].toLowerCase()),'headers','Ambiguous original header entries')
  second[pair[0].toLowerCase()]=pair[1]
 }
 need(isDeepStrictEqual(map,second),'headers','Original header views disagree')
 return{map,entries,originalMap:first}
}
export function readResponse(input,channel){
 need(plain(input),'response','Expected original plain response record')
 need(ownData(input,'source','response')===SOURCE&&ownData(input,'method','response')==='GET'&&ownData(input,'cache','response')==='no-store'
  &&ownData(input,'credentials','response')==='omit'&&ownData(input,'redirect','response')==='manual','response','Unreviewed original source/request provenance')
 const requestHeaders=copyData(ownData(input,'requestHeaders','response'))
 need(isDeepStrictEqual(requestHeaders,{Accept:channel==='A'?'application/json':'text/html','Cache-Control':'no-store',Pragma:'no-cache'}),
  'response','Unreviewed original request headers/authentication')
 const requestedURL=ownData(input,'requestedURL','response'),finalURL=ownData(input,'finalURL','response')
 const fixed={C:CORPORATE,B:BOARD,A:API},role=typeof finalURL==='string'&&finalURL.startsWith(BOARD+'/')?finalURL.slice(BOARD.length+1):null
 need(requestedURL===finalURL&&(channel==='O'?UUID.test(role??''):finalURL===fixed[channel]),'route','Original exact requested/final route required')
 need(ownData(input,'status','response')===200&&ownData(input,'bodyComplete','response')===true,'response','Incomplete or unsuccessful original response')
 const clocks=['requestedAt','responseAt','completedAt'].map(key=>ownData(input,key,'response'))
 need(clocks.every(value=>{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))return false
  try{return new Date(value).toISOString()===value}catch{return false}
 })&&clocks[0]<=clocks[1]&&clocks[1]<=clocks[2],'response','Original request/response/completion clocks unavailable or contradictory')
 const bytes=originalBytes(ownData(input,'body','response')),views=headers(input)
 need(views.map['content-type']===(channel==='A'?'application/json; charset=utf-8':'text/html; charset=utf-8'),'encoding','Only the original UTF8 MIME class is qualified')
 need(views.map['content-encoding']===(channel==='C'?'gzip':'br'),'encoding','Unreviewed original HTTP content encoding')
 need(Object.keys(views.map).every(k=>headerNames[channel].includes(k)||(['A','B','O'].includes(channel)&&k==='age'&&validNativeAge(views.map[k]))),'security','Unreviewed navigation/authentication/challenge/security header')
 let text
 try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)}catch{need(false,'encoding','Invalid original UTF8 entity')}
 need(text.charCodeAt(0)!==0xfeff&&!text.includes('\0'),'encoding','Unsupported original BOM/NUL representation')
 const metadata={}
 for(const key of Reflect.ownKeys(input)){
  if(key==='body')continue
  need(typeof key==='string','input','Unsupported response key')
  Object.defineProperty(metadata,key,{value:copyData(ownData(input,key)),enumerable:true,writable:true,configurable:true})
 }
 const hash=sha(bytes)
 if(Object.hasOwn(metadata,'bodySHA256'))need(metadata.bodySHA256===hash,'response','Original entity hash disagrees')
 if(Object.hasOwn(metadata,'bodyBytes'))need(metadata.bodyBytes===bytes.length,'response','Original entity byte count disagrees')
 for(const[key,complete]of [['decodedPrefixOnly',false],['streamDone',true],['error',null]])
  if(Object.hasOwn(metadata,key))need(metadata[key]===complete,'response','Contradictory original complete-response evidence: '+key)
 if(Object.hasOwn(metadata,'consumedBodyBytes'))need(Number.isSafeInteger(metadata.consumedBodyBytes)&&metadata.consumedBodyBytes===bytes.length,
  'response','Original consumed bytes disagree with complete entity')
 if(Object.hasOwn(metadata,'discardedOverflowBytes'))need(metadata.discardedOverflowBytes===0,'response','Original complete entity has discarded overflow')
 return{text,url:finalURL,id:role,headers:views.map,originalResponse:{...metadata,headers:views.originalMap,headerEntries:views.entries,
  bodyBase64:Buffer.from(bytes).toString('base64'),bodyBytes:bytes.length,bodySHA256:hash,bodyComplete:true}}
}
export function initialPolicy(response,channel,nonce=null){
 const original=Object.fromEntries(securityNames.map(k=>[k,response.headers[k]??null])),comparison={...original}
 if(channel==='B'||channel==='O'){
  need(typeof nonce==='string'&&/^[A-Za-z0-9_-]{43}$/.test(nonce),'security','Original native CSP nonce unavailable')
  const policy=original['content-security-policy'],token="'nonce-"+nonce+"'"
  need(typeof policy==='string'&&[...policy.matchAll(/'nonce-[^']+'/g)].length===1&&policy.split(';').filter(d=>/^\s*script-src\s/.test(d)).length===1
   &&policy.split(';').find(d=>/^\s*script-src\s/.test(d)).trim().split(/\s+/).filter(v=>v===token).length===1,'security','Original enforced CSP does not bind active native nonce')
  comparison['content-security-policy']=policy.replace(token,"'nonce-[BOUND_ORIGINAL_NONCE]'")
 }
 const policySHA256=sha(JSON.stringify(comparison))
 need(policies[channel].includes(policySHA256),'security','Unreviewed original initial security/CORS profile')
 return{original,policySHA256,originalNonce:nonce,bodyRewritten:false,initialPolicyQualified:true,browserExecutionQualified:false}
}
export function nativeDocument(text){
 const document=readNativeDocument(text,{excludeObjectFallback:true}),entries=[]
 const visit=(node,ancestors)=>{entries.push({node,ancestors});for(const child of node.children)if(typeof child!=='string')visit(child,[...ancestors,node])}
 visit(document.nodes(n=>n.tag==='root')[0],[]);return{document,entries}
}
export const active=e=>!e.node.inert&&!e.node.nativeTagUnqualified&&!e.ancestors.some(n=>n.inert||n.nativeTagUnqualified||['object','svg','math','template','noscript'].includes(n.tag))
function rawAttributes(text,tag){
 const result=[],pattern=new RegExp('<'+tag+'\\b((?:"[^"]*"|\'[^\']*\'|[^\'">])*)>','gi')
 for(const match of text.matchAll(pattern)){
  const tokens=readNativeAttributeTokens(match[1]),seen=new Set(),attrs={}
  for(const[key,value]of tokens){need(!seen.has(key),'native-carrier','Duplicate native identity attribute');seen.add(key);attrs[key]=decodeHTML(value)}
  result.push(attrs)
 }
 return result
}
function appData(raw){
 let ast
 try{ast=parse(raw,{ecmaVersion:'latest',sourceType:'script'})}catch{need(false,'native-carrier','Unsupported native classic script')}
 const first=ast.body[0]?.expression
 need(ast.body[0]?.type==='ExpressionStatement'&&first?.type==='AssignmentExpression'&&first.operator==='='&&first.left.type==='MemberExpression'
  &&!first.left.computed&&first.left.object.name==='window'&&first.left.property.name==='__appData'&&first.right.type==='ObjectExpression'
  &&/^\s*window\.__appData\s*=\s*$/.test(raw.slice(0,first.right.start)),'native-carrier','Unique unconditional original appData JSON required')
 const work=[ast];let references=0,nodes=0
 while(work.length){const node=work.pop();need(++nodes<=80000,'native-carrier','Native syntax bound')
  if(node.type==='MemberExpression'&&(node.property.name==='__appData'||node.property.value==='__appData'))references++
  for(const[key,value]of Object.entries(node))if(!['start','end'].includes(key)){
   if(Array.isArray(value)){for(const item of value)if(item&&typeof item==='object')work.push(item)}
   else if(value&&typeof value==='object')work.push(value)
  }
 }
 need(references===1,'native-carrier','Ambiguous or modified original appData publication')
 const rawJSON=raw.slice(first.right.start,first.right.end)
 return{value:originalJSON(rawJSON),rawJSON,originalScript:raw}
}
function headAndDeclarations(response,parsed,model,boot,isRole){
 const entries=parsed.entries,metas=entries.filter(e=>e.node.tag==='meta'),rawMetas=rawAttributes(response.text,'meta')
 need(rawMetas.length===metas.length&&metas.length===14,'native-head','Unknown or duplicate native metadata')
 const head={}
 for(let i=0;i<metas.length;i++){
  const e=metas[i],attrs=rawMetas[i],key=attrs.name??attrs.property??(Object.hasOwn(attrs,'charset')?'charset':null)
  need(active(e)&&e.ancestors.map(n=>n.tag).join('/')==='root/html/head'&&typeof key==='string'&&!Object.hasOwn(head,key),'native-head','Unqualified native head carrier')
  shape(attrs,key==='charset'?['charset']:key==='csp-nonce'?['name','id','content']:key.startsWith('og:')?['property','content']:['name','content'],'native-head');head[key]=attrs
 }
 shape(head,'charset viewport theme-color csp-nonce title description twitter:card og:url og:type og:title og:description og:image twitter:title twitter:description'.split(' '),'native-head')
 const titles=entries.filter(e=>e.node.tag==='title'),expected=isRole?model.posting?.title+' @ Jasper':'Jasper Jobs'
 need(titles.length===1&&active(titles[0])&&titles[0].ancestors.map(n=>n.tag).join('/')==='root/html/head'
  &&decodeHTML(titles[0].node.raw)===expected,'native-title','Original native title contradiction')
 const constants={viewport:'width=device-width, initial-scale=1, shrink-to-fit=no','theme-color':'#473BCE','twitter:card':'summary','og:type':'website'}
 for(const[key,value]of Object.entries(constants))need(head[key].content===value,'native-head','Unsupported native head model')
 need(head.charset.charset==='utf-8'&&head['og:url'].content===response.url,'native-head','Native head encoding/URL disagreement')
 for(const key of ['title','og:title','twitter:title'])need(head[key].content===(key==='title'?expected:isRole?model.posting.title:expected),'native-title','Native title metadata disagreement')
 const nonce=boot.attrs.nonce,nonces=entries.filter(e=>e.node.attrs.id==='csp-nonce')
 need(nonces.length===1&&nonces[0].node===metas.find(e=>e.node.attrs.id==='csp-nonce')?.node&&head['csp-nonce'].name==='csp-nonce'
  &&head['csp-nonce'].id==='csp-nonce'&&head['csp-nonce'].content===nonce&&response.text.split(nonce).length===3,'native-carrier','Original native head/script nonce disagreement')
 const originalLinks=entries.filter(e=>e.node.tag==='link').map(e=>({attrs:{...e.node.attrs},ancestors:e.ancestors.map(n=>n.tag)})),comparison=copyData(originalLinks)
 const deployments=new Set()
 for(const row of comparison){
  const value=row.attrs.href,match=/^(https:\/\/cdn\.ashbyprd\.com\/(?:frontend_non_user|cdn_assets)\/)([a-f0-9]{40})\//.exec(value??'')
  if(match){deployments.add(match[2]);row.attrs.href=match[1]+'[UNQUALIFIED_DEPLOYMENT]/'+value.slice(match[0].length)}
 }
 need(deployments.size===1&&sha(JSON.stringify(comparison))==='3a4bb7778c7368416940a9c5917746f04e27f3c4f0eb251ec475d9988361b572','native-head','Unreviewed native dependency declaration contexts')
 const descriptionKeys=['description','og:description','twitter:description'],descriptions=descriptionKeys.map(k=>head[k].content)
 need(descriptions.every(s=>typeof s==='string'&&s.length>0)&&descriptions.every(s=>s===descriptions[0]),'native-head','Native head descriptions disagree')
 if(!isRole)need(descriptions[0]==='Jasper Jobs','native-head','Unreviewed native board description')
 return{originalHead:head,headDescriptions:descriptions,documentTitle:expected,originalLinks,declaredDeployment:[...deployments][0],originalNonce:nonce,
  declarationLimits:{sourceBodiesQualified:false,rendererConsumptionQualified:false,browserExecutionQualified:false,activeDependenciesUnqualified:true}}
}
export function readNativeHtml(input,channel){
 const response=readResponse(input,channel),parsed=nativeDocument(response.text),{entries}=parsed,isRole=channel==='O'
 const allowed=new Set(['root','html','head','body','meta','link','title','script','div']),passiveTags=new Set(['style','noscript'])
 const passive=entries.filter(e=>passiveTags.has(e.node.tag)).map(e=>({tag:e.node.tag,attrs:e.node.attrs,raw:e.node.raw,parents:e.ancestors.map(n=>n.tag)}))
 need(sha(JSON.stringify(passive))==='12234fadbefec95ea0a8ec723f90af39f288f2b19a7f8ce6ab134d704b7f3907','native-carrier','Unreviewed native style/noscript context')
 need(entries.every(e=>passiveTags.has(e.node.tag)||allowed.has(e.node.tag)&&active(e)),'native-carrier','Unsupported hidden, inert, foreign or additional native representation')
 const divContexts=entries.filter(e=>e.node.tag==='div').map(e=>({attrs:e.node.attrs,parentTags:e.ancestors.map(n=>n.tag)}))
 need(sha(JSON.stringify(divContexts))==='b1e39ee5c6ef5ea04177bc226101a516a1223878fae45b42ab7cd24ba7e47a45','native-carrier','Unreviewed additional native server data/mount context')
 let outsideRawContexts=response.text
 for(const {node}of entries.filter(e=>['script','style','noscript'].includes(e.node.tag)))if(typeof node.raw==='string'&&node.raw.length)
  outsideRawContexts=outsideRawContexts.replace(node.raw,'[ORIGINAL_RAW_CONTEXT]')
 need(!/<!--|<!\[CDATA\[|<\?/.test(outsideRawContexts),'native-carrier','Unreviewed native comment or shadow carrier representation')
 for(const tag of ['div','link','html','head','body','title','style','noscript'])rawAttributes(response.text,tag)
 for(const tag of ['html','head','body']){
  const nodes=entries.filter(e=>e.node.tag===tag);need(nodes.length===1,'native-carrier','Ambiguous native document structure')
  shape(nodes[0].node.attrs,tag==='html'?['lang']:[],'native-carrier')
  if(tag==='html')need(nodes[0].node.attrs.lang==='en','native-carrier','Unreviewed native document language')
 }
 const scripts=entries.filter(e=>e.node.tag==='script'),rawScripts=rawAttributes(response.text,'script'),carriers=scripts.filter(e=>e.node.raw?.includes('window.__appData'))
 need(carriers.length===1&&scripts.length===(isRole?2:1)&&rawScripts.length===scripts.length,'native-carrier','Missing or ambiguous native publication carrier')
 const boot=carriers[0]
 need(boot.ancestors.map(n=>n.tag).join('/')==='root/html/body','native-carrier','Unqualified classic boot context');shape(boot.node.attrs,['nonce'],'native-carrier')
 const original=appData(boot.node.raw),model=original.value
 shape(model,'ddRumApplicationId ddRumClientToken environment maintenanceMode schedulingMaintenanceMode organization posting jobBoard routerPrefix recaptchaUniversalPublicSiteKey'.split(' '),'native-model')
 need(model.environment==='production'&&model.maintenanceMode===false&&model.schedulingMaintenanceMode===false&&model.routerPrefix==='/'
  &&(isRole?model.jobBoard===null&&model.posting?.id===response.id:model.posting===null),'native-model','Original native availability/account route changed')
 need(sha(JSON.stringify(model.organization))==='5788ed424102807586a96ac1034c1c4a7251ef7092cbb314a87273da9a7a284e','native-organization','Unreviewed Jasper organization/theme/publication class')
 const mounts=entries.filter(e=>e.node.attrs.id==='root'),visible=readVisibleNativeDocument(response.text,{strict:true})
 need(mounts.length===1&&mounts[0].node.tag==='div'&&mounts[0].ancestors.map(n=>n.tag).join('/')==='root/html/body'
  &&visible.nodes(n=>n.attrs.id==='root').length===1,'native-mount','Unique active native mount unavailable');shape(mounts[0].node.attrs,['id'],'native-mount')
 need(visible.text(visible.nodes(n=>n.tag==='root')[0])==='','native-carrier','Additional visible native programme content')
 const lds=scripts.filter(e=>e.node.attrs.type==='application/ld+json')
 need(lds.length===(isRole?1:0),'native-carrier','Unreviewed native schema cardinality')
 if(isRole){need(lds[0].ancestors.map(n=>n.tag).join('/')==='root/html/head','native-carrier','Unqualified own schema context');shape(lds[0].node.attrs,['type'],'native-carrier')}
 for(const attrs of rawScripts)shape(attrs,Object.hasOwn(attrs,'nonce')?['nonce']:['type'],'native-carrier')
 const head=headAndDeclarations(response,parsed,model,boot.node,isRole),securityFacts=initialPolicy(response,channel,head.originalNonce)
 return{...response,...head,securityFacts,originalAppData:model,rawAppData:original.rawJSON,originalBootstrap:original.originalScript,
  originalLD:isRole?originalJSON(lds[0].node.raw):null,rawLD:isRole?lds[0].node.raw:null}
}

