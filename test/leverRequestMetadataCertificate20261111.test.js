import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {certifyLeverRequestMetadata} from '../scraper-support/utils/leverRequestMetadataCertificate.js'
import {readImmutaIntake} from '../scraper/immuta/currentProgrammeData.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/immuta-current-programme-20261111.json.gz',import.meta.url)))),row=fixture.responses[3],html=Buffer.from(row.bodyBase64,'base64').toString('utf8'),sha=x=>createHash('sha256').update(x).digest('hex')
const metadata=()=>({headers:structuredClone(row.headers),headerEntries:structuredClone(row.headerEntries)}),reference=certifyLeverRequestMetadata(html,metadata()),source=html.slice(reference.sourceOffset,reference.sourceOffset+1097),ray=reference.headerBinding.rayPrefix,time=reference.headerBinding.base64Time
const changedBinding=()=>{const nextRay='0000000000000001',seconds=String(Number(reference.headerBinding.unixSeconds)+1),date=new Date(Number(seconds)*1000).toUTCString(),nextTime=Buffer.from(seconds).toString('base64'),m=metadata();m.headers['cf-ray']=nextRay+'-LHR';m.headers.date=date;m.headerEntries=m.headerEntries.map(([k,v])=>[k,['cf-ray','date'].includes(k)?m.headers[k]:v]);return{html:html.replaceAll(ray,nextRay).replace(time,nextTime),metadata:m}}
const held=(name,change,pattern)=>test(name,()=>{const base={html,metadata:metadata()},next=change(base);assert(next.html!==html||JSON.stringify(next.metadata)!==JSON.stringify(metadata()),'Negative control must change a genuine entity/header view');assert.throws(()=>certifyLeverRequestMetadata(next.html,next.metadata),pattern)})

test('actual native entity yields a pure three-slot header-bound certificate with every raw source fact retained',()=>{assert.equal(reference.profileSHA256,'9ae8d69ef658b78f79d4b11ba855d2cf3f4676e22ed85a55dbe867237bddd306');assert.equal(reference.comparisonFingerprint,'2a2ac2c9a60ac5ce727c119d8fe5c48ad143f60b398939e90400e63a01002ca2');assert.equal(reference.originalEntitySHA256,row.bodySHA256);assert.equal(reference.originalEntityBytes,row.bodyBytes);assert.equal(reference.sourceBytes,1097);assert.deepEqual(reference.literalSlots.map(s=>[s.name,s.offset,s.length]),[['params.r',171,16],['params.t',192,16],['jsd query ray',401,16]]);assert.equal(reference.headerBinding.cfRay,row.headers['cf-ray']);assert.equal(reference.headerBinding.date,row.headers.date);assert.equal(reference.comparisonOnly,true);assert.equal(reference.rawRetentionRequired,true);assert.equal('canonicalEntity'in reference,false);assert.equal('html'in reference,false);assert.deepEqual(JSON.parse(JSON.stringify(reference)),reference);assert.equal(sha(Buffer.from(html)),row.bodySHA256)})

test('only three independently header-bound response literals vary without changing the native intake declaration',()=>{const next=changedBinding(),certificate=certifyLeverRequestMetadata(next.html,next.metadata);assert.notEqual(next.html,html);assert.equal(certificate.comparisonFingerprint,reference.comparisonFingerprint);assert.notEqual(certificate.originalEntitySHA256,reference.originalEntitySHA256);assert.notEqual(certificate.sourceSHA256,reference.sourceSHA256);assert.equal(readImmutaIntake(next.html,next.metadata).classification,'explicit-native-general-interest-non-position');assert.equal(sha(Buffer.from(html)),row.bodySHA256)})

for(const[name,patch,pattern]of[
 ['only first source ray changes',s=>s.replace(ray,'0000000000000001'),/ray|bind/i],
 ['both rays change without matching original header',s=>s.replaceAll(ray,'0000000000000001'),/ray|bind/i],
 ['time changes without matching original Date',s=>s.replace(time,Buffer.from('1794415318').toString('base64')),/Date|time|bind/i],
 ['source property name changes',s=>s.replace('params={r:','params={s:'),/template|source|context/i],
 ['same-length executable semantic change',s=>s.replace('a.height=1;a.width=1;','a.height=2;a.width=1;'),/template|source/i],
 ['one source whitespace changes',s=>s.replace('function c(){','function c( ){'),/length|ray|time|template|source/i],
 ['new executable source tail',s=>s+';globalThis.newCriteria=true;',/length|source/i],
 ['child script route changes',s=>s.replace('jsd/main.js?ray=','jse/main.js?ray='),/source|template/i],
 ['source code removed',s=>s.slice(0,-1),/length|source/i]
])held(name,base=>({...base,html:html.replace(source,patch(source))}),pattern)

for(const[name,change,pattern]of[
 ['missing cf-ray header',m=>{delete m.headers['cf-ray'];return m},/header|view|ray/i],
 ['missing Date header',m=>{delete m.headers.date;return m},/header|view|Date/i],
 ['folded ambiguous cf-ray',m=>{m.headers['cf-ray']+=', '+m.headers['cf-ray'];m.headerEntries=m.headerEntries.map(([k,v])=>[k,k==='cf-ray'?m.headers[k]:v]);return m},/ray|canonical/i],
 ['noncanonical ray case',m=>{m.headers['cf-ray']=m.headers['cf-ray'].toUpperCase();m.headerEntries=m.headerEntries.map(([k,v])=>[k,k==='cf-ray'?m.headers[k]:v]);return m},/ray|canonical/i],
 ['missing POP suffix',m=>{m.headers['cf-ray']=ray;m.headerEntries=m.headerEntries.map(([k,v])=>[k,k==='cf-ray'?m.headers[k]:v]);return m},/ray|canonical/i],
 ['inconsistent Date views',m=>{m.headers.date='Wed, 11 Nov 2026 16:41:58 GMT';return m},/views|header/i],
 ['malformed Date weekday',m=>{m.headers.date='Thu, 11 Nov 2026 16:41:57 GMT';m.headerEntries=m.headerEntries.map(([k,v])=>[k,k==='date'?m.headers[k]:v]);return m},/Date|canonical/i],
 ['noncanonical Date rendering',m=>{m.headers.date='2026-11-11T16:41:57Z';m.headerEntries=m.headerEntries.map(([k,v])=>[k,k==='date'?m.headers[k]:v]);return m},/Date|canonical/i],
 ['duplicate ray entry',m=>{m.headerEntries.push(['cf-ray',m.headers['cf-ray']]);return m},/duplicate|entry/i],
 ['duplicate Date entry',m=>{m.headerEntries.push(['Date',m.headers.date]);return m},/duplicate|entry/i],
 ['case-duplicate ray object key',m=>{m.headers['CF-Ray']=m.headers['cf-ray'];return m},/duplicate|field/i],
 ['missing entry view',m=>{delete m.headerEntries;return m},/metadata|entries|data/i]
])held(name,base=>({...base,metadata:change(base.metadata)}),pattern)

for(const attrs of[' src=""',' src="https://other.example/script.js"',' type="module"',' type="application/json"',' nomodule',' nonce="new"'])held('unreviewed carrier attributes '+attrs,base=>({...base,html:html.replace('<script>'+source,'<script'+attrs+'>'+source)}),/carrier|attribute|boundary/i)
for(const tag of['template','noscript','object','svg','math','iframe'])held('carrier under '+tag,base=>({...base,html:html.replace('<script>'+source+'</script>','<'+tag+'><script>'+source+'</script></'+tag+'>')}),/carrier|context|body|HTML/i)
held('commented carrier',base=>({...base,html:html.replace('<script>'+source+'</script>','<!--<script>'+source+'</script>-->')}),/carrier|ambiguous/i)
held('duplicate raw carrier',base=>({...base,html:html.replace('<script>'+source+'</script>','<script>'+source+'</script><script>'+source+'</script>')}),/carrier|ambiguous/i)
held('inert body ancestor',base=>({...base,html:html.replace('<body','<body inert')}),/active|body|context/i)
held('extra body node after terminal carrier',base=>({...base,html:html.replace('</script></body>','</script><p>New work country India</p></body>')}),/final|body|context/i)
held('spaced raw carrier boundary',base=>({...base,html:html.replace('<script>'+source,'<script >'+source)}),/boundary|carrier/i)

for(const[name,patch]of[
 ['authored role title',s=>s.replace('Join our Talent Community!','Join our Talent Community?')],
 ['authored native country',s=>s.replace(/"addressCountry"\s*:\s*null/,'"addressCountry":"IN"')],
 ['authored body condition',s=>s.replace('</head>','<meta name="work-country" content="India"></head>')],
 ['unrelated entity whitespace',s=>s.replace('</head>','\n</head>')],
 ['unrelated new script',s=>s.replace('</head>','<script>globalThis.newCriteria=true</script></head>')]
])test('every outside byte stays in the complete fingerprint: '+name,()=>{const changed=patch(html);assert.notEqual(changed,html);const certificate=certifyLeverRequestMetadata(changed,metadata());assert.notEqual(certificate.comparisonFingerprint,reference.comparisonFingerprint);assert.throws(()=>readImmutaIntake(changed,metadata()),/profile|content|changed/i)})

test('metadata accessors and proxies cannot execute during a pure certificate',()=>{let calls=0;const m=metadata();Object.defineProperty(m,'headers',{get(){calls++;return row.headers}});assert.throws(()=>certifyLeverRequestMetadata(html,m),/own data|metadata/i);assert.equal(calls,0);const target=metadata(),proxy=new Proxy(target,{get(){calls++;return undefined},ownKeys(){calls++;return[]}});assert.throws(()=>certifyLeverRequestMetadata(html,proxy),/plain|metadata/i);assert.equal(calls,0)})

test('selected header accessors are rejected without invoking them',()=>{let calls=0;const m=metadata();Object.defineProperty(m.headers,'cf-ray',{get(){calls++;return ray}});assert.throws(()=>certifyLeverRequestMetadata(html,m),/own data|header/i);assert.equal(calls,0)})

test('entry accessors are rejected without invoking them',()=>{let calls=0;const m=metadata();Object.defineProperty(m.headerEntries[0],'1',{get(){calls++;return 'value'}});assert.throws(()=>certifyLeverRequestMetadata(html,m),/accessor|data/i);assert.equal(calls,0)})

test('unpaired string bytes and complete entity overflow cannot be certified',()=>{assert.throws(()=>certifyLeverRequestMetadata(html+'\ud800',metadata()),/UTF8|lossless/i);assert.throws(()=>certifyLeverRequestMetadata(' '.repeat(4*1024*1024)+html,metadata()),/bound/i)})
