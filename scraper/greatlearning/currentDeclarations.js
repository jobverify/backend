import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {parseNativeJSON} from '../aecom.workday/nativeJSON.js'
import {document,one,all,within,cls,norm,flow,snapshot,byClass,childByClass} from './currentHtml.js'
import {INLINE_STYLE_CONTRACT,STYLESHEET_DECLARATIONS,CSS_CONTRACT} from './currentStyleContract.js'
import {CRITICAL_ANCESTRY,STYLE_ATTRIBUTES} from './currentRendererContract.js'
import {need,failure} from './currentErrors.js'
export {need,failure,isFailure} from './currentErrors.js'
export const HOME='https://www.mygreatlearning.com/',CAREERS=HOME+'careers',COMPANY='Great Learning'
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
export const json=value=>{try{return parseNativeJSON(value)}catch(error){throw failure('JSON: '+error.message)}}
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
export function readJSONLD(doc,kind){
 const models=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'&&!n.attrs.src).map(n=>json(n.raw||'')).filter(m=>object(m)&&m['@type']===kind)
 return one(models,'active native '+kind)
}
export function verifyStyles(doc,kind){
 // Styles and stylesheet links apply even inside a visually hidden parent.
 // Their own visual inert flag cannot select CSS metadata. Template/noscript
 // contents, however, are outside the normal static document's style inputs.
 const semantic=node=>typeof node==='string'||['template','noscript','object','iframe','script','textarea'].includes(node.tag)?[]:[node,...node.children.flatMap(semantic)]
 const root=one(doc.nodes(n=>n.tag==='root'),'renderer document'),nodes=semantic(root),styleNodes=nodes.filter(n=>n.tag==='style'),styles=styleNodes.map(n=>sha(n.raw||''));need(isDeepStrictEqual(styles,INLINE_STYLE_CONTRACT[kind]),'unreviewed '+kind+' renderer style inputs')
 const nonces=styleNodes.filter(n=>Object.hasOwn(n.attrs,'nonce')).map(n=>n.attrs.nonce);need(nonces.every(v=>/^[a-f0-9]{24}$/.test(v))&&new Set(nonces).size===1,'unreviewed document style nonce carrier')
 const styleAttributes=styleNodes.map(n=>Object.fromEntries(Object.entries(n.attrs).map(([k,v])=>[k,k==='nonce'?'<per-document-style-nonce>':v])));need(isDeepStrictEqual(styleAttributes,STYLE_ATTRIBUTES[kind]),'unreviewed style-element attributes')
 const links=nodes.filter(n=>n.tag==='link'&&(n.attrs.rel||'').split(/[\t\n\f\r ]+/).some(v=>v.toLowerCase()==='stylesheet')).map(n=>({...n.attrs}));need(isDeepStrictEqual(links,STYLESHEET_DECLARATIONS[kind]),'unreviewed stylesheet declarations')
 const target=kind==='home'?one(doc.nodes(n=>n.tag==='body'),'native body'):byClass(doc,kind==='careers'?'career-openings__list':'job-opening-container')
 const pathTo=node=>{if(node===target)return[node];for(const c of node.children||[])if(typeof c!=='string'){const path=pathTo(c);if(path)return[node,...path]}return null},criticalAncestry=pathTo(root)?.map(n=>({tag:n.tag,attrs:{...n.attrs}}));need(isDeepStrictEqual(criticalAncestry,CRITICAL_ANCESTRY[kind]),'unreviewed critical renderer ancestry')
 need(nodes.filter(n=>n.tag==='base').length===0,'unreviewed document base');return{inlineStyleSHA256:styles,inlineStyleAttributes:styleAttributes,styleNoncePolicy:'one-consistent-public-nonce-per-document-normalized-after-format-validation',criticalAncestry,declaredStylesheets:links,reviewedRoleScreenStylesheet:kind==='home'?null:{...CSS_CONTRACT},staticDOMMode:'normal-static-document-no-program-execution',programsExecuted:false}
}
export function readPublisher(html,url){
 const doc=document(html),model=readJSONLD(doc,'Organization'),kind=url===HOME?'home':'careers',styles=verifyStyles(doc,kind)
 need(model.name===COMPANY&&model.url?.replace(/\/$/,'')===HOME.slice(0,-1),'native own organization identity differs')
 need(model.potentialAction?.target===url,'native organization page target differs')
 need(Array.isArray(model.address)&&model.address.length>0&&model.address.length<=50,'missing own office-country relations')
 for(const a of model.address)need(object(a)&&a['@type']==='PostalAddress'&&typeof a.addressCountry==='string'&&norm(a.addressCountry)&&typeof a.addressLocality==='string'&&norm(a.addressLocality),'unreviewed own postal country relation')
 if(url===HOME)need(doc.nodes(n=>n.tag==='a'&&n.attrs.href&&new URL(n.attrs.href,HOME).href===CAREERS&&norm(flow(n))==='Careers at Great Learning').length>0,'current active own careers handoff missing')
 return{model,styles,url}
}
export function reconcilePublisher(home,careers){
 const withoutTarget=p=>({...p.model,potentialAction:{...p.model.potentialAction,target:'<current-own-page>'}})
 need(isDeepStrictEqual(withoutTarget(home),withoutTarget(careers)),'home and careers whole employer models disagree')
}
export function declaredRoleURL(value){
 let url;try{url=new URL(value,CAREERS)}catch{throw failure('invalid native role URL')}
 need(url.origin===HOME.slice(0,-1)&&/^\/careers\/[^/]+\/[^/]+\/?$/.test(url.pathname)&&!url.username&&!url.password&&!url.search&&!url.hash,'unreviewed native role URL');return url.href
}
export function applicationURL(value){
 let url;try{url=new URL(value)}catch{throw failure('invalid native application declaration')}
 need(url.protocol==='https:'&&!url.username&&!url.password&&((url.hostname==='forms.gle'&&/^\/[^/]+$/.test(url.pathname))||(url.hostname==='docs.google.com'&&url.pathname.startsWith('/forms/'))),'unreviewed native application declaration');return url.href
}
export function readIndex(html){
 const doc=document(html),list=byClass(doc,'career-openings__list'),nodes=within(list,n=>cls(n,'career-openings__item'))
 need(nodes.length>0&&nodes.length<=100,'missing or excessive native role cards')
 const cards=nodes.map(node=>{
  const title=norm(flow(childByClass(node,'job-position'))),nativeLocation=norm(flow(childByClass(node,'location-name'))),link=childByClass(node,'job-location'),description=childByClass(node,'job-details'),qualifications=childByClass(node,'job-qualifications')
  need(link.tag==='a'&&title&&nativeLocation&&norm(flow(description))&&norm(flow(qualifications)),'incomplete native card')
  return{title,nativeLocation,url:declaredRoleURL(link.attrs.href),applyURL:applicationURL(node.attrs['data-job-link']),description:norm(flow(description)),qualifications:norm(flow(qualifications)),tree:snapshot(node)}
 })
 need(new Set(cards.map(c=>c.url)).size===cards.length&&new Set(cards.map(c=>c.title)).size===cards.length,'duplicate native publishing identity');return{cards,reportedTotal:null}
}
export const verifyCSS=bytes=>need(sha(bytes)===CSS_CONTRACT.sha256,'declared stylesheet contract changed')
export {CSS_CONTRACT}
