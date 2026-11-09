// Electrifex has server-rendered Bootstrap panels. Hidden content and executable
// clients require separate projections: hidden/inert ancestors do not suppress JS.
import {applyNativeStyles} from './nativeCss.js'
export const decode=value=>String(value??'').replace(/&#x([\da-f]+);/gi,(_,v)=>String.fromCodePoint(parseInt(v,16)))
  .replace(/&#(\d+);/g,(_,v)=>String.fromCodePoint(Number(v)))
  .replace(/&(amp|quot|apos|nbsp|lt|gt|ndash|mdash|hellip);/g,(_,v)=>({amp:'&',quot:'"',apos:"'",nbsp:' ',lt:'<',gt:'>',ndash:'–',mdash:'—',hellip:'…'})[v])
export const norm=value=>decode(value).replace(/\s+/g,' ').trim()
export const hasClass=(node,name)=>(node.attrs.class||'').split(/\s+/).includes(name)
const rawTags=new Set(['script','style','textarea','title','xmp','iframe','noembed','noframes','plaintext','noscript'])
const inertTags=new Set(['template','noscript','object','textarea','xmp','iframe','noembed','noframes','plaintext'])
const voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'])
const children=node=>node.children.filter(value=>typeof value!=='string')
const rawWalk=(node,predicate)=>[...(predicate(node)?[node]:[]),...children(node).flatMap(child=>rawWalk(child,predicate))]
export const descendants=(node,predicate)=>node.hidden||node.inert?[]:[...(predicate(node)?[node]:[]),...children(node).flatMap(child=>descendants(child,predicate))]
export const text=node=>{
  if(!node||node.hidden||node.inert||['script','style'].includes(node.tag))return ''
  if(node.tag==='br')return '\n'
  return decode(node.children.map(value=>typeof value==='string'?value:text(value)).join(''))
    .replace(/[\t ]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim()
}
export const readElectrifexHtml=(input,styleOptions={})=>{
  const html=String(input),root={tag:'root',attrs:{},children:[],inert:false,hidden:false},stack=[root]
  const tags=/<!--[\s\S]*?(?:-->|$)|<![^>]*>|<\/?([a-z][\w:-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi
  let cursor=0,m
  while((m=tags.exec(html))){
    const parent=stack.at(-1)
    if(m.index>cursor)parent.children.push(html.slice(cursor,m.index));cursor=tags.lastIndex
    if(!m[1])continue
    const tag=m[1].toLowerCase()
    if(m[0].startsWith('</')){const index=stack.findLastIndex(n=>n.tag===tag),boundary=stack.findLastIndex(n=>n.tag==='template');if(index>0&&index>=boundary)stack.length=index;continue}
    const attrs={},duplicates=[]
    for(const a of m[2].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)){
      const name=a[1].toLowerCase();if(Object.hasOwn(attrs,name))duplicates.push(name);else attrs[name]=decode(a[2]??a[3]??a[4]??'')
    }
    const node={tag,attrs,duplicates,children:[],parent,inert:parent.inert||inertTags.has(tag),hidden:false}
    parent.children.push(node)
    if(rawTags.has(tag)){
      const end=tag==='plaintext'?null:new RegExp(`</${tag}\\s*>`,'ig');if(end)end.lastIndex=cursor
      const closing=end?.exec(html);node.raw=html.slice(cursor,closing?.index??html.length)
      cursor=closing?end.lastIndex:html.length;tags.lastIndex=cursor
    }else if(!voids.has(tag))stack.push(node)
  }
  if(cursor<html.length)stack.at(-1).children.push(html.slice(cursor))
  const executionWalk=(node,predicate)=>node.inert?[]:[...(predicate(node)?[node]:[]),...children(node).flatMap(child=>executionWalk(child,predicate))]
  const executionNodes=predicate=>executionWalk(root,predicate)
  const visibility=applyNativeStyles(root,{...styleOptions,executionNodes})
  return {root,nodes:predicate=>descendants(root,predicate),executionNodes,rawNodes:predicate=>rawWalk(root,predicate),text,visibility}
}
