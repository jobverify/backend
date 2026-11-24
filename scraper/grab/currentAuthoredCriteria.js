import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'

const elements=node=>[node,...node.children.filter(child=>typeof child!=='string').flatMap(elements)]
const whitespace=char=>/[\t\n\f\r ]/.test(char??'')
function escape(css,start){
 let end=start+1;if(end>=css.length||/[\n\r\f]/.test(css[end]))return null
 if(/[a-f\d]/i.test(css[end])){const first=end;while(end<css.length&&end-first<6&&/[a-f\d]/i.test(css[end]))end++;const code=Number.parseInt(css.slice(first,end),16);if(whitespace(css[end])){if(css[end]==='\r'&&css[end+1]==='\n')end++;end++}return{end,text:String.fromCodePoint(!code||code>0x10ffff||code>=0xd800&&code<=0xdfff?0xfffd:code)}}
 return{end:end+1,text:css[end]}
}
function generatedElementOwners(css){
 let result='',quote=null,brackets=0,round=0
 for(let i=0;i<css.length;i++){const char=css[i];if(quote){result+=char;if(char==='\\'&&i+1<css.length)result+=css[++i];else if(char===quote)quote=null;continue}if(char==='"'||char==="'"){quote=char;result+=char;continue}if(char==='\\'){const decoded=escape(css,i);if(decoded){result+=css.slice(i,decoded.end);i=decoded.end-1;continue}}if(char==='[')brackets++;else if(char===']')brackets--;else if(char==='(')round++;else if(char===')')round--
  if(char===':'&&!brackets&&!round){const double=css[i+1]===':';let end=i+(double?2:1),name='';while(end<css.length){if(css[end]==='\\'){const decoded=escape(css,end);if(!decoded)break;name+=decoded.text;end=decoded.end}else if(/[a-z\d_-]/i.test(css[end]))name+=css[end++];else break}if(name&&(double||['before','after','first-line','first-letter'].includes(name.toLowerCase()))){i=end-1;continue}}
  result+=char
 }
 return result
}
function withoutComments(css){
 let result='',quote=null
 for(let i=0;i<css.length;i++){const char=css[i];if(quote){result+=char;if(char==='\\'){if(i+1>=css.length)break;result+=css[++i]}else if(char===quote)quote=null;continue}if(char==='"'||char==="'"){quote=char;result+=char;continue}if(char==='/'&&css[i+1]==='*'){const end=css.indexOf('*/',i+2);if(end===-1)break;i=end+1;continue}result+=char}
 return result
}
// Project a declared generated-content owner into a possible hiding selector.
// This reuses the existing conservative native selector matcher solely to ask
// whether new text can enter this role region. It certifies no browser layout.
function generatedOwnerProjection(raw,need){
 const css=withoutComments(raw),replacements=[];let quote=null,round=0,boundary=true
 for(let i=0;i<css.length;i++){
  const char=css[i]
  if(quote){if(char==='\\')i++;else if(char===quote)quote=null;continue}
  if(char==='"'||char==="'"){quote=char;continue}if(char==='\\'&&!boundary){i++;continue}
  if(char==='('){round++;continue}if(char===')'){round--;continue}if(round>0)continue
  if(char==='{'||char===';'){boundary=true;continue}if(char==='}'){boundary=false;continue}if(!boundary||whitespace(char))continue
  boundary=false;let end=i,name=''
  while(end<css.length){if(css[end]==='\\'){const decoded=escape(css,end);if(!decoded)break;name+=decoded.text;end=decoded.end}else if(/[a-z\d_-]/i.test(css[end]))name+=css[end++];else break}
  while(whitespace(css[end]))end++
  if(name.toLowerCase()!=='content'||css[end]!==':')continue
  let valueEnd=end+1,valueQuote=null,depth=0
  for(;valueEnd<css.length;valueEnd++){const valueChar=css[valueEnd];if(valueChar==='\\'){valueEnd++;continue}if(valueQuote){if(valueChar===valueQuote)valueQuote=null;continue}if(valueChar==='"'||valueChar==="'"){valueQuote=valueChar;continue}if(valueChar==='('||valueChar==='[')depth++;else if(valueChar===')'||valueChar===']')depth--;else if(!depth&&(valueChar===';'||valueChar==='}'))break}
  need(valueQuote===null&&depth===0&&valueEnd<css.length,'Unqualified native generated-content declaration')
  const value=css.slice(end+1,valueEnd).trim()
  if(!/^(?:none|normal|"\s*"|'\s*')(?:\s*!important)?$/i.test(value))replacements.push({start:i,end:valueEnd})
  i=valueEnd-1
 }
 let result=css;for(const row of replacements.reverse())result=result.slice(0,row.start)+'display:none'+result.slice(row.end)
 // The existing visibility matcher correctly distinguishes pseudo-elements
 // from their element. This analysis instead asks about their text owner.
 return replacements.length?generatedElementOwners(result):null
}
export function qualifyGrabAuthoredCriteria(owned,container,visible,html,need,requireAvailable){
 for(const picture of elements(container).filter(node=>node.tag==='picture')){need(picture.children.every(child=>typeof child==='string'?!child.trim():['source','img'].includes(child.tag)&&child.children.length===0),'Additional authored text or criteria in native decorative picture');for(const image of elements(picture).filter(node=>node.tag==='img'))requireAvailable(image.attrs.alt)}
 // Native text traversal marks style itself inert because it is raw text.
 // That does not disable its CSS. A template's disconnected content is distinct.
 const styles=[],collect=node=>{if(node.tag==='template')return;if(node.tag==='style'&&!node.nativeTagUnqualified)styles.push(node);for(const child of node.children)if(typeof child!=='string')collect(child)}
 collect(owned.root);const projected=[]
 for(const style of styles){
  const css=generatedOwnerProjection(style.raw??'',need);if(css)projected.push(css)
 }
 if(!projected.length)return
 const after=readVisibleNativeDocument('<style>'+projected.join('\n')+'</style>'+html,{strict:true}),beforeRegion=visible.nodes(node=>node.attrs.id==='js-job-detail'),afterRegion=after.nodes(node=>node.attrs.id==='js-job-detail')
 const count=regions=>regions.flatMap(elements).filter(node=>!node.inert).length
 need(beforeRegion.length===1&&afterRegion.length===1&&count(beforeRegion)===count(afterRegion),'Generated authored role criteria are not represented by the native full descriptions')
}
