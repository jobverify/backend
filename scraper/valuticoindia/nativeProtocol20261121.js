import {parse} from 'acorn'
import {createHash} from 'node:crypto'
import {need,ACCOUNT} from './nativeData20261121.js'

function normalizedAST(value){
 if(typeof value==='bigint')return{nativeBigInt:String(value)}
 if(value===null||typeof value!=='object')return value
 if(Array.isArray(value))return value.map(normalizedAST)
 return Object.fromEntries(Object.keys(value).filter(key=>!['start','end','loc','range','raw'].includes(key)).sort().map(key=>[key,normalizedAST(value[key])]))
}
function reviewedModuleExecutionModel(fn,criticalScopes,seen){
 const covered=new Map(Object.entries(criticalScopes).map(([name,node])=>[node,name]))
 function project(value){
  if(covered.has(value)){const name=covered.get(value);seen.set(name,(seen.get(name)||0)+1);return{reviewedNativeConsumedScope:name}}
  if(typeof value==='bigint')return{nativeBigInt:String(value)}
  if(value===null||typeof value!=='object')return value
  if(Array.isArray(value))return value.map(project)
  return Object.fromEntries(Object.keys(value).filter(key=>!['start','end','loc','range','raw'].includes(key)).sort().map(key=>[key,project(value[key])]))
 }
 return project(fn)
}
const REVIEWED_BODY_AST={"requireRuntime":"6666ff2320da1f4ce3d031c60c31b8f4f5e8bc2440a5eb590f139ebc0837bf51","runtimeEntry":"ddb4bd0f0ec1112e4b691e31bbd52aa05744a73db02f418b11608bbaa7b5e5d4","main":"f87f200ebd868d1a6c6c9627472aa558f065e0764307b292943e407a755d2e97","startup":"d250606898e466bbe1f4e09c6672ef9c4d7e9752cd138f0a6e2375268592815a","provider":"bb9b16d7142bca39b561ac02e2a86f16ac81e328abf01dcbafd61b658b32f8ea","composition":"178674cda7935a9409dab2fab15d0e8fff15f27d34a5adcfce5faca7ad87cb7a","accountInitializer":"84d61b091c48434d0874491f94b8238e6570dd5049045015c934859d683855c3","accountProvider":"539898096e6dcbf38fa12af8306e20b1bf3436f0ffcaeb8614d27509e46f743a","roleLoader":"871653acbf7439eac3cd46227fb6a750abca49ddd52f3b68577168efb86a2fb3","serviceAdapter":"6c6c4791ae6e68d27209c208eeaf8deb009683ce62615c6f2fa304ba9b1aea6c","accountGetters":"bbe4489016f2014f7b2befc91e082ef344eb8e69c4570ab02d90fafdad75751b","careersSelector":"96ee887f9cad577c0a044ca49e6693603631275a32ca0a8e3a4f8bf1cfaaefa7","getFactory":"d2c9bc0431c59de4bcc79f11b3293e866433e665e04a243fc534b8d425c0beff","transportFactory":"95d741f3738e5252e2be96648ef3b7e1b1deef13f4e904fdcfe10a083653ffef","conditionalAuth":"712d6fb0875d380a588b0d785cfb0a2a4b1221f451a48ced6f4afcb06ccc78bd","configurationLoader":"48a3c7a12eeed8f1269e177ed65202cb82e85bbad0677a0911f41f134bea89e5"}
const REVIEWED_MODULE_EXECUTION_AST={"5636":"3d6217c0efadb7e43f475ee2a42ec9d2e21842d9d54514ff98ea1a2a93c36b6b","6749":"60900bb582ffe38a134f75940f114c689ff80c00caa301a8fa4709e78452ffc8","11587":"bff0a1176939889f60175f78fad9b829c2bd0ab00ebb54b0c3ca310aa1438844","22663":"32b7c959e657b587197fe0c29d5f4b6e6ad5061b2967e98aa5b16c56d5fba9d2","26946":"0a02b546f9244c29135ce9241201065ef4c842bfcf6947ce0c2721b63b0d7284","27431":"e379f17a944dca5350cf1f987067870e1206ce9fcfba05ab599c7fb0fa1bf958","67728":"6b28a17167ca46a8df24503860bc647aff29425456c95861b690b11ac4ee4133","73846":"d98ad1e002635f5470a9b1a96af530f17abd1b7ac765482b4de13c0230a7144f","82468":"7b8eae12f9e53fe2f5f9955103fdeaafae2b79fe73c716bcf9e6ce18c3cfeeca","82762":"3d88f515504749e4f865f8b197cda15c54fb9c82bc5bc25c6a453cad4267a6bf","84784":"18bb76e38ced46598cfecec02bdd2a09db9fd668719de3f7a79f46d0fd056c4f","85259":"8e33b85ae44a264a4f673311d66461886018f663ef4529afc43d490ac173ec20","96819":"b20cb6b5daa00aacd3401132bb44cbb7235ddce45e290c4d38c85eb8689d464b"}
// A second finite public-data profile is witnessed by the genuine registered
// current-client-20261128 fixture. The active Promise helper is tv, the same
// careers transport is exported as k, and the same role route is exported as y.
// Startup still awaits configuration/provider initialization; account/full and
// job GET factories, account/shortcode consumers and conditional internal auth
// remain separately checked below. Provider/account helpers were minified again.
// The new main also names different lazy rendering/application chunks. Those
// chunks are not executed or qualified by this GET/data contract. Keep their
// entire declaring module model, every critical body and all ownership checks:
// an unreviewed change cannot donate dormant original endpoints or reassign a
// checked consumer. The historical profile is retained without modification.
const CURRENT_BODY_AST={...REVIEWED_BODY_AST,
 runtimeEntry:'8bdd1e0cebab996d995f52b7f1a66838dd29009da4a3238cc681f3fe20846292',
 main:'838ed0cb070e031d5bfffc215bde00f11a5f84f32b8e52365b4fca06bdd2988c',
 startup:'ef6f3510a3569403df600e73aa920983791b205a1616e3a78a37671daefd8bd8',
 provider:'e00bc455ca6be34d112e409f26ecc446ddb3fb8d745475973f22755a15510f90',
 composition:'1081d370defa24a820dec22b8f6f1c9bc1a03d8137e97ecc5d7b890284c82d13',
 roleLoader:'4218f5f308c01b66aa661945aadeacf8a4c3763bc1fb1d55e6b63c093d470124',
 transportFactory:'e674f62b40d5520af712e50a166f301fea3775789cb8be981a3836267b187b4f',
}
const CURRENT_MODULE_EXECUTION_AST={...REVIEWED_MODULE_EXECUTION_AST,
 26946:'2f67a609e8177fcdf2834d032a78ca104ce649526ed4e63070173a2c8e9dd43c',
 67728:'251e6e0a46ced03ddbf26f60af58cf5994a0f3639fde3eeada0d1e8eb24633aa',
 84784:'745d9911651fa1f4f833e1fe9e7a30fd0f247bc05857e569fb1fade71b318b12',
 85259:'3dd2baf9074de8b5d66dca8f64d1ccd57743a0ece6cc6be511bb9111c781b420',
 96819:'499af3c46275753a251194118263548dd6df8a3ca42dd4c9b777fb4ba7f8ec23',
}
// This source-owned profile reviews the consumed current public programme.
// It never executes publisher code or pins an entire JS release/body hash.
export function readProtocol(source){
 const ast=parse(source,{ecmaVersion:'latest',sourceType:'script'}),outer=ast.body[0]?.expression?.callee
 need(outer?.type==='ArrowFunctionExpression'&&outer.body.type==='BlockStatement','Current native bundle bootstrap changed')
 const map=outer.body.body[0]?.declarations?.find(n=>n.id.name==='l')?.init
 need(map?.type==='ObjectExpression','Native module map not bound to bootstrap')
 const modules=new Map(map.properties.map(p=>[p.key.value,p.value])),code=n=>source.slice(n.start,n.end)
 function walk(n,visit,scoped=false,root=true){if(!n||typeof n!=='object')return;if(!root&&scoped&&/Function|ArrowFunction/.test(n.type))return;visit(n);for(const[k,v]of Object.entries(n)){if(k==='type')continue;if(Array.isArray(v)){for(const child of v)if(child?.type)walk(child,visit,scoped,false)}else if(v?.type)walk(v,visit,scoped,false)}}
 const member=(n,a,b)=>n?.type==='MemberExpression'&&!n.computed&&n.object.type==='Identifier'&&n.object.name===a&&n.property.name===b
 function bindings(fn){need(fn?.body?.type==='BlockStatement','Native function body unavailable');const out=new Map;for(const n of fn.body.body){if(n.type==='VariableDeclaration')for(const d of n.declarations)out.set(d.id.name,d.init);if(n.type==='FunctionDeclaration')out.set(n.id.name,n)}return out}
 const mod=id=>{const n=modules.get(id);need(n,'Consumed native module absent');return n}
 function req(id,name,target){const fn=mod(id),n=bindings(fn).get(name);need(n?.type==='CallExpression'&&n.callee.name===fn.params[2]?.name&&n.arguments.length===1&&n.arguments[0].value===target,'Native require consumer changed')}
 function exports(id){const fn=mod(id),out=new Map;walk(fn.body,n=>{if(n.type!=='CallExpression'||!member(n.callee,fn.params[2]?.name,'d')||n.arguments[0]?.name!==fn.params[1]?.name)return;for(const obj of n.arguments.slice(1)){need(obj.type==='ObjectExpression','Unknown native export definition');for(const p of obj.properties)out.set(p.key.name??p.key.value,p.value.type==='ArrowFunctionExpression'?p.value.body:p.value)}},true);return out}
 function returned(fn){need(['FunctionExpression','FunctionDeclaration'].includes(fn?.type),'Native consumed function required');const rs=fn.body.body.filter(n=>n.type==='ReturnStatement');need(rs.length===1,'Ambiguous native return consumer');return rs[0].argument}
 function element(n,target){if(!n||typeof n!=='object')return false;if(n.type==='CallExpression'&&member(n.callee,'n','createElement'))return code(n.arguments[0])===target||n.arguments.slice(2).some(a=>element(a,target));if(n.type==='LogicalExpression'||n.type==='ConditionalExpression')return Object.entries(n).some(([k,v])=>k!=='type'&&v&&typeof v==='object'&&element(v,target));return false}
 req(96819,'ed',67728);req(67728,'s',73846);req(67728,'l',85259);req(67728,'u',27431);req(67728,'f',6749)
 req(73846,'l',82468);req(6749,'n',82468);req(85259,'u',6749);req(85259,'s',27431);req(82762,'n',26946);req(26946,'i',22663);req(22663,'o',47802)
 const starts=[];for(const statement of outer.body.body)walk(statement,n=>{if(n.type==='CallExpression'&&n.callee.type==='Identifier'&&n.callee.name==='u'&&n.arguments.length===1&&n.arguments[0].value===96819)starts.push(n)},true)
 need(starts.length===1,'Native runtime entry not consumed')
 const runtime=outer.body.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='u')
 need(runtime&&code(runtime).includes('l[e]'),'Native require runtime detached from module map')
 const entry=bindings(mod(96819)),tm=entry.get('tm')
 need(element(returned(tm),'ed.Ay'),'Active native main tree detached from public providers')
 // The real startup is an invoked transpiled async/generator workflow.
 // Review its active argument/return chain; do not walk arbitrary nested code.
 req(96819,'c',22663)
 const startStatement=mod(96819).body.body.at(-1),startUnary=startStatement?.expression
 need(startStatement?.type==='ExpressionStatement'&&startUnary.type==='UnaryExpression'&&startUnary.operator==='!'&&startUnary.argument.type==='CallExpression','Active native startup invocation changed')
 const startup=startUnary.argument.callee
 need(startup.type==='FunctionExpression'&&startup.params.length===0&&startUnary.argument.arguments.length===0&&startup.body.body.length===2,'Native startup function is not directly invoked')
 const host=bindings(startup).get('t')
 need(code(host)==='arguments.length>0&&void 0!==arguments[0]?arguments[0]:window.location.hostname','Native startup hostname/context changed')
 const asyncCall=startup.body.body[1]?.expression,asyncSequence=asyncCall?.callee
 need(asyncCall?.type==='CallExpression'&&asyncCall.arguments.length===0&&asyncSequence.type==='SequenceExpression'&&asyncSequence.expressions.length===2,'Native async runner disconnected')
 const [assignment,runner]=asyncSequence.expressions
 need(assignment.type==='AssignmentExpression'&&assignment.operator==='='&&assignment.left.name==='e'&&assignment.right.type==='FunctionExpression'&&runner.type==='FunctionExpression','Native async generator/runner binding changed')
 const promise=returned(runner)
 need(promise.type==='NewExpression'&&promise.callee.name==='Promise'&&promise.arguments.length===1&&promise.arguments[0].type==='FunctionExpression','Native startup Promise not constructed')
 const executor=promise.arguments[0],executorBindings=bindings(executor),runNext=executor.body.body.at(-1)?.expression
 const advanceName=executorBindings.get('a')?.body?.body[0]?.expression?.callee?.name
 need(advanceName==='ty'||advanceName==='tv','Unreviewed native Promise step binding')
 const currentProfile=advanceName==='tv',bodyProfile=currentProfile?CURRENT_BODY_AST:REVIEWED_BODY_AST,moduleProfile=currentProfile?CURRENT_MODULE_EXECUTION_AST:REVIEWED_MODULE_EXECUTION_AST
 need(code(executorBindings.get('i'))==='e.apply(t,r)'&&code(executorBindings.get('a'))===`function a(e){${advanceName}(i,n,o,a,s,"next",e)}`&&code(executorBindings.get('s'))===`function s(e){${advanceName}(i,n,o,a,s,"throw",e)}`&&code(runNext)==='a(void 0)','Native generator is not advanced by the active Promise')
 const asyncStep=entry.get(advanceName)
 need(asyncStep?.type==='FunctionDeclaration'&&asyncStep.body.body.length===2&&code(asyncStep).includes('var s=e[i](a),l=s.value')&&code(asyncStep).endsWith('s.done?t(l):Promise.resolve(l).then(n,o)}'),'Native async step execution changed')
 const generatorCall=returned(assignment.right)
 need(generatorCall.type==='CallExpression'&&generatorCall.callee.type==='FunctionExpression'&&generatorCall.arguments.length===2&&generatorCall.arguments[0].type==='ThisExpression'&&generatorCall.arguments[1].type==='FunctionExpression','Native active generator callback changed')
 const generator=generatorCall.callee,generatorBindings=bindings(generator),iterator=returned(generatorBindings.get('l'))
 need(generator.params.length===2&&generator.params[1].name==='t'&&code(generatorBindings.get('s'))==='Object.defineProperty'&&code(returned(generator)).endsWith(',a'),'Native generator iterator binding changed')
 const callbackCalls=[]
 walk(iterator.body,n=>{if(n.type==='CallExpression'&&member(n.callee,'t','call'))callbackCalls.push(n)},true)
 need(callbackCalls.length===1&&code(callbackCalls[0])==='t.call(e,i)','Native state callback is not consumed by the iterator')
 const state=generatorCall.arguments[1],switcher=state.body.body[0]
 need(state.params.length===1&&state.params[0].name==='o'&&state.body.body.length===1&&switcher.type==='SwitchStatement'&&code(switcher.discriminant)==='o.label'&&JSON.stringify(switcher.cases.map(c=>c.test?.value))==='[0,1,2]','Native startup state machine changed')
 const cases=switcher.cases
 need(code(cases[0].consequent[0])==='return[4,c.default];'&&cases[1].consequent.length===2&&code(cases[1].consequent[0]).includes('(e=o.sent()).ignoredHostnames')&&code(cases[1].consequent[1])==='return[4,u.Ts()];','Native active configuration/initialization awaits changed')
 const finalReturn=cases[2].consequent[0]
 need(cases[2].consequent.length===1&&finalReturn.type==='ReturnStatement'&&finalReturn.argument.type==='SequenceExpression'&&finalReturn.argument.expressions.length===3,'Native returned renderer sequence changed')
 const renders=[finalReturn.argument.expressions[1]]
 need(code(finalReturn.argument.expressions[0])==='o.sent()'&&renders[0].type==='CallExpression'&&renders[0].callee.name==='i'&&element(renders[0].arguments[0],'tm')&&code(renders[0].arguments[1])==='document.getElementById("app")','Native active renderer no longer consumes main')
 const provider=bindings(mod(67728))
 need(exports(67728).get('Ay')?.name==='eM'&&provider.get('eM')?.name==='eR'&&element(returned(provider.get('eR')),'eC'),'Native exported role provider disconnected')
 const composition=returned(provider.get('eC'))
 need(element(composition,'s.A')&&element(composition,'l.A')&&element(composition,'W'),'Native returned account/details/job providers disconnected')
 const initializer=bindings(mod(73846))
 need(element(returned(initializer.get('u')),'l.A.Provider')&&code(initializer.get('c')).includes('(0,s.ct)(window.location.pathname)')&&code(initializer.get('c')).includes('a.meta.subdomain'),'Native account route/context initializer changed')
 req(73846,'a',22663);req(73846,'s',11587);req(11587,'n',84784)
 const route=bindings(mod(84784))
 const roleRouteName=currentProfile?'y':'v'
 need(route.get('i')?.value==='/:account'&&route.get('a')?.value==='/:account/j/:job'&&exports(84784).get('cs')?.name===roleRouteName&&code(route.get(roleRouteName))==='[a,"/"].join("")','Native consumed role route changed')
 function effect(fn){const found=[];walk(fn.body,n=>{if(n.type==='CallExpression'&&n.callee.type==='SequenceExpression'&&member(n.callee.expressions.at(-1),'n','useEffect'))found.push(n)},true);need(found.length===1&&found[0].arguments[0]?.type==='FunctionExpression','Unique invoked native role effect required');return found[0].arguments[0]}
 const loader=provider.get('W'),jobEffect=effect(loader),jobCalls=[]
 walk(jobEffect.body,n=>{if(n.type==='CallExpression'&&n.callee.type==='MemberExpression'&&n.callee.property.name==='job'&&n.callee.object.type==='CallExpression'&&n.callee.object.callee.type==='MemberExpression'&&n.callee.object.callee.property.name==='account')jobCalls.push(n)},true)
 need(jobCalls.length===1,'Native job GET consumer is dormant, missing or ambiguous')
 const jobCall=jobCalls[0],accountCall=jobCall.callee.object
 need(member(accountCall.callee.object,'u','A')&&accountCall.arguments[0]?.name==='c'&&jobCall.arguments[0]?.name==='r','Native job loader account/shortcode consumer changed')
 need(code(jobEffect).includes('path:U.cs')&&code(jobEffect).includes('t.params')&&code(loader).includes('useContext)(f.A)'),'Native role route parameters not consumed by job loader')
 need(exports(27431).get('A')?.name==='n'&&code(bindings(mod(27431)).get('n')).includes('r(82762).A'),'Native service adapter disconnected')
 const serviceBindings=bindings(mod(82762)),service=serviceBindings.get('h')
 need(exports(82762).get('A')?.name==='h'&&service?.type==='ObjectExpression','Native consumed service export changed')
 const accountFn=service.properties.find(p=>p.key.name==='account')?.value
 need(accountFn?.params.length===1&&accountFn.params[0].name==='e','Native account service argument changed')
 const methods=returned(accountFn),job=methods.properties.find(p=>p.key.name==='job')?.value,details=methods.properties.find(p=>p.key.name==='details')?.value
 need(job?.params.length===1&&job.params[0].name==='t','Native shortcode getter argument changed')
 const getterCalls=[]
 walk(job,n=>{if(n.type==='CallExpression'&&n.callee.type==='CallExpression'&&n.callee.callee.name==='d')getterCalls.push(n)})
 need(getterCalls.length===1,'Native job getter is not the reviewed read-only factory')
 const getter=getterCalls[0]
 need(getter.callee.arguments[0]?.name==='c'&&code(getter.arguments[0])==='"/api/v2/accounts/".concat(e,"/jobs/").concat(t)','Native public GET route/client selector changed')
 const options=getter.arguments[1]
 need(options?.type==='ObjectExpression'&&options.properties.length===1&&options.properties[0].key.name==='withCredentials'&&code(options.properties[0].value)==='!0','Native job GET options changed')
 need(code(details).includes('d(c)("/api/v1/accounts/".concat(e),{params:a({full:!0},t?{lng:t}:{})})'),'Native account detail GET/options changed')
 need(code(serviceBindings.get('c'))==='function(e){return e.careers}'&&code(serviceBindings.get('d')).includes('return e.get(t,r&&a({},r)||{})'),'Native GET factory is not bound to careers transport')
 const transportName=currentProfile?'k':'A'
 need(exports(26946).get('Ay')?.name===transportName,'Native transport export changed')
 const transport=bindings(mod(26946)),transportFactory=transport.get(transportName)
 need(transportFactory?.type==='CallExpression'&&transportFactory.arguments.length===0&&transportFactory.callee.type==='FunctionExpression','Native transport instance not initialized as declared')
 const factories=[];walk(transportFactory.callee.body,n=>{if(n.type==='CallExpression'&&member(n.callee,'i','default')===false&&n.callee.type==='MemberExpression'&&n.callee.property.name==='then'&&member(n.callee.object,'i','default'))factories.push(n)})
 need(factories.length===1&&factories[0].arguments.length===1,'Native public configuration not consumed by transport')
 const configCallback=factories[0].arguments[0],cb=bindings(configCallback)
 need(code(cb.get('r'))==='t.apis'&&code(cb.get('n'))==='t.meta.hasCustomDomain&&new URL(e.location.href).origin||r.careers.url','Native consumed careers baseURL selector changed')
 const writes=[];walk(configCallback.body,n=>{if(n.type==='AssignmentExpression'&&member(n.left,'i','careers'))writes.push(n);if(n.type==='AssignmentExpression'&&n.left.type==='Identifier'&&['n','r','t'].includes(n.left.name))throw Error('Native endpoint binding reassigned')},true)
 need(writes.length===1&&writes[0].right.type==='CallExpression'&&code(writes[0].right.callee)==='o.A.create','Consumed careers HTTP instance changed')
 const nativeOptions=writes[0].right.arguments[0]
 need(nativeOptions?.type==='ObjectExpression'&&nativeOptions.properties.length===2&&nativeOptions.properties.some(p=>p.key.name==='baseURL'&&p.value.name==='n')&&nativeOptions.properties.some(p=>p.key.name==='withCredentials'&&code(p.value)==='!0'),'Consumed public careers HTTP options changed')
 const auth=transport.get('O')
 need(auth?.type==='SequenceExpression'&&code(auth.expressions[0])==='n="internal_application"===new URLSearchParams(window.location.search).get("utm_source")','Native public/internal authentication selector changed')
 const authReturn=returned(auth.expressions[1])
 need(authReturn.type==='SequenceExpression'&&authReturn.expressions[0]?.type==='LogicalExpression'&&authReturn.expressions[0].operator==='&&'&&authReturn.expressions[0].left.name==='n'&&code(authReturn).includes('interceptors.request.use(w)'),'Native bearer middleware is no longer conditional')
 need(code(configCallback).endsWith('O(i)}'),'Actual HTTP instance is not passed through reviewed middleware')
 const config=bindings(mod(22663))
 need(code(config.get('s')).includes('Promise.resolve().then(r.t.bind(r,5636,23))')&&exports(22663).get('default')?.name==='l','Native production configuration consumer changed')
 const values=[];const jsonModule=mod(5636)
 walk(jsonModule.body,n=>{if(n.type==='AssignmentExpression'&&member(n.left,jsonModule.params[0].name,'exports'))values.push(n.right)},true)
 need(values.length===1&&values[0].type==='ObjectExpression','Native exported configuration object changed')
 const apis=values[0].properties.find(p=>p.key.name==='apis')?.value,careers=apis?.properties.find(p=>p.key.name==='careers')?.value
 need(careers?.type==='ObjectExpression'&&careers.properties.length===1&&careers.properties[0].key.name==='url'&&careers.properties[0].value.value==='https://apply.workable.com','Foreign consumed public careers endpoint')

 // Review the complete normalized AST of the already-consumed critical
 // bodies. Original return/GET nodes cannot survive as unreachable decoys.
 const criticalScopes={requireRuntime:runtime,runtimeEntry:outer.body.body.find(n=>n.start<=starts[0].start&&n.end>=starts[0].end),main:tm,startup,provider:provider.get('eR'),composition:provider.get('eC'),accountInitializer:initializer.get('c'),accountProvider:initializer.get('u'),roleLoader:loader,serviceAdapter:bindings(mod(27431)).get('n'),accountGetters:accountFn,careersSelector:serviceBindings.get('c'),getFactory:serviceBindings.get('d'),transportFactory:transportFactory.callee,conditionalAuth:auth,configurationLoader:config.get('s')}
 for(const[name,node]of Object.entries(criticalScopes)){
  const digest=createHash('sha256').update(JSON.stringify(normalizedAST(node))).digest('hex')
  need(digest===bodyProfile[name],'Reviewed consumed native body/control flow changed: '+name)
 }
 // Keep every executed module-level binding, assignment side, initializer,
 // export expression and control node. Only independently checked scopes
 // above become named markers; uncovered nested bodies stay in the model.
 const scopeEntries=Object.entries(criticalScopes)
 need(scopeEntries.length===16&&new Set(scopeEntries.map(([,node])=>node)).size===16,'Ambiguous consumed native scope markers')
 for(let i=0;i<scopeEntries.length;i++)for(let j=i+1;j<scopeEntries.length;j++){const a=scopeEntries[i][1],b=scopeEntries[j][1];need(a.end<=b.start||b.end<=a.start,'Overlapping consumed native scope markers')}
 const markerCounts=new Map,moduleNodes=Object.keys(moduleProfile).map(id=>mod(Number(id)))
 for(const[id,expected]of Object.entries(moduleProfile)){
  const projection=reviewedModuleExecutionModel(mod(Number(id)),criticalScopes,markerCounts)
  need(createHash('sha256').update(JSON.stringify(projection)).digest('hex')===expected,'Consumed native module binding/control changed: '+id)
 }
 for(const[name,node]of scopeEntries){const expected=moduleNodes.filter(m=>m.start<=node.start&&node.end<=m.end).length;need(expected<=1&&(markerCounts.get(name)||0)===expected,'Consumed native scope marker ownership changed: '+name)}
 return{account:ACCOUNT,baseURL:'https://apply.workable.com',accountPath:'/api/v1/accounts/{account}',accountFull:true,jobPath:'/api/v2/accounts/{account}/jobs/{shortcode}',method:'GET',nativeWithCredentials:true,internalBearerConditional:true,scriptExecuted:false}
}
