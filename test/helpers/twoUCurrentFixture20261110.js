import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'

const directory=new URL('../../scraper-support/tests/fixtures/twoUCurrent20261110/',import.meta.url)
const manifest=JSON.parse(readFileSync(new URL('manifest.json',directory),'utf8'))
const packetsByURL=new Map()
for(const record of manifest.records){
 const body=gunzipSync(readFileSync(new URL(record.bodyFile,directory)))
 assert.equal(body.length,record.bytes)
 assert.equal(createHash('sha256').update(body).digest('hex'),record.sha256)
 const packet={url:record.finalUrl,status:record.status,headers:record.headers,contentType:record.contentType,
  bodyBase64:body.toString('base64'),html:body.toString('utf8'),requestedAt:record.sourceRequestedAt,completedAt:record.sourceCompletedAt}
 const occurrences=packetsByURL.get(record.requestedUrl)||[]
 occurrences.push(packet);packetsByURL.set(record.requestedUrl,occurrences)
}

// Each run consumes its actual opening/closing entities and acquisition clocks.
// Mutation controls receive detached copies and cannot alter retained originals.
export const createTwoUOriginalReader=()=>{
 const positions=new Map()
 return url=>{
  const packets=packetsByURL.get(url),index=positions.get(url)||0
  assert.ok(packets&&index<packets.length,'Captured 2U request occurrence required: '+url+' #'+index)
  positions.set(url,index+1)
  return structuredClone(packets[index])
 }
}
