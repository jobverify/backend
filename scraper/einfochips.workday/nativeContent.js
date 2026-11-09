import {hasSourceDescription} from '../../src/utils/jobSourceContent.js'
const requireContent=(ok,message)=>{if(!ok)throw new Error('eInfochips native content: '+message)}
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
      if (at > 0 && at >= templateBoundary) stack.length = at
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
    const hidden=Object.hasOwn(attrs,'hidden')||attrs['aria-hidden']?.toLowerCase()==='true'||/(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|content-visibility\s*:\s*hidden)\s*(?:!important\s*)?(?:;|$)/i.test(style)
    const node = {tag,attrs,children:[],inert:parent.inert || hidden || tag === 'template' || (raw.has(tag) && !['script','title'].includes(tag))}
    parent.children.push(node)
    if (raw.has(tag)) {
      const end = tag === 'plaintext' ? null : new RegExp(`</${tag}\\s*>`, 'ig')
      if (end) end.lastIndex = cursor
      const closing = end?.exec(html)
      node.raw = html.slice(cursor, closing?.index ?? html.length)
      cursor = closing ? end.lastIndex : html.length
      tags.lastIndex = cursor
    } else if (!voids.has(tag)) stack.push(node)
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
export function workdaySections(html){
 const tree=dom(html),sections={},known=new Set(['position:','job description:','location:','time type:','job category:']);let current=null
 for(const node of tree.children){
  if(typeof node!=='string'&&node.inert)continue
  const heading=typeof node!=='string'&&node.tag==='h1'?text(node).toLowerCase():null
  if(heading&&known.has(heading)){requireContent(!Object.hasOwn(sections,heading),'Duplicate native field heading');current=heading;sections[current]=[];continue}
  if(current)sections[current].push(typeof node==='string'?norm(node):text(node))
 }
 for(const key of ['position:','job description:','location:'])requireContent(Object.hasOwn(sections,key),'Missing native field '+key)
 return Object.fromEntries(Object.entries(sections).map(([k,v])=>[k,norm(v.join(' '))]))
}
export function activeArrowModel(html){
 const models=[]
 for(const script of activeScripts(html)){
  for(let cursor=0;cursor<script.length;cursor++){
  const token=script[cursor]
  if(script.startsWith('//',cursor)){const end=script.indexOf('\n',cursor+2);cursor=end<0?script.length:end;continue}
  if(script.startsWith('/*',cursor)){const end=script.indexOf('*/',cursor+2);cursor=end<0?script.length:end+1;continue}
  if(['"',"'",'`'].includes(token)){const quote=token;for(cursor++;cursor<script.length;cursor++){if(script[cursor]==='\\')cursor++;else if(script[cursor]===quote)break}continue}
  const start=script.slice(cursor).match(/^phApp\.ddo\s*=\s*(?=\{)/);if(!start||cursor>0&&/[\w$.]/.test(script[cursor-1]))continue
  const offset=cursor+start[0].length;let depth=0,quote=false,escape=false,end=-1
  for(let i=offset;i<script.length;i++){const c=script[i];if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quote=false;continue}if(c==='"')quote=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0){end=i+1;break}}
  requireContent(end>offset,'Malformed native Arrow model');models.push(JSON.parse(script.slice(offset,end)))
  cursor=end-1
  }
 }
 requireContent(models.length===1,'Expected one active Arrow model');return models[0]
}
