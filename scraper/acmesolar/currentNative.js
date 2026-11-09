import {collectContext,asset,javascript,visit,property,literal,strings,executableRoleClients,sha,fail} from '../aadyahaerospace/publicSource.js'
const ENTRY='https://www.acmesolar.in/career',FORM='https://www.acmesolar.in/career_form',CONFIG={source:'acmesolar',company:'ACME Solar',entry:ENTRY}
export function formModel(body){
 const ast=javascript(body),functions=new Map(),maps=[]
 visit(ast,node=>{
  if(node.type==='FunctionDeclaration'&&node.id)functions.set(node.id.name,node)
  if(node.type==='ObjectExpression'&&property(node,'/career')&&property(node,'/career_form'))maps.push(node)
 })
 if(maps.length!==1)throw fail('ACME current native careers route map changed')
 const route=property(maps[0],'/career'),form=property(maps[0],'/career_form')
 if(route.type!=='Identifier'||form.type!=='Identifier'||!functions.has(route.name)||!functions.has(form.name))throw fail('ACME current native careers controllers changed')
 const controller=functions.get(form.name),values=strings(controller),controls=[]
 visit(controller,node=>{
  if(node.type!=='CallExpression'||!['jsx','jsxs'].includes(node.callee?.property?.name))return
  const tag=literal(node.arguments[0]),props=node.arguments[1]
  if(['input','select','option','button','form','a'].includes(tag))controls.push({tag,type:literal(property(props,'type'))||null,name:literal(property(props,'name'))||null,
   href:literal(property(props,'href'))||null,placeholder:literal(property(props,'placeholder'))||null})
 })
 const contacts=controls.filter(row=>row.tag==='a'&&row.href?.startsWith('mailto:')).map(row=>row.href.slice(7))
 if(contacts.length!==1||contacts[0]!=='careers@acme.in'||!values.includes('Join us | ACME Solar')||!values.includes('Career Enquiry')||!values.includes('POST'))throw fail('ACME current native form employer or contact binding changed')
 const possible=executableRoleClients(controller)
 if(controls.some(row=>row.tag==='select'||['job_id','role_id','position_id'].includes(row.name)))possible.push({kind:'unreviewed-native-role-form-controls',url:FORM})
 for(const name of ['name','email','cv_file'])if(!controls.some(row=>row.tag==='input'&&row.name===name))throw fail('ACME current general resume form schema changed')
 return{email:contacts[0],formControls:controls.filter(row=>row.tag==='input'),applicationUrl:FORM,applicationActionPerformed:false,possible}
}
export const createCurrentScraper=()=>({run:options=>collectContext(CONFIG,options||{},async scope=>{
 const snapshot=async phase=>{
  const html=await scope.read(ENTRY,'html',phase),formHtml=await scope.read(FORM,'html',phase)
  const url=asset(html,ENTRY,/^\/assets\/index-[\w-]+\.js$/)
  if(asset(formHtml,FORM,/^\/assets\/index-[\w-]+\.js$/)!==url)throw fail('ACME public careers shells disagree on client identity')
  const body=await scope.read(url,'javascript',phase)
  return{model:formModel(body),clientSha256:sha(body)}
 }
 const first=await snapshot('initial'),last=await snapshot('closing')
 return scope.finish({observations:[{kind:'general-resume-form',url:ENTRY,vacancy:false,country:null,postingDate:null,descriptionComplete:false,email:first.model.email,applicationUrl:FORM}],
  nativeContext:{...first.model,clientSha256:first.clientSha256},possible:[...first.model.possible,...last.model.possible],
  closingMatches:JSON.stringify(first)===JSON.stringify(last),reason:'public-general-resume-form-without-enumerable-native-vacancy-inventory'})
})})
