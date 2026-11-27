import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {selectReviewedCandidateClient} from '../darwinbox/reviewedCandidateClient.js'
const path='/ms/candidatev2/main.f5e76c3f4b395062.js'
const hash=body=>createHash('sha256').update(body).digest('hex'),text=p=>Buffer.from(p.bodyBase64,'base64').toString()

for(const [source,tenant]of[['datapatterns','datapatterns'],['keyence','keyence'],['stanplus','redhealth']]){
 const origin='https://'+tenant+'.darwinbox.in',capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('../'+source+'/test-data/deployment-20261125.json.gz',import.meta.url)))),review=JSON.parse(fs.readFileSync(new URL('../'+source+'/reviewedNativeScope.json',import.meta.url),'utf8'))
 const client=capture.packets.find(p=>p.url===origin+path),shell=capture.packets.find(p=>p.url.startsWith(origin)&&text(p).includes('main.f5e76c3f4b395062.js'))
 async function inspect(change=(p,body)=>body){
  const {run}=await import('../'+source+'/script.js'),reads=[],seedBoundary=Object.freeze({review:source+'-anonymous-public-seed-boundary'})
  let error
  try{await run({fetchImpl:async(url,init)=>{
   reads.push(url)
   if(url.startsWith(origin)&&reads.includes(client.url)&&!url.endsWith('.js'))throw seedBoundary
   const p=capture.packets.find(p=>p.url===url);assert.ok(p,'Only captured official opening reads')
   const headers=new Headers(p.headers);for(const name of p.setCookieNames??[])headers.append('set-cookie',name+'=controlled-fixture-public-session; Path=/')
   return Object.defineProperties(new Response(change(p,text(p)),{status:p.status,headers}),{url:{value:p.finalURL},redirected:{value:p.redirected}})
  }})}catch(cause){error=cause}
  return{reads,error,seedBoundary}
 }
 test(source+' current actual candidate main selects its exact reviewed bytes while the changed full shell remains held',()=>{
  assert.ok(client&&shell);assert.equal(hash(Buffer.from(client.bodyBase64,'base64')),client.sha256)
  assert.equal(client.sha256,'fca478943f06f1e5ce96b92bb2184c39c65c75e92d859eb7ec4738e9995f9766')
  const release=selectReviewedCandidateClient({source,origin,review},[client.url]);assert.ok(release)
  assert.equal(release.clientSha256,client.sha256);assert.notEqual(release.rendererSha256,shell.sha256)
 })
 test(source+' original current program passes admission and stops at the next actual unobserved public seed without inventing inventory',async()=>{
  const r=await inspect();assert.equal(r.error,r.seedBoundary);assert.ok(r.reads.includes(client.url))
  assert.ok(!r.reads.some(url=>url.includes('/ms/candidateapi/')))
 })
 test(source+' changed complete native client remains rejected before any public session/API read',async()=>{
  const r=await inspect((p,body)=>p.url===client.url?body+';window.unreviewedHiringRule=true':body)
  assert.match(r.error?.message??'',/reviewed public API client changed/);assert.notEqual(r.error,r.seedBoundary)
 })
 test(source+' unknown candidate declaration and foreign native base remain held',async()=>{
  for(const edit of[body=>body.replaceAll('main.f5e76c3f4b395062.js','main.ffffffffffffffff.js'),body=>body.replace('href="/ms/candidatev2/"','href="https://foreign.invalid/ms/candidatev2/"')]){
   let changed=false
   const r=await inspect((p,body)=>p.url===shell.url?(changed=true,edit(body)):body)
   assert.equal(changed,true);assert.match(r.error?.message??'',/active candidate client changed|candidate base identity changed/)
   assert.ok(!r.reads.includes(client.url));assert.ok(!r.reads.some(url=>url.includes('/ms/candidateapi/')))
  }
 })
 test(source+' current release cannot select another employer origin',()=>{
  assert.equal(selectReviewedCandidateClient({source,origin,review},['https://another.invalid'+path]),undefined)
 })
}
