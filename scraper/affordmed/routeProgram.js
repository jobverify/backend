import {parse} from 'acorn'
const bad=()=>{throw Error('Affordmed current public route program unqualified')}
const field=(node,key)=>{if(node?.type!=='ObjectExpression'||node.properties.some(p=>p.type!=='Property'||p.computed||p.kind!=='init'||p.method||p.shorthand))bad();const matches=node.properties.filter(p=>(p.key.name??p.key.value)===key);if(matches.length>1)bad();return matches[0]?.value}
const ident=node=>node?.type==='Identifier'?node.name:null
const member=(node,property)=>node?.type==='MemberExpression'&&!node.computed&&node.property.name===property
const trueLiteral=node=>node?.type==='Literal'&&node.value===true||node?.type==='UnaryExpression'&&node.operator==='!'&&node.argument.type==='Literal'&&node.argument.value===0
export function readAffordmedRouteProgram(javascript){
 let ast;try{ast=parse(javascript,{sourceType:'module',ecmaVersion:'latest'})}catch{bad()}
 const declarations=new Map()
 for(const node of ast.body){const values=node.type==='VariableDeclaration'?node.declarations:['FunctionDeclaration','ClassDeclaration'].includes(node.type)?[{id:node.id,init:node}]:[];for(const binding of values){const name=ident(binding.id);if(name){if(declarations.has(name))bad();declarations.set(name,binding.init)}}}
 if(declarations.has('document'))bad()
 const roots=ast.body.filter(n=>n.type==='ExpressionStatement'&&n.expression.type==='CallExpression'&&member(n.expression.callee,'render')),render=roots.length===1?roots[0].expression:null,creation=render?.callee.object
 if(!creation||creation.type!=='CallExpression'||!member(creation.callee,'createRoot')||creation.arguments.length!==1)bad()
 const target=creation.arguments[0];if(target.type!=='CallExpression'||!member(target.callee,'getElementById')||ident(target.callee.object)!=='document'||target.arguments.length!==1||target.arguments[0].value!=='root')bad()
 const jsx=render.arguments[0],app=declarations.get(ident(jsx?.arguments?.[0]));if(render.arguments.length!==1||jsx?.type!=='CallExpression'||!member(jsx.callee,'jsx')||app?.type!=='FunctionDeclaration'||app.params.length||app.body.body.length!==1)bad()
 const returned=app.body.body[0].argument;if(app.body.body[0].type!=='ReturnStatement'||returned?.type!=='CallExpression'||!member(returned.callee,'jsx'))bad()
 const routerName=ident(field(returned.arguments[1],'router')),init=declarations.get(routerName)
 if(!routerName||init?.type!=='CallExpression'||!ident(init.callee)||!declarations.has(init.callee.name)||init.arguments.length!==1||init.arguments[0].type!=='ArrayExpression')bad()
 const names=new Set([routerName,app.id.name,init.callee.name,'document']),directWrite=node=>{if(!node||typeof node!=='object'||/Function|Class/.test(node.type))return;const left=node.type==='AssignmentExpression'||node.type==='UpdateExpression'?node.left??node.argument:null;if(left&&names.has(ident(left)))bad();for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(directWrite);else if(value&&typeof value==='object')directWrite(value)}}
 ast.body.forEach(directWrite)
 const rootsArray=init.arguments[0].elements;if(rootsArray.length!==1||field(rootsArray[0],'path')?.value!=='/')bad()
 const children=field(rootsArray[0],'children');if(children?.type!=='ArrayExpression')bad()
 const rows=children.elements.map(node=>{if(node?.type!=='ObjectExpression'||node.properties.some(p=>!['path','index','Component'].includes(p.key?.name??p.key?.value)))bad();const path=field(node,'path'),index=field(node,'index'),component=ident(field(node,'Component'));if(!component||!declarations.has(component)||path&&typeof path.value!=='string'||index&&!trueLiteral(index))bad();return{path:index?'':path?.value,component,index:!!index}})
 const indexes=rows.filter(r=>r.index),fallbacks=rows.filter(r=>r.path==='*');if(indexes.length!==1||fallbacks.length!==1)bad()
 return{rootId:'root',routes:['/',...rows.filter(r=>!r.index).map(r=>'/'+r.path)],careersRouteDeclared:rows.some(r=>r.path==='careers'||r.path==='careers/'),configuredPathUsesHomeFallback:!rows.some(r=>r.path==='careers'||r.path==='careers/')&&indexes[0].component===fallbacks[0].component,qualification:'nonexecuting-actual-root-renderer-router-data-binding;not-hiring-inventory-or-employer-wide-zero-proof'}
}
