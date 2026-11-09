import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createCoinDCXScraper, CAREER_PAGE_URL } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
const fixtureDir = new URL('./fixtures/current-linkedin/', import.meta.url)
const company = await fs.readFile(new URL('company.html', fixtureDir), 'utf8')
const board = await fs.readFile(new URL('jobs.html', fixtureDir), 'utf8')
const ids = ['4467537689','4467545260','4467539348','4467538449','4466842844','4466846779','4457470295','4417884853','4473879224']
const details = new Map(await Promise.all(ids.map(async id => [id, await fs.readFile(new URL(id + '.html', fixtureDir),'utf8')])))
const at = '2026-10-09T00:00:00.000Z'
const oldBlocked = '<title>Attention Required! | Cloudflare</title><p>Please enable cookies.</p><p>Sorry, you have been blocked</p><p>You are unable to access coindcx.com</p>'
const invoke = async (modify = () => {}, options = {}) => {
  const calls = []
  const fetchPage = async (url, context) => {
    calls.push({url,context})
    let html = url === CAREER_PAGE_URL ? oldBlocked : /\/jobs\/view\//.test(url) ? details.get(url.match(/-(\d+)(?:\?|$)/)?.[1]) : /\/company\/coindcx\/jobs\/?$/.test(url) ? board : company
    if (!html) throw new Error('Unregistered fixture URL ' + url)
    const page = {status:url===CAREER_PAGE_URL?403:200,url,html}
    modify(page,calls)
    return page
  }
  return {jobs:await createCoinDCXScraper().run({fetchPage,now:()=>at,...options}),calls}
}
test('CoinDCX recovers native employer India jobs without the obsolete blocked marketing prerequisite', async()=>{
  const {jobs,calls}=await invoke()
  assert.equal(jobs.length,9)
  assert.equal(new Set(jobs.map(j=>j.jobId)).size,9)
  assert.ok(jobs.every(j=>j.company==='CoinDCX'&&j.country==='India'&&j.jobDescription.length>300&&j.sourceListingComplete===false))
  assert.ok(calls.every(c=>new URL(c.url).hostname.endsWith('linkedin.com')))
  assert.ok(jobs.every(j=>j.applicationRequiresAccount===true))
  const e=readInventoryEvidence(jobs)
  assert.equal(e.status,'coverage-gap');assert.equal(e.listingComplete,false);assert.equal(e.indiaFacetCount,null);assert.equal(e.reportedTotal,null)
})
for (const [name,change] of [
  ['wrong native company domain',p=>{p.html=p.html.replaceAll('coindcx%2Ecom','example%2Ecom')}],
  ['wrong canonical company',p=>{if(!p.url.includes('/jobs/view/'))p.html=p.html.replaceAll('/company/coindcx','/company/other-employer')}],
  ['wrong native company ID',p=>{p.html=p.html.replaceAll('f_C=28154426','f_C=123')}],
  ['missing profile website',p=>{p.html=p.html.replaceAll('about_website','unknown_website')}],
  ['off-authority response redirect',p=>{p.url='https://example.com/copied-company'}],
  ['empty displayed inventory',p=>{if(p.url.includes('/company/coindcx/jobs'))p.html=p.html.replaceAll('data-entity-urn','unknown-entity-urn')}],
  ['duplicate raw role ID',p=>{if(p.url.includes('/company/coindcx/jobs'))p.html=p.html.replaceAll('4467545260','4467537689')}],
  ['foreign card employer',p=>{if(p.url.includes('/company/coindcx/jobs'))p.html=p.html.replaceAll('org-job-results_main-jobs-card-subtitle','unknown-employer-anchor')}],
  ['missing native role title',p=>{if(p.url.includes('/jobs/view/'))p.html=p.html.replaceAll('top-card-layout__title','unknown-native-title')}],
  ['detail employer mismatch',p=>{if(p.url.includes('/jobs/view/'))p.html=p.html.replaceAll('"name":"CoinDCX"','"name":"Different Employer"')}],
  ['missing structured country',p=>{if(p.url.includes('/jobs/view/'))p.html=p.html.replaceAll('"addressCountry":"IN"','"addressCountry":null')}],
  ['conflicting structured country',p=>{if(p.url.includes('/jobs/view/'))p.html=p.html.replaceAll('"addressCountry":"IN"','"addressCountry":"US"')}],
  ['malformed job JSON',p=>{if(p.url.includes('/jobs/view/'))p.html=p.html.replace('"@type":"JobPosting"','"@type":oops')}],
  ['expired native application',p=>{if(p.url.includes('/jobs/view/'))p.html=p.html.replace(/"validThrough":"[^"]+"/g,'"validThrough":"2026-01-01T00:00:00Z"')}],
  ['future native posting',p=>{if(p.url.includes('/jobs/view/'))p.html=p.html.replace(/"datePosted":"[^"]+"/g,'"datePosted":"2027-01-01T00:00:00Z"')}],
  ['missing positive Apply button',p=>{if(p.url.includes('/jobs/view/'))p.html=p.html.replaceAll('id="topbar-apply"','id="unknown-apply"')}],
  ['empty full native description',p=>{if(p.url.includes('/jobs/view/'))p.html=p.html.replaceAll('show-more-less-html__markup','unknown-description')}],
  ['schema and visible JD conflict',p=>{if(p.url.includes('/jobs/view/'))p.html=p.html.replace('"description":"','"description":"Unrelated injected description ')}],
  ['HTTP403 in mandatory detail',p=>{if(p.url.includes('/jobs/view/'))p.status=403}],
  ['snapshot actual identity drift',(p,c)=>{if(c.length===12)p.html=p.html.replaceAll('4467545260','4467545269')}],
]) test('CoinDCX fails closed on '+name, async()=>{
  await assert.rejects(invoke(change),/CoinDCX|LinkedIn|HTTP/)
})
test('CoinDCX result cap remains partial and requires a positive integer',async()=>{
  const {jobs}=await invoke(undefined,{maxJobs:1})
  assert.equal(jobs.length,1);assert.equal(jobs[0].sourceListingComplete,false)
  for (const maxJobs of [0,-1,1.5,'1']) await assert.rejects(invoke(undefined,{maxJobs}),/positive integer/)
})
test('CoinDCX pre-abort performs no authority request',async()=>{
  const c=new AbortController();c.abort();let calls=0
  await assert.rejects(createCoinDCXScraper().run({signal:c.signal,fetchPage:async()=>{calls++;throw new Error('Unexpected')}}),{name:'AbortError'})
  assert.equal(calls,0)
})

for(const tail of ['US','United States'])test('CoinDCX rejects contradictory middle country '+tail,async()=>{await assert.rejects(invoke(p=>{if(p.url.includes('/jobs/view/')||p.url.includes('/company/coindcx/jobs'))p.html=p.html.replaceAll('Bengaluru, Karnataka, India','Bengaluru, '+tail+', India')}),/country|geography|India/)})
test('CoinDCX rejects mixed India and foreign schema workplaces',async()=>{await assert.rejects(invoke(p=>{if(p.url.includes('/jobs/view/'))p.html=p.html.replace(/"jobLocation":(\{"@type":"Place","address":\{[^}]+\},"latitude":[^,]+,"longitude":[^}]+\})/,(_,place)=>'"jobLocation":['+place+','+place.replace('"addressCountry":"IN"','"addressCountry":"US"')+']')}),/country|geography|India/)})
