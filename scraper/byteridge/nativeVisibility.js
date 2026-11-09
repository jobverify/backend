import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

// Conservative author-CSS visibility projection for the reviewed public
// documents. A hidden matching ancestor cannot supply delegation or role proof.
// Media/state-dependent hiding is treated as uncertain and excluded as well.
const hiddenDeclaration = body => /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|content-visibility\s*:\s*hidden|opacity\s*:\s*(?:0(?:\.0*)?|\.0+))\s*(?:!important\s*)?(?:;|$)/i.test(String(body??'').replace(/\/\*[\s\S]*?\*\//g,''))
const simpleMatches = (node, selector) => {
  if (!selector || /::(?:before|after|first-letter|first-line)|:(?:before|after)\b/i.test(selector)) return false
  let rejected = false
  selector = selector.replace(/:not\(([^()]*)\)/g, (_, inner) => { if (inner.split(',').some(part => simpleMatches(node,part.trim()))) rejected=true; return '' })
  if(rejected) return false
  selector = selector.replace(/\[([\w:-]+)(?:\s*([~|^$*]?=)\s*["']?([^\]"']*)["']?)?\]/g, (_, key, operator, value) => {
    const actual=node.attrs[key.toLowerCase()]
    const matches=actual!=null&&(!operator||operator==='='&&actual===value||operator==='~='&&actual.split(/\s+/).includes(value)||operator==='^='&&actual.startsWith(value)||operator==='$='&&actual.endsWith(value)||operator==='*='&&actual.includes(value)||operator==='|='&&(actual===value||actual.startsWith(value+'-')))
    if(!matches)rejected=true
    return ''
  })
  if(rejected) return false
  // A dynamic state can hide the node for a reader. Ignore its state predicate
  // conservatively, while keeping the type/class/id requirements.
  selector=selector.replace(/:[\w-]+(?:\([^)]*\))?/g,'')
  const tag=/^[a-z][\w-]*/i.exec(selector)?.[0]
  if(tag&&tag.toLowerCase()!==node.tag)return false
  for(const match of selector.matchAll(/([.#])([\w-]+)/g)) {
    if(match[1]==='#'&&node.attrs.id!==match[2])return false
    if(match[1]==='.'&&!(node.attrs.class||'').split(/\s+/).includes(match[2]))return false
  }
  return Boolean(tag||selector.includes('*')||/[.#]/.test(selector)||selector.trim()==='')
}
const selectorMatches = (node,selector,parents) => {
  const parts=selector.trim().replace(/\s*([>+~])\s*/g,'$1').match(/[^\s>+~]+|[>+~]/g)||[]
  const visit=(current,index)=>{
    if(!current||index<0||!simpleMatches(current,parts[index]))return false
    if(index===0)return true
    const previous=parts[index-1]
    if(previous==='>')return visit(parents.get(current),index-2)
    if(previous==='+'||previous==='~') {
      const parent=parents.get(current),siblings=parent?.children.filter(child=>typeof child!=='string')||[],at=siblings.indexOf(current)
      if(previous==='+')return visit(siblings[at-1],index-2)
      return siblings.slice(0,at).some(sibling=>visit(sibling,index-2))
    }
    for(let ancestor=parents.get(current);ancestor;ancestor=parents.get(ancestor))if(visit(ancestor,index-1))return true
    return false
  }
  return visit(node,parts.length-1)
}
export function projectAuthorVisibility(doc,html) {
  const root=doc.nodes(n=>n.tag==='root')[0],parents=new WeakMap(),nodes=[]
  const collect=node=>{nodes.push(node);for(const child of node.children||[])if(typeof child!=='string'){parents.set(child,node);collect(child)}}
  collect(root)
  const selectors=[]
  for(const style of String(html).matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    const css=style[1].replace(/\/\*[\s\S]*?\*\//g,'')
    for(const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g))if(hiddenDeclaration(rule[2]))selectors.push(...rule[1].split(',').map(s=>s.trim()).filter(s=>s&&!s.startsWith('@')))
  }
  const hide=node=>{node.cssHidden=true;node.inert=true;node.activeFrame=false;for(const child of node.children||[])if(typeof child!=='string')hide(child)}
  // The HTML parser has already decoded entities and parsed quoted/unquoted
  // attributes. Evaluate those values instead of rewriting raw opening tags.
  for(const node of nodes)if(hiddenDeclaration(node.attrs.style)||selectors.some(selector=>selectorMatches(node,selector,parents)))hide(node)
  return doc
}
export function projectedFrameContexts(doc) {
  const root=doc.nodes(n=>n.tag==='root')[0],frames=[]
  const visit=node=>{
    if(node.cssHidden)return
    if(node.activeFrame){frames.push({hasSrc:Object.hasOwn(node.attrs,'src'),src:node.attrs.src??null,hasSrcdoc:Object.hasOwn(node.attrs,'srcdoc'),srcdoc:node.attrs.srcdoc??null});return}
    if(node.inert)return
    for(const child of node.children||[])if(typeof child!=='string')visit(child)
  }
  visit(root)
  return frames
}
export const projectedIframeSources = doc => projectedFrameContexts(doc).filter(frame=>!frame.hasSrcdoc&&typeof frame.src==='string'&&frame.src.trim()).map(frame=>frame.src)

export function executableDocument(html) {
  const root=readNativeDocument(html).nodes(n=>n.tag==='root')[0],nodes=[]
  const parserInert=new Set(['template','noscript','iframe','object','textarea','title','xmp','noembed','noframes','plaintext'])
  const visit=node=>{
    // Presentation and the inert attribute do not disable JavaScript. Actual
    // parser-inert templates/raw fallback bodies cannot activate child clients.
    if(parserInert.has(node.tag))return
    nodes.push(node)
    for(const child of node.children||[])if(typeof child!=='string')visit(child)
  }
  visit(root)
  return {nodes:predicate=>nodes.filter(predicate)}
}
