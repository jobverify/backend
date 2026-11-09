import{parse,tokenizer}from'acorn'
import{createHash}from'node:crypto'
import{parseRemoteLiteral}from'../../scraper-support/utils/remoteScriptData.js'
import reviewed from'./reviewedPublicContract.json'with{type:'json'}
const need=(ok,why)=>{if(!ok)throw Error('Astronics public native client: '+why)}
const hash=value=>createHash('sha256').update(JSON.stringify(value,(key,value)=>['start','end','raw'].includes(key)?undefined:value)).digest('hex')
const one=(values,name)=>{need(values.length===1,'expected one '+name);return values[0]}
const member=node=>node?.type==='Identifier'?node.name:node?.type==='MemberExpression'&&!node.computed?member(node.object)+'.'+node.property.name:null
function program(source,module=false){need(typeof source==='string'&&source.length<=2000000,'oversized native program');let count=0,depth=0;for(const token of tokenizer(source,{ecmaVersion:'latest'})){need(++count<=300000,'native token bound exceeded');if(['{','[','(','${'].includes(token.type.label))need(++depth<=80,'native nesting bound exceeded');if(['}',']',')'].includes(token.type.label))depth--}return parse(source,{ecmaVersion:'latest',sourceType:module?'module':'script'})}
export function qualifyEmbed(source){
 const ast=program(source),assignments=ast.body.filter(node=>node.type==='ExpressionStatement'&&node.expression.type==='AssignmentExpression').map(node=>node.expression),settings=one(assignments.filter(node=>member(node.left)==='Grnhse.Settings'),'unconditional native settings')
 const data=parseRemoteLiteral(source.slice(settings.right.start,settings.right.end));need(data.targetDomain==='https://job-boards.greenhouse.io'&&data.autoLoad===true&&data.boardURI==='https://job-boards.greenhouse.io/embed/job_board?for=astronicscorporation'&&data.useEmbeddedInternalBoard===false,'public employer board settings changed')
 for(const[name,signature]of Object.entries(reviewed.embedAssignments)){const value=one(assignments.filter(node=>member(node.left)===name),'direct '+name);need(hash(value.right)===signature,'inactive or changed native board renderer '+name)}
 need(hash(ast.body.at(-1))===reviewed.embedAutoloadSignature,'native board autoload binding changed')
 const globals=ast.body.filter(node=>node.type==='VariableDeclaration').flatMap(node=>node.declarations).filter(node=>node.id.name==='Grnhse');need(globals.length===2&&globals.every(node=>node.init?.type==='LogicalExpression'&&node.init.operator==='||'&&node.init.left.name==='Grnhse'&&node.init.right.type==='ObjectExpression'&&node.init.right.properties.length===0)&&!ast.body.some(node=>node.type==='FunctionDeclaration'&&node.id.name==='Grnhse'),'native global namespace shadow changed')
 const writes=[];const walk=node=>{if(!node||typeof node!=='object')return;if(node.type==='AssignmentExpression')writes.push(node);if(node.type==='Literal')return;for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value)};walk(ast)
 need(!writes.some(node=>member(node.left)==='Grnhse'),'reassigned public native namespace')
 for(const name of['Grnhse.Settings',...Object.keys(reviewed.embedAssignments)])need(writes.filter(node=>{const target=member(node.left);return target===name||name==='Grnhse.Settings'&&target?.startsWith(name+'.')}).length===1,'mutated public native binding '+name)
 return{targetDomain:data.targetDomain,autoLoad:data.autoLoad,boardURI:data.boardURI,useEmbeddedInternalBoard:data.useEmbeddedInternalBoard,privateApplicationSettingsChecked:false}
}
export function qualifyPagination(routeSource,entrySource){
 const route=program(routeSource,true),entry=program(entrySource,true);need(hash(route)===reviewed.routeProgramSignature,'current public route-to-board binding changed')
 const declarations=entry.body.filter(node=>node.type==='VariableDeclaration').flatMap(node=>node.declarations)
 for(const[name,signature]of Object.entries(reviewed.publicEntryVariables)){const value=one(declarations.filter(node=>node.id.name===name),'public pagination binding '+name);need(hash(value.init)===signature,'public complete-array/pagination dataflow changed')}
 const exports=entry.body.filter(node=>node.type==='ExportNamedDeclaration').flatMap(node=>node.specifiers);need(exports.some(node=>node.exported.name==='o'&&node.local.name===reviewed.publicBoardExport),'published route board export changed')
 const size=one(declarations.filter(node=>node.id.name==='bi'),'native page size');need(hash(size.init)===reviewed.nativePageSizeSignature,'native page size binding changed')
 const walk=node=>{if(!node||typeof node!=='object')return;if(node.type==='AssignmentExpression'||node.type==='UpdateExpression'){const target=member(node.left||node.argument);need(![...Object.keys(reviewed.publicEntryVariables),'bi'].includes(target),'reassigned public pagination namespace')}if(node.type==='Literal')return;for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value)};walk(entry)
 return{pageSize:50,paginationQuery:'page',publicBoardExport:reviewed.publicBoardExport,unrelatedPrivateComponentsChecked:false}
}
