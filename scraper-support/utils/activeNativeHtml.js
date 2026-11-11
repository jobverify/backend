import {hasSourceDescription} from '../../src/utils/jobSourceContent.js'
export class ActiveNativeContentError extends Error {
 constructor(message){super('Active native content: '+message);this.name='ActiveNativeContentError'}
}
const requireContent=(ok,message)=>{if(!ok)throw new ActiveNativeContentError(message)}
const decode = value => String(value ?? '').replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&(amp|quot|apos|nbsp|lt|gt|ndash|mdash|hellip);/g, (_, n) => ({amp:'&',quot:'"',apos:"'",nbsp:' ',lt:'<',gt:'>',ndash:'–',mdash:'—',hellip:'…'})[n])
const norm = value => decode(value).replace(/\s+/g, ' ').trim()
export const decodeNativeEntities = decode

// Lexical boundaries only; tree construction, entity decoding and visibility
// retain their existing policies. Never search past a byte to invent a name.
const nativeSpace = char => char !== undefined && /[\t\n\f\r ]/.test(char)
const nativeLower = value => value.replace(/[A-Z]/g, char => char.toLowerCase())
const namespaces = new WeakMap()
const nativeAttributes = (input, start, inTag) => {
  const attributes = []
  let cursor = start
  while (cursor < input.length) {
    if (inTag && input[cursor] === '/' && input[cursor + 1] === '>')
      return { attributes, end: cursor + 2, selfClosing: true }
    if (nativeSpace(input[cursor]) || input[cursor] === '/') { cursor++; continue }
    if (input[cursor] === '>') {
      requireContent(inTag, 'Unexpected native attribute delimiter')
      return { attributes, end: cursor + 1 }
    }
    let name = '', value = ''
    // HTML's before-name state retains this unexpected equals sign in the
    // attribute name; it must not become an ordinary href/id/property/src.
    if (input[cursor] === '=') name += input[cursor++]
    while (cursor < input.length && !nativeSpace(input[cursor]) && !['/', '=', '>'].includes(input[cursor])) name += input[cursor++]
    requireContent(name.length > 0, 'Unsupported native attribute token')
    while (nativeSpace(input[cursor])) cursor++
    if (input[cursor] === '=') {
      cursor++
      while (nativeSpace(input[cursor])) cursor++
      if (input[cursor] === '"' || input[cursor] === "'") {
        const quote = input[cursor++], end = input.indexOf(quote, cursor)
        requireContent(end !== -1, 'Unterminated native attribute value')
        value = input.slice(cursor, end); cursor = end + 1
      } else {
        const first = cursor
        // Quotes, equals signs, slashes and backticks do not start another
        // attribute while reading an unquoted value.
        while (cursor < input.length && !nativeSpace(input[cursor]) && input[cursor] !== '>') cursor++
        value = input.slice(first, cursor)
      }
    }
    attributes.push([nativeLower(name), value])
  }
  requireContent(!inTag, 'Unterminated native tag')
  return { attributes, end: cursor }
}
// Shared with the visible reader's conservative raw-attribute uncertainty
// index. Values are raw here; the existing tree decoder still runs once.
export const readNativeAttributeTokens = source => nativeAttributes(String(source), 0, false).attributes
const nextNativeTag = (html, from) => {
  let index = from
  while ((index = html.indexOf('<', index)) !== -1) {
    if (html.startsWith('<!--', index)) {
      const end = html.indexOf('-->', index + 4)
      return { index, end: end === -1 ? html.length : end + 3 }
    }
    // HTML treats processing-instruction syntax as a bogus comment. Its
    // tag-like contents cannot supply active native identity.
    if (html.startsWith('<?', index)) {
      const end = html.indexOf('>', index + 2)
      return { index, end: end === -1 ? html.length : end + 1 }
    }
    if (html.startsWith('<!', index)) {
      const end = html.indexOf('>', index + 2)
      return { index, end: end === -1 ? html.length : end + 1 }
    }
    let first = index + 1
    const closing = html[first] === '/'
    if (closing) first++
    if (!/[a-z]/i.test(html[first] || '')) { index++; continue }
    let end = first
    while (end < html.length && !nativeSpace(html[end]) && !['/', '>'].includes(html[end])) end++
    const tag = nativeLower(html.slice(first, end))
    // Preserve the entire tag spelling. Unsupported vocabulary is a local
    // unqualified subtree, never a shortened known tag or a whole-page error.
    const qualifiedTag = /^[a-z][a-z0-9:_-]*$/.test(tag)
    const parsed = nativeAttributes(html, end, true)
    return { index, end: parsed.end, tag, closing, qualifiedTag, attributes: parsed.attributes, selfClosing: parsed.selfClosing === true }
  }
  return null
}

// Small source-local tree reader: exact attributes, active elements only, and raw
// script bodies kept separately. Inert markup cannot supply a title or full JD.
const dom = (input, {excludeObjectFallback = true} = {}) => {
  const html = String(input), root = {tag:'root', attrs:{}, children:[]}, stack = [root]
  const raw = new Set(['script','style','textarea','title','xmp','iframe','noembed','noframes','plaintext','noscript'])
  const voids = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'])
  let cursor = 0, search = 0, token
  while ((token = nextNativeTag(html, search))) {
    const parent = stack.at(-1)
    if (token.index > cursor) parent.children.push(html.slice(cursor, token.index))
    cursor = search = token.end
    if (!token.tag) continue
    const tag = token.tag
    if (token.closing) {
      const at = stack.findLastIndex(node => node.tag === tag)
      const templateBoundary = stack.findLastIndex(node => node.tag === 'template')
      if (at > 0 && at >= templateBoundary) stack.length = at
      continue
    }
    const inherited = namespaces.get(parent) || 'html'
    const integration = inherited === 'svg' && ['foreignobject','desc','title'].includes(parent.tag)
    const namespace = tag === 'svg' ? 'svg' : integration ? 'html' : inherited
    // Keep visibility attributes while ignoring irrelevant Word presentation
    // attributes. HTML keeps the first duplicate attribute; meta identity stays
    // stricter because duplicate identity fields are ambiguous evidence.
    const attrs = {}
    for (const [key, value] of token.attributes) {
      if(tag==='meta')requireContent(!Object.hasOwn(attrs,key),'Duplicate native meta attribute')
      if(!Object.hasOwn(attrs,key))attrs[key]=decode(value)
    }
    const style=(attrs.style||'').replace(/\/\*[\s\S]*?\*\//g,'')
    const hidden=Object.hasOwn(attrs,'hidden')||Object.hasOwn(attrs,'inert')||attrs['aria-hidden']?.toLowerCase()==='true'||/(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|content-visibility\s*:\s*hidden)\s*(?:!important\s*)?(?:;|$)/i.test(style)
    const node = {tag,attrs,children:[],activeFrame:tag==='iframe'&&!parent.inert&&!hidden,inert:parent.inert || hidden || !token.qualifiedTag || tag === 'template' || (excludeObjectFallback && tag === 'object') || (raw.has(tag) && !['script','title'].includes(tag)),...(token.qualifiedTag ? {} : {nativeTagUnqualified:true})}
    namespaces.set(node, namespace)
    parent.children.push(node)
    // SVG commonly publishes <title/> in icons. Its self-closing flag ends
    // that foreign element; treating it as an HTML raw-text title swallows
    // the rest of the careers page. HTML non-void self-closing tags retain
    // their existing behavior, including hidden/template boundaries.
    if (namespace === 'svg' && token.selfClosing) continue
    if (raw.has(tag) && !(namespace === 'svg' && tag === 'title')) {
      const end = tag === 'plaintext' ? null : new RegExp(`</${tag}[\\t\\n\\f\\r ]*>`, 'ig')
      if (end) end.lastIndex = cursor
      const closing = end?.exec(html)
      node.raw = html.slice(cursor, closing?.index ?? html.length)
      cursor = closing ? end.lastIndex : html.length
      search = cursor
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
 return content && /[\p{L}\p{N}]/u.test(content) && !/^(?:(?:jd|tbd|n\/a|na|none|null|attached|see\s+(?:the\s+)?(?:attachment|attached)|(?:jd|job\s+description)\s+attached|(?:full\s+)?job\s+description|description|sample|placeholder|apply\s+now|coming\s+soon|read\s+more)[\s.!:\-]*)+$/i.test(content)?content:null
}

export const activeHead = html => {const tree=dom(html);return {titles:all(tree,n=>n.tag==='title'&&namespaces.get(n)!=='svg').map(n=>norm(n.raw)),metas:all(tree,n=>n.tag==='meta').map(n=>n.attrs)}}
export const activeScripts = (html, options) => all(dom(html, options),n=>n.tag==='script'&&!n.attrs.src).map(n=>n.raw||'')

// An active iframe can delegate navigation, while its raw fallback body cannot
// supply visible description text or activate nested frames.
export const activeIframeDeclarations = (html, options) => {
 const frames=node=>node.activeFrame?(Object.hasOwn(node.attrs,'srcdoc')?[]:[node]):node.inert?[]:node.children.filter(child=>typeof child!=='string').flatMap(frames)
 return frames(dom(html, options)).filter(node=>typeof node.attrs.src==='string'&&node.attrs.src.trim()).map(node=>({
  href:node.attrs.src,label:['title','aria-label','name'].map(key=>node.attrs[key]||'').join(' ').trim(),
 }))
}
export const activeIframeSources = (html, options) => activeIframeDeclarations(html,options).map(frame=>frame.href)

export const readNativeDocument=(html,options)=>{const root=dom(html,options);return{nodes:(predicate,subtree=root)=>all(subtree,predicate),text,hasClass:cls}}
