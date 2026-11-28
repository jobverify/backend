import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readAccount,readCorporate,readModernShell,readJob,API_ACCOUNT,CAREERS} from './nativeData20261121.js'
import {runCurrentValutico} from './currentNative20261121.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-compensation-20261128.json.gz',import.meta.url))))
const plain=row=>Buffer.from(row.bodyBase64,'base64').toString('utf8'),rows=new Map()
for(const row of fixture.responses){if(!rows.has(row.requestedUrl))rows.set(row.requestedUrl,[]);rows.get(row.requestedUrl).push(row)}
const account=readAccount(plain(rows.get(API_ACCOUNT)[0])),career=readCorporate(plain(rows.get(CAREERS)[0]),CAREERS)
const jobRows=new Map()
for(const row of fixture.responses.filter(row=>row.requestedUrl.includes('/api/v2/accounts/valutico-2/jobs/'))){const id=JSON.parse(plain(row)).id;if(!jobRows.has(id))jobRows.set(id,[]);jobRows.get(id).push(row)}
function native(id,index=0){const row=jobRows.get(id)[index],raw=JSON.parse(plain(row)),card=career.cards.find(card=>card.legacyNativeId===id),shellRows=fixture.responses.filter(row=>row.requestedUrl.replace(/\/$/,'')==='https://apply.workable.com/valutico-2/j/'+raw.shortcode),shell=readModernShell(plain(shellRows[index]),shellRows[index].url,card);return{row,raw,card,shell}}
function read(id,change=()=>{},index=0){const {raw,card,shell}=native(id,index);change(raw);return{raw,value:readJob(JSON.stringify(raw),account,card,shell)}}
async function collect(edit=(url,body)=>body){const counts=new Map(),requests=[];const jobs=await runCurrentValutico({requestIntervalMs:0,fetchImpl:async(url,init)=>{
 assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');const n=counts.get(url)||0;counts.set(url,n+1);requests.push(String(url))
 const row=rows.get(String(url))?.[n];assert.ok(row,'Original separately captured entity '+url+' #'+n)
 const response=new Response(edit(String(url),plain(row),n),{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.url});return response
}});return{jobs,requests}}

test('genuine compensation fixture preserves all82 independently captured opening and closing bodies',()=>{
 assert.equal(fixture.synthetic,false);assert.equal(fixture.originalCapture,'captures/valuticoindia/after-current-protocol-20261128');assert.equal(fixture.responses.length,82)
 assert.equal(fixture.responses.reduce((n,row)=>n+row.bytes,0),4843450)
 for(const row of fixture.responses){const bytes=Buffer.from(row.bodyBase64,'base64');assert.equal(row.method,'GET');assert.equal(row.requestBody,null);assert.equal(bytes.length,row.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256)}
 for(const id of [6073929,6073939,6083001])assert.equal(jobRows.get(id).length,2)
})

for(const[id,from,to,currency,country]of [[6073929,35000,null,'EUR','United Kingdom'],[6073939,20000,30000,'USD','Chile'],[6083001,20000,30000,'USD','Turkey']])
test('actual native compensation for'+id+' is qualified and retained across the genuine pair without currency/country conversion',()=>{
 const observations=[read(id),read(id,()=>{},1)]
 for(const{raw,value}of observations){assert.equal(value.roleFactsQualified,true);assert.deepEqual(value.qualificationIssues,[]);assert.deepEqual(value.nativeJob,raw)
  assert.equal(value.nativeJob.salary_from,from);assert.equal(value.nativeJob.salary_to,to);assert.equal(Object.hasOwn(value.nativeJob,'salary_to'),true)
  assert.equal(value.nativeJob.salary_currency_iso_code,currency);assert.equal(value.nativeJob.salary_frequency,'year')
  assert.equal(value.nativeCountry,country);assert.equal(value.sourceCountryQualifiedForIndia,false);assert.equal(value.nativePublicationDate,raw.published)
  for(const key of ['description','requirements','benefits'])assert.ok(value.sourceDescription.includes(raw[key]))
 }
 assert.deepEqual(observations[0].value.nativeJob,observations[1].value.nativeJob)
})

test('an ordinary actual native DTO without compensation stays valid without invented salary fields',()=>{
 const{raw,value}=read(5856345);assert.equal(value.roleFactsQualified,true);assert.deepEqual(value.nativeJob,raw)
 for(const key of ['salary_from','salary_to','salary_currency_iso_code','salary_frequency'])assert.equal(Object.hasOwn(value.nativeJob,key),false)
})

for(const key of ['salary_from','salary_to','salary_currency_iso_code','salary_frequency'])test('a missing '+key+' holds the incomplete native group and preserves every remaining original value',()=>{
 assert.equal(read(6073939).value.roleFactsQualified,true);const{raw,value}=read(6073939,j=>{delete j[key]})
 assert.equal(value.roleFactsQualified,false);assert.equal(value.sourceCountryQualifiedForIndia,false);assert.deepEqual(value.nativeJob,raw)
})

for(const[name,change]of[
 ['string lower bound',j=>{j.salary_from='20000'}],['boolean lower bound',j=>{j.salary_from=true}],['null lower bound',j=>{j.salary_from=null}],
 ['object lower bound',j=>{j.salary_from={value:20000}}],['negative lower bound',j=>{j.salary_from=-1}],['zero lower bound',j=>{j.salary_from=0}],
 ['unreviewed fractional bound',j=>{j.salary_from=20000.5}],['unsafe integer bound',j=>{j.salary_from=Number.MAX_SAFE_INTEGER+1}],
 ['string upper bound',j=>{j.salary_to='30000'}],['boolean upper bound',j=>{j.salary_to=false}],['array upper bound',j=>{j.salary_to=[30000]}],
 ['negative upper bound',j=>{j.salary_to=-1}],['reversed range',j=>{j.salary_to=19999}],
 ['unreviewed currency',j=>{j.salary_currency_iso_code='INR'}],['invalid currency',j=>{j.salary_currency_iso_code='ZZZ'}],
 ['case-folded currency',j=>{j.salary_currency_iso_code='usd'}],['nonliteral currency',j=>{j.salary_currency_iso_code={value:'USD'}}],
 ['unreviewed frequency',j=>{j.salary_frequency='month'}],['case-folded frequency',j=>{j.salary_frequency='YEAR'}],['numeric frequency',j=>{j.salary_frequency=12}],
])test(name+' cannot qualify compensation or discard the original native group',()=>{
 assert.equal(read(6073939).value.roleFactsQualified,true);const{raw,value}=read(6073939,change)
 assert.equal(value.roleFactsQualified,false);assert.equal(value.sourceCountryQualifiedForIndia,false);assert.deepEqual(value.nativeJob,raw);assert.ok(value.qualificationIssues.includes('unqualified-native-compensation'))
})

test('a non-finite JSON numeric bound remains a held raw native observation',()=>{
 const{row,card,shell}=native(6073939);assert.equal(read(6073939).value.roleFactsQualified,true)
 const body=plain(row).replace('"salary_from":20000','"salary_from":1e309');assert.notEqual(body,plain(row))
 const value=readJob(body,account,card,shell);assert.equal(value.nativeJob.salary_from,Infinity);assert.equal(value.roleFactsQualified,false);assert.ok(value.qualificationIssues.includes('unqualified-native-compensation'))
})

for(const[name,change,issue]of[
 ['additional salary-related criteria',j=>{j.salary_conditions='A new mandatory native condition'},'unreviewed-native-fields'],
 ['unknown application field',j=>{j.screening_questions=[{required:true}]},'unreviewed-native-fields'],
 ['missing original authored criteria',j=>{j.description=null},'incomplete-native-authored-criteria'],
 ['unpublished role',j=>{j.state='draft'},'not-current-public-publication'],
 ['hidden native country alternative',j=>{j.locations[0].hidden=true},'unqualified-native-location'],
 ['contradictory India primary country',j=>{j.location.country='India';j.location.countryCode='IN'},'unqualified-native-location'],
])test('valid compensation cannot bypass '+name,()=>{
 assert.equal(read(6073939).value.roleFactsQualified,true);const{raw,value}=read(6073939,change)
 assert.deepEqual(value.nativeJob,raw);assert.equal(value.roleFactsQualified,false);assert.equal(value.sourceCountryQualifiedForIndia,false);assert.ok(value.qualificationIssues.includes(issue))
})

test('actual complete current cohort preserves all9 foreign native models while company/India inventory and cleanup remain held',async()=>{
 const{jobs,requests}=await collect(),audit=jobs.nativeCollectionEvidence
 assert.equal(requests.length,82);assert.equal(jobs.length,0);assert.equal(audit.nativeRoleObservations.length,9)
 assert.equal(audit.nativeRoleObservations.every(row=>row.roleFactsQualified),true);assert.equal(audit.nativeRoleObservations.some(row=>row.sourceCountryQualifiedForIndia),false)
 assert.equal(audit.wholeNativeRoleModelsClosingReconciled,true);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.companyGlobalTotal,null)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(audit.applicationInteractions,0);assert.equal(audit.applicationSubmissions,0);assert.equal(audit.browserExecution,false)
 for(const id of [6073929,6073939,6083001])assert.deepEqual(audit.nativeRoleObservations.find(o=>o.legacyNativeId===id).nativeJob,native(id).raw)
})

for(const[field,id,value]of [['salary_from',6073939,21000],['salary_to',6073929,45000],['salary_currency_iso_code',6073939,'EUR'],['salary_frequency',6073939,'month']])
test('a closing-only change to '+field+' cannot be normalized away or certify the captured cohort',async()=>{
 assert.equal(read(id).value.roleFactsQualified,true);let changed=false
 await assert.rejects(collect((url,body,n)=>{
  if(url!==jobRows.get(id)[0].requestedUrl||n!==1)return body;const raw=JSON.parse(body);raw[field]=value;changed=true;return JSON.stringify(raw)
 }),error=>{
  assert.match(error.message,/Whole current native account\/role\/criteria\/application models changed at closing/)
  const audit=error.nativeCollectionEvidence,opening=audit.opening.roles.find(row=>row.card.legacyNativeId===id).nativeJob,closing=audit.closing.roles.find(row=>row.card.legacyNativeId===id).nativeJob
  assert.deepEqual(opening,native(id).raw);assert.equal(closing[field],value);assert.equal(audit.wholeNativeRoleModelsClosingReconciled,false);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
  assert.ok(audit.rawPublisherResponses.some(row=>row.requestedURL===jobRows.get(id)[0].requestedUrl&&row.body.includes(JSON.stringify(value))));return true
 });assert.equal(changed,true)
})
