import{parse,tokenizer}from'acorn'
import{createHash}from'node:crypto'
import reviewed from'./reviewedPublicContract.json'with{type:'json'}
const need=(ok,why)=>{if(!ok)throw Error('amicable native executable client: '+why)}
const signature=value=>createHash('sha256').update(JSON.stringify(value,(key,value)=>['start','end','raw'].includes(key)?undefined:value)).digest('hex')
const member=node=>node?.type==='Identifier'?node.name:node?.type==='MemberExpression'&&!node.optional?(node.computed?node.property.type==='Literal'?member(node.object)+'.'+node.property.value:null:member(node.object)+'.'+node.property.name):null
const one=(values,label)=>{need(values.length===1,'expected one '+label);return values[0]}
export function qualifyScreenloopClient(source,contract=reviewed){
 need(typeof source==='string'&&Buffer.byteLength(source)<=16000000,'oversized public client')
 let count=0,depth=0
 for(const token of tokenizer(source,{ecmaVersion:'latest'})){need(++count<=3000000,'public token bound exceeded');if(['{','[','(','${'].includes(token.type.label))need(++depth<=80,'public nesting bound exceeded');if(['}',']',')'].includes(token.type.label))depth--}
 const ast=parse(source,{ecmaVersion:'latest',sourceType:'script'}),statements=ast.body.filter(node=>node.type!=='EmptyStatement'),entry=one(statements,'unconditional public program')
 need(entry.type==='ExpressionStatement'&&entry.expression.type==='CallExpression'&&entry.expression.arguments.length===0&&entry.expression.callee.type==='ArrowFunctionExpression'&&entry.expression.callee.params.length===0&&entry.expression.callee.body.type==='BlockStatement','inactive or changed public program entry')
 const body=entry.expression.callee.body.body,bindings=body.flatMap(node=>node.type==='FunctionDeclaration'?[{name:node.id.name,node}]:node.type==='VariableDeclaration'?node.declarations.filter(node=>node.id.type==='Identifier').map(node=>({name:node.id.name,node})):[])
 const binding=name=>one(bindings.filter(row=>row.name===name),'direct public '+name+' binding').node
 for(const[name,hash]of Object.entries(contract.functions)){const node=binding(name);need(node.type==='FunctionDeclaration'&&signature(node)===hash,'changed public '+name+' inventory/detail dataflow')}
 for(const[name,hash]of Object.entries({...contract.classes,...contract.imports})){const node=binding(name);need(node.type==='VariableDeclarator'&&signature(node.init)===hash,'changed public dependency '+name)}
 const registry=binding('containers');need(registry.init?.type==='ObjectExpression','public React registry changed')
 for(const entry of[contract.registry,contract.detailRegistry]){const property=one(registry.init.properties.filter(property=>property.type==='Property'&&!property.computed&&property.key.value===entry.component),'registered public component');need(property.value.type==='Identifier'&&property.value.name===entry.binding,'public component registration binding changed')}
 const manager=binding('pluginManager');need(manager.init?.type==='NewExpression'&&manager.init.callee.name==='PluginManager'&&manager.init.arguments.length===0,'public plugin manager changed')
 const direct=body.filter(node=>node.type==='ExpressionStatement').map(node=>node.expression)
 need(direct.filter(node=>node.type==='CallExpression'&&member(node.callee)==='pluginManager.register'&&node.arguments.length===1&&node.arguments[0].type==='NewExpression'&&node.arguments[0].callee.name==='ReactPlugin').length===1,'inactive public React plugin registration')
 need(direct.filter(node=>node.type==='CallExpression'&&member(node.callee)==='pluginManager.install'&&node.arguments.length===0).length===1,'inactive public plugin installation')
 const protectedNames=[...Object.keys(contract.functions),...Object.keys(contract.classes),...Object.keys(contract.imports),'containers','pluginManager']
 const walk=node=>{if(!node||typeof node!=='object')return
  const target=node.type==='AssignmentExpression'?member(node.left):node.type==='UpdateExpression'?member(node.argument):node.type==='UnaryExpression'&&node.operator==='delete'?member(node.argument):null
  need(!target||!protectedNames.some(name=>target===name||target.startsWith(name+'.')),'reassigned public component/client namespace')
  if(node.type==='Literal')return
  for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value)
 };walk(entry.expression.callee.body)
 return{method:'bounded-syntax-only-public-components-and-React-registration',publicFunctions:Object.keys(contract.functions),publicImports:Object.keys(contract.imports),privateApplicationComponentsChecked:false}
}
