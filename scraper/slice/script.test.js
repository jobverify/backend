import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const careersUrl = 'https://slice.bank.in/careers/'
const positionsUrl = 'https://slice.bank.in/careers/open-positions'
const boardUrl = 'https://careers.kula.ai/slice?jobs=true'
const apiUrl = 'https://careers.kula.ai/api/internal/ats_job_posts'
const careers = await fs.readFile(new URL('./fixtures/bank-careers.html',import.meta.url),'utf8')
const positions = await fs.readFile(new URL('./fixtures/bank-open-positions.html',import.meta.url),'utf8')
const board = await fs.readFile(new URL('./fixtures/kula-board.html',import.meta.url),'utf8')
const payload = JSON.parse(await fs.readFile(new URL('./fixtures/jobs-page1.json',import.meta.url),'utf8'))
const clone = value => structuredClone(value)
const options = ({data=clone(payload), pages, boardHtml=board, pageOverrides={}}={}) => ({
  now:()=> '2026-10-03T16:00:00.000Z',
  fetchPage:async url => {
    assert.ok([careersUrl,positionsUrl,boardUrl].includes(url), 'Only the bank and its verified Kula board may be requested')
    return {status:200,url,html:pageOverrides[url]?.html ?? (url===careersUrl?careers:url===positionsUrl?positions:boardHtml),...pageOverrides[url]}
  },
  fetchJson:async url => {
    const parsed = new URL(url)
    assert.equal(parsed.origin+parsed.pathname,apiUrl)
    assert.equal(parsed.searchParams.get('accountName'),'slice')
    assert.equal(parsed.searchParams.get('type'),'ats_job_post.index')
    assert.equal(parsed.searchParams.get('items'),'99')
    assert.equal(parsed.searchParams.has('filter_by'),false)
    return clone(pages ? pages[Number(parsed.searchParams.get('page'))-1] : data)
  },
})

test('Slice follows the verified Indian-bank Kula feed and retains all 40 full descriptions and apply links',async()=>{
  const jobs=await run(options())
  assert.equal(jobs.length,40)
  assert.equal(new Set(jobs.map(j=>j.jobId)).size,40)
  assert.equal(jobs[0].title,'SDE 2 - Backend')
  assert.match(jobs[0].jobDescription,/backend developer/i)
  assert.match(jobs[0].jobDescription,/come join our crew/i)
  assert.equal(jobs[0].applyUrl,'https://careers.kula.ai/slice/50594-sde-2-backend?jobs=true')
  assert.equal(jobs.at(-1).applyUrl,'https://careers.kula.ai/slice/59301-sde-1-front-end-web?jobs=true')
  assert.ok(jobs.every(j=>j.country==='India'&&j.jobDescription.length>200&&j.source==='slice'))
  const proof=readInventoryEvidence(jobs)
  assert.equal(proof.status,'complete-inventory')
  assert.equal(proof.reportedTotal,40)
  assert.equal(proof.indiaFacetCount,40)
  assert.equal(proof.pagesFetched,1)
  assert.equal(proof.listingComplete,true)
})

test('Slice exhausts native API pages before asserting complete inventory',async()=>{
  const rows=Array.from({length:100},(_,i)=>({...clone(payload.data[i%40]),id:i+100001,title:'Test role '+i}))
  const testBoard=board.replace(/<a\b[^>]*>[\s\S]*?<\/a>/g,'').replace('</body>',rows.slice(0,99).map(j=>'<a href="/slice/'+j.id+'-test-role-'+(j.id-100001)+'?jobs=true">Role</a>').join('')+'</body>')
  const pages=[{data:rows.slice(0,99),meta:{count:100,page:1,items:99,pages:2},errors:[]},{data:rows.slice(99),meta:{count:100,page:2,items:99,pages:2},errors:[]}]
  const jobs=await run(options({pages,boardHtml:testBoard}))
  assert.equal(jobs.length,100)
  assert.equal(readInventoryEvidence(jobs).pagesFetched,2)
  assert.equal(readInventoryEvidence(jobs).reportedTotal,100)
  pages[1].data=[]
  await assert.rejects(run(options({pages,boardHtml:testBoard})),/incomplete|count|inventory/i)
})

test('Slice rejects bank/board redirects, a changed handoff, and foreign employer identity',async()=>{
  for(const pageOverrides of [
    {[careersUrl]:{url:'https://slice.careers/'}},
    {[positionsUrl]:{html:positions.replaceAll('https://careers.kula.ai/slice?jobs=true','https://careers.kula.ai/other?jobs=true')}},
    {[boardUrl]:{url:'https://careers.kula.ai/other?jobs=true'}},
    {[boardUrl]:{html:board.replaceAll('https://slice.bank.in/','https://about.slicelife.com/')}},
  ])await assert.rejects(run(options({pageOverrides})),/identity|handoff|redirect|verified/i)
})

test('Slice rejects native errors, truncated counts, duplicate IDs and changed tenant identity',async()=>{
  for(const change of [
    p=>{p.errors=['upstream failed']},
    p=>{p.meta.count++},
    p=>{p.data[1].id=p.data[0].id},
    p=>{p.data[0].account_id=9999},
    p=>{p.data[0].listed=false},
  ]){const data=clone(payload);change(data);await assert.rejects(run(options({data})),/inventory|identity|count|duplicate|public/i)}
})

test('Slice filters explicit overseas offices while preserving India remote offices and inventory counts',async()=>{
  const data=clone(payload)
  data.data[0].ats_job.offices=[{country:'United States',country_code:'US',location:'Seattle, United States',city:'Seattle',remote:false}]
  const jobs=await run(options({data}))
  assert.equal(jobs.length,39)
  assert.ok(!jobs.some(j=>j.jobId==='50594'))
  assert.ok(jobs.some(j=>j.remoteStatus==='Remote'&&j.country==='India'))
  assert.equal(readInventoryEvidence(jobs).reportedTotal,40)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount,39)
})

test('Slice rejects unknown geography, unresolved descriptions and mismatched apply slugs',async()=>{
  for(const change of [
    p=>{delete p.data[0].ats_job.offices[0].country_code},
    p=>{p.data[0].ats_job.offices=[]},
    p=>{p.data[0].ats_job.job_description='$18'},
    p=>{p.data[0].ats_job.job_description=''},
    p=>{p.data[0].title='Wrong apply slug'},
  ]){const data=clone(payload);change(data);await assert.rejects(run(options({data})),/geography|description|apply|location/i)}
})

test('Slice accepts zero only with native zero totals and the board explicit no-jobs state',async()=>{
  const data={data:[],meta:{count:0,page:1,items:99,pages:0},errors:[]}
  await assert.rejects(run(options({data})),/empty|inventory|count/i)
  const emptyBoard=board.replace(/<a\b[^>]*>[\s\S]*?<\/a>/g,'').replace('</body>','<p>No jobs found</p><p>We open new jobs from time to time, so please check again soon!</p></body>')
  const jobs=await run(options({data,boardHtml:emptyBoard}))
  assert.equal(jobs.length,0)
  assert.equal(readInventoryEvidence(jobs).status,'verified-empty')
})

test('Slice respects caller cancellation before fetching',async()=>{
  const controller=new AbortController();controller.abort()
  await assert.rejects(run({...options(),signal:controller.signal}),/abort/i)
})
