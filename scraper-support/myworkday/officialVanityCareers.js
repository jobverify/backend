import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {activeScripts,readNativeDocument} from '../utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../utils/visibleNativeHtml.js'

const handoffs=new WeakSet()
const redirectHandoffs=new WeakMap()
const proof=(value,message)=>{if(!value)throw Error('Current Workday vanity handoff: '+message)}
const hash=body=>createHash('sha256').update(body).digest('hex')
const configuredURL=value=>{
 const url=new URL(value)
 proof(url.protocol==='https:'&&!url.username&&!url.password&&!url.hash,'invalid configured HTTPS identity')
 return url
}
const responseIdentity=(response,expectedUrl)=>{
 const expected=configuredURL(expectedUrl)
 proof(response?.status===200&&response.ok===true,'native response is not HTTP200')
 proof(response.url===expected.href,'native response exact URL or redirect contradiction')
 const contentType=response.headers?.get?.('content-type')||''
 proof(/^(?:text\/html|application\/xhtml\+xml)(?:\s*;|$)/i.test(contentType),'native response is not HTML')
 return {url:expected.href,finalUrl:response.url,status:200,contentType}
}
const iso=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value))return null
 const canonical=value.replace(/(?:\.(\d{1,3}))?Z$/,(_match,fraction)=>'.'+(fraction||'').padEnd(3,'0')+'Z')
 const date=new Date(canonical)
 return Number.isFinite(+date)&&date.toISOString()===canonical?canonical:null
}

// Replays carry their original own-data clocks. Mentioned but unqualified clock
// metadata cannot inherit a current timestamp from the HTTP observation fallback.
export const snapshotWorkdayVanityCaptureClocks=(response,observations={})=>{
 const keys=['capturedAt','captureStartedAt','startedAt']
 const metadata=keys.some(key=>key in response)?response:observations
 const values={}
 let invalid=false
 for(const key of keys){
  if(!(key in metadata))continue
  const descriptor=Object.getOwnPropertyDescriptor(metadata,key)
  const value=descriptor&&Object.hasOwn(descriptor,'value')?iso(descriptor.value):null
  if(!value)invalid=true
  else values[key]=value
 }
 const capturedAt=values.capturedAt,captureStartedAt=values.captureStartedAt||values.startedAt||null
 if(!capturedAt||captureStartedAt&&captureStartedAt>capturedAt
  ||observations.capturedAt&&capturedAt>observations.capturedAt)invalid=true
 return Object.freeze({capturedAt:invalid?null:capturedAt,captureStartedAt:invalid?null:captureStartedAt})
}

const abortedRead=(operation,signal)=>{
 if(!signal)return operation
 signal.throwIfAborted()
 return new Promise((resolve,reject)=>{
  const abort=()=>{cleanup();reject(signal.reason)}
  const cleanup=()=>signal.removeEventListener('abort',abort)
  signal.addEventListener('abort',abort,{once:true})
  if(signal.aborted){abort();return}
  Promise.resolve(operation).then(value=>{cleanup();resolve(value)},error=>{cleanup();reject(error)})
 })
}

// Used only by the explicit vanity branch, leaving the existing direct transport
// and its request policy unchanged. The branch supplies its existing deadline.
export const readBoundedWorkdayVanityHtml=async(response,{expectedUrl,signal,maxBytes}={})=>{
 signal?.throwIfAborted()
 responseIdentity(response,expectedUrl)
 proof(Number.isInteger(maxBytes)&&maxBytes>0&&maxBytes<=4*1024*1024,'invalid native body bound')
 const length=response.headers?.get?.('content-length')
 proof(length==null||/^\d+$/.test(length)&&Number(length)<=maxBytes,'native body exceeds advertised byte bound')
 proof(response.body?.getReader,'unsupported native streamed body')
 const reader=response.body.getReader(),chunks=[]
 let bytes=0
 try{
  for(;;){
   signal?.throwIfAborted()
   const chunk=await abortedRead(reader.read(),signal)
   signal?.throwIfAborted()
   if(chunk.done)break
   proof(chunk.value instanceof Uint8Array,'unsupported native body chunk')
   bytes+=chunk.value.byteLength
   proof(bytes<=maxBytes,'native body exceeds bounded byte budget')
   chunks.push(Buffer.from(chunk.value))
  }
  signal?.throwIfAborted()
  return Buffer.concat(chunks).toString('utf8')
 }catch(error){
  try{Promise.resolve(reader.cancel(error)).catch(()=>{})}catch{}
  signal?.throwIfAborted()
  throw error
 }finally{try{reader.releaseLock()}catch{}}
}

const receiptClocks=clocks=>{
 const supplied=clocks&&typeof clocks==='object'&&!Array.isArray(clocks)?clocks:{}
 const metadata=Object.create(null)
 for(const key of ['capturedAt','captureStartedAt','startedAt']){
  if(!(key in supplied))continue
  const descriptor=Object.getOwnPropertyDescriptor(supplied,key)
  const value=descriptor&&Object.hasOwn(descriptor,'value')?descriptor.value:undefined
  if(key!=='capturedAt'&&descriptor&&Object.hasOwn(descriptor,'value')&&value===null)continue
  metadata[key]=value
 }
 return snapshotWorkdayVanityCaptureClocks(metadata)
}
const responseReceipt=({response,html,expectedUrl,clocks})=>{
 const qualified=receiptClocks(clocks)
 return Object.freeze({...responseIdentity(response,expectedUrl),sha256:hash(html),
  capturedAt:qualified.capturedAt,captureStartedAt:qualified.captureStartedAt})
}

const redirectIdentity=(response,expectedUrl,boardUrl)=>{
 const expected=configuredURL(expectedUrl),board=configuredURL(boardUrl)
 proof(!expected.port&&!expected.search&&!board.port&&!board.search,'unsupported redirect URL identity')
 proof(response?.status===301&&response.ok===false,'native redirect response is not exact HTTP301')
 proof(response.url===expected.href,'native redirect exact URL contradiction')
 const location=response.headers?.get?.('location')
 proof(typeof location==='string'&&location===boardUrl,'native redirect Location is not the literal configured Workday board')
 return {url:expected.href,finalUrl:response.url,status:301,location,
  contentType:response.headers?.get?.('content-type')||''}
}
const boundedLength=(response,maxBytes,bytes=null)=>{
 const length=response.headers?.get?.('content-length')
 proof(length==null||/^\d+$/.test(length)&&Number(length)<=maxBytes,'native body exceeds advertised byte bound')
 const encoding=(response.headers?.get?.('content-encoding')||'').trim().toLowerCase()
 if(bytes!=null&&length!=null&&(!encoding||encoding==='identity'))proof(bytes===Number(length),'native identity body ended before advertised Content-Length')
}

// Only the explicit redirect-chain mode uses this owned reader. Cancellation
// observes the first reader.cancel promise and does not race a native read.
const readOwnedVanityBytes=async(response,{signal,maxBytes,maxAllowed,validate})=>{
 let reader,cancellation
 const cancel=reason=>{
  if(cancellation)return cancellation
  try{cancellation=Promise.resolve(reader?reader.cancel(reason):response?.body?.cancel?.(reason))}
  catch(error){cancellation=Promise.reject(error)}
  cancellation.catch(()=>{})
  return cancellation
 }
 const abort=()=>{void cancel(signal.reason)}
 try{
  signal?.throwIfAborted()
  validate()
  proof(Number.isInteger(maxBytes)&&maxBytes>0&&maxBytes<=maxAllowed,'invalid native body bound')
  boundedLength(response,maxBytes)
  proof(response.body?.getReader,'unsupported native streamed body')
  reader=response.body.getReader()
  signal?.addEventListener('abort',abort,{once:true})
  if(signal?.aborted)abort()
  const chunks=[]
  let bytes=0
  for(;;){
   signal?.throwIfAborted()
   const chunk=await reader.read()
   signal?.throwIfAborted()
   if(chunk.done)break
   proof(chunk.value instanceof Uint8Array,'unsupported native body chunk')
   bytes+=chunk.value.byteLength
   proof(bytes<=maxBytes,'native body exceeds bounded byte budget')
   chunks.push(Buffer.from(chunk.value))
  }
  boundedLength(response,maxBytes,bytes)
  signal?.throwIfAborted()
  return Buffer.concat(chunks)
 }catch(error){
  try{await cancel(error)}catch{}
  signal?.throwIfAborted()
  throw error
 }finally{
  signal?.removeEventListener('abort',abort)
  if(cancellation)try{await cancellation}catch{}
  try{reader?.releaseLock()}catch{}
 }
}
export const readBoundedWorkdayVanityChainHtml=async(response,{expectedUrl,signal,maxBytes}={})=>{
 const bytes=await readOwnedVanityBytes(response,{signal,maxBytes,maxAllowed:4*1024*1024,validate:()=>responseIdentity(response,expectedUrl)})
 return bytes.toString('utf8')
}
export const readBoundedWorkdayVanityRedirect=(response,{expectedUrl,boardUrl,signal,maxBytes}={})=>readOwnedVanityBytes(response,{
 signal,maxBytes,maxAllowed:1024*1024,validate:()=>redirectIdentity(response,expectedUrl,boardUrl),
})

export const currentWorkdayVanityRedirectReceipt=({handoff,response,body,clocks})=>{
 proof(handoffs.has(handoff),'primary visible handoff proof was not established')
 const identity=redirectIdentity(response,handoff.vanityUrl,handoff.board)
 proof(body instanceof Uint8Array&&body.byteLength<=1024*1024,'missing or oversized redirect body bytes')
 boundedLength(response,1024*1024,body.byteLength)
 const qualified=receiptClocks(clocks)
 const receipt=Object.freeze({...identity,sha256:hash(body),bytes:body.byteLength,
  capturedAt:qualified.capturedAt,captureStartedAt:qualified.captureStartedAt})
 redirectHandoffs.set(receipt,handoff)
 return receipt
}

export const currentWorkdayVanityHandoffReceipt=({officialCareersUrl,vanityCareersUrl,boardUrl,response,html,clocks})=>{
 const vanity=configuredURL(vanityCareersUrl),board=configuredURL(boardUrl)
 proof(typeof html==='string'&&Buffer.byteLength(html)<=4*1024*1024,'missing or oversized primary HTML')
 const primary=responseReceipt({response,html,expectedUrl:officialCareersUrl,clocks})
 const document=readVisibleNativeDocument(html,{strict:true}),anchors=[]
 const walk=node=>{
  if(typeof node==='string'||node.inert)return
  const attrs=node.attrs
  if(['hidden','inert','disabled'].some(key=>Object.hasOwn(attrs,key))
   ||['aria-hidden','aria-disabled'].some(key=>Object.hasOwn(attrs,key)&&attrs[key].toLowerCase()!=='false'))return
  if(node.tag==='a'&&attrs.href&&document.text(node).trim()){
   try{if(new URL(attrs.href,primary.finalUrl).href===vanity.href)anchors.push(vanity.href)}catch{}
  }
  for(const child of node.children)walk(child)
 }
 for(const root of document.nodes(node=>node.tag==='root'))walk(root)
 proof(anchors.length>0,'primary has no visible enabled anchor to the exact native vanity URL')
 const receipt=Object.freeze({primary,vanityUrl:vanity.href,board:board.href,anchorUrl:anchors[0]})
 handoffs.add(receipt)
 return receipt
}

const memberName=node=>node?.type==='MemberExpression'?(node.computed&&node.property?.type==='Literal'?node.property.value:!node.computed?node.property?.name:null):null
const globalNames=new Set(['window','self','globalThis','top','parent','frames','opener'])
const reflectiveNames=new Set(['Object','Reflect','eval','Function','Proxy'])
const globalObject=node=>node?.type==='ThisExpression'||node?.type==='Identifier'&&globalNames.has(node.name)
 ||node?.type==='MemberExpression'&&(globalObject(node.object)&&globalNames.has(memberName(node))||['defaultView','parentWindow'].includes(memberName(node)))
const workdayObject=node=>node?.type==='MemberExpression'&&globalObject(node.object)&&memberName(node)==='workday'||node?.type==='Identifier'&&node.name==='workday'
const initializerObject=node=>node?.type==='MemberExpression'&&!node.computed&&node.object?.name==='window'&&node.property?.name==='workday'
const keyName=property=>property.key?.type==='Identifier'?property.key.name:property.key?.type==='Literal'&&typeof property.key.value==='string'?property.key.value:null
const literalData=node=>{
 if(!node)return false
 if(node.type==='Literal')return node.value==null||['string','boolean','number'].includes(typeof node.value)
 if(node.type==='ArrayExpression')return node.elements.every(literalData)
 if(node.type==='ObjectExpression'){
  const keys=node.properties.map(keyName)
  return keys.every(key=>key!=null)&&new Set(keys).size===keys.length&&node.properties.every(property=>property.type==='Property'&&!property.computed&&!property.method&&property.kind==='init'&&literalData(property.value))
 }
 if(node.type==='ConditionalExpression')return literalData(node.test)&&literalData(node.consequent)&&literalData(node.alternate)
 if(node.type==='BinaryExpression'&&['==','===','!=','!==','<','<=','>','>='].includes(node.operator))return literalData(node.left)&&literalData(node.right)
 if(node.type==='UnaryExpression'&&['-','+','!'].includes(node.operator))return literalData(node.argument)
 return false
}
const nativeConfig=html=>{
 const candidates=[],identityKeys=new Set(['tenant','siteId','appName','isExternal','locale']),firstStatements=new WeakSet(),initializerReferences=new WeakSet()
 const binding=pattern=>{
  if(!pattern)return
  if(pattern.type==='Identifier')proof(!globalNames.has(pattern.name)&&!reflectiveNames.has(pattern.name)
   &&!['workday','document'].includes(pattern.name),'unsupported native global or Workday binding')
  else proof(false,'unsupported native destructuring or binding dataflow')
 }
 // This deliberately does not interpret arbitrary website JavaScript. The
 // observed initializer must use unshadowed globals, and whole global/Workday
 // objects cannot escape into aliases, parameters or reflective operations.
 const sensitive=(node,parent)=>{
  const staticKey=node.type==='Identifier'&&(parent?.type==='MemberExpression'&&parent.property===node&&!parent.computed
   ||parent?.type==='Property'&&parent.key===node&&parent.value!==node&&!parent.computed)
  if(node.type==='VariableDeclarator')binding(node.id)
  if(/^(?:FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(node.type)){
   if(node.id)binding(node.id)
   node.params.forEach(binding)
  }
  if(node.type==='ClassDeclaration'||node.type==='ClassExpression')binding(node.id)
  if(node.type==='CatchClause')binding(node.param)
  proof(!['ObjectPattern','ArrayPattern','ImportExpression','WithStatement'].includes(node.type),'unsupported native identity/global dataflow')
  if(node.type==='Identifier'&&reflectiveNames.has(node.name)){
   const literalKey=parent?.type==='Property'&&parent.key===node&&!parent.computed
    ||parent?.type==='MemberExpression'&&parent.property===node&&!parent.computed
   proof(literalKey,'unsupported native reflective or dynamic-code operation')
  }
  if(node.type==='MemberExpression')proof(memberName(node)!=='constructor','unsupported native dynamic constructor dataflow')
  if(workdayObject(node)&&!staticKey){
   const fieldRead=parent?.type==='MemberExpression'&&parent.object===node&&typeof memberName(parent)==='string'
   proof(initializerReferences.has(node)||fieldRead,'unsupported native Workday object alias or escape')
  }
  if(globalObject(node)&&!staticKey){
   const member=parent?.type==='MemberExpression'&&parent.object===node?memberName(parent):null
   proof(member==='workday'||globalNames.has(member),'unsupported native global object alias or escape')
  }
  if(node.type==='MemberExpression'&&node.object?.name==='document'&&node.computed)
   proof(typeof memberName(node)==='string','unsupported computed native global access')
 }
 const visit=(node,parent)=>{
  if(!node||typeof node!=='object')return
  sensitive(node,parent)
  if(node.type==='AssignmentExpression'&&workdayObject(node.left)){
   proof(initializerObject(node.left)&&node.operator==='='&&parent?.type==='ExpressionStatement'&&firstStatements.has(parent)
    &&node.right?.type==='LogicalExpression'&&node.right.operator==='||'&&initializerObject(node.right.left)
    &&node.right.right?.type==='ObjectExpression'&&literalData(node.right.right),'unsupported or executable native Workday initializer')
   candidates.push(node.right.right)
   initializerReferences.add(node.left)
   initializerReferences.add(node.right.left)
  }else if(node.type==='AssignmentExpression'||node.type==='UpdateExpression'||node.type==='UnaryExpression'&&node.operator==='delete'){
   const target=node.left||node.argument
   const benignCdnFlag=node.type==='AssignmentExpression'&&node.operator==='='&&target?.type==='MemberExpression'
    &&!target.computed&&workdayObject(target.object)&&memberName(target)==='useCdn'&&node.right?.type==='Literal'&&node.right.value===false
   proof(!globalObject(target)&&!(workdayObject(target)||target?.type==='MemberExpression'&&workdayObject(target.object)&&!benignCdnFlag),'conflicting or unmodelled native Workday identity assignment')
  }
  if(node.type==='CallExpression'||node.type==='NewExpression')proof(!node.arguments.some(argument=>workdayObject(argument)||globalObject(argument))
   &&!(node.callee?.type==='MemberExpression'&&workdayObject(node.callee.object)),'unsupported native Workday/global object mutation')
  for(const [key,value]of Object.entries(node)){
   if(['start','end','loc'].includes(key))continue
   if(Array.isArray(value))for(const child of value)visit(child,node)
   else if(value&&typeof value==='object')visit(value,node)
  }
 }
 for(const script of activeScripts(html)){
  let ast
  try{ast=parse(script,{ecmaVersion:'latest'})}catch{throw Error('Current Workday vanity handoff: unsupported native script syntax')}
  if(ast.body[0])firstStatements.add(ast.body[0])
  visit(ast,null)
 }
 proof(candidates.length===1,'missing or ambiguous literal native Workday config')
 const identity={}
 for(const key of identityKeys){
  const field=candidates[0].properties.find(property=>keyName(property)===key)
  proof(field?.value?.type==='Literal','nonliteral native Workday identity '+key)
  identity[key]=field.value.value
 }
 return Object.freeze(identity)
}

const nativeBoardIdentity=({html,boardUrl,localeUrl})=>{
 const document=readNativeDocument(html),canonicals=document.nodes(node=>node.tag==='link'&&(node.attrs.rel||'').split(/\s+/).includes('canonical'))
 proof(canonicals.length===1&&canonicals[0].attrs.href===boardUrl,'native canonical is ambiguous or outside the configured Workday board')
 const board=configuredURL(boardUrl),host=board.hostname.match(/^([^.]+)\.wd\d+\.myworkdayjobs\.com$/i),parts=board.pathname.split('/').filter(Boolean)
 proof(host&&parts.length===1&&!board.search,'unsupported configured Workday board identity')
 const identity=nativeConfig(html)
 proof(identity.tenant===host[1]&&identity.siteId===parts[0]&&identity.appName==='cxs'&&identity.isExternal===true,'native Workday tenant site or external-CXS identity contradiction')
 const locale=new URL(localeUrl).pathname.split('/').filter(Boolean).find(part=>/^[a-z]{2}-[A-Z]{2}$/.test(part))
 proof(typeof identity.locale==='string'&&(!locale||identity.locale===locale),'native Workday locale identity contradiction')
 return identity
}

export const currentWorkdayVanityBoardReceipt=({handoff,response,html,clocks})=>{
 proof(handoffs.has(handoff),'primary visible handoff proof was not established')
 proof(typeof html==='string'&&Buffer.byteLength(html)<=1024*1024,'missing or oversized vanity HTML')
 const native=responseReceipt({response,html,expectedUrl:handoff.vanityUrl,clocks})
 const identity=nativeBoardIdentity({html,boardUrl:handoff.board,localeUrl:handoff.vanityUrl})
 const responses=Object.freeze([handoff.primary,native])
 const fetchedAt=responses.every(row=>row.capturedAt)?responses.map(row=>row.capturedAt).sort()[0]:null
 return Object.freeze({requestedUrl:handoff.primary.url,responseUrl:handoff.primary.finalUrl,status:200,contentType:handoff.primary.contentType,
  board:handoff.board,anchorUrl:handoff.anchorUrl,sha256:handoff.primary.sha256,fetchedAt,
  method:'official-visible-vanity-and-literal-workday-config',responses,nativeIdentity:identity,
  sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
}

export const currentWorkdayVanityRedirectBoardReceipt=({handoff,redirect,response,html,clocks})=>{
 proof(handoffs.has(handoff)&&redirectHandoffs.get(redirect)===handoff,'same primary handoff and branded redirect proof were not established')
 proof(typeof html==='string'&&Buffer.byteLength(html)<=1024*1024,'missing or oversized native board HTML')
 const native=responseReceipt({response,html,expectedUrl:handoff.board,clocks})
 const identity=nativeBoardIdentity({html,boardUrl:handoff.board,localeUrl:handoff.vanityUrl})
 const responses=Object.freeze([handoff.primary,redirect,native])
 const fetchedAt=responses.every(row=>row.capturedAt)?responses.map(row=>row.capturedAt).sort()[0]:null
 return Object.freeze({requestedUrl:handoff.primary.url,responseUrl:handoff.primary.finalUrl,status:200,contentType:handoff.primary.contentType,
  board:handoff.board,anchorUrl:handoff.anchorUrl,sha256:handoff.primary.sha256,fetchedAt,
  method:'official-visible-vanity-redirect-and-literal-workday-config',responses,nativeIdentity:identity,
  sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
}
