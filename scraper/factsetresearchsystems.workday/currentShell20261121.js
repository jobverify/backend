import {parse} from 'acorn'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'

const need=(value,message='reviewed corporate shell changed')=>{if(!value)throw Error('FactSet current publisher: '+message)}
const one=values=>{need(values.length===1);return values[0]}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const walk=(node,visit)=>{if(!node||typeof node!=='object')return;visit(node);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(child=>walk(child,visit));else if(value&&typeof value==='object')walk(value,visit)}
const member=(node,object,key)=>node?.type==='MemberExpression'&&!node.computed&&node.object?.name===object&&node.property?.name===key
const prefetch=node=>node?.type==='MemberExpression'&&node.computed&&node.object?.name==='window'&&node.property?.type==='CallExpression'&&member(node.property.callee,'Symbol','for')&&node.property.arguments.length===1&&node.property.arguments[0].value==='@fds/prefetch-html-stream'
const resolve=node=>node?.type==='CallExpression'&&node.callee?.type==='MemberExpression'&&!node.callee.computed&&node.callee.property?.name==='resolve'&&prefetch(node.callee.object)
function literal(node){
 if(node?.type==='Literal'){need(!node.regex);return node.value}
 if(node?.type==='ArrayExpression')return node.elements.map(literal)
 need(node?.type==='ObjectExpression')
 const keys=new Set(),entries=node.properties.map(property=>{
  need(property.type==='Property'&&!property.computed&&!property.method&&property.kind==='init')
  const key=property.key.name??property.key.value
  need(typeof key==='string'&&!keys.has(key));keys.add(key);return[key,literal(property.value)]
 })
 return Object.fromEntries(entries)
}
const stylesheetByRenderer={
 'https://www.factset.com/assets/index-CJaIwYkV.js':'/assets/index-CRBZvXdm.css',
 'https://www.factset.com/assets/index--Pj3DBjZ.js':'/assets/index-BEfadAGS.css',
}
const expected={
 spark:{onetrust:{token:'48817743-8ff9-4c07-a64a-67d66f7cbc1b',useTest:false},sentry:{publicKey:'10392517261847659fa1c1a76eaf2aef',projectId:'977',environment:'www-factset',release:'PASSIVE_RELEASE',tracesSampleRate:1},enabled:['clarity','onetrust','sentry','spara']},
 googleEnhancedConversions:true,googleTagManagerId:'GTM-5HLSMD9',pardotAId:951242,pardotCId:95147,pardotDomain:'pi.pardot.com',ninetailedClientId:'0a3afd5e-ae6c-46d2-82a5-fa72a232b702',ninetailedPreview:false,
 userState:{isMorphed:false,isInhouse:false,isClient:false,isInhouseClient:false,isInternal:false,isAnonymous:true},
}

// The active shell owns an empty Vue mount and an anonymous literal prefetch
// model. Telemetry release strings are retained as provenance rather than a
// fingerprint of recruitment authority. CMS/native consumers remain separate.
export function readFactSetCorporateShell(html,rendererURL){
 need(typeof html==='string'&&!html.startsWith('\uFEFF')&&!html.includes('\uFFFD'),'invalid UTF-8 corporate shell')
 const original=readNativeDocument(html),visible=readVisibleNativeDocument(html,{strict:true})
 const documentRoot=one(original.nodes(node=>node.tag==='html'))
 need(documentRoot.attrs.lang==='en')
 const body=one(original.nodes(node=>node.tag==='body')),visibleBody=one(visible.nodes(node=>node.tag==='body'))
 need(same(visibleBody.attrs,body.attrs))
 const mount=one(original.nodes(node=>node.attrs.id==='app'))
 need(mount.tag==='div'&&same(mount.attrs,{id:'app'})&&mount.children.every(child=>typeof child==='string'&&!child.trim()))
 need(visible.nodes(node=>node.attrs.id==='app').length===1)
 const children=body.children.filter(child=>typeof child!=='string'||child.trim())
 need(children.length===2&&children[0]===mount&&children[1].tag==='script')
 need(original.nodes(node=>['a','button','form','iframe'].includes(node.tag)).length===0)
 need(original.nodes(node=>node.tag==='script'&&(node.attrs.type??'').toLowerCase()==='application/ld+json').length===0)
 const links=original.nodes(node=>node.tag==='link')
 need(links.every(node=>['canonical','preload','preconnect','icon','stylesheet'].includes(node.attrs.rel)))
 const stylesheet=one(links.filter(node=>node.attrs.rel==='stylesheet'))
 need(stylesheet.attrs.href===stylesheetByRenderer[rendererURL])
 const scripts=original.nodes(node=>node.tag==='script'),nonces=scripts.filter(node=>Object.hasOwn(node.attrs,'nonce'))
 let nonce=null
 if(nonces.length){
  need(nonces.length===scripts.length)
  nonce=nonces[0].attrs.nonce
  need(/^[A-Za-z0-9+/]{22}==$/.test(nonce)&&Buffer.from(nonce,'base64').length===16&&Buffer.from(nonce,'base64').toString('base64')===nonce&&nonces.every(node=>node.attrs.nonce===nonce))
 }
 const calls=[]
 for(const script of scripts.filter(node=>!node.attrs.src)){
  need(!Object.hasOwn(script.attrs,'nomodule')&&['','text/javascript','application/javascript'].includes((script.attrs.type??'').toLowerCase()))
  let program;try{program=parse(script.raw??'',{ecmaVersion:'latest',sourceType:'script'})}catch{need(false)}
  const found=[];walk(program,node=>{if(resolve(node))found.push(node)})
  if(found.length){
   need(program.body.length===1&&program.body[0].type==='ExpressionStatement'&&program.body[0].expression===one(found)&&script===children[1])
   calls.push(one(found))
  }
 }
 const call=one(calls);need(call.arguments.length===1)
 const metadata=literal(call.arguments[0]),copy=structuredClone(metadata)
 need(/^[0-9a-f]{40}$/.test(copy.spark?.sentry?.release??''))
 if(nonce){need(copy.spark?.nonce===nonce);delete copy.spark.nonce}
 else need(!Object.hasOwn(copy.spark??{},'nonce'))
 copy.spark.sentry.release='PASSIVE_RELEASE'
 need(same(copy,expected))
 // Preserve every published passive field except the issued nonce itself.
 if(Object.hasOwn(metadata.spark,'nonce'))metadata.spark.nonce='[paired-public-CSP-nonce]'
 return{mount:'app',anonymous:true,nonceSlots:nonces.length+(nonce?1:0),stylesheet:stylesheet.attrs.href,metadata}
}
