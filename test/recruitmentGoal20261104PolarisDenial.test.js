import test from 'node:test'
import assert from 'node:assert/strict'
import * as source from '../scraper/polaris.workday/script.js'
const blocked='<title>Attention Required! | Cloudflare</title><h1>Sorry, you have been blocked</h1><h2>You are unable to access polaris.com</h2>'
const careers='<title>Polaris Careers - Powersports Jobs & Internships</title><h1>Find your Next Job at Polaris</h1><p>Job Categories Locations Search Jobs Now</p>'
const board='<link rel="canonical" href="https://polaris.wd5.myworkdayjobs.com/PolarisJobs"><meta property="og:title" content="Polaris Jobs"><script>window.workday={tenant: "polaris", siteId: "PolarisJobs"}</script>'
for(const phase of ['careers','board'])for(const status of [202,401,403,429,451])test('Polaris stops at '+phase+' HTTP '+status+' before Workday delegation',async t=>{
 const calls=[];let delegated=0
 t.mock.method(globalThis,'fetch',async(url,init)=>{
  calls.push({url,init});const denied=phase==='careers'?url===source.CAREERS_URL:url===source.WORKDAY_BOARD_URL
  const response=new Response(denied?blocked:url===source.CAREERS_URL?careers:board,{status:denied?status:200,headers:{'content-type':'text/html'}})
  Object.defineProperty(response,'url',{value:url});return response
 })
 await assert.rejects(source.run({workdayRunner:async()=>{delegated++;return []}}),error=>error.status===status&&error.abortRetries===true)
 assert.equal(delegated,0);assert.deepEqual(calls.map(c=>c.url),phase==='careers'?[source.CAREERS_URL]:[source.CAREERS_URL,source.WORKDAY_BOARD_URL])
 for(const {init}of calls){assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')}
})
test('Polaris cannot accept a200 challenge body as publisher evidence',async()=>{
 const calls=[];let delegated=0
 await assert.rejects(source.run({fetchText:async url=>{calls.push(url);return url===source.CAREERS_URL?blocked:board},workdayRunner:async()=>{delegated++;return []}}),/careers shell/i)
 assert.equal(delegated,0);assert.deepEqual(calls,[source.CAREERS_URL]);assert.equal(source.hasAcceptedCareersShellSignal(blocked),false)
})
test('Polaris propagates the original403 error without fabricating a shell or reading the board',async()=>{
 const calls=[],reason=Object.assign(Error('HTTP 403 for '+source.CAREERS_URL),{status:403,abortRetries:true});let delegated=0
 await assert.rejects(source.run({fetchText:async url=>{calls.push(url);if(url===source.CAREERS_URL)throw reason;return board},workdayRunner:async()=>{delegated++;return []}}),error=>error===reason)
 assert.equal(delegated,0);assert.deepEqual(calls,[source.CAREERS_URL])
})
test('Polaris preserves pre-abort without invoking even an injected transport',async()=>{
 let calls=0;const reason=Error('Stop Polaris before reads')
 await assert.rejects(source.run({signal:AbortSignal.abort(reason),fetchText:async()=>{calls++;return careers},workdayRunner:async()=>[]}),error=>error===reason)
 assert.equal(calls,0)
})
test('Polaris rejects a denied response before trying to read its body',async t=>{
 let reads=0,calls=0
 t.mock.method(globalThis,'fetch',async url=>{calls++;return {url,status:403,ok:false,text:async()=>{reads++;return blocked}}})
 await assert.rejects(source.run({workdayRunner:async()=>[]}),error=>error.status===403)
 assert.equal(reads,0);assert.equal(calls,1)
})
test('Polaris cannot silently follow a changed shell response identity',async t=>{
 let delegated=0
 t.mock.method(globalThis,'fetch',async url=>{
  const response=new Response(url===source.CAREERS_URL?careers:board,{headers:{'content-type':'text/html'}})
  Object.defineProperty(response,'url',{value:'https://www.polaris.com/unrelated/'});return response
 })
 await assert.rejects(source.run({workdayRunner:async()=>{delegated++;return []}}),/response identity/i);assert.equal(delegated,0)
})
for(const [kind,wrap]of [['comment',s=>'<!--'+s+'-->'],['template',s=>'<template>'+s+'</template>'],['hidden',s=>'<section hidden>'+s+'</section>']])test('Polaris cannot accept inactive '+kind+' careers markup on a200 denial page',async()=>{
 const calls=[];let delegated=0
 const inactive='<title>Access Denied</title><h1>Access denied</h1>'+wrap(careers)
 await assert.rejects(source.run({fetchText:async url=>{calls.push(url);return url===source.CAREERS_URL?inactive:board},workdayRunner:async()=>{delegated++;return []}}),/careers shell/i)
 assert.equal(delegated,0);assert.deepEqual(calls,[source.CAREERS_URL])
})
test('Polaris cannot choose the official title over a contradictory active title',async()=>{
 let delegated=0
 await assert.rejects(source.run({fetchText:async url=>url===source.CAREERS_URL?'<title>Access Denied</title>'+careers:board,
  workdayRunner:async()=>{delegated++;return []}}),/careers shell/i)
 assert.equal(delegated,0)
})
for(const [kind,wrap]of [['comment',s=>'<!--'+s+'-->'],['template',s=>'<template>'+s+'</template>']])test('Polaris cannot accept inactive '+kind+' board declarations',async()=>{
 let delegated=0
 await assert.rejects(source.run({fetchText:async url=>url===source.CAREERS_URL?careers:'<title>Unavailable</title><h1>Unavailable</h1>'+wrap(board),
  workdayRunner:async()=>{delegated++;return []}}),/workday board/i)
 assert.equal(delegated,0)
})
for(const [kind,script]of [
 ['plain-text data','<script type="text/plain">tenant: "polaris", siteId: "PolarisJobs"</script>'],
 ['empty src','<script src="">window.workday={tenant: "polaris", siteId: "PolarisJobs"}</script>'],
 ['JavaScript comment','<script>// window.workday={tenant: "polaris", siteId: "PolarisJobs"}</script>'],
 ['quoted diagnostic','<script>const diagnostic=\'tenant: "polaris", siteId: "PolarisJobs"\';</script>'],
 ['uncalled function','<script>function inactive(){window.workday={tenant: "polaris", siteId: "PolarisJobs"}}</script>'],
 ['conflicting assignments','<script>window.workday={tenant: "polaris", siteId: "PolarisJobs"};window.workday={tenant: "other", siteId: "OtherJobs"};</script>'],
 ['duplicate identity field','<script>window.workday={tenant: "other",tenant: "polaris", siteId: "PolarisJobs"};</script>'],
 ['computed account replacement','<script>window.workday={tenant: "polaris", siteId: "PolarisJobs"};window["workday"]={tenant:"other",siteId:"OtherJobs"};</script>'],
 ['explicit tenant replacement','<script>window.workday={tenant: "polaris", siteId: "PolarisJobs"};window.workday.tenant="other";</script>'],
 ['computed site replacement','<script>window.workday={tenant: "polaris", siteId: "PolarisJobs"};window["workday"]["siteId"]="OtherJobs";</script>'],
 ['deleted tenant','<script>window.workday={tenant: "polaris", siteId: "PolarisJobs"};delete window.workday.tenant;</script>'],
 ['Object.assign identity replacement','<script>window.workday={tenant: "polaris", siteId: "PolarisJobs"};Object.assign(window.workday,{tenant:"other"});</script>'],
 ['Reflect.set identity replacement','<script>window.workday={tenant: "polaris", siteId: "PolarisJobs"};Reflect.set(window.workday,"siteId","OtherJobs");</script>'],
])test('Polaris cannot bind the board account using '+kind,async()=>{
 let delegated=0
 const invalid=board.replace(/<script>[\s\S]*?<\/script>/,script)
 await assert.rejects(source.run({fetchText:async url=>url===source.CAREERS_URL?careers:invalid,workdayRunner:async()=>{delegated++;return []}}),/workday board/i)
 assert.equal(delegated,0)
})
