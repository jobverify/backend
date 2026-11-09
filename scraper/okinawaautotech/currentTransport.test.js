import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import * as source from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
const careers = await readFile(new URL('./fixtures/current-careers.html', import.meta.url), 'utf8')
const detail = await readFile(new URL('./fixtures/current-detail.html', import.meta.url), 'utf8')
const application = await readFile(new URL('./fixtures/current-application.html', import.meta.url), 'utf8')
const anchor = await readFile(new URL('./fixtures/existing-godaddy-g2-root.pem', import.meta.url), 'utf8')
const cross = await readFile(new URL('./certificates/godaddy-tls-r1-cross-g2.pem', import.meta.url), 'utf8')
const now = () => new Date('2026-10-09T00:00:00Z')
const nativeFetch = async url => url.includes('careerdetail.aspx') ? detail : url.includes('applynow.aspx') ? application : careers

test('current listing retrieves the native detail JD and binds the exact job application', async () => {
 const calls=[]
 const jobs=await source.run({fetchText:async url=>{calls.push(url);return nativeFetch(url)},now:()=>now().toISOString()})
 assert.equal(jobs.length,1)
 assert.match(jobs[0].jobDescription,/Handling the DD Team/)
 assert.match(jobs[0].jobDescription,/Good client facing, negotiation skills preferred/)
 assert.equal(jobs[0].minimumQualification,'Graduate, MBA')
 assert.equal(jobs[0].country,'India')
 assert.equal(jobs[0].jobId,'DD-01')
 assert.equal(jobs[0].sourceListingComplete,false)
 const inventory=readInventoryEvidence(jobs)
 assert.equal(inventory.status,'coverage-gap')
 assert.equal(inventory.listingComplete,false)
 assert.equal(inventory.reportedTotal,null)
 assert.equal(inventory.indiaFacetCount,null)
 assert.equal(calls.filter(u=>u.includes('careerdetail.aspx')).length,1)
 assert.equal(calls.filter(u=>u.includes('applynow.aspx')).length,1)
})

test('foreign listing location cannot become an India role', async () => {
 await assert.rejects(source.run({fetchText:async()=>careers.replace(/Gurugram/g,'London, United Kingdom')}),/India|country|location/i)
})

for(const [name,patch] of [
 ['detail title mismatch',h=>h.replace('Asst. Manager/Manager Dealer Development','Director of Finance')],
 ['detail location mismatch',h=>h.replace('Gurugram, HR','London, United Kingdom')],
 ['detail application job ID mismatch',h=>h.replace(/jobid=11/g,'jobid=12')],
 ['substantive JD missing',h=>h.replace(/<ul>[\s\S]*?<\/ul>/g,'')],
]) test(name+' is fatal',async()=>{
 await assert.rejects(source.run({fetchText:async u=>u.includes('careerdetail.aspx')?patch(detail):nativeFetch(u)}),/detail|description|identity|location|India/i)
})

test('application code or selected role ID contradiction is fatal',async()=>{
 await assert.rejects(source.run({fetchText:async u=>u.includes('applynow.aspx')?application.replace('DD-01','DD-02'):nativeFetch(u)}),/application|identity/i)
 await assert.rejects(source.run({fetchText:async u=>u.includes('applynow.aspx')?application.replace('value="11"','value="12"'):nativeFetch(u)}),/application|identity/i)
})

test('new foreign detail handoff is rejected before requesting it',async()=>{
 const calls=[]
 await assert.rejects(source.run({fetchText:async u=>{calls.push(u);return careers.replace('careerdetail.aspx?mpgid=56&pgidtrail=56&jobid=11','https://example.com/careerdetail.aspx?jobid=11')}}),/first-party|official|detail/i)
 assert.deepEqual(calls,[source.CAREERS_URL])
})

test('literal and numerically aliased duplicate application IDs are fatal',async()=>{
 const start=careers.indexOf('<div class="accordion-item">'),end=careers.indexOf('View Detail</a>',start)+'View Detail</a>'.length
 const card=careers.slice(start,end)
 for(const changed of [card.replace('DD-01','DD-02'),card.replace('DD-01','DD-02').replace(/jobid=11/g,'jobid=011')])
  await assert.rejects(source.run({fetchText:async()=>careers.slice(0,end)+changed+careers.slice(end)}),/duplicate|identity/i)
})

test('abort before native fetch and between listing and detail is fatal',async()=>{
 const controller=new AbortController();controller.abort(new DOMException('stop','AbortError'))
 await assert.rejects(source.run({signal:controller.signal,fetchText:async()=>{assert.fail('must not fetch')}}),/stop/)
 const second=new AbortController()
 await assert.rejects(source.run({signal:second.signal,fetchText:async()=>{second.abort(new DOMException('stop midway','AbortError'));return careers}}),/stop midway/)
})

const mockGet=(status=200,headers={},body='native',capture=()=>{})=>(url,opts,callback)=>{
 capture(url,opts)
 const request=new EventEmitter();request.destroy=e=>{if(e)queueMicrotask(()=>request.emit('error',e))}
 queueMicrotask(()=>{const response=Readable.from([body]);response.statusCode=status;response.headers=headers;callback(response)})
 return request
}

test('chain completion keeps the existing root and mandatory full-chain/hostname checks',async()=>{
 let options
 const fetchText=source.createOkinawaFetchText({roots:[anchor],crossCertificate:cross,now,get:mockGet(200,{},'native',(_,o)=>options=o)})
 assert.equal(await fetchText(source.CAREERS_URL),'native')
 assert.equal(options.rejectUnauthorized,true)
 assert.equal(options.allowPartialTrustChain,false)
 assert.equal(options.servername,'okinawascooters.com')
 assert.ok(options.ca.includes(anchor));assert.ok(options.ca.includes(cross))
 assert.equal(options.checkServerIdentity,undefined)
 assert.equal(Object.hasOwn(options.headers,'signal'),false)
})

test('missing trusted anchor, replacement root, corrupt cross and expiry fail before transport',async()=>{
 for(const options of [{roots:[]},{roots:[cross]},{roots:[anchor],crossCertificate:anchor},{roots:[anchor],crossCertificate:cross.replace('MI','XX')},{roots:[anchor],now:()=>new Date('2038-01-01')}]){
  assert.throws(()=>source.createOkinawaFetchText({crossCertificate:cross,now,...options,get:()=>assert.fail('must not request')}),/certificate|anchor|chain|expired|valid/i)
 }
})

test('foreign host and off-authority redirect are fatal',async()=>{
 const fetchText=source.createOkinawaFetchText({roots:[anchor],crossCertificate:cross,now,get:mockGet(302,{location:'https://example.com/career'})})
 await assert.rejects(fetchText('https://example.com/career'),/official|authority|host/i)
 await assert.rejects(fetchText(source.CAREERS_URL),/redirect/i)
})

test('strict transport rejects caller abort and HTTP server failure',async()=>{
 const c=new AbortController();c.abort(new DOMException('caller cancelled','AbortError'))
 const fetchText=source.createOkinawaFetchText({roots:[anchor],crossCertificate:cross,now,get:mockGet(503)})
 await assert.rejects(fetchText(source.CAREERS_URL,{signal:c.signal}),/caller cancelled/)
 await assert.rejects(fetchText(source.CAREERS_URL),/HTTP 503/)
})


test('cancellation during a pending native request stops without a result',async()=>{
 const c=new AbortController();let destroyed=false
 const get=()=>{const req=new EventEmitter();req.destroy=()=>{destroyed=true};return req}
 const fetchText=source.createOkinawaFetchText({roots:[anchor],crossCertificate:cross,now,get})
 const pending=fetchText(source.CAREERS_URL,{signal:c.signal})
 c.abort(new DOMException('cancel in flight','AbortError'))
 await assert.rejects(pending,/cancel in flight/)
 assert.equal(destroyed,true)
})


test('application GET or missing native multipart form cannot establish active application proof',async()=>{
 for(const changed of [application.replace('method="post"','method="get"'),application.replace('enctype="multipart/form-data"','enctype="text/plain"')])
  await assert.rejects(source.run({fetchText:async u=>u.includes('applynow.aspx')?changed:nativeFetch(u)}),/application|identity|form/i)
})
