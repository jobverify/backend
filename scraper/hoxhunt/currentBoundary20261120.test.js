import test from 'node:test'
import assert from 'node:assert/strict'
import {fixture,replay,feed,native,BOARD,FEED} from './currentConfiguredBoard20261120.test.js'

// This entry imports the original 61 cases. Select this entry once, alongside
// the catalog entry, to avoid counting the imported cases a second time.
const originalFeed=JSON.parse(Buffer.from(fixture.responses.find(p=>p.requestedUrl===FEED).bodyBase64,'base64').toString()),first=originalFeed.jobs[0]
const closeFeed=op=>(q,url,n)=>{if(url===FEED&&n===1)q.text=op(q.text)}
async function held(change){let changed=false,error;try{await replay((q,u,n)=>{const before=JSON.stringify(q);change(q,u,n);changed ||= before!==JSON.stringify(q)})}catch(e){error=e}assert(changed,'Qualification control changed genuine current bytes');assert(error,'Contradictory native scope must not supply zero evidence');assert.equal(error.nativeContradiction,true);assert.equal(error.failureKind,'parser_or_contract_error')}

for(const field of['country','countryCode','jobCountry'])test('An additional primary native address '+field+' cannot hide India behind a foreign addressCountry',async()=>{await held(feed(r=>r.address.postalAddress[field]=field==='countryCode'?'IN':'India'))})
test('A native Country object cannot carry a conflicting code behind its foreign name',async()=>{await held(feed(r=>r.address.postalAddress.addressCountry={'@type':'Country',name:'Singapore',identifier:'IN'}))})
test('A nested native address employer cannot contradict the actual role publisher',async()=>{await held(feed(r=>r.address.postalAddress.employer='Other Employer'))})
test('An actual nested workplace withdrawal cannot be ignored by the foreign projection',async()=>{await held(feed(r=>r.address.postalAddress.isPublished=false))})

for(const [label,target,replacement]of[
 ['country','"addressCountry":"Singapore"','"addressCountry":"India","addressCountry":"Singapore"'],
 ['publication','"isListed":true','"isListed":false,"isListed":true']
])test('Duplicate decoded native feed '+label+' keys cannot discard contradictory originals',async()=>{await held(closeFeed(raw=>{const model=JSON.parse(raw),row=model.jobs.find(j=>j.id===first.id),before=JSON.stringify(row);assert.equal(before.split(target).length,2);const after=before.replace(target,replacement),serialized=JSON.stringify(model);assert.equal(serialized.split(before).length,2);return serialized.replace(before,after)}))})

test('Every same-workplace country alias can agree with the actual native foreign country',async()=>{const r=await replay(feed(row=>{const a=row.address.postalAddress;a.country=a.addressCountry;a.countryCode=a.addressCountry==='USA'?'US':a.addressCountry}));assert.equal(r.evidence.status,'complete-inventory')})
test('A consistent authored native USA country label remains a foreign current role',async()=>{const r=await replay((q,url,n)=>{if(url!==FEED||n!==1)return;const m=JSON.parse(q.text),row=m.jobs.find(j=>j.address.postalAddress.addressCountry==='USA');assert(row);row.country='USA';row.descriptionHtml='<div>Country: USA</div>';q.text=JSON.stringify(m)});assert.equal(r.evidence.status,'complete-inventory')})
test('A consistent typed Country name and code remain retained without a legal-employer claim',async()=>{const r=await replay(feed(row=>row.address.postalAddress.addressCountry={'@type':'https://schema.org/Country',name:'Singapore',identifier:'SG'}));assert.equal(r.evidence.status,'complete-inventory');assert.equal(r.audit.observations[1].rows.find(r=>r.id===first.id).originalRecord.address.postalAddress.addressCountry.identifier,'SG');assert.equal(r.audit.observations[1].authority.legalEmployer,null)})
test('A foreign country object with an unrelated schema context cannot qualify a native workplace',async()=>{await held(feed(row=>row.address.postalAddress.addressCountry={'@context':'https://other.invalid/schema','@type':'Country',name:'Singapore'}))})
test('A same-role JobPosting with a foreign context cannot define the empty projection',async()=>{await held(feed(row=>row.descriptionHtml='<script type="application/ld+json">'+JSON.stringify({'@context':'https://other.invalid/schema','@type':'JobPosting',title:row.title,url:row.jobUrl,hiringOrganization:{'@type':'Organization',name:'Hoxhunt'},jobLocation:{'@type':'Place',address:{'@type':'PostalAddress',addressCountry:'Singapore'}}})+'</script>'))})
test('A qualified native schema Organization URI remains a consistent foreign role',async()=>{const r=await replay(feed(row=>row.descriptionHtml='<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'JobPosting',title:row.title,url:row.jobUrl,hiringOrganization:{'@type':'https://schema.org/Organization',name:'Hoxhunt'},jobLocation:{'@type':'Place',address:{'@type':'PostalAddress',addressCountry:'Singapore',addressLocality:row.address.postalAddress.addressLocality}}})+'</script>'));assert.equal(r.evidence.status,'complete-inventory')})
test('Coherent object property order never acts as a current native release pin',async()=>{const r=await replay(native(model=>{model.organization=Object.fromEntries(Object.entries(model.organization).reverse());model.jobBoard=Object.fromEntries(Object.entries(model.jobBoard).reverse())}));assert.equal(r.evidence.status,'complete-inventory')})
test('The original account declaration remains paired and unchanged after every boundary case',()=>{assert.equal(BOARD,'https://jobs.ashbyhq.com/hoxhunt');assert.equal(originalFeed.jobs.length,11);assert.equal(first.address.postalAddress.addressCountry,'Singapore')})
