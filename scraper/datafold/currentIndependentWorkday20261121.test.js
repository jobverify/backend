import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import http from 'node:http'
import https from 'node:https'
import {gunzipSync} from 'node:zlib'
import {parse} from 'acorn'
import {pathToFileURL} from 'node:url'

import test from 'node:test'
import './currentMethodReceiver20261121.test.js'
const sha=x=>crypto.createHash('sha256').update(x).digest('hex')
const fixturePath='scraper/datafold/fixtures/complete-native-facts-20261120.json.gz',fixtureBytes=fs.readFileSync(fixturePath),fixture=JSON.parse(gunzipSync(fixtureBytes))
assert.equal(sha(fixtureBytes),'e8998a10a7a73235b9eb6396a0b97b0d6f084e97d4fe172915abd926259947ee')
const {document}=await import(pathToFileURL(path.resolve('scraper-support/shared/rmkNativePairHtml.js')))
const source=await import(pathToFileURL(path.resolve('scraper/datafold/script.js')))
const {default:metadata}=await import(pathToFileURL(path.resolve('scraper/datafold/catalog.js')))
const {readInventoryEvidence}=await import(pathToFileURL(path.resolve('scraper-support/utils/inventoryEvidence.js')))
const {assessSoftFailureAcquisition}=await import(pathToFileURL(path.resolve('scripts/softFailureAssessment20261113.mjs')))
const {getScraperCatalog,createCatalogScraper}=await import(pathToFileURL(path.resolve('scraper-support/providers/index.js')))
const HOME='https://www.datafold.com/careers/',BOARD='https://jobs.ashbyhq.com/datafold',FEED='https://api.ashbyhq.com/posting-api/job-board/datafold'
const decode=r=>Buffer.from(r.bodyBase64,'base64').toString('utf8')
const feed=JSON.parse(decode(fixture.responses.find(r=>r.requestedURL===FEED))),ROLE=feed.jobs[0].jobUrl,OTHER_ROLE=feed.jobs[1].jobUrl
const allowed=new Set([HOME,BOARD,FEED,ROLE,OTHER_ROLE])
const walk=n=>[n,...n.children.filter(c=>typeof c!=='string').flatMap(walk)]
const exact=(text,old,replacement)=>{assert.equal(text.split(old).length,2,'Unique actual carrier: '+old.slice(0,100));assert.notEqual(old,replacement);return text.replace(old,()=>replacement)}
function element(text,predicate,edit){const d=document(text),nodes=walk(d.root).filter(n=>predicate(n,d));assert.equal(nodes.length,1,'One actual selected element');const n=nodes[0],old=d.outer(n),changed=edit(old,n,d);assert.notEqual(changed,old);return text.slice(0,n.start)+changed+text.slice(n.end)}
const attribute=(text,node,attrs)=>text.slice(0,node.openEnd-node.start-1)+' '+attrs+'>'+text.slice(node.openEnd-node.start)
const content=(text,node,markup)=>text.slice(0,node.closeStart-node.start)+markup+text.slice(node.closeStart-node.start)
const programme=(html,edit)=>element(html,n=>n.tag==='script'&&!n.attrs.src&&(n.raw??'').includes('const ASHBY_ORG'),(text,n)=>{const changed=edit(n.raw);parse(changed,{ecmaVersion:'latest'});return exact(text,n.raw,changed)})
const program=edit=>closing(HOME,html=>programme(html,edit))
const prepend=code=>program(text=>code+'\n'+text)
const rowInsert=code=>program(text=>exact(text,'          return {\n            title: job.title,','          '+code+'\n          return {\n            title: job.title,'))
const loadInsert=code=>program(text=>exact(text,'    if (jobs.length) {','    '+code+'\n    if (jobs.length) {'))
const later=code=>closing(HOME,html=>exact(html,'</body>','<script>'+code+'</script></body>'))
const earlier=code=>closing(HOME,html=>element(html,n=>n.tag==='script'&&!n.attrs.src&&(n.raw??'').includes('const ASHBY_ORG'),text=>'<script>'+code+'</script>'+text))
function closing(url,edit){return(r,current,phase)=>{if(current===url&&phase===1)r.text=edit(r.text)}}
const attr=(url,predicate,attrs)=>closing(url,html=>element(html,predicate,(text,n)=>attribute(text,n,attrs)))
const mount=(markup,attrs='')=>closing(HOME,html=>element(html,n=>n.attrs.id==='careers-jobs-root',(text,n)=>content(attrs?attribute(text,n,attrs):text,{...n,closeStart:n.closeStart+(attrs?' '+attrs:'').length},markup)))
const criteria=(label,value)=>mount('<section><p>'+label+'</p><p>'+value+'</p></section>')
function modelEdit(html,edit){return element(html,n=>n.tag==='script'&&(n.raw??'').includes('window.__appData ='),(text,n)=>{const tree=parse(n.raw,{ecmaVersion:'latest'}),a=tree.body.find(s=>s.type==='ExpressionStatement'&&s.expression.type==='AssignmentExpression'&&s.expression.left.property?.name==='__appData')?.expression;assert.ok(a,'Actual native state assignment');const model=JSON.parse(n.raw.slice(a.right.start,a.right.end));edit(model);const changed=n.raw.slice(0,a.right.start)+JSON.stringify(model).replaceAll('<','\\u003c')+n.raw.slice(a.right.end);parse(changed,{ecmaVersion:'latest'});return exact(text,n.raw,changed)})}
const model=(url,edit)=>closing(url,html=>modelEdit(html,edit))
const schemaEdit=(html,edit)=>element(html,n=>n.tag==='script'&&(n.attrs.type??'').toLowerCase()==='application/ld+json',(text,n)=>{const value=JSON.parse(n.raw);edit(value);return exact(text,n.raw,JSON.stringify(value).replaceAll('<','\\u003c'))})
const schema=edit=>closing(ROLE,html=>schemaEdit(html,edit))
const feedEdit=edit=>closing(FEED,text=>{const value=JSON.parse(text);edit(value.jobs[0],value);return JSON.stringify(value)})
const ownSchema=value=>closing(HOME,html=>exact(html,'</body>','<script type="application/ld+json">'+JSON.stringify(value)+'</script></body>'))

const blocked=()=>{throw Object.assign(Error('Independent review blocked live network'),{reviewHarness:true})}
const saved={fetch:globalThis.fetch,http:http.request,https:https.request}
http.request=blocked;https.request=blocked;globalThis.fetch=blocked
const cases=[]
const add=(name,expected,change,options={})=>cases.push({name,expected,change,options})
add('actual default factory baseline','complete',null)
add('registered factory ordinary options baseline','complete',null,{registered:true,ordinary:true})
for(const[name,old,replacement]of[
 ['actual own account','const ASHBY_ORG = "datafold"','const ASHBY_ORG = "different"'],
 ['actual own endpoint',"const ASHBY_GQL = 'https://jobs.ashbyhq.com/api/non-user-graphql'","const ASHBY_GQL = 'https://other.example/api/non-user-graphql'"],
 ['board native collection query','jobPostings { id title teamId locationName workplaceType }','foreignPostings { id title teamId locationName workplaceType }'],
 ['same-record role ID','${ASHBY_ORG}/${job.id}','${ASHBY_ORG}/${job.anotherId}'],
 ['known listing default filter','(board?.jobPostings ?? []).map','(board?.jobPostings ?? []).filter(job=>job.locationName!=="India").map'],
 ['query account variable','{ organizationHostedJobsPageName: ASHBY_ORG },','{ organizationHostedJobsPageName: "different" },'],
 ['inverted selected public positive branch','if (jobs.length) {','if (!jobs.length) {'],
 ['default caller query origin','new URLSearchParams(window.location.search)',"new URLSearchParams('?ashby_jid=00000000-0000-0000-0000-000000000000')"],
 ['successful JSON return disconnected','return res.json();','return {};'],
 ['actual original output hidden','root.className = \'careers-jobs-list\';','root.className = \'careers-jobs-list\'; root.hidden=true;']
])add('own connection holds '+name,'hold',program(text=>exact(text,old,replacement)))
for(const[name,edit]of[
 ['renamed native account identifier',s=>s.replaceAll('ASHBY_ORG','CURRENT_ORG')],
 ['renamed local connected functions',s=>s.replace(/\bgql\b/g,'readCurrent').replace(/\bloadJobs\b/g,'loadCurrent').replace(/\bcardHtml\b/g,'renderCurrent')],
 ['query whitespace',s=>s.replaceAll('teams { id name }','teams {\n id name\n }')],
 ['unused scoped local document shadow',s=>'function unused(document){document.getElementById=()=>null;}\n'+s],
 ['unrelated parser comment',s=>s+'\n// Static original-response neighbor only\n']
])add('coherent own '+name,'complete',program(edit))

// Actual same-record object mutations through alias, mutable container and
// normalized local invocation boundaries. These are static contradictions;
// no helper in this publisher programme is invoked by the reviewer.
for(const[name,code]of[
 ['direct role mutation','job.id="other";'],
 ['direct constant alias','const alias=job; alias.id="other";'],
 ['assigned mutable alias','let alias; alias=job; alias.id="other";'],
 ['alias reassigned from unrelated initial object','let alias={}; alias=job; alias.id="other";'],
 ['property-assigned object container','const holder={}; holder.role=job; holder.role.id="other";'],
 ['index-assigned array container','const holder=[]; holder[0]=job; holder[0].id="other";'],
 ['reflected container insertion','const holder={}; Reflect.set(holder,"role",job); holder.role.id="other";'],
 ['descriptor container insertion','const holder={}; Object.defineProperty(holder,"role",{value:job}); holder.role.id="other";'],
 ['critical role assigned to global property','window.currentNativeRole=job; window.currentNativeRole.id="other";'],
 ['plain local function argument','function clear(value){value.id="other";} clear(job);'],
 ['call local function receiver','function clear(){this.id="other";} clear.call(job);'],
 ['apply local function receiver','function clear(){this.id="other";} clear.apply(job,[]);'],
 ['bound local function receiver','function clear(){this.id="other";} const clearRole=clear.bind(job); clearRole();'],
 ['Reflect.apply local function receiver','function clear(){this.id="other";} Reflect.apply(clear,job,[]);'],
 ['unknown local receiver role escape','job.unreviewedConsumer();'],
 ['unknown role argument escape','unknownConsumer(job);'],
 ['known method on unknown receiver','unreviewedReceiver.filter(job);'],
 ['local parameter shadow assignment','function clear(value){let other; other=value; other.id="other";} clear(job);'],
 ['local helper returns role container to assignment','function box(value){return {role:value};} let out; out=box(job); out.role.id="other";'],
 ['same-record mutable tuple','const args=[job]; args[0]={}; function clear(value){value.id="other";} clear(...args);']
])add('same-record dependency holds '+name,'hold',rowInsert(code))
for(const[name,code]of[
 ['read-only renamed role alias','const alias=job; void alias.id;'],
 ['object copy remains read-only','const copy={...job}; void copy.title;'],
 ['Object.assign copy remains read-only','const copy=Object.assign({},job); void copy.title;'],
 ['read-only local call','function read(value){return value.id;} void read.call(null,job);'],
 ['unused mutating local helper','function clear(value){value.id="other";} void clear;'],
 ['known primitive string-array reader','const names=[job.title]; void names.filter(Boolean).join("");'],
 ['unrelated object mutation','const analytics={}; analytics.count=1;'],
 ['unused role mutation bind','const unused=Object.assign.bind(Object,job); void unused;']
])add('coherent same-record '+name,'complete',rowInsert(code))
for(const[name,code]of[
 ['assigned output alias','let alias; alias=jobs; alias.splice(0);'],
 ['property-assigned output container','const holder={}; holder.rows=jobs; holder.rows.splice(0);'],
 ['local output receiver','function clear(){this.splice(0);} clear.call(jobs);']
])add('actual output holds '+name,'hold',loadInsert(code))

for(const[name,code]of[
 ['direct fetch replacement','fetch=()=>null;'],
 ['direct JSON serializer replacement','JSON.stringify=()=>"{}";'],
 ['local helper mutates document','function alter(value){value.getElementById=()=>null;} alter(document);'],
 ['local helper mutates serializer','function alter(value){value.stringify=()=>"{}";} alter(JSON);'],
 ['unknown document dependency escape','unknownBrowserConsumer(document);'],
 ['unknown serializer dependency escape','unknownBrowserConsumer(JSON);'],
 ['unknown aggregate dependency escape','unknownBrowserConsumer(Promise);'],
 ['reflected namespace replacement','Reflect.set(JSON,"stringify",()=>"{}");'],
 ['local helper receiver mutates document','function alter(){this.getElementById=()=>null;} alter.call(document);'],
 ['native getElementById prototype replaced','Object.setPrototypeOf(document,{getElementById:()=>null});']
])add('own actual browser dependency holds '+name,'hold',prepend(code))
add('cross-program helper replaces actual serializer','hold',earlier('function replaceSerializer(value){value.stringify=()=>"{}";} replaceSerializer(JSON);'))
add('later global fetch dependency replacement','hold',later('window.fetch=()=>null;'))
add('later captured mount selector coherent','complete',later('document.getElementById=()=>null;'))
add('unrelated cross-program global analytics coherent','complete',earlier('window.currentDatafoldAnalytics={revision:1};'))

for(const[label,value]of[['Country','India'],['Employer','Other Employer'],['Posting status','withdrawn'],['Application URL','https://other.example/apply'],['Location','Bengaluru, India']]){
 add('own native mount semantic holds '+label,'hold',criteria(label,value))
 for(const visibility of['hidden','inert','style="display:none"'])add('own hidden criterion holds '+label+' '+visibility,'hold',mount('<section '+visibility+'><p>'+label+'</p><p>'+value+'</p></section>'))
}
add('own coherent employer/status/application neighbors','complete',mount('<section><p>Employer</p><p>Datafold</p></section><section><p>Posting status</p><p>open</p></section><section><p>Application URL</p><p>'+BOARD+'</p></section>'))
for(const[field,value]of[['data-country','India'],['data-work-location-country','India'],['data-application-url','https://other.example/apply'],['data-job-application-uri','https://other.example/apply'],['data-posting-status','withdrawn']]){
 add('own mount property holds '+field,'hold',attr(HOME,n=>n.attrs.id==='careers-jobs-root',field+'="'+value+'"'))
 add('own programme property holds '+field,'hold',attr(HOME,n=>n.tag==='script'&&!n.attrs.src&&(n.raw??'').includes('const ASHBY_ORG'),field+'="'+value+'"'))
}
for(const field of['applicationUrl','jobApplicationURI','applicationLink'])add('own WebPage multiple handoff holds '+field,'hold',ownSchema({'@context':'https://schema.org','@type':'WebPage',url:HOME,name:'Careers at Datafold',applicationUrl:BOARD,[field]:'https://other.example/apply'}))
add('own publisher employer office is unscoped coherent','complete',ownSchema({'@context':'https://schema.org','@type':'Organization',name:'Datafold',url:'https://www.datafold.com/',address:{'@type':'PostalAddress',addressCountry:'Canada'}}))
add('own WebPage foreign named publisher holds','hold',ownSchema({'@context':'https://schema.org','@type':'WebPage',url:HOME,publisher:{name:'Other Employer'}}))
add('own WebPage branded coherent title','complete',ownSchema({'@context':'https://schema.org','@type':'WebPage',url:HOME,name:'Explore Datafold careers',publisher:{name:'Datafold'}}))

for(const url of[BOARD,ROLE]){
 for(const[field,value]of[['data-employer','Other Employer'],['data-posting-status','withdrawn'],['data-application-url','https://other.example/apply'],['data-job-application-uri','https://other.example/apply'],['data-work-location-country','India']])add('native actual mount holds '+url.split('/').at(-1)+' '+field,'hold',attr(url,n=>n.attrs.id==='root',field+'="'+value+'"'))
 for(const visibility of['hidden','inert','style="display:none"','style="visibility:hidden"'])add('native actual mount withdrawn holds '+url.split('/').at(-1)+' '+visibility,'hold',attr(url,n=>n.attrs.id==='root',visibility))
}
for(const[label,value]of[['Country','India'],['Employer','Other Employer'],['Posting status','withdrawn'],['Application URL','https://other.example/apply'],['Location','Bengaluru, India']])add('native actual role mount semantic holds '+label,'hold',closing(ROLE,html=>element(html,n=>n.attrs.id==='root',(text,n)=>content(text,n,'<section><p>'+label+'</p><p>'+value+'</p></section>'))))
add('native actual role mount coherent metadata','complete',attr(ROLE,n=>n.attrs.id==='root','data-employer="Datafold" data-posting-status="open" data-application-url="'+ROLE+'/application"'))
add('native actual board parser comment coherent','complete',closing(BOARD,html=>html+'<!-- bounded current native observation -->'))
add('native actual SVG title neighbor coherent','complete',closing(BOARD,html=>exact(html,'</body>','<svg><title>Unrelated company illustration</title></svg></body>')))

for(const[name,edit]of[
 ['primary India country',r=>{r.address.postalAddress.addressCountry='India'}],
 ['missing primary country',r=>{delete r.address.postalAddress.addressCountry}],
 ['secondary India location',r=>{r.secondaryLocations.push({location:'India',address:{postalAddress:{addressCountry:'India'}}})}],
 ['unlisted publication',r=>{r.isListed=false}],
 ['foreign application',r=>{r.applyUrl='https://other.example/apply'}],
 ['second application alias',r=>{r.applicationUrl='https://other.example/apply'}],
 ['future earliest public date',r=>{r.publishedAt='2027-01-01T00:00:00Z'}],
 ['closing role removed',(r,f)=>{f.jobs.pop()}],
 ['unknown termination',(r,f)=>{f.nextCursor='next'}],
 ['country Worldwide',r=>{r.location='Worldwide'}]
])add('native feed holds '+name,'hold',feedEdit(edit))
for(const[name,url,edit]of[
 ['board account',BOARD,m=>{m.organization.hostedJobsPageSlug='other'}],
 ['board employer',BOARD,m=>{m.organization.name='Other Employer'}],
 ['board membership',BOARD,m=>{m.jobBoard.jobPostings.pop()}],
 ['role hidden',ROLE,m=>{m.posting.isListed=false}],
 ['role confidentiality',ROLE,m=>{m.posting.isConfidential=true}],
 ['role India full criteria',ROLE,m=>{m.posting.compensationPhilosophyHtml='<p>Applicants must reside in India.</p>'}],
 ['role worldwide criteria',ROLE,m=>{m.posting.compensationPhilosophyHtml='<p>Applicants may work from anywhere in the world.</p>'}],
 ['role another country criteria',ROLE,m=>{m.posting.compensationPhilosophyHtml='<p>Applicants must reside in Canada.</p>'}],
 ['role active deadline',ROLE,m=>{m.posting.applicationDeadline='2026-01-01T00:00:00Z'}],
 ['role second application alias',ROLE,m=>{m.posting.jobApplicationURI='https://other.example/apply'}]
])add('native model holds '+name,'hold',model(url,edit))
for(const[name,edit]of[
 ['applicant India',s=>{s.applicantLocationRequirements.name='India'}],
 ['work country India',s=>{s.jobLocation.address.addressCountry='India'}],
 ['employer other',s=>{s.hiringOrganization.name='Other Employer'}],
 ['employer foreign sameAs',s=>{s.hiringOrganization.sameAs='https://other.example'}],
 ['secondary application alias',s=>{s.jobApplicationURI='https://other.example/apply'}],
 ['role identifier disconnect',s=>{s.identifier.value='00000000-0000-0000-0000-000000000000'}]
])add('native original schema holds '+name,'hold',schema(edit))

add('caller zero cap holds inventory','gap',null,{run:{maxJobs:0}})
add('ordinary denial stops first read','unavailable',(r,url,phase)=>{if(url===HOME&&phase===0)r.status=403})

for(const[name,node]of[
 ['own Organization sameAs',{'@context':'https://schema.org','@type':'Organization',name:'Datafold',url:'https://www.datafold.com/',sameAs:'https://other.example/'}],
 ['own Organization sameAs array',{'@context':'https://schema.org','@type':'Organization',name:'Datafold',url:'https://www.datafold.com/',sameAs:['https://www.datafold.com/','https://other.example/']}],
 ['own WebPage named publisher sameAs',{'@context':'https://schema.org','@type':'WebPage',url:HOME,publisher:{name:'Datafold',sameAs:'https://other.example/'}}],
 ['own WebPage named employer sameAs',{'@context':'https://schema.org','@type':'WebPage',url:HOME,employer:{name:'Datafold',url:'https://www.datafold.com/',sameAs:'https://other.example/'}}],
 ['own Organization explicit foreign URL',{'@context':'https://schema.org','@type':'Organization',name:'Datafold',url:'https://other.example/'}]
])add('issuer identity holds '+name,'hold',ownSchema(node))
for(const url of[BOARD,ROLE])for(const field of['sameAs','url','jobApplicationURI'])add('native issuer identity holds '+url.split('/').at(-1)+' '+field,'hold',model(url,m=>{m.organization[field]='https://other.example/'}))
add('own Organization coherent current sameAs','complete',ownSchema({'@context':'https://schema.org','@type':'Organization',name:'Datafold',url:'https://www.datafold.com/',sameAs:'https://www.datafold.com/'}))
add('own named publisher coherent current sameAs','complete',ownSchema({'@context':'https://schema.org','@type':'WebPage',url:HOME,publisher:{name:'Datafold',sameAs:'https://www.datafold.com/'}}))
add('native employer office Canada remains unscoped','complete',model(ROLE,m=>{m.organization.address={'@type':'PostalAddress',addressCountry:'Canada'}}))
add('native issuer coherent own sameAs','complete',model(ROLE,m=>{m.organization.sameAs='https://www.datafold.com/'}))

async function runCase(test){
 const counts=new Map(),calls=[],mutations=[],audits=[]
 const fetchImpl=async(url,init={})=>{url=String(url);assert.ok(allowed.has(url),'Only own/board/feed/full-role reads');assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');const phase=counts.get(url)??0;counts.set(url,phase+1);assert.ok(phase<2,'No extra retries/re-reads');const original=fixture.responses.filter(r=>r.requestedURL===url)[phase];assert.ok(original,'Actual paired original response exists');const r={text:decode(original),status:original.status,finalURL:original.finalURL,headers:{...original.headers}},before=JSON.stringify(r);test.change?.(r,url,phase);if(JSON.stringify(r)!==before)mutations.push({url,phase,originalSHA256:original.sha256,changedSHA256:sha(Buffer.from(r.text)),status:r.status});calls.push({url,phase,status:r.status,bytes:Buffer.byteLength(r.text)});return Object.defineProperties(new Response(Buffer.from(r.text),{status:r.status,headers:r.headers}),{url:{value:r.finalURL},redirected:{value:false}})}
 const factory=test.options.registered?createCatalogScraper(getScraperCatalog().find(r=>r.source==='datafold')):source.createDatafoldScraper()
 let result,error
 try{if(test.options.ordinary){globalThis.fetch=fetchImpl;try{result=await factory.run({})}finally{globalThis.fetch=blocked}}else result=await factory.run({fetchImpl,requestIntervalMs:0,now:fixture.capturedAt,...test.options.run,onAudit:a=>audits.push(a)})}catch(e){error=e}
 if(test.change)assert.ok(mutations.length>0,'Probe reached and changed actual response')
 const evidence=result?readInventoryEvidence(result):null,assessment=result?assessSoftFailureAcquisition(metadata,result):null
 const actual=error?(error.nativeContradiction===true&&error.failureKind==='parser_or_contract_error'?'hold':error.nativeUnavailable?'unavailable':'error'):evidence?.status==='complete-inventory'&&result.length===0&&assessment?.zeroJobEvidence==='fetched-zero'?'complete':evidence?.status==='coverage-gap'?'gap':'other'
 if(test.expected==='complete'&&actual==='complete'){assert.equal(calls.length,10);assert.equal(result.length,0);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null);assert.equal(evidence.lifecycleCleanupAllowed,false);assert.equal(assessment.cleanupOptions.replaceExisting,false);const audit=result.nativeCollectionEvidence;assert.equal(audit.observations.length,2);assert.deepEqual(audit.observations.map(x=>x.roles.length),[2,2]);assert.ok(audit.observations.every(x=>x.roles.every(role=>role.country==='United States')));for(const field of['sourceScopeComplete','currentRendererQualified','ownGraphQLBackendResponseAcquired','lifecycleCleanupAllowed','nativeProgramsExecuted'])assert.equal(audit[field],false);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.companyGlobalTotal,null)}
 if(test.expected==='unavailable')assert.equal(calls.length,1,'No retry after denial')
 return{name:test.name,expected:test.expected,actual,passed:actual===test.expected,harnessError:false,requestCount:calls.length,calls,mutations,evidence,assessment:assessment?{zeroJobEvidence:assessment.zeroJobEvidence,success:assessment.runnerOutcome.success,cleanup:assessment.cleanupOptions}:null,error:error?{name:error.name,message:error.message,nativeContradiction:error.nativeContradiction,failureKind:error.failureKind,nativeUnavailable:error.nativeUnavailable,status:error.status}:null}
}


assert.equal(cases.length,168,'Exact independent Workday control count')
for(const item of cases)test('Datafold independent Workday '+item.name,async()=>{const result=await runCase(item);assert.equal(result.actual,item.expected,JSON.stringify({name:result.name,expected:item.expected,actual:result.actual,error:result.error,mutations:result.mutations,requestCount:result.requestCount}))})
test.after(()=>{globalThis.fetch=saved.fetch;http.request=saved.http;https.request=saved.https})
export {runCase,rowInsert,prepend,mount}
