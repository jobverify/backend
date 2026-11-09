import {isDeepStrictEqual} from 'node:util'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {decodeNativeEntities,readNativeAttributeTokens,readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {failure,need} from './currentErrors.js'
export const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
export const cls=(node,name)=>(node.attrs.class||'').split(/[\t\n\f\r ]+/).includes(name)
export const all=node=>typeof node==='string'?[]:[node,...node.children.flatMap(all)]
export const within=(node,predicate)=>all(node).filter(n=>!n.inert&&predicate(n))
export const one=(nodes,label)=>{need(nodes.length===1,'expected one '+label);return nodes[0]}
// The shared compatibility decoder collapses named nbsp to an ordinary space.
// Native whole-tree evidence must retain the publisher's actual U+00A0 text.
const decode=value=>{try{return decodeNativeEntities(String(value).replaceAll('&nbsp;','&#160;'))}catch(error){throw failure('HTML text: '+error.message)}}
const block=new Set(['div','section','p','blockquote','ul','ol','li','h1','h2','h3','h4','h5','h6','br'])
export const flow=node=>typeof node==='string'?decode(node):node.inert||['script','style'].includes(node.tag)?'':(block.has(node.tag)?'\n':'')+node.children.map(flow).join('')+(block.has(node.tag)?'\n':'')
export const snapshot=node=>typeof node==='string'?decode(node):{tag:node.tag,attrs:{...node.attrs},children:node.children.map(snapshot)}
export function document(html){try{return readVisibleNativeDocument(html,{strict:true})}catch(error){throw failure('HTML contract: '+error.message)}}
export const byClass=(doc,name)=>one(doc.nodes(n=>cls(n,name)),name)
export const childByClass=(node,name)=>one(within(node,n=>cls(n,name)),name)
// Preserve the literal inner HTML after validating its unique native boundary.
// The semantic tree must equal the active source subtree, so a comment/raw-text
// lookalike or malformed balancing cannot silently widen the description.
export function originalInner(html,node){
 const tag=node.tag,pattern=new RegExp('<'+tag+'\\b((?:[^"\'<>]|"[^"]*"|\'[^\']*\')*)>','gi'),starts=[];let m
 while((m=pattern.exec(html))){const attrs={};for(const[k,v]of readNativeAttributeTokens(m[1]))if(!Object.hasOwn(attrs,k))attrs[k]=decode(v)
  if(isDeepStrictEqual(attrs,node.attrs))starts.push({start:m.index,end:pattern.lastIndex})
 }
 const start=one(starts,'literal '+tag+' criteria boundary'),tags=new RegExp('<\\/?'+tag+'\\b(?:[^"\'<>]|"[^"]*"|\'[^\']*\')*>','gi');tags.lastIndex=start.end;let depth=1,end
 while((m=tags.exec(html))){depth+=m[0].startsWith('</')?-1:1;if(depth===0){end=m.index;break}}
 need(end!==undefined,'incomplete literal criteria boundary');const inner=html.slice(start.end,end)
 let parsed;try{parsed=one(readNativeDocument(inner).nodes(n=>n.tag==='root'),'criteria fragment')}catch(error){throw failure('literal criteria fragment: '+error.message)}
 need(isDeepStrictEqual(parsed.children.map(snapshot),node.children.map(snapshot)),'literal and active whole criteria boundaries differ');return inner
}
