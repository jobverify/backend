import test from 'node:test'
import assert from 'node:assert/strict'
import {runCurrentAcsia as run,readCurrentAcsiaModel} from './currentNative20261117.js'
import {fixture,recordedBody,replayOptions} from './fixture20261120.js'
const body=recordedBody(fixture.responses[0]).toString()
for(const schema of [{'@type':'JobPosting',datePosted:'2020-01-01'},{'@graph':[{'@type':'JobPosting',validThrough:'2020-01-01'}]},[{'@type':['https://schema.org/JobPosting'],applicantLocationRequirements:{name:'Canada'}}]])test('new authoritative native JobPosting fields require review instead of disappearing from country/date facts: '+JSON.stringify(schema),async()=>{
 const html=body.replace('</head>','<script type="application/ld+json">'+JSON.stringify(schema)+'</script></head>');assert.notEqual(html,body)
 await assert.rejects(run(replayOptions({},()=>html)),/JobPosting|authoritative/i)
})
for(const variant of ['disabled','foreign-action'])test('shared native application '+variant+' is an actual hold independently of browser execution',async()=>{
 const html=body.replace(/(<form\b[^>]*id="brxe-xwjkny")/, '$1 '+(variant==='disabled'?'aria-disabled="true"':'action="https://different-employer.example/apply"'));assert.notEqual(html,body)
 await assert.rejects(run(replayOptions({},()=>html)),/intake|application/i)
})

for(const [kind,labels]of [['country',['India','United States']],['country',['India','India']],['employer',['Acsia Technologies','Different Employer']],['employer',['Acsia Technologies','Acsia Technologies']]])test('duplicate '+kind+' labels remain fully retained and held even when equal: '+labels.join('/'),async()=>{
 const first=readCurrentAcsiaModel(body).rows[0],marker='class='+JSON.stringify(first.nativeContent.attrs.class)+'>',label=kind==='country'?'Country':'Employer',html=body.replace(marker,marker+labels.map(value=>'<p>'+label+': '+value+'</p>').join(''));assert.notEqual(html,body)
 const jobs=await run(replayOptions({},()=>html));assert.equal(jobs.length,14);const row=jobs.nativeCollectionEvidence.observations[0];assert.equal(row.sourceRoleQualified,false);assert.deepEqual(kind==='country'?row.sourceNativeCountryLabels:row.sourceNativeEmployerLabels,labels);assert.ok(row.holdReasons.some(reason=>reason.includes('ambiguous-native-role-'+kind)))
})
