import {parse} from 'acorn'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'

const need=(ok,message)=>{if(!ok)throw Object.assign(Error('Mastercard current publication: '+message),{softFailure:true,abortRetries:true,lifecycleCleanupAllowed:false})}
const property=node=>node?.type==='MemberExpression'&&(!node.computed&&node.property.type==='Identifier'?node.property.name:node.computed&&node.property.type==='Literal'?node.property.value:null)
const ddoTarget=node=>node?.type==='MemberExpression'&&(node.object?.type==='Identifier'&&node.object.name==='phApp'&&property(node)==='ddo'||ddoTarget(node.object))
const contextField=node=>node?.type==='MemberExpression'?(node.object?.type==='Identifier'&&node.object.name==='phApp'?property(node):contextField(node.object)):null
const schemaContext=value=>typeof value==='string'&&/^https?:\/\/schema[.]org\/?$/.test(value)
export const hasCurrentSchemaType=(value,type)=>(Array.isArray(value)?value:[value]).some(v=>typeof v==='string'&&(v===type||v==='http://schema.org/'+type||v==='https://schema.org/'+type))
export function validateCurrentSchemaVocabulary(model,inheritedContexts=[]){
 const queue=[model],contexts=[...inheritedContexts];let count=0
 while(queue.length){const value=queue.pop();if(!value||typeof value!=='object')continue;need(++count<=10000,'Native scoped schema model exceeds bound');if(Object.hasOwn(value,'@context'))contexts.push(value['@context']);for(const child of Object.values(value))if(child&&typeof child==='object')queue.push(child)}
 need(contexts.every(schemaContext),'Native scoped schema vocabulary context differs')
}
// Read the actual active unconditional literal assignments. Never execute page
// programs or accept aliases, duplicate decoded keys or later nested mutations.
export function readCurrentDocument(html){
 const document=readNativeDocument(html),contexts=[],models=[],writes=[],references=[]
 need(!document.nodes(n=>n.tag==='base'||n.tag==='meta'&&/refresh/i.test(n.attrs['http-equiv']??'')).length,'Unreviewed document navigation')
 const scripts=document.nodes(n=>n.tag==='script'&&!n.inert&&!n.attrs.src&&!Object.hasOwn(n.attrs,'nomodule')&&['','text/javascript','application/javascript','module'].includes((n.attrs.type??'').toLowerCase()))
 for(const script of scripts){
  if(!/\bphApp\b/.test(script.raw??''))continue
  const root=parse(script.raw,{ecmaVersion:'latest',sourceType:script.attrs.type==='module'?'module':'script'}),queue=[{node:root,parent:null,grandparent:null}]
  while(queue.length){
   const {node,parent,grandparent}=queue.pop();if(!node||typeof node!=='object')continue
   if(node.type==='AssignmentExpression'||node.type==='UpdateExpression'||node.type==='UnaryExpression'&&node.operator==='delete'){
    const field=contextField(node.left??node.argument)
    need(!['baseUrl','baseDomain','rootDomain','refNum','siteType','widgetApiEndpoint','__proto__','prototype','constructor'].includes(field),'Native publisher context mutation')
   }
   if(node.type==='VariableDeclarator'&&node.id?.name==='phApp'){
    need(parent.type==='VariableDeclaration'&&grandparent.type==='Program'&&node.init?.type==='LogicalExpression'&&node.init.operator==='||'&&node.init.left.name==='phApp'&&node.init.right.type==='ObjectExpression','Nonliteral native context')
    contexts.push(readLiteralModel(script.raw.slice(node.init.right.start,node.init.right.end)).value)
   }
   if(node.type==='AssignmentExpression'&&ddoTarget(node.left)||node.type==='UpdateExpression'&&ddoTarget(node.argument)||node.type==='UnaryExpression'&&node.operator==='delete'&&ddoTarget(node.argument)){
    writes.push(node);need(node.type==='AssignmentExpression'&&node.operator==='='&&property(node.left)==='ddo'&&node.left.object.name==='phApp'&&node.right.type==='ObjectExpression'&&parent.type==='ExpressionStatement'&&grandparent.type==='Program','Native model mutation or conditional publication')
    models.push(readLiteralModel(script.raw.slice(node.right.start,node.right.end)).value)
   }
   if(ddoTarget(node)&&!(parent?.type==='AssignmentExpression'&&parent.left===node&&property(node)==='ddo'))references.push(node)
   if(node.type==='Identifier'&&node.name==='phApp'){
    const safe=parent?.type==='MemberExpression'&&(parent.object===node||parent.property===node&&!parent.computed)||parent?.type==='VariableDeclarator'&&parent.id===node||parent?.type==='LogicalExpression'&&parent.operator==='||'&&parent.left===node&&grandparent?.type==='VariableDeclarator'&&grandparent.id?.name==='phApp'
    need(safe,'Ambiguous native model alias or escaped root')
   }
   if(node.type==='MemberExpression'&&node.object?.type==='Identifier'&&['window','self','globalThis'].includes(node.object.name)&&property(node)==='phApp'){
    // The current chatbot declaration reads only this fixed navigation scalar.
    need(parent?.type==='MemberExpression'&&parent.object===node&&property(parent)==='baseUrl'&&!(grandparent?.type==='AssignmentExpression'&&grandparent.left===parent)&&grandparent?.type!=='UpdateExpression','Ambiguous native global alias')
   }
   if(node.type==='Literal')continue
   for(const value of Object.values(node))if(Array.isArray(value))queue.push(...value.map(child=>({node:child,parent:node,grandparent:parent})));else if(value&&typeof value==='object')queue.push({node:value,parent:node,grandparent:parent})
  }
 }
 need(contexts.length===1&&models.length===1&&writes.length===1&&!references.length,'Missing or ambiguous active original native context/model')
 const schemas=[]
 for(const node of document.nodes(n=>n.tag==='script'&&!n.inert&&n.attrs.type==='application/ld+json')){
  const model=readLiteralModel(node.raw).value,queue=[{value:model,contexts:[]}]
  while(queue.length){const {value,contexts}=queue.pop();if(!value||typeof value!=='object')continue;if(hasCurrentSchemaType(value['@type'],'JobPosting')){validateCurrentSchemaVocabulary(value,contexts);schemas.push(value)}const inherited=Object.hasOwn(value,'@context')?[...contexts,value['@context']]:contexts;if(Array.isArray(value))queue.push(...value.map(value=>({value,contexts:inherited})));else if(value['@graph'])queue.push({value:value['@graph'],contexts:inherited})}
 }
 const links=document.nodes(n=>n.tag==='a'&&n.attrs.href).map(n=>({href:n.attrs.href,text:document.text(n)}))
 const canonicals=document.nodes(n=>n.tag==='link'&&(n.attrs.rel??'').toLowerCase().split(/\s+/).includes('canonical')).map(n=>n.attrs.href)
 need(canonicals.length<=1,'Ambiguous original canonical')
 return {context:contexts[0],model:models[0],schemas,links,canonical:canonicals[0]??null}
}
