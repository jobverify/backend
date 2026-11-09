import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {runNativeLava, inspectLavaPayload, inspectLavaSurfaces, projectLavaRole, URLS} from './native.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=name=>readFileSync(new URL('./fixtures/'+name,import.meta.url),'utf8')
const files={about:'about.html',careers:'careers.html',listing:'listing.html',client:'joblist-client.js',detailClient:'details-client.js',applicationClient:'application-client.js',positions:'positions.json'}
const inputs=()=>new Map(Object.entries(files).map(([key,file])=>[URLS[key],Buffer.from(fixture(file))]))
const load=(data=inputs(),calls=[])=>async(url,init)=>{calls.push(url);assert.equal(init.method,'GET');assert.ok(data.has(url),url);return{status:200,url,headers:new Headers({'content-type':url.includes('/api/')?'application/json':url.includes('viewpdf')?'application/pdf':'text/plain'}),arrayBuffer:async()=>data.get(url)}}
const role=(id=101)=>({id,designation:'Software Engineer',alm:{name:'Noida, India'},adm:{department_name:'Engineering'},experience_year:3})
const detail=(id=101)=>({id,designation:'Software Engineer',location_name:'Noida, India',department_name:'Engineering',experience_year:3,rff_number:'RRF_'+id,job_desc:'unused-native-filename.pdf'})
const pdfText='Lava International Limited\nSoftware Engineer\nLocation: Noida, India\nResponsibilities: Build reliable products and own production systems.\nRequirements: Strong SQL, testing and JavaScript experience.\nBenefits: Learning and health cover.'
const pdfBuffer=text=>{
 const lines=text.split('\n').map(s=>'('+s.replace(/[\\()]/g,'\\$&')+') Tj\n0 -16 Td').join('\n')
 const stream='BT\n/F1 10 Tf\n40 750 Td\n'+lines+'\nET'
 const objects=['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,'<< /Type /Page /Parent 4 0 R /MediaBox [0 0 612 792] /Contents 2 0 R /Resources << /Font << /F1 1 0 R >> >> >>','<< /Type /Pages /Count 1 /Kids [3 0 R] >>','<< /Type /Catalog /Pages 4 0 R >>']
 let pdf='%PDF-1.4\n';const offsets=[0]
 for(let i=0;i<objects.length;i++){offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`}
 const xref=pdf.length;pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 5 0 R >>\nstartxref\n'+xref+'\n%%EOF'
 return Buffer.from(pdf)
}
const nativeRoles=(rows=[role()],details=[detail()],texts=[pdfText],realPdf=false)=>{
 const data=inputs();data.set(URLS.positions,Buffer.from(JSON.stringify(rows)))
 rows.forEach((r,i)=>{data.set('https://www.lavamobiles.com/api/openpositionsingleview?id='+r.id,Buffer.from(JSON.stringify(details[i])));data.set('https://empower.indlava.com/openpositions/viewpdf/'+r.id,realPdf?pdfBuffer(texts[i]):Buffer.from('%PDF-'+texts[i]))})
 return{data,...(realPdf?{}:{extractPdfText:async b=>b.subarray(5).toString('utf8')})}
}
test('current native empty board is fetched twice and proves zero only after closing snapshots',async()=>{
 const calls=[],jobs=await runNativeLava({fetchPage:load(inputs(),calls),requestIntervalMs:0})
 assert.equal(jobs.length,0);assert.equal(calls.length,14)
 assert.equal(readInventoryEvidence(jobs).status,'verified-empty')
 assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 assert.equal(jobs.nativeInventoryEvidence.nativeGlobalCount,0)
 assert.equal(jobs.nativeInventoryEvidence.indiaAbsenceProven,true)
})
test('HTTP500 cannot become verified empty and is never retried',async()=>{
 let count=0;const fetchPage=load();await assert.rejects(runNativeLava({requestIntervalMs:0,fetchPage:async(u,o)=>{count++;return u===URLS.positions?{status:500}:fetchPage(u,o)}}),error=>error.status===500&&error.abortRetries===true&&/HTTP 500/.test(error.message))
 assert.equal(count,7)
})
test('first access denial stops immediately',async()=>{let calls=0;await assert.rejects(runNativeLava({fetchPage:async()=>{calls++;return{status:403}}}),/HTTP 403/);assert.equal(calls,1)})
test('reviewed current clients are required rather than trusting zero-looking server text',()=>{
 const surface=Object.fromEntries(Object.entries(files).filter(([k])=>k!=='positions').map(([k,v])=>[k,fixture(v)]))
 assert.equal(inspectLavaSurfaces(surface).employer,'Lava International Limited')
 assert.throws(()=>inspectLavaSurfaces({...surface,client:surface.client+';'}),/client/i)
 assert.throws(()=>inspectLavaSurfaces({...surface,detailClient:surface.detailClient+';'}),/client/i)
})
test('duplicate and malformed listing identities are rejected',()=>{
 assert.throws(()=>inspectLavaPayload([role(),role()]),/duplicate/)
 assert.throws(()=>inspectLavaPayload({data:[]}),/array/)
 assert.throws(()=>inspectLavaPayload([{...role(),designation:''}]),/title/)
})
test('current native PDF role projection preserves full criteria and actual native requisition',()=>{
 const j=projectLavaRole(role(),detail(),pdfText,'2026-10-27T00:00:00Z')
 assert.equal(j.jobDescription,pdfText);assert.equal(j.requisitionId,'RRF_101')
 assert.equal(j.country,'India');assert.equal(j.postingDate,null);assert.equal(j.closingDate,null)
 assert.equal(j.remoteStatus,null);assert.equal(j.employmentType,null)
 assert.equal(j.applicationContext.nativePostingId,101);assert.equal(j.applicationSubmitted,false)
})
test('registered native workflow extracts a real synthetic PDF without losing final criteria',async()=>{
 const state=nativeRoles(undefined,undefined,undefined,true),calls=[]
 const jobs=await runNativeLava({fetchPage:load(state.data,calls),requestIntervalMs:0})
 assert.equal(calls.length,18);assert.equal(jobs.length,1)
 assert.match(jobs[0].jobDescription,/Requirements: Strong SQL/);assert.match(jobs[0].jobDescription,/Benefits: Learning and health cover/)
 assert.equal(readInventoryEvidence(jobs).status,'complete-inventory');assert.equal(jobs[0].requisitionId,'RRF_101')
})
test('all global details and PDFs precede caps; unknown geography retains partial scope',async()=>{
 const rows=[role(),{...role(102),alm:{name:'Noida'}}],details=[detail(),{...detail(102),location_name:'Noida'}]
 const state=nativeRoles(rows,details,[pdfText,pdfText.replace('Location: Noida, India','Location: Noida')]),calls=[]
 const jobs=await runNativeLava({fetchPage:load(state.data,calls),extractPdfText:state.extractPdfText,requestIntervalMs:0,maxJobs:0})
 assert.equal(calls.length,22);assert.equal(jobs.length,0);assert.equal(jobs.nativeInventoryEvidence.nativeIndiaCount,1)
 assert.equal(jobs.nativeInventoryEvidence.unknownCountryCount,1);assert.equal(jobs.nativeInventoryEvidence.fullNativeDescriptionCount,2)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(jobs.nativeInventoryEvidence.lifecycleCleanupAllowed,false)
})
test('a complete foreign inventory is distinct from a globally empty board',async()=>{
 const state=nativeRoles([{...role(),alm:{name:'Singapore'}}],[{...detail(),location_name:'Singapore'}],[pdfText.replace('Location: Noida, India','Location: Singapore')])
 const jobs=await runNativeLava({fetchPage:load(state.data),extractPdfText:state.extractPdfText,requestIntervalMs:0})
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).status,'complete-inventory')
 assert.equal(readInventoryEvidence(jobs).reportedTotal,1);assert.equal(jobs.nativeInventoryEvidence.foreignCountryCount,1)
})
test('job country is not inferred from city or the employer country in PDF',()=>{
 const r={...role(),alm:{name:'Noida'}},d={...detail(),location_name:'Noida'}
 const j=projectLavaRole(r,d,pdfText.replace('Location: Noida, India','Location: Noida'),'2026-10-27T00:00:00Z')
 assert.equal(j.country,null)
 assert.equal(projectLavaRole(r,d,pdfText.replace('Location: Noida, India','Company address:\nCountry: India'),'2026-10-27T00:00:00Z').country,null)
 assert.equal(projectLavaRole(r,d,pdfText.replace('Location: Noida, India','Interview address:\nLocation: India'),'2026-10-27T00:00:00Z').country,null)
 assert.equal(projectLavaRole(r,d,pdfText.replace('Location: Noida, India','Job location: Noida, India'),'2026-10-27T00:00:00Z').country,'India')
})
test('explicit foreign country and conflicting native country remain distinct from India',()=>{
 const r={...role(),alm:{name:'Singapore'}},d={...detail(),location_name:'Singapore'}
 assert.equal(projectLavaRole(r,d,pdfText.replace('Location: Noida, India','Location: Singapore'),'2026-10-27T00:00:00Z').country,'Singapore')
 assert.equal(projectLavaRole(role(),detail(),pdfText.replace('Location: Noida, India','Location: Singapore'),'2026-10-27T00:00:00Z').country,null)
})
for(const change of [{id:102},{designation:'Different title'},{location_name:'Dubai'},{department_name:'Sales'},{rff_number:'RRF_102'}])test('list/detail identity mismatch fails '+JSON.stringify(change),()=>assert.throws(()=>projectLavaRole(role(),{...detail(),...change},pdfText,'2026-10-27T00:00:00Z'),/identity/))
test('PDF employer and role title must match the currently advertised record',()=>{
 assert.throws(()=>projectLavaRole(role(),detail(),pdfText.replace('Lava International Limited','Other Employer'),'2026-10-27T00:00:00Z'),/PDF/)
 assert.throws(()=>projectLavaRole(role(),detail(),pdfText.replace('Software Engineer','Sales Manager'),'2026-10-27T00:00:00Z'),/PDF/)
})
test('a newly advertised additional hiring surface retains partial evidence',async()=>{
 const data=inputs();data.set(URLS.careers,Buffer.from(fixture('careers.html').replace('</body>','<a href="https://other.example/jobs">Other jobs</a></body>')))
 const jobs=await runNativeLava({fetchPage:load(data),requestIntervalMs:0})
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
})
test('closing list drift prevents an authoritative zero',async()=>{
 let n=0;const fetchPage=load();await assert.rejects(runNativeLava({requestIntervalMs:0,fetchPage:async(u,o)=>{const r=await fetchPage(u,o);if(u===URLS.positions&&++n===2)r.arrayBuffer=async()=>Buffer.from(JSON.stringify([role()]));return r}}),/closing/)
})
test('cancellation during final body read cannot publish results',async()=>{
 const a=new AbortController();let n=0;const fetchPage=load();await assert.rejects(runNativeLava({requestIntervalMs:0,signal:a.signal,fetchPage:async(u,o)=>{const r=await fetchPage(u,o);if(u===URLS.positions&&++n===2)r.arrayBuffer=async()=>{a.abort();return Buffer.from('[]')};return r}}))
})
test('invalid caller caps and pre-aborted runs make no requests',async()=>{
 await assert.rejects(runNativeLava({maxJobs:-1}),/cap/)
 let n=0;const a=new AbortController();a.abort();await assert.rejects(runNativeLava({signal:a.signal,fetchPage:async()=>{n++}}));assert.equal(n,0)
})
