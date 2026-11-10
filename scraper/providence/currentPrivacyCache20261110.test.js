import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readProvidenceAuthorityHTML,PROVIDENCE_INDIA_CAREERS_URL,PROVIDENCE_INDIA_BOARD_URL} from './currentIndia20261108.js'

const packet=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261110/current-privacy-cache-023318.json.gz',import.meta.url))))
const cacheURL='https://www.providence.in/482fa9ad4bf2/'

test('Providence admits the captured cookie privacy cache without changing its native board authority',()=>{
 assert.equal(packet.status,200)
 assert.equal(packet.requestUrl,PROVIDENCE_INDIA_CAREERS_URL)
 assert.equal(packet.finalUrl,PROVIDENCE_INDIA_CAREERS_URL)
 assert.equal(createHash('sha256').update(packet.body).digest('hex'),packet.sha256)
 const authority=readProvidenceAuthorityHTML(packet.body,PROVIDENCE_INDIA_CAREERS_URL)
 assert.equal(authority.nextURL,PROVIDENCE_INDIA_BOARD_URL)
 assert.equal(authority.bodySHA256,packet.sha256)
})

test('Providence registered collection never requests the cookie privacy cache URL',async()=>{
 const calls=[],boundary=Object.freeze({testBoundary:'owned-board'})
 const scraper=createCatalogScraper(getScraperCatalog().find(provider=>provider.source==='providence'))
 await assert.rejects(scraper.run({fetchImpl:async url=>{
  calls.push(url)
  if(url===PROVIDENCE_INDIA_BOARD_URL)throw boundary
  assert.equal(url,PROVIDENCE_INDIA_CAREERS_URL)
  const response=new Response(packet.body,{status:packet.status,headers:{'content-type':packet.contentType}})
  Object.defineProperty(response,'url',{value:packet.finalUrl})
  return response
 }}),error=>error===boundary)
 assert.deepEqual(calls,[PROVIDENCE_INDIA_CAREERS_URL,PROVIDENCE_INDIA_BOARD_URL])
})

for(const[name,change]of[
 ['a query-bearing privacy URL',html=>html.replace(cacheURL,cacheURL+'?unreviewed=1')],
 ['a foreign privacy URL',html=>html.replace(cacheURL,'https://foreign.invalid/482fa9ad4bf2/')],
 ['an unknown carrier vector',html=>html.replace(/<body /,'<body data-unreviewed="1" ')],
 ['changed cookie program bytes',html=>html.replace('var complianz=','var complianz=/*unreviewed*/')],
 ['a foreign hiring authority',html=>html.replaceAll(PROVIDENCE_INDIA_BOARD_URL,'https://foreign.invalid/jobs/')],
])test('Providence privacy cache repair continues to hold '+name,()=>{
 const html=change(packet.body)
 assert.notEqual(html,packet.body)
 assert.throws(()=>readProvidenceAuthorityHTML(html,PROVIDENCE_INDIA_CAREERS_URL),/Providence India/)
})
