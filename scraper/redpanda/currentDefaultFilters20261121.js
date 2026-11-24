import {need,one,all} from './currentFacts20261120.js'

const functions=new Set(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'])
const children=node=>Object.values(node??{}).flatMap(value=>Array.isArray(value)?value:[value]).filter(value=>value&&typeof value==='object'&&typeof value.type==='string')
const walk=node=>[node,...children(node).flatMap(walk)]

// Qualify the actual initial filter state and the reachable empty-selection
// branches. This is an AST witness; native predicates never execute.
export function qualifyDefaultFilters(p,{apply,filterFunction,filtered,state,document}){
 const binding=node=>node?.type==='Identifier'?p.binding(node):null,same=(a,b)=>Boolean(binding(a)&&binding(a)===binding(b)),property=(node,name)=>node?.type==='MemberExpression'&&p.member(node)===name,method=(node,name)=>node?.type==='CallExpression'&&property(node.callee,name),fn=node=>{const value=p.resolve(node);return functions.has(value?.type)?value:null}
 const initial=node=>{const value=binding(node);need(value?.defs.length===1&&!value.writes.length,'actual default filter binding is mutable');return value.defs[0].init}
 const returned=owner=>{need(owner&&functions.has(owner.type),'actual default filter helper is disconnected');if(owner.body.type!=='BlockStatement')return owner.body;const results=owner.body.body.filter(node=>node.type==='ReturnStatement');return one(results,'actual helper direct return').argument}
 const owner=node=>{for(let at=p.parents.get(node);at;at=p.parents.get(at))if(functions.has(at.type))return at;return null}
 const selected=returned(filterFunction);need(selected?.type==='CallExpression'&&selected.arguments.length===3&&same(selected.arguments[0],filterFunction.params[0]),'actual initial record predicate is disconnected')
 const predicate=fn(selected.callee),active=selected.arguments[1],query=selected.arguments[2]
 need(predicate?.params.length===3&&active.type==='Identifier'&&query.type==='Identifier','actual initial predicate parameters differ')
 const activeInitial=initial(active);need(activeInitial?.type==='ObjectExpression'&&activeInitial.properties.length===0,'actual initial selected filters are not empty')
 const queryInitial=initial(query),trim=queryInitial?.callee?.object,fallback=trim?.callee?.object
 need(method(queryInitial,'toLowerCase')&&queryInitial.arguments.length===0&&method(trim,'trim')&&trim.arguments.length===0&&fallback?.type==='LogicalExpression'&&fallback.operator==='||'&&p.literal(fallback.right)==='','actual initial search fallback differs')
 const source=fallback.left;need(source?.type==='LogicalExpression'&&source.operator==='&&'&&property(source.left,'search')&&same(source.left.object,state)&&property(source.right,'value')&&property(source.right.object,'search')&&same(source.right.object.object,state),'actual initial search is disconnected from current own state')
 const search=all(document.root,node=>node.tag==='input'&&node.attrs['fs-cmsfilter-field']==='*');need(search.length<=1&&search.every(node=>node.attrs.value==null||node.attrs.value===''),'actual own search has a preselected query')
 const assignments=walk(apply.body).filter(node=>node.type==='AssignmentExpression'&&node.left.type==='MemberExpression'&&same(node.left.object,active)),selection=one(assignments,'actual selected filter initialization'),checked=selection.right
 need(selection.operator==='='&&selection.left.computed&&checked.type==='CallExpression'&&checked.arguments.length===1,'actual initial selection does not read current checked values')
 const field=selection.left.property;need(property(field,'list')&&property(checked.arguments[0],'list')&&same(field.object,checked.arguments[0].object),'actual initial selection uses different configured lists')
 const loopCallback=owner(selection),loop=p.parents.get(loopCallback)
 need(loopCallback?.params.length===1&&same(loopCallback.params[0],field.object)&&loopCallback.body.type==='BlockStatement'&&loopCallback.body.body.length===1&&loopCallback.body.body[0].expression===selection&&method(loop,'forEach')&&owner(loop)===apply&&loop.start<filtered.start,'actual initial selection callback is disconnected')
 const configs=p.resolve(loop.callee.object);need(configs?.type==='ArrayExpression'&&configs.elements.length>0&&configs.elements.length<=32,'actual configured list scope is not finite')
 const checkedFunction=fn(checked.callee),checkedReturn=returned(checkedFunction)
 need(checkedFunction?.params.length===1&&checkedFunction.body.type==='BlockStatement'&&method(checkedReturn,'map'),'actual checked selection helper differs')
 const filteredChecks=checkedReturn.callee.object,sliced=filteredChecks?.callee?.object
 need(method(filteredChecks,'filter')&&filteredChecks.arguments.length===1&&method(sliced,'call')&&sliced.arguments.length===1&&property(sliced.callee.object,'slice')&&property(sliced.callee.object.object,'prototype')&&p.builtin(sliced.callee.object.object.object,'Array'),'actual checked selection no longer reads native checkboxes')
 const selectedInputs=sliced.arguments[0];need(method(selectedInputs,'querySelectorAll')&&p.literal(selectedInputs.arguments[0])==='input[type="checkbox"]','actual checked selection selector differs')
 const checkPredicate=fn(filteredChecks.arguments[0]),checkProjection=fn(checkedReturn.arguments[0]),checkResult=returned(checkPredicate),projected=returned(checkProjection)
 need(checkPredicate?.params.length===1&&property(checkResult,'checked')&&same(checkResult.object,checkPredicate.params[0])&&checkProjection?.params.length===1&&property(projected,'value')&&same(projected.object,checkProjection.params[0]),'actual checked selection predicate/value flow differs')
 const nav=selectedInputs.callee.object,navBinding=binding(nav);need(navBinding?.defs.length===1,'actual checkbox owner is ambiguous')
 const navSelection=navBinding.defs[0].init;need(method(navSelection,'querySelector')&&p.builtin(navSelection.callee.object,'document'),'actual checkbox owner is disconnected from document')
 for(const statement of checkedFunction.body.body){
  if(statement.type==='VariableDeclaration'||statement.type==='ReturnStatement')continue
  need(statement.type==='IfStatement'&&!statement.alternate&&statement.test.type==='UnaryExpression'&&statement.test.operator==='!'&&same(statement.test.argument,nav)&&statement.consequent.type==='ReturnStatement'&&statement.consequent.argument?.type==='ArrayExpression'&&statement.consequent.argument.elements.length===0,'actual checkbox helper exits with a nonempty or unresolved default')
 }
 const body=predicate.body;need(body.type==='BlockStatement','actual initial predicate body is unavailable')
 const final=one(body.body.filter(node=>node.type==='ReturnStatement'),'actual initial predicate final return');need(final===body.body.at(-1)&&p.literal(final.argument)===true,'actual initial predicate rejects unfiltered original records')
 for(const statement of body.body.slice(0,-1)){
  if(statement.type==='IfStatement'){need(same(statement.test,predicate.params[2])&&!statement.alternate,'actual initial search guard is not empty-query dependent');continue}
  if(statement.type==='VariableDeclaration')continue
  need(statement.type==='ForStatement','actual initial predicate needs new control-flow qualification')
  const index=statement.init?.declarations?.[0],test=statement.test,update=statement.update
  need(statement.init?.type==='VariableDeclaration'&&statement.init.declarations.length===1&&p.literal(index.init)===0&&test?.type==='BinaryExpression'&&test.operator==='<'&&same(test.left,index.id)&&property(test.right,'length')&&p.resolve(test.right.object)===configs&&update?.type==='UpdateExpression'&&update.operator==='++'&&same(update.argument,index.id),'actual initial predicate loop is not the finite configured list')
  const statements=statement.body.type==='BlockStatement'?statement.body.body:[statement.body],declarations=statements.filter(node=>node.type==='VariableDeclaration').flatMap(node=>node.declarations),configured=one(declarations.filter(node=>node.init?.type==='MemberExpression'&&p.resolve(node.init.object)===configs&&same(node.init.property,index.id)),'actual predicate configured list entry'),selections=one(declarations.filter(node=>node.init?.type==='MemberExpression'&&same(node.init.object,predicate.params[1])&&property(node.init.property,'list')&&same(node.init.property.object,configured.id)),'actual predicate empty selected values')
  for(const branch of statements){if(branch.type==='VariableDeclaration')continue;need(branch.type==='IfStatement'&&!branch.alternate&&branch.test.type==='LogicalExpression'&&branch.test.operator==='&&'&&property(branch.test.left,'length')&&same(branch.test.left.object,selections.id),'actual initial predicate can reject empty selected values')}
 }
 return{selectionAssignment:selection,bindings:[binding(active)],proof:'current-empty-initial-selection-and-search-through-actual-checked-value-and-default-predicate-branches'}
}
