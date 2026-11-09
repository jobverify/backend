// Evaluate the fetched styles as data. Unknown selectors/conditional hiding are
// conservative visibility gaps; no page or stylesheet JavaScript is executed.
const children=node=>node.children.filter(value=>typeof value!=='string')
const or=values=>values.includes(true)?true:values.includes(null)?null:false
const and=values=>values.includes(false)?false:values.includes(null)?null:true
const split=(value,kind=',')=>{
  const result=[];let chunk='',quote=null,depth=0,escaped=false
  const flush=()=>{if(chunk.trim())result.push(chunk.trim());chunk=''}
  for(const char of value){
    if(escaped){chunk+=char;escaped=false;continue}
    if(char==='\\'){chunk+=char;escaped=true;continue}
    if(quote){chunk+=char;if(char===quote)quote=null;continue}
    if(char==='"'||char==="'"){quote=char;chunk+=char;continue}
    if(char==='('||char==='[')depth++
    if(char===')'||char===']')depth--
    if(!depth&&(kind==='tokens'?/[\s>+~]/.test(char):char===kind)){
      flush();if(kind==='tokens'&&/[>+~]/.test(char))result.push(char)
    }else chunk+=char
  }
  flush();return result
}
const attributeMatches=(node,source)=>{
  const m=/^\s*([\w-]+)(?:\s*([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\s]+?))(?:\s+([is]))?)?\s*$/i.exec(source)
  if(!m)return null
  const actual=node.attrs[m[1].toLowerCase()]
  if(actual===undefined)return false
  if(!m[2])return true
  let value=m[3]??m[4]??m[5],candidate=actual
  if(m[6]?.toLowerCase()==='i'){value=value.toLowerCase();candidate=candidate.toLowerCase()}
  return ({'=':()=>candidate===value,'~=':()=>candidate.split(/\s+/).includes(value),'|=':()=>candidate===value||candidate.startsWith(value+'-'),'^=':()=>Boolean(value)&&candidate.startsWith(value),'$=':()=>Boolean(value)&&candidate.endsWith(value),'*=':()=>Boolean(value)&&candidate.includes(value)})[m[2]]()
}
const nth=(index,expression)=>{
  const value=expression.replace(/\s+/g,'').toLowerCase()
  if(value==='odd')return index%2===1
  if(value==='even')return index%2===0
  if(/^\d+$/.test(value))return index===Number(value)
  const m=/^([+-]?\d*)n([+-]\d+)?$/.exec(value)
  if(!m)return null
  const a=m[1]===''||m[1]==='+'?1:m[1]==='-'?-1:Number(m[1]),b=Number(m[2]||0)
  return a===0?index===b:(index-b)/a>=0&&Number.isInteger((index-b)/a)
}
const compoundMatches=(node,source)=>{
  const results=[];let rest=source
  const tag=/^(\*|[a-z][\w-]*)/i.exec(rest)
  if(tag){results.push(tag[1]==='*'||node.tag===tag[1].toLowerCase());rest=rest.slice(tag[0].length)}
  while(rest){
    let m=/^([.#])([\w-]+)/.exec(rest)
    if(m){results.push(m[1]==='#'?node.attrs.id===m[2]:(node.cssClasses||(node.attrs.class||'').split(/\s+/)).includes(m[2]));rest=rest.slice(m[0].length);continue}
    if(rest.startsWith('[')){
      const close=/^\[((?:[^\]"']|"[^"]*"|'[^']*')*)\]/.exec(rest)
      if(!close){results.push(null);break}
      results.push(attributeMatches(node,close[1]));rest=rest.slice(close[0].length);continue
    }
    if(rest.startsWith('::'))return false // A pseudo-element cannot hide its owner.
    m=/^:([\w-]+)/.exec(rest)
    if(!m){results.push(null);break}
    const name=m[1].toLowerCase();rest=rest.slice(m[0].length);let argument=null
    if(rest.startsWith('(')){
      let depth=0,end=-1,quote=null
      for(let i=0;i<rest.length;i++){
        const c=rest[i]
        if(quote){if(c===quote&&rest[i-1]!=='\\')quote=null;continue}
        if(c==='"'||c==="'"){quote=c;continue}
        if(c==='(')depth++;if(c===')'&&!--depth){end=i;break}
      }
      if(end<0){results.push(null);break}
      argument=rest.slice(1,end);rest=rest.slice(end+1)
    }
    const siblings=node.parent?children(node.parent):[],index=siblings.indexOf(node),typed=siblings.filter(value=>value.tag===node.tag)
    if(['is','where','not'].includes(name)&&argument!==null){const value=or(split(argument).map(selector=>selectorMatches(node,selector)));results.push(name==='not'?(value===null?null:!value):value)}
    else if(name==='empty')results.push(!node.children.some(child=>typeof child==='string'?child.length>0:true))
    else if(name==='root')results.push(node.tag==='html')
    else if(name==='first-child')results.push(index===0)
    else if(name==='last-child')results.push(index===siblings.length-1)
    else if(name==='only-child')results.push(siblings.length===1)
    else if(name==='first-of-type')results.push(typed[0]===node)
    else if(name==='last-of-type')results.push(typed.at(-1)===node)
    else if(name==='nth-child'&&argument!==null)results.push(nth(index+1,argument))
    else if(name==='nth-last-child'&&argument!==null)results.push(nth(siblings.length-index,argument))
    else if(name==='nth-of-type'&&argument!==null)results.push(nth(typed.indexOf(node)+1,argument))
    else if(name==='disabled')results.push(Object.hasOwn(node.attrs,'disabled'))
    else if(name==='enabled')results.push(!Object.hasOwn(node.attrs,'disabled'))
    else if(name==='checked')results.push(Object.hasOwn(node.attrs,'checked')||Object.hasOwn(node.attrs,'selected'))
    else results.push(null)
  }
  return and(results)
}
const selectorMatches=(node,selector)=>{
  const parts=split(selector,'tokens')
  const match=(current,index)=>{
    if(!current||index<0)return false
    const own=compoundMatches(current,parts[index]);if(own===false||index===0)return own
    const combinator=parts[index-1]
    if(combinator==='>')return and([own,match(current.parent,index-2)])
    if(combinator==='+'||combinator==='~'){
      const siblings=current.parent?children(current.parent):[],before=siblings.slice(0,siblings.indexOf(current))
      return and([own,combinator==='+'?match(before.at(-1),index-2):or(before.map(sibling=>match(sibling,index-2)))])
    }
    const ancestors=[];for(let ancestor=current.parent;ancestor;ancestor=ancestor.parent)ancestors.push(match(ancestor,index-1))
    return and([own,or(ancestors)])
  }
  return parts.length?match(node,parts.length-1):null
}
const properties=new Set(['display','visibility','content-visibility','opacity'])
const declarations=value=>split(value,';').flatMap(part=>{
  const match=/^\s*([\w-]+)\s*:\s*([\s\S]+?)\s*$/.exec(part)
  if(!match||!properties.has(match[1].toLowerCase()))return []
  return [{property:match[1].toLowerCase(),value:match[2].replace(/\s*!important\s*$/i,'').trim().toLowerCase(),important:/!important\s*$/i.test(match[2])}]
})
const specificity=selector=>{
  const clean=selector.replace(/\[[^\]]*\]/g,'.attribute').replace(/::[\w-]+/g,' element').replace(/:where\([^)]*\)/g,'')
  return [...clean.matchAll(/#[\w-]+/g)].length*10000+[...clean.matchAll(/\.[\w-]+|:[\w-]+/g)].length*100+[...clean.matchAll(/(?:^|[\s>+~(,])([a-z][\w-]*)/gi)].length
}
const parseRules=(source,conditional=false)=>{
  const css=source.replace(/\/\*[\s\S]*?\*\//g,''),rules=[];let cursor=0
  while(cursor<css.length){
    const open=css.indexOf('{',cursor);if(open<0)break
    const header=css.slice(cursor,open).trim();let depth=1,end=open+1,quote=null
    for(;end<css.length&&depth;end++){
      const char=css[end]
      if(quote){if(char===quote&&css[end-1]!=='\\')quote=null;continue}
      if(char==='"'||char==="'"){quote=char;continue}
      if(char==='{')depth++;else if(char==='}')depth--
    }
    const body=css.slice(open+1,end-1);cursor=end
    if(header.startsWith('@')){
      if(/^@(?:media|supports|container|layer|scope)\b/i.test(header)&&!/^@media\s+print\b/i.test(header))rules.push(...parseRules(body,conditional||!/^@layer(?:\s|$)/i.test(header)))
      continue
    }
    const values=declarations(body);if(!values.length)continue
    for(const selector of split(header))rules.push({selector,values,specificity:specificity(selector),conditional})
  }
  return rules
}
const hiddenValue=({property,value})=>{
  if(property==='opacity')return /^\d*\.?\d+$/.test(value)?Number(value)===0:null
  if(property==='display')return value==='none'?true:/^(?:block|inline|inline-block|flex|inline-flex|grid|inline-grid|contents|flow-root|table(?:-[a-z-]+)?|list-item|ruby(?:-[a-z-]+)?)$/.test(value)?false:null
  return /^(?:hidden|collapse)$/.test(value)?true:/^(?:visible|auto)$/.test(value)?false:null
}
const outranks=(left,right)=>!right||Number(left.important)>Number(right.important)||left.important===right.important&&(left.specificity>right.specificity||left.specificity===right.specificity&&left.order>=right.order)
export const applyNativeStyles=(root,{stylesheets=[],revealBootstrap=false,executionNodes,baseUrl='https://talents.electrifex.com/'}={})=>{
  const supplied=new Map(stylesheets.map(sheet=>[sheet.url,sheet.body])),sources=[]
  for(const node of executionNodes(n=>n.tag==='style'||n.tag==='link'&&n.attrs.rel==='stylesheet')){
    if(node.tag==='style')sources.push(node.raw||'')
    else{let url;try{url=new URL(node.attrs.href,baseUrl).href}catch{continue}if(supplied.has(url))sources.push(supplied.get(url))}
  }
  const rules=sources.flatMap(source=>parseRules(source)),uncertain=[]
  const visit=node=>{
    node.cssClasses=(node.attrs.class||'').split(/\s+/)
    if(revealBootstrap&&(/^jobCollapseOne\d+$/.test(node.attrs.id||'')&&node.cssClasses.includes('accordion-collapse')||/^bordered-justified-(?:description|requirements|application-process)-\d+$/.test(node.attrs.id||'')&&node.cssClasses.includes('tab-pane'))){node.cssClasses=[...new Set([...node.cssClasses,'show','active'])]}
    const winners=new Map(),possible=[]
    for(const [order,rule]of rules.entries()){
      const matches=selectorMatches(node,rule.selector);if(matches===false)continue
      for(const declaration of rule.values){
        const item={...declaration,specificity:rule.specificity,order},state=hiddenValue(item)
        if(matches===null||rule.conditional||state===null){if(state!==false)possible.push(item);continue}
        if(outranks(item,winners.get(item.property)))winners.set(item.property,item)
      }
    }
    for(const [index,item]of declarations(node.attrs.style||'').entries()){
      const declaration={...item,specificity:1000000,order:rules.length+index}
      if(hiddenValue(declaration)===null)possible.push(declaration)
      else if(outranks(declaration,winners.get(declaration.property)))winners.set(declaration.property,declaration)
    }
    node.cssUncertain=possible.some(item=>outranks(item,winners.get(item.property)))
    if(node.cssUncertain)uncertain.push(node)
    node.hidden=Boolean(node.parent?.hidden)||Object.hasOwn(node.attrs,'hidden')||Object.hasOwn(node.attrs,'inert')||node.attrs['aria-hidden']?.toLowerCase()==='true'||node.cssUncertain||[...winners.values()].some(item=>hiddenValue(item)===true)
    for(const child of children(node))visit(child)
  }
  visit(root)
  return {uncertain}
}
