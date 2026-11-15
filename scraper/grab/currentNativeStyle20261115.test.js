import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readGrabBoard,readGrabStyle} from './currentNative.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-current-style-20261115.json.gz',import.meta.url))))
const [board,previous,current]=fixture.responses
const sha=value=>createHash('sha256').update(value).digest('hex')

test('current Grab declared stylesheet is the complete already reviewed public stylesheet at its new exact versioned URL',()=>{
 for(const row of fixture.responses)assert.equal(sha(row.body),row.sha256)
 assert.equal(previous.body,current.body)
 assert.notEqual(previous.url,current.url)
 const native=readGrabBoard(board.body)
 assert.deepEqual(native.styleURLs,[current.url])
 assert.ok(native.cards.length>0)
 assert.doesNotThrow(()=>readGrabStyle(current.url,current.body,current.sha256))
})

test('new exact stylesheet URL still requires all original bytes',()=>{
 assert.throws(()=>readGrabStyle(current.url,current.body+'\nbody{display:none}'),/stylesheet bytes require review/)
})

test('future stylesheet version declarations remain unreviewed',()=>{
 const url=current.url.replace('639302868077536290','639399999999999999')
 assert.throws(()=>readGrabBoard(board.body.replace('/phb/style.css.v639302868077536290',new URL(url).pathname)),/stylesheet\/style declaration inventory requires review/)
 assert.throws(()=>readGrabStyle(url,current.body,current.sha256),/stylesheet bytes require review/)
})

test('current stylesheet declaration cannot carry an unreviewed visibility control',()=>{
 assert.throws(()=>readGrabBoard(board.body.replace('href="/phb/style.css.v639302868077536290"','media="print" href="/phb/style.css.v639302868077536290"')),/stylesheet\/style declaration inventory requires review/)
})
