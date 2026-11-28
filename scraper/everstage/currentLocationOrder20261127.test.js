import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {runNativeEverstage} from './nativeRun.js'

// Genuine current 12-response prefix. The following application page was not
// captured and is deliberately refused; this is not a complete inventory.
const packets=JSON.parse(gunzipSync(await fs.readFile(new URL('./fixtures/current-location-prefix-20261127.json.gz',import.meta.url))))
for(const p of packets)assert.equal(createHash('sha256').update(p.body).digest('hex'),p.sha256)
const current='https://ats.rippling.com/en-US/everstage/jobs/81087ce5-8949-4a11-8db7-795cf78b84f4'
const changedPage=(body,change)=>body.replace(/(<script[^>]*id="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/,(_all,start,json,end)=>{const data=JSON.parse(json);change(data);return start+JSON.stringify(data)+end})
async function attempt(change=()=>{}){
 const rows=new Map(packets.map(p=>[p.requestedUrl,{...p}]))
 change(rows)
 const requested=[]
 let error
 try{await runNativeEverstage({requestIntervalMs:0,fetchImpl:async(url,init)=>{
  url=String(url);requested.push(url);assert.equal(init.method,'GET')
  const p=rows.get(url)
  if(!p)throw Error('CONTROLLED_UNOBSERVED_CURRENT_APPLICATION '+url)
  const response=new Response(p.body,{status:p.status,headers:p.headers})
  Object.defineProperty(response,'url',{value:p.url});return response
 }})}catch(caught){error=caught}
 assert.ok(error,'Unobserved application must remain held')
 return{error,requested}
}

test('identical real location membership in a different native order reaches the unobserved application',async()=>{
 const {error,requested}=await attempt()
 assert.match(error.message,/^CONTROLLED_UNOBSERVED_CURRENT_APPLICATION /)
 assert.equal(requested.at(-1),current+'/apply')
 assert.equal(requested.length,13)
})

for(const [name,locations]of[
 ['missing location',['Chennai, India']],
 ['duplicate location',['Chennai, India','Chennai, India']],
 ['foreign replacement',['Chennai, India','London, United Kingdom']],
 ['extra location',['Hyderabad, India','Chennai, India','Remote, India']],
])test(name+' cannot qualify from the unchanged listing',async()=>{
 const {error,requested}=await attempt(rows=>{const p=rows.get(current);p.body=changedPage(p.body,data=>{data.props.pageProps.apiData.jobPost.workLocations=locations})})
 assert.match(error.message,/location geography mismatch/)
 assert.ok(!requested.includes(current+'/apply'))
})

test('page-level location membership must also match the listing',async()=>{
 const {error,requested}=await attempt(rows=>{const p=rows.get(current);p.body=changedPage(p.body,data=>{data.props.pageProps.apiData.workLocations=['Chennai, India','Singapore']})})
 assert.match(error.message,/page location geography mismatch/)
 assert.ok(!requested.includes(current+'/apply'))
})

test('matching reordered page-level labels preserve the actual native job order',async()=>{
 const {error,requested}=await attempt(rows=>{const p=rows.get(current);p.body=changedPage(p.body,data=>{data.props.pageProps.apiData.workLocations.reverse()})})
 assert.match(error.message,/^CONTROLLED_UNOBSERVED_CURRENT_APPLICATION /)
 assert.equal(requested.at(-1),current+'/apply')
})
