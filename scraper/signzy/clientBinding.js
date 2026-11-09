import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import config from './currentConfig.json' with {type:'json'}

const sha = value => createHash('sha256').update(value).digest('hex')
const fail = message => { throw new Error(`Signzy active client binding: ${message}`) }
const key = node => node?.key?.name ?? node?.key?.value
const property = (node, name) => node?.properties?.find(p => key(p) === name)?.value
const member = (node, object, name) => node?.type === 'MemberExpression' && !node.computed
  && node.object?.name === object && node.property?.name === name
const descendants = node => {
  const found=[]
  const visit = value => {
    if (!value || typeof value !== 'object') return
    if (value.type) found.push(value)
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) child.forEach(visit)
      else if (child && typeof child === 'object') visit(child)
    }
  }
  visit(node)
  return found
}
const parsed = text => { try { return parse(text,{ecmaVersion:'latest'}) } catch { fail('invalid publisher JavaScript') } }
const jsx = node => node?.type === 'CallExpression' && node.callee?.type === 'SequenceExpression'
  && node.callee.expressions.length === 2 && node.callee.expressions[0].value === 0
  && ['jsx','jsxs'].some(name => member(node.callee.expressions[1],'s',name))

// This validates the publisher's real Flight -> webpack default-page ->
// NextScript chain as data. No remote program is evaluated or rewritten.
export function validateClientBinding({corporateHtml,routeBody,bridgeBody}, expected=config) {
  const document=readNativeDocument(corporateHtml)
  const scripts=document.nodes(n=>n.tag==='script'&&n.attrs.src)
  if (scripts.filter(n=>new URL(n.attrs.src,expected.officialUrl).href===expected.routeUrl).length!==1
      || scripts.filter(n=>new URL(n.attrs.src,expected.officialUrl).href===expected.bridgeUrl).length!==1) fail('missing declared route or NextScript bridge')
  const visible=readVisibleNativeDocument(corporateHtml,{strict:true})
  if (visible.nodes(n=>n.attrs.id==='khembedjobs').length!==1) fail('missing visible SSR target container')
  let flight=''
  for (const script of document.nodes(n=>n.tag==='script'&&!n.attrs.src&&(!n.attrs.type||n.attrs.type==='text/javascript'))) {
    for (const statement of parsed(script.raw||'').body) {
      const call=statement.type==='ExpressionStatement'&&statement.expression
      if (call?.type!=='CallExpression'||call.callee?.type!=='MemberExpression'||call.callee.computed
          ||call.callee.property?.name!=='push'||!member(call.callee.object,'self','__next_f')) continue
      const values=call.arguments[0]
      if (values?.type==='ArrayExpression'&&values.elements[0]?.value===1&&typeof values.elements[1]?.value==='string') flight+=values.elements[1].value
    }
  }
  const rows=flight.split('\n')
  const readRow = prefix => { const matches=rows.filter(r=>r.startsWith(prefix));if(matches.length!==1)fail('ambiguous Flight page ownership');try{return JSON.parse(matches[0].slice(prefix.length))}catch{fail('invalid Flight row')} }
  const page=readRow('0:')?.[3], mapping=readRow('d:I'), client=readRow('c:I')
  if (JSON.stringify(page?.urlParts)!=='["","careers"]'||mapping[0]!==51811||mapping[2]!=='default'||mapping[3]!==1
      ||client[0]!==10911||client[2]!=='ClientPageRoot') fail('wrong Flight route or default export')
  const chunks=mapping[1]
  if (!Array.isArray(chunks)||chunks.length%2||chunks.filter(v=>v==='4027').length!==1
      ||new URL('/_next/'+chunks[chunks.indexOf('4027')+1],expected.officialUrl).href!==expected.routeUrl) fail('wrong Flight route chunk')
  let selected=0
  const visit=value=>{if(!value||typeof value!=='object')return;if(Array.isArray(value)&&value[0]==='$'&&value[1]==='$Lc'&&value[3]?.Component==='$d')selected++;for(const child of Object.values(value))visit(child)}
  visit(page.initialSeedData)
  if(selected!==1)fail('Flight does not select the declared default page')
  const ast=parsed(routeBody), statement=ast.body[0]
  const bundle=statement?.expression?.arguments?.[0]
  if(ast.body.length!==1||bundle?.type!=='ArrayExpression'||bundle.elements[0]?.elements?.[0]?.value!==4027)fail('wrong webpack route entry')
  const module=property(bundle.elements[1],51811)
  if(module?.type!=='FunctionExpression'||module.params.map(p=>p.name).join(',')!=='e,t,a')fail('missing owned page module')
  const exports=module.body.body.filter(n=>n.type==='ExpressionStatement').flatMap(n=>n.expression.type==='SequenceExpression'?n.expression.expressions:[n.expression])
    .filter(n=>member(n.callee,'a','d'))
  const getter=property(exports[0]?.arguments[1],'default')
  if(exports.length!==1||getter?.body?.body?.length!==1||getter.body.body[0].argument?.name!=='p')fail('wrong default page function')
  const imports=module.body.body.filter(n=>n.type==='VariableDeclaration').flatMap(n=>n.declarations)
  if(!imports.some(n=>n.id.name==='f'&&n.init?.callee?.name==='a'&&n.init.arguments[0]?.value===67110)
      ||!imports.some(n=>n.id.name==='s'&&n.init?.callee?.name==='a'&&n.init.arguments[0]?.value===31514))fail('unbound NextScript or JSX import')
  const functions=module.body.body.filter(n=>n.type==='FunctionDeclaration'&&n.id.name==='p')
  const returns=functions[0]?.body?.body?.filter(n=>n.type==='ReturnStatement')||[]
  if(functions.length!==1||returns.length!==1||functions[0].body.body.some(n=>!['ExpressionStatement','VariableDeclaration','ReturnStatement'].includes(n.type)))fail('conditional or missing default-page execution')
  const returned=returns[0].argument, children=property(returned?.arguments?.[1],'children')
  if(!jsx(returned)||returned.arguments[0]?.value!=='div'||children?.type!=='ArrayExpression')fail('default page does not return unconditional children')
  const direct=children.elements.filter(jsx)
  const configuration=direct.filter(n=>member(n.arguments[0],'f','default')&&property(n.arguments[1],'id')?.value==='keka-config')
  const loaders=direct.filter(n=>member(n.arguments[0],'f','default')&&property(n.arguments[1],'src')?.value===expected.handoffUrl)
  if(configuration.length!==1||loaders.length!==1)fail('missing unconditional NextScript config or renderer')
  for(const node of [...configuration,...loaders])if(property(node.arguments[1],'strategy')?.value!=='afterInteractive')fail('inactive NextScript strategy')
  if(children.elements.indexOf(configuration[0])>=children.elements.indexOf(loaders[0]))fail('configuration follows renderer')
  const configText=property(configuration[0].arguments[1],'children')
  if(configText?.type!=='Literal'||typeof configText.value!=='string')fail('nonliteral publisher configuration')
  const program=parsed(configText.value),assignment=program.body[0]?.expression
  if(program.body.length!==1||program.body[0].type!=='ExpressionStatement'||assignment?.type!=='AssignmentExpression'
      ||assignment.operator!=='='||!member(assignment.left,'window','khConfig')||assignment.right?.type!=='ObjectExpression')fail('inactive publisher configuration')
  const values={}
  for(const p of assignment.right.properties){if(p.type!=='Property'||p.computed||p.method||p.shorthand||p.kind!=='init'||p.value.type!=='Literal'||typeof p.value.value!=='string'||Object.hasOwn(values,key(p)))fail('nonliteral configuration field');values[key(p)]=p.value.value}
  if(JSON.stringify(Object.keys(values).sort())!==JSON.stringify(['domain','identifier','targetContainer'])
      ||values.identifier!==expected.identifier||values.domain!==expected.kekaRootUrl||values.targetContainer!=='#khembedjobs')fail('configuration UUID, domain or target mismatch')
  const containers=direct.flatMap(descendants).filter(n=>jsx(n)&&n.arguments[0]?.value==='div'&&property(n.arguments[1],'id')?.value==='khembedjobs')
  if(containers.length!==1)fail('missing returned matching target container')
  // The reviewed complete bridge bytes bind 67110 to NextScript implementation
  // 25264, which inserts inline children/external src on afterInteractive effect.
  if(sha(routeBody)!==expected.routeSha256||sha(bridgeBody)!==expected.bridgeSha256)fail('unreviewed complete route or NextScript bridge program')
  return {flightModule:51811,webpackChunk:4027,defaultExport:'p',routeUrl:expected.routeUrl,
    routeSha256:sha(routeBody),nextScriptModule:67110,bridgeUrl:expected.bridgeUrl,bridgeSha256:sha(bridgeBody),configuration:values}
}
