import {parse} from 'acorn'
import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {failure} from './runtime20261108.js'

export const PRIMARY='https://careers.axa.com/careers-home/'
export const ALL_JOBS='https://careers.axa.com/jobs'
export const BOARD='https://careers.axa.com/careers-home/jobs'
export const CLIENT='https://app.jibecdn.com/prod/search/4.11.225/main.js'
export const CLIENT_SHA='8fa15e15e8165865026e2f5768af0160b4e1739096302d078e540131894c7f3f'
const need=(value,message)=>{if(!value)throw failure('AXA native: '+message,'AXA_NATIVE_PROOF')}
const norm=value=>String(value??'').replace(/\s+/gu,' ').trim()
const safeKey=key=>typeof key==='string'&&!['__proto__','prototype','constructor'].includes(key)
function literal(node,depth=0){
 need(node&&depth<80,'native literal depth')
 if(node.type==='Literal'&&!node.regex&&(node.value===null||['string','boolean','number'].includes(typeof node.value))){need(typeof node.value!=='number'||Number.isFinite(node.value)&&(!Number.isInteger(node.value)||Number.isSafeInteger(node.value)),'unsafe native configuration number');return node.value}
 if(node.type==='UnaryExpression'&&node.operator==='-'&&node.argument?.type==='Literal'&&typeof node.argument.value==='number')return-node.argument.value
 if(node.type==='ArrayExpression'){need(node.elements.length<=10000,'native literal array bound');return node.elements.map(value=>literal(value,depth+1))}
 need(node.type==='ObjectExpression','nonliteral native configuration')
 const result={}
 for(const property of node.properties){need(property.type==='Property'&&!property.computed&&!property.method&&property.kind==='init','nonliteral native field');const key=property.key.name??property.key.value;need(safeKey(key)&&!Object.hasOwn(result,key),'duplicate or unsafe configuration field');Object.defineProperty(result,key,{value:literal(property.value,depth+1),writable:true,enumerable:true,configurable:true})}
 return result
}
function target(node){
 if(node?.type==='Identifier'&&['_jibe','searchConfig'].includes(node.name))return[node.name]
 if(node?.type==='AssignmentExpression'&&node.operator==='=')return target(node.left)
 if(node?.type!=='MemberExpression')return null
 const key=node.computed?node.property?.type==='Literal'?node.property.value:null:node.property?.name
 if(node.object?.type==='Identifier'&&node.object.name==='window'&&['_jibe','searchConfig'].includes(key))return[key]
 const path=target(node.object);return path&&typeof key==='string'?[...path,key]:null
}
// Exact observed read-only analytics bootstrap; never executed or granted query authority.
const READ_ONLY_ANALYTICS_SHA='87fe522db8fa457f8f9d47e6326dca3c330a3cdc445153c15e5ecc6d2d60a437'
function configuration(nodes,parents){
 const values={},assignments=[],carriers=[]
 const get=path=>{let at=values;for(const key of path){if(at==null)return undefined;need(typeof at==='object'&&!Array.isArray(at),'Unsupported native data reference');at=Object.hasOwn(at,key)?at[key]:undefined}return at}
 const put=(path,value)=>{need(path?.every(safeKey),'Unsafe native data target');let at=values;for(const key of path.slice(0,-1)){need(at[key]&&typeof at[key]==='object'&&!Array.isArray(at[key]),'Unsupported native data path');at=at[key]}at[path.at(-1)]=value;return value}
 const resolve=node=>{if(node?.type==='MemberExpression'){if(node.object.type==='AssignmentExpression')evaluate(node.object);else if(node.object.type==='MemberExpression')resolve(node.object)}return target(node)}
 const evaluate=node=>{
  if(node?.type==='AssignmentExpression'){need(node.operator==='='&&target(node.left),'Unsupported native data assignment');const path=resolve(node.left);return put(path,evaluate(node.right))}
  if(node?.type==='LogicalExpression'){need(node.operator==='||'&&target(node.left),'Unsupported native data fallback');const previous=evaluate(node.left);return previous||evaluate(node.right)}
  if(target(node))return get(resolve(node))
  return literal(node)
 }
 const sidecar=statement=>{const exp=statement.type==='ExpressionStatement'?statement.expression:null;return exp?.type==='AssignmentExpression'&&exp.operator==='='&&exp.left.type==='MemberExpression'&&!exp.left.computed&&exp.left.object?.name==='window'&&exp.left.property?.name==='validations'&&exp.right.type==='Identifier'&&exp.right.name==='undefined'}
 const foreign=node=>{for(let at=node;at;at=parents.get(at))if(['svg','math','template','noscript','object'].includes(at.tag))return true;return false}
 for(const node of nodes){
  if(node.tag!=='script'||node.attrs.src||foreign(node)||!/^(?:|module|(?:text|application)\/(?:java|ecma)script)$/i.test(node.attrs.type??''))continue
  const source=node.raw??'';if(!/\b(?:_jibe|searchConfig)\b/.test(source))continue
  let program;try{program=parse(source,{ecmaVersion:'latest'})}catch{need(false,'unreadable native configuration program')}
  const supported=program.body.filter(statement=>statement.type==='ExpressionStatement'&&statement.expression.type==='AssignmentExpression'&&statement.expression.operator==='='&&target(statement.expression.left))
  if(!supported.length){need(createHash('sha256').update(source).digest('hex')===READ_ONLY_ANALYTICS_SHA,'Unmodeled native configuration program or alias escape');continue}
  need(program.body.every(statement=>statement.type==='EmptyStatement'||sidecar(statement)||supported.includes(statement)),'unsupported native configuration control flow')
  carriers.push({attrs:node.attrs,nativeJavaScript:source})
  for(const statement of supported){
   const expression=statement.expression,path=target(expression.left),value=evaluate(expression)
   assignments.push({target:path,nativeJavaScript:source.slice(statement.start,statement.end),value:structuredClone(value)})
  }
  let serialized;try{serialized=JSON.stringify(values)}catch{need(false,'Cyclic native data configuration')}
  need(serialized.length<=1000000,'Native configuration expansion bound')
 }
 return{nativeAccount:values._jibe??null,nativeSettings:values.searchConfig??null,nativeConfigurationAssignments:assignments,nativeConfigurationCarriers:carriers}
}
function page(source,url,primary){
 const document=readNativeDocument(source),nodes=document.nodes(()=>true),parents=new WeakMap()
 for(const node of nodes)for(const child of node.children??[])if(child&&typeof child==='object')parents.set(child,node)
 const selected=nodes.filter(node=>parents.get(node)?.tag==='head')
 const head={titles:selected.filter(node=>node.tag==='title').map(node=>norm(decodeNativeEntities(node.raw??''))),canonicals:selected.filter(node=>node.tag==='link'&&(node.attrs.rel??'').split(/\s+/).includes('canonical')).map(node=>node.attrs.href??null),metas:selected.filter(node=>node.tag==='meta').map(node=>node.attrs)}
 const result={sourcePage:url,head,...configuration(nodes,parents)}
 const foreign=node=>{for(let at=node;at;at=parents.get(at))if(['svg','math','template','noscript','object'].includes(at.tag))return true;return false}
 if(primary)result.nativeHandoffs=nodes.filter(node=>node.tag==='a'&&!foreign(node)&&norm(document.text(node)).toUpperCase()==='ALL JOBS').map(node=>({attrs:node.attrs,authoredText:norm(document.text(node)),url:new URL(node.attrs.href??'',url).href}))
 else result.nativeRecruitmentScripts=nodes.filter(node=>node.tag==='script'&&!foreign(node)&&node.attrs.src&&/^(?:|module|(?:text|application)\/(?:java|ecma)script)$/i.test(node.attrs.type??'')&&new URL(node.attrs.src,url).pathname.includes('/prod/search/')).map(node=>({attrs:node.attrs,url:new URL(node.attrs.src,url).href}))
 return result
}
export const parsePrimary=(source,url=PRIMARY)=>page(source,url,true)
export const parseBoard=(source,url=BOARD)=>page(source,url,false)
export const parseClient=(source,url=CLIENT)=>({sourcePage:url,nativeJavaScript:source,nativeSHA256:createHash('sha256').update(source).digest('hex')})
export const parseRedirect=(source,packet)=>({sourcePage:packet.requestedURL,nativeStatus:packet.status,nativeLocation:packet.headers?.location??null,nativeBody:source,declaredTarget:new URL(packet.headers?.location??'',packet.requestedURL).href})

export function parseJSON(source,url){
 const value=JSON.parse(source),stack=[]
 // JSON.parse validates grammar; the independent token walk prevents duplicate
 // keys and unsafe native integers from being silently overwritten or rounded.
 for(let index=0;index<source.length;index++){
  const char=source[index]
  if(char==='"'){
   const start=index++;for(;index<source.length;index++){if(source[index]==='\\'){index++;continue}if(source[index]==='"')break}
   const current=stack.at(-1)
   if(current?.object&&current.key){const key=JSON.parse(source.slice(start,index+1));need(!current.keys.has(key),'duplicate native JSON field');current.keys.add(key);current.key=false}
  }else if(char==='{'||char==='['){need(stack.length<80,'native JSON depth');stack.push({object:char==='{',key:char==='{',keys:new Set()})}
  else if(char==='}'||char===']')stack.pop()
  else if(char===','&&stack.at(-1)?.object)stack.at(-1).key=true
  else if(char==='-'||/\d/.test(char)){
   const token=/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(source.slice(index))?.[0]
   if(token){const number=Number(token);need(Number.isFinite(number)&&(!Number.isInteger(number)||Number.isSafeInteger(number)),'unsafe native JSON number');index+=token.length-1}
  }
 }
 return{sourcePage:url,nativeValue:value}
}

export function closingPageProfile(value){
 return{head:value.head,nativeAccount:value.nativeAccount,nativeSettings:structuredClone(value.nativeSettings),nativeHandoffs:value.nativeHandoffs??null,nativeRecruitmentScripts:value.nativeRecruitmentScripts??null}
}
export function closingPagesMatch(opening,closing,{allowUseStarBooleanTransition=false}={}){
 const left=closingPageProfile(opening),right=closingPageProfile(closing),a=left.nativeSettings?.globalSearch,b=right.nativeSettings?.globalSearch
 const hasA=a&&typeof a==='object'&&Object.hasOwn(a,'useStar'),hasB=b&&typeof b==='object'&&Object.hasOwn(b,'useStar')
 if(hasA&&typeof a.useStar!=='boolean'||hasB&&typeof b.useStar!=='boolean')return false
 if(isDeepStrictEqual(left,right))return true
 if(!allowUseStarBooleanTransition||!hasA||!hasB||a.useStar!==false||b.useStar!==true)return false
 delete a.useStar;delete b.useStar
 return isDeepStrictEqual(left,right)
}
