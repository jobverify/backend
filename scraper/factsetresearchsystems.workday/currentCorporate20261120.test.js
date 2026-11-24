import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFactSetPublisherDeclaration} from './currentPublisher.js'

const historical=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-publisher-20261114.json.gz',import.meta.url))))
const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-corporate-20261120.json.gz',import.meta.url))))
const original=Buffer.from(current.bodyBase64,'base64').toString()
async function probe(t,change){
 t.mock.method(globalThis,'fetch',()=>{throw Error('Real network prohibited in original publisher regression')})
 const body=change?change(original):original
 if(change)assert.notEqual(body,original)
 const calls=[],read=async url=>{
  calls.push(url);const row=historical.captures.find(row=>row.requestUrl===url)
  assert.ok(row,'Only transparently historical exact declarations are available')
  return{url:row.finalUrl,status:row.status,html:row.body}
 }
 const declaration=await readFactSetPublisherDeclaration({page:{url:current.receipt.finalURL,status:200,html:body},readRenderer:read,
  readJson:async url=>JSON.parse((await read(url)).html),readDeclaredBoardPage:read})
 return{declaration,calls}
}
for(const[name,change]of[
 ['actual current Sentry release metadata',null],
 ['unrelated corporate presentation comment',html=>html.replace('</head>','<!-- current marketing presentation -->\n</head>')],
 ['another bounded passive release identifier',html=>html.replace('b7a0b154aa6bf6ba64d9d78d7e97df91df6fbf86','0123456789abcdef0123456789abcdef01234567')],
])test(name+' retains exact own CMS and native declaration compatibility without a current-role claim',async t=>{
 const{declaration,calls}=await probe(t,change)
 assert.equal(declaration.url,'https://factset.wd108.myworkdayjobs.com/FactSetCareers')
 assert.equal(declaration.context.nativeConfig.tenant,'factset')
 assert.equal(calls.length,4)
 assert.equal(declaration.context.publisherShell.anonymous,true)
})
for(const[name,change]of[
 ['new direct JobPosting',html=>html.replace('</head>','<script type="application/ld+json">{"@type":"JobPosting","title":"Another vacancy"}</script></head>')],
 ['new graph JobPosting',html=>html.replace('</head>','<script type="application/ld+json">{"@graph":[{"@type":["Thing","JobPosting"],"title":"Another vacancy"}]}</script></head>')],
 ['new active recruitment handoff',html=>html.replace('</body>','<a href="https://unreviewed.example/jobs">View vacancies</a></body>')],
 ['new authored recruitment content',html=>html.replace('<div id="app"></div>','<div id="app"><h1>Current role</h1></div>')],
 ['hidden app',html=>html.replace('<div id="app"></div>','<div id="app" hidden></div>')],
 ['personalized state',html=>html.replace('"isAnonymous":true','"isAnonymous":false')],
 ['foreign canonical',html=>html.replace('href="https://www.factset.com/careers"','href="https://unrelated.example/careers"')],
])test('current publisher retains hold for '+name,async t=>{
 await assert.rejects(probe(t,change),/FactSet current publisher/)
})
