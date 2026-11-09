// A finite static contract for this declared client format. This establishes
// data ownership and local non-mutation; it does not execute or certify React,
// external components, visibility, active postings or workplace geography.
const isFunction=n=>['FunctionExpression','ArrowFunctionExpression','FunctionDeclaration'].includes(n?.type)
const member=(n,name)=>n?.type==='MemberExpression'&&!n.computed&&!n.optional&&n.property?.name===name
const under=(n,owner,parents)=>{for(let p=n;p;p=parents.get(p))if(p===owner)return true;return false}
const ownerOf=(n,parents)=>{for(let p=parents.get(n);p;p=parents.get(p))if(isFunction(p))return p;return null}
function references(nodes,name,owner,parents){
 return nodes.filter(n=>{
  if(n.type!=='Identifier'||n.name!==name||!under(n,owner,parents))return false
  const p=parents.get(n)
  return !(p?.type==='MemberExpression'&&p.property===n&&!p.computed||p?.type==='Property'&&p.key===n&&!p.computed&&!p.shorthand)
 })
}
function props(n){
 if(n?.type!=='ObjectExpression')return null
 const result={}
 for(const p of n.properties){const k=p.key?.name??p.key?.value;if(p.type!=='Property'||p.computed||p.method||p.kind!=='init'||typeof k!=='string'||Object.hasOwn(result,k))return null;result[k]=p.value}
 return result
}
function jsx(n){
 const c=n?.callee
 if(n?.type!=='CallExpression'||n.optional||![2,3].includes(n.arguments.length)||c?.type!=='SequenceExpression'||c.expressions.length!==2||c.expressions[0]?.value!==0||!['jsx','jsxs'].some(k=>member(c.expressions[1],k)))return null
 const p=props(n.arguments[1]);return p?{tag:n.arguments[0],props:p}:null
}
function returnedUnconditionally(node,returned,parents){
 for(let n=node;n;n=parents.get(n)){
  if(n===returned)return true
  const p=parents.get(n)
  if(!p||isFunction(p)||['LogicalExpression','ConditionalExpression','AwaitExpression','YieldExpression','AssignmentExpression','SequenceExpression'].includes(p.type))return false
 }
 return false
}
function readOnlyMember(n,parents){
 let p=n
 while(parents.get(p)?.type==='MemberExpression'&&parents.get(p).object===p)p=parents.get(p)
 const owner=parents.get(p)
 return !(owner?.type==='AssignmentExpression'&&owner.left===p||owner?.type==='UpdateExpression'||owner?.type==='UnaryExpression'&&owner.operator==='delete')
}
export function bindNativeRoleArray(array,nodes,parents){
 const declaration=parents.get(array),block=parents.get(declaration),module=parents.get(block)
 if(declaration?.type!=='VariableDeclaration'||!['let','const'].includes(declaration.kind)||block?.type!=='BlockStatement'||!isFunction(module)||module.body!==block||module.async||module.generator||module.params.length!==1||module.params[0].type!=='Identifier')return null
 const local=nodes.filter(n=>under(n,module,parents))
 if(local.some(n=>n.type==='WithStatement'||n.type==='Identifier'&&n.name==='eval'))return null
 const exports=block.body.filter(s=>{
  const c=s.expression,a=c?.arguments?.[0]
  return s.type==='ExpressionStatement'&&c?.type==='CallExpression'&&!c.optional&&member(c.callee,'s')&&c.callee.object?.name===module.params[0].name&&c.arguments.length===1&&a?.type==='ArrayExpression'&&a.elements.length===3&&a.elements[0]?.value==='default'&&a.elements[1]?.value===0&&isFunction(a.elements[2])
 })
 if(exports.length!==1||block.body.indexOf(declaration)>=block.body.indexOf(exports[0]))return null
 const renderer=exports[0].expression.arguments[0].elements[2],statements=renderer.body?.body
 if(renderer.async||renderer.generator||renderer.params.length||statements?.length!==2||statements[0].type!=='VariableDeclaration'||statements[0].declarations.length!==1||statements[1].type!=='ReturnStatement'||!statements[1].argument)return null
 const state=statements[0].declarations[0],elements=state.id?.elements,call=state.init
 if(state.id?.type!=='ArrayPattern'||elements.length!==2||elements.some(n=>n?.type!=='Identifier')||elements[0].name===elements[1].name||call?.type!=='CallExpression'||call.callee?.type!=='SequenceExpression'||!member(call.callee.expressions.at(-1),'useState')||call.arguments.length!==1||call.arguments[0]?.value!==null)return null
 // There must be exactly the initializer binding and one read-only .map read.
 // Extra declarations, parameters, writes, aliases and escapes fail closed,
 // including those in nested functions. This deliberately rejects unsupported
 // shadowed formats rather than pretending to be a general JS interpreter.
 const refs=references(local,array.id.name,module,parents),uses=refs.filter(n=>n!==array.id)
 if(refs.length!==2||uses.length!==1)return null
 const ref=uses[0],access=parents.get(ref),map=parents.get(access),callback=map?.arguments?.[0]
 if(!member(access,'map')||access.object!==ref||map?.type!=='CallExpression'||map.callee!==access||map.optional||map.arguments.length!==1||ownerOf(map,parents)!==renderer||!returnedUnconditionally(map,statements[1].argument,parents))return null
 if(callback?.type!=='ArrowFunctionExpression'||callback.async||!callback.expression||![1,2].includes(callback.params.length)||callback.params.some(p=>p.type!=='Identifier')||new Set(callback.params.map(p=>p.name)).size!==callback.params.length)return null
 const row=callback.params[0],button=jsx(callback.body),click=button?.props.onClick,children=button?.props.children
 if(!button||!member(button.tag,'button')||!member(button.tag.object,'motion')||!member(children,'name')||children.object?.name!==row.name||click?.type!=='ArrowFunctionExpression'||click.async||click.params.length||click.body?.type!=='CallExpression'||click.body.optional||click.body.callee?.type!=='Identifier'||click.body.callee.name!==elements[1].name||click.body.arguments.length!==1||click.body.arguments[0]?.type!=='Identifier'||click.body.arguments[0].name!==row.name)return null
 const rowRefs=references(local,row.name,callback,parents),allowedRow=new Set([row,children.object,click.body.arguments[0]])
 if(rowRefs.length!==3||rowRefs.some(n=>!allowedRow.has(n)))return null
 const setterRefs=references(local,elements[1].name,renderer,parents)
 if(setterRefs.some(n=>{
  if(n===elements[1]||n===click.body.callee)return false
  const c=parents.get(n)
  return c?.type!=='CallExpression'||c.callee!==n||c.optional||c.arguments.length!==1||c.arguments[0]?.type!=='Literal'||c.arguments[0].value!==null
 }))return null
 // The selected object may expose primitive fields or map its string array.
 // Passing either the object or the array to arbitrary code is an escape.
 const selected=elements[0],selectedRefs=references(local,selected.name,renderer,parents),requirementCallbacks=[]
 for(const n of selectedRefs){
  if(n===selected||under(n,callback,parents))continue
  const p=parents.get(n)
  if(member(p,'arr')&&p.object===n){
   const access=parents.get(p),c=parents.get(access),cb=c?.arguments?.[0]
   if(access?.type!=='MemberExpression'||access.computed||access.property?.name!=='map'||access.object!==p||c?.type!=='CallExpression'||c.callee!==access||c.arguments.length!==1||cb?.type!=='ArrowFunctionExpression'||cb.async||!cb.expression||!cb.params.length||cb.params.some(v=>v.type!=='Identifier'))return null
   requirementCallbacks.push(cb)
  }
 }
 for(const n of selectedRefs){
  if(n===selected||under(n,callback,parents)||requirementCallbacks.some(cb=>cb.params.some(p=>p.name===selected.name)&&under(n,cb,parents)))continue
  const p=parents.get(n)
  if(p?.type==='MemberExpression'&&p.object===n&&!p.computed&&['name','title','bio','arr'].includes(p.property?.name)&&readOnlyMember(p,parents))continue
  if(p?.type==='UnaryExpression'&&p.operator==='!'&&p.argument===n||p?.type==='LogicalExpression'&&p.operator==='&&'&&p.left===n)continue
  return null
 }
 return{kind:'finite-exported-role-array-binding',bindingName:array.id.name,arrayDeclarationStartUTF16:array.start,rendererStartUTF16:renderer.start,mapStartUTF16:map.start,roleAssociationQualified:true,localPayloadUnaltered:true,externalRendererExecutionQualified:false}
}
