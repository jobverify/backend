import {parse} from 'acorn'
import {decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {failure} from './nativeErrors.js'

const fail=message=>{throw failure(message)}
const parseData=source=>{try{return parse(source,{ecmaVersion:'latest'})}catch(error){throw failure('invalid published data syntax: '+error.message)}}
const literal=(node,source)=>{
 if(node.type==='ObjectExpression'){
  const keys=new Set()
  return Object.fromEntries(node.properties.map(p=>{
   if(p.type!=='Property'||p.computed||p.method||p.shorthand||p.kind!=='init')fail('dynamic template property')
   const key=p.key.type==='Identifier'?p.key.name:p.key.value
   if(typeof key!=='string'||keys.has(key)||key==='nativeJSONNumberLexeme')fail('duplicate or reserved template field')
   keys.add(key);return[key,literal(p.value,source)]
  }))
 }
 if(node.type==='ArrayExpression'){if(node.elements.some(n=>!n))fail('sparse template data');return node.elements.map(n=>literal(n,source))}
 if(node.type==='Literal'&&typeof node.value!=='number'){
  if(node.regex||!['string','boolean','object'].includes(typeof node.value)||typeof node.value==='object'&&node.value!==null)fail('unsupported template value')
  return node.value
 }
 if(node.type==='Literal'&&typeof node.value==='number'||node.type==='UnaryExpression'&&node.operator==='-'&&node.argument.type==='Literal'&&typeof node.argument.value==='number'){
  const raw=source.slice(node.start,node.end),value=Number(raw)
  return /^-?(?:0|[1-9][0-9]*)$/.test(raw)&&raw!=='-0'&&Number.isSafeInteger(value)?value:{nativeJSONNumberLexeme:raw}
 }
 fail('nonliteral template data')
}
export const readLiteralData=source=>{
 const wrapped='('+source+')',ast=parseData(wrapped)
 if(ast.body.length!==1||ast.body[0].type!=='ExpressionStatement')fail('ambiguous template data')
 return literal(ast.body[0].expression,wrapped)
}
export function readNativeConfig(script){
 const ast=parseData(script),assignments=ast.body.map(row=>row.type==='ExpressionStatement'&&row.expression)
 if(assignments.length!==2||assignments.some(e=>e?.type!=='AssignmentExpression'||e.operator!=='='))fail('unreviewed Nuxt configuration program')
 const [init,config]=assignments
 if(script.slice(init.left.start,init.left.end)!=='window.__NUXT__'||init.right.type!=='ObjectExpression'||init.right.properties.length!==0||script.slice(config.left.start,config.left.end)!=='window.__NUXT__.config')fail('unreviewed Nuxt initialization or configuration writes')
 return literal(config.right,script)
}
const escapeHTML=s=>s.replaceAll('&','&amp;').replaceAll('\u00a0','&nbsp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
const voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'])
const outer=node=>{
 if(typeof node==='string')return escapeHTML(decodeNativeEntities(node))
 if(node.nativeTagUnqualified)fail('unqualified template element')
 const attrs=Object.entries(node.attrs).map(([k,v])=>' '+k+'="'+escapeHTML(v).replaceAll('"','&quot;')+'"').join(''),start='<'+node.tag+attrs+'>'
 return start+(voids.has(node.tag)?'':node.children.map(outer).join('')+'</'+node.tag+'>')
}
const escapeChar=c=>({'\b':'\\b','\f':'\\f','\n':'\\n','\r':'\\r','\t':'\\t','"':'\\"',"'":"\\'",'\\':'\\\\'}[c]??'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'))
// The current renderer escapes complete HTML element serializations inside a
// quoted template value, and only controls in ordinary text nodes. This is
// static data decoding; no publisher expression or program is evaluated.
export function readTemplateData(node){
 if(node?.tag!=='template'||node.attrs.type!=='application/json')fail('missing native template carrier')
 let quote=null,escaping=false,source=''
 for(const child of node.children){
  if(typeof child!=='string'){const markup=outer(child);source+=quote?markup.replace(/[\u0000-\u001f\u2028\u2029"'\\]/g,escapeChar):markup;continue}
  for(const c of decodeNativeEntities(child)){
   if(quote===null){source+=c;if(c==='"'||c==="'")quote=c;continue}
   if(escaping){source+=c;escaping=false;continue}
   if(c==='\\'){source+=c;escaping=true;continue}
   if(c===quote){source+=c;quote=null;continue}
   source+=c.charCodeAt(0)<=31||c==='\u2028'||c==='\u2029'?escapeChar(c):c
  }
 }
 return readLiteralData(source)
}
