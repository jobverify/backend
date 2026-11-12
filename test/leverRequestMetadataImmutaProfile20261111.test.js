import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import * as api from '../scraper-support/utils/leverRequestMetadataCertificate.js'

const sha=value=>createHash('sha256').update(value).digest('hex')
const fixture=name=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/'+name,import.meta.url))))
const genuine=fixture('lever-request-metadata-immuta-openings-20261111.json.gz')
assert.equal(genuine.acquiredClosings,false)
assert.equal(genuine.completeSourceTransaction,false)
assert.equal(genuine.actual31Reconstructed,false)
const [opening,diagnostic]=genuine.responses
const packets=[
 {kind:'genuine retained programme opening only',row:opening,html:Buffer.from(opening.bodyBase64,'base64').toString('utf8')},
 {kind:'genuine separate diagnostic opening only',row:diagnostic,html:Buffer.from(diagnostic.bodyBase64,'base64').toString('utf8')}
]
const profile='immuta-intake-server-publication-v1',I='https://jobs.lever.co/immuta/4372d3ba-00d6-4ae0-986c-e65d8dbf9def'
const metadata=(row=opening)=>({profile,requestedURL:row.requestedURL,finalURL:row.finalURL,headers:structuredClone(row.headers),headerEntries:structuredClone(row.headerEntries)})
const html=packets[0].html,sourceOffset=html.lastIndexOf('<script>')+8,source=html.slice(sourceOffset,sourceOffset+1097)
assert(source.includes('__CF$cv$params'))
const controlledTime=digits=>html.slice(0,sourceOffset+192)+Buffer.from(digits,'latin1').toString('base64')+html.slice(sourceOffset+208)
const held=pattern=>error=>{assert.equal(error.failureKind,'coverage_gap');assert.equal(error.abortRetries,true);assert.match(error.message,pattern);return true}
const changedSource=changed=>{assert.notEqual(changed,source);return html.slice(0,sourceOffset)+changed+html.slice(sourceOffset+source.length)}
const setHeader=(m,key,value)=>{m.headers[key]=value;m.headerEntries=m.headerEntries.map(([name,old])=>[name,name.toLowerCase()===key?value:old]);return m}

for(const packet of packets)test('new Immuta profile certifies only comparison facts for '+packet.kind,()=>{
 assert.equal(sha(packet.html),packet.row.bodySHA256)
 const certificate=api.certifyLeverRequestMetadata(packet.html,metadata(packet.row))
 assert.equal(certificate.comparisonProfile,profile)
 assert.equal(certificate.comparisonFingerprint,'2a2ac2c9a60ac5ce727c119d8fe5c48ad143f60b398939e90400e63a01002ca2')
 assert.equal(certificate.originalEntitySHA256,packet.row.bodySHA256)
 assert.equal(certificate.originalEntityBytes,packet.row.bodyBytes)
 assert.deepEqual(certificate.requestBinding,{requestedURL:I,finalURL:I})
 assert.equal(certificate.timeLiteral.signedDifferenceSeconds,0,'Both real Immuta observations have equality; neither reconstructs actual31')
 assert.equal(certificate.tDateBound,false)
 assert.equal(certificate.sourceTimeSemanticsQualified,false)
 assert.equal(certificate.timeLiteral.tDateBound,false)
 assert.equal(certificate.timeLiteral.sourceTimeSemanticsQualified,false)
 assert.equal(certificate.comparisonOnly,true)
 assert.equal(certificate.rawRetentionRequired,true)
 assert.match(certificate.limits.at(-1),/Immuta intake/)
 assert.deepEqual(JSON.parse(JSON.stringify(certificate)),certificate)
 assert.equal(sha(packet.html),packet.row.bodySHA256)
})

test('explicitly synthetic Immuta minus-one literal remains held by the unchanged strict default',()=>{
 const original=api.certifyLeverRequestMetadata(html,{headers:opening.headers,headerEntries:opening.headerEntries})
 const digits=String(Number(original.headerBinding.unixSeconds)-1),changed=controlledTime(digits)
 assert.notEqual(changed,html)
 assert.throws(()=>api.certifyLeverRequestMetadata(changed,{headers:opening.headers,headerEntries:opening.headerEntries}),/Exact source time must bind to original Date second/)
 assert.equal(sha(html),opening.bodySHA256)
})

test('export is exact and all complete pre-existing certificate outputs stay identical',()=>{
 assert.equal(api.IMMUTA_INTAKE_SERVER_PUBLICATION_PROFILE,profile)
 const oldLoadsmart=fixture('loadsmart-current-programme-20261111.json.gz').responses[1],actual32=fixture('lever-request-metadata-loadsmart-actual32-20261111.json.gz').responses[0]
 for(const[label,row,selected,expected]of[
  ['strict Immuta',opening,null,'4a752edcb41435cd05c9708939f6ebb4c2bdd3eeab693cad6e37f8d1d9cced68'],
  ['strict Loadsmart',oldLoadsmart,null,'6102aef5ea261ebf8610ed8fa466e090897a222bb3345f33301f2457ec411957'],
  ['Loadsmart actual32',actual32,api.LOADSMART_SERVER_PUBLICATION_PROFILE,'d20389b60bad103e36a40c268fa532d23bbaf6b3a97b246728f1164b26a38739'],
  ['Loadsmart historical',oldLoadsmart,api.LOADSMART_SERVER_PUBLICATION_PROFILE,'709fd895485cdfde51f640008bb3c67459b1b269be8806a2b122462bcadb1ab1']
 ]){
  const m={headers:row.headers,headerEntries:row.headerEntries};if(selected)Object.assign(m,{profile:selected,requestedURL:row.requestedURL,finalURL:row.finalURL})
  const certificate=api.certifyLeverRequestMetadata(Buffer.from(row.bodyBase64,'base64').toString('utf8'),m)
  assert.equal(sha(JSON.stringify(certificate)),expected,label+' complete output')
 }
})

for(const digits of['1794415316','1794415318','1000000000','9999999999'])test('explicitly synthetic canonical Immuta t has no Date tolerance or time meaning: '+digits,()=>{
 const changed=controlledTime(digits);assert.notEqual(changed,html)
 const certificate=api.certifyLeverRequestMetadata(changed,metadata())
 assert.equal(certificate.timeLiteral.decodedDigits,digits)
 assert.equal(certificate.timeLiteral.rawBase64,Buffer.from(digits).toString('base64'))
 assert.equal(certificate.timeLiteral.originalDate,opening.headers.date)
 assert.equal(certificate.timeLiteral.signedDifferenceSeconds,Number(digits)-Date.parse(opening.headers.date)/1000)
 assert.equal(certificate.tDateBound,false)
 assert.equal(certificate.sourceTimeSemanticsQualified,false)
 assert.equal(certificate.comparisonFingerprint,'2a2ac2c9a60ac5ce727c119d8fe5c48ad143f60b398939e90400e63a01002ca2')
 assert.equal(sha(html),opening.bodySHA256)
})

for(const digits of['0000000000','0794415317','179441531','17944153178','-794415317','17944153.7','17944153e7','179441531 ','17944153\n7','17944153\xb27'])test('synthetic malformed decimal literal holds '+JSON.stringify(digits),()=>{
 const changed=controlledTime(digits);assert.notEqual(changed,html)
 assert.throws(()=>api.certifyLeverRequestMetadata(changed,metadata()),held(/Opaque|length|template|source/i))
})

test('synthetic noncanonical base64 pad bits hold even when decoded digits are unchanged',()=>{
 const literal=source.slice(192,208),noncanonical=literal.slice(0,13)+'x=='
 assert.notEqual(noncanonical,literal)
 assert.equal(Buffer.from(noncanonical,'base64').toString('ascii'),Buffer.from(literal,'base64').toString('ascii'))
 const changed=changedSource(source.slice(0,192)+noncanonical+source.slice(208))
 assert.throws(()=>api.certifyLeverRequestMetadata(changed,metadata()),held(/roundtrip|canonical/i))
})

for(const[key,value]of[
 ['requestedURL',undefined],['finalURL',undefined],['requestedURL',I+'/'],['finalURL',I+'?mode=json'],['requestedURL',I+'#new'],
 ['finalURL','https://jobs.lever.co/immuta/00000000-0000-0000-0000-000000000000'],['requestedURL',I.replace('jobs.lever.co','JOBS.lever.co')]
])test('Immuta profile rejects missing or changed original '+key+' '+String(value),()=>{
 const m=metadata();if(value===undefined)delete m[key];else m[key]=value
 assert.throws(()=>api.certifyLeverRequestMetadata(html,m),held(/metadata|Immuta|requestedURL|finalURL/i))
})

test('both cross-profile URL directions hold rather than borrowing account authority',()=>{
 const loadsmart=metadata();loadsmart.profile=api.LOADSMART_SERVER_PUBLICATION_PROFILE
 assert.throws(()=>api.certifyLeverRequestMetadata(html,loadsmart),held(/exact original Loadsmart/))
 const immuta=metadata();immuta.requestedURL=immuta.finalURL='https://jobs.lever.co/loadsmart/'
 assert.throws(()=>api.certifyLeverRequestMetadata(html,immuta),held(/exact original Immuta intake/))
})

for(const key of['profile','requestedURL','finalURL'])test('new Immuta '+key+' accessor holds without execution',()=>{
 let calls=0;const m=metadata();Object.defineProperty(m,key,{get(){calls++;throw Error('Unexpected getter')}})
 assert.throws(()=>api.certifyLeverRequestMetadata(html,m),held(/own data|non-data|profile|metadata/i))
 assert.equal(calls,0)
})

test('proxy metadata and own proxy field values hold without callbacks',()=>{
 let calls=0;const traps={get(){calls++;throw Error('Unexpected proxy')},getOwnPropertyDescriptor(){calls++;throw Error('Unexpected proxy')},getPrototypeOf(){calls++;throw Error('Unexpected proxy')},ownKeys(){calls++;throw Error('Unexpected proxy')}}
 assert.throws(()=>api.certifyLeverRequestMetadata(html,new Proxy(metadata(),traps)),held(/plain own data/))
 for(const key of['profile','requestedURL','finalURL']){const m=metadata();m[key]=new Proxy({},traps);assert.throws(()=>api.certifyLeverRequestMetadata(html,m),held(/profile|Immuta|URL/i))}
 assert.equal(calls,0)
})

test('inherited receipt provenance cannot opt into the new profile',()=>{
 for(const key of['profile','requestedURL','finalURL']){const m=metadata(),value=m[key];delete m[key];Object.setPrototypeOf(m,{[key]:value});assert.throws(()=>api.certifyLeverRequestMetadata(html,m),held(/plain own data/))}
})

test('profile and URL objects cannot execute coercion hooks',()=>{
 let calls=0
 for(const key of['profile','requestedURL','finalURL']){const m=metadata();m[key]={toString(){calls++;throw Error('Unexpected conversion')},valueOf(){calls++;throw Error('Unexpected conversion')}};assert.throws(()=>api.certifyLeverRequestMetadata(html,m),held(/profile|Immuta|URL/i))}
 assert.equal(calls,0)
})

for(const value of[undefined,null,'immuta-intake-server-publication-v2','other-server-publication-v1'])test('unknown own Immuta profile holds '+String(value),()=>{
 const m=metadata();m.profile=value
 assert.throws(()=>api.certifyLeverRequestMetadata(html,m),held(/Unknown or non-data comparison profile/))
})

for(const[name,patch]of[
 ['first ray',s=>s.slice(0,171)+'0000000000000001'+s.slice(187)],
 ['second ray',s=>s.slice(0,401)+'0000000000000001'+s.slice(417)],
 ['executable source',s=>s.replace('a.height=1;a.width=1;','a.height=2;a.width=1;')],
 ['literal context',s=>s.replace('params={r:','params={s:')],
 ['external child path',s=>s.replace('jsd/main.js?ray=','jse/main.js?ray=')],
 ['executable tail',s=>s+';globalThis.newCriteria=true;']
])test('Immuta opt-in keeps source guards: '+name,()=>{
 assert.throws(()=>api.certifyLeverRequestMetadata(changedSource(patch(source)),metadata()),held(/ray|source|template|length/i))
})

for(const wrapper of['template','svg','math','object'])test('new profile keeps active carrier context guard under '+wrapper,()=>{
 const changed=html.replace('<script>'+source+'</script>','<'+wrapper+'><script>'+source+'</script></'+wrapper+'>');assert.notEqual(changed,html)
 assert.throws(()=>api.certifyLeverRequestMetadata(changed,metadata()),held(/carrier|context|body|HTML/i))
})

for(const attrs of[' src=""',' src="https://foreign.example/script.js"',' type="module"'])test('new profile holds changed carrier attribute '+attrs,()=>{
 const changed=html.replace('<script>'+source,'<script'+attrs+'>'+source);assert.notEqual(changed,html)
 assert.throws(()=>api.certifyLeverRequestMetadata(changed,metadata()),held(/carrier|attribute|boundary/i))
})

for(const[name,patch]of[
 ['non-position authored condition',s=>s.replace('This is a general interest posting','This is a specific position posting')],
 ['new authored country metadata',s=>s.replace('</head>','<meta name="work-country" content="India"></head>')],
 ['outside whitespace',s=>s.replace('</head>','\n</head>')]
])test('certificate preserves outside-byte drift for caller rejection: '+name,()=>{
 const changed=patch(html);assert.notEqual(changed,html)
 const certificate=api.certifyLeverRequestMetadata(changed,metadata())
 assert.notEqual(certificate.comparisonFingerprint,'2a2ac2c9a60ac5ce727c119d8fe5c48ad143f60b398939e90400e63a01002ca2')
 assert.equal(certificate.originalEntitySHA256,sha(changed))
 assert.equal('html'in certificate,false)
 assert.equal('classification'in certificate,false,'Only the source caller can qualify the unchanged explicit non-position declaration')
})

for(const[name,patch]of[
 ['incoherent Date',m=>{m.headers.date='Wed, 11 Nov 2026 16:41:58 GMT';return m}],
 ['duplicate Date',m=>{m.headerEntries.push(['Date',m.headers.date]);return m}],
 ['unbound original ray',m=>setHeader(m,'cf-ray','0000000000000001-LHR')],
 ['noncanonical Date',m=>setHeader(m,'date','2026-11-11T16:41:57Z')]
])test('canonical coherent original header gate remains: '+name,()=>{
 const m=patch(metadata());assert.notDeepEqual(m,metadata())
 assert.throws(()=>api.certifyLeverRequestMetadata(html,m),held(/Date|header|views|ray|canonical|Duplicate/i))
})
