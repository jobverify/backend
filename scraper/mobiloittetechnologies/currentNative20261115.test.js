import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,CAREERS_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
const ids=['JOB000021','JOB000020','JOB000013','JOB000010']
function transport(change=()=>{}) {
  const calls=[]
  return {calls,fetchImpl:async(url,init={})=>{
    const packet=structuredClone(fixture.packets[String(url)])
    assert.ok(packet,'Unexpected public URL '+url)
    const call={url:String(url),init,ordinal:calls.filter(value=>value.url===String(url)).length+1};calls.push(call);change(packet,call)
    const response=new Response(packet.body,{status:packet.status,headers:{'Content-Type':packet.type}})
    Object.defineProperty(response,'url',{value:packet.url});return response
  }}
}
const execute=(change,options={})=>{const http=transport(change);return{...http,jobs:run({fetchImpl:http.fetchImpl,fetchText:async url=>(await http.fetchImpl(url)).text(),now:()=>fixture.capturedAt,...options})}}
const changeJob=(html,change)=>html.replace(/<script\b([^>]*type="application\/ld\+json"[^>]*)>([\s\S]*?)<\/script>/g,(all,attrs,body)=>{
  const data=JSON.parse(body),rows=data['@graph']||[data]
  for(const job of rows)if(job['@type']==='JobPosting')change(job)
  return '<script'+attrs+'>'+JSON.stringify(data)+'</script>'
})

test('Mobiloitte current own full roles retain typed India country, original locations and all visible criteria',async()=>{
  const result=execute(),jobs=await result.jobs
  assert.deepEqual(jobs.map(job=>job.jobId),ids)
  assert.ok(jobs.every(job=>job.company==='Mobiloitte Technologies'&&job.country==='India'&&job.jobDescription.length>1500
    &&job.sourceScopeComplete===false&&job.sourceListingComplete===false&&job.lifecycleCleanupAllowed===false))
  assert.equal(jobs[0].city,null)
  assert.equal(jobs[0].nativeJobPosting.jobLocation.address.addressLocality,'Remote')
  assert.match(jobs[0].jobDescription,/Technical Skills/)
  assert.match(jobs[0].jobDescription,/Lead Level/)
  assert.equal(jobs[0].nativeJobPosting.description.length,3377)
  assert.equal(jobs[0].sourceOfficialBinding.legalEmployer,'Mobiloitte Technologies India Pvt. Ltd.')
  assert.equal(jobs[0].nativeEmployer,'Mobiloitte')
  assert.equal(result.calls.filter(call=>/\/careers\/JOB/.test(call.url)).length,8)
  assert.equal(result.calls.filter(call=>call.url===CAREERS_URL).length,2)
  assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('Mobiloitte own role schema, native country and source-local employer bindings fail closed',async t=>{
  const mutations={
    'wrong employer':job=>{job.hiringOrganization.name='Other Company'},
    'wrong employer id':job=>{job.hiringOrganization['@id']='https://other.example/#organization'},
    'nested employer context':job=>{job.hiringOrganization['@context']='https://other.example/context'},
    'foreign country':job=>{job.jobLocation.address.addressCountry='US'},
    'missing country':job=>{delete job.jobLocation.address.addressCountry},
    'nested address context':job=>{job.jobLocation.address['@context']='https://other.example/context'},
    'wrong role URL':job=>{job.url='https://www.mobiloitte.com/careers/JOB999999'},
    'different title':job=>{job.title='Unrelated title'},
    'expired role':job=>{job.validThrough='2020-01-01T00:00:00.000Z'},
    'future date':job=>{job.datePosted='2099-01-01T00:00:00.000Z'},
    'blank JD':job=>{job.description=''},
    'teaser JD':job=>{job.description='A short listing teaser without the full native role criteria.'},
  }
  for(const[label,change]of Object.entries(mutations))await t.test(label,async()=>{
    const result=execute(packet=>{if(packet.url.includes('/careers/JOB'))packet.body=changeJob(packet.body,change)})
    await assert.rejects(result.jobs,/employer|country|context|role|title|expired|date|description|criteria|schema/i)
  })
})

test('Mobiloitte only visible own role content and exact canonical/legal heading can qualify schema',async t=>{
  for(const mode of['canonical','legal-heading','hidden-description','css-hidden','inert-schema'])await t.test(mode,async()=>{
    const result=execute(packet=>{
      if(!packet.url.includes('/careers/JOB'))return
      if(mode==='canonical')packet.body=packet.body.replace('rel="canonical" href="'+packet.url+'"','rel="canonical" href="https://other.example/job"')
      if(mode==='legal-heading')packet.body=packet.body.replaceAll('At Mobiloitte Technologies India Pvt. Ltd.','At Other Company')
      if(mode==='hidden-description')packet.body=packet.body.replace('content-section html-content','content-section html-content" hidden data-original="')
      if(mode==='css-hidden')packet.body+='<style>.html-content{display:none}</style>'
      if(mode==='inert-schema')packet.body=packet.body.replace(/<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g,match=>'<template>'+match+'</template>')
    })
    await assert.rejects(result.jobs,/canonical|heading|employer|visible|description|schema|criteria/i)
  })
})

test('Mobiloitte closing detail, listing and publisher changes reject all staged roles',async t=>{
  for(const mode of['detail','listing','publisher'])await t.test(mode,async()=>{
    const result=execute((packet,call)=>{
      if(call.ordinal!==2)return
      if(mode==='detail'&&packet.url.includes('/careers/JOB'))packet.body=changeJob(packet.body,job=>{job.jobLocation.address.addressCountry='US'})
      if(mode==='listing'&&packet.url===CAREERS_URL)packet.body=packet.body.replaceAll('/careers/JOB000021','/careers/JOB999999')
      if(mode==='publisher'&&packet.url==='https://www.mobiloitte.com/')packet.body=packet.body.replaceAll('"name":"Mobiloitte"','"name":"Other Company"')
    })
    await assert.rejects(result.jobs,/closing|country|publisher|identity|changed|listing/i)
  })
})

test('Mobiloitte literal no-jobs markers cannot establish current source or country zero',async()=>{
  const result=execute(packet=>{if(packet.url===CAREERS_URL)packet.body=packet.body.replaceAll(/href="\/careers\/JOB\d+"/g,'href="#"')+"<p>No Jobs Found</p><p>We couldn't find any jobs matching your criteria.</p>"})
  await assert.rejects(result.jobs,error=>{assert.equal(error.lifecycleCleanupAllowed,false);assert.equal(error.failureKind,'coverage_gap');return /empty|zero|role|unverified/i.test(error.message)})
})

test('Mobiloitte denied native HTTP remains unresolved without invoking a browser',async()=>{
  let browserCalls=0
  const result=execute(packet=>{if(packet.url===CAREERS_URL){packet.status=403;packet.body='Forbidden'}},{fetchBrowserText:async()=>{browserCalls++;return fixture.packets[CAREERS_URL].body}})
  await assert.rejects(result.jobs,/403/)
  assert.equal(browserCalls,0)
})

test('Mobiloitte active filled or unavailable notices contradict future-dated schema on both opening and closing reads',async t=>{
  for(const notice of['This position is filled.','This job is not available.','Applications for this role are closed.'])for(const closingOnly of[false,true])await t.test(notice+' closingOnly='+closingOnly,async()=>{
    let changes=0
    const result=execute((packet,call)=>{if(packet.url.endsWith('/JOB000021')&&(!closingOnly||call.ordinal===2)){
      packet.body=packet.body.replace(/<main\b(?=[^>]*id="main-content")[^>]*>/,value=>{changes++;return value+'<p>'+notice+'</p>'})
    }})
    await assert.rejects(result.jobs,/closed|filled|unavailable/i)
    assert.ok(changes>0)
  })
})

test('Mobiloitte hidden or inert unavailable examples cannot override own current native criteria',async()=>{
  const result=execute(packet=>{if(packet.url.endsWith('/JOB000021'))packet.body=packet.body.replace(/<main\b(?=[^>]*id="main-content")[^>]*>/,value=>value
    +'<template><p>This position is filled.</p></template><p hidden>This job is not available.</p><p style="display:none">Applications for this role are closed.</p>')})
  assert.equal((await result.jobs).length,4)
})

test('Mobiloitte new native schema criteria cannot be silently omitted from full visible criteria',async t=>{
  for(const field of['qualifications','responsibilities','skills','experienceRequirements','educationRequirements','physicalRequirement','jobBenefits'])await t.test(field,async()=>{
    await assert.rejects(execute(packet=>{if(packet.url.endsWith('/JOB000021'))packet.body=changeJob(packet.body,job=>{job[field]='An additional current minimum requirement: a PhD in cryptography.'})}).jobs,/schema.*(?:field|criteria|review)/i)
  })
})
