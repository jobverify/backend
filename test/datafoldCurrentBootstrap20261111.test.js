import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readNative} from '../scraper/datafold/currentProgrammeData.js'
import {appData} from '../scraper-support/native-sources/declaredAshby/nativeData.js'
import {readNativeDocument} from '../scraper-support/utils/activeNativeHtml.js'

const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const fixture=name=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/'+name,import.meta.url))))
const packet=row=>{
 const bytes=Buffer.from(row.bodyBase64,'base64')
 assert.equal(sha(bytes),row.bodySHA256)
 assert.equal(bytes.length,row.bodyBytes)
 assert.equal(row.requestedURL,row.finalURL)
 return {url:row.finalURL,status:row.status,headers:row.headers,hash:row.bodySHA256,
  text:new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)}
}

test('actual b542 native bootstrap exposes its exact declaration without rewriting original evidence',()=>{
 const actual=fixture('datafold-current-b542-bootstrap-20261111.json.gz')
 const original=packet(actual.response)
 const native=readNative(original)
 assert.deepEqual(native.rendererSourceDeclaration,{
  version:actual.expected.version,manifestURL:actual.expected.manifestURL,
 })
 assert.equal(native.originalHTML,original.text)
 assert.equal(native.htmlSHA256,original.hash)
 assert.deepEqual(native.headers,original.headers)
 assert.equal(JSON.stringify(native.model),JSON.stringify(appData(readNativeDocument(original.text))))
 assert.equal(native.model.organization.hostedJobsPageSlug,'datafold')
 assert.equal(Object.hasOwn(native,'inventoryEvidence'),false)
 assert.equal(Object.hasOwn(native,'sourceCertificate'),false)
})

test('historical actual07dd carrier still retains its complete original model and HTML',()=>{
 const prior=fixture('datafold-current-programme-07dd-20261111.json.gz')
 const original=packet(prior.responses.find(row=>row.kind==='board'&&row.phase==='opening'))
 const native=readNative(original)
 assert.equal(native.originalHTML,original.text)
 assert.equal(native.htmlSHA256,original.hash)
 assert.equal(JSON.stringify(native.model),JSON.stringify(appData(readNativeDocument(original.text))))
 assert.equal(Object.hasOwn(native,'inventoryEvidence'),false)
})

const mutatedCurrent=mutate=>{
 const actual=fixture('datafold-current-b542-bootstrap-20261111.json.gz')
 const original=packet(actual.response)
 const text=mutate(original.text,actual.expected.version)
 assert.notEqual(text,original.text,'Control must change original packet bytes')
 return {...original,text,hash:sha(text)}
}

for(const[name,mutate]of[
 ['one bound head href has another deployment',(text,version)=>text.replace(version,'0'.repeat(40))],
 ['uppercase deployment literals',(text,version)=>text.split(version).join(version.toUpperCase())],
 ['changed bootstrap consumer',(text)=>text.replace('const ENTRY_KEY = "index.html"','const ENTRY_KEY = "other.html"')],
 ['manifest query added to active fetch',(text)=>text.replace('.vite/manifest.json").then','.vite/manifest.json?filter=India").then')],
 ['a new executable bootstrap tail',(text)=>text.replace('</script>',';window.extraRecruitmentProgramme=true;</script>')],
 ['an extra original head resource',(text)=>text.replace('</head>','<link rel="stylesheet" href="https://example.com/new.css"></head>')],
 ['a different original asset host',(text)=>text.replace('https://cdn.ashbyprd.com/cdn_assets/','https://example.com/cdn_assets/')],
 ['a changed font stylesheet filename',(text)=>text.replace('fonts/WhitneySSm/WhitneySSm.css','fonts/WhitneySSm/another.css')],
])test('holds '+name,()=>{
 assert.throws(()=>readNative(mutatedCurrent(mutate)),{softFailure:true,failureKind:'coverage_gap'})
})
