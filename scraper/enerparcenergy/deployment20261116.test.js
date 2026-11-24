import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readEnerparcListing,readEnerparcDetail} from './currentNative.js'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261116.json.gz',import.meta.url))))
const [board,detail]=capture.responses.map(row=>Buffer.from(row.bodyBase64,'base64').toString('utf8'))
const sha=value=>createHash('sha256').update(value).digest('hex')

test('Enerparc Nov16 complete native document plans preserve 25 observations and the original reviewed India role',()=>{
 const listing=readEnerparcListing(board)
 assert.equal(listing.jobs.length,25)
 const row=listing.jobs.find(row=>row.id==='74895000002746052')
 const result=readEnerparcDetail(detail,row)
 assert.equal(result.record.Country,'India')
 assert.equal(result.record.Posting_Title,'Systems Engineer – Utility-Scale Solar Electrical Design')
 assert.equal(sha(result.record.Job_Description),'5f9e74bdf4f20c69a3fa2763f7bb7b2d4c3c889ead4078d1891ad65b6142f7d7')
 assert.equal(result.criteria.sourceDetailComplete,true)
})

test('Enerparc Nov16 unrelated CSS and CDN maps cannot negate independently bound native role facts',()=>{
 for(const changed of [
  board.replace('career-website-common.3585e391d3ade73bdb6823525d5b153a.css','career-website-common.ec3ad56936780e537bc552ba0ffff3a1.css'),
  board.replace('fingerPrintJSONForCDNPath = {','fingerPrintJSONForCDNPath = {"unreviewed.js":"unreviewed.js",'),
 ]){
  assert.notEqual(changed,board)
  assert.equal(readEnerparcListing(changed).jobs.length,25)
 }
})
