import {parse} from 'acorn'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'

const roots=new Set(['_XC_CONFIG','cws_opts','current_job'])
const need=(ok,message)=>{if(!ok)throw Error('DXC native model: '+message)}
const property=node=>node?.type==='MemberExpression'&&(!node.computed&&node.property.type==='Identifier'?node.property.name:node.computed&&node.property.type==='Literal'?node.property.value:null)
const rootName=node=>node?.type==='Identifier'&&roots.has(node.name)?node.name:node?.type==='MemberExpression'?(node.object?.type==='Identifier'&&['window','self','globalThis'].includes(node.object.name)&&roots.has(property(node))?property(node):rootName(node.object)):null
export const hasSchemaType=(value,type)=>(Array.isArray(value)?value:[value]).some(v=>[type,'https://schema.org/'+type,'http://schema.org/'+type].includes(v))
export function validateSchema(model,contexts=[]){
 const queue=[model],all=[...contexts];let count=0
 while(queue.length){const value=queue.pop();if(!value||typeof value!=='object')continue;need(++count<=10000,'Scoped schema bound');if(Object.hasOwn(value,'@context'))all.push(value['@context']);for(const child of Object.values(value))if(child&&typeof child==='object')queue.push(child)}
 need(all.every(v=>typeof v==='string'&&/^https?:\/\/schema[.]org\/?$/.test(v)),'Conflicting scoped schema vocabulary')
}
export function readCurrentModels(html){
 const dom=readNativeDocument(html),models=Object.fromEntries([...roots].map(name=>[name,[]])),schemas=[],unqualifiedNativeAssignments=[]
 need(!dom.nodes(n=>n.tag==='base'||n.tag==='meta'&&/refresh/i.test(n.attrs['http-equiv']??'')).length,'Ambiguous native navigation')
 for(const script of dom.nodes(n=>n.tag==='script'&&!n.attrs.src&&!Object.hasOwn(n.attrs,'nomodule')&&['','text/javascript','application/javascript','module'].includes((n.attrs.type??'').toLowerCase()))){
  const tree=parse(script.raw,{ecmaVersion:'latest',sourceType:script.attrs.type==='module'?'module':'script'}),queue=[{node:tree,parent:null,grandparent:null}]
  while(queue.length){
   const {node,parent,grandparent}=queue.pop();if(!node||typeof node!=='object')continue
   if(node.type==='VariableDeclarator'&&roots.has(node.id?.name)){
    need(parent.type==='VariableDeclaration'&&grandparent.type==='Program'&&node.init?.type==='ObjectExpression','Nonliteral/conditional native root')
    models[node.id.name].push(readLiteralModel(script.raw.slice(node.init.start,node.init.end)).value)
   }
   if(node.type==='AssignmentExpression'||node.type==='UpdateExpression'||node.type==='UnaryExpression'&&node.operator==='delete'){
    // The actual native page clears this candidate-login preference. It does
    // not rewrite the publisher/account or the retained vacancy model.
    const preference=node.type==='AssignmentExpression'&&node.operator==='='&&node.left.type==='MemberExpression'&&node.left.object.name==='_XC_CONFIG'&&property(node.left)==='remember_me_candidate'&&node.right.type==='Literal'&&node.right.value===null&&parent.type==='ExpressionStatement'&&grandparent.type==='Program'
    need(!rootName(node.left??node.argument)||preference,'Native root mutation')
    if(preference)unqualifiedNativeAssignments.push({target:'_XC_CONFIG.remember_me_candidate',value:null,meaning:'candidate-login-preference;not-vacancy-publication'})
   }
   if(node.type==='MemberExpression'&&node.object?.type==='Identifier'&&['window','self','globalThis'].includes(node.object.name)&&roots.has(property(node)))need(false,'Native global root replacement or alias')
   if(node.type==='Identifier'&&roots.has(node.name)){
    const declaration=parent?.type==='VariableDeclarator'&&parent.id===node
    const member=parent?.type==='MemberExpression'&&(parent.object===node||parent.property===node&&!parent.computed)
    need(declaration||member,'Escaped native root alias')
   }
   if(node.type==='Literal')continue
   for(const value of Object.values(node))if(Array.isArray(value))queue.push(...value.map(child=>({node:child,parent:node,grandparent:parent})));else if(value&&typeof value==='object')queue.push({node:value,parent:node,grandparent:parent})
  }
 }
 for(const name of roots)need(models[name].length<2,'Duplicate native root '+name)
 for(const script of dom.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json')){
  const root=readLiteralModel(script.raw).value,queue=[{value:root,contexts:[]}]
  while(queue.length){const{value,contexts}=queue.pop();if(!value||typeof value!=='object')continue;if(hasSchemaType(value['@type'],'JobPosting')){validateSchema(value,contexts);schemas.push(value)}const inherited=Object.hasOwn(value,'@context')?[...contexts,value['@context']]:contexts;if(Array.isArray(value))queue.push(...value.map(value=>({value,contexts:inherited})));else if(value['@graph'])queue.push({value:value['@graph'],contexts:inherited})}
 }
 const canonicals=dom.nodes(n=>n.tag==='link'&&(n.attrs.rel??'').split(/\s+/).includes('canonical')).map(n=>n.attrs.href)
 need(canonicals.length===1,'Missing/ambiguous native canonical')
 return{dom,models:Object.fromEntries(Object.entries(models).map(([name,values])=>[name,values[0]??null])),schemas,canonical:canonicals[0],unqualifiedNativeAssignments}
}
