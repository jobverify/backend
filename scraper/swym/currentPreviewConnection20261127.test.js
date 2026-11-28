import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readCurrentBoard} from './currentConfiguredBoard20261120.js'

const packet=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-board-20261127.json.gz',import.meta.url))))
const preview='jobListingsConnection({"first":10})'
function changePreview(edit){
 const script=readNativeDocument(packet.body).nodes(n=>n.tag==='script'&&n.attrs.id==='__NEXT_DATA__')[0]
 const model=JSON.parse(script.raw),cache=model.props.pageProps.apolloState.data
 const company=cache[cache.ROOT_QUERY['startup({"slug":"swym"})'].__ref]
 edit(company[preview],company)
 return packet.body.replace(script.raw,JSON.stringify(model).replace(/</g,'\\u003c'))
}

test('Swym reconciles a complete unfiltered connection with its additional empty native preview',()=>{
 const current=readCurrentBoard(packet.body)
 assert.equal(current.nativeCurrentLiveJobCount,0)
 assert.equal(current.nativeConnection.totalPageCount,1)
 assert.equal(current.nativeConnection.pageSize,0)
 assert.equal(current.originalNativeCompany[preview].totalCount,0)
 assert.equal(current.nativePreviewConnections.length,1)
 assert.equal(current.nativePreviewConnections[0].key,preview)
 assert.equal(current.nativePreviewConnections[0].arguments.first,10)
 assert.equal(current.nativePreviewConnections[0].connection.__typename,'JobListingConnection')
 assert.equal(current.nativePreviewConnections[0].connection.totalCount,0)
 assert.deepEqual(current.nativePreviewConnections[0].connection.edges,[])
 assert.equal(current.sourceScopeComplete,false)
 assert.equal(current.companyGlobalTotal,null)
})

for(const[label,edit]of[
 ['positive count',connection=>{connection.totalCount=1}],
 ['positive edge',connection=>{connection.edges=[{node:{__ref:'JobListing:123'}}]}],
 ['unknown count',connection=>{delete connection.totalCount}],
 ['unreviewed pagination',connection=>{connection.pageInfo={hasNextPage:true}}],
 ['filtered preview',(_connection,company)=>{company['jobListingsConnection({"first":10,"filters":{"locationIds":["India"]}})']=company[preview];delete company[preview]}],
])test('Swym holds an additional preview with '+label,()=>{
 assert.throws(()=>readCurrentBoard(changePreview(edit)),error=>error.failureKind==='parser_or_contract_error')
})
