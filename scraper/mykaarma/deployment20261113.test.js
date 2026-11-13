import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {listing,role} from './nativeContract20261107.js'
import * as contracts from './nativeContract20261107.js'
const fixture=name=>gunzipSync(readFileSync(new URL('./test-data/deployment-20261113/'+name+'.gz',import.meta.url))).toString('utf8')
const mutateNext=(html,change)=>html.replace(/(<script id="__NEXT_DATA__" type="application\/json">)([\s\S]+?)(<\/script>)/,(_,open,raw,close)=>{const value=JSON.parse(raw);change(value);return open+JSON.stringify(value)+close})
test('November 13 MyKaarma native deployment retains typed country identity and every full India role/application model',()=>{
 const inventory=contracts.mergeListings([listing(fixture('embed')),listing(fixture('embed-page-1'),1)])
 assert.equal(inventory.items.length,22);assert.equal(inventory.groups.length,16)
 const india=inventory.groups.filter(group=>group.country==='IN')
 assert.equal(india.length,7)
 for(const group of india){
  assert.deepEqual(group.issues,[])
  for(const kind of ['role','application']){
   const value=role(fixture('mykaarma-'+(kind==='application'?'apply':'role')+'-'+group.identity.id),group,kind,'2026-11-13T12:00:00.000Z')
   assert.deepEqual(value.issues,[]);assert.equal(value.j.uuid,group.identity.id)
   assert.ok(value.text.length>100);assert.equal(value.j.companyName,'myKaarma')
  }
 }
})
test('November 13 MyKaarma cannot qualify a first page without its declared terminal page',()=>{
 assert.throws(()=>contracts.mergeListings([listing(fixture('embed'))]),/complete|page|count/)
})
test('November 13 MyKaarma cannot substitute the first native page for a different page index',()=>{
 assert.throws(()=>listing(fixture('embed'),1),/page|query|filter/)
})
test('MyKaarma reviewed department display label cannot contradict its native identity',()=>{
 const changed=mutateNext(fixture('embed'),value=>{value.props.pageProps.dehydratedState.queries.find(q=>q.queryKey[2]==='job-posts').state.data.items[0].department.displayName='Different Department'})
 assert.throws(()=>listing(changed),/department display label/)
})
test('MyKaarma duplicate native role/worksite on a later page cannot inflate the complete inventory',()=>{
 const first=listing(fixture('embed')),existing=first.items.find(row=>row.id==='6a469945-dba2-48ec-96ac-9dd3fa39cc37')
 const changed=mutateNext(fixture('embed-page-1'),value=>{value.props.pageProps.dehydratedState.queries.find(q=>q.queryKey[2]==='job-posts').state.data.items[0].locations=structuredClone(existing.locations)})
 assert.throws(()=>contracts.mergeListings([first,listing(changed,1)]),/Duplicate native location/)
})
test('November 13 MyKaarma native deployment still refuses unreviewed active declarations',()=>{
 const html=fixture('embed'),changed=html.replace('main-eb264300998e854e.js','main-0000000000000000.js')
 assert.notEqual(changed,html);assert.throws(()=>listing(changed),/declaration|context/)
})
for(const [name,before,after]of [
 ['unknown cache locale','"pageSize":20},"en-US"]','"pageSize":20},"fr-FR"]'],
 ['an applied country filter','"country":"","state":"","city":"","page":0,"pageSize":20','"country":"India","state":"","city":"","page":0,"pageSize":20'],
 ['an unknown cache component','"pageSize":20},"en-US"]','"pageSize":20},"en-US","unknown"]'],
])test('November 13 MyKaarma reviewed locale cache key still refuses '+name,()=>{
 const html=fixture('embed'),changed=html.replace(before,after)
 assert.notEqual(changed,html);assert.throws(()=>listing(changed),/query filter|unqualified filter/)
})
