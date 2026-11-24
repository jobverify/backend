import {parse} from 'acorn'
import {decodeHTML,decodeHTMLAttribute} from 'entities'
import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument,readNativeAttributeTokens} from '../../scraper-support/utils/activeNativeHtml.js'
import {HOME,CAREER,CLIENT,need,sha} from './nativeTransport20261121.js'

const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
const walk=(node,visit)=>{if(!node||typeof node!=='object')return;visit(node);for(const value of Object.values(node))if(Array.isArray(value))for(const child of value)walk(child,visit);else if(value&&typeof value==='object')walk(value,visit)}
const plainAST=source=>{
 const ast=parse(source,{ecmaVersion:'latest',sourceType:'script'}),names=new Map()
 walk(ast,node=>{for(const identifier of node.type==='VariableDeclarator'?[node.id]:['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(node.type)?[node.id,...node.params]:[])if(identifier?.type==='Identifier'&&!names.has(identifier.name))names.set(identifier.name,'local'+names.size)})
 const normalize=(node,parent,key)=>{
  if(Array.isArray(node))return node.map(child=>normalize(child,parent,key))
  if(!node||typeof node!=='object')return node
  if(node.type==='Identifier')return{type:'Identifier',name:((parent?.type==='MemberExpression'&&key==='property'&&!parent.computed)||(parent?.type==='Property'&&key==='key'&&!parent.computed))?node.name:names.get(node.name)??node.name}
  return Object.fromEntries(Object.entries(node).filter(([name])=>!['start','end','raw'].includes(name)).map(([name,value])=>[name,normalize(value,node,name)]))
 }
 return normalize(ast)
}
const criticalStyle=value=>{
 need(!/[\\{}]|\/\*/.test(value),'unreviewed inline style syntax')
 const declarations=[]
 for(const field of value.split(';').filter(v=>v.trim())){
  const match=/^\s*([a-z-]+)\s*:\s*([\s\S]*)$/i.exec(field)
  need(match,'unreviewed inline declaration')
  if(/^(?:--|display$|visibility$|content-visibility$|content$|opacity$|clip$|clip-path$|filter$|white-space$)/i.test(match[1]))declarations.push([match[1].toLowerCase(),norm(match[2])])
 }
 return declarations
}
const allNodes=root=>[root,...root.children.filter(child=>typeof child!=='string').flatMap(allNodes)]
const svgDecorationTags=new Set(['svg','path','g','rect','circle','ellipse','line','polyline','polygon','defs','clippath'])
const svgGeometry=new Set(['d','fill','fill-rule','fill-opacity','clip-rule','viewbox','stroke','stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','opacity','x','y','x1','x2','y1','y2','cx','cy','r','rx','ry','points','transform','preserveaspectratio'])
const blockTags=new Set(['address','article','aside','blockquote','body','br','dd','div','dl','dt','fieldset','figcaption','figure','footer','form','h1','h2','h3','h4','h5','h6','head','header','hr','html','li','main','nav','ol','p','pre','section','table','tbody','td','th','title','tr','ul'])
const textNodes=(node,includeInert)=>{
 if(['script','style'].includes(node.tag)||node.inert&&!includeInert)return''
 // Decode each original raw text channel once, before joining inline nodes.
 // Neither ancestors nor concatenated fragments may create another entity.
 const value=node.raw===undefined?node.children.map(child=>typeof child==='string'?decodeHTML(child):textNodes(child,includeInert)).join(''):decodeHTML(node.raw)
 return blockTags.has(node.tag)?'\n'+value+'\n':value
}
const authored=node=>norm(textNodes(node,true))
const activeText=node=>norm(textNodes(node,false))
const rawInertTags=new Set(['style','textarea','xmp','iframe','noembed','noframes','plaintext','noscript'])
const ownAttributeDocument=html=>{
 const doc=readNativeDocument(html,{sourceRanges:true}),root=doc.nodes(()=>true)[0]
 const restore=(node,parentInert=false)=>{
  if(node.tag!=='root'){
   // Use the existing lexical tree and exact opening-tag boundaries. Values
   // come from the original span, never the shared tree's decoded attrs.
   // Namespace, tag qualification, raw bodies and structural ownership stay
   // on that same tree; every raw attribute value is decoded exactly once.
   need(Number.isInteger(node.sourceStart)&&Number.isInteger(node.sourceOpenEnd)&&node.sourceOpenEnd<=html.length&&html[node.sourceStart]==='<'&&html[node.sourceOpenEnd-1]==='>'&&html.slice(node.sourceStart+1,node.sourceStart+1+node.tag.length).toLowerCase()===node.tag,'unqualified raw attribute ownership')
   const fields=new Map()
   for(const[key,value]of readNativeAttributeTokens(html.slice(node.sourceStart+1+node.tag.length,node.sourceOpenEnd-1))){
    if(node.tag==='meta')need(!fields.has(key),'ambiguous duplicate publisher metadata')
    if(!fields.has(key))fields.set(key,decodeHTMLAttribute(value))
   }
   node.attrs=Object.fromEntries(fields)
   const style=(node.attrs.style??'').replace(/\/\*[\s\S]*?\*\//g,'')
   const hidden=Object.hasOwn(node.attrs,'hidden')||Object.hasOwn(node.attrs,'inert')||node.attrs['aria-hidden']?.toLowerCase()==='true'||/(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|content-visibility\s*:\s*hidden)\s*(?:!important\s*)?(?:;|$)/i.test(style)
   node.activeFrame=node.tag==='iframe'&&!parentInert&&!hidden
   node.inert=parentInert||hidden||node.nativeTagUnqualified===true||node.tag==='template'||node.tag==='object'||rawInertTags.has(node.tag)
  }
  for(const child of node.children)if(typeof child!=='string')restore(child,node.inert===true)
 }
 restore(root)
 return{doc,root}
}
export function nativeHTMLModel(html,url){
 need(typeof html==='string'&&html.length<=2097152,'invalid public HTML')
 const{doc,root}=ownAttributeDocument(html),nodes=allNodes(root)
 need(!nodes.some(n=>n.nativeTagUnqualified),'unqualified HTML carrier')
 need(nodes.filter(n=>n.tag==='html').length===1&&nodes.filter(n=>n.tag==='head').length===1&&nodes.filter(n=>n.tag==='body').length===1,'complete public document required')
 need(!nodes.some(n=>n.tag==='base'),'public base declarations require review')
 const carriers=[]
 for(const node of nodes){
  // Only native SVG presentation is omitted. Alt/title/aria text, links, data,
  // embedded programmes and every other declaration remain authored evidence.
  const attrs=Object.fromEntries(Object.entries(node.attrs).filter(([key])=>!['class','style'].includes(key)&&(!['id','width','height','loading','decoding'].includes(key)||node.tag==='section')&&!(svgDecorationTags.has(node.tag)&&svgGeometry.has(key))).sort(([a],[b])=>a.localeCompare(b)))
  const style=criticalStyle(node.attrs.style??'')
  if(Object.keys(attrs).length||style.length||node.inert||['form','iframe','embed','object','template','noscript','style','script'].includes(node.tag))carriers.push({tag:node.tag,attrs,inert:node.inert===true,style,...(['script','style','iframe','noscript','textarea','xmp','plaintext'].includes(node.tag)?{raw:node.tag==='script'&&!(node.attrs.type??'').includes('json')?plainAST(node.raw??''):node.raw??''}:{})})
 }
 const headings=doc.nodes(n=>/^h[1-6]$/.test(n.tag)).map(n=>({tag:n.tag,text:activeText(n)}))
 const model={url,authoredText:authored(root),headings,carriers}
 if(url===HOME){
  need(doc.nodes(n=>n.tag==='meta'&&n.attrs.name==='author'&&n.attrs.content==='Lemonade Payments').length===1,'own publisher author changed')
  const links=doc.nodes(n=>n.tag==='a'&&activeText(n)==='Career')
  need(isDeepStrictEqual(links.map(n=>n.attrs.href),['./career','/career'])&&links.every(n=>new URL(n.attrs.href,HOME).href===HOME+'career'),'literal own Career authority changed')
 }else{
  need(url===CAREER,'unknown public page')
  need(doc.nodes(n=>n.tag==='title'&&activeText(n)==='Shape your career at Lemonade - Job opportunities in Fintech').length===1,'careers publisher title changed')
  need(doc.nodes(n=>n.tag==='meta'&&n.attrs.name==='author'&&n.attrs.content==='Lemonade Payments').length===1,'careers publisher author changed')
  const sections=doc.nodes(n=>n.tag==='section'&&doc.nodes(c=>c.tag==='h2'&&activeText(c)==='Open Roles',n).length>0)
  need(sections.length===1&&activeText(sections[0])==='Open Roles no open roles at the moment','finite authored Open Roles cohort changed')
  need(!doc.nodes(n=>['a','button','form','iframe','embed','object','input','select','textarea'].includes(n.tag),sections[0]).length,'new native role/application carrier')
  model.openRoles={authoredText:authored(sections[0]),headings:doc.nodes(n=>/^h[1-6]$/.test(n.tag),sections[0]).map(n=>({tag:n.tag,text:activeText(n)}))}
  const client=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='module'&&n.attrs.src!==undefined&&new URL(n.attrs.src,CAREER).href===CLIENT)
  need(client.length===1&&client[0].attrs.src==='../main.js','active literal own UI client changed')
 }
 need(model.authoredText.includes('Lemonade Payments Inc.'),'exact legal publisher missing')
 return model
}

// A single existing footer contact is mechanically equal when Cloudflare changes
// its XOR representation. This does not execute or qualify the current decoder.
// All actual models/documents remain intact; only explicit comparison copies vary.
export function qualifyProtectedHomeContact(html,model,reviewed){
 need(model?.url===HOME&&reviewed?.url===HOME,'protected contact is HOME-only')
 const{root}=ownAttributeDocument(html),nodes=allNodes(root),parents=new Map()
 for(const parent of nodes)for(const child of parent.children)if(typeof child!=='string')parents.set(child,parent)
 need(!nodes.some(node=>node.nativeTagUnqualified),'unqualified protected contact namespace')
 const contacts=nodes.filter(node=>Object.hasOwn(node.attrs,'data-cfemail'))
 const selected=nodes.filter(node=>(node.attrs.class??'').split(/\s+/).includes('__cf_email__'))
 need(contacts.length===1&&selected.length===1&&selected[0]===contacts[0],'single protected public contact required')
 const node=contacts[0],encoded=node.attrs['data-cfemail']
 need(node.tag==='a'&&node.inert===false&&isDeepStrictEqual(Object.keys(node.attrs).sort(),['class','data-cfemail','href'])&&node.attrs.class==='__cf_email__'&&node.attrs.href==='/cdn-cgi/l/email-protection','protected contact carrier changed')
 need(node.children.length===1&&typeof node.children[0]==='string'&&decodeHTML(node.children[0])==='[email\u00a0protected]','protected contact placeholder changed')
 const ancestors=[]
 for(let at=parents.get(node);at&&at.tag!=='root';at=parents.get(at))ancestors.push(at.tag)
 need(isDeepStrictEqual(ancestors,['li','ul','div','div','div','footer','div','body','html']),'protected contact footer ownership changed')
 const decoderPath='/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js'
 const declarations=nodes.filter(candidate=>candidate.tag==='script'&&candidate.attrs.src===decoderPath)
 need(declarations.length===1,'single declared protected-contact decoder required')
 const decoder=declarations[0]
 need(decoder.inert===false&&isDeepStrictEqual(decoder.attrs,{'data-cfasync':'false',src:decoderPath})&&(decoder.raw??'')==='','protected-contact decoder declaration changed')
 for(const owner of[node,decoder]){
  const tokens=readNativeAttributeTokens(html.slice(owner.sourceStart+1+owner.tag.length,owner.sourceOpenEnd-1))
  const fields=new Set()
  for(const[key,value]of tokens){need(!fields.has(key)&&owner.attrs[key]===value,'ambiguous or nonliteral protected-contact attribute');fields.add(key)}
 }
 const actual=model.carriers.filter(carrier=>Object.hasOwn(carrier.attrs,'data-cfemail'))
 const expected=reviewed.carriers.filter(carrier=>Object.hasOwn(carrier.attrs,'data-cfemail'))
 need(actual.length===1&&expected.length===1&&actual[0].attrs['data-cfemail']===encoded,'protected-contact model ownership changed')
 const reviewedEncoded=expected[0].attrs['data-cfemail']
 const decode=value=>{
  need(typeof value==='string'&&/^[a-f0-9]{44}$/.test(value),'protected contact requires exact 44-hex shape')
  const bytes=Buffer.from(value,'hex'),decoded=Buffer.from([...bytes.subarray(1)].map(byte=>byte^bytes[0]))
  need(decoded.length===21&&[...decoded].every(byte=>byte>=0x21&&byte<=0x7e)&&/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(decoded.toString('ascii')),'protected contact must retain reviewed ASCII shape')
  return decoded
 }
 const decoded=decode(encoded),reviewedDecoded=decode(reviewedEncoded)
 need(sha(decoded)===sha(reviewedDecoded),'protected public contact changed')
 need(html.split(encoded).length-1===1,'protected contact representation has unowned occurrences')
 const comparisonModel=structuredClone(model)
 comparisonModel.carriers.filter(carrier=>Object.hasOwn(carrier.attrs,'data-cfemail'))[0].attrs['data-cfemail']=reviewedEncoded
 requireReviewedHTML(comparisonModel,reviewed)
 const projectedText=html.replace(encoded,'[SINGLE-BOUND-ENCODED-CONTACT]')
 return{comparisonModel,projectedText,projectedSHA256:sha(projectedText),evidence:{
  scope:'single-existing-active-footer-protected-public-contact-comparison-only',
  encodedBytes:22,encodedSHA256:sha(encoded),decodedBytes:decoded.length,decodedSHA256:sha(decoded),
  actualEncodedRepresentationRetainedInOriginalModel:true,wholeReviewedModelEqualAfterSingleFieldReconstruction:true,
  singleOwnedRawSpanProjected:true,projectedBodySHA256:sha(projectedText),decoderDeclarationQualified:true,
  decoderFetchedOrExecuted:false,currentDecoderBytesOrBrowserEquivalenceClaimed:false,plaintextPersisted:false
 }}
}

// This closed interpreter checks effect kinds and DOM ownership without running
// the publisher. Cosmetic classes and event/UI implementation can vary; no
// recruitment carrier, network primitive, dynamic code or arbitrary global can
// enter this UI-only contract. Names are resolved lexically, not fingerprinted.
export function readUIOnlyClient(source){
 need(typeof source==='string'&&source.length<=2097152,'invalid declared client')
 const ast=parse(source,{ecmaVersion:'latest',sourceType:'module'}),selectors=new Set(),effects=[]
 const primitive={kind:'primitive'},dom=token=>({kind:'dom',token}),read=(scope,name)=>{for(let at=scope;at;at=at.parent)if(at.values.has(name))return at.values.get(name);need(name==='document','unbound public UI identifier');return{kind:'document'}}
 const literal=node=>{need(node?.type==='Literal'&&typeof node.value==='string','literal UI argument required');return node.value}
 const property=node=>{need(!node.optional&&(!node.computed||node.property.type==='Literal'&&node.property.value===0),'unreviewed UI member');return node.computed?0:node.property.name}
 const callback=(node,parent,types)=>{
  need(['FunctionExpression','ArrowFunctionExpression'].includes(node?.type)&&!node.async&&!node.generator&&!node.id&&node.params.length<=types.length&&node.params.every(n=>n.type==='Identifier'),'unreviewed UI callback')
  const scope={parent,values:new Map(node.params.map((n,i)=>[n.name,{...types[i],mutable:false}]))}
  if(node.body.type==='BlockStatement')statements(node.body.body,scope);else expression(node.body,scope)
 }
 const expression=(node,scope)=>{
  need(node&&typeof node==='object','missing UI expression')
  if(node.type==='Literal'){need(['string','number','boolean'].includes(typeof node.value)||node.value===null,'unreviewed UI literal');return primitive}
  if(node.type==='Identifier')return read(scope,node.name)
  if(node.type==='UnaryExpression'){need(node.operator==='!','unreviewed UI unary effect');expression(node.argument,scope);return primitive}
  if(['BinaryExpression','LogicalExpression'].includes(node.type)){need(['===','!==','-','*','+','||','&&'].includes(node.operator),'unreviewed UI operator');expression(node.left,scope);expression(node.right,scope);return primitive}
  if(node.type==='ConditionalExpression'){expression(node.test,scope);expression(node.consequent,scope);expression(node.alternate,scope);return primitive}
  if(node.type==='MemberExpression'){
   const owner=expression(node.object,scope),key=property(node)
   if(owner.kind==='event-array'&&key===0)return{kind:'event'}
   if(owner.kind==='event'&&key==='touches')return{kind:'event-array'}
   if(owner.kind==='event'&&key==='target')return dom('event-target')
   if(owner.kind==='event'&&key==='pageX')return primitive
   if(owner.kind==='document'&&key==='body')return dom('body')
   if(owner.kind==='dom'&&key==='classList'){need(!['body','event-target'].includes(owner.token),'unbound UI class owner');return{kind:'classes',token:owner.token}}
   if(owner.kind==='dom'&&key==='style')return{kind:'style',token:owner.token}
   if(owner.kind==='dom'&&['offsetLeft','scrollLeft'].includes(key)&&owner.token==='.scroll-container')return primitive
   if(owner.kind==='style'&&key==='display'&&owner.token==='.dropdown>.dropdown-content')return primitive
   need(false,'unreviewed UI property read')
  }
  if(node.type==='AssignmentExpression'){
   need(node.operator==='=','unreviewed UI assignment')
   const value=expression(node.right,scope)
   if(node.left.type==='Identifier'){
    const target=read(scope,node.left.name);need(target.mutable,'immutable/unbound UI assignment');need(target.kind==='primitive'&&value.kind==='primitive','changed UI binding ownership')
   }else{
    need(node.left.type==='MemberExpression','unreviewed UI assignment target')
    const owner=expression(node.left.object,scope),key=property(node.left)
    need(value.kind==='primitive'&&(owner.kind==='style'&&(key==='overflow'&&owner.token==='body'||key==='display'&&owner.token==='.dropdown>.dropdown-content')||owner.kind==='dom'&&key==='scrollLeft'&&owner.token==='.scroll-container'),'non-UI DOM write')
    effects.push({owner:owner.token,key})
   }
   return value
  }
  if(node.type==='CallExpression'){
   need(!node.optional&&node.callee.type==='MemberExpression'&&!node.arguments.some(n=>n.type==='SpreadElement'),'unreviewed UI invocation')
   const owner=expression(node.callee.object,scope),method=property(node.callee),args=node.arguments
   if(owner.kind==='document'&&['getElementById','querySelector','querySelectorAll'].includes(method)){
    need(args.length===1,'UI selector arity changed');const value=literal(args[0])
    const ids=['nav-menu','nav-toggle','nav-close','product-menu','product-link','submenu-close','submenu-back','company-menu','company-link','company-close','company-back','support-menu','support-link','support-close','support-back']
    need(method==='getElementById'?ids.includes(value):method==='querySelector'?value==='.scroll-container':value==='.dropdown','new UI/role DOM selector')
    selectors.add(value);return method==='querySelectorAll'?{kind:'dom-array',token:value}:dom(value)
   }
   if(owner.kind==='dom'&&owner.token==='.dropdown'&&method==='querySelector'){
    need(args.length===1&&['.dropbtn','.dropdown-content'].includes(literal(args[0])),'new nested UI selector');return dom('.dropdown>'+literal(args[0]))
   }
   if(owner.kind==='dom-array'&&method==='forEach'){need(args.length===1,'UI iteration arity changed');callback(args[0],scope,[dom(owner.token)]);return primitive}
   if(['document','dom'].includes(owner.kind)&&method==='addEventListener'){
    need(args.length===2&&['DOMContentLoaded','click','mousedown','mouseleave','mouseup','mousemove','touchstart','touchend','touchmove'].includes(literal(args[0])),'new UI event binding')
    callback(args[1],scope,[{kind:'event'}]);return primitive
   }
   if(owner.kind==='classes'&&['add','remove','contains'].includes(method)){
    need(args.length===1&&/^[a-z_][a-z0-9_-]{0,99}$/i.test(literal(args[0])),'nondecorative UI class write');return primitive
   }
   if(owner.kind==='event'&&method==='preventDefault'){need(args.length===0,'UI event arity changed');return primitive}
   if(owner.kind==='dom'&&owner.token==='.dropdown'&&method==='contains'){need(args.length===1&&expression(args[0],scope).kind==='dom','UI containment changed');return primitive}
   need(false,'new public client dataflow or effect')
  }
  need(false,'unreviewed UI executable expression '+node.type)
 }
 const statements=(nodes,scope)=>{
  for(const node of nodes){
   if(node.type==='VariableDeclaration')for(const item of node.declarations){need(item.id.type==='Identifier'&&!scope.values.has(item.id.name),'unreviewed/duplicate UI binding');scope.values.set(item.id.name,{...(item.init?expression(item.init,scope):primitive),mutable:node.kind!=='const'})}
   else if(node.type==='ExpressionStatement')expression(node.expression,scope)
   else if(node.type==='IfStatement'){expression(node.test,scope);statements(node.consequent.type==='BlockStatement'?node.consequent.body:[node.consequent],{parent:scope,values:new Map()});if(node.alternate)statements(node.alternate.type==='BlockStatement'?node.alternate.body:[node.alternate],{parent:scope,values:new Map()})}
   else if(node.type==='ReturnStatement')need(node.argument===null,'new public UI return dataflow')
   else if(node.type==='EmptyStatement')continue
   else need(false,'unreviewed public UI statement '+node.type)
  }
 }
 statements(ast.body,{parent:null,values:new Map()})
 return{contract:'closed-navigation-and-scroll-ui-effects',selectors:[...selectors].sort(),effectOwners:[...new Set(effects.map(effect=>effect.owner))].sort(),recruitmentWrites:false,inventoryRequests:false,executed:false}
}

export function requireReviewedHTML(model,profile){need(isDeepStrictEqual(model,profile),'current authored publication/authority/declaration model changed')}
