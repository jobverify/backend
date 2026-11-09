import {decodeNativeEntities,readNativeAttributeTokens} from '../../scraper-support/utils/activeNativeHtml.js'
import {need} from './currentErrors.js'

// Source offsets follow the same lexical and namespace rules as the shared
// native tree reader. Comments and raw text never supply structural div tags.
const space=c=>c!==undefined&&/[\t\n\f\r ]/.test(c)
const raw=new Set(['script','style','textarea','title','xmp','iframe','noembed','noframes','plaintext','noscript'])
const voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'])
function tagEnd(html,start){
 let cursor=start
 while(cursor<html.length){
  if(html[cursor]==='/'&&html[cursor+1]==='>')return{end:cursor+2,selfClosing:true}
  if(space(html[cursor])||html[cursor]==='/'){cursor++;continue}
  if(html[cursor]==='>')return{end:cursor+1,selfClosing:false}
  let length=0
  if(html[cursor]==='='){cursor++;length++}
  while(cursor<html.length&&!space(html[cursor])&&!['/','=','>'].includes(html[cursor])){cursor++;length++}
  need(length>0,'unsupported literal attribute boundary')
  while(space(html[cursor]))cursor++
  if(html[cursor]==='='){
   cursor++;while(space(html[cursor]))cursor++
   if(html[cursor]==='"'||html[cursor]==="'"){const end=html.indexOf(html[cursor],cursor+1);need(end!==-1,'unterminated literal attribute');cursor=end+1}
   else while(cursor<html.length&&!space(html[cursor])&&html[cursor]!=='>')cursor++
  }
 }
 need(false,'unterminated literal tag')
}
export function literalRanges(html){
 const ranges=[],stack=[{tag:'root',namespace:'html'}];let cursor=0
 while((cursor=html.indexOf('<',cursor))!==-1){
  const index=cursor
  if(html.startsWith('<!--',index)){const end=html.indexOf('-->',index+4);cursor=end===-1?html.length:end+3;continue}
  if(html.startsWith('<?',index)||html.startsWith('<!',index)){const end=html.indexOf('>',index+2);cursor=end===-1?html.length:end+1;continue}
  let first=index+1;const closing=html[first]==='/';if(closing)first++
  if(!/[a-z]/i.test(html[first]||'')){cursor++;continue}
  let nameEnd=first;while(nameEnd<html.length&&!space(html[nameEnd])&&!['/','>'].includes(html[nameEnd]))nameEnd++
  const tag=html.slice(first,nameEnd).toLowerCase(),boundary=tagEnd(html,nameEnd);cursor=boundary.end
  if(closing){
   const at=stack.findLastIndex(n=>n.tag===tag),template=stack.findLastIndex(n=>n.tag==='template')
   if(at>0&&at>=template){for(const entry of stack.slice(at))entry.closeStart=index;stack.length=at}
   continue
  }
  const parent=stack.at(-1),integration=parent.namespace==='svg'&&['foreignobject','desc','title'].includes(parent.tag),namespace=tag==='svg'?'svg':integration?'html':parent.namespace,attrs={}
  for(const [key,value]of readNativeAttributeTokens(html.slice(nameEnd,boundary.end-1)))if(!Object.hasOwn(attrs,key))attrs[key]=decodeNativeEntities(value)
  const entry={tag,attrs,start:index,openEnd:boundary.end,namespace};ranges.push(entry)
  if(namespace==='svg'&&boundary.selfClosing){entry.closeStart=boundary.end;continue}
  if(raw.has(tag)&&!(namespace==='svg'&&tag==='title')){
   const end=tag==='plaintext'?null:new RegExp('</'+tag+'[\\t\\n\\f\\r ]*>','ig');if(end)end.lastIndex=cursor
   const close=end?.exec(html);if(close)entry.closeStart=close.index;cursor=close?end.lastIndex:html.length
  }else if(voids.has(tag))entry.closeStart=boundary.end
  else stack.push(entry)
 }
 return ranges
}
