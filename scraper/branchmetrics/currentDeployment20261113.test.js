import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {parseBoard} from './native.js'

const html=gunzipSync(readFileSync(new URL('./fixtures/board-20261113.html.gz',import.meta.url))).toString()
const change=edit=>html.replace(/(<script[^>]*id="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/i,(_m,a,value,b)=>{
 const data=JSON.parse(value);edit(data.props.pageProps.dehydratedState.queries[0]);return a+JSON.stringify(data).replace(/</g,'\\u003c')+b
})

test('Branch current unfiltered board binds its explicit en-US query locale',()=>{
 const listing=parseBoard(html)
 assert.equal(listing.totalItems,18)
 assert.equal(listing.rows.length,18)
 assert.equal(listing.pageSize,20)
})

for(const [label,edit] of [
 ['another locale',q=>{q.queryKey[5]='de-DE'}],
 ['additional query field',q=>{q.queryKey.push('unexpected')}],
 ['location filter',q=>{q.queryKey[4].country='India'}],
 ['unsuccessful query',q=>{q.state.status='error'}],
])test('Branch current locale query still rejects '+label,()=>assert.throws(()=>parseBoard(change(edit)),/native board query/))
