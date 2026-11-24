import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
const api=await import('./currentV1Consumer20261120.js').catch(error=>error.code==='ERR_MODULE_NOT_FOUND'?{}:Promise.reject(error)),fixture=JSON.parse(gunzipSync(await fs.readFile(new URL('./fixtures/current-native-20261120.json.gz',import.meta.url)))),HOME=fixture.home,BOARD=fixture.nativePublicBase,CLIENT=fixture.declaredEmbedScript,body=packet=>Buffer.from(packet.bodyBase64,'base64').toString(),original={homeHTML:body(fixture.responses.find(p=>p.requestedUrl===HOME)),program:body(fixture.responses.find(p=>p.requestedUrl===CLIENT)),homeURL:HOME,boardURL:BOARD,clientURL:CLIENT}
const exact=(text,before,after)=>{assert.equal(text.split(before).length,2,'Unique genuine current native target');assert.notEqual(before,after);return text.replace(before,()=>after)},nodes=(node,parent=null)=>[{node,parent},...Object.entries(node).filter(([key])=>!['start','end','raw'].includes(key)).flatMap(([,v])=>(Array.isArray(v)?v:[v]).filter(v=>v&&typeof v==='object'&&typeof v.type==='string').flatMap(v=>nodes(v,node)))],edit=(program,predicate,op)=>{const selected=nodes(parse(program,{ecmaVersion:'latest'})).filter(({node,parent})=>predicate(node,parent));assert.equal(selected.length,1,'Actual native programme target count');const{node}=selected[0],before=program.slice(node.start,node.end),after=op(before,node);assert.notEqual(before,after);return program.slice(0,node.start)+after+program.slice(node.end)}
const inline=(html,code)=>html+'<script>'+code+'</script>',tail=code=>({homeHTML:inline(original.homeHTML,code)}),program=op=>{const changed=op(original.program);parse(changed,{ecmaVersion:'latest'});return{program:changed}}
function inspect(change={}){assert.equal(typeof api.qualifyV1Consumer,'function','Source-private unbranded connected v1 consumer proof required');return api.qualifyV1Consumer({...original,...change})}
function held(change){let error;try{inspect(change)}catch(cause){error=cause}assert(error,'Disconnected or contradictory native consumer must be refused');assert.equal(error.nativeContradiction,true,'An absent API, test harness or unrelated exception cannot satisfy native refusal');assert.equal(error.failureKind,'parser_or_contract_error')}

test('Eight paired genuine original Responses retain all549586bytes and every original SHA',()=>{assert.equal(fixture.responses.length,8);assert.equal(fixture.responses.reduce((n,p)=>n+p.bytes,0),549586);for(const p of fixture.responses){const bytes=Buffer.from(p.bodyBase64,'base64');assert.equal(bytes.length,p.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),p.sha256)}})

test('Actual connected v1 programme qualifies the same declared unfiltered consumer without execution',()=>{const model=inspect();assert.equal(model.baseURL,BOARD);assert.equal(model.consumerURL,BOARD+'?embed=js');assert.equal(model.nativeProgramsExecuted,false);assert.equal(model.rendererOrUIActivationVerified,false);assert(model.originalModel);assert(model.model)})

test('Both actual independently captured v1 observations qualify without script or build pins',()=>{const homes=fixture.responses.filter(p=>p.requestedUrl===HOME),programs=fixture.responses.filter(p=>p.requestedUrl===CLIENT);for(let i=0;i<2;i++)assert.equal(inspect({homeHTML:body(homes[i]),program:body(programs[i])}).consumerURL,BOARD+'?embed=js')})

test('Unrelated current programme releases and unused bound helpers remain compatible',()=>{const changed=inspect({homeHTML:inline(original.homeHTML,'const independentUnusedBound=Object.assign.bind(Object,window);window.independentFreshpaintAnalytics={version:3};'),program:original.program+'\n/* ordinary consumer release */'});assert.equal(changed.consumerURL,BOARD+'?embed=js')})

test('Unrelated function and block local browser owners remain compatible',()=>{const changed=inspect(tail('function independentLocal(document,window){document.createElement=()=>({});window.__ashbyBaseJobBoardUrl="ordinary";}{const document={};document.getElementById=()=>null;}'));assert.equal(changed.consumerURL,BOARD+'?embed=js')})

test('Native lexical binding renames preserve the connected constructor and consumer graph',()=>{const names=new Map([['buildIFrameUrl','constructCurrentConsumer'],['loadIFrame','loadCurrentConsumer'],['addIFrameIfNotExists','appendCurrentConsumer'],['container','currentOwnedContainer'],['iframe','currentOwnedFrame'],['baseJobBoardUrl','currentOwnedBase'],['url','currentOwnedURL']]),replacements=nodes(parse(original.program,{ecmaVersion:'latest'})).filter(({node,parent})=>node.type==='Identifier'&&names.has(node.name)&&!(parent?.type==='MemberExpression'&&parent.property===node&&!parent.computed)&&!(parent?.type==='Property'&&parent.key===node&&!parent.computed&&!parent.shorthand)).map(({node})=>node).sort((a,b)=>b.start-a.start);let changed=original.program;for(const node of replacements)changed=changed.slice(0,node.start)+names.get(node.name)+changed.slice(node.end);assert.equal(inspect({program:changed}).consumerURL,BOARD+'?embed=js')})

test('Missing actual own native client declaration cannot borrow an unrelated programme',()=>held({homeHTML:exact(original.homeHTML,'src="'+CLIENT+'"','src="https://other.invalid/embed"')}))
test('Own native job selector refuses an unfiltered collection claim',()=>held({homeURL:HOME+'?ashby_jid=another-role'}))
test('Native container job selector refuses an unfiltered collection claim',()=>held({homeHTML:exact(original.homeHTML,'id="ashby_embed"','id="ashby_embed" data-jid="another-role"')}))

test('Native base assignment must identify the declared account',()=>held(program(s=>edit(s,n=>n.type==='AssignmentExpression'&&n.left.property?.name==='__ashbyBaseJobBoardUrl',()=> 'window.__ashbyBaseJobBoardUrl="https://jobs.ashbyhq.com/other"'))))

test('The actual final consumer initializer cannot be removed',()=>held(program(s=>edit(s,n=>n.type==='ExpressionStatement'&&n.expression.type==='CallExpression'&&n.expression.callee.type==='FunctionExpression',()=>';'))))
test('A dead native consumer initializer cannot supply the actual constructor',()=>held(program(s=>edit(s,n=>n.type==='ExpressionStatement'&&n.expression.type==='CallExpression'&&n.expression.callee.type==='FunctionExpression',part=>'if(false){'+part+'}'))))
test('The actual initializer cannot invoke only a disconnected loader',()=>held(program(s=>{const tree=parse(s,{ecmaVersion:'latest'}),entry=tree.body.at(-1),part=s.slice(entry.start,entry.end);assert(part.includes('loadIFrame'));return s.slice(0,entry.start)+'function independentDisconnectedLoader(){}\n'+part.replaceAll('loadIFrame','independentDisconnectedLoader')+s.slice(entry.end)})))
test('The actual native consumer must append its constructed frame',()=>held(program(s=>edit(s,n=>n.type==='CallExpression'&&n.callee.property?.name==='appendChild'&&n.arguments[0]?.name==='iframe',()=> 'independentDetachedFrame(iframe)'))))
test('The actual native consumer must construct an iframe',()=>held(program(s=>edit(s,n=>n.type==='CallExpression'&&n.callee.property?.name==='createElement'&&n.arguments[0]?.value==='iframe',()=> 'document.createElement("div")'))))
test('The actual native iframe source must use the owned container binding',()=>held(program(s=>edit(s,n=>n.type==='CallExpression'&&n.callee.name==='buildIFrameUrl',()=> 'buildIFrameUrl(independentOtherContainer)'))))
test('The actual constructor cannot return an unrelated URL',()=>held(program(s=>edit(s,n=>n.type==='ReturnStatement'&&n.argument?.type==='MemberExpression'&&n.argument.object.name==='url'&&n.argument.property.name==='href',()=> 'return new URL("https://other.invalid/").href;'))))

for(const[label,code]of[
 ['base global replacement','window.__ashbyBaseJobBoardUrl="https://jobs.ashbyhq.com/other";'],
 ['base Object.assign replacement','Object.assign(window,{__ashbyBaseJobBoardUrl:"https://jobs.ashbyhq.com/other"});'],
 ['base bound Object.assign replacement','const independentNativeReplace=Object.assign.bind(Object,window);independentNativeReplace({__ashbyBaseJobBoardUrl:"https://jobs.ashbyhq.com/other"});'],
 ['base bound Reflect.set replacement','const independentNativeReplace=Reflect.set.bind(Reflect);independentNativeReplace(window,"__ashbyBaseJobBoardUrl","https://jobs.ashbyhq.com/other");'],
 ['base bound call replacement','const independentNativeReplace=Object.assign.bind(Object,window);independentNativeReplace.call(null,{__ashbyBaseJobBoardUrl:"https://jobs.ashbyhq.com/other"});'],
 ['base bound apply replacement','const independentNativeReplace=Object.assign.bind(Object,window);independentNativeReplace.apply(null,[{__ashbyBaseJobBoardUrl:"https://jobs.ashbyhq.com/other"}]);'],
 ['critical document namespace replacement','window.document={getElementById:()=>null,createElement:()=>({})};'],
 ['critical document method replacement','document.getElementById=()=>null;'],
 ['critical document createElement replacement','Reflect.set(document,"createElement",()=>({}));'],
 ['critical DOM prototype replacement','Object.assign(Element.prototype,{setAttribute:function(){}});'],
 ['critical append prototype replacement','Reflect.defineProperty(Node.prototype,"appendChild",{value:function(){}});'],
 ['actual loader callback replacement','loadIFrame=function(){};'],
 ['actual URL builder replacement','buildIFrameUrl=function(){return "https://other.invalid/"};'],
 ['native URL namespace replacement','window.URL=function(){return {href:"https://other.invalid/"}};'],
 ['native ready callback replacement','window.addEventListener=function(){};']
])test('Known '+label+' cannot borrow the earlier connected consumer',()=>held(tail(code)))

test('A method overwrite on the actual local frame cannot hide behind the original setter',()=>held(program(s=>edit(s,n=>n.type==='CallExpression'&&n.callee.property?.name==='setAttribute'&&n.arguments[0]?.value==='src',part=>'(iframe.setAttribute=function(){},'+part+')'))))
test('A method overwrite on the actual local container cannot hide behind the original appender',()=>held(program(s=>edit(s,n=>n.type==='CallExpression'&&n.callee.property?.name==='appendChild'&&n.arguments[0]?.name==='iframe',part=>'(container.appendChild=function(){},'+part+')'))))

test('Actual optional UTM forwarding preserves the current own value',()=>assert.equal(inspect({homeURL:HOME+'?utm_source=current%20publisher'}).consumerURL,BOARD+'?utm_source=current+publisher&embed=js'))
test('Actual optional noChrome forwarding preserves the current own attribute',()=>assert.equal(inspect({homeHTML:exact(original.homeHTML,'id="ashby_embed"','id="ashby_embed" data-noChrome="true"')}).consumerURL,BOARD+'?embed=js&noChrome=true'))
test('An unrelated own query does not introduce native collection filters',()=>assert.equal(inspect({homeURL:HOME+'?ordinaryAnalytics=release'}).consumerURL,BOARD+'?embed=js'))

for(const[label,op]of[
 ['UTM setter value',s=>edit(s,n=>n.type==='CallExpression'&&n.callee.property?.name==='set'&&n.arguments[0]?.value==='utm_source',()=> 'url.searchParams.set("utm_source","other-publisher")')],
 ['UTM branch condition',s=>edit(s,n=>n.type==='IfStatement'&&n.test.name==='utmSourceParam',part=>part.replace('if (utmSourceParam)','if (true)'))],
 ['noChrome setter value',s=>edit(s,n=>n.type==='CallExpression'&&n.callee.property?.name==='set'&&n.arguments[0]?.value==='noChrome',()=> 'url.searchParams.set("noChrome","false")')],
 ['noChrome attribute condition',s=>edit(s,n=>n.type==='VariableDeclarator'&&n.id.name==='noChrome',()=> 'noChrome = true')],
 ['noChrome branch condition',s=>edit(s,n=>n.type==='IfStatement'&&n.test.name==='noChrome',part=>part.replace('if (noChrome)','if (true)'))],
 ['query reader method',s=>exact(s,'const jobIdParam =','urlParams.get=()=>"another-role"; const jobIdParam =')],
 ['query reader object mutation',s=>exact(s,'const jobIdParam =','Object.assign(urlParams,{get:()=>"another-role"}); const jobIdParam =')],
 ['extra native query deletion',s=>exact(s,'return url.href;','url.searchParams.delete("embed"); return url.href;')],
 ['extra native query append',s=>exact(s,'return url.href;','url.searchParams.append("ashby_jid","another-role"); return url.href;')],
 ['constructed URL escape',s=>exact(s,'return url.href;','independentMutate(url); return url.href;')],
 ['constructed query escape',s=>exact(s,'return url.href;','independentMutate(url.searchParams); return url.href;')],
 ['actual frame escape',s=>exact(s,'container.appendChild(iframe);','independentMutate(iframe); container.appendChild(iframe);')],
 ['actual container escape',s=>exact(s,'container.appendChild(iframe);','independentMutate(container); container.appendChild(iframe);')],
 ['nested native initializer',s=>edit(s,n=>n.type==='ExpressionStatement'&&n.expression.type==='CallExpression'&&n.expression.callee.type==='FunctionExpression',part=>part.replace('if (document.readyState','if(false){if (document.readyState').replace(/}\s*}\)\(\);$/,'}}})();'))],
 ['ready state condition',s=>exact(s,'document.readyState === "complete"','false')],
 ['early loader return',s=>exact(s,'let previouslyRegisteredPostMessageHandler = null;','return; let previouslyRegisteredPostMessageHandler = null;')],
 ['early loader throw',s=>exact(s,'let previouslyRegisteredPostMessageHandler = null;','throw new Error("stopped"); let previouslyRegisteredPostMessageHandler = null;')],
 ['early actual consumer return',s=>exact(s,'const container = document.getElementById("ashby_embed");','return; const container = document.getElementById("ashby_embed");')],
 ['early append return',s=>exact(s,'container.appendChild(iframe);','return; container.appendChild(iframe);')],
 ['early append throw',s=>exact(s,'container.appendChild(iframe);','throw new Error("stopped"); container.appendChild(iframe);')],
 ['early builder return',s=>exact(s,'const urlParams =','return "https://other.invalid/"; const urlParams =')],
 ['early builder throw',s=>exact(s,'const urlParams =','throw new Error("stopped"); const urlParams =')],
 ['early native initializer return',s=>exact(s,'if (document.readyState === "complete")','return; if (document.readyState === "complete")')],
 ['early timed callback return',s=>exact(s,'window.setInterval(function () {','window.setInterval(function () {return;')],
 ['forced existing-frame guard',s=>exact(s,'document.getElementById("ashby_embed_iframe") == null','true')],
 ['unknown null container operand',s=>exact(s,'container != null','container != independentUnknownNull')],
 ['unknown null existing-frame operand',s=>exact(s,'document.getElementById("ashby_embed_iframe") == null','document.getElementById("ashby_embed_iframe") == independentUnknownNull')],
 ['preexisting native initialization default',s=>exact(s,'if (window.__ashbyAutoLoadIframeTimerID != null)','if (true)')],
 ['bound actual-frame source setter',s=>exact(s,'container.appendChild(iframe);','const independentSource=iframe.setAttribute.bind(iframe,"src","https://other.invalid/");independentSource();container.appendChild(iframe);')],
 ['called actual-frame source setter',s=>exact(s,'container.appendChild(iframe);','iframe.setAttribute.call(iframe,"src","https://other.invalid/");container.appendChild(iframe);')],
 ['applied actual-frame source setter',s=>exact(s,'container.appendChild(iframe);','Reflect.apply(iframe.setAttribute,iframe,["src","https://other.invalid/"]);container.appendChild(iframe);')],
 ['extra native base path',s=>exact(s,'const url = new URL(baseJobBoardUrl);','baseJobBoardUrl += "/another-role"; const url = new URL(baseJobBoardUrl);')]
])test('Changed '+label+' cannot qualify the original unfiltered native consumer',()=>held(program(op)))

for(const[label,code]of[
 ['own location search replacement','window.location.search="?ashby_jid=another-role";'],
 ['own location namespace replacement','window.location={search:"?ashby_jid=another-role"};'],
 ['native container getter prototype replacement','Element.prototype.getAttribute=()=>"another-role";'],
 ['native ready state replacement','document.readyState="loading";'],
 ['native timer already initialized','window.__ashbyAutoLoadIframeTimerID=1;']
])test('Known '+label+' cannot qualify the earlier consumer',()=>held(tail(code)))

test('An unused native bound setter does not mutate the current consumer',()=>assert.equal(inspect(program(s=>exact(s,'container.appendChild(iframe);','const independentUnusedSetter=iframe.setAttribute.bind(iframe,"src","https://other.invalid/");container.appendChild(iframe);'))).consumerURL,BOARD+'?embed=js'))

for(const[label,op]of[
 ['additive guarded global base',s=>edit(s,n=>n.type==='AssignmentExpression'&&n.left.property?.name==='__ashbyBaseJobBoardUrl',part=>part.replace(' = ',' += '))],
 ['dead native frame identity setter',s=>edit(s,n=>n.type==='ExpressionStatement'&&n.expression.callee?.property?.name==='setAttribute'&&n.expression.arguments[0]?.value==='id',part=>'if(false){'+part+'}')],
 ['late native frame identity setter',s=>{let identity;const without=edit(s,n=>n.type==='ExpressionStatement'&&n.expression.callee?.property?.name==='setAttribute'&&n.expression.arguments[0]?.value==='id',part=>{identity=part;return';'});return exact(without,'container.appendChild(iframe);','container.appendChild(iframe);'+identity)}],
 ['namespaced source setter',s=>exact(s,'container.appendChild(iframe);','iframe.setAttributeNS(null,"src","https://other.invalid/");container.appendChild(iframe);')],
 ['source attribute removal',s=>exact(s,'container.appendChild(iframe);','iframe.removeAttribute("src");container.appendChild(iframe);')],
 ['container child replacement',s=>exact(s,'container.appendChild(iframe);','container.appendChild(iframe);container.replaceChildren();')],
 ['native frame removal',s=>exact(s,'container.appendChild(iframe);','container.appendChild(iframe);iframe.remove();')],
 ['unknown constructed URL method',s=>exact(s,'return url.href;','url.independentRewrite();return url.href;')],
 ['actual frame global escape',s=>exact(s,'container.appendChild(iframe);','window.independentSavedFrame=iframe;container.appendChild(iframe);')],
 ['actual container global escape',s=>exact(s,'container.appendChild(iframe);','window.independentSavedContainer=container;container.appendChild(iframe);')],
 ['actual URL global escape',s=>exact(s,'return url.href;','window.independentSavedURL=url;return url.href;')],
 ['actual query global escape',s=>exact(s,'return url.href;','window.independentSavedQuery=url.searchParams;return url.href;')],
 ['actual frame nested escape',s=>exact(s,'container.appendChild(iframe);','independentMutate({value:[iframe]});container.appendChild(iframe);')],
 ['actual frame object mutation escape',s=>exact(s,'container.appendChild(iframe);','Object.assign(window,{independentSavedFrame:iframe});container.appendChild(iframe);')],
 ['native constructor binding used before declaration',s=>{let created;const without=edit(s,n=>n.type==='VariableDeclaration'&&n.declarations.some(d=>d.id.name==='url'),part=>{created=part;return';'});return exact(without,'return url.href;','return url.href;'+created)}],
 ['native global initializer dead statement',s=>edit(s,n=>n.type==='IfStatement'&&n.test.type==='UnaryExpression'&&n.test.argument.property?.name==='__ashbyBaseJobBoardUrl',part=>part.replace('{','{throw new Error("stopped");'))],
 ['native interval callback throws before append',s=>exact(s,'window.setInterval(function () {','window.setInterval(function () {throw new Error("stopped");')]
])test('Changed '+label+' refuses an incoherent actual consumer',()=>held(program(op)))

test('Unrelated native frame presentation remains compatible',()=>assert.equal(inspect(program(s=>exact(s,'container.appendChild(iframe);','iframe.setAttribute("title","Current public opportunities");container.appendChild(iframe);'))).consumerURL,BOARD+'?embed=js'))
test('Ordinary unused functions and local object calls remain compatible',()=>assert.equal(inspect(tail('const independentAnalytics={release:3,emit:function(){}};independentAnalytics.emit.apply(null,independentArgs);function independentNotCalled(){const url={};url.rewrite();}')).consumerURL,BOARD+'?embed=js'))

test('A local frame document cannot override the original native src',()=>held(program(s=>exact(s,'container.appendChild(iframe);','iframe.setAttribute("srcdoc","<p>Different source</p>");container.appendChild(iframe);'))))
test('An inherited native base cannot hide behind the guarded literal initializer',()=>held(tail('Object.prototype.__ashbyBaseJobBoardUrl="https://jobs.ashbyhq.com/other";')))
test('A changed global prototype cannot supply another native account',()=>held(tail('window.__proto__={__ashbyBaseJobBoardUrl:"https://jobs.ashbyhq.com/other"};')))
test('A written alias of the actual frame cannot bypass native source guards',()=>held(program(s=>exact(s,'container.appendChild(iframe);','let independentFrame=iframe;if(independentCondition)independentFrame={};independentFrame.setAttribute("src","https://other.invalid/");container.appendChild(iframe);'))))

const crossFixture=JSON.parse(gunzipSync(await fs.readFile(new URL('./fixtures/current-v1-influxdata-observations-20261120.json.gz',import.meta.url)))),crossHOME='https://www.influxdata.com/careers/',crossBOARD='https://jobs.ashbyhq.com/Influxdata',crossCLIENT=crossBOARD+'/embed'
test('Independent unbranded compatibility retains all eight original Influxdata Responses and624394bytes',()=>{assert.equal(crossFixture.responses.length,8);assert.equal(crossFixture.responses.reduce((n,p)=>n+p.bytes,0),624394);for(const p of crossFixture.responses){const bytes=Buffer.from(p.bodyBase64,'base64');assert.equal(bytes.length,p.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),p.sha256)}})
for(const phase of[0,1])test('Independent review actual Influxdata '+(phase?'closing':'opening')+' registered keypress navigation remains unrelated to native construction',()=>{const model=inspect({homeHTML:body(crossFixture.responses.filter(p=>p.requestedUrl===crossHOME)[phase]),program:body(crossFixture.responses.filter(p=>p.requestedUrl===crossCLIENT)[phase]),homeURL:crossHOME,boardURL:crossBOARD,clientURL:crossCLIENT});assert.equal(model.consumerURL,crossBOARD+'?embed=js');assert.equal(model.nativeProgramsExecuted,false)})
test('Independent review finite250ms polling remains compatible with the same connected consumer',()=>assert.equal(inspect(program(s=>edit(s,n=>n.type==='CallExpression'&&n.callee.property?.name==='setInterval',part=>part.replace(', 100)',', 250)')))).consumerURL,BOARD+'?embed=js'))
const beforeClient=(code,type='text/javascript')=>{const d=document(original.homeHTML),all=n=>[n,...n.children.filter(c=>typeof c!=='string').flatMap(all)],selected=all(d.root).filter(n=>n.tag==='script'&&n.attrs.src===CLIENT);assert.equal(selected.length,1,'Actual own declared native client');const offset=selected[0].start;return original.homeHTML.slice(0,offset)+'<script type="'+type+'">'+code+'</script>'+original.homeHTML.slice(offset)}
for(const[label,code,type]of[
 ['global var base','var __ashbyBaseJobBoardUrl="https://jobs.ashbyhq.com/other";'],
 ['global var existing timer','var __ashbyAutoLoadIframeTimerID=7;'],
 ['global function base','function __ashbyBaseJobBoardUrl(){}'],
 ['object destructuring member target','({currentBase:window.__ashbyBaseJobBoardUrl}={currentBase:"https://jobs.ashbyhq.com/other"});'],
 ['array destructuring member target','[window.__ashbyBaseJobBoardUrl]=["https://jobs.ashbyhq.com/other"];'],
 ['for-of member target','for(window.__ashbyBaseJobBoardUrl of ["https://jobs.ashbyhq.com/other"]){}'],
 ['Object.assign literal argument spread','Object.assign(...[window,{__ashbyBaseJobBoardUrl:"https://jobs.ashbyhq.com/other"}]);'],
 ['Object.assign immutable-array argument spread','const peerArguments=[window,{__ashbyBaseJobBoardUrl:"https://jobs.ashbyhq.com/other"}];Object.assign(...peerArguments);'],
 ['mixed-case active JavaScript MIME','window.__ashbyBaseJobBoardUrl="https://jobs.ashbyhq.com/other";','Text/JavaScript']
])test('Exact independent review '+label+' cannot borrow the native account literal',()=>held({homeHTML:beforeClient(code,type)}))

for(const[label,code,type]of[
 ['uninitialized global declarations','var __ashbyBaseJobBoardUrl;var __ashbyAutoLoadIframeTimerID;'],
 ['function-local browser property names','function independentLocalNative(){var __ashbyBaseJobBoardUrl="ordinary";var __ashbyAutoLoadIframeTimerID=7;}'],
 ['global lexical property-name shadow','const __ashbyBaseJobBoardUrl="ordinary-local-lexical";'],
 ['coherent literal argument spread','Object.assign(...[window,{independentNativeRelease:{version:7}}]);'],
 ['unrelated member destructuring','({release:window.independentNativeRelease}={release:7});'],
 ['mixed-case non-executable JSON','window.__ashbyBaseJobBoardUrl="https://jobs.ashbyhq.com/other";','Application/JSON'],
 ['native DOM registered keypress redirect','document.querySelector("#independent-input").addEventListener("keydown",function(){window.location.href="/search/"});'],
 ['registered jQuery user redirect with another selector','jQuery("#independent-input").on("keyup",function(){window.location.href="/search/"});']
])test('Coherent '+label+' remains compatible with initial native construction',()=>assert.equal(inspect({homeHTML:beforeClient(code,type)}).consumerURL,BOARD+'?embed=js'))

for(const[label,code]of[
 ['global var for-of target','for(var __ashbyBaseJobBoardUrl of ["https://jobs.ashbyhq.com/other"]){}'],
 ['classic top-level block function','{function __ashbyBaseJobBoardUrl(){}}'],
 ['changed spread argument member','const independentArguments=[window,{}];independentArguments[1]={__ashbyBaseJobBoardUrl:"https://jobs.ashbyhq.com/other"};Object.assign(...independentArguments);'],
 ['changed spread argument method','const independentArguments=[window];independentArguments.push({__ashbyBaseJobBoardUrl:"https://jobs.ashbyhq.com/other"});Object.assign(...independentArguments);'],
 ['escaped spread argument tuple','const independentArguments=[window,{}];independentMutate(independentArguments);Object.assign(...independentArguments);']
])test('Connected declaration/argument dependency '+label+' cannot borrow a stale literal',()=>held({homeHTML:beforeClient(code)}))

// WHATWG MIME Sniffing section4.6 supplies these executable classic essences;
// HTML prepare-script steps10-15 distinguish metadata data blocks and modules.
for(const type of['application/ecmascript','application/javascript','application/x-ecmascript','application/x-javascript','text/ecmascript','text/javascript','text/javascript1.0','text/javascript1.1','text/javascript1.2','text/javascript1.3','text/javascript1.4','text/javascript1.5','text/jscript','text/livescript','text/x-ecmascript','text/x-javascript'])test('Browser-active classic MIME '+type+' cannot hide a current base overwrite',()=>held({homeHTML:beforeClient('window.__ashbyBaseJobBoardUrl="https://jobs.ashbyhq.com/other";',type)}))
const withScriptAttributes=(code,attributes)=>exact(beforeClient(code),'<script type="text/javascript">'+code+'</script>','<script '+attributes+'>'+code+'</script>'),foreignBase='window.__ashbyBaseJobBoardUrl="https://jobs.ashbyhq.com/other";'
for(const[label,attributes]of[['MIME parameters','type="text/javascript; charset=utf-8"'],['non-ASCII surrounding whitespace','type="&#160;text/javascript&#160;"'],['spaced module keyword','type=" module "'],['language data block','language="json"'],['classic nomodule data','nomodule']])test('Known non-executed '+label+' does not alter current native construction',()=>assert.equal(inspect({homeHTML:withScriptAttributes(foreignBase,attributes)}).consumerURL,BOARD+'?embed=js'))
for(const[label,attributes]of[['mixed-case language fallback','language="JavaScript"'],['empty explicit type overriding language','type="" language="json"'],['ASCII-trimmed classic essence','type="  Text/EcmaScript  "'],['mixed-case module keyword','type="MoDuLe"']])test('Browser-active '+label+' cannot hide native mutation',()=>held({homeHTML:withScriptAttributes(foreignBase,attributes)}))
for(const attributes of['type="application/json"','nomodule'])test('Actual declared native client with '+attributes+' cannot borrow fetched programme text',()=>held({homeHTML:exact(original.homeHTML,'src="'+CLIENT+'"','src="'+CLIENT+'" '+attributes)}))
for(const type of['Text/JavaScript','application/x-ecmascript','MoDuLe'])test('Actual connected native client type '+type+' preserves coherent browser carrier semantics',()=>assert.equal(inspect({homeHTML:exact(original.homeHTML,'src="'+CLIENT+'"','src="'+CLIENT+'" type="'+type+'"')}).consumerURL,BOARD+'?embed=js'))

const sparseClosing=code=>{const own=body(fixture.responses.filter(packet=>packet.requestedUrl===HOME)[1]),client=body(fixture.responses.filter(packet=>packet.requestedUrl===CLIENT)[1]);return{homeHTML:exact(own,'</body>','<script>'+code+'</script></body>'),program:client}}
for(const[label,code]of[['literal spread','Math.max(...[,1]);'],['apply arguments','Math.max.apply(null,[,1]);']])test('Sparse own-inline unrelated '+label+' preserves the actual connected consumer',()=>assert.equal(inspect(sparseClosing(code)).consumerURL,BOARD+'?embed=js'))
test('Sparse own-inline critical argument tuple cannot borrow current native base',()=>held(sparseClosing('Object.assign(...[window,,{__ashbyBaseJobBoardUrl:"https://jobs.ashbyhq.com/other"}]);')))
