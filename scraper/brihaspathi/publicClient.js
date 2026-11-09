// Review only the current public vacancy data/visibility/render path. Native
// application submission code, analytics and unrelated icon modules are not
// inventory prerequisites. No client JavaScript is executed here.
import {parse} from 'acorn'
import {sha,stable,need} from '../bizongo/publicRead.js'
const company='Brihaspathi',functionNode=n=>/^(?:FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(n?.type||'')
const key=n=>n?.key?.name??n?.key?.value
const walk=(n,visit,parents=[])=>{if(!n||typeof n!=='object')return;visit(n,parents);for(const[k,v]of Object.entries(n))if(!['start','end'].includes(k)){if(Array.isArray(v))for(const child of v)walk(child,visit,[...parents,n]);else if(v&&typeof v==='object')walk(v,visit,[...parents,n])}}
const project=n=>JSON.parse(JSON.stringify(n,(k,v)=>['start','end','raw'].includes(k)?undefined:v)),fingerprint=n=>sha(stable(project(n)))
export function projectPublicClient(body){
 let ast;try{ast=parse(body,{ecmaVersion:'latest',sourceType:'script'})}catch{need(false,company,'public client JavaScript is unsupported')}
 const candidates=[],functions=[]
 walk(ast,(n,parents)=>{if(n.type==='FunctionDeclaration')functions.push(n);if(n.type==='Property'&&key(n)==='id'&&n.value?.value==='vacancies')candidates.push({node:n,parents})})
 need(candidates.length===1,company,'public vacancy renderer is missing or ambiguous')
 const {parents}=candidates[0],fn=parents.findLast(functionNode),props=parents.at(-1),section=parents.at(-2)
 need(fn?.body?.type==='BlockStatement'&&props.type==='ObjectExpression'&&section.type==='CallExpression'&&section.arguments[0]?.value==='section',company,'public vacancy renderer binding changed')
 const exportArray=parents[parents.indexOf(fn)-1],exportCall=parents[parents.indexOf(fn)-2],module=parents.slice(0,parents.indexOf(fn)).findLast(functionNode)
 need(exportArray?.type==='ArrayExpression'&&exportArray.elements.length===3&&exportArray.elements[0]?.value==='default'&&exportArray.elements[1]?.value===0&&exportArray.elements[2]===fn,company,'public vacancy default component export changed')
 need(exportCall?.type==='CallExpression'&&exportCall.arguments[0]===exportArray&&exportCall.callee?.property?.name==='s'&&module?.body?.type==='BlockStatement'&&module.body.body.some(n=>n.type==='ExpressionStatement'&&n.expression===exportCall),company,'public vacancy default registration is not unconditional')
 const motion=module.body.body.filter(n=>n.type==='VariableDeclaration').flatMap(n=>n.declarations).filter(d=>['B','F'].includes(d.id?.name))
 need(motion.length===2,company,'public native card motion bindings changed')
 const returns=[];walk(fn.body,(n,p)=>{if(n.type==='ReturnStatement'&&p.findLast(functionNode)===undefined)returns.push(n)})
 need(returns.length===1&&returns[0].argument?.type==='CallExpression',company,'public vacancy return/control flow changed')
 const root=returns[0].argument,rootProps=root.arguments[1],children=rootProps?.properties?.find(p=>key(p)==='children')?.value
 need(root.arguments[0]?.value==='div'&&children?.type==='ArrayExpression'&&children.elements.includes(section),company,'public vacancy renderer is no longer a direct root child')
 const mapper=functions.filter(n=>n.id?.name==='E'),poster=functions.filter(n=>n.id?.name==='P')
 need(mapper.length===1&&poster.length===1,company,'public native row/visibility mapping changed')
 const mapperCopy=project(mapper[0]);walk(mapperCopy,n=>{if(n.type==='ObjectExpression'&&n.properties.some(p=>key(p)==='title')&&n.properties.some(p=>key(p)==='description'))n.properties=n.properties.filter(p=>!['contactNumber','createdAt'].includes(key(p)))})
 const statements=fn.body.body.filter(n=>n.type!=='ReturnStatement').map(n=>{
  if(n.type!=='VariableDeclaration')return project(n)
  return{...project(n),declarations:n.declarations.map(d=>d.id?.name==='G'?{type:d.type,id:project(d.id),init:{type:'UnexecutedPrivateApplicationHandler'}}:project(d))}
 })
 return{defaultRegistration:sha(stable({callee:project(exportCall.callee),name:project(exportArray.elements[0]),mode:project(exportArray.elements[1]),module:project(exportCall.arguments[1])})),publicCardMotion:sha(stable(motion.map(project))),rowMapping:fingerprint(mapperCopy),posterVisibility:fingerprint(poster[0]),publicStateAndRead:sha(stable(statements)),publicVacancyRenderer:fingerprint(section),rootVisibility:sha(stable({callee:project(root.callee),tag:project(root.arguments[0]),props:rootProps.properties.filter(p=>key(p)!=='children').map(project)})),apiPath:'/strapi/api/job-openings?sort=createdAt:desc&pagination[pageSize]=100&filters[isActive][$eq]=true',criteriaRendering:'plain-native-text-clamped-to-two-lines-without-public-full-description-reveal'}
}
