// Non-executing active HTML reader. Exact slices retain authoritative markup.
export const decode = value => String(value ?? '').replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&(amp|quot|apos|nbsp|lt|gt|ndash|mdash|hellip);/g,(_,n)=>({amp:'&',quot:'"',apos:"'",nbsp:' ',lt:'<',gt:'>',ndash:'–',mdash:'—',hellip:'…'})[n])
export const norm = value => decode(value).replace(/\s+/g,' ').trim()
export function document(html) {
 if(typeof html!=='string')throw Error('RMK native HTML unavailable')
 const root={tag:'root',attrs:{},children:[],start:0,end:html.length},stack=[root]
 const raw=new Set(['script','style','textarea','title','xmp','iframe','noembed','noframes','plaintext','noscript']),voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'])
 const tokens=/<!--[\s\S]*?(?:-->|$)|<![^>]*>|<\/?([a-z][a-z0-9:_-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi
 let cursor=0,token
 while((token=tokens.exec(html))){const parent=stack.at(-1)
  if(token.index>cursor)parent.children.push(html.slice(cursor,token.index));cursor=tokens.lastIndex
  if(!token[1])continue
  const tag=token[1].toLowerCase()
  if(token[0].startsWith('</')){const at=stack.findLastIndex(n=>n.tag===tag),boundary=stack.findLastIndex(n=>n.tag==='template');if(at>0&&at>=boundary){const node=stack[at];node.closeStart=token.index;node.end=cursor;stack.length=at}continue}
  const attrs={};for(const a of token[2].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)){const key=a[1].toLowerCase();if(!Object.hasOwn(attrs,key))attrs[key]=decode(a[2]??a[3]??a[4]??'')}
  const style=(attrs.style||'').replace(/\/\*[\s\S]*?\*\//g,'')
  const inactive=Object.hasOwn(attrs,'hidden')||Object.hasOwn(attrs,'inert')||attrs['aria-hidden']?.toLowerCase()==='true'||/(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|content-visibility\s*:\s*hidden)\s*(?:!important\s*)?(?:;|$)/i.test(style)
  const node={tag,attrs,children:[],start:token.index,openEnd:cursor,inactive:parent.inactive||inactive||tag==='template'||raw.has(tag)&&tag!=='script'};parent.children.push(node)
  if(raw.has(tag)){const end=new RegExp(`</${tag}\\s*>`,'ig');end.lastIndex=cursor;const close=tag==='plaintext'?null:end.exec(html);node.raw=html.slice(cursor,close?.index??html.length);node.closeStart=close?.index??html.length;node.end=close?end.lastIndex:html.length;cursor=node.end;tokens.lastIndex=cursor}
  else if(!voids.has(tag))stack.push(node);else{node.closeStart=cursor;node.end=cursor}
 }
 if(cursor<html.length)stack.at(-1).children.push(html.slice(cursor))
 const nodes=(predicate,node=root)=>node.inactive?[]:[...(predicate(node)?[node]:[]),...node.children.filter(c=>typeof c!=='string').flatMap(c=>nodes(predicate,c))]
 const text=node=>!node||node.inactive||node.tag==='script'?'':node.children.map(c=>typeof c==='string'?decode(c):text(c)).join(' ').replace(/\s+/g,' ').trim()
 const inner=node=>{if(!Number.isInteger(node.closeStart))throw Error('RMK native unclosed content');return html.slice(node.openEnd,node.closeStart)}
 const outer=node=>{if(!Number.isInteger(node.end))throw Error('RMK native unclosed element');return html.slice(node.start,node.end)}
 return{root,nodes,text,inner,outer,hasClass:(n,c)=>(n.attrs.class||'').split(/\s+/).includes(c)}
}
