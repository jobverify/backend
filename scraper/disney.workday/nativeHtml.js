import {hasSourceDescription} from '../../src/utils/jobSourceContent.js'
const requireContent=(ok,message)=>{if(!ok)throw new Error('Disney native content: '+message)}
const decode = value => String(value ?? '').replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&(amp|quot|apos|nbsp|lt|gt|ndash|mdash|hellip);/g, (_, n) => ({amp:'&',quot:'"',apos:"'",nbsp:' ',lt:'<',gt:'>',ndash:'–',mdash:'—',hellip:'…'})[n])
const norm = value => decode(value).replace(/\s+/g, ' ').trim()

// Small source-local tree reader: exact attributes, active elements only, and raw
// script bodies kept separately. Inert markup cannot supply a title or full JD.
const dom = input => {
  const html = String(input), root = {tag:'root', attrs:{}, children:[]}, stack = [root]
  const raw = new Set(['script','style','textarea','title','xmp','iframe','noembed','noframes','plaintext','noscript'])
  const voids = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'])
  const tags = /<!--[\s\S]*?(?:-->|$)|<![^>]*>|<\/?([a-z][a-z0-9:_-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi
  let cursor = 0, match
  while ((match = tags.exec(html))) {
    const parent = stack.at(-1)
    if (match.index > cursor) parent.children.push(html.slice(cursor, match.index))
    cursor = tags.lastIndex
    if (!match[1]) continue
    const tag = match[1].toLowerCase()
    if (match[0].startsWith('</')) {
      const at = stack.findLastIndex(node => node.tag === tag)
      const templateBoundary = stack.findLastIndex(node => node.tag === 'template')
      if (at > 0 && at >= templateBoundary) {
        for (const closingNode of stack.slice(at)) closingNode.end=cursor
        stack.length = at
      }
      continue
    }
    // Keep visibility attributes while ignoring irrelevant Word presentation
    // attributes. HTML keeps the first duplicate attribute; meta identity stays
    // stricter because duplicate identity fields are ambiguous evidence.
    const attrs = {}
    for(const a of match[2].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)){
      const key=a[1].toLowerCase()
      if(tag==='meta')requireContent(!Object.hasOwn(attrs,key),'Duplicate native meta attribute')
      if(!Object.hasOwn(attrs,key))attrs[key]=decode(a[2]??a[3]??a[4]??'')
    }
    const style=(attrs.style||'').replace(/\/\*[\s\S]*?\*\//g,'')
    const collapsedCountryOptions=tag==='ul'&&(attrs.class||'').split(/\s+/).includes('search-filter-list')&&parent.tag==='section'&&parent.attrs.id==='country-filters-section'&&parent.attrs['data-expandable']==='true'&&parent.attrs['data-enabled']==='true'
    const hidden=Object.hasOwn(attrs,'hidden')||(!collapsedCountryOptions&&attrs['aria-hidden']?.toLowerCase()==='true')||/(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|content-visibility\s*:\s*hidden)\s*(?:!important\s*)?(?:;|$)/i.test(style)
    const node = {tag,attrs,children:[],start:match.index,end:html.length,inert:parent.inert || hidden || Object.hasOwn(attrs,'inert') || tag === 'template' || (raw.has(tag) && !['script','title'].includes(tag))}
    parent.children.push(node)
    if (raw.has(tag)) {
      const end = tag === 'plaintext' ? null : new RegExp(`</${tag}\\s*>`, 'ig')
      if (end) end.lastIndex = cursor
      const closing = end?.exec(html)
      node.raw = html.slice(cursor, closing?.index ?? html.length)
      cursor = closing ? end.lastIndex : html.length
      node.end=cursor
      tags.lastIndex = cursor
    } else if (!voids.has(tag)) stack.push(node)
    else node.end=cursor
  }
  if (cursor < html.length) stack.at(-1).children.push(html.slice(cursor))
  return root
}
const all = (node, predicate) => node.inert ? [] : [ ...(predicate(node) ? [node] : []), ...node.children.filter(child => typeof child !== 'string').flatMap(child => all(child, predicate)) ]
const text = node => node.inert || node.tag === 'script' ? '' : norm(node.children.map(child => typeof child === 'string' ? child : text(child)).join(' '))
const cls = (node, value) => (node.attrs.class || '').split(/\s+/).includes(value)
const one = (nodes, label) => { requireContent(nodes.length === 1, `Expected one ${label}`); return nodes[0] }

export const extractActiveDescription = value => {
 if(typeof value!=='string'||!hasSourceDescription({sourceDescription:value}))return null
 const content=text(dom(value))
 return content && !/^(?:jd|tbd|n\/a|na|none|null|attached|see\s+(?:the\s+)?(?:attachment|attached)|(?:jd|job\s+description)\s+attached|job\s+description)[.!:]?$/i.test(content)?content:null
}

export const activeHead = html => {const tree=dom(html);return {titles:all(tree,n=>n.tag==='title').map(n=>norm(n.raw)),metas:all(tree,n=>n.tag==='meta').map(n=>n.attrs)}}
export const activeScripts = html => all(dom(html),n=>n.tag==='script'&&!n.attrs.src).map(n=>n.raw||'')

export const readNativeDocument=html=>{const root=dom(html);return{nodes:predicate=>all(root,predicate),text,hasClass:cls}}

export const decodeNativeHtml=decode

export const nativeDescendants=(node,predicate)=>all(node,predicate)
// Qualification keeps native block boundaries; published text still uses text().
export const nativeTextBlocks=node=>{
 const blocks=new Set(['address','article','aside','blockquote','dd','div','dl','dt','figcaption','figure','footer','h1','h2','h3','h4','h5','h6','header','hr','li','main','nav','ol','p','pre','section','table','tbody','td','th','thead','tr','ul','br'])
 const visit=n=>{
  if(n.inert||n.tag==='script')return''
  const value=n.children.map(child=>typeof child==='string'?norm(child):visit(child)).join(' ')
  return blocks.has(n.tag)?'\n'+value+'\n':value
 }
 return visit(node).split(/\n+/).map(norm).filter(Boolean)
}
// Evidence-only traversal may preserve rejected inactive native markup. It is
// never used to qualify a title, binding, application or publishable full JD.
export const nativeEvidenceDescendants=(node,predicate)=>[
 ...(predicate(node)?[node]:[]),
 ...node.children.filter(child=>typeof child!=='string').flatMap(child=>nativeEvidenceDescendants(child,predicate)),
]
