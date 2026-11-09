import {normalizeScrapedJob} from '../../utils/normalizeScrapedJob.js';
import https from 'node:https';import {EventEmitter} from 'node:events';import {Readable} from 'node:stream';import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';import test from 'node:test';import {replay,jsonPage,htmlPage,editJSON} from './fixtureReplay.js';
const native=await import('./nativeCareers.js').catch(()=>({})),transport=await import('./safeTransport.js').catch(()=>({}));
const factory=(source,defaults)=>{assert.equal(typeof native.createNativeGetSource,'function','new native GET factory must exist');return native.createNativeGetSource(source,defaults)};
for(const address of ['127.0.0.1','10.20.2.1','169.254.169.254','192.168.1.3','::1','fc00::1','fe80::1','::ffff:127.0.0.1'])test('private destination withheld: '+address,()=>{assert.equal(typeof transport.isPublicAddress,'function');assert.equal(transport.isPublicAddress(address),false)});
for(const address of ['8.8.8.8','2606:4700::1111'])test('public destination can recover: '+address,()=>{assert.equal(typeof transport.isPublicAddress,'function');assert.equal(transport.isPublicAddress(address),true)});
test('real GET transport withholds private DNS and allows a later public run',async()=>{
 assert.equal(typeof transport.createPublicPageReader,'function');let reads=0;
 const first=transport.createPublicPageReader({testOnlyInjectedTransport:true,resolveHost:async()=>[{address:'127.0.0.1',family:4}],fetchImpl:async()=>{reads++;throw Error('private HTTP attempted')}});
 await assert.rejects(first.read('https://dunzo.com/'),/public destination/i);assert.equal(reads,0);
 const later=transport.createPublicPageReader({testOnlyInjectedTransport:true,resolveHost:async()=>[{address:'8.8.8.8',family:4}],fetchImpl:async(url,init)=>{reads++;assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.body,undefined);assert.ok(!Object.keys(init.headers).some(k=>/cookie|authorization/i.test(k)));const r=new Response('original bytes');Object.defineProperty(r,'url',{value:String(url)});return r}});
 const page=await later.read('https://dunzo.com/');assert.equal(Buffer.from(page.bodyBase64,'base64').toString(),'original bytes');assert.equal(reads,1)
});
test('HTTP/auth/form/held routes are refused before injected HTTP I/O',async()=>{
 assert.equal(typeof transport.createPublicPageReader,'function');let reads=0;const io=transport.createPublicPageReader({testOnlyInjectedTransport:true,fetchPage:async()=>{reads++;throw Error('prohibited IO')}});
 for(const u of ['http://www.ikya.com/','https://user:pass@public.example/','https://jobs.ashbyhq.com/odin/x/application','https://www.coinbase.com/'])await assert.rejects(io.read(u),/withheld|prohibited|held/i);assert.equal(reads,0)
});
test('abort before transport makes no DNS or network request',async()=>{assert.equal(typeof transport.createPublicPageReader,'function');const c=new AbortController();c.abort(Error('stop now'));let calls=0;const io=transport.createPublicPageReader({testOnlyInjectedTransport:true,signal:c.signal,resolveHost:async()=>{calls++;return []},fetchImpl:async()=>{calls++}});await assert.rejects(io.read('https://www.joinodin.com/'),/stop now/);assert.equal(calls,0)});
const ashbyFeed='https://api.ashbyhq.com/posting-api/job-board/odin?includeCompensation=true',board='https://jobs.ashbyhq.com/odin',career='https://joinodin.notion.site/Careers-at-Odin-887cb068f5af4266a8986912f1bee72f';
const positivePrimary=new Map([['https://www.joinodin.com/',htmlPage('https://www.joinodin.com/','<title>Odin</title><a href="'+career+'">Careers</a>')],[career,htmlPage(career,'<title>Odin careers</title><a href="'+board+'">Jobs</a>')]]);
test('Odin synthetic visible declared chain keeps six original own records Global and caps only after enumeration',async()=>{
 const r=replay(undefined,positivePrimary),jobs=await factory('odin').run({...r.options,maxJobs:1});assert.equal(jobs.length,1);assert.equal(jobs[0].country,'United Kingdom');assert.equal(jobs[0].requisitionId,null);assert.equal(r.records[0].length,6);assert.equal(r.audits[0].candidateCount,6);assert.ok(r.records[0].every(o=>o.sourceNativeDetailQualified&&o.sourceNativeListingRecord.compensation&&o.sourceNativePosting&&o.sourceNativeJobPosting));
});
test('hidden company handoff cannot qualify Odin even with valid own data',async()=>{
 const e=new Map(positivePrimary);e.set(career,htmlPage(career,'<title>Odin careers</title><div style="display:none"><a href="'+board+'">Jobs</a></div>'));const r=replay(undefined,e),jobs=await factory('odin').run(r.options);assert.equal(jobs.length,0);assert.equal(r.audits[0].employerBindingQualified,false);assert.equal(r.records[0].length,6)
});
test('Odin own publisher mutation holds affected post and preserves other five observations',async()=>{
 const r=replay((u,p)=>u.startsWith(board+'/')?{...p,bodyBase64:Buffer.from(Buffer.from(p.bodyBase64,'base64').toString().replace('"name":"Odin","sameAs"','"name":"Other employer","sameAs"')).toString('base64')}:p,positivePrimary);
 const jobs=await factory('odin').run(r.options);assert.equal(jobs.length,0);assert.equal(r.records[0].length,6);assert.ok(r.records[0].every(o=>!o.sourceNativeDetailQualified))
});
test('maxJobs zero still emits detached awaited original Odin observations',async()=>{
 const r=replay(undefined,positivePrimary);let finished=false;const jobs=await factory('odin').run({...r.options,maxJobs:0,onAudit:async a=>{await Promise.resolve();a.observations.length=0;finished=true}});assert.equal(jobs.length,0);assert.equal(finished,true);assert.equal(r.records[0].length,6)
});
const api='https://api.smartrecruiters.com/v1/companies/Ikya1/postings';
const smartModel=(id,country)=>({id,uuid:id==='1001'?'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa':'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',name:'Engineer '+id,company:{identifier:'Ikya1',name:'ikya'},location:{country,city:country==='in'?'Bengaluru':'London',remote:false},releasedDate:'2026-11-01T10:00:00Z',ref:api+'/'+id});
const smartExtras=()=>{const rows=[smartModel('1001','in'),smartModel('1002','gb')],extras=new Map();extras.set(api,jsonPage(api,{offset:0,limit:1,totalFound:2,content:[rows[0]]}));extras.set(api+'?limit=1&offset=1',jsonPage(api+'?limit=1&offset=1',{offset:1,limit:1,totalFound:2,content:[rows[1]]}));
 for(const row of rows)extras.set(row.ref,jsonPage(row.ref,{...row,jobId:'internal-'+row.id,active:true,experienceLevel:{label:'Mid-Senior'},typeOfEmployment:{label:'Full-time'},jobAd:{sections:{jobDescription:{title:'Duties',text:'<p>Develop reliable systems.</p>'},qualifications:{title:'Qualifications',text:'<p>3+ years; degree or equivalent; SQL.</p>'},additionalInformation:{title:'Benefits',text:'<p>Pay and benefits discussed.</p>'}}}}));return extras};
test('Ikya future public nonempty pages read India and foreign own native criteria before caps; HTTP primary stays held',async()=>{
 const r=replay(undefined,smartExtras()),jobs=await factory('ikya').run({...r.options,maxJobs:0});assert.equal(jobs.length,0);assert.equal(r.records[0].length,2);assert.ok(r.records[0].every(o=>o.originalNative.jobAd.sections.qualifications.text.includes('SQL')&&o.requisitionId===null));assert.ok(r.requests.includes(api+'/1002'));assert.ok(!r.requests.some(u=>u.startsWith('http:')));assert.equal(r.audits[0].employerBindingQualified,false);assert.ok(r.audits[0].phases.every(p=>p.listingReadQualified&&p.listingRows.length===2))
});
test('Ikya error envelope with empty content is not a completed collection',async()=>{
 const e=new Map([[api,jsonPage(api,{offset:0,limit:100,totalFound:0,content:[],error:'upstream failed'})]]),r=replay(undefined,e);await factory('ikya').run(r.options);assert.ok(r.audits[0].phases.every(p=>!p.listingReadQualified));assert.equal(r.audits[0].selectedCollectionComplete,false)
});

const boundedOutcome=async promise=>{let timer;try{return await Promise.race([promise.then(()=>({kind:'resolved'}),error=>({kind:'rejected',error})),new Promise(resolve=>{timer=setTimeout(()=>resolve({kind:'still-waiting'}),150)})])}finally{clearTimeout(timer)}};
test('abort-ignoring injected fetch settles promptly when the caller aborts',async()=>{
 const controller=new AbortController(),io=transport.createPublicPageReader({testOnlyInjectedTransport:true,signal:controller.signal,resolveHost:async()=>[{address:'8.8.8.8',family:4}],fetchImpl:async()=>new Promise(()=>{})});const pending=io.read('https://timeout.example/');setTimeout(()=>controller.abort(Error('caller timeout')),20);const result=await boundedOutcome(pending);assert.equal(result.kind,'rejected');assert.match(result.error.message,/timeout/)
});
test('abort-ignoring body read settles and awaits stream cancellation',async()=>{
 const controller=new AbortController();let cancelled=false,released=false;const io=transport.createPublicPageReader({testOnlyInjectedTransport:true,signal:controller.signal,resolveHost:async()=>[{address:'8.8.8.8',family:4}],fetchImpl:async()=>({url:'https://body-timeout.example/',status:200,headers:new Headers(),body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel:async()=>{await Promise.resolve();cancelled=true},releaseLock:()=>{released=true}})}})});const pending=io.read('https://body-timeout.example/');setTimeout(()=>controller.abort(Error('body timeout')),20);const result=await boundedOutcome(pending);assert.equal(result.kind,'rejected');assert.equal(cancelled,true);assert.equal(released,true)
});
test('shared held hosts stop later cohort readers before transport I/O',async()=>{
 const heldHosts=new Set();let calls=0;const one=transport.createPublicPageReader({testOnlyInjectedTransport:true,heldHosts,fetchPage:async url=>{calls++;return {url,status:403,headers:{},bodyBase64:Buffer.from('denied').toString('base64')}}});await one.read('https://held.example/one');const two=transport.createPublicPageReader({testOnlyInjectedTransport:true,heldHosts,fetchPage:async()=>{calls++;throw Error('unexpected retry')}});await assert.rejects(two.read('https://held.example/two'),/held host/);assert.equal(calls,1)
});

for(const status of [401,403,429])test('R1 denial headers '+status+' survive a failed body and stop a later reader',async()=>{
 const heldHosts=new Set();let requests=0,cancelled=0;const host='denial-body-'+status+'.example',io=transport.createPublicPageReader({testOnlyInjectedTransport:true,heldHosts,resolveHost:async()=>[{address:'8.8.8.8',family:4}],fetchImpl:async()=>{requests++;return {status,url:'https://'+host+'/one',headers:new Headers(),body:{getReader:()=>({read:async()=>{throw Error('body reset')},cancel:async()=>{cancelled++},releaseLock:()=>{}})}}}});
 await assert.rejects(io.read('https://'+host+'/one'),/body reset/);assert.equal(heldHosts.has(host),true,'denial must hold before body completes');assert.ok(io.events.some(e=>e.status===status&&e.headersReceived===true),'denial metadata must survive failed body');const next=transport.createPublicPageReader({testOnlyInjectedTransport:true,heldHosts,resolveHost:async()=>[{address:'8.8.8.8',family:4}],fetchImpl:async()=>{requests++;throw Error('retried denied host')}});await assert.rejects(next.read('https://'+host+'/two'),/held host/);assert.equal(requests,1);assert.equal(cancelled,1)
});

const fakeHTTPS=(remoteAddress,inspect,status=200,body=Buffer.from('pinned body'),headers={})=>(options,respond)=>{
 inspect(options);const request=new EventEmitter(),socket=new EventEmitter();socket.remoteAddress=remoteAddress;socket.connecting=true;request.socket=socket;request.destroyed=false;
 request.destroy=error=>{request.destroyed=true;queueMicrotask(()=>request.emit('error',error||Error('request destroyed')));return request};
 request.end=()=>queueMicrotask(()=>{request.emit('socket',socket);socket.connecting=false;socket.emit('connect');socket.emit('secureConnect');if(!request.destroyed){const incoming=Readable.from([body]);incoming.statusCode=status;incoming.headers={'content-type':'text/plain',...headers};incoming.socket=socket;respond(incoming)}});return request;
};
test('R2 default HTTPS transport pins lookup addresses, original TLS hostname and a refreshed public DNS set',async()=>{
 const previousRequest=https.request,previousFetch=globalThis.fetch;let requests=0,resolves=0,unbound=0;
 globalThis.fetch=async()=>{unbound++;return new Response('unbound body')};https.request=fakeHTTPS('8.8.8.8',options=>{requests++;assert.equal(options.hostname,'pin-public.example');assert.equal(options.servername,'pin-public.example');assert.equal(options.rejectUnauthorized,true);assert.equal(options.method,'GET');let values;options.lookup('pin-public.example',{all:true},(error,addresses)=>{assert.equal(error,null);values=addresses});assert.deepEqual(values,[{address:'8.8.8.8',family:4}])});
 try{const io=transport.createPublicPageReader({resolveHost:async()=>[{address:++resolves===1?'8.8.8.8':'127.0.0.1',family:4}]});const page=await io.read('https://pin-public.example/first');assert.equal(Buffer.from(page.bodyBase64,'base64').toString(),'pinned body');await assert.rejects(io.read('https://pin-public.example/second'),/public destination/);assert.equal(resolves,2);assert.equal(requests,1);assert.equal(unbound,0)}finally{https.request=previousRequest;globalThis.fetch=previousFetch}
});
test('R2 rejects an actual socket outside its validated public destination set',async()=>{
 const previousRequest=https.request,previousFetch=globalThis.fetch;globalThis.fetch=async()=>new Response('unbound body');https.request=fakeHTTPS('127.0.0.1',()=>{});
 try{const io=transport.createPublicPageReader({resolveHost:async()=>[{address:'8.8.8.8',family:4}]});await assert.rejects(io.read('https://pin-mismatch.example/'),/validated|public destination|socket destination/)}finally{https.request=previousRequest;globalThis.fetch=previousFetch}
});
test('R2 compressed HTTPS entities use the same bounded decoded body contract',async()=>{
 const previousRequest=https.request,previousFetch=globalThis.fetch;globalThis.fetch=async()=>new Response('unbound body');https.request=fakeHTTPS('8.8.8.8',()=>{},200,gzipSync(Buffer.from('decoded original entity')),{'content-encoding':'gzip'});
 try{const io=transport.createPublicPageReader({resolveHost:async()=>[{address:'8.8.8.8',family:4}]});const page=await io.read('https://pin-compressed.example/');assert.equal(Buffer.from(page.bodyBase64,'base64').toString(),'decoded original entity')}finally{https.request=previousRequest;globalThis.fetch=previousFetch}
});
test('R2 arbitrary raw fetch overrides require explicit test-only injection',()=>{assert.throws(()=>transport.createPublicPageReader({fetchImpl:async()=>new Response('unbound')}),/test-only|unpinned|retained original/i)});

test('R4 Odin projected employer domain comes from its native reciprocal website, not the Notion career host',async()=>{
 const r=replay(undefined,positivePrimary),jobs=await factory('odin').run({...r.options,maxJobs:1});assert.equal(jobs.length,1);assert.equal(jobs[0].companyDomain,'joinodin.com');assert.ok(r.records[0].every(row=>row.companyDomain==='joinodin.com'));assert.equal(normalizeScrapedJob(structuredClone(jobs[0])).companyDomain,'joinodin.com')
});
