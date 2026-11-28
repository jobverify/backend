import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run} from './script.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-native-20261117.json.gz',import.meta.url))))
const board=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-board-20261127.json.gz',import.meta.url))))
assert.equal(createHash('sha256').update(board.body).digest('hex'),board.sha256)
const preview='jobListingsConnection({"first":10})'
function alterBoard(edit){
  const carrier=readNativeDocument(board.body).nodes(node=>node.tag==='script'&&node.attrs.id==='__NEXT_DATA__')[0]
  const input=JSON.parse(carrier.raw),cache=input.props.pageProps.apolloState.data
  const tenant=cache[cache.ROOT_QUERY['startup({"slug":"prepinsta"})'].__ref]
  edit(tenant[preview],tenant)
  return board.body.replace(carrier.raw,JSON.stringify(input).replace(/</g,'\\u003c'))
}
function transport(edit=()=>board.body){
  let reads=0
  return async(url)=>{
    const row=fixture.responses.find(value=>value.requestedUrl===url)
    assert.ok(row,'Only employer-declared public endpoints may be read')
    const body=url===board.url?edit(++reads):Buffer.from(row.bodyBase64,'base64')
    const response=new Response(body,{status:row.status,headers:row.headers})
    Object.defineProperty(response,'url',{value:row.finalUrl})
    return response
  }
}

test('PrepInsta reconciles the current empty preview with its complete native tenant connection while keeping company scope unknown',async()=>{
  const jobs=await run({fetchImpl:transport()})
  assert.equal(jobs.length,0)
  assert.equal(jobs.nativeCollectionEvidence.nativeOpening.tenant[preview].totalCount,0)
  assert.equal(jobs.nativeCollectionEvidence.wholeObservedNativeTenantClosingReconciled,true)
  assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
  assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

for(const[label,edit]of[
  ['positive count',connection=>{connection.totalCount=1}],
  ['positive edge',connection=>{connection.edges=[{node:{__ref:'JobListing:123'}}]}],
  ['missing count',connection=>{delete connection.totalCount}],
  ['additional pagination',connection=>{connection.pageInfo={hasNextPage:true}}],
  ['filtered preview',(_connection,tenant)=>{tenant['jobListingsConnection({"first":10,"filters":{"locationIds":["India"]}})']=tenant[preview];delete tenant[preview]}],
  ['second full connection',(_connection,tenant)=>{
    const key=Object.keys(tenant).find(value=>value.startsWith('jobListingsConnection(')&&value!==preview)
    tenant[key.replace('"first":20','"first":40')]=tenant[key]
  }],
])test('PrepInsta retains the failure for a native preview with '+label,async()=>{
  await assert.rejects(run({fetchImpl:transport(()=>alterBoard(edit))}),/connection|preview/i)
})

test('PrepInsta closing preview drift cannot retain an opening empty observation',async()=>{
  await assert.rejects(run({fetchImpl:transport(count=>count===1?board.body:alterBoard(connection=>{connection.totalCount=1}))}),/connection|preview/i)
})
