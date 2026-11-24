import test,{after} from 'node:test'
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import {parse} from 'acorn'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {createRedpandaScraper} from './script.js'
import metadata from './catalog.js'

// Actual-response source boundary controls adopted unchanged from the independent
// 153-control review after its 34 demonstrated false-zero findings. No publisher
// JavaScript is executed; the controlled original Response bytes are inspected.
const fixture=JSON.parse(gunzipSync(await fs.readFile(new URL('./fixtures/current-native-20261120.json.gz',import.meta.url))))
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const oldFetch=globalThis.fetch
globalThis.fetch=async()=>{throw Error('Independent Redpanda regressions prohibit network')}
after(()=>{globalThis.fetch=oldFetch})
const HOME='https://www.redpanda.com/jobs',BOARD='https://jobs.ashbyhq.com/redpanda-data',FEED='https://api.ashbyhq.com/posting-api/job-board/redpanda-data',OTHER='https://other.example/apply'
const decode=row=>Buffer.from(row.bodyBase64,'base64').toString('utf8')
let originalBytes=0
for(const row of fixture.responses){const body=Buffer.from(row.bodyBase64,'base64');assert.equal(body.length,row.bytes);assert.equal(sha(body),row.sha256);originalBytes+=body.length;assert.equal(row.status,200);assert.equal(row.method,'GET');assert.equal(row.redirected,false)}
assert.equal(fixture.responses.length,4);assert.equal(originalBytes,580228)
const first=JSON.parse(decode(fixture.responses.find(row=>row.requestedUrl===FEED))).jobs[0]
const exact=(source,old,value)=>{assert.equal(source.split(old).length,2,'Unique actual original carrier: '+old.slice(0,90));assert.notEqual(old,value);return source.replace(old,()=>value)}
const walk=node=>[node,...node.children.filter(child=>typeof child!=='string').flatMap(walk)]
function element(html,predicate,change){const doc=document(html),nodes=walk(doc.root).filter(node=>predicate(node,doc));assert.equal(nodes.length,1,'One actual original carrier');const node=nodes[0],old=doc.outer(node),changed=change(old,node,doc);assert.notEqual(changed,old);return html.slice(0,node.start)+changed+html.slice(node.end)}
const attribute=(source,node,value)=>source.slice(0,node.openEnd-node.start-1)+' '+value+'>'+source.slice(node.openEnd-node.start)
function programEdit(html,change){return element(html,node=>node.tag==='script'&&!node.attrs.src&&(node.raw??'').includes("var ASHBY_BOARD = 'redpanda-data';"),(source,node)=>{const changed=change(node.raw);parse(changed,{ecmaVersion:'latest'});return exact(source,node.raw,changed)})}
const own=change=>(response,url,phase)=>{if(url===HOME&&phase===1)response.text=change(response.text)}
const script=change=>own(html=>programEdit(html,change))
const insert=code=>script(source=>exact(source,'  init();','  '+code+'\n  init();'))
const prepend=code=>script(source=>code+'\n'+source)
const append=code=>own(html=>exact(html,'</body>','<script>'+code+'</script></body>'))
const feed=change=>(response,url,phase)=>{if(url===FEED&&phase===1){const value=JSON.parse(response.text),row=value.jobs.find(row=>row.id===first.id);assert.ok(row);change(row,value);response.text=JSON.stringify(value)}}
function pageEdit(html,change){return element(html,node=>node.tag==='script'&&node.attrs.type==='application/ld+json'&&(node.raw??'').includes('"@type": "WebPage"'),(source,node)=>{const value=JSON.parse(node.raw);assert.equal(value['@type'],'WebPage');change(value);return exact(source,node.raw,JSON.stringify(value).replaceAll('<','\\u003c'))})}
const page=change=>own(html=>pageEdit(html,change))
const carrier=(predicate,attrs)=>own(html=>element(html,predicate,(source,node)=>attribute(source,node,attrs)))
const declaration=node=>node.tag==='script'&&!node.attrs.src&&(node.raw??'').includes("var ASHBY_BOARD = 'redpanda-data';")
const cases=[]
const add=(name,expected,change,options={})=>cases.push({name,expected,change,options})
add('Original full registered source factory qualifies only configured listed India projection','configured-empty')
add('Incidental original programme comments remain unpinned','configured-empty',script(source=>source+'\n// independent unchanged consumer release\n'))
add('Account identifier renaming retains lexical binding','configured-empty',script(source=>source.replaceAll('ASHBY_BOARD','CURRENT_PUBLIC_ACCOUNT')))
add('Unused scoped fetch and document shadows remain separate','configured-empty',prepend('function unused(fetch,document){fetch=function(){};document.addEventListener=function(){};}'))
add('Unused bound critical method is not an invocation','configured-empty',insert('var unused=Object.assign.bind(Object,ALL_JOBS); void unused;'))
add('Unused mutated invocation array is harmless','configured-empty',insert('var unusedArgs=[{},{}]; unusedArgs[0]=ALL_JOBS; void unusedArgs;'))
add('Unrelated sparse invocation arguments stay accepted','configured-empty',insert('Math.max(...[,1]); Math.max.apply(null,[,1]);'))
add('Separate unrelated global analytics are harmless','configured-empty',append('Object.assign(window,{independentRedpandaAnalytics:{version:7}});'))
add('Coherent branded head title wording remains unpinned','configured-empty',own(html=>element(html,node=>node.tag==='title'&&html.slice(0,node.start).lastIndexOf('<head')>html.slice(0,node.start).lastIndexOf('</head>'),(source,node)=>source.slice(0,node.openEnd-node.start)+'Explore Careers at Redpanda</title>')))
add('Generic own heading remains supported by named publisher facts','configured-empty',own(html=>element(html,node=>node.tag==='h1',(source,node)=>source.slice(0,node.openEnd-node.start)+'Current opportunities</h1>')))
add('Unrelated SVG title does not replace HTML publisher title','configured-empty',own(html=>exact(html,'</body>','<svg><title>Team illustration</title></svg></body>')))
add('Publisher country is not treated as vacancy geography','configured-empty',page(model=>{model.country='India'}))
add('Current page identifier fragment stays connected','configured-empty',page(model=>{model['@id']=HOME+'#careers'}))
add('Current coherent nested named Organization remains accepted','configured-empty',page(model=>{model.publisher={'@type':'Organization',name:'Redpanda',url:'https://www.redpanda.com/'}}))
add('Closing native rows may reorder without changing membership','configured-empty',feed((row,value)=>{value.jobs.reverse()}))
add('Explicit unlisted India role is excluded by actual publication filter','configured-empty',feed((row,value)=>{value.jobs.push({...structuredClone(row),id:'01234567-1234-1234-1234-123456789abc',isListed:false,location:'Bengaluru, India',address:{postalAddress:{addressCountry:'India'}}})}))
add('Current coherent optional employer and application aliases pass','configured-empty',feed(row=>{row.hiringOrganization={'@type':'Organization',name:'Redpanda'};row.applicationURI=row.applyUrl;row.country='Poland'}))
add('Current coherent typed Country name and code pass','configured-empty',feed(row=>{row.address.postalAddress.addressCountry={'@type':'Country',name:'Poland',identifier:'PL'}}))
add('Current coherent optional publication and expiry pass','configured-empty',feed(row=>{row.isPublished=true;row.postingStatus='active';row.validThrough='2027-01-01'}))
add('Nonbinding criteria prose changes do not pin whole descriptions','configured-empty',feed(row=>{row.descriptionHtml+='<p>Independent current role information.</p>'}))
for(const[name,change]of[
 ['Foreign own head title',html=>element(html,node=>node.tag==='title'&&html.slice(0,node.start).lastIndexOf('<head')>html.slice(0,node.start).lastIndexOf('</head>'),(source,node)=>source.slice(0,node.openEnd-node.start)+'Careers at Other Employer</title>')],
 ['Foreign own OG title',html=>element(html,node=>node.tag==='meta'&&node.attrs.property==='og:title',(source,node)=>{const matches=[...source.matchAll(/\bcontent\s*=\s*(?:"[^"]*"|'[^']*')/g)];assert.equal(matches.length,1,'Actual OG content attribute');return exact(source,matches[0][0],'content="Careers at Other Employer"')})],
 ['Foreign own canonical',html=>element(html,node=>node.tag==='link'&&node.attrs.rel==='canonical',(source,node)=>exact(source,node.attrs.href,'https://other.example/jobs'))]
])add(name+' cannot authorize configured zero','hold',own(change))
for(const[name,change]of[
 ['Own WebPage names another employer',model=>{model.name='Careers at Other Employer'}],
 ['Own WebPage different same-origin URL',model=>{model.url='/other-careers'}],
 ['Own WebPage different same-origin identifier',model=>{model['@id']='https://www.redpanda.com/other-careers#page'}],
 ['Own WebPage explicitly unpublished',model=>{model.isPublished=false}],
 ['Own WebPage foreign hiring organization',model=>{model.hiringOrganization={'@type':'Organization',name:'Other Employer'}}],
 ['Own WebPage foreign application alias',model=>{model.applicationUrl=OTHER}],
 ['Own WebPage nested mainEntityOfPage foreign path',model=>{model.mainEntityOfPage={'@type':'WebPage','@id':'https://www.redpanda.com/other-careers'}}],
 ['Own WebPage nested untitled mainEntityOfPage foreign identifier',model=>{model.mainEntityOfPage={'@id':'https://other.example/jobs'}}],
 ['Own WebPage untyped nested publisher foreign employer',model=>{model.publisher={name:'Other Employer'}}],
 ['Own WebPage typed nested publisher foreign employer',model=>{model.publisher={'@type':'Organization',name:'Other Employer'}}],
 ['Own WebPage context replacement',model=>{model['@context']='https://other.example/schema'}]
])add(name+' constrains authority','hold',page(change))
for(const[name,predicate,attrs]of[
 ['Actual consumer publication',declaration,'data-is-published="false"'],
 ['Actual consumer employer',declaration,'data-employer="Other Employer"'],
 ['Actual consumer application',declaration,'data-application-uri="'+OTHER+'"'],
 ['Actual consumer hidden carrier',declaration,'hidden'],
 ['Actual container disabled carrier',node=>node.attrs['data-careers']==='jobs-container','aria-disabled="true"'],
 ['Actual template unpublished carrier',node=>node.attrs['data-careers']==='job-template','data-is-published="false"'],
 ['Actual heading employer',node=>node.tag==='h1','data-employer="Other Employer"'],
 ['Actual consumer JSON data carrier',declaration,'type="application/json"'],
 ['Actual consumer classic nomodule carrier',declaration,'nomodule']
])add(name+' cannot provide authority','hold',carrier(predicate,attrs))
for(const type of['text/ecmascript',' Text/JavaScript\t','application/x-javascript'])add('Active browser JS carrier '+JSON.stringify(type)+' stays connected','configured-empty',carrier(declaration,'type="'+type+'"'))
for(const[name,old,value]of[
 ['DOM-ready event replacement',"document.addEventListener('DOMContentLoaded'","document.addEventListener('not-current-careers'"],
 ['Initializer invocation disconnected','  init();','  void init;'],
 ['Fetch invocation disconnected','    fetchJobs();','    void fetchJobs;'],
 ['Current feed URL replaced',"fetch('https://api.ashbyhq.com/posting-api/job-board/'","fetch('https://other.example/posting-api/job-board/'"],
 ['JSON decoding disconnected','return r.json();','return r.otherJSON();'],
 ['Original listed record flow disconnected','ALL_JOBS = data.jobs.filter','ALL_JOBS = otherData.jobs.filter'],
 ['Listed filter predicate inverted','return j.isListed !== false;','return j.isListed === false;'],
 ['Filtered state disconnected','var filtered = ALL_JOBS.filter','var filtered = otherJobs.filter'],
 ['Renderer invocation disconnected','    render(groupByDepartment(filtered));','    void groupByDepartment(filtered);'],
 ['Native projected title disconnected','title: job.title, url: job.jobUrl','title: job.otherTitle, url: job.jobUrl'],
 ['Native projected URL disconnected','url: job.jobUrl','url: job.otherUrl'],
 ['Actual link assignment disconnected','link.href = job.url','link.href = job.otherUrl'],
 ['Actual title assignment disconnected','title.textContent = job.title','title.textContent = job.otherTitle'],
 ['Actual job append disconnected','list.appendChild(item);','list.appendChild(otherItem);'],
 ['Actual department append disconnected','container.appendChild(deptEl);','container.appendChild(otherDepartment);'],
 ['DOM-ready callback returns before initialization',"  var ASHBY_BOARD = 'redpanda-data';","  return;\n  var ASHBY_BOARD = 'redpanda-data';"],
 ['DOM-ready callback throws before initialization',"  var ASHBY_BOARD = 'redpanda-data';","  throw new Error('unavailable');\n  var ASHBY_BOARD = 'redpanda-data';"],
 ['Initializer returns before current feed request','  function init() {','  function init() {\n    return;'],
 ['Fetch function returns before native request','  function fetchJobs() {','  function fetchJobs() {\n    return;'],
 ['Data callback returns before listed collection','        if (!data || !Array.isArray(data.jobs)) return;','        return;\n        if (!data || !Array.isArray(data.jobs)) return;'],
 ['Grouping returns empty before original record loop','  function groupByDepartment(jobs) {','  function groupByDepartment(jobs) {\n    return [];'],
 ['Renderer returns before native record effects','  function render(departments) {','  function render(departments) {\n    return;'],
 ['Role callback returns before native effects','        var item = JOB_TPL.cloneNode(true);','        return;\n        var item = JOB_TPL.cloneNode(true);'],
 ['Role append is behind false condition','        list.appendChild(item);','        if (false) { list.appendChild(item); }'],
 ['Grouping pushes records into disconnected array','      map[name].jobs.push({ title: job.title, url: job.jobUrl });','      otherRows.push({ title: job.title, url: job.jobUrl });'],
 ['Grouped return discards original records',"    return Object.keys(map).sort(function (a, b) { return a.localeCompare(b); })\n      .map(function (n) { return map[n]; });",'    return [];'],
 ['Current filtered collection is emptied by predicate','return matches(j, active, q);','return false;'],
 ['Current filtered array is truncated before grouping','    render(groupByDepartment(filtered));','    filtered.length = 0;\n    render(groupByDepartment(filtered));'],
 ['Native role URL is replaced before grouping','      map[name].jobs.push({ title: job.title, url: job.jobUrl });',"      job.jobUrl = 'https://other.example/apply';\n      map[name].jobs.push({ title: job.title, url: job.jobUrl });"],
 ['Grouped role URL is replaced before link effect','        if (link) link.href = job.url;',"        job.url = 'https://other.example/apply';\n        if (link) link.href = job.url;"],
 ['Actual link effect is overwritten afterward','        if (link) link.href = job.url;',"        if (link) link.href = job.url;\n        if (link) link.href = 'https://other.example/apply';"],
 ['Actual title effect is overwritten afterward','        if (title) title.textContent = job.title;',"        if (title) title.textContent = job.title;\n        if (title) title.textContent = 'No current vacancies';"]
])add('Static connected consumer: '+name,'hold',script(source=>exact(source,old,value)))
for(const[name,code]of[
 ['Direct native collection clear','ALL_JOBS.length=0;'],
 ['Aliased collection clear','var rows=ALL_JOBS; rows.splice(0);'],
 ['Bound critical reflection','var clear=Reflect.set.bind(Reflect); clear(ALL_JOBS,"length",0);'],
 ['Known invocation array member replacement','var args=[{}, {length:0}]; args[0]=ALL_JOBS; Object.assign(...args);'],
 ['Known apply array member replacement','var args=[{}, {length:0}]; args[0]=ALL_JOBS; Object.assign.apply(null,args);'],
 ['Known call spread array member replacement','var args=[null,{}, {length:0}]; args[1]=ALL_JOBS; Object.assign.call(...args);'],
 ['Known invocation array splice replacement','var args=[{}, {length:0}]; args.splice(0,1,ALL_JOBS); Object.assign(...args);'],
 ['Invocation array escapes before critical spread','var args=[{}, {length:0}]; replaceArgs(args); Object.assign(...args);'],
 ['Local helper mutates invocation array before spread','function replaceArgs(values){values[0]=ALL_JOBS;} var args=[{}, {length:0}]; replaceArgs(args); Object.assign(...args);'],
 ['Bound invocation array argument replacement','var args=[{}, {length:0}]; args[0]=ALL_JOBS; var write=Object.assign.bind(Object); write(...args);'],
 ['Actual original collection escapes to unknown call','externalCollectionConsumer(ALL_JOBS);']
])add('Static connected state: '+name,'hold',insert(code))
for(const[name,code,where]of[
 ['Bare global fetch assignment','fetch=function(){return Promise.resolve({jobs:[]});};','before'],
 ['Browser global fetch assignment','window.fetch=function(){return Promise.resolve({jobs:[]});};','before'],
 ['Browser global alias fetch assignment','var browser=window; browser.fetch=function(){return Promise.resolve({jobs:[]});};','before'],
 ['Reflected global fetch assignment','Reflect.set(window,"fetch",function(){return Promise.resolve({jobs:[]});});','before'],
 ['DOM-ready registration method replacement','document.addEventListener=function(){};','before'],
 ['Later programme global fetch assignment','window.fetch=function(){return Promise.resolve({jobs:[]});};','after'],
 ['Later programme bare fetch assignment','fetch=function(){return Promise.resolve({jobs:[]});};','after'],
 ['Later programme DOM registration replacement','document.addEventListener=function(){};','after']
])add('Static connected browser dependency: '+name,name==='Later programme DOM registration replacement'?'configured-empty':'hold',where==='before'?prepend(code):append(code))
for(const[name,change]of[
 ['native India primary country',row=>{row.address.postalAddress.addressCountry='India'}],
 ['missing native primary country',row=>{delete row.address.postalAddress.addressCountry}],
 ['unresolved native primary country',row=>{row.address.postalAddress.addressCountry='Atlantis'}],
 ['native typed country context differs',row=>{row.address.postalAddress.addressCountry={'@context':'https://other.example/schema','@type':'Country',name:'Poland'}}],
 ['typed country alias conflicts',row=>{row.address.postalAddress.addressCountry={'@type':'Country',name:'Poland',identifier:'IN'}}],
 ['same-address explicit country alias India',row=>{row.address.postalAddress.country='India'}],
 ['same-address locality India',row=>{row.address.postalAddress.addressLocality='Bengaluru, India'}],
 ['same-address region India',row=>{row.address.postalAddress.addressRegion='India'}],
 ['native authored workplace India',row=>{row.location='Bengaluru, India'}],
 ['native worldwide workplace',row=>{row.location='Anywhere - Remote'}],
 ['native unknown country alternative',row=>{row.location='Poland/Atlantis - Remote'}],
 ['native India country alternative',row=>{row.location='Poland/India - Remote'}],
 ['native primary country alias India',row=>{row.workCountry='India'}],
 ['native secondary workplace India',row=>{row.secondaryLocations.push({location:'Bengaluru, India',address:{postalAddress:{addressCountry:'India'}}})}],
 ['native secondary authored contradiction',row=>{row.secondaryLocations.push({location:'Bengaluru, India',address:{postalAddress:{addressCountry:'United States'}}})}],
 ['native extra typed primary workplace India',row=>{row.jobLocation={'@type':'Place',address:{'@type':'PostalAddress',addressCountry:'India',addressLocality:'Bengaluru'}}}],
 ['native plural workplaces include India',row=>{row.workLocations=[{'@type':'Place',address:{'@type':'PostalAddress',addressCountry:'Poland'}},{'@type':'Place',address:{'@type':'PostalAddress',addressCountry:'India'}}]}],
 ['native employer replacement',row=>{row.employer='Other Employer'}],
 ['native typed hiring employer replacement',row=>{row.hiringOrganization={'@type':'Organization',name:'Other Employer'}}],
 ['native legal employer conflict',row=>{row.legalEmployer='Other Employer'}],
 ['native listed false removes closing member',row=>{row.isListed=false}],
 ['native listed flag missing',row=>{delete row.isListed}],
 ['native publication false',row=>{row.isPublished=false}],
 ['native publication string false',row=>{row.active='false'}],
 ['native archived true',row=>{row.isArchived=true}],
 ['native withdrawn status',row=>{row.publicationStatus='withdrawn'}],
 ['native confidential true',row=>{row.isConfidential=true}],
 ['native application URL replacement',row=>{row.applyUrl=OTHER}],
 ['native public URL account replacement',row=>{row.jobUrl=row.jobUrl.replace('/redpanda-data/','/other-account/')}],
 ['native application URI alias replacement',row=>{row.applicationURI=OTHER}],
 ['native detail URL alias replacement',row=>{row.detailUrl=OTHER}],
 ['native explicit future posted date',row=>{row.publishedAt='2027-01-01T00:00:00.000Z'}],
 ['native malformed original date',row=>{row.publishedAt='recent'}],
 ['native expired deadline',row=>{row.validThrough='2026-01-01'}],
 ['native expired application deadline',row=>{row.applicationDeadline='2026-01-01'}],
 ['closing native identity replacement',row=>{row.id='01234567-1234-1234-1234-123456789abc';row.jobUrl=BOARD+'/'+row.id;row.applyUrl=row.jobUrl+'/application'}],
 ['closing native title replacement',row=>{row.title='Different current title'}],
 ['closing native membership removal',(row,value)=>{value.jobs.pop()}],
 ['closing duplicate native role',(row,value)=>{value.jobs.push(structuredClone(row))}],
 ['unknown feed pagination',(row,value)=>{value.nextCursor='more'}],
 ['empty native collection',(row,value)=>{value.jobs=[]}]
])add('Actual closing feed: '+name,'hold',feed(change))
for(const[label,value]of[['Country','India'],['Employer','Other Employer'],['Posting status','withdrawn'],['Application URL',OTHER],['Location','Bengaluru, India']]){
 add('Actual same-role adjacent paragraph '+label+' contradiction','hold',feed(row=>{row.descriptionHtml+='<section><p>'+label+'</p><p>'+value+'</p></section>'}))
}
for(const[name,facts]of[
 ['publication false',{isPublished:false}],
 ['country India',{country:'India'}],
 ['employer conflict',{hiringOrganization:{'@type':'Organization',name:'Other Employer'}}],
 ['application conflict',{applicationUrl:OTHER}],
 ['different role identity',{url:BOARD+'/01234567-1234-1234-1234-123456789abc'}]
])add('Actual same-role typed WebPage '+name,'hold',feed(row=>{row.descriptionHtml+='<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'WebPage',url:row.jobUrl,name:row.title,...facts})+'</script>'}))
add('Coherent same-role typed WebPage remains qualified','configured-empty',feed(row=>{row.descriptionHtml+='<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'WebPage',url:row.jobUrl,name:row.title,isPublished:true,country:'Poland',hiringOrganization:{'@type':'Organization',name:'Redpanda'},applicationUrl:row.applyUrl})+'</script>'}))
add('Critical origin403 stops without retry','unavailable-first',(response,url,phase)=>{if(url===HOME&&phase===0)response.status=403})
add('Critical closing feed503 cannot provide zero','unavailable',(response,url,phase)=>{if(url===FEED&&phase===1)response.status=503})
add('Critical closing complete200 malformed JSON cannot provide zero','hold',(response,url,phase)=>{if(url===FEED&&phase===1)response.text='{"jobs":'})
add('Zero caller cap performs no requests or configured zero claim','coverage-gap',null,{maxJobs:0})

async function run(change,options){const counts=new Map(),calls=[],audits=[];let changed=0,harnessError,jobs,error
 try{const scraper=createRedpandaScraper({now:fixture.observedAt,requestIntervalMs:0,...options,onAudit:async audit=>audits.push(audit),fetchImpl:async(url,init)=>{try{
  assert.ok([HOME,FEED].includes(url),'Only actual own and declared feed responses are available');assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual')
  const phase=counts.get(url)??0;counts.set(url,phase+1);const original=fixture.responses.filter(row=>row.requestedUrl===url)[phase];assert.ok(original,'Only four actual original response occurrences')
  const response={...original,headers:{...original.headers},text:decode(original)},old=JSON.stringify(response);change?.(response,url,phase);if(JSON.stringify(response)!==old)changed++
  calls.push({url,phase,status:response.status});return Object.defineProperties(new Response(Buffer.from(response.text),{status:response.status,headers:response.headers}),{url:{value:response.url},redirected:{value:response.redirected}})
 }catch(failure){harnessError=failure;throw failure}}});assert.equal(scraper.name,'redpanda');jobs=await scraper.run({})}catch(failure){error=failure}
 if(harnessError)throw harnessError;if(change)assert.ok(changed>0,'Guarded actual original response mutation applied')
 return{jobs,error,changed,calls,audits,evidence:jobs?readInventoryEvidence(jobs):null,assessment:jobs?assessSoftFailureAcquisition(metadata,jobs):null}}
export{run,script,own,page,append,insert,exact}

for(const control of cases)test('Redpanda independent boundary: '+control.name,async()=>{
 const result=await run(control.change,control.options)
 const empty=!result.error&&result.jobs.length===0&&result.audits.length===1&&result.audits[0].observations.length===2&&result.audits[0].observations.every(observation=>observation.rows.length===12)&&result.audits[0].nativeProgramsExecuted===false&&result.audits[0].rendererOrUIActivationVerified===false&&result.audits[0].backendApplicationActivationVerified===false&&result.audits[0].companyIndiaTotal===null&&result.audits[0].sourceScopeComplete===false&&result.evidence.status==='complete-inventory'&&result.evidence.listingComplete===true&&result.evidence.reportedTotal===null&&result.evidence.indiaFacetCount===null&&result.assessment.runnerOutcome.success===true&&result.assessment.zeroJobEvidence==='fetched-zero'&&result.assessment.cleanupOptions.replaceExisting===false
 const held=result.error?.nativeContradiction===true&&result.error?.failureKind==='parser_or_contract_error'
 const coverage=!result.error&&result.calls.length===0&&result.evidence.status==='coverage-gap'&&result.assessment.runnerOutcome.success===false
 const passed=control.expected==='configured-empty'?empty:control.expected==='unavailable-first'?result.error?.nativeUnavailable===true&&result.calls.length===1:control.expected==='unavailable'?result.error?.nativeUnavailable===true:control.expected==='coverage-gap'?coverage:held
 assert.equal(Boolean(passed),true,JSON.stringify({expected:control.expected,error:result.error?.message,evidence:result.evidence?.status,zeroJobEvidence:result.assessment?.zeroJobEvidence}))
})
