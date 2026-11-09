import assert from 'node:assert/strict'
import test from 'node:test'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const search='https://careers.bcg.com/global/en/search-results'
const nativeRows=Array.from({length:8},(_,index)=>({jobId:String(70001+index),reqId:String(70001+index),
  title:'Platform Engineer '+(index+1),country:'India',cityStateCountry:'Gurgaon, India',location:'Gurgaon, India',
  postedDate:'2026-11-01',applyUrl:'https://experiencedtalent.bcg.com/careerhub/explore/jobs/'+(70001+index)}))
const listing=rows=>'<script>var phApp={};phApp.ddo='+JSON.stringify({eagerLoadRefineSearch:{totalHits:8,hits:8,jobs:rows,aggregations:[{field:'country',value:{India:8}}]}})+'</script>'
const detail=row=>'<link rel="canonical" href="https://careers.bcg.com/global/en/job/'+row.jobId+'/'+row.title.replaceAll(' ','-')+'"><script>var phApp={};phApp.ddo='+JSON.stringify({jobDetail:{data:{job:{...row,ml_Description:'<p>Responsibilities: Build and maintain reliable enterprise software platforms. Requirements: Relevant engineering experience, careful testing and collaboration with the technical team.</p>'}}}})+'</script>'

test('BCG completes native role details with four source-default workers and reconciles the closing listing',async()=>{
  let active=0,peak=0,listingReads=0
  const jobs=await run({detailEnrichmentBudgetMs:1000,fetchText:async url=>{
    if(url===search){listingReads++;return listing(nativeRows)}
    const row=nativeRows.find(row=>url.includes('/job/'+row.jobId+'/'));assert.ok(row)
    active++;peak=Math.max(peak,active)
    await new Promise(resolve=>setTimeout(resolve,20));active--
    return detail(row)
  }})
  assert.equal(jobs.length,8)
  assert.equal(peak,4)
  assert.equal(listingReads,2)
  assert.ok(jobs.every(job=>job.sourceDetailComplete===true))
  assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})

test('BCG preserves partial scope if a native role identity changes in the closing listing',async()=>{
  let listingReads=0
  const jobs=await run({fetchText:async url=>{
    if(url===search)return listing(++listingReads===1?nativeRows:nativeRows.map((row,index)=>index?row:{...row,jobId:'79999',reqId:'79999'}))
    const row=nativeRows.find(row=>url.includes('/job/'+row.jobId+'/'));assert.ok(row);return detail(row)
  }})
  assert.equal(jobs.length,8)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.ok(jobs.every(job=>job.sourceListingComplete===false))
})
