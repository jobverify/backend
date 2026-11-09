// Source-local criteria visibility. Selector/cascade primitives follow the frozen
// Alkem public-handoff implementation; no employer/private bundle hashes gate it.
import {createHash} from 'node:crypto'
import {cssContext} from '../alkemlaboratories/handoffStyles.js'
import {structure} from '../alkemlaboratories/publicRead.js'
const sha=value=>createHash('sha256').update(value).digest('hex')
const critical=/^(?:display|visibility|content-visibility|opacity|clip(?:-path)?|overflow(?:-[xy])?|(?:min-|max-)?(?:width|height)|font-size|line-height|white-space|(?:-webkit-)?line-clamp|-webkit-box-orient|transform(?:-.+)?|animation(?:-.+)?|filter|color|-webkit-text-fill-color|-webkit-text-security|text-overflow|content)$/
function split(input,separator){const result=[];let start=0,quote='',depth=0;for(let i=0;i<input.length;i++){const c=input[i];if(quote){if(c==='\\')i++;else if(c===quote)quote='';continue}if(c==='"'||c==="'")quote=c;else if(c==='('||c==='[')depth++;else if(c===')'||c===']')depth--;else if(c===separator&&depth===0){result.push(input.slice(start,i));start=i+1}}result.push(input.slice(start));return result}
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
function mediaState(raw){
 let query=raw.trim().toLowerCase(),negated=false
 if(query.startsWith('not ')){negated=true;query=query.slice(4).trim()}else query=query.replace(/^only\s+/,'')
 const medium=/^(all|screen|print)\b/.exec(query);let matches=true
 if(medium){matches=medium[1]!=='print';query=query.slice(medium[0].length).trim();if(query)query=query.replace(/^and\s+/,'')}
 else if(!query.startsWith('('))return null
 if(query)for(const feature of query.split(/\s+and\s+/)){
  const limit=/^\((min|max)-(width|height)\s*:\s*(\d+(?:\.\d+)?)(px|em|rem)\)$/.exec(feature),orientation=/^\(orientation\s*:\s*(landscape|portrait)\)$/.exec(feature),motion=/^\(prefers-reduced-motion\s*:\s*(reduce|no-preference)\)$/.exec(feature)
  if(limit){const value=Number(limit[3])*(limit[4]==='px'?1:16),dimension=limit[2]==='width'?1280:900;matches=matches&&(limit[1]==='min'?dimension>=value:dimension<=value)}
  else if(orientation)matches=matches&&orientation[1]==='landscape'
  else if(motion)matches=matches&&motion[1]==='no-preference'
  else return null
 }
 return negated?!matches:matches
}
function conditionState(conditions){
 let unresolved=false
 for(const condition of conditions){if(!/^@media\b/i.test(condition)){unresolved=true;continue}const values=split(condition.replace(/^@media\s*/i,''),',').map(mediaState);if(values.some(value=>value===true))continue;if(values.every(value=>value===false))return false;unresolved=true}
 return unresolved?null:true
}
function visibility(model,path,{criteriaTarget=false}={}){
 const declarations=path.map(()=>new Map()),variables=new Map()
 for(const rule of model){const target=declarations[rule.nodeIndex];for(const declaration of rule.declarations){const important=/\s*!important$/.test(declaration.value),candidate={value:declaration.value.replace(/\s*!important$/,'').trim(),important,weight:rule.inline?[1,0,0,0]:[0,...specificity(rule.selector)]};if(wins(candidate,target.get(declaration.property)))target.set(declaration.property,candidate)}}
 const resolve=(value,depth=0)=>{if(depth>16)return null;let output=value;for(let at=output.indexOf('var(');at>=0;at=output.indexOf('var(')){const end=balanced(output,at+3);if(end<0)return null;const body=output.slice(at+4,end),pieces=split(body,','),key=pieces.shift().trim(),replacement=variables.has(key)?resolve(variables.get(key),depth+1):pieces.length?resolve(pieces.join(','),depth+1):null;if(replacement==null)return null;output=output.slice(0,at)+replacement+output.slice(end+1)}return output}
 const nodes=[]
 for(let index=path.length-1;index>=0;index--){const values=declarations[index];for(const[property,value]of values)if(property.startsWith('--'))variables.set(property,value.value);const properties=Object.fromEntries([...values].filter(([property])=>!property.startsWith('--')).map(([property,value])=>[property,resolve(value.value)]));nodes[index]=properties}
 const blocked=[],zero=value=>value!=null&&/^[+-]?0(?:\.0*)?(?:px|em|rem|%|vh|vw)?$/i.test(value.trim()),nonpositive=value=>typeof value==='string'&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)%?$/.test(value)&&Number(value.replace(/%$/,''))<=0
 const transparent=value=>{if(!value)return false;if(/^(?:transparent|#[\da-f]{3}0|#[\da-f]{6}00)$/i.test(value))return true;const fn=/^(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\((.*)\)$/i.exec(value);if(!fn)return false;const slash=split(fn[2],'/'),commas=split(fn[2],','),alpha=slash.length===2?slash[1].trim():commas.length===4?commas[3].trim():null;return alpha!=null&&nonpositive(alpha)}
 for(let index=0;index<nodes.length;index++){const p=nodes[index];if(p.display==='none'||p['content-visibility']==='hidden'||nonpositive(p.opacity)||/^(?:rect\(0(?:px)?[, ]+0(?:px)?[, ]+0(?:px)?[, ]+0(?:px)?\)|inset\(50%\))$/i.test(p.clip||p['clip-path']||'')||/scale(?:[xy])?\(\s*0(?:[, ]+0)?\s*\)/i.test(p.transform||''))blocked.push({nodeIndex:index,kind:'hidden-ancestor-or-control'})}
 for(const property of ['visibility','font-size','color','-webkit-text-fill-color']){const value=nodes.map(p=>p[property]).find(value=>value!=null&&!['inherit','unset'].includes(value));if(property==='visibility'&&/^(?:hidden|collapse)$/.test(value||'')||property==='pointer-events'&&value==='none'||property==='font-size'&&zero(value)||['color','-webkit-text-fill-color'].includes(property)&&transparent(value))blocked.push({nodeIndex:0,kind:'inherited-hidden-'+property})}
 const whiteSpace=nodes.map(node=>node['white-space']).find(value=>value!=null&&!['inherit','unset'].includes(value))
 for(let index=0;index<nodes.length;index++){
  const p=nodes[index],clipped=/^(?:hidden|clip|scroll|auto)$/.test(p.overflow||'')||/^(?:hidden|clip|scroll|auto)$/.test(p['overflow-x']||'')||/^(?:hidden|clip|scroll|auto)$/.test(p['overflow-y']||''),verticalClip=/^(?:hidden|clip)$/.test(p['overflow-y']||p.overflow||''),heightBound=[p.height,p['max-height']].some(value=>value!=null&&!/^(?:auto|none|initial|unset|inherit)$/.test(value)),horizontalClip=/^(?:hidden|clip)$/.test(p['overflow-x']||p.overflow||''),widthBound=[p.width,p['max-width']].some(value=>value!=null&&!/^(?:auto|none|initial|unset|inherit)$/.test(value)),lineClamp=[p['line-clamp'],p['-webkit-line-clamp']].some(value=>value!=null&&!/^(?:none|initial|unset|inherit|0)$/.test(value))
  if(clipped&&(zero(p.width)||zero(p.height)||zero(p['max-width'])||zero(p['max-height'])))blocked.push({nodeIndex:index,kind:'clipped-zero-box'})
  if(verticalClip&&heightBound)blocked.push({nodeIndex:index,kind:'height-constrained-public-text-clipping'})
  if(criteriaTarget&&horizontalClip&&widthBound&&/^(?:nowrap|pre)$/.test(whiteSpace||''))blocked.push({nodeIndex:index,kind:'width-constrained-nowrap-criteria-clipping'})
  if(criteriaTarget&&lineClamp)blocked.push({nodeIndex:index,kind:'line-clamped-public-criteria'})
  if(Object.values(p).some(value=>value===null)||p.animation&&p.animation!=='none'||p.filter&&p.filter!=='none'||p.transform&&p.transform!=='none'&&!/scale(?:[xy])?\(\s*1(?:[, ]+1)?\s*\)/.test(p.transform))blocked.push({nodeIndex:index,kind:'unresolved-rendered-visibility'})
 }
 return{active:blocked.length===0,blocked,effectiveNodes:nodes,referenceViewport:{type:'screen',width:1280,height:900}}
}

export const NATIVE_STYLESHEETS=['https://stc.beisen.com/cmssite//Styles/frontmodule.css','https://stc-cms.beisen.com/CmsPortal/6/6_themes_default_style.css?v=0.0.0.3']
export function declaredStylesheets(html){
 const tree=structure(html),links=tree.nodes.filter(node=>node.tag==='link'&&(node.attrs.rel||'').toLowerCase().split(/\s+/).includes('stylesheet')&&!Object.hasOwn(node.attrs,'disabled')&&!((node.attrs.rel||'').toLowerCase().split(/\s+/).includes('alternate')&&node.attrs.title))
 return links.map(node=>({url:new URL(node.attrs.href,'https://akulaku.zhiye.com/').href,media:node.attrs.media||null,alternate:(node.attrs.rel||'').toLowerCase().split(/\s+/).includes('alternate')}))
}
export function criteriaStyleModel(html,stylesheets=[]){
 const tree=structure(html),criterion=tree.nodes.find(node=>tree.doc.hasClass(node,'xiangqingtext')),body=tree.nodes.find(node=>tree.doc.hasClass(node,'xiangqingcontain')),issues=[],models=[],generatedCriteria=[]
 if(!criterion||!body)return{active:false,issues:['native-criteria-scope-unavailable'],contextSHA256:null}
 const declared=declaredStylesheets(html),bodies=[]
 // Preserve DOM order: a later external sheet can override an earlier style.
 for(const node of tree.nodes){
  const conditions=node.attrs.media?['@media '+node.attrs.media]:[]
  if(node.tag==='link'&&(node.attrs.rel||'').toLowerCase().split(/\s+/).includes('stylesheet')){
   const url=new URL(node.attrs.href,'https://akulaku.zhiye.com/').href,sheet=declared.find(row=>row.url===url);if(!sheet)continue
   if(conditionState(conditions)===false)continue
   const record=stylesheets.find(row=>row.url===url);if(!record||typeof record.body!=='string'){issues.push('unread-published-stylesheet:'+url);continue}
   if(sheet.alternate)conditions.push('@alternate-stylesheet-initial-state')
   bodies.push({body:record.body,conditions})
  }else if(node.tag==='style'&&(!node.attrs.type||node.attrs.type.toLowerCase()==='text/css')){if(node.attrs.title)conditions.push('@preferred-stylesheet-initial-state');if(conditionState(conditions)!==false)bodies.push({body:node.raw||'',conditions})}
 }
 const rules=[]
 for(const css of bodies){const parsed=cssContext(css.body,css.conditions);if(parsed.imports.length)issues.push('unread-published-stylesheet-import');rules.push(...parsed.rules.filter(rule=>conditionState(rule.conditions)!==false))}
 const excluded=node=>tree.doc.hasClass(node,'xiangqingfooter')||tree.doc.hasClass(node,'fenxiang')||['script','style','template'].includes(node.tag),targets=[]
 const collect=node=>{if(excluded(node))return;if(node.children.some(child=>typeof child==='string'&&child.trim()))targets.push(node);for(const child of node.children)if(typeof child!=='string')collect(child)}
 collect(body)
 const parent=tree.parents.get(body),title=parent?.children.find(node=>typeof node!=='string'&&tree.doc.hasClass(node,'boxSupertitle'));if(title)collect(title)
 const relevant=new Set();for(const target of targets)for(let node=target;node&&node.tag!=='root';node=tree.parents.get(node))relevant.add(node)
 const matched=new Map([...relevant].map(node=>[node,[]]))
 for(const rule of rules){
  const declarations=rule.declarations.filter(d=>critical.test(d.property)||d.property.startsWith('--'));if(!declarations.length)continue
  for(const selector of rule.selectors)for(const node of relevant){
   const pseudo=/::?|::/.test(selector)&&/::?(?:before|after|marker)\b/.test(selector),base=pseudo?selector.replace(/::?(?:before|after|marker)\b.*$/,''):selector,match=selectorMatch(node,base,tree.parents)
   if(match===false)continue
   if(pseudo){for(const declaration of declarations.filter(d=>d.property==='content'&&!/^(?:none|normal|""|'')$/.test(d.value))){generatedCriteria.push({selector,content:declaration.value,conditions:rule.conditions});issues.push('unsupported-generated-public-criteria')}continue}
   matched.get(node).push({selector,declarations,conditions:rule.conditions,unresolvedSelector:match==null,unresolvedCondition:conditionState(rule.conditions)==null})
  }
 }
 for(const node of relevant)if(node.attrs.style){const declarations=cssContext('x{'+node.attrs.style+'}').rules[0]?.declarations||[];matched.get(node).push({selector:'<inline '+node.tag+'>',inline:true,declarations,conditions:[]})}
 const referencedVariables=new Set()
 for(let pass=0;pass<16;pass++)for(const rows of matched.values())for(const rule of rows)for(const declaration of rule.declarations.filter(d=>critical.test(d.property)||referencedVariables.has(d.property)))for(const match of declaration.value.matchAll(/var\(\s*(--[\w-]+)/g))referencedVariables.add(match[1])
 for(const[node,rows]of matched){const selected=[];for(const rule of rows){const declarations=rule.declarations.filter(d=>critical.test(d.property)||referencedVariables.has(d.property));if(!declarations.length)continue;if(rule.unresolvedSelector){issues.push('unsupported-relevant-visibility-selector:'+rule.selector);continue}if(rule.unresolvedCondition){issues.push('unsupported-relevant-visibility-condition:'+rule.conditions.join(' '));continue}selected.push({...rule,declarations})}matched.set(node,selected)}
 for(const target of targets){const path=[];for(let node=target;node&&node.tag!=='root';node=tree.parents.get(node))path.push(node);const model=path.flatMap((node,nodeIndex)=>matched.get(node).map(rule=>({...rule,nodeIndex}))),view=visibility(model,path,{criteriaTarget:path.includes(criterion)});if(target.inert)issues.push('inactive-public-role-text');for(const blocked of view.blocked)issues.push(blocked.kind+':'+path[blocked.nodeIndex].tag+'.'+(path[blocked.nodeIndex].attrs.class||''));models.push(view.effectiveNodes)}
 return{active:issues.length===0,issues:[...new Set(issues)],contextSHA256:sha(JSON.stringify(models)),referenceViewport:{type:'screen',width:1280,height:900},publishedStylesheets:declared.map(row=>row.url),publicTextTargets:targets.length,referencedVariables:[...referencedVariables].sort(),generatedCriteria:[...new Map(generatedCriteria.map(row=>[JSON.stringify(row),row])).values()]}
}
