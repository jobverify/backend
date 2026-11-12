import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import * as api from '../scraper-support/utils/leverRequestMetadataCertificate.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/lever-request-metadata-loadsmart-actual32-20261111.json.gz',import.meta.url))))
const row=fixture.responses[0],html=Buffer.from(row.bodyBase64,'base64').toString('utf8'),profile='loadsmart-server-publication-v1'
const sha=value=>createHash('sha256').update(value).digest('hex')
const metadata=()=>({profile,requestedURL:row.requestedURL,finalURL:row.finalURL,headers:structuredClone(row.headers),headerEntries:structuredClone(row.headerEntries)})
const sourceOffset=html.lastIndexOf('<script>')+8,source=html.slice(sourceOffset,sourceOffset+1097)
assert(source.includes('__CF$cv$params'))
const sourceChanged=changed=>{assert.notEqual(changed,source,'Source control must change actual original source');return html.slice(0,sourceOffset)+changed+html.slice(sourceOffset+source.length)}
const setTime=(text,digits)=>text.slice(0,sourceOffset+192)+Buffer.from(digits,'latin1').toString('base64')+text.slice(sourceOffset+208)
const setHeader=(m,name,value)=>{m.headers[name]=value;m.headerEntries=m.headerEntries.map(([key,old])=>[key,key.toLowerCase()===name?value:old]);return m}
const isHold=error=>{assert.equal(error.failureKind,'coverage_gap');assert.equal(error.abortRetries,true);return true}

test('the unmodified actual32 board receives an explicit comparison-only certificate without a Date relation',()=>{
 assert.equal(fixture.acquiredClosings,false)
 assert.equal(fixture.completeSourceTransaction,false)
 assert.equal(sha(html),row.bodySHA256)
 const certificate=api.certifyLeverRequestMetadata(html,metadata())
 assert.equal(certificate.comparisonProfile,profile)
 assert.equal(certificate.comparisonFingerprint,'4cc46af134b86fa5014662c0d44cd1ec84d0b7350b97b3f23b03c40f45abbcba')
 assert.equal(certificate.originalEntitySHA256,row.bodySHA256)
 assert.equal(certificate.tDateBound,false)
 assert.equal(certificate.sourceTimeSemanticsQualified,false)
 assert.equal(certificate.timeLiteral.rawBase64,'MTc5NDQyMTEyNA==')
 assert.equal(certificate.timeLiteral.decodedDigits,'1794421124')
 assert.equal(certificate.timeLiteral.originalDate,'Wed, 11 Nov 2026 18:18:45 GMT')
 assert.equal(certificate.timeLiteral.originalDateUnixSeconds,'1794421125')
 assert.equal(certificate.timeLiteral.signedDifferenceSeconds,-1)
 assert.equal(certificate.timeLiteral.tDateBound,false)
 assert.equal(certificate.timeLiteral.sourceTimeSemanticsQualified,false)
 assert.deepEqual(certificate.requestBinding,{requestedURL:row.requestedURL,finalURL:row.finalURL})
 assert.deepEqual(certificate.headerBinding,{cfRay:row.headers['cf-ray'],date:row.headers.date,rayPrefix:'a58f4d1e1d56a430',dateUnixSeconds:'1794421125'})
 assert.equal(certificate.comparisonOnly,true)
 assert.equal(certificate.rawRetentionRequired,true)
 assert.equal('canonicalEntity'in certificate,false)
 assert.equal('html'in certificate,false)
 assert.deepEqual(JSON.parse(JSON.stringify(certificate)),certificate)
 assert.match(certificate.limits[0],/two.*ray.*opaque/i)
 assert.equal(sha(html),row.bodySHA256)
})

test('the same actual32 packet still fails the unchanged strict default',()=>{
 const strict=metadata();delete strict.profile
 assert.throws(()=>api.certifyLeverRequestMetadata(html,strict),/Exact source time must bind to original Date second/)
})

test('the exported profile constant is exact and default outputs retain their complete historical JSON',()=>{
 assert.equal(api.LOADSMART_SERVER_PUBLICATION_PROFILE,profile)
 for(const[name,index,expected]of[
  ['immuta',3,'4a752edcb41435cd05c9708939f6ebb4c2bdd3eeab693cad6e37f8d1d9cced68'],
  ['loadsmart',1,'6102aef5ea261ebf8610ed8fa466e090897a222bb3345f33301f2457ec411957']
 ]){
  const f=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/'+name+'-current-programme-20261111.json.gz',import.meta.url)))),r=f.responses[index]
  const result=api.certifyLeverRequestMetadata(Buffer.from(r.bodyBase64,'base64').toString('utf8'),{headers:r.headers,headerEntries:r.headerEntries})
  assert.equal(sha(JSON.stringify(result)),expected)
 }
})

for(const digits of['1000000000','1794421125','9999999999'])test('canonical opaque digits have no Date range rule: '+digits,()=>{
 const changed=setTime(html,digits),certificate=api.certifyLeverRequestMetadata(changed,metadata())
 assert.notEqual(changed,html)
 assert.equal(certificate.comparisonFingerprint,'4cc46af134b86fa5014662c0d44cd1ec84d0b7350b97b3f23b03c40f45abbcba')
 assert.equal(certificate.timeLiteral.decodedDigits,digits)
 assert.equal(certificate.timeLiteral.signedDifferenceSeconds,Number(digits)-1794421125)
 assert.equal(certificate.tDateBound,false)
 assert.equal(certificate.sourceTimeSemanticsQualified,false)
})

for(const date of['Sun, 09 Sep 2001 01:46:40 GMT','Sat, 20 Nov 2286 17:46:39 GMT'])test('canonical Date is retained independently: '+date,()=>{
 const m=setHeader(metadata(),'date',date),certificate=api.certifyLeverRequestMetadata(html,m)
 assert.notEqual(m.headers.date,row.headers.date)
 assert.equal(certificate.timeLiteral.originalDate,date)
 assert.equal(certificate.timeLiteral.signedDifferenceSeconds,1794421124-Date.parse(date)/1000)
 assert.equal(certificate.tDateBound,false)
})

for(const digits of['0000000000','0794421124','179442112','17944211245','-794421124','+794421124','179442112 ','17944211.4','17944211e4','17944211\n4','17944211\xb24'])test('opaque literal rejects unsupported decoded form '+JSON.stringify(digits),()=>{
 const changed=setTime(html,digits);assert.notEqual(changed,html)
 assert.throws(()=>api.certifyLeverRequestMetadata(changed,metadata()),isHold)
})

for(const literal of['MTc5NDQyMTEyNB==','MTc5NDQyMTEyNA__','!!!!!!!!!!!!!!!!','MTc5NDQyMTEyNA= ','MTc5NDQyMTEyNA=\n'])test('noncanonical base64 literal holds '+JSON.stringify(literal),()=>{
 const changed=sourceChanged(source.slice(0,192)+literal+source.slice(208))
 assert.throws(()=>api.certifyLeverRequestMetadata(changed,metadata()),isHold)
})

for(const value of[undefined,null,false,'','loadsmart-server-publication-v2','immuta-server-publication-v1'])test('unknown own profile holds '+String(value),()=>{
 const m=metadata();m.profile=value
 assert.throws(()=>api.certifyLeverRequestMetadata(html,m),isHold)
})

for(const key of['requestedURL','finalURL'])for(const value of[undefined,null,'https://jobs.lever.co/immuta/','https://jobs.lever.co/loadsmart','https://jobs.lever.co/loadsmart/?mode=json','https://JOBS.lever.co/loadsmart/','https://jobs.lever.co:443/loadsmart/','http://jobs.lever.co/loadsmart/'])test(key+' rejects unsupported original URL '+String(value),()=>{
 const m=metadata();if(value===undefined)delete m[key];else m[key]=value
 assert.throws(()=>api.certifyLeverRequestMetadata(html,m),isHold)
})

for(const key of['profile','requestedURL','finalURL'])test(key+' accessors hold without execution',()=>{
 let calls=0;const m=metadata();Object.defineProperty(m,key,{get(){calls++;throw Error('Getter must not run')}})
 assert.throws(()=>api.certifyLeverRequestMetadata(html,m),isHold)
 assert.equal(calls,0)
})

for(const key of['profile','requestedURL','finalURL'])test(key+' coercion hooks hold without execution',()=>{
 let calls=0;const m=metadata();m[key]={toString(){calls++;throw Error('Conversion must not run')},valueOf(){calls++;throw Error('Conversion must not run')}}
 assert.throws(()=>api.certifyLeverRequestMetadata(html,m),isHold)
 assert.equal(calls,0)
})

test('proxy metadata and proxy field values hold without traps',()=>{
 let calls=0;const traps={get(){calls++;throw Error('Proxy trap')},getOwnPropertyDescriptor(){calls++;throw Error('Proxy trap')},getPrototypeOf(){calls++;throw Error('Proxy trap')},ownKeys(){calls++;throw Error('Proxy trap')}}
 assert.throws(()=>api.certifyLeverRequestMetadata(html,new Proxy(metadata(),traps)),isHold)
 for(const key of['profile','requestedURL','finalURL']){const m=metadata();m[key]=new Proxy({},traps);assert.throws(()=>api.certifyLeverRequestMetadata(html,m),isHold)}
 assert.equal(calls,0)
})

test('inherited profile cannot opt in and inherited URL provenance cannot qualify',()=>{
 const m=metadata();delete m.profile;Object.setPrototypeOf(m,{profile})
 assert.throws(()=>api.certifyLeverRequestMetadata(html,m),isHold)
 const missing=metadata();delete missing.requestedURL
 assert.throws(()=>api.certifyLeverRequestMetadata(html,missing),isHold)
})

for(const[name,patch]of[
 ['first ray',s=>s.slice(0,171)+'0000000000000001'+s.slice(187)],
 ['second ray',s=>s.slice(0,401)+'0000000000000001'+s.slice(417)],
 ['executable byte',s=>s.replace('a.height=1;a.width=1;','a.height=2;a.width=1;')],
 ['literal context',s=>s.replace('params={r:','params={s:')],
 ['child route',s=>s.replace('jsd/main.js?ray=','jse/main.js?ray=')],
 ['tail',s=>s+';globalThis.newCriteria=true;']
])test('the opt-in preserves exact reviewed source guards: '+name,()=>{
 assert.throws(()=>api.certifyLeverRequestMetadata(sourceChanged(patch(source)),metadata()),isHold)
})

for(const wrapper of['template','noscript','svg','math','object','iframe'])test('opt-in carrier remains held inside '+wrapper,()=>{
 const changed=html.replace('<script>'+source+'</script>','<'+wrapper+'><script>'+source+'</script></'+wrapper+'>');assert.notEqual(changed,html)
 assert.throws(()=>api.certifyLeverRequestMetadata(changed,metadata()),isHold)
})

for(const attrs of[' src=""',' src="https://other.example/script.js"',' type="module"',' nonce="new"'])test('opt-in carrier attributes remain held '+attrs,()=>{
 const changed=html.replace('<script>'+source,'<script'+attrs+'>'+source);assert.notEqual(changed,html)
 assert.throws(()=>api.certifyLeverRequestMetadata(changed,metadata()),isHold)
})

for(const[name,patch]of[
 ['duplicate carrier',s=>s.replace('<script>'+source+'</script>','<script>'+source+'</script><script>'+source+'</script>')],
 ['comment carrier',s=>s.replace('<script>'+source+'</script>','<!--<script>'+source+'</script>-->')],
 ['inert body',s=>s.replace('<body','<body inert')],
 ['post-carrier body element',s=>s.replace('</script></body>','</script><p>New country India</p></body>')]
])test('opt-in context remains held: '+name,()=>{
 const changed=patch(html);assert.notEqual(changed,html)
 assert.throws(()=>api.certifyLeverRequestMetadata(changed,metadata()),isHold)
})

for(const[name,patch]of[
 ['title',s=>s.replace('<title>Loadsmart','<title>Other employer')],
 ['new criteria',s=>s.replace('</head>','<meta name="work-country" content="India"></head>')],
 ['outside whitespace',s=>s.replace('</head>','\n</head>')]
])test('every other original entity byte remains in the fingerprint: '+name,()=>{
 const changed=patch(html);assert.notEqual(changed,html)
 const result=api.certifyLeverRequestMetadata(changed,metadata())
 assert.notEqual(result.comparisonFingerprint,'4cc46af134b86fa5014662c0d44cd1ec84d0b7350b97b3f23b03c40f45abbcba')
 assert.equal(result.originalEntitySHA256,sha(changed))
 assert.equal('html'in result,false)
})

for(const[name,patch]of[
 ['inconsistent Date',m=>{m.headers.date='Wed, 11 Nov 2026 18:18:44 GMT';return m}],
 ['duplicate ray',m=>{m.headerEntries.push(['cf-ray',m.headers['cf-ray']]);return m}],
 ['missing original entries',m=>{delete m.headerEntries;return m}],
 ['malformed Date',m=>setHeader(m,'date','2026-11-11T18:18:45Z')],
 ['unbound rays',m=>setHeader(m,'cf-ray','0000000000000001-LHR')]
])test('original coherent headers still gate opaque comparison: '+name,()=>{
 const m=patch(metadata());assert.notDeepEqual(m,metadata())
 assert.throws(()=>api.certifyLeverRequestMetadata(html,m),isHold)
})

test('a default strict call ignores unrelated URL getters and retains the original behavior',()=>{
 const changed=setTime(html,'1794421125'),m=metadata();delete m.profile;let calls=0
 for(const key of['requestedURL','finalURL'])Object.defineProperty(m,key,{get(){calls++;throw Error('Unrelated strict metadata getter')}})
 const result=api.certifyLeverRequestMetadata(changed,m)
 assert.equal('comparisonProfile'in result,false)
 assert.equal(calls,0)
})
