import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync,inflateSync,deflateSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import * as source from '../scraper/logelite/script.js'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {readCareers,readRole,makeJob} from '../scraper/logelite/nativeModels.js'
const f=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/logelite-native-quality.json.gz',import.meta.url))))
const careers='https://logelite.com/career/',phase=f.packets.map(q=>q.requestedURL),roles=phase.filter(u=>u!==careers&&u.includes('/career/')),pdfs=phase.filter(u=>u.endsWith('.pdf'))
const sha=v=>createHash('sha256').update(v).digest('hex')
async function replay(t,edit=()=>{},options={},registered=false){
 const calls=[],counts=new Map(),audits=[],fetchImpl=async(url,init={})=>{
  url=String(url);calls.push({url,init});const found=f.packets.find(q=>q.requestedURL===url)
  if(!found)throw Object.assign(Error('Uncaptured Logelite URL: '+url),{abortRetries:true})
  const q=structuredClone(found),n=(counts.get(url)||0)+1;counts.set(url,n);edit(q,n)
  const r=new Response(q.bodyBase64?Buffer.from(q.bodyBase64,'base64'):q.bodyText,{status:q.status,headers:q.headers});Object.defineProperty(r,'url',{value:q.finalURL});return r
 }
 t.mock.method(globalThis,'fetch',fetchImpl)
 const settings={fetchImpl,minIntervalMs:0,now:()=> '2026-11-05T21:00:00.000Z',...options,onAudit:async a=>{audits.push(a);await options.onAudit?.(a)}}
 let jobs,error;try{jobs=await(registered?createCatalogScraper(getScraperCatalog().find(p=>p.source==='logelite')).run(settings):source.run(settings))}catch(e){error=e}
 return {jobs,error,calls,audits}
}
test('Logelite fixture retains thirteen current original successful packets and all twelve PDF pages',()=>{
 assert.equal(f.packets.length,13);assert.equal(f.pdfModels.length,6);assert.equal(f.pdfModels.reduce((n,m)=>n+m.pdf.totalPages,0),12)
 for(const q of f.packets){const bytes=q.bodyBase64?Buffer.from(q.bodyBase64,'base64'):Buffer.from(q.bodyText);assert.equal(q.replayed,false);assert.equal(sha(bytes),q.bodySHA256);assert.equal(bytes.length,q.bodyBytes)}
})
test('Logelite registered route reads all six complete declared PDF descriptions and reconciles both original observations',async t=>{
 const {jobs,error,calls}=await replay(t,()=>{},{},true);assert.ifError(error);assert.equal(jobs.length,6)
 assert.ok(jobs.every(j=>j.sourceDetailComplete===true&&j.sourceDescription?.length>2500),'Complete native descriptions must replace short card previews')
 assert.deepEqual(calls.map(c=>c.url),[...phase,...phase]);assert.ok(jobs.every(j=>j.country==='India'&&j.nativeRoleClosingReconciled===true))
})
test('Logelite all second-page requirements, benefits and application instructions survive extraction',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error)
 for(const job of jobs){const original=f.pdfModels.find(m=>m.url===job.nativeSourceRecord.listing.pdfURL).pdf
  assert.equal(job.nativePDFDescription,original.text);assert.ok(job.sourceDescription.endsWith(original.text));assert.equal(job.nativeSourceRecord.pdf.pages.length,2)
  assert.ok(job.sourceDescription.includes(original.pages[1].text));assert.ok(job.sourceDescription.includes('To Apply:'))
 }
})
test('Logelite unknown native posting IDs, requisitions and dates are not filled from content IDs or upload paths',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error)
 for(const job of jobs){for(const field of ['jobId','requisitionId','postingDate','postedAt','closingDate','firstEverPublication','legalEmployer','state','minimumQualification','remoteStatus'])assert.equal(job[field],null,field)
  assert.match(job.nativeContentDocumentID,/^\d+$/);assert.equal(job.nativeCanonicalRoleURL,job.sourceUrl)
 }
})
test('Logelite native employment, shift, experience and advertised seats remain distinct',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error);assert.equal(jobs.reduce((n,j)=>n+j.numberOfOpenings,0),19)
 assert.equal(jobs[1].employmentType,'Full Time (Rotational Shift)');assert.equal(jobs[1].nativeExperienceLabel,'3 to 4 Years')
 assert.equal(jobs[3].nativeExperienceLabel,'1/2 to 1 Year');assert.ok(jobs[3].sourceDescription.includes('6 months to 1 year'))
 assert.ok(jobs.every(j=>j.experienceRequired===null&&j.compensation==='Subject to Interview'))
})
test('Logelite country comes from each full own PDF rather than a city or company address',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error)
 for(const job of jobs){assert.equal(job.country,'India');assert.equal(job.city,'Lucknow');assert.equal(job.location,'Lucknow, India')
  assert.equal(job.sourceWorksiteCountryProof.method,'declared-own-role-pdf-literal-work-location');assert.equal(job.sourceWorksiteCountryProof.literalRoleCountry,true)
  assert.equal(job.sourceWorksiteCountryProof.exactCampusEstablished,false);assert.equal(job.sourceWorksiteCountryProof.nativePDFLocationLabel,'Lucknow, India')
 }
})
test('Logelite declared shared application links are retained without visits, form interactions or email',async t=>{
 const {jobs,error,calls}=await replay(t);assert.ifError(error)
 for(const job of jobs){assert.equal(new URL(job.applyUrl).pathname,'/job-apply/');assert.equal(new URL(job.applyUrl).searchParams.get('apply_for'),job.title)
  assert.equal(job.applicationUrlIsGeneric,true);assert.equal(job.applicationVisited,false);assert.equal(job.activeApplyVerified,false);assert.equal(job.applicationFormSubmitted,false)
  assert.equal(job.nativeApplicationHandoff.formInteractedWith,false)
 }
 assert.ok(calls.every(c=>!c.url.includes('job-apply')&&!c.url.startsWith('mailto:')&&c.init.method==='GET'&&c.init.credentials==='omit'&&c.init.redirect==='manual'&&!c.init.body))
})
test('Logelite complete original opening/closing HTML and PDF bytes and renderer mappings are retained',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error)
 for(const job of jobs){for(const prefix of ['source','sourceClosing']){
  for(const field of ['RawNativeHTML','RawNativeCareersHTML'])assert.equal(sha(job[prefix+field]),job[prefix+field+'SHA256'])
  assert.equal(sha(Buffer.from(job[prefix+'RawNativePDFBase64'],'base64')),job[prefix+'RawNativePDFSHA256']);assert.ok(job[prefix+'NativePDFRendererAliases'].fonts.length>0)
 }
 assert.deepEqual(job.nativeSourceRecord,job.nativeClosingRecord);assert.ok(job.nativeSourceRecord.pdf.pages.every(p=>p.images.length===1))}
 assert.equal(jobs[0].sourceNativeCollectionAudit.responses.length,26)
})
test('Logelite complete company/listing totals and cleanup remain unqualified',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error);assert.ok(jobs.every(j=>!j.sourceScopeComplete&&!j.sourceListingComplete&&!j.lifecycleCleanupAllowed))
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
test('Logelite city-only or foreign native PDF country models cannot borrow publisher India',()=>{
 const careersModel=readCareers(f.packets[0].bodyText),row=careersModel.rows[0],role=readRole(f.packets[1].bodyText,row)
 for(const location of ['Lucknow','Lucknow, UNKNOWN','Lucknow, France']){
  const pdf=structuredClone(f.pdfModels[0].pdf);pdf.text=pdf.text.replace('Location: Lucknow, India','Location: '+location)
  const job=makeJob(row,role,pdf,careersModel,'2026-11-05T21:00:00.000Z');assert.equal(job.country,null);assert.equal(job.city,null);assert.equal(job.sourceDetailComplete,false)
  assert.equal(job.sourceCountryScopeUnresolved,true);assert.ok(job.sourceDescription.length>2500)
 }
})
for(const workplace of ['Job Location: Paris, France.','This role will be based in Berlin, Germany.','This role will be working in Germany.'])test('Logelite competing native PDF workplace withholds country: '+workplace,()=>{
 const careersModel=readCareers(f.packets[0].bodyText),row=careersModel.rows[0],role=readRole(f.packets[1].bodyText,row),pdf=structuredClone(f.pdfModels[0].pdf)
 pdf.text+='\n'+workplace;const job=makeJob(row,role,pdf,careersModel,'2026-11-05T21:00:00.000Z');assert.equal(job.country,null);assert.equal(job.sourceDetailComplete,false);assert.ok(job.sourceDescription.endsWith(workplace))
})
test('Logelite blank or summary-only PDF models cannot qualify as complete native criteria',()=>{
 const careersModel=readCareers(f.packets[0].bodyText),row=careersModel.rows[0],role=readRole(f.packets[1].bodyText,row),pdf=structuredClone(f.pdfModels[0].pdf)
 pdf.text='Job Role: Human Resource Executive\nLocation: Lucknow, India\nJob Type: Full Time\nSalary: Subject to Interview\nExperience: Fresher\n'+' '.repeat(1000)
 assert.throws(()=>makeJob(row,role,pdf,careersModel,'2026-11-05T21:00:00.000Z'),/publisher context|incomplete native PDF/)
})
const changeBody=(q,from,to)=>{const before=q.bodyText;q.bodyText=q.bodyText.replace(from,to);assert.notEqual(q.bodyText,before,'Native fixture mutation must change actual content')}
test('Logelite added mandatory own HTML content is included alongside the full native PDF',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===roles[0])changeBody(q,/(<div class="career-content">)/,'$1<p>Additional mandatory certification required.</p>')})
 assert.ifError(error);assert.equal(jobs.length,6);assert.ok(jobs[0].sourceDescription.includes('Additional mandatory certification required.'));assert.ok(jobs[0].sourceDescription.endsWith(jobs[0].nativePDFDescription))
})
test('Logelite mandatory text outside the original own card is retained in the whole role region',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===roles[0])changeBody(q,/(<div class="career-single-page-area[^>]*>)/,'<p>Mandatory professional registration is required.</p>$1')})
 assert.ifError(error);assert.ok(jobs[0].sourceDescription.includes('Mandatory professional registration is required.'));assert.equal(jobs[0].sourceDetailComplete,true)
})
test('Logelite a foreign workplace in own HTML cannot be ignored beside an India PDF',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===roles[0])changeBody(q,/(<div class="career-content">)/,'$1<p>Job Location: Paris, France.</p>')})
 assert.ifError(error);assert.equal(jobs[0].country,null);assert.equal(jobs[0].sourceDetailComplete,false);assert.ok(jobs[0].sourceDescription.includes('Paris, France'))
})
for(const addition of ['<p hidden>Mandatory eligibility not in the visible role</p>','<iframe src="https://unreviewed.example/criteria"></iframe>'])test('Logelite hidden or delegated own role content requires review: '+addition.slice(0,20),async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===roles[0])changeBody(q,/(<div class="career-content">)/,'$1'+addition)})
 assert.ok(!jobs);assert.ok(error);assert.equal(calls.length,2)
})
test('Logelite changed closing whole publisher context holds all contradicted observations before more reads',async t=>{
 const {jobs,error,calls,audits}=await replay(t,(q,n)=>{if(q.requestedURL===careers&&n===2)changeBody(q,'Total Openings 1','Total Openings 2')})
 assert.ok(!jobs);assert.ok(error);assert.equal(calls.length,14);assert.equal(audits[0].heldNativeRows.length,6)
 assert.ok(audits[0].heldNativeRows.every(r=>r.opening.bodyBase64&&r.closing.nativeRecord))
})
test('Logelite known closing role contradiction is held before a later PDF denial',async t=>{
 const {jobs,error,calls,audits}=await replay(t,(q,n)=>{
  if(q.requestedURL===roles[0]&&n===2)changeBody(q,/(<div class="career-content">)/,'$1<p>Additional mandatory certification required.</p>')
  if(q.requestedURL===pdfs[1]&&n===2)q.status=403
 })
 assert.ifError(error);assert.equal(jobs.length,5);assert.ok(!jobs.some(j=>j.sourceUrl===roles[0]));assert.equal(calls.length,17)
 assert.equal(calls.filter(c=>c.url===pdfs[0]).length,1);assert.equal(audits[0].heldNativeRows.length,1);assert.ok(jobs.every(j=>j.sourceDetailComplete===false))
})
test('Logelite changed closing PDF bytes retain both whole models and withhold the affected observation',async t=>{
 const {jobs,error,audits}=await replay(t,(q,n)=>{if(q.requestedURL===pdfs[0]&&n===2){const bytes=Buffer.concat([Buffer.from(q.bodyBase64,'base64'),Buffer.from('\n% changed original document bytes\n')]);q.bodyBase64=bytes.toString('base64');q.headers['content-length']=String(bytes.length)}})
 assert.ifError(error);assert.equal(jobs.length,5);assert.equal(audits[0].heldNativeRows.length,1)
 const held=audits[0].heldNativeRows[0];assert.ok(held.opening.nativeRecord.pdf.pages.length===2&&held.closing.nativeRecord.pdf.pages.length===2);assert.notEqual(held.opening.nativeRecord.pdf.sha256,held.closing.nativeRecord.pdf.sha256)
})
test('Logelite zero cap and exact pre-cancellation make no public requests',async t=>{
 const zero=await replay(t,()=>{},{maxJobs:0});assert.ifError(zero.error);assert.equal(zero.jobs.length,0);assert.equal(zero.calls.length,0)
 const reason=Error('Cancel Logelite before reads'),cancelled=await replay(t,()=>{},{signal:AbortSignal.abort(reason)});assert.equal(cancelled.error,reason);assert.equal(cancelled.calls.length,0)
})
test('Logelite positive result caps preserve full native reconciliation before slicing',async t=>{
 const {jobs,error,calls,audits}=await replay(t,()=>{},{maxJobs:1});assert.ifError(error);assert.equal(jobs.length,1);assert.equal(calls.length,26);assert.equal(audits[0].nativeRecords,6)
})
for(const status of [202,403,429])test('Logelite first HTTP '+status+' stops without retries or empty success',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===careers)q.status=status});assert.ok(!jobs);assert.ok(error);assert.equal(error.status,status);assert.equal(calls.length,1)
})
test('Logelite a later denial keeps earlier complete criteria partial and stops immediately',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===roles[1])q.status=403});assert.ifError(error);assert.equal(jobs.length,1);assert.equal(calls.length,4)
 assert.equal(jobs[0].sourceDetailComplete,false);assert.ok(jobs[0].sourceDescription.length>2500)
})
test('Logelite body-only transports and unsupported page caps are refused before reads',async t=>{
 for(const options of [{fetchText:async()=>f.packets[0].bodyText},{fetchBinary:async()=>Buffer.from(f.packets[2].bodyBase64,'base64')},{maxPages:1}]){
  const {jobs,error,calls}=await replay(t,()=>{},options);assert.ok(!jobs);assert.ok(error);assert.equal(calls.length,0)
 }
})
test('Logelite a pending audit callback honors exact cancellation once',async()=>{
 const controller=new AbortController(),reason=Error('Cancel pending Logelite audit');let started,release,count=0
 const ready=new Promise(resolve=>{started=resolve}),pending=source.run({maxJobs:0,signal:controller.signal,onAudit:()=>{count++;started();return new Promise(resolve=>{release=resolve})}})
 await ready;controller.abort(reason);const outcome=await Promise.race([pending.then(jobs=>({jobs}),error=>({error})),new Promise(resolve=>setTimeout(()=>resolve({timeout:true}),200))])
 release?.();await pending.catch(()=>{});assert.equal(outcome.error,reason);assert.equal(count,1)
})
test('Logelite a noncooperative fetch cannot block exact caller cancellation',async()=>{
 const controller=new AbortController(),reason=Error('Cancel noncooperative Logelite fetch');let started,release,calls=0
 const ready=new Promise(resolve=>{started=resolve}),pending=source.run({signal:controller.signal,minIntervalMs:0,fetchImpl:()=>{calls++;started();return new Promise(resolve=>{release=resolve})}})
 await ready;controller.abort(reason);const outcome=await Promise.race([pending.then(jobs=>({jobs}),error=>({error})),new Promise(resolve=>setTimeout(()=>resolve({timeout:true}),200))])
 const response=new Response(f.packets[0].bodyText,{headers:f.packets[0].headers});Object.defineProperty(response,'url',{value:careers});release(response);await pending.catch(()=>{})
 assert.equal(outcome.error,reason);assert.equal(calls,1)
})
function rewriteNativePDF(bytes,mutate){
 const input=bytes.toString('latin1'),matches=[...input.matchAll(/(\d+) (\d+) obj\b([\s\S]*?)endobj/g)],trailer=input.slice(input.lastIndexOf('trailer'),input.lastIndexOf('startxref'))
 assert.equal(matches.length,Number(/\/Size (\d+)/.exec(trailer)[1])-1)
 const objects=matches.map(match=>{
  const object=mutate(match[0],Number(match[1]))
  return {id:Number(match[1]),generation:Number(match[2]),bytes:Buffer.from(object+'\n','latin1')}
 })
 const parts=[Buffer.from(input.slice(0,matches[0].index),'latin1')],offsets=new Map();let offset=parts[0].length
 for(const object of objects){assert.equal(object.generation,0);offsets.set(object.id,offset);parts.push(object.bytes);offset+=object.bytes.length}
 const size=Math.max(...offsets.keys())+1,table=['xref','0 '+size,'0000000000 65535 f ']
 for(let id=1;id<size;id++)table.push(String(offsets.get(id)||0).padStart(10,'0')+' 00000 '+(offsets.has(id)?'n':'f')+' ')
 parts.push(Buffer.from(table.join('\n')+'\n'+trailer+'startxref\n'+offset+'\n%%EOF\n','latin1'));return Buffer.concat(parts)
}
function rewriteFlateStream(object,mutate){
 const stream=/stream\r?\n/.exec(object),size=Number(/\/Length (\d+)/.exec(object)[1]),start=stream.index+stream[0].length
 const packed=deflateSync(mutate(inflateSync(Buffer.from(object.slice(start,start+size),'latin1'))))
 return object.slice(0,start).replace(/\/Length \d+/,'/Length '+packed.length)+packed.toString('latin1')+object.slice(start+size)
}
function changedWatermarkPDF(bytes){
 let altered=false
 const result=rewriteNativePDF(bytes,object=>{if(!altered&&/\/Subtype\s*\/Image/.test(object)&&/\/ColorSpace\s*\/DeviceRGB/.test(object)){
  altered=true;return rewriteFlateStream(object,pixels=>{pixels[0]^=127;return pixels})
 }return object});assert.ok(altered);return result
}
test('Logelite a changed actual PDF watermark cannot hide new artwork or image-only criteria',async t=>{
 const mutated=changedWatermarkPDF(Buffer.from(f.packets[2].bodyBase64,'base64'))
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===pdfs[0]){q.bodyBase64=mutated.toString('base64');q.headers['content-length']=String(mutated.length)}})
 assert.ok(!jobs);assert.match(error?.message||'',/new PDF artwork\/criteria image/);assert.equal(calls.length,3)
})
test('Logelite factory and run options use the injected transport and current registered native strategy',async t=>{
 let reads=0;const fetchImpl=async url=>{reads++;const q=f.packets.find(q=>q.requestedURL===String(url));assert.ok(q);const r=new Response(q.bodyBase64?Buffer.from(q.bodyBase64,'base64'):q.bodyText,{headers:q.headers});Object.defineProperty(r,'url',{value:q.finalURL});return r}
 t.mock.method(globalThis,'fetch',()=>{throw Error('Factory injection ignored')})
 const factory=source.createLogeliteScraper({fetchImpl,minIntervalMs:0,maxJobs:1,now:()=> '2026-11-05T21:00:00.000Z'})
 assert.equal((await factory.run()).length,1);assert.equal(reads,26);assert.equal((await factory.run({maxJobs:0})).length,0);assert.equal(reads,26)
 assert.match(getScraperCatalog().find(p=>p.source==='logelite').extractionStrategy,/complete-declared-pdf-descriptions/)
})
test('Logelite a native UTF-8 BOM remains in both original HTML observations and their byte hashes',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.bodyText)q.bodyText='\uFEFF'+q.bodyText});assert.ifError(error)
 for(const job of jobs)for(const prefix of ['source','sourceClosing'])for(const field of ['RawNativeHTML','RawNativeCareersHTML']){
  assert.equal(job[prefix+field].codePointAt(0),0xFEFF);assert.equal(sha(job[prefix+field]),job[prefix+field+'SHA256'])
 }
})
test('Logelite vector-drawn mandatory PDF criteria require review even when all extracted text and watermark pixels are unchanged',async t=>{
 const bytes=Buffer.from(f.packets[2].bodyBase64,'base64'),raw=bytes.toString('latin1'),pages=[...raw.matchAll(/\d+ 0 obj\b([\s\S]*?)endobj/g)].filter(m=>/\/Type\s*\/Page\b/.test(m[1]))
 const pageTwoContent=Number(/\/Contents (\d+) 0 R/.exec(pages[1][1])[1])
 const glyphs={C:['0111','1000','1000','1000','1000','1000','0111'],P:['1110','1001','1001','1110','1000','1000','1000'],A:['0110','1001','1001','1111','1001','1001','1001'],R:['1110','1001','1001','1110','1010','1001','1001'],E:['1111','1000','1000','1110','1000','1000','1111'],Q:['0110','1001','1001','1001','1011','0110','0001'],U:['1001','1001','1001','1001','1001','1001','0110'],I:['111','010','010','010','010','010','111'],D:['1110','1001','1001','1001','1001','1001','1110']}
 const commands=['q','0 0 0 rg'];let x=72
 for(const letter of 'CPA REQUIRED'){if(letter===' '){x+=12;continue}for(let y=0;y<7;y++)for(let c=0;c<glyphs[letter][y].length;c++)if(glyphs[letter][y][c]==='1')commands.push((x+c*3)+' '+(240+(6-y)*3)+' 2.8 2.8 re f');x+=18}commands.push('Q')
 const mutant=rewriteNativePDF(bytes,(object,id)=>id===pageTwoContent?rewriteFlateStream(object,original=>Buffer.concat([original,Buffer.from('\n'+commands.join('\n')+'\n')])):object)
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===pdfs[0]){q.bodyBase64=mutant.toString('base64');q.headers['content-length']=String(mutant.length)}})
 assert.ok(!jobs);assert.ok(error);assert.equal(calls.length,3)
})
test('Logelite a PDF document OpenAction cannot be reported absent or qualify',async t=>{
 const mutant=rewriteNativePDF(Buffer.from(f.packets[2].bodyBase64,'base64'),object=>/\/Type\s*\/Catalog\b/.test(object)?object.replace(/\/Type\s*\/Catalog\b/,'/Type /Catalog\n/OpenAction << /S /Named /N /Print >>'):object)
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===pdfs[0]){q.bodyBase64=mutant.toString('base64');q.headers['content-length']=String(mutant.length)}})
 assert.ok(!jobs);assert.ok(error);assert.equal(calls.length,3)
})
for(const encoding of ['hidden-role','array-careers','iri-careers'])test('Logelite unreviewed JobPosting metadata cannot escape scope review through '+encoding,async t=>{
 const {jobs,error,calls}=await replay(t,q=>{
  if(encoding==='hidden-role'&&q.requestedURL===roles[0])changeBody(q,'</body>','<div hidden><script type="application/ld+json">{"@type":"JobPosting","jobLocation":{"address":{"addressCountry":"France"}}}</script></div></body>')
  if(encoding!=='hidden-role'&&q.requestedURL===careers)changeBody(q,/(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/,(_,a,b,c)=>{
   const value=JSON.parse(b);value['@graph'].push({'@type':encoding==='array-careers'?['JobPosting']:'https://schema.org/JobPosting',jobLocation:{address:{addressCountry:'France'}}});return a+JSON.stringify(value)+c
  })
 })
 assert.ok(!jobs);assert.ok(error);assert.equal(calls.length,encoding==='hidden-role'?2:1)
})
test('Logelite an operates-in native PDF placement cannot coexist with resolved India',()=>{
 const careersModel=readCareers(f.packets[0].bodyText),row=careersModel.rows[0],role=readRole(f.packets[1].bodyText,row),pdf=structuredClone(f.pdfModels[0].pdf)
 pdf.text+='\nThis role operates in Berlin, Germany.';const job=makeJob(row,role,pdf,careersModel,'2026-11-05T21:00:00.000Z')
 assert.equal(job.country,null);assert.equal(job.sourceCountryScopeUnresolved,true);assert.equal(job.sourceDetailComplete,false)
})
