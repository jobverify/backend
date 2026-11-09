import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
const native = await import('./nativeCurrentWorkable.js').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND' && error.message.includes('nativeCurrentWorkable.js')) return {}
  throw error
})
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/workable-current-derived-20261107.json.gz',import.meta.url))))
const copy=value=>structuredClone(value)
const at='2026-11-07T19:00:00.000Z'
const row=fixture.feed.jobs.find(row=>row.shortcode===fixture.details[0].shortcode)
test('genuine derived current feed and two own full details preserve supported facts without criteria inference',()=>{
  const feed=native.decodeDiscoveryFeed(fixture.feed)
  assert.equal(feed.rows.length,14);assert.equal(feed.india.length,6)
  const account=native.decodeNativeAccount(fixture.account)
  for(const detail of fixture.details){
    const proxy=feed.rows.find(row=>row.shortcode===detail.shortcode)
    const job=native.decodeNativeRole(detail,proxy,account,at)
    assert.equal(job.jobId,detail.shortcode);assert.equal(job.nativeId,detail.id)
    assert.equal(job.discoveryProxyId,proxy.id);assert.notEqual(proxy.id,String(detail.id))
    assert.equal(job.country,'India');assert.equal(job.company,'Leena AI')
    assert.equal(job.postingDate,detail.published);assert.notEqual(job.postingDate,proxy.createdAt)
    assert.deepEqual(job.sourceNativeCriteria,{description:detail.description,requirements:detail.requirements,benefits:detail.benefits})
    assert.equal(job.experienceRequired,null);assert.equal(job.minimumQualification,null)
    assert.deepEqual(job.requiredSkills,[]);assert.equal(job.city,null)
    assert.equal(job.applyUrl,proxy.applicationUrl);assert.equal(job.sourceUrl,proxy.url)
    assert.equal(job.sourceScopeComplete,false);assert.equal(job.inventoryCleanupAllowed,false)
  }
})
for(const [label,mutate] of [
 ['duplicate shortcode',x=>x.jobs.push(copy(x.jobs[0]))],
 ['duplicate opaque proxy ID',x=>{x.jobs[1].id=x.jobs[0].id}],
 ['country contradiction',x=>{x.jobs[4].countryCode='US'}],
 ['unknown country alias',x=>{x.jobs[4].addressCountry='US'}],
 ['foreign role authority',x=>{x.jobs[4].url='https://foreign.invalid/jobs/6176838'}],
 ['role authority foreign port',x=>{x.jobs[4].url='https://leena-ai.workable.com:444/jobs/6176838'}],
 ['application route mismatch',x=>{x.jobs[4].applicationUrl='https://leena-ai.workable.com/jobs/1/candidates/new'}],
 ['unreviewed semantic nested carrier',x=>{x.jobs[4].worksites={country:'US'}}],
 ['unbounded feed',x=>{x.jobs=Array.from({length:41},()=>copy(x.jobs[0]))}],
 ['invalid discovery calendar',x=>{x.jobs[4].createdAt='2026-02-30T00:00:00Z'}],
])test('discovery rejects '+label,()=>{const x=copy(fixture.feed);mutate(x);assert.throws(()=>native.decodeDiscoveryFeed(x),/Leena AI native/)})
for(const [label,mutate] of [
 ['foreign account name',x=>{x.name='Foreign Employer'}],['tenant',x=>{x.subdomain='other'}],
 ['UID',x=>{x.uid='00000000-0000-0000-0000-000000000000'}],
 ['nonreciprocal website',x=>{x.url='https://foreign.invalid/'}],
 ['unknown authority',x=>{x.employer={name:'Foreign'}}],
])test('own account rejects '+label,()=>{const x=copy(fixture.account);mutate(x);assert.throws(()=>native.decodeNativeAccount(x),/Leena AI native/)})
for(const [label,mutate] of [
 ['native account mismatch',x=>{x.accountUid='00000000-0000-0000-0000-000000000000'}],
 ['native integer route mismatch',x=>{x.id++}],
 ['native shortcode mismatch',x=>{x.shortcode='AAAAAAAAAA'}],
 ['native title mismatch',x=>{x.title='Foreign title'}],
 ['internal role',x=>{x.isInternal=true}],['closed role',x=>{x.state='closed'}],
 ['unapproved role',x=>{x.approvalStatus='pending'}],
 ['hidden worksite',x=>{x.locations[0].hidden=true}],
 ['country contradiction',x=>{x.locations[0].countryCode='US'}],
 ['nested foreign country carrier',x=>{x.location.address={addressCountry:'US'}}],
 ['unknown nonempty country alias',x=>{x.locations[0].countryId='US'}],
 ['future publication',x=>{x.published='2099-01-01T00:00:00.000Z'}],
 ['impossible publication',x=>{x.published='2026-02-30T00:00:00.000Z'}],
 ['missing publication',x=>{x.published=null}],
 ['untyped requirements',x=>{x.requirements=null}],
 ['unknown authored criteria',x=>{x.mandatoryRequirements=['extra']}],
 ['program criteria',x=>{x.requirements+='<script>location.href="https://foreign.invalid"</script>'}],
 ['hidden criteria',x=>{x.requirements+='<div hidden>Additional mandatory criterion</div>'}],
 ['semantic country in criteria',x=>{x.requirements+='<meta name="country" content="US">'}],
 ['foreign typed secondary worksite',x=>{x.locations.push({city:'X',region:'X',country:'United States',countryCode:'US',hidden:false})}],
])test('full detail refuses '+label,()=>{const x=copy(fixture.details[0]);mutate(x);assert.throws(()=>native.decodeNativeRole(x,row,fixture.account,at),/Leena AI native/)})
for(const [label,raw] of [
 ['duplicate country','{"country":"US","country":"India"}'],
 ['escaped duplicate','{"country":"US","countr\\u0079":"India"}'],
 ['nested duplicate','{"x":{"state":"closed","state":"published"}}'],
 ['trailing input','{} false'],['malformed grammar','{"x":01}'],
])test('strict JSON refuses '+label,()=>assert.throws(()=>native.parseNativeJSON(raw),/Leena AI native/))
test('strict JSON preserves sibling keys, Unicode and JSON-looking string data',()=>{
 const raw='{"a":{"x":1},"b":{"x":2},"text":"{\\"x\\":1,\\"x\\":2}","unicode":"\\u0041"}'
 assert.deepEqual(native.parseNativeJSON(raw),JSON.parse(raw))
})
test('caller cancellation before scheduled read retains exact opaque reason and performs zero calls',async()=>{
 const controller=new AbortController(),reason=Object.freeze({opaque:'caller'});let calls=0
 const pending=native.runCurrentOrLegacy({signal:controller.signal,fetchImpl:async()=>{calls++;throw Error('unexpected')},legacy:()=>[]})
 controller.abort(reason)
 await assert.rejects(pending,error=>error===reason);assert.equal(calls,0)
})

const response=(body,status=200,url='https://leena.ai/careers',mime='text/html')=>{
 const value=new Response(body,{status,headers:{'content-type':mime}})
 Object.defineProperty(value,'url',{value:url});return value
}
for(const status of [401,403,406,429,451])test('verified own HTTP '+status+' stays primary when its body stream fails',async()=>{
 const cause=Object.freeze(new Error('controlled original body failure'))
 const body=new ReadableStream({start(controller){controller.error(cause)}})
 await assert.rejects(native.runCurrentOrLegacy({fetchImpl:async()=>response(body,status)}),error=>error.status===status&&error.cause===cause&&error.requestURL==='https://leena.ai/careers')
})
test('HTTP200 preserves original body stream error rather than inventing availability status',async()=>{
 const cause=Object.freeze(new Error('controlled body failure'))
 const body=new ReadableStream({start(controller){controller.error(cause)}})
 await assert.rejects(native.runCurrentOrLegacy({fetchImpl:async()=>response(body)}),error=>error===cause)
})
test('foreign response authority never becomes own HTTP denial',async()=>{
 await assert.rejects(native.runCurrentOrLegacy({fetchImpl:async()=>response('denied',403,'https://foreign.invalid/')}),error=>error.status==null&&/response authority/.test(error.message))
})
for(const reason of [null,Symbol('caller'),7,'caller',Object.freeze({caller:true})])test('exact opaque caller reason wins before fetch: '+typeof reason,async()=>{
 const controller=new AbortController();controller.abort(reason);let calls=0
 await assert.rejects(native.runCurrentOrLegacy({signal:controller.signal,fetchImpl:()=>{calls++;throw Error('unexpected')}}),error=>error===reason)
 assert.equal(calls,0)
})
test('late headers are disposed after exact caller cancellation without continued body reads',async()=>{
 const controller=new AbortController(),reason=Object.freeze({caller:true});let resolve,cancelled=0,reads=0
 const pending=native.runCurrentOrLegacy({signal:controller.signal,fetchImpl:()=>new Promise(r=>{resolve=r})})
 while(!resolve)await Promise.resolve()
 controller.abort(reason);await assert.rejects(pending,error=>error===reason)
 resolve({status:200,url:'https://leena.ai/careers',headers:new Headers({'content-type':'text/html'}),body:{cancel(){cancelled++},getReader(){reads++;throw Error('unexpected')}}})
 await new Promise(r=>setImmediate(r));assert.equal(cancelled,1);assert.equal(reads,0)
})
test('synchronous cleanup failure cannot replace known HTTP stream failure',async()=>{
 const cause=new Error('original stream failure')
 const result={status:406,url:'https://leena.ai/careers',headers:new Headers({'content-type':'text/html'}),body:{getReader(){return {read(){return Promise.reject(cause)},cancel(){throw Error('cleanup failure')},releaseLock(){throw Error('release failure')}}}}}
 await assert.rejects(native.runCurrentOrLegacy({fetchImpl:async()=>result}),error=>error.status===406&&error.cause===cause)
})
test('response body bound refuses excessive native bytes',async()=>{
 await assert.rejects(native.runCurrentOrLegacy({fetchImpl:async()=>response('x'.repeat(3*1024*1024+1))}),/body bound/)
})
for(const raw of ['{"x":1,}','[1,]','{"x":"\\q"}','{"x":true false}','{"x":.2}','{"x":NaN}','{"x":Infinity}'])test('strict JSON malformed control '+raw,()=>assert.throws(()=>native.parseNativeJSON(raw),/Leena AI native/))
test('strict JSON nesting bound refuses adversarial deep input',()=>assert.throws(()=>native.parseNativeJSON('['.repeat(65)+'0'+']'.repeat(65)),/nesting/))

for(const [raw,expected] of [['&amp;lt;','&lt;'],['&#38;lt;','&lt;'],['&lt;literal&gt;','<literal>']])test('authored criteria entities are decoded exactly once: '+raw,()=>{
 const detail=copy(fixture.details[0]);detail.description+='<p>Verbatim entity control '+raw+'</p>'
 const job=native.decodeNativeRole(detail,row,fixture.account,at)
 assert.equal(job.sourceNativeCriteria.description,detail.description)
 assert(job.jobDescription.includes('Verbatim entity control '+expected))
})

// These are the retained original UTF-8 criterion-string digests, not hashes
// generated by decoding the derived fixture with a platform locale.
for(const [index,key,expected]of [
 [0,'description','133529da9686b3a06889550e4bde8a0961004badbb324259a7f7ed8c3937db48'],
 [0,'requirements','54f661eb40dbb96da12363ca760f990c7c1ae543f58d337cc2a10d4caf6e3c1c'],
 [0,'benefits','23b98e6ede63f76228e5ca6a3121b9999b8046c03c598fa6fc55b772d3edfc9f'],
 [1,'description','5dabc9cb05b72e4406d5327c09d7bc8ee94d0c91c28565571631e3a868d0427e'],
 [1,'requirements','ee13f4b122b33a45eef13c0255e2afbaa186e653d34786e35c7cd466c5569e33'],
 [1,'benefits','97bc853e778aa543ff3dba614462589134488bd9bd25123591c22d8504cab972'],
])test('derived genuine UTF-8 role '+(index+1)+' '+key+' preserves the entire original criterion',async()=>{
 const {createHash}=await import('node:crypto')
 assert.equal(createHash('sha256').update(fixture.details[index][key],'utf8').digest('hex'),expected)
})
test('genuine role1 authored Unicode bullet is retained without Windows code-page corruption',()=>{
 assert(fixture.details[0].description.includes('\u2022'.replace('\\u2022','\u2022')))
 assert.equal(fixture.details[0].description.includes('\u00e2\u20ac\u00a2'),false)
})
test('default transport refuses unknown career bundle before any legacy or outside-native read',async()=>{
 const {createLeenaAiScraper}=await import('./script.js')
 const historical=readFileSync(new URL('../../scraper-support/tests/leenaAiScript.test.js',import.meta.url),'utf8')
 const legacyBundle=historical.match(/const careersBundleJs = `([\s\S]*?)`/)[1]
 const legacyShell=historical.match(/const pyjamaHrDetailHtmlWithoutStructuredJobData = `([\s\S]*?)`/)[1]
 const html='<title>Careers at Leena AI | Join Our Team in Agentic AI Innovation</title><link rel="canonical" href="https://leena.ai/careers"><p>Join our team where people power AI. See open roles. Explore jobs. Open roles.</p><script src="https://leena.ai/_next/static/chunks/pages/careers-0000000000000000.js"></script>'
 const original=globalThis.fetch;let legacyReads=0;const nativeReads=[]
 try{
  globalThis.fetch=async url=>{legacyReads++;return response(legacyShell,200,String(url))}
  await assert.rejects(createLeenaAiScraper({now:()=>at}).run({fetchImpl:async url=>{
   nativeReads.push(url)
   return response(url==='https://leena.ai/careers'?html:legacyBundle,200,url)
  }}),/Leena AI native .*?(?:unreviewed|profile|declaration)/)
  assert.equal(legacyReads,0);assert.deepEqual(nativeReads,['https://leena.ai/careers'])
 }finally{globalThis.fetch=original}
})


// Publisher cache-observation time is independent of this controlled local
// acquisition clock. It is not a vacancy publication/creation authority.
for(const fetchedAt of ['2099-01-01T00:00:00.000Z','2028-02-29T12:00:00Z'])test('valid future cache observation preserves raw time without changing feed business: '+fetchedAt,()=>{
 const payload=copy(fixture.feed);payload.fetchedAt=fetchedAt
 const before=copy(payload),controlledNow=Date.parse(at)
 const result=native.decodeDiscoveryFeed(payload,controlledNow)
 assert.deepEqual(payload,before);assert.deepEqual(result.rows,payload.jobs)
 assert.equal(result.india.length,6)
})
for(const fetchedAt of [null,1794086817134,'','2026-02-30T00:00:00.000Z','2025-02-29T00:00:00Z','2026-11-07T21:26:57+00:00','2026-11-07T21:26:57.134','2026-11-07T21:26:60.000Z'])test('cache observation still refuses invalid typed ISO/calendar: '+String(fetchedAt),()=>{
 const payload=copy(fixture.feed);payload.fetchedAt=fetchedAt
 assert.throws(()=>native.decodeDiscoveryFeed(payload,Date.parse(at)),/feed fetchedAt/)
})
test('future cache observation does not admit a future native discovery creation date',()=>{
 const payload=copy(fixture.feed);payload.fetchedAt='2099-01-01T00:00:00.000Z';payload.jobs[0].createdAt='2099-01-01T00:00:00.000Z'
 assert.throws(()=>native.decodeDiscoveryFeed(payload,Date.parse(at)),/discovery creation metadata/)
})
test('future cache observation does not alter native publication-date rejection',()=>{
 const detail=copy(fixture.details[0]);detail.published='2099-01-01T00:00:00.000Z'
 assert.throws(()=>native.decodeNativeRole(detail,row,fixture.account,at),/publication/)
})


for(const [label,mutate] of [
 ['absent own type',x=>{delete x.type}],
 ['exact empty optional requirements',x=>{x.requirements=''}],
 ['exact empty optional benefits',x=>{x.benefits=''}],
 ['all observed optional omissions',x=>{delete x.type;x.requirements='';x.benefits=''}],
])test('genuine optional role carrier policy accepts '+label+' without inventing facts',()=>{
 const detail=copy(fixture.details[0]);mutate(detail);const before=copy(detail)
 const result=native.decodeNativeRole(detail,row,fixture.account,at)
 assert.deepEqual(detail,before);assert.deepEqual(result.sourceNativeModel,before)
 assert.equal(Object.hasOwn(result.sourceNativeModel,'type'),Object.hasOwn(detail,'type'))
 assert.equal(result.employmentType,null);assert.equal(result.minimumQualification,null);assert.deepEqual(result.requiredSkills,[])
 assert.deepEqual(result.sourceNativeCriteria,{description:detail.description,requirements:detail.requirements,benefits:detail.benefits})
 if(detail.requirements==='')assert.equal(result.jobDescription.includes('\n\nRequirements\n'),false)
 if(detail.benefits==='')assert.equal(result.jobDescription.includes('\n\nBenefits\n'),false)
 assert.equal(result.postingDate,detail.published);assert.equal(result.country,'India')
})
for(const [label,mutate] of [
 ['own null type',x=>{x.type=null}],['own undefined type',x=>{x.type=undefined}],
 ['unknown own role field',x=>{x.jobType='contract'}],
 ['missing required description',x=>{delete x.description}],['missing optional requirements key',x=>{delete x.requirements}],['missing optional benefits key',x=>{delete x.benefits}],
 ['null optional requirements',x=>{x.requirements=null}],['null optional benefits',x=>{x.benefits=null}],
 ['whitespace optional requirements',x=>{x.requirements=' '}],['whitespace optional benefits',x=>{x.benefits=' '}],
 ['empty mandatory description',x=>{x.description=''}],
 ['country contradiction with absent type',x=>{delete x.type;x.location.countryCode='US'}],
 ['future publication with empty optional sections',x=>{x.requirements='';x.benefits='';x.published='2099-01-01T00:00:00.000Z'}],
 ['program optional requirements',x=>{x.requirements='<script>console.log("control")</script>'}],
])test('optional carrier policy still refuses '+label,()=>{
 const detail=copy(fixture.details[0]);mutate(detail)
 assert.throws(()=>native.decodeNativeRole(detail,row,fixture.account,at),/Leena AI native/)
})
test('absent own type does not authorize an inherited type carrier',()=>{
 const detail=copy(fixture.details[0]);delete detail.type;Object.setPrototypeOf(detail,{type:'contract'})
 assert.throws(()=>native.decodeNativeRole(detail,row,fixture.account,at),/Leena AI native/)
})


test('attribute-free native underline preserves whole raw criteria and once-decoded literal text',()=>{
 const detail=copy(fixture.details[0]);detail.requirements+='<p><u>Underlined literal &amp; text</u></p>'
 const result=native.decodeNativeRole(detail,row,fixture.account,at)
 assert.equal(result.sourceNativeCriteria.requirements,detail.requirements)
 assert.deepEqual(result.sourceNativeModel,detail)
 assert(result.jobDescription.includes('Underlined literal & text'))
})
test('underline admission never authorizes hidden, country, event or other attribute carriers',()=>{
 for(const attrs of [' hidden',' data-country="US"',' onclick="void(0)"',' aria-hidden="true"']){
  const detail=copy(fixture.details[0]);detail.requirements+='<p><u'+attrs+'>Unreviewed extra criterion text</u></p>'
  assert.throws(()=>native.decodeNativeRole(detail,row,fixture.account,at),/unreviewed authored carrier/)
 }
})
