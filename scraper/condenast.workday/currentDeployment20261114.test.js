import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {publisherAssets,readPublisher,BOARD,CORPORATE} from './nativeModels.js'
import {runCondeNastNative} from './nativeRun.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/deployment-20261114.json.gz',import.meta.url))))
const currentApp='https://www.condenast.com/_next/static/chunks/pages/_app-7b5572eba30a654a.js'
const currentCSS='https://www.condenast.com/_next/static/css/a4d0ee7c6a37b337.css'

test('Conde Nast qualifies the current declared country renderer and stylesheet before using its India handoff',()=>{
 assert.deepEqual(publisherAssets(fixture.html),[currentApp,'https://www.condenast.com/_next/static/chunks/pages/careers-8504f5719bd45b77.js',currentCSS])
 const publisher=readPublisher(fixture.html,fixture.assets)
 assert.equal(publisher.boardURL,BOARD)
 assert.equal(publisher.country,'India')
 assert.equal(publisher.initialSSRVisible,false)
 assert.equal(publisher.publisherProgramsExecuted,false)
 assert.equal(publisher.assetSHA256[currentApp],'d9ed42715de1db6a27e08942a341d74e35eba95b7cf3903d5d1e4607fb0476e3')
})

test('Conde Nast renewal still rejects unpublished bundles, altered original bytes and extra publisher scripts',()=>{
 assert.throws(()=>publisherAssets(fixture.html.replaceAll('_app-7b5572eba30a654a.js','_app-unreviewed.js')),/renderer\/style/)
 const changed=structuredClone(fixture.assets);changed.find(a=>a.url===currentApp).rawText+=';'
 assert.throws(()=>readPublisher(fixture.html,changed),/authored publisher asset/)
 assert.throws(()=>readPublisher(fixture.html.replace('</head>','<script src="/unreviewed.js"></script></head>'),fixture.assets),/unreviewed declared publisher/)
})


test('Conde Nast collector reads the currently declared reviewed asset set before entering Workday',async()=>{
 const calls=[],reachedBoard=new Error('current publisher qualified before Workday')
 await assert.rejects(runCondeNastNative({minIntervalMs:0,fetchImpl:async url=>{
  calls.push(url)
  if(url===BOARD)throw reachedBoard
  const asset=fixture.assets.find(a=>a.url===url),body=url===CORPORATE?fixture.html:asset?.rawText
  assert.equal(typeof body,'string','Unexpected public asset '+url)
  const response=new Response(body,{status:200,headers:{'content-type':url===CORPORATE?'text/html':url===currentCSS?'text/css':'application/javascript'}})
  Object.defineProperty(response,'url',{value:url});return response
 }}),error=>error.cause===reachedBoard)
 assert.deepEqual(calls,[CORPORATE,currentApp,'https://www.condenast.com/_next/static/chunks/pages/careers-8504f5719bd45b77.js',currentCSS,BOARD])
})


test('Conde Nast returned publisher evidence cannot mutate a later deployment review',()=>{
 const first=readPublisher(fixture.html,fixture.assets)
 first.assetSHA256[currentApp]='untrusted observer value'
 const second=readPublisher(fixture.html,fixture.assets)
 assert.equal(second.assetSHA256[currentApp],'d9ed42715de1db6a27e08942a341d74e35eba95b7cf3903d5d1e4607fb0476e3')
})
