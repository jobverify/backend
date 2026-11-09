import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {need,failure} from './currentErrors.js'
import {literalRanges} from './currentLiteralRanges.js'
export const norm=v=>String(v??'').replace(/\s+/g,' ').trim()
const entities={bull:'•',lsquo:'‘',rsquo:'’',ldquo:'“',rdquo:'”',raquo:'»',laquo:'«',copy:'©',reg:'®',trade:'™'}
export const decode=v=>decodeNativeEntities(String(v).replaceAll('&nbsp;','&#160;').replace(/&(bull|lsquo|rsquo|ldquo|rdquo|raquo|laquo|copy|reg|trade);/g,(_,key)=>entities[key]))
export const cls=(n,c)=>(n.attrs.class||'').split(/[\t\n\f\r ]+/).includes(c)
export const all=n=>typeof n==='string'?[]:[n,...n.children.flatMap(all)]
export const one=(nodes,label)=>{need(nodes.length===1,'expected one '+label);return nodes[0]}
const blocks=new Set(['div','section','p','ul','ol','li','h1','h2','h3','h4','h5','h6','br','hr','article','aside','main','header','footer','nav','address','blockquote','pre','figure','figcaption','table','caption','thead','tbody','tfoot','tr','th','td','dl','dt','dd','fieldset','legend','details','summary'])
// This is an authored-data projection. Visibility is deliberately not certified.
export const flow=n=>typeof n==='string'?decode(n):['script','style'].includes(n.tag)?'':(blocks.has(n.tag)?'\n':'')+n.children.map(flow).join('')+(blocks.has(n.tag)?'\n':'')
export const snapshot=n=>typeof n==='string'?decode(n):{tag:n.tag,attrs:{...n.attrs},children:n.raw===undefined?n.children.map(snapshot):n.raw?[n.raw]:[]}
export const document=html=>{try{return readNativeDocument(html)}catch(e){throw failure('HTML contract: '+e.message)}}
export function originalInner(html,node){
 const starts=literalRanges(html).filter(range=>range.tag===node.tag&&isDeepStrictEqual(range.attrs,node.attrs))
 need(starts.length<=256,'excessive literal criteria candidates');const expected=node.children.map(snapshot),matches=[]
 for(const start of starts){
  if(start.closeStart===undefined)continue
  const inner=html.slice(start.openEnd,start.closeStart),fragment=one(document(inner).nodes(n=>n.tag==='root'),'criteria fragment');if(isDeepStrictEqual(fragment.children.map(snapshot),expected))matches.push(inner)
 }
 return one(matches,'whole literal criteria boundary matching the active subtree')
}
