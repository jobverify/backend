import {readNativeDocument,decodeNativeEntities} from '../utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../utils/visibleNativeHtml.js'
export const clean=value=>String(value??'').replace(/\s+/g,' ').trim()
export const descendants=(node,predicate)=>node.inert?[]:[...(predicate(node)?[node]:[]),...node.children.filter(child=>typeof child!=='string').flatMap(child=>descendants(child,predicate))]
export const retained=(node,predicate)=>['template','object','iframe','noscript'].includes(node.tag)?[]:[...(predicate(node)?[node]:[]),...node.children.filter(child=>typeof child!=='string').flatMap(child=>retained(child,predicate))]
export const nativeText=node=>node.inert||['script','style'].includes(node.tag)?'':node.children.map(child=>typeof child==='string'?decodeNativeEntities(child):nativeText(child)).join(' ')
const lineText=node=>{
 if(node.inert||['script','style'].includes(node.tag))return ''
 const text=node.children.map(child=>typeof child==='string'?decodeNativeEntities(child):lineText(child)).join('')
 return /^(?:p|div|li|ul|ol|h[1-6]|br|section|a)$/.test(node.tag)?'\n'+text+'\n':text
}
export const nativeLines=node=>lineText(node).split(/\r?\n/).map(clean).filter(Boolean)
// Authored criteria may include supplemental native hidden copy. Callers must
// qualify its owning role separately; this never grants identity/country proof.
const authoredText=node=>{
 if(['script','style','template','object','iframe','noscript'].includes(node.tag))return ''
 const text=node.children.map(child=>typeof child==='string'?decodeNativeEntities(child):authoredText(child)).join('')
 return /^(?:p|div|li|ul|ol|h[1-6]|br|section|a)$/.test(node.tag)?'\n'+text+'\n':text
}
export const authoredNativeLines=node=>authoredText(node).split(/\r?\n/).map(clean).filter(Boolean)
// Hidden/inert elements and object fallback remain in document base scope.
// HTML template contents are separate; foreign template/integration contents
// are conservatively retained rather than granting an unreviewed base URL.
const documentBaseNodes=(node,foreign=false)=>{
 foreign ||=node.tag==='svg'||node.tag==='math'
 return [...(node.tag==='base'?[node]:[]),...(node.tag==='template'&&!foreign?[]:
  node.children.filter(child=>typeof child!=='string').flatMap(child=>documentBaseNodes(child,foreign)))]
}

export const comparable=value=>clean(value).replace(/\s/g,'')
export const requireNative=(value,message,failure)=>{if(!value)throw failure(message)}
export const exactlyOne=(rows,label,failure)=>{requireNative(rows.length===1,'Missing or ambiguous '+label,failure);return rows[0]}
export function qualifiedFirstPartyHTML(html,url,failure){
 requireNative(typeof html==='string'&&html.length>0,'Missing original HTML',failure)
 const raw=readNativeDocument(html),root=exactlyOne(raw.nodes(node=>node.tag==='root'),'document root',failure)
 requireNative(documentBaseNodes(root).length===0,'Unreviewed document base',failure)
 const documentHTML=exactlyOne(root.children.filter(node=>typeof node!=='string'&&node.tag==='html'),'retained HTML document',failure)
 const head=exactlyOne(retained(root,node=>node.tag==='head'),'retained head',failure)
 const body=exactlyOne(retained(root,node=>node.tag==='body'),'retained body',failure)
 requireNative(documentHTML.children.includes(head)&&documentHTML.children.includes(body),'Head/body is outside its document',failure)
 const canonical=exactlyOne(retained(head,node=>node.tag==='link'&&(node.attrs.rel||'').toLowerCase()==='canonical'),'retained canonical',failure)
 requireNative(canonical.attrs.href===url,'Canonical identity changed',failure)
 const title=exactlyOne(retained(head,node=>node.tag==='title'),'retained page title',failure)
 requireNative(head.children.includes(title),'Page title is outside its document head',failure)
 const visible=readVisibleNativeDocument(html,{strict:true})
 requireNative(visible.nodes(node=>node.tag==='body').length===1,'Active document body unavailable',failure)
 return {raw,root,head,body,visible,title:clean(decodeNativeEntities(title.raw))}
}
