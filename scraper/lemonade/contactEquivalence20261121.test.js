import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {run} from './script.js'
import {HOME,CAREER,CLIENT} from './nativeTransport20261121.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/contact-originals-20261121.json.gz',import.meta.url))))
const rows=new Map(fixture.responses.map(row=>[row.requestedURL,row])),provider=getScraperCatalog().find(row=>row.source==='lemonade')
const text=row=>Buffer.from(row.bodyBase64,'base64').toString('utf8'),home=text(rows.get(HOME))
const cipher=home.match(/\bdata-cfemail="([a-f0-9]{44})"/)[1]
const placeholder=home.match(/\bdata-cfemail="[a-f0-9]{44}"[^>]*>([^<]*)<\/a>/)[1]
const decode=value=>{const bytes=Buffer.from(value,'hex');return Buffer.from([...bytes.subarray(1)].map(byte=>byte^bytes[0]))}
const recode=value=>{const bytes=decode(value),key=Buffer.from(value,'hex')[0]^0x7f;return Buffer.from([key,...bytes.map(byte=>byte^key)]).toString('hex')}
const rotated=recode(cipher),sha=value=>createHash('sha256').update(value).digest('hex')
assert.notEqual(rotated,cipher);assert.equal(sha(decode(rotated)),sha(decode(cipher)))
const fake=(mutate=(_url,body)=>body)=>{
 const requests=[]
 return{requests,fetchImpl:async(input,init={})=>{
  const url=String(input instanceof Request?input.url:input),row=rows.get(url);assert.ok(row,'Only retained exact native URLs may be requested')
  requests.push(url);assert.equal(init.method??'GET','GET');assert.equal(init.body??null,null);assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  const headers=new Headers(init.headers);assert.equal(headers.has('cookie'),false);assert.equal(headers.has('authorization'),false)
  return Object.defineProperty(new Response(mutate(url,text(row),requests.length),{status:row.status,headers:row.headers}),'url',{value:row.finalURL})
 }}
}
const direct=io=>run({fetchImpl:io.fetchImpl,requestIntervalMs:0})
const six=[HOME,CAREER,CLIENT,HOME,CAREER,CLIENT]

test('actual current full HOME original qualifies without changing the reviewed authored profile',async()=>{
 const io=fake(),jobs=await direct(io),audit=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,0);assert.deepEqual(io.requests,six)
 assert.equal(sha(audit.originalModels.opening.home.text),rows.get(HOME).sha256)
 assert.equal(audit.originalModels.opening.homeModel.carriers.find(row=>Object.hasOwn(row.attrs,'data-cfemail')).attrs['data-cfemail']===cipher,true)
 assert.equal(audit.rawWholeEntitiesEqual,true);assert.equal(audit.wholeModelClosingEqual,true)
 assert.equal(audit.contactProjectionClosingEqual,true)
 assert.equal(audit.contactRepresentations.opening.decodedSHA256,sha(decode(cipher)))
 assert.equal(audit.contactRepresentations.opening.decoderFetchedOrExecuted,false)
})

test('same contact encoded differently at closing keeps actual raw inequality and complete projected equality',async()=>{
 const io=fake((url,body,n)=>url===HOME&&n===4?body.replace(cipher,rotated):body),jobs=await direct(io),audit=jobs.nativeCollectionEvidence
 assert.deepEqual(io.requests,six);assert.equal(jobs.length,0)
 assert.equal(audit.rawWholeEntitiesEqual,false);assert.equal(audit.wholeModelClosingEqual,false);assert.equal(audit.contactProjectionClosingEqual,true)
 assert.equal(audit.originalModels.opening.home.text===audit.originalModels.closing.home.text,false)
 assert.equal(audit.originalModels.closing.home.text.includes(rotated),true)
 assert.equal(audit.contactRepresentations.opening.decodedSHA256,audit.contactRepresentations.closing.decodedSHA256)
 assert.equal(audit.contactRepresentations.opening.encodedSHA256===audit.contactRepresentations.closing.encodedSHA256,false)
})

test('registered no-options default closes the six retained entities and preserves unknown scope and cleanup hold',async t=>{
 const io=fake((url,body,n)=>url===HOME&&n===4?body.replace(cipher,rotated):body)
 t.mock.method(globalThis,'fetch',io.fetchImpl)
 const jobs=await createCatalogScraper(provider).run(),inventory=readInventoryEvidence(jobs),observation=readSourceObservationEvidence(jobs,'lemonade')
 assert.deepEqual(io.requests,six);assert.equal(jobs.length,0)
 assert.equal(inventory.status,'discovery-only');assert.equal(inventory.listingComplete,false);assert.equal(inventory.reportedTotal,null);assert.equal(inventory.indiaFacetCount,null)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(inventory.lifecycleCleanupAllowed,false)
 assert.equal(observation.observedRecordCount,0);assert.equal(observation.observedVacancyCount,0);assert.equal(observation.sourceScopeComplete,false)
 assert.equal(observation.companyGlobalTotal,null);assert.equal(observation.companyIndiaTotal,null)
 assert.equal(jobs.nativeCollectionEvidence.configuredPublicCohortEmpty,true);assert.equal(jobs.nativeCollectionEvidence.rawWholeEntitiesEqual,false)
 assert.equal(jobs.nativeCollectionEvidence.contactProjectionClosingEqual,true);assert.equal(jobs.nativeCollectionEvidence.renderedVerified,false)
 assert.equal(jobs.nativeCollectionEvidence.activeApplyVerified,false)
})

for(const [name,mutate]of[
 ['different decoded contact',body=>body.replace(cipher,cipher.slice(0,-2)+(cipher.slice(-2)==='00'?'01':'00'))],
 ['nonhex encoded value',body=>body.replace(cipher,'z'+cipher.slice(1))],
 ['short encoded value',body=>body.replace(cipher,cipher.slice(2))],
 ['numeric entity in the encoded carrier',body=>body.replace(cipher,'&#'+cipher.charCodeAt(0)+';'+cipher.slice(1))],
 ['different selector class',body=>body.replace('class="__cf_email__"','class="public-email"')],
 ['hash-route href',body=>body.replace('href="/cdn-cgi/l/email-protection"','href="/cdn-cgi/l/email-protection#'+cipher+'"')],
 ['different placeholder',body=>body.replace(placeholder,'[contact&#160;protected]')],
 ['nested placeholder carrier',body=>body.replace(placeholder,'<span>'+placeholder+'</span>')],
 ['different footer context',body=>body.replace(/<footer\b/,'<aside').replace('</footer>','</aside>')],
 ['different decoder declaration',body=>body.replace('/cloudflare-static/email-decode.min.js','/cloudflare-static/email-decode-new.min.js')],
 ['inert decoder declaration',body=>body.replace('<script data-cfasync="false"','<script hidden data-cfasync="false"')],
 ['duplicate contact attribute',body=>body.replace('data-cfemail="'+cipher+'"','data-cfemail="'+cipher+'" data-cfemail="'+cipher+'"')],
 ['duplicate decoder source',body=>body.replace('src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js"','src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js" src="/main.js"')],
 ['new native datum',body=>body.replace('class="__cf_email__"','class="__cf_email__" data-applicant-rule="certification"')],
 ['foreign namespace contact',body=>body.replace(/(<a\b[^>]*data-cfemail="[a-f0-9]{44}"[^>]*>[\s\S]*?<\/a>)/,'<svg>$1</svg>')],
 ['new authored hiring criterion',body=>body.replace('</body>','<div>Applicants must hold an additional certification.</div></body>')],
 ['new hidden role',body=>body.replace('</body>','<div hidden data-job-id="7">Engineer India Apply now</div></body>')],
 ['new declared handoff',body=>body.replace('</body>','<a href="https://new-board.example/jobs">Careers</a></body>')],
])test('protected-contact qualification holds '+name,async()=>{
 const mutated=mutate(home);assert.notEqual(mutated,home,'Actual-original mutation must change the fixture')
 const io=fake((url,body)=>url===HOME?mutated:body)
 await assert.rejects(direct(io),error=>error.failureKind==='parser_or_contract_error')
 assert.equal(io.requests.length,1)
})

test('noncontact raw HOME closing byte remains a hold after contact qualification',async()=>{
 const io=fake((url,body,n)=>url===HOME&&n===4?body.replace(cipher,rotated)+'\n':body)
 await assert.rejects(direct(io),error=>/closing model changed/.test(error.message))
 assert.deepEqual(io.requests,six)
})

test('registered current-original route cannot donate a new vacancy through fallback',async t=>{
 const io=fake((url,body)=>url===CAREER?body.replace('</body>','<article><h3>Engineer</h3><p>India</p><a href="/apply">Apply</a></article></body>'):body)
 t.mock.method(globalThis,'fetch',io.fetchImpl)
 await assert.rejects(createCatalogScraper(provider).run(),error=>error.failureKind==='parser_or_contract_error')
 assert.equal(io.requests.length,2)
})

for(const reason of[Object.freeze({caller:'protected-contact-close'}),null])test('exact caller reason survives current-contact final close: '+String(reason),async()=>{
 const caller=new AbortController(),io=fake((url,body,n)=>url===HOME&&n===4?body.replace(cipher,rotated):body)
 const fetchImpl=async(url,init)=>{init.signal.addEventListener('abort',()=>caller.abort(reason),{once:true});return io.fetchImpl(url,init)}
 let caught=Symbol('not thrown');try{await run({fetchImpl,signal:caller.signal,requestIntervalMs:0})}catch(error){caught=error}
 assert.equal(caught,reason)
})
