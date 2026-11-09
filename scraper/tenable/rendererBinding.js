import {parse} from 'acorn'
import {createHash} from 'node:crypto'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import config from './currentConfig.json' with {type:'json'}

const fail=message=>{throw new Error('Tenable declared renderer: '+message)}
const key=node=>node?.key?.name??node?.key?.value
const prop=(node,name)=>node?.properties?.find(p=>key(p)===name)?.value
const nodes=root=>{const out=[];const visit=n=>{if(!n||typeof n!=='object')return;if(n.type)out.push(n);for(const value of Object.values(n))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value)};visit(root);return out}
const member=(node,object,name)=>node?.type==='MemberExpression'&&!node.computed&&node.object?.name===object&&node.property?.name===name

// Parse the actual employer program as data. The complete program is also
// pinned: none of its library, context, filtering or URL logic is discarded.
export function verifyTenableRenderer(searchHtml,program,expected=config){
  const doc=readVisibleNativeDocument(searchHtml,{strict:true})
  const targets=doc.nodes(n=>n.tag==='tenable-job-board')
  const scripts=doc.nodes(n=>n.tag==='script'&&n.attrs.src&&new URL(n.attrs.src,expected.searchUrl).href===expected.rendererUrl)
  if(targets.length!==1||targets[0].attrs.env!=='production'||scripts.length!==1
    ||!['','module','text/javascript','application/javascript'].includes(scripts[0].attrs.type||''))fail('active production custom element and script not established')
  let ast;try{ast=parse(program,{ecmaVersion:'latest'})}catch{fail('invalid JavaScript')}
  if(ast.body.length!==1||ast.body[0].expression?.type!=='CallExpression'
    ||ast.body[0].expression.callee?.type!=='ArrowFunctionExpression')fail('program is not its declared invoked bundle')
  const all=nodes(ast)
  const apiClass=all.find(n=>n.type==='VariableDeclarator'&&n.id.name==='rr')?.init
  const method=apiClass?.body?.body.find(n=>key(n)==='all')
  if(apiClass?.type!=='ClassExpression'||apiClass.superClass?.name!=='rn'||!method?.value?.async)fail('unbound native API class')
  const body=method.value.body.body
  const declarations=body.filter(n=>n.type==='VariableDeclaration').flatMap(n=>n.declarations)
  const uri=declarations.find(n=>n.id.name==='a')?.init
  if(uri?.type!=='TemplateLiteral'||uri.quasis.length!==2||uri.quasis[0].value.cooked!==''
    ||uri.quasis[1].value.cooked!=='/evaluations/api/v1/jobs'||uri.expressions.length!==1
    ||uri.expressions[0].object?.type!=='ThisExpression'||uri.expressions[0].property?.name!=='baseUrl')fail('unfiltered first-party API URL changed')
  const call=declarations.find(n=>n.id.name==='e')?.init?.argument
  if(call?.type!=='CallExpression'||call.callee?.name!=='fetch'||call.arguments[0]?.name!=='a'
    ||prop(call.arguments[1],'method')?.value!=='GET')fail('native full-feed GET changed')
  const constructor=all.find(n=>n.type==='VariableDeclarator'&&n.id.name==='rn')?.init?.body?.body.find(n=>key(n)==='constructor')
  if(!nodes(constructor).some(n=>n.type==='VariableDeclarator'&&n.id.name==='e'&&n.init?.value==='https://www.tenable.com'))fail('production API origin changed')
  const component=all.find(n=>n.type==='VariableDeclarator'&&n.id.name==='rs')?.init||all.find(n=>n.type==='ClassDeclaration'&&n.id.name==='rs')
  const connected=component?.body?.body.find(n=>key(n)==='connectedCallback')
  if(!nodes(connected).some(n=>n.type==='NewExpression'&&n.callee?.name==='rr'))fail('component does not instantiate native API')
  const first=component?.body?.body.find(n=>key(n)==='firstUpdated')
  const firstNodes=nodes(first)
  if(!first?.value?.async||!firstNodes.some(n=>n.type==='AwaitExpression'&&n.argument?.callee?.object?.property?.name==='JobBoardApi'
      &&n.argument.callee.property?.name==='all')
    ||!firstNodes.some(n=>n.type==='AssignmentExpression'&&n.left.object?.type==='ThisExpression'&&n.left.property?.name==='jobs'&&n.right.name==='a'))fail('component full jobs assignment changed')
  const registration=all.filter(n=>n.type==='CallExpression'&&member(n.callee,'customElements','define')&&n.arguments[0]?.value==='tenable-job-board')
  if(registration.length!==1||registration[0].arguments[1]?.type!=='ClassExpression')fail('custom element registration changed')
  const country=all.find(n=>n.type==='VariableDeclarator'&&n.id.name===expected.countryAlias.actualRendererVariable)?.init
  if(country?.type!=='ArrayExpression'||country.elements[0]?.value!==expected.countryAlias.nativeLabel
    ||country.elements[1]?.value!==expected.countryAlias.countryCode)fail('publisher country-name/code pair changed')
  const sha256=createHash('sha256').update(program).digest('hex')
  if(sha256!==expected.rendererSha256)fail('complete unreviewed program bytes')
  return {url:expected.rendererUrl,sha256,apiUrl:expected.firstPartyApiUrl,productionElement:'tenable-job-board',
    countryAlias:{nativeLabel:country.elements[0].value,countryCode:country.elements[1].value,variable:expected.countryAlias.actualRendererVariable},
    method:'actual-visible-production-element-invoked-program-native-GET-and-full-jobs-assignment'}
}
