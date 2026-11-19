import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {publisherAssets,readPublisher,BOARD,CORPORATE} from './nativeModels.js'
import {runCondeNastNative} from './nativeRun.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/deployment-20261118.json.gz',import.meta.url))))
const currentApp='https://www.condenast.com/_next/static/chunks/pages/_app-f9be5bda5c9e636b.js'
const currentPage='https://www.condenast.com/_next/static/chunks/pages/careers-8504f5719bd45b77.js'
const currentCSS='https://www.condenast.com/_next/static/css/a4d0ee7c6a37b337.css'

test('Conde Nast accepts the reviewed November 18 publisher while preserving its exact India country proof',()=>{
 assert.deepEqual(publisherAssets(fixture.html),[currentApp,currentPage,currentCSS])
 const publisher=readPublisher(fixture.html,fixture.assets)
 assert.equal(publisher.boardURL,BOARD)
 assert.equal(publisher.country,'India')
 assert.equal(publisher.initialSSRVisible,false)
 assert.equal(publisher.publisherProgramsExecuted,false)
 assert.equal(publisher.assetSHA256[currentApp],'0ef111a6d8dae9ffb12dde38224b8aebaf948f21055db7ad7ead962e3774d0e6')
})

test('Conde Nast November 18 renewal rejects altered assets, new scripts and a changed India handoff',()=>{
 const changed=structuredClone(fixture.assets)
 changed.find(a=>a.url===currentApp).rawText+=';'
 assert.throws(()=>readPublisher(fixture.html,changed),/authored publisher asset/)
 assert.throws(()=>readPublisher(fixture.html.replace('</head>','<script src="/unreviewed.js"></script></head>'),fixture.assets),/unreviewed declared publisher/)
 assert.throws(()=>readPublisher(fixture.html.replaceAll('condenast.wd115.myworkdayjobs.com','other.wd115.myworkdayjobs.com'),fixture.assets),/India country\/account/)
})

test('Conde Nast November 18 collector qualifies the complete current publisher before requesting the declared Workday board',async()=>{
 const calls=[],reachedBoard=new Error('publisher qualified before Workday')
 await assert.rejects(runCondeNastNative({minIntervalMs:0,fetchImpl:async url=>{
  calls.push(url)
  if(url===BOARD)throw reachedBoard
  const asset=fixture.assets.find(a=>a.url===url),body=url===CORPORATE?fixture.html:asset?.rawText
  assert.equal(typeof body,'string','Unexpected public asset '+url)
  const response=new Response(body,{status:200,headers:{'content-type':url===CORPORATE?'text/html':url===currentCSS?'text/css':'application/javascript'}})
  Object.defineProperty(response,'url',{value:url});return response
 }}),error=>error.cause===reachedBoard)
 assert.deepEqual(calls,[CORPORATE,currentApp,currentPage,currentCSS,BOARD])
})
