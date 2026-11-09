import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'

export const sha=value=>createHash('sha256').update(value).digest('hex')
export const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v)
export const walk=(value,fn)=>{if(!value||typeof value!=='object')return;fn(value);for(const child of Object.values(value))if(Array.isArray(child))child.forEach(v=>walk(v,fn));else if(child&&typeof child==='object')walk(child,fn)}

// Traverse raw children, including hidden/template/noscript branches. Comments
// are omitted by the unchanged tree reader; all text, attributes, raw program
// and style bodies, order and inert context remain in the fingerprint.
export function publisherDom(html){
 const root=readNativeDocument(html).nodes(n=>n.tag==='root')[0]
 const copy=node=>typeof node==='string'?node:{tag:node.tag,attrs:node.attrs,inert:node.inert===true,raw:node.raw??null,children:node.children.map(copy)}
 return copy(root)
}
export function inspectPublisher(html,official){
 const tree=publisherDom(html),scripts=[],styles=[],declarations=[],flight=[]
 function visit(node,path=[]){
  if(typeof node==='string')return
  if(node.tag==='script'){
   scripts.push({path,attrs:node.attrs,raw:node.raw,inert:node.inert})
   if(node.attrs.src)declarations.push({kind:'script',url:new URL(node.attrs.src,official).href,path,attrs:node.attrs,inert:node.inert})
   else if((node.raw||'').includes('__next_f')){
    const ast=parse(node.raw,{ecmaVersion:'latest'})
    // Only the actual unconditional literal Flight push statements provide
    // records. The entire program/stream is also pinned, including T records.
    for(const statement of ast.body){const call=statement.expression
     if(statement.type!=='ExpressionStatement'||call?.type!=='CallExpression'||call.callee?.type!=='MemberExpression'||call.callee.property?.name!=='push')throw Error('unreviewed-flight-program')
     const array=call.arguments[0]
     if(array?.type!=='ArrayExpression'||!array.elements.every(e=>e?.type==='Literal'))throw Error('nonliteral-flight-push')
     if(array.elements[0].value===1){if(typeof array.elements[1]?.value!=='string')throw Error('invalid-flight-text');flight.push(array.elements[1].value)}
    }
   }
  }
  if(node.tag==='style')styles.push({path,attrs:node.attrs,raw:node.raw,inert:node.inert})
  if(node.tag==='link'&&node.attrs.rel==='stylesheet')declarations.push({kind:'stylesheet',url:new URL(node.attrs.href,official).href,path,attrs:node.attrs,inert:node.inert})
  node.children.forEach((child,index)=>visit(child,[...path,index]))
 }
 visit(tree)
 const stream=flight.join(''),records=[]
 for(const line of stream.split('\n')){const match=line.match(/^([0-9a-f]+):(I?)([\[{].*)$/);if(match)try{records.push({id:match[1],value:JSON.parse(match[3])})}catch{/* Full raw stream fingerprint retains non-JSON/T grammar. */}}
 const imported=records.find(r=>r.id==='60'),section=records.find(r=>r.id==='5e'),elements=[]
 walk(section?.value,value=>{if(Array.isArray(value)&&value[0]==='$'&&value[1]==='$L60')elements.push(value)})
 let departments,jobs,format
 if(imported?.value?.[0]===71768&&imported.value[2]==='Departments'&&elements.length===1&&Array.isArray(elements[0][3]?.departments)){
  departments=elements[0][3].departments;format='webpack-departments'
 }else{
  // The redesigned route supplies literal role rows to module1245. Read its
  // assigned data as observations only; the historical program/DOM pins below
  // remain unchanged and cannot certify this new renderer as complete.
  const client=records.find(r=>r.id==='3e'),section=records.find(r=>r.id==='3c'),props=section?.value?.[3]
  if(client?.value?.[0]!==1245||client.value[2]!=='default'||section?.value?.[0]!=='$'||section.value[1]!=='$L3e'||props?.heading!=='Open Roles'||!Array.isArray(props.jobs)||props.jobs.length>2000)throw Error('actual-flight-departments-route-binding-unavailable')
  jobs=props.jobs
  const fields=['id','title','team','location','url','department','locations']
  if(new Set(jobs.map(row=>row?.id)).size!==jobs.length||jobs.some(row=>!row||Object.keys(row).some(k=>!fields.includes(k))||fields.some(k=>!Object.hasOwn(row,k))||!['id','title','team','url','department'].every(k=>typeof row[k]==='string')||!['location','locations'].every(k=>Array.isArray(row[k])&&row[k].length>0&&row[k].every(v=>typeof v==='string'))||!/^[-a-z0-9]+$/.test(row.id)||row.url!=='https://jobs.ashbyhq.com/baseten/'+row.id))throw Error('unqualified-current-literal-job-list')
  format='turbopack-literal-job-list'
 }
 // Flight also declares styles not represented by a raw DOM link. No imports
 // are executed; the complete stream stays pinned before these are trusted.
 walk(records,value=>{if(typeof value==='object'&&Array.isArray(value)&&value[0]==='$'&&value[1]==='link'&&value[3]?.rel==='stylesheet')declarations.push({kind:'stylesheet',url:new URL(value[3].href,official).href,flight:true,attrs:value[3]})})
 return {tree,scripts,styles,declarations,stream,records,format,...(departments?{departments,departmentsSha256:sha(stable(departments))}:{jobs,departmentsSha256:null}),streamSha256:sha(stream),domSha256:sha(stable(tree))}
}
export function moduleProof(program,id){
 const ast=parse(program,{ecmaVersion:'latest'}),modules=[]
 walk(ast,node=>{if(node.type==='Property'&&Number(node.key?.value??node.key?.name)===id&&['ArrowFunctionExpression','FunctionExpression'].includes(node.value?.type))modules.push(program.slice(node.value.start,node.value.end))})
 if(modules.length!==1)throw Error('declared-webpack-module-not-unique:'+id)
 return {id,sha256:sha(modules[0]),program:modules[0]}
}
export function nativeAppState(html){
 const doc=readNativeDocument(html),nodes=doc.nodes(n=>n.tag==='script'&&!n.attrs.src&&!Object.hasOwn(n.attrs,'nomodule')&&/^(?:|module|(?:text|application)\/javascript)$/i.test(n.attrs.type||'')&&/window\.__appData\s*=/.test(n.raw||''))
 if(nodes.length!==1)throw Error('native-app-active-assignment-not-unique')
 const node=nodes[0],ast=parse(node.raw,{ecmaVersion:'latest'}),statement=ast.body[0],assignment=statement?.expression
 if(statement?.type!=='ExpressionStatement'||assignment?.type!=='AssignmentExpression'||assignment.operator!=='='||assignment.left?.computed||assignment.left?.object?.name!=='window'||assignment.left?.property?.name!=='__appData'||assignment.right?.type!=='ObjectExpression')throw Error('native-app-not-unconditional-literal')
 return {app:JSON.parse(node.raw.slice(assignment.right.start,assignment.right.end)),bootstrapSha256:sha(node.raw.slice(statement.end)),attrs:node.attrs}
}
