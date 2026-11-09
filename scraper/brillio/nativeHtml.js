// Source-local HTML reader. Attribute references are resolved once; raw CSS and
// script bodies are never entity decoded. Unknown visibility keeps the text and
// prevents the caller from claiming a complete description.
export const decode = value => String(value ?? '').replace(/&(?:#(x[\da-f]+|\d+)|([a-z]+));/gi,(entity,code,name)=>{
 if(code){const n=code[0].toLowerCase()==='x'?parseInt(code.slice(1),16):Number(code);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'\ufffd'}
 return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'–',mdash:'—',rsquo:'’',lsquo:'‘',ldquo:'“',rdquo:'”',hellip:'…'})[name.toLowerCase()]??entity
})
export const norm = value => String(value??'').replace(/[\u2012-\u2015]/g,'-').replace(/\s+/g,' ').trim()||null
export const hasClass=(node,name)=>(node?.attrs?.class||'').split(/\s+/).includes(name)
const rawTags=new Set(['script','style','textarea','title','xmp','iframe','noembed','noframes','plaintext','noscript'])
const inertTags=new Set(['template','object','canvas','iframe','noscript','textarea','xmp','noembed','noframes','plaintext','head'])
const voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'])
const styleState=value=>{
 let hidden=false,uncertain=false
 for(const declaration of String(value||'').replace(/\/\*[\s\S]*?\*\//g,'').split(';')){
  const at=declaration.indexOf(':');if(at<0){if(declaration.trim())uncertain=true;continue}
  const property=declaration.slice(0,at).trim().toLowerCase(),v=declaration.slice(at+1).replace(/\s*!important\s*$/i,'').trim().toLowerCase()
  if(/\\/.test(property+v)){uncertain=true;continue}
  if(property==='display'){if(v==='none')hidden=true;else if(!/^(block|inline|inline-block|flex|inline-flex|grid|inline-grid|contents|table|table-row|table-cell|list-item|flow-root|inherit|initial|unset)$/.test(v))uncertain=true}
  if(['visibility','content-visibility'].includes(property)){if(['hidden','collapse'].includes(v))hidden=true;else if(!['visible','auto','inherit','initial','unset'].includes(v))uncertain=true}
  if(property==='opacity'){if(/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?%?$/.test(v)){if(Number(v.replace(/%$/,''))===0)hidden=true}else uncertain=true}
  if(/^(clip|clip-path|mask|filter|transform)$/.test(property)&&v!=='none')uncertain=true
 }
 return{hidden,uncertain}
}
const simpleMatch=(node,selector)=>{
 if(!/^(?:[a-z][\w-]*|\*)?(?:[.#][\w-]+|\[[\w-]+(?:\s*=\s*(?:"[^"\]]*"|'[^'\]]*'|[^\s\]]+))?\])*$/i.test(selector))return null
 const tag=selector.match(/^[a-z][\w-]*/i)?.[0]
 if(tag&&node.tag!==tag.toLowerCase())return false
 if([...selector.matchAll(/\.([\w-]+)/g)].some(m=>!hasClass(node,m[1])))return false
 if([...selector.matchAll(/#([\w-]+)/g)].some(m=>node.attrs.id!==m[1]))return false
 for(const m of selector.matchAll(/\[([\w-]+)(?:\s*=\s*(?:"([^"\]]*)"|'([^'\]]*)'|([^\s\]]+)))?\]/g)){
  if(!Object.hasOwn(node.attrs,m[1]))return false
  const value=m[2]??m[3]??m[4];if(value!==undefined&&node.attrs[m[1]]!==value)return false
 }
 return true
}
const selectorMatches=(node,selector)=>{
 const parts=selector.trim().split(/\s+/);let current=node
 for(let i=parts.length-1;i>=0;i--){
  if(i===parts.length-1){const result=simpleMatch(current,parts[i]);if(result!==true)return result}
  else{current=current.parent;while(current&&simpleMatch(current,parts[i])===false)current=current.parent;if(!current)return false;if(simpleMatch(current,parts[i])===null)return null}
 }
 return true
}
export const readHtml=input=>{
 const html=String(input??''),root={tag:'root',attrs:{},children:[]},stack=[root],nodes=[root]
 const tags=/<!--[\s\S]*?(?:-->|$)|<![^>]*>|<\/?([a-z][\w:-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi
 let cursor=0,m
 while((m=tags.exec(html))){
  if(m.index>cursor)stack.at(-1).children.push(decode(html.slice(cursor,m.index)))
  cursor=tags.lastIndex;if(!m[1])continue
  const tag=m[1].toLowerCase()
  if(m[0].startsWith('</')){const at=stack.findLastIndex(n=>n.tag===tag);if(at>0)stack.length=at;continue}
  const attrs={};for(const a of m[2].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)){const key=a[1].toLowerCase();if(!Object.hasOwn(attrs,key))attrs[key]=decode(a[2]??a[3]??a[4]??'')}
  const state=styleState(attrs.style),node={tag,attrs,children:[],parent:stack.at(-1),ownHidden:inertTags.has(tag)||Object.hasOwn(attrs,'hidden')||Object.hasOwn(attrs,'inert')||attrs['aria-hidden']?.trim().toLowerCase()==='true'||state.hidden,uncertain:state.uncertain}
  node.parent.children.push(node);nodes.push(node)
  if(rawTags.has(tag)){
   const end=tag==='plaintext'?null:new RegExp(`</${tag}\\s*>`,'gi');if(end)end.lastIndex=cursor;const close=end?.exec(html)
   node.raw=html.slice(cursor,close?.index??html.length);cursor=close?end.lastIndex:html.length;tags.lastIndex=cursor
  }else if(!voids.has(tag))stack.push(node)
 }
 if(cursor<html.length)stack.at(-1).children.push(decode(html.slice(cursor)))
 const rules=nodes.filter(n=>n.tag==='style').flatMap(n=>[...String(n.raw).replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap(([,selectors,body])=>{const state=styleState(body);return state.hidden||state.uncertain?selectors.split(',').map(selector=>({selector:selector.trim(),...state})):[]}))
 for(const node of nodes){for(const rule of rules){const result=selectorMatches(node,rule.selector);if(result===true){node.ownHidden ||= rule.hidden;node.uncertain ||= rule.uncertain}else if(result===null&&rule.selector.includes('.')){const lastClass=[...rule.selector.matchAll(/\.([\w-]+)/g)].at(-1)?.[1];if(lastClass&&hasClass(node,lastClass))node.uncertain=true}}node.hidden=node.parent?.hidden||node.ownHidden||false;node.uncertain ||=node.parent?.uncertain||false}
 const descendants=(node,predicate,{includeHidden=false}={})=>nodes.filter(n=>n!==root&&(includeHidden||!n.hidden)&&predicate(n)&&within(node,n))
 const text=(node,{exclude=()=>false}={})=>{
  const chunks=[];const visit=n=>{if(typeof n==='string'){chunks.push(n);return}if(n.hidden||['script','style','title','meta','link'].includes(n.tag)||exclude(n))return;for(const c of n.children){visit(c);chunks.push(' ')}}
  if(node)visit(node);return norm(chunks.join(''))
 }
 return{root,nodes,find:(predicate,options)=>descendants(root,predicate,options),within:(node,predicate,options)=>descendants(node,predicate,options),text}
}
export const within=(root,node)=>root===node||Boolean(node?.parent&&within(root,node.parent))
