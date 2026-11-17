import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {BOARD_URL,FEED_URL,readGrabBoard,readGrabFeed,readGrabDetail,readGrabProgram,readGrabStyle} from './currentNative.js'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-current-deployment-20261116.json.gz',import.meta.url))))
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const bytes=row=>Buffer.from(row.bodyBase64,'base64')
const text=row=>bytes(row).toString('utf8')
const board=capture.responses.find(row=>row.url===BOARD_URL)
const feed=readGrabFeed(text(capture.responses.find(row=>row.url===FEED_URL)))
const detail=capture.responses.find(row=>/\/en\/jobs\/\d+\//.test(row.url))
const nativeRow=feed.records.find(row=>row.url===detail.url)
const programs=capture.responses.filter(row=>row.headers['content-type'].includes('javascript')&&row.requestUserAgent==='Chrome')
const style=capture.responses.find(row=>row.headers['content-type'].startsWith('text/css'))
const held=operation=>assert.throws(operation,error=>error.softFailure===true&&error.lifecycleCleanupAllowed===false)

test('Grab Nov16 original declared closure keeps exact program bytes and original India role criteria',()=>{
 for(const row of capture.responses)assert.equal(sha(bytes(row)),row.sha256)
 const listing=readGrabBoard(text(board)),role=readGrabDetail(text(detail),nativeRow)
 assert.equal(listing.total,feed.records.length)
 assert.deepEqual(listing.cards.map(row=>row.id),feed.records.slice(0,20).map(row=>row.apijobid))
 assert.equal(role.job.jobId,'744000161218849')
 assert.equal(role.job.title,'Lead Security Technical Program Manager')
 assert.equal(role.job.country,'India')
 assert.equal(role.job.sourceDetailComplete,true)
 assert.equal(role.job.lifecycleCleanupAllowed,false)
 assert.equal(role.job.activationVerified,false)
 assert.equal(role.job.sourceExactBrandRoleScopeVerified,false)
 assert.equal(sha(role.job.sourceDescriptionHTML),'e413151e0ec361a0097659a9f95a7c1c0f8ae5869e50d15d47f67fca117dd4af')
 const declared=new Set([...listing.programURLs,...role.programURLs])
 assert.equal(declared.size,13)
 for(const row of programs){assert.ok(declared.has(row.url));readGrabProgram(row.url,text(row),row.sha256)}
 assert.equal(programs.length,13)
 assert.deepEqual(listing.styleURLs,[style.url])
 assert.deepEqual(role.styleURLs,[style.url])
 readGrabStyle(style.url,text(style),style.sha256)
})

test('Grab Nov16 current program URLs still reject edited bytes and future deployment declarations',()=>{
 const current='ve785ce3c0c820dfb62cf9b139c72b19a0e689510',future='v0000000000000000000000000000000000000000'
 for(const row of programs){
  held(()=>readGrabProgram(row.url,text(row)+'\nwindow.unreviewed=true'))
  held(()=>readGrabProgram(row.url,text(row),'0'.repeat(64)))
 }
 held(()=>readGrabBoard(text(board).replaceAll(current,future)))
 const row=programs.find(row=>row.url.includes('/phb/app.js.'))
 held(()=>readGrabProgram(row.url.replace(current,future),text(row),row.sha256))
})

test('Grab Nov16 stylesheet remains bound to its whole original bytes and complete declarations',()=>{
 held(()=>readGrabStyle(style.url,text(style)+'\n.cms-content{display:none}'))
 held(()=>readGrabStyle(style.url.replace('639304430131514243','639399999999999999'),text(style),style.sha256))
 held(()=>readGrabBoard(text(board).replace('href="/phb/style.css.v639304430131514243"','media="print" href="/phb/style.css.v639304430131514243"')))
})
