import './currentLeafBoundary20261120.test.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {parse} from 'acorn'
import {fixture,replay,element,HOME,BOARD,FEED} from './currentConfiguredBoard20261120.test.js'

const JOBS=fixture.responses[1].requestedUrl,CLIENT=fixture.responses[2].requestedUrl
const exact=(s,a,b)=>{assert.equal(s.split(a).length,2,'Unique genuine connected handoff target');assert.notEqual(a,b);return s.replace(a,()=>b)}
const close=(url,op)=>(q,u,n)=>{if(u===url&&n===1)q.text=op(q.text)}
const attr=(s,n,v)=>s.slice(0,n.openEnd-n.start-1)+' '+v+'>'+s.slice(n.openEnd-n.start)
const ownBase=n=>n.tag==='script'&&!n.attrs.src&&(n.raw??'').includes('__ashbyBaseJobBoardUrl')
const ownEmbed=n=>n.tag==='script'&&n.attrs.src===CLIENT
const treeWalk=(n,p=null)=>!n||typeof n!=='object'?[]:[{n,p},...Object.entries(n).filter(([k])=>!['start','end','raw'].includes(k)).flatMap(([,v])=>Array.isArray(v)?v.flatMap(x=>treeWalk(x,n)):treeWalk(v,n))]
async function held(change){let changed=false,error;try{await replay((q,u,n)=>{const before=JSON.stringify(q);change(q,u,n);changed ||= before!==JSON.stringify(q)})}catch(e){error=e}assert(changed,'Connected handoff mutation actually reached original bytes');assert(error,'Disconnected or conflicting handoff cannot prove current empty projection');assert.equal(error.nativeContradiction,true);assert.equal(error.failureKind,'parser_or_contract_error')}
async function retained(change){const r=await replay(change);assert.equal(r.evidence.status,'complete-inventory');assert.equal(r.audit.companyIndiaTotal,null);assert.equal(r.audit.nativeProgramsExecuted,false);return r}

test('DailyPay preserves the exact authored filtered own handoff and distinct unfiltered native inventory',async()=>{const r=await retained();assert.deepEqual(r.calls.map(c=>c.url),[HOME,JOBS,CLIENT,BOARD,FEED,HOME,JOBS,CLIENT,BOARD,FEED]);assert(new URL(JOBS).searchParams.get('ashby_location_id'));for(const p of r.audit.observations){assert.equal(p.authority.declaredFilteredJobsURL,JOBS);assert.equal(p.authority.board,BOARD);assert.equal(p.authority.embedClient.connectedStaticConsumer,true);assert.equal(p.authority.embedClient.executed,false);assert.equal(p.rows.length,15)}})

for(const[label,predicate]of[['base declaration',ownBase],['executable embed',ownEmbed],['actual embed container',n=>n.attrs.id==='ashby_embed'],['own jobs h1',n=>n.tag==='h1']])for(const value of['data-is-published="false"','data-application-url="https://other.invalid/apply"','inert'])test('Actual DailyPay '+label+' '+value+' constrains handoff',()=>held(close(JOBS,h=>element(h,predicate,(s,n)=>attr(s,n,value)))))

test('DailyPay actual own Article publication is qualified',()=>held(close(HOME,h=>element(h,n=>n.tag==='script'&&n.attrs.type==='application/ld+json'&&(n.raw??'').includes('"@type":"Article"'),(s,n)=>{const m=JSON.parse(n.raw);m.isPublished=false;return exact(s,n.raw,JSON.stringify(m))}))))
test('DailyPay actual own Article publisher cannot identify another employer',()=>held(close(HOME,h=>element(h,n=>n.tag==='script'&&n.attrs.type==='application/ld+json'&&(n.raw??'').includes('"@type":"Article"'),(s,n)=>{const m=JSON.parse(n.raw);assert.equal(m.publisher.name,'DailyPay');m.publisher.name='Other Employer';return exact(s,n.raw,JSON.stringify(m))}))))
test('DailyPay actual jobs heading cannot identify another publisher',()=>held(close(JOBS,h=>element(h,n=>n.tag==='h1',s=>exact(s,'DailyPay','Other Employer')))))
test('Data-only own native declaration is not an executable handoff',()=>held(close(JOBS,h=>element(h,ownBase,(s,n)=>attr(s,n,'type="application/json"')))))
test('Data-only external embed is not an active native handoff',()=>held(close(JOBS,h=>element(h,ownEmbed,(s,n)=>attr(s,n,'type="application/json"')))))
test('Native base cannot silently change account',()=>held(close(JOBS,h=>element(h,ownBase,s=>exact(s,'"'+BOARD+'"','"https://jobs.ashbyhq.com/other"')))))
for(const[label,code]of[['direct base replacement','window.__ashbyBaseJobBoardUrl="https://other.invalid";'],['bound base replacement','const dailyBaseReplace=Object.assign.bind(Object,window);dailyBaseReplace({__ashbyBaseJobBoardUrl:"https://other.invalid"});'],['conflicting native settings','window.__Ashby={settings:{ashbyBaseJobBoardUrl:"https://other.invalid"}};']])test('Later own '+label+' cannot borrow the original declaration',()=>held(close(JOBS,h=>exact(h,'</body>','<script>'+code+'</script></body>'))))

for(const[label,from,to]of[
 ['disconnected exported object','window.__Ashby = __Ashby;','window.disconnectedDailyClient = __Ashby;'],
 ['disconnected base consumer','ashbyBaseJobBoardUrl: window.__ashbyBaseJobBoardUrl','ashbyBaseJobBoardUrl: "https://other.invalid"'],
 ['disconnected iframe source','window.__Ashby.buildIFrameUrl(settings, filterParams)','"https://other.invalid"'],
 ['disconnected container consumer','IFRAME_CONTAINER_ID: "ashby_embed"','IFRAME_CONTAINER_ID: "disconnected_daily_container"'],
 ['disabled default auto-load','autoLoad: true','autoLoad: false'],
 ['removed actual iframe append','container.appendChild(iframe);','void iframe;']
])test('Current embed '+label+' cannot qualify by unused matching code',()=>held(close(CLIENT,s=>exact(s,from,to))))

test('Disconnected registered initialization cannot borrow unused actual methods',()=>held(close(CLIENT,s=>{const from='window.__Ashby.initialize';assert.equal(s.split(from).length,4);return s.replaceAll(from,'window.__Ashby.disconnectedInitialize')})))
test('Disconnected actual auto-load calls cannot borrow the available load method',()=>held(close(CLIENT,s=>{const from='window.__Ashby.iFrame().load();';assert.equal(s.split(from).length,3);return s.replaceAll(from,'void 0;')})))
test('A later native client method replacement invalidates the connected consumer',()=>held(close(CLIENT,s=>s+'\nObject.assign(window.__Ashby,{buildIFrameUrl:()=>"https://other.invalid"});')))
test('Wrong executable native client MIME cannot qualify a handoff',()=>held((q,u,n)=>{if(u===CLIENT&&n===1)q.headers['content-type']='text/html'}))

test('Current client release comments are not runtime build pins',()=>retained(close(CLIENT,s=>s+'\n/* Ordinary native client release. */')))
test('An equivalent computed own base declaration remains a current handoff',()=>retained(close(JOBS,h=>element(h,ownBase,s=>exact(s,'window.__ashbyBaseJobBoardUrl','window["__ashbyBaseJobBoardUrl"]')))))
test('Native client local identifier spelling does not pin a build',()=>retained(close(CLIENT,s=>{const edits=treeWalk(parse(s,{ecmaVersion:'latest'})).filter(({n,p})=>n.type==='Identifier'&&n.name==='iframe'&&!(p?.type==='MemberExpression'&&!p.computed&&p.property===n)&&!(p?.type==='Property'&&!p.computed&&p.key===n));assert(edits.length>5);for(const{n}of edits.sort((a,b)=>b.n.start-a.n.start))s=s.slice(0,n.start)+'dailyFrame'+s.slice(n.end);return s})))
test('Current native client object property order does not pin a build',()=>retained(close(CLIENT,s=>{const a=treeWalk(parse(s,{ecmaVersion:'latest'})).find(({n})=>n.type==='VariableDeclarator'&&n.id.name==='__Ashby')?.n.init;assert.equal(a?.type,'ObjectExpression');return s.slice(0,a.start)+'{'+a.properties.map(p=>s.slice(p.start,p.end)).reverse().join(',')+'}'+s.slice(a.end)})))

for(const[label,code]of[
 ['direct settings base replacement','window.__Ashby.settings.ashbyBaseJobBoardUrl="https://other.invalid";'],
 ['mutated settings base replacement','Object.assign(window.__Ashby.settings,{ashbyBaseJobBoardUrl:"https://other.invalid"});'],
 ['changed automatic default','Object.assign(window.__Ashby.defaultSettings,{autoLoad:false});'],
 ['replaced native URL dependency','window.URL=function(){return {href:"https://other.invalid"}};'],
 ['replaced native Object.assign dependency','Object.assign=function(){return {ashbyBaseJobBoardUrl:"https://other.invalid"}};']
])test('Later current client '+label+' cannot borrow earlier connected syntax',()=>held(close(CLIENT,s=>s+'\n'+code)))
test('Actual created iframe src cannot be reassigned before its connected DOM consumer',()=>held(close(CLIENT,s=>exact(s,'container.appendChild(iframe);','iframe.src="https://other.invalid";container.appendChild(iframe);'))))
test('Actual returned URL origin cannot be reassigned through native Object.assign',()=>held(close(CLIENT,s=>exact(s,'return urlForIframe.href;','Object.assign(urlForIframe,{hostname:"other.invalid"});return urlForIframe.href;'))))
test('Unrelated current native client metadata can change without a build pin',()=>retained(close(CLIENT,s=>s+'\nObject.assign(window.__Ashby,{ordinaryReleaseInformation:{revision:3}});')))
