// Source-specific HTTP CSS context for the public SearchJobs control. Only
// rules that can affect this control/ancestor path are qualification inputs.
import {sha,structure,requireNative} from './publicRead.js'
const check=(ok,message)=>requireNative(ok,'Alkem Laboratories',message)
const critical=/^(?:display|visibility|content-visibility|opacity|pointer-events|clip(?:-path)?|overflow(?:-[xy])?|(?:min-|max-)?(?:width|height)|position|inset(?:-.+)?|top|right|bottom|left|text-indent|white-space|font-size|line-height|margin(?:-.+)?|padding(?:-.+)?|transform(?:-.+)?|animation(?:-.+)?|filter|color|-webkit-text-fill-color|-webkit-text-security|text-overflow|content)$/
function split(input,separator){const result=[];let start=0,quote='',depth=0;for(let i=0;i<input.length;i++){const c=input[i];if(quote){if(c==='\\')i++;else if(c===quote)quote='';continue}if(c==='"'||c==="'")quote=c;else if(c==='('||c==='[')depth++;else if(c===')'||c===']')depth--;else if(c===separator&&depth===0){result.push(input.slice(start,i));start=i+1}}result.push(input.slice(start));return result}
export function cssContext(input,conditions=[]){
 const original=String(input);let css='',quoted='';for(let i=0;i<original.length;i++){const c=original[i];if(quoted){css+=c;if(c==='\\')css+=original[++i]||'';else if(c===quoted)quoted='';continue}if(c==='"'||c==="'"){quoted=c;css+=c;continue}if(c==='/'&&original[i+1]==='*'){const end=original.indexOf('*/',i+2);check(end>=0,'unclosed public CSS comment');i=end+1;continue}css+=c}
 const rules=[],imports=[];let cursor=0,importAllowed=conditions.length===0
 while(cursor<css.length){let at=cursor,quote='',parens=0
  for(;at<css.length;at++){const c=css[at];if(quote){if(c==='\\')at++;else if(c===quote)quote='';continue}if(c==='"'||c==="'")quote=c;else if(c==='('||c==='[')parens++;else if(c===')'||c===']')parens--;else if(parens===0&&(c==='{'||c===';'))break}
  const prelude=css.slice(cursor,at).trim();if(!prelude)break
  if(css[at]===';'){if(importAllowed&&/^@import\b/i.test(prelude)){const m=/^@import\s+(?:url\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)]+))\s*\)|"([^"]+)"|'([^']+)')/i.exec(prelude);check(m,'unreviewed public CSS import syntax');imports.push(m.slice(1).find(Boolean))}else if(!/^@(?:charset|layer)\b/i.test(prelude))importAllowed=false;cursor=at+1;continue}
  if(css[at]!=='{')break
  let end=at+1,level=1;quote=''
  for(;end<css.length&&level;end++){const c=css[end];if(quote){if(c==='\\')end++;else if(c===quote)quote='';continue}if(c==='"'||c==="'")quote=c;else if(c==='{')level++;else if(c==='}')level--}
  check(level===0,'unclosed public CSS rule')
  const body=css.slice(at+1,end-1)
  importAllowed=false
  if(/^@(?:media|supports|layer|container)\b/i.test(prelude)){const nested=cssContext(body,[...conditions,prelude.replace(/\s+/g,' ')]);rules.push(...nested.rules);imports.push(...nested.imports)}
  else if(!prelude.startsWith('@')){const declarations=split(body,';').map(value=>{const at=value.indexOf(':');if(at<0)return null;const property=value.slice(0,at).trim();return{property:property.startsWith('--')?property:property.toLowerCase(),value:value.slice(at+1).trim().replace(/\s+/g,' ')}}).filter(Boolean);rules.push({selectors:split(prelude,',').map(v=>v.trim()),declarations,conditions})}
  cursor=end
 }
 return{rules,imports}
}
function balanced(input,start,open='(',close=')'){let depth=1,quote='';for(let i=start+1;i<input.length;i++){const c=input[i];if(quote){if(c==='\\')i++;else if(c===quote)quote='';continue}if(c==='"'||c==="'")quote=c;else if(c===open)depth++;else if(c===close&&--depth===0)return i}return-1}
function parts(selector){const result=[];let text='',quote='',depth=0;const flush=()=>{if(text.trim())result.push(text.trim());text=''};for(let i=0;i<selector.length;i++){const c=selector[i];if(quote){text+=c;if(c==='\\')text+=selector[++i]||'';else if(c===quote)quote='';continue}if(c==='"'||c==="'"){quote=c;text+=c;continue}if(c==='('||c==='[')depth++;if(c===')'||c===']')depth--;if(!depth&&/[\s>+~]/.test(c)){flush();if(/\s/.test(c)){if(result.length&&![' ','>','+','~'].includes(result.at(-1)))result.push(' ')}else{if(result.at(-1)===' ')result.pop();result.push(c)}}else text+=c}flush();if(result.at(-1)===' ')result.pop();return result}
function selectorMatch(node,selector,parents,scopeNode){
 if(/::?(?:before|after|first-letter|first-line)\b|::/.test(selector))return false
 const tokens=parts(selector);if(!tokens.length)return false
 const simple=(node,input)=>{
  if(node.tag==='root')return false
  if(input.includes('\\'))return null
  let at=0;const tag=/^(?:[a-z][\w-]*|\*)/i.exec(input);if(tag){if(tag[0]!=='*'&&node.tag!==tag[0].toLowerCase())return false;at=tag[0].length}
  while(at<input.length){const char=input[at]
   if(char==='.'||char==='#'){const m=/^[.#]([\w-]+)/.exec(input.slice(at));if(!m)return null;if(char==='#'?node.attrs.id!==m[1]:!(node.attrs.class||'').split(/\s+/).includes(m[1]))return false;at+=m[0].length;continue}
   if(char==='['){const end=balanced(input,at,'[',']');if(end<0)return null;const m=/^\s*([\w-]+)\s*(?:(\^=|\$=|\*=|~=|\|=|=)\s*(?:"([^"]*)"|'([^']*)'|([^\s]+))\s*(i)?)?\s*$/.exec(input.slice(at+1,end));if(!m)return null;const raw=node.attrs[m[1].toLowerCase()],value=m[3]??m[4]??m[5];if(raw==null)return false;if(m[2]){let left=raw,right=value;if(m[6]){left=left.toLowerCase();right=right.toLowerCase()}const ok=({'=':()=>left===right,'^=':()=>left.startsWith(right),'$=':()=>left.endsWith(right),'*=':()=>left.includes(right),'~=':()=>left.split(/\s+/).includes(right),'|=':()=>left===right||left.startsWith(right+'-')})[m[2]]();if(!ok)return false}at=end+1;continue}
   if(char===':'){const m=/^:([\w-]+)/.exec(input.slice(at));if(!m)return null;const name=m[1].toLowerCase();at+=m[0].length;let argument=null;if(input[at]==='('){const end=balanced(input,at);if(end<0)return null;argument=input.slice(at+1,end);at=end+1}
    if(['not','is','where'].includes(name)){const values=split(argument||'',',').map(value=>selectorMatch(node,value.trim(),parents,scopeNode));if(name==='not'){if(values.some(v=>v===true))return false;if(values.some(v=>v==null))return null}else{if(!values.some(v=>v===true))return values.some(v=>v==null)?null:false}continue}
    if(name==='scope'){if(scopeNode?node!==scopeNode:node.tag!=='html')return false;continue}
    if(name==='has'){const values=split(argument||'',',').flatMap(value=>{const candidates=[],visit=n=>{if(n.tag==='template')return;for(const child of n.children||[])if(typeof child!=='string'){candidates.push(child);visit(child)}};if(/^\s*[+~]/.test(value)){const siblings=parents.get(node)?.children.filter(n=>typeof n!=='string')||[];for(const sibling of siblings.slice(siblings.indexOf(node)+1)){candidates.push(sibling);visit(sibling)}}else visit(node);return candidates.map(child=>selectorMatch(child,':scope '+value.trim(),parents,node))});if(!values.some(v=>v===true))return values.some(v=>v==null)?null:false;continue}
    if(name==='root'){if(node.tag!=='html')return false;continue}
    if(name==='disabled'||name==='enabled'){if(Object.hasOwn(node.attrs,'disabled')!==(name==='disabled'))return false;continue}
    if(['link','visited','any-link'].includes(name)){if(node.tag!=='a'||!node.attrs.href)return false;continue}
    if(name==='checked'){if(!Object.hasOwn(node.attrs,'checked'))return false;continue}
    if(['placeholder-shown','-ms-placeholder-shown'].includes(name)){if(!['input','textarea'].includes(node.tag)||!node.attrs.placeholder||node.attrs.value)return false;continue}
    if(name==='empty'){if((node.children||[]).some(c=>typeof c!=='string'||c.trim()))return false;continue}
    if(['first-child','last-child','only-child','nth-child','nth-last-child','first-of-type','last-of-type'].includes(name)){let siblings=parents.get(node)?.children.filter(c=>typeof c!=='string')||[];if(name.endsWith('of-type'))siblings=siblings.filter(c=>c.tag===node.tag);const index=siblings.indexOf(node)+1,last=siblings.length-index+1;if(name.startsWith('first')&&index!==1||name.startsWith('last')&&last!==1||name==='only-child'&&siblings.length!==1)return false;if(name.startsWith('nth')){const position=name==='nth-last-child'?last:index;if(argument==='odd'?position%2!==1:argument==='even'?position%2!==0:/^\d+$/.test(argument||'')?position!==Number(argument):true)return /^\d+$|^(?:odd|even)$/.test(argument||'')?false:null}continue}
    if(['hover','focus','focus-visible','focus-within','active','target'].includes(name))continue
    return null
   }
   return null
  }
  return true
 }
 const previous=node=>{const siblings=parents.get(node)?.children.filter(c=>typeof c!=='string')||[];return siblings[siblings.indexOf(node)-1]}
 const match=(node,index)=>{if(!node)return false;const current=simple(node,tokens[index]);if(current===false||index===0)return current;const relation=tokens[index-1],candidates=[];if(relation==='>')candidates.push(parents.get(node));else if(relation==='+')candidates.push(previous(node));else if(relation==='~'){for(let n=previous(node);n;n=previous(n))candidates.push(n)}else for(let n=parents.get(node);n;n=parents.get(n))candidates.push(n);const matches=candidates.map(n=>match(n,index-2));return matches.some(v=>v===true)?current:matches.some(v=>v==null)?null:false}
 return match(node,tokens.length-1)
}
const normalValue=(property,value)=>{
 return value.replace(/\s*!important\s*$/i,'!important').replace(/\b0(?:px|em|rem|%|vh|vw)\b/gi,'0').replace(/\s+/g,' ').trim()
}
function specificity(selector){
 let input=selector,extra=[0,0,0]
 for(let at=0;at<input.length;at++){const match=/^:(where|is|not|has)\(/.exec(input.slice(at));if(!match)continue;const open=at+match[0].length-1,end=balanced(input,open);if(end<0)break;const values=split(input.slice(open+1,end),',').map(specificity).sort((a,b)=>b[0]-a[0]||b[1]-a[1]||b[2]-a[2]);if(match[1]!=='where'&&values[0])extra=extra.map((value,index)=>value+values[0][index]);input=input.slice(0,at)+input.slice(end+1);at--}
 const ids=(input.match(/#[\w-]+/g)||[]).length,classes=(input.match(/\.[\w-]+|\[[^\]]+\]|:[\w-]+(?:\([^)]*\))?/g)||[]).length,tags=(input.match(/(?:^|[\s>+~])([a-z][\w-]*)/gi)||[]).length
 return[ids+extra[0],classes+extra[1],tags+extra[2]]
}
const wins=(next,old)=>!old||Number(next.important)!==Number(old.important)?!old||next.important:next.weight.some((value,index)=>value!==old.weight[index]&&next.weight.slice(0,index).every((v,i)=>v===old.weight[i])&&value>old.weight[index])||next.weight.every((value,index)=>value===old.weight[index])
function applies(conditions){
 for(const condition of conditions){if(!/^@media\b/i.test(condition))continue;const queries=split(condition.replace(/^@media\s*/i,''),',');const match=queries.some(query=>{if(/\bprint\b/i.test(query))return false;if(/prefers-reduced-motion\s*:\s*reduce/i.test(query))return false;if(/orientation\s*:\s*portrait/i.test(query))return false;for(const m of query.matchAll(/\((min|max)-(width|height)\s*:\s*([\d.]+)(px|em|rem)\)/gi)){const limit=Number(m[3])*(m[4].toLowerCase()==='px'?1:16),dimension=m[2].toLowerCase()==='width'?1280:900;if(m[1].toLowerCase()==='min'?dimension<limit:dimension>limit)return false}return true});if(!match)return false}
 return true
}
function visibility(model,path){
 const declarations=path.map(()=>new Map()),variables=new Map()
 for(const rule of model){const target=declarations[rule.nodeIndex];for(const declaration of rule.declarations){const important=/\s*!important$/.test(declaration.value),candidate={value:declaration.value.replace(/\s*!important$/,'').trim(),important,weight:rule.inline?[1,0,0,0]:[0,...specificity(rule.selector)]};if(wins(candidate,target.get(declaration.property)))target.set(declaration.property,candidate)}}
 const resolve=(value,depth=0)=>{if(depth>16)return null;let output=value;for(let at=output.indexOf('var(');at>=0;at=output.indexOf('var(')){const end=balanced(output,at+3);if(end<0)return null;const body=output.slice(at+4,end),pieces=split(body,','),key=pieces.shift().trim(),replacement=variables.has(key)?resolve(variables.get(key),depth+1):pieces.length?resolve(pieces.join(','),depth+1):null;if(replacement==null)return null;output=output.slice(0,at)+replacement+output.slice(end+1)}return output}
 const nodes=[]
 for(let index=path.length-1;index>=0;index--){const values=declarations[index];for(const[property,value]of values)if(property.startsWith('--'))variables.set(property,value.value);const properties=Object.fromEntries([...values].filter(([property])=>!property.startsWith('--')).map(([property,value])=>[property,resolve(value.value)]));nodes[index]=properties}
 const blocked=[],zero=value=>value!=null&&/^[+-]?0(?:\.0*)?(?:px|em|rem|%|vh|vw)?$/i.test(value.trim()),nonpositive=value=>typeof value==='string'&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)%?$/.test(value)&&Number(value.replace(/%$/,''))<=0
 const transparent=value=>{if(!value)return false;if(/^(?:transparent|#[\da-f]{3}0|#[\da-f]{6}00)$/i.test(value))return true;const fn=/^(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\((.*)\)$/i.exec(value);if(!fn)return false;const slash=split(fn[2],'/'),commas=split(fn[2],','),alpha=slash.length===2?slash[1].trim():commas.length===4?commas[3].trim():null;return alpha!=null&&nonpositive(alpha)}
 for(let index=0;index<nodes.length;index++){const p=nodes[index];if(p.display==='none'||p['content-visibility']==='hidden'||nonpositive(p.opacity)||/^(?:rect\(0(?:px)?[, ]+0(?:px)?[, ]+0(?:px)?[, ]+0(?:px)?\)|inset\(50%\))$/i.test(p.clip||p['clip-path']||'')||/scale(?:[xy])?\(\s*0(?:[, ]+0)?\s*\)/i.test(p.transform||''))blocked.push({nodeIndex:index,kind:'hidden-ancestor-or-control'})}
 for(const property of ['visibility','pointer-events','font-size','color','-webkit-text-fill-color']){const value=nodes.map(p=>p[property]).find(value=>value!=null&&!['inherit','unset'].includes(value));if(property==='visibility'&&/^(?:hidden|collapse)$/.test(value||'')||property==='pointer-events'&&value==='none'||property==='font-size'&&zero(value)||['color','-webkit-text-fill-color'].includes(property)&&transparent(value))blocked.push({nodeIndex:0,kind:'inherited-hidden-'+property})}
 const control=nodes[0];if(zero(control.width)||zero(control.height)||zero(control['max-width'])||zero(control['max-height']))blocked.push({nodeIndex:0,kind:'zero-control-box'})
 return{active:blocked.length===0,blocked,referenceViewport:{type:'screen',width:1280,height:900}}
}
export function handoffStyleModel(html,bodies,{clientClassName}={}){
 const tree=structure(html),controls=tree.doc.nodes(n=>n.tag==='button'&&tree.text(n)==='SEARCH JOBS');check(controls.length===1,'active public SearchJobs control changed')
 const control=controls[0];check(!Object.hasOwn(control.attrs,'disabled')&&control.attrs['aria-disabled']!=='true','public SearchJobs control is disabled')
 if(clientClassName!=null)control.attrs.class=clientClassName
 const path=[];for(let node=control;node&&node.tag!=='root';node=tree.parents.get(node))path.push(node)
 const inline=tree.nodes.filter(n=>n.tag==='style').map(n=>n.raw||''),rules=[...bodies,...inline].flatMap(body=>cssContext(body).rules),matched=[]
 for(const rule of rules){if(!applies(rule.conditions))continue
  for(const selector of rule.selectors)for(const[nodeIndex,node]of path.entries()){const match=selectorMatch(node,selector,tree.parents);if(match===false)continue
   const declarations=rule.declarations.filter(d=>critical.test(d.property)||d.property.startsWith('--'))
   if(!declarations.length)continue
   matched.push({selector:selector.replace(/\s+/g,' ').trim(),nodeIndex,conditions:rule.conditions,declarations,unresolved:match==null})
  }
 }
 for(const[nodeIndex,node]of path.entries()){if(!node.attrs.style)continue;const declarations=cssContext('x{'+node.attrs.style+'}').rules[0]?.declarations||[];matched.push({selector:'<inline '+node.tag+'>',nodeIndex,inline:true,conditions:[],declarations,unresolved:false})}
 const variables=new Set(),include=d=>critical.test(d.property)||variables.has(d.property)
 for(let pass=0;pass<8;pass++)for(const rule of matched)for(const declaration of rule.declarations.filter(include))for(const match of declaration.value.matchAll(/var\(\s*(--[\w-]+)/g))variables.add(match[1])
 const model=matched.map(rule=>({...rule,declarations:rule.declarations.filter(include).map(d=>({property:d.property,value:normalValue(d.property,d.value)}))})).filter(rule=>rule.declarations.length)
 check(!model.some(rule=>rule.unresolved),'public SearchJobs selector visibility context is unsupported: '+[...new Set(model.filter(rule=>rule.unresolved).map(rule=>rule.selector))].slice(0,6).join(', '))
 return{...visibility(model,path),modelSHA256:sha(JSON.stringify(model)),matchedRules:model.length,referencedVariables:[...variables].sort()}
}
