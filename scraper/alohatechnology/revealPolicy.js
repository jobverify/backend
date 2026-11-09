import {parse} from 'acorn'
import {structure,hasClass,within,sha,stable} from './publicRead.js'
const canonical=n=>JSON.stringify(n,(k,v)=>['start','end','raw'].includes(k)?undefined:v),fingerprint=n=>sha(canonical(n))
const functionNode=n=>/^(?:FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(n?.type||'')
function runtimeBindings(ast){
 const critical=new Set(['initReveals','IntersectionObserver']),globals=new Set(['window','globalThis','self']),observers=new Set(['IntersectionObserver']),bindings=[],mutations=[]
 // Follow declared functions reached from executable startup. Merely defining
 // a private function does not run its possible writes to public bindings.
 const callables=new Map(),entered=new Set()
 for(const statement of ast.body){
  if(statement.type==='FunctionDeclaration'&&statement.id)callables.set(statement.id.name,statement)
  if(statement.type==='VariableDeclaration')for(const d of statement.declarations)if(d.id.type==='Identifier'&&functionNode(d.init))callables.set(d.id.name,d.init)
 }
 const properties=node=>{const keys=[];while(node?.type==='MemberExpression'){keys.unshift(node.computed?node.property?.value:node.property?.name);node=node.object}return{base:node?.type==='Identifier'?node.name:null,keys}}
 const reference=(node,locals=new Set())=>{
  if(node?.type==='Identifier')return !locals.has(node.name)&&critical.has(node.name)?node.name:null
  const {base,keys}=properties(node)
  if(globals.has(base)&&!locals.has(base)&&critical.has(keys[0]))return keys[0]
  if(observers.has(base)&&!locals.has(base))return'IntersectionObserver'
  return null
 }
 for(let pass=0;pass<3;pass++)for(const statement of ast.body.filter(n=>n.type==='VariableDeclaration'))for(const d of statement.declarations){if(d.id.type!=='Identifier')continue;if(d.init?.type==='Identifier'&&globals.has(d.init.name))globals.add(d.id.name);if(reference(d.init)==='IntersectionObserver')observers.add(d.id.name)}
 const names=pattern=>pattern?.type==='Identifier'?[pattern.name]:pattern?.type==='ArrayPattern'?pattern.elements.flatMap(names):pattern?.type==='ObjectPattern'?pattern.properties.flatMap(p=>names(p.value)):[]
 const children=node=>Object.values(node).flatMap(value=>Array.isArray(value)?value.filter(v=>v&&typeof v==='object'):value&&typeof value==='object'?[value]:[])
 const declared=(body,varOnly=false)=>{const found=new Set();const visit=n=>{if(functionNode(n)||n.type==='ClassDeclaration'||n.type==='ClassExpression')return;if(n.type==='VariableDeclaration'&&(!varOnly||n.kind==='var'))for(const d of n.declarations)for(const name of names(d.id))found.add(name);for(const c of children(n))visit(c)};visit(body);return found}
 const scan=(node,locals=new Set(),program=false)=>{
  if(!node||typeof node!=='object')return
  if(functionNode(node)||node.type==='ClassDeclaration'||node.type==='ClassExpression'){
   if(program&&critical.has(node.id?.name))bindings.push({name:node.id.name,kind:node.type,sha256:fingerprint(node)})
   return
  }
  if(node.type==='VariableDeclaration'&&program)for(const d of node.declarations)for(const name of names(d.id))if(critical.has(name))bindings.push({name,kind:node.kind,sha256:fingerprint(d)})
  if(['AssignmentExpression','UpdateExpression','UnaryExpression'].includes(node.type)){
   const target=node.type==='AssignmentExpression'?node.left:node.argument,affected=reference(target,locals)
   if(affected&&(node.type!=='UnaryExpression'||node.operator==='delete'))mutations.push({binding:affected,kind:node.type,sha256:fingerprint(node)})
  }
  if(node.type==='CallExpression'){
   const call=properties(node.callee)
   if(['Object','Reflect'].includes(call.base)&&['defineProperty','set','assign'].includes(call.keys.at(-1))){
    const target=node.arguments[0],targetRoot=properties(target),directGlobal=target?.type==='Identifier'&&globals.has(target.name)&&!locals.has(target.name),key=node.arguments[1]?.value
    const affected=directGlobal&&critical.has(key)?key:reference(target,locals)
    const assigned=directGlobal&&call.keys.at(-1)==='assign'&&node.arguments.slice(1).some(n=>n.type==='ObjectExpression'&&n.properties.some(p=>critical.has(p.key?.name??p.key?.value)))
    if(affected||assigned||observers.has(targetRoot.base)&&!locals.has(targetRoot.base))mutations.push({binding:affected||'native-public-binding',kind:'global-property-mutation',sha256:fingerprint(node)})
   }
   if(functionNode(node.callee)){
    const nested=new Set([...locals,...node.callee.params.flatMap(names),...declared(node.callee.body,true)])
    scan(node.callee.body,nested,false)
   }
   if(node.callee?.type==='Identifier'&&!locals.has(node.callee.name)&&callables.has(node.callee.name)){
    const called=callables.get(node.callee.name)
    if(!entered.has(called)){
     entered.add(called)
     const nested=new Set([...called.params.flatMap(names),...declared(called.body,true)])
     scan(called.body,nested,false)
    }
   }
  }
  let nested=locals
  if(node.type==='BlockStatement')nested=new Set([...locals,...node.body.filter(n=>n.type==='VariableDeclaration'&&n.kind!=='var').flatMap(n=>n.declarations.flatMap(d=>names(d.id)))])
  for(const child of children(node))scan(child,nested,false)
 }
 for(const node of ast.body)scan(node,new Set(),true)
 return{globalBindings:bindings,globalMutations:mutations}
}
const flow=/^(?:display|visibility|content-visibility|opacity|overflow(?:-[xy])?|(?:min-|max-)?(?:height|width)|position|(?:top|right|bottom|left)|float|clear|transform|clip(?:-path)?|mask(?:-.+)?|contain|content|white-space|text-overflow|text-indent|(?:-webkit-)?line-clamp|font-size|line-height|color|-webkit-text-fill-color|(?:margin|padding)(?:-.+)?|flex(?:-.+)?|grid(?:-.+)?|gap|order|column(?:-.+)?)$/
function split(value,separator){const result=[];let quote='',depth=0,start=0;for(let i=0;i<value.length;i++){const c=value[i];if(quote){if(c==='\\')i++;else if(c===quote)quote='';continue}if(c==='"'||c==="'")quote=c;else if(c==='('||c==='[')depth++;else if(c===')'||c===']')depth--;else if(!depth&&c===separator){result.push(value.slice(start,i));start=i+1}}result.push(value.slice(start));return result}
function rules(css,context=[]){
 const output=[];let start=0,quote='',comment=false,depth=0,open=-1
 for(let i=0;i<css.length;i++){
  const c=css[i],next=css[i+1]
  if(comment){if(c==='*'&&next==='/'){comment=false;i++}continue}
  if(quote){if(c==='\\')i++;else if(c===quote)quote='';continue}
  if(c==='/'&&next==='*'){comment=true;i++;continue}if(c==='"'||c==="'"){quote=c;continue}
  if(c==='{'){if(depth++===0)open=i}
  else if(c==='}'&&--depth===0){const selector=css.slice(start,open).replace(/\/\*[\s\S]*?\*\//g,'').trim(),body=css.slice(open+1,i);start=i+1;if(/^@(?:media|supports|layer|container|scope)\b/.test(selector))output.push(...rules(body,[...context,selector]));else if(selector&&!selector.startsWith('@'))output.push({selector,body,context})}
  else if(!depth&&c===';')start=i+1
 }
 if(depth||quote||comment)throw Error('unsupported CSS rule boundary')
 return output
}
const declarations=body=>split(body.replace(/\/\*[\s\S]*?\*\//g,''),';').map(part=>{const at=part.indexOf(':');return at<0?null:[part.slice(0,at).trim().toLowerCase(),part.slice(at+1).trim()]}).filter(Boolean)
function matchCompound(selector,node){
 if(selector===':root')return node.tag==='html'
 if(selector==='*')return true
 const parts=selector.match(/^[a-z][\w-]*|[.#][\w-]+/gi)||[]
 if(parts.join('')!==selector)return null
 return parts.every(p=>p[0]==='.'?hasClass(node,p.slice(1)):p[0]==='#'?node.attrs.id===p.slice(1):node.tag===p.toLowerCase())
}
function matches(selector,node,parents){
 const source=selector.replace(/:(?:hover|focus|focus-visible|active)\b/g,'').trim(),parts=source.replace(/\s*>\s*/g,' > ').split(/\s+/)
 let cursor=node,index=parts.length-1,direct=false
 while(index>=0){if(parts[index]==='>'){direct=true;index--;continue}let found=false
  for(let n=cursor;n;n=direct?null:parents.get(n)){const match=matchCompound(parts[index],n);if(match===null)return null;if(match){cursor=parents.get(n);found=true;break}}
  if(!found)return false;direct=false;index--
 }return true
}
export function projectRevealPolicy(html,client){
 const s=structure(html),cards=s.nodes.filter(n=>hasClass(n,'role-card')),critical=new Set(),errors=[]
 for(const card of cards)for(const n of within(card,n=>Boolean(s.text(n))))for(let p=n;p;p=s.parents.get(p))critical.add(p)
 // Select applicable CSS at the states produced by the reviewed public
 // handlers, without executing JavaScript or changing any source text leaf.
 for(const n of s.nodes)if(hasClass(n,'reveal')&&!hasClass(n,'in'))n.attrs.class+=' in'
 for(const card of cards)if(!hasClass(card,'open'))card.attrs.class+=' open'
 const css=s.nodes.filter(n=>n.tag==='style').map(n=>n.raw||'').join('\n'),geometry=[]
 for(const rule of rules(css)){
  const selected=declarations(rule.body).filter(([key])=>flow.test(key));if(!selected.length)continue
  for(const selector of split(rule.selector,',')){
   const tokens=selector.match(/[.#][\w-]+/g)||[],present=token=>[...critical].some(n=>token[0]==='.'?hasClass(n,token.slice(1)):n.attrs.id===token.slice(1))
   const alternatives=/:(?:not|is|where|has)\(/.test(selector)
   if(tokens.length&&!(alternatives?tokens.some(present):tokens.every(present)))continue
   const values=[...critical].map(n=>matches(selector.trim(),n,s.parents)),relevant=values.includes(true)
   if(!relevant&&values.includes(null)){
    if(tokens.some(present))errors.push('unsupported-relevant-CSS-selector:'+selector.trim())
   }
   if(relevant)geometry.push({selector:selector.trim(),context:rule.context,declarations:selected})
  }
 }
 const inlines=[...critical].filter(n=>n.attrs.style).map(n=>({tag:n.tag,classes:(n.attrs.class||'').split(/\s+/).filter(c=>!/^d\d+$/.test(c)).sort(),declarations:declarations(n.attrs.style).filter(([key])=>flow.test(key))})).filter(r=>r.declarations.length)
 let ast;try{ast=parse(client,{ecmaVersion:'latest'})}catch{throw Error('unsupported public reveal JavaScript')}
 const functions=ast.body.filter(n=>n.type==='FunctionDeclaration'&&n.id?.name==='initReveals'),calls=ast.body.filter(n=>n.type==='ExpressionStatement'&&n.expression?.type==='CallExpression'&&n.expression.callee?.name==='initReveals')
 if(functions.length!==1||calls.length!==1)errors.push('missing-unconditional-public-scroll-reveal')
 const handlers=[...new Set(cards.map(n=>n.attrs.onclick||''))].map(code=>{try{return fingerprint(parse('function reveal(){'+code+'}',{ecmaVersion:'latest'}))}catch{return null}})
 if(handlers.length!==1||!handlers[0])errors.push('unsupported-public-role-click-reveal')
 const unique=values=>[...new Map(values.map(v=>[stable(v),v])).values()]
 const bindingContext=runtimeBindings(ast)
 if(bindingContext.globalMutations.length||bindingContext.globalBindings.some(b=>b.name==='IntersectionObserver'))errors.push('public-reveal-runtime-binding-mutated')
 return{scrollReveal:functions[0]?fingerprint(functions[0]):null,scrollStartup:calls[0]?fingerprint(calls[0]):null,clickReveal:handlers[0]||null,runtimeBindingContext:bindingContext,criticalFlow:unique(geometry),criticalInlineFlow:unique(inlines),errors}
}
