import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import * as source from '../../scraper/lindeindia/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { loadCsodBranch } from '../../scraper/lindeindia/csod.js'

const fixture=name=>JSON.parse(readFileSync(new URL(`./fixtures/lindeindia/${name}.json`,import.meta.url)))
const html=name=>readFileSync(new URL(`./fixtures/lindeindia/${name}`,import.meta.url),'utf8')
const cloud='https://eu-fra.api.csod.com/rec-job-search/external/jobs'
const site='https://linde.csod.com/services/x/career-site/v1/careersites/25?cultureId=1'
const dictionary='https://linde.csod.com/services/x/core-customfields-service/v1/CustomFields?fieldIds=140&fieldIds=139&fieldIds=251&respectAvailablity=false&cultureId=1'
const homepage='<title>Linde in India | A Linde Company</title><a href="https://www.lindecareers.com/">Careers</a><a href="https://www.linde.com/">Corporate</a>'
const portal='<title>Candidate Portal</title><body class="candidate-portal"><app-root data-testid="src-index-app-root-page-1"></app-root><script src="main-3V5KPFGK.js"></script></body>'
const run=({mutate=()=>{},options={},empty=false,block=null}={})=>{
  const requests=[],pages=[]
  const promise=source.run({pageSize:25,maxPages:5,detailConcurrency:2,
    fetchPage:async(url,request={})=>{
      pages.push(url)
      let body=url===source.HOMEPAGE_URL?homepage:url===source.JOB_LOCATIONS_URL?html('locations-binding.html'):url===source.ENGINEERING_PORTAL_URL?portal:url===source.INDIA_GASES_URL?html('csod/gases-board.html'):url===source.INDIA_ITSC_URL?html('csod/itsc-board.html'):null
      if(body===null)throw Error(`Unexpected HTML role fetch: ${url}`)
      const response={status:url===source.ENGINEERING_PORTAL_URL?404:200,url,html:body}
      mutate('page',response,url)
      return response
    },
    fetchJson:async(url,request={})=>{
      requests.push({url,...request})
      let payload,kind
      if(url.endsWith('/cp/urlinfo')){kind='engineering-urlinfo';payload=fixture('urlinfo')}
      else if(url.endsWith('/cp/layout?isPreview=false')){kind='engineering-layout';payload=fixture('layout')}
      else if(url.startsWith(source.PORTAL_ORIGIN+'/api/cp/rest/altone/cp/jobs/v1')){kind='engineering-listing';payload=fixture('listing');payload.response=empty?[]:payload.response.slice(0,1);payload.totalRecords=payload.response.length}
      else if(url.includes('/cp/job/LEI_STM_1871499/')){kind='engineering-detail';payload=fixture('detail')}
      else if(url===site){kind='site';payload=fixture('csod/site')}
      else if(url===dictionary){kind='dictionary';payload=fixture('csod/legal-entities')}
      else if(url===cloud){
        assert.equal(request.method,'POST')
        const body=JSON.parse(request.body)
        assert.deepEqual(body.countryCodes,['in'])
        assert.equal(body.careerSiteId,25)
        assert.equal(body.careerSitePageId,25)
        assert.equal(body.cultureId,1)
        assert.equal(body.cultureName,'en-US')
        assert.deepEqual(body.customFieldDropdowns[0].id,251)
        const ids=body.customFieldDropdowns[0].options
        const branch=ids.includes(2266)?'itsc':'gases'
        assert.deepEqual(ids,branch==='itsc'?[2266]:[1375,1131,1132])
        kind=branch+'-listing';payload=fixture('csod/'+branch+'-listing')
        payload.data.requisitions=empty?[]:payload.data.requisitions.slice(0,1)
        payload.data.totalCount=payload.data.requisitions.length
      }else if(/\/services\/x\/job-requisition\/v2\/requisitions\/(33900|33395)\/jobDetails\?cultureId=1$/.test(url)){
        kind=url.includes('/33900/')?'gases-detail':'itsc-detail';payload=fixture('csod/'+kind)
      }else if(/\/Services\/API\/ATS\/CareerSite\/25\/JobRequisitions\/(33900|33395)\?useMobileAd=false&cultureId=1$/.test(url)){
        kind=url.includes('/33900?')?'gases-ad':'itsc-ad';payload=fixture('csod/'+kind)
      }else throw Error(`Unexpected Linde API: ${url}`)
      if(kind===block)throw Error('Controlled native branch unavailable: '+kind)
      mutate(kind,payload,url,request)
      return payload
    },...options,
  })
  return {promise,requests,pages}
}

test('Linde umbrella runtime reconciles Engineering, Gases and ITSC via native APIs before claiming full inventory',async()=>{
  const result=run();const jobs=await result.promise
  assert.deepEqual(jobs.map(j=>j.jobId).sort(),['33900','33395','LEI/STM/1871499'].sort())
  assert.ok(jobs.every(j=>j.sourceDescription&&j.country==='India'&&j.sourceListingComplete))
  assert.equal(jobs.find(j=>j.jobId==='33900').postingDate,'2026-10-22T00:00:00.000Z')
  assert.equal(jobs.find(j=>j.jobId==='33900').closingDate,'2026-11-23T00:00:00.000Z')
  assert.equal(jobs.find(j=>j.jobId==='33395').postingDate,'2026-09-18T00:00:00.000Z')
  assert.equal(jobs.find(j=>j.jobId==='33395').closingDate,null)
  assert.equal(jobs.find(j=>j.jobId==='33395').sourceClosingDateIsExact,false)
  assert.match(jobs.find(j=>j.jobId==='33900').jobDescription,/Linde South Asia Services Pvt\. Ltd\./)
  assert.match(jobs.find(j=>j.jobId==='33395').jobDescription,/Linde Global Support Services Pvt\. Ltd/)
  assert.equal(readInventoryEvidence(jobs)?.status,'complete-inventory')
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal,3)
  assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount,3)
  assert.equal(result.requests.filter(r=>r.url===cloud).length,2)
  assert.ok(result.requests.filter(r=>r.url.includes('csod.com')).every(r=>r.headers.Authorization==='Bearer REDACTED_PUBLIC_CONTEXT_TOKEN'))
  assert.equal(result.pages.some(url=>url.includes('/requisition/')),false)
})

test('a complete empty Linde India proof requires successful empty responses from all three native scopes',async()=>{
  const jobs=await run({empty:true}).promise
  assert.deepEqual(jobs,[])
  assert.equal(readInventoryEvidence(jobs)?.status,'verified-empty')
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal,0)
})

test('a missing Gases scope leaves whole-company coverage open even when other native scopes are verified empty',async()=>{
  const jobs=await run({empty:true,block:'gases-listing'}).promise
  assert.deepEqual(jobs,[])
  assert.equal(readInventoryEvidence(jobs)?.status,'coverage-gap')
  assert.equal(readInventoryEvidence(jobs)?.listingComplete,false)
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal,null)
  assert.match(readInventoryEvidence(jobs)?.reason,/gases/i)
})

test('CSOD identity, India, state and employer mismatches cannot be promoted as verified Gases content',async()=>{
  for(const change of [
    ['gases-detail',p=>{p.data.ref='req1'}],['gases-detail',p=>{p.data.displayTitle='Other role'}],
    ['gases-detail',p=>{p.data.primaryLocation.country='US'}],['gases-detail',p=>{p.data.primaryLocation.city='Delhi'}],
    ['gases-detail',p=>{p.data.allowApply=false}],['gases-detail',p=>{p.data.requisitionStatusId=4}],
    ['gases-ad',p=>{p.data[0].items[0].fields.id=1}],['gases-ad',p=>{p.data[0].items[0].fields.reqId='req1'}],
    ['gases-ad',p=>{p.data[0].items[0].fields.ad=p.data[0].items[0].fields.ad.replaceAll('Linde South Asia Services Pvt. Ltd.','Linde Global Support Services Pvt. Ltd')}],
  ]){
    const jobs=await run({mutate:(kind,p)=>{if(kind===change[0])change[1](p)}}).promise
    assert.ok(jobs.some(j=>j.jobId==='33395'),'Valid ITSC content must remain available')
    assert.equal(jobs.some(j=>j.jobId==='33900'),false)
    assert.notEqual(readInventoryEvidence(jobs)?.status,'complete-inventory')
  }
})

test('CSOD rejects empty or substituted native ads and invalid US calendar dates without inventing timestamps',async()=>{
  for(const change of [
    ['gases-ad',p=>{p.data[0].items[0].fields.ad='<p>Apply now</p>'}],
    ['gases-ad',p=>{p.data[0].items[0].fields.ad=p.data[0].items[0].fields.ad.replaceAll('req33900','req1')}],
    ['gases-listing',p=>{p.data.requisitions[0].postingEffectiveDate='9/31/2026'}],
    ['gases-listing',p=>{p.data.requisitions[0].postingEffectiveDate='-'}],
  ]){
    const jobs=await run({mutate:(kind,p)=>{if(kind===change[0])change[1](p)}}).promise
    assert.ok(jobs.some(j=>j.jobId==='33395'))
    assert.equal(jobs.some(j=>j.jobId==='33900'),false)
    assert.equal(readInventoryEvidence(jobs)?.reportedTotal,null)
  }
})

test('fresh exact CSOD anonymous client/site and legal-field context is required for each runtime',async()=>{
  for(const change of [
    ['page',p=>{if(p.url===source.INDIA_GASES_URL)p.html=p.html.replace('"corp":"linde"','"corp":"other"')}],
    ['site',p=>{p.data.id=1}],['site',p=>{p.data.active=false}],
    ['dictionary',p=>{p.data[0].items.find(x=>x.id===2266).title='Other Employer'}],
  ]){
    const jobs=await run({mutate:(kind,p)=>{if(kind===change[0])change[1](p)}}).promise
    assert.deepEqual(jobs.map(j=>j.jobId),['LEI/STM/1871499'])
    assert.equal(readInventoryEvidence(jobs)?.status,'coverage-gap')
  }
})

test('CSOD cancellation during detail recovery stays cancellation and cannot authorize partial success',async()=>{
  const controller=new AbortController(),reason=Error('stop Linde CSOD')
  await assert.rejects(run({options:{signal:controller.signal},mutate:(kind)=>{if(kind==='gases-detail')controller.abort(reason)}}).promise,error=>error===reason)
})

test('CSOD bounded, duplicate, changing-total and truncated pages cannot establish complete umbrella inventory',async()=>{
  const capped=await run({options:{pageSize:1,maxPages:1},mutate:(kind,p)=>{if(kind.endsWith('-listing')&&kind!=='engineering-listing')p.data.totalCount=2}}).promise
  assert.equal(readInventoryEvidence(capped)?.status,'discovery-only')
  assert.equal(readInventoryEvidence(capped)?.reportedTotal,null)
  for(const change of [
    (p,body)=>{p.data.totalCount=2}, // the second page repeats the first ID
    (p,body)=>{p.data.totalCount=body.pageNumber===1?2:3},
    (p)=>{p.data.totalCount=2;p.data.requisitions=[]},
  ]){
    const jobs=await run({options:{pageSize:1},mutate:(kind,p,url,request)=>{if(kind==='gases-listing')change(p,JSON.parse(request.body))}}).promise
    assert.ok(jobs.some(j=>j.jobId==='33395'))
    assert.equal(jobs.some(j=>j.jobId==='33900'),false)
    assert.equal(readInventoryEvidence(jobs)?.listingComplete,false)
  }
})

test('CSOD detail workers stop queued requests and settle active calls before propagating the first failure',async()=>{
  const sample=fixture('csod/gases-listing').data.requisitions[0]
  const rows=[33900,33901,33902].map(requisitionId=>({...sample,requisitionId}))
  const failure=Error('first CSOD detail failure'),calls=[]
  let releaseSecond,secondStarted,settled=false,earlyRejection=false
  const active=new Promise(resolve=>{secondStarted=resolve})
  const result=loadCsodBranch({ids:[1375,1131,1132],pageSize:25,maxPages:1,detailConcurrency:2,now:()=>new Date().toISOString(),
    fetchJson:async()=>({status:'Success',data:{totalCount:3,requisitions:rows}}),
    context:{headers:{},get:async url=>{
      calls.push(url)
      if(url.includes('/33900/'))throw failure
      if(url.includes('/33901/')){secondStarted();await new Promise(resolve=>{releaseSecond=resolve});settled=true;throw Error('second CSOD settled')}
      throw Error('queued detail must never start')
    }},
  }).catch(error=>{earlyRejection=!settled;return error})
  await Promise.race([active,result.then(()=>{throw Error('workers never started')})])
  await new Promise(resolve=>setImmediate(resolve))
  releaseSecond()
  assert.equal(await result,failure)
  assert.equal(earlyRejection,false)
  assert.equal(calls.length,2)
})

test('actual CSOD India role33817 preserves an absent native state without inferring state from its city or location title',async()=>{
  const record=fixture('csod/missing-state-listing'),detail=fixture('csod/missing-state-detail'),ad=fixture('csod/missing-state-ad')
  const options={ids:[1375,1131,1132],pageSize:25,maxPages:1,detailConcurrency:1,now:()=>new Date().toISOString(),
    fetchJson:async()=>({status:'Success',data:{totalCount:1,requisitions:[record]}}),
    context:{headers:{},get:async url=>url.includes('/jobDetails?')?detail:ad}}
  const result=await loadCsodBranch(options)
  assert.equal(result.complete,true)
  assert.equal(result.jobs[0].city,'Maharashtra')
  assert.equal(result.jobs[0].state,null)
  assert.equal(result.jobs[0].country,'India')
  assert.equal(result.jobs[0].location,'Maharashtra, India')
  detail.data.primaryLocation.state='Maharashtra'
  await assert.rejects(loadCsodBranch(options),/location conflicts/i)
})

test('actual CSOD role31768 publishes explicit India with no city/state and rejects conflicting supplied location fields',async()=>{
  const record=fixture('csod/country-only-listing'),detail=fixture('csod/country-only-detail'),ad=fixture('csod/country-only-ad')
  const options={ids:[1375,1131,1132],pageSize:25,maxPages:1,detailConcurrency:1,now:()=>new Date().toISOString(),
    fetchJson:async()=>({status:'Success',data:{totalCount:1,requisitions:[record]}}),
    context:{headers:{},get:async url=>url.includes('/jobDetails?')?detail:ad}}
  const result=await loadCsodBranch(options)
  assert.equal(result.complete,true)
  assert.equal(result.jobs[0].city,null)
  assert.equal(result.jobs[0].state,null)
  assert.equal(result.jobs[0].location,'India')
  for(const change of [l=>{l.city='Kalinganagar'},l=>{l.state='Odisha'},l=>{l.country='US'},l=>{delete l.country}]){
    const original=structuredClone(detail.data.primaryLocation);change(detail.data.primaryLocation)
    await assert.rejects(loadCsodBranch(options),/India|location/i)
    detail.data.primaryLocation=original
  }
  delete record.locations[0].country
  await assert.rejects(loadCsodBranch(options),/India|country/i)
})

test('actual legacy CSOD ad32733 uses active exact employer/title/reference paragraphs',async()=>{
  const record=fixture('csod/legacy-ad-listing'),detail=fixture('csod/legacy-ad-detail'),ad=fixture('csod/legacy-ad')
  const fields=ad.data[0].items[0].fields,original=fields.ad
  const options={ids:[1375,1131,1132],pageSize:25,maxPages:1,detailConcurrency:1,now:()=>new Date().toISOString(),
    fetchJson:async()=>({status:'Success',data:{totalCount:1,requisitions:[record]}}),
    context:{headers:{},get:async url=>url.includes('/jobDetails?')?detail:ad}}
  const result=await loadCsodBranch(options)
  assert.equal(result.jobs[0].sourceLegalEmployer,'Praxair India Private Limited')
  assert.match(result.jobs[0].sourceDescription,/Software Engineer - AI Hub/)
  for(const change of [v=>`<!--${v}-->`,v=>`<template>${v}</template>`,v=>v.replace('Praxair India Private Limited','Other employer'),v=>v.replace('Software Engineer - AI Hub','Other role'),v=>v.replace('req32733','req1'),v=>v.replace('India |','Germany |')]){
    fields.ad=change(original)
    await assert.rejects(loadCsodBranch(options),/header|employer|reference|content/i)
  }
})

test('combined CSOD ad identity binds its one active dedicated role span exactly to the native title',async()=>{
  for(const change of [
    v=>v.replace('>Senior Engineer O&M</span>','>Assistant Senior Engineer O&M</span>'),
    v=>v.replace('</span>','</span><span>Senior Engineer O&M</span>'),
    v=>v.replace('<span style=','<span hidden style='),
  ]){
    const jobs=await run({mutate:(kind,p)=>{if(kind==='gases-ad')p.data[0].items[0].fields.ad=change(p.data[0].items[0].fields.ad)}}).promise
    assert.ok(jobs.some(j=>j.jobId==='33395'))
    assert.equal(jobs.some(j=>j.jobId==='33900'),false)
    assert.equal(readInventoryEvidence(jobs)?.listingComplete,false)
  }
})
