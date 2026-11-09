import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import * as surya from '../../scraper/suryalogix/script.js'
import * as lumiq from '../../scraper/lumiq/script.js'
import * as setu from '../../scraper/setu/script.js'
import * as muvi from '../../scraper/muvientertainment/script.js'

const suryaHome = fs.readFileSync(new URL('../../scraper/suryalogix/fixtures/homepage.html', import.meta.url), 'utf8')
const suryaCareers = fs.readFileSync(new URL('../../scraper/suryalogix/fixtures/careers.html', import.meta.url), 'utf8')
const opening = (title = 'Embedded Engineer', location = 'Pune, Maharashtra') => '<section class="elementor-inner-section"><h2 class="elementor-heading-title">' + title + '</h2><span class="elementor-icon-list-text">' + location + ' Experience: 2-4 Years</span><span>Expertise - Embedded C, Debugging</span><span>Openings: 1</span><a href="#form">Apply Now</a></section>'
const event = '<h2>Job Openings</h2><h3>Walk-In Interviews</h3><h3>Dates</h3><p>8th to 12th Sep 2026</p><h3>Time</h3><p>11:00 am to 5:00 pm</p>'
const runSurya = (html, date) => surya.run({ now: () => date, fetchPage: async url => ({status:200, url, html: url === surya.HOMEPAGE_URL ? suryaHome : html}) })

test('SuryaLogix expires all verified walk-in roles after the published India event deadline', async () => {
  const html = suryaCareers + event + opening() + opening('PCB Engineer')
  const active = await runSurya(html, '2026-09-12T11:29:00Z')
  assert.equal(active.length, 2)
  assert.equal(active[0].closingDate, '2026-09-12')
  assert.deepEqual(await runSurya(html, '2026-09-13T00:00:00Z'), [])
})

test('SuryaLogix rejects generic forms, malformed expired cards and unrecognized event dates', async () => {
  await assert.rejects(runSurya(suryaCareers, '2026-09-13T00:00:00Z'), /inventory|listing/i)
  await assert.rejects(runSurya(suryaCareers + event + opening() + opening('Broken').replace('Expertise - Embedded C, Debugging', 'missing expertise'), '2026-09-13T00:00:00Z'), /incomplete|malformed/i)
  await assert.rejects(runSurya(suryaCareers + event.replace('8th to 12th Sep 2026','Dates coming soon') + opening(), '2026-09-13T00:00:00Z'), /date|deadline/i)
  await assert.rejects(runSurya(suryaCareers + event + opening('Engineer', 'London'), '2026-09-11T00:00:00Z'), /India|country|location/i)
})

const zHome = '<title>A Relentless Pursuit Of Perfection. | LUMIQ</title><a href="https://lumiq.zohorecruit.in/careers">Explore opportunities</a>'
const zRecord = (id, country = 'India') => ({id, Posting_Title:'Engineer ' + id, Country:country, City:country === 'India' ? 'Noida' : 'London', $url:'https://lumiq.zohorecruit.in/jobs/Careers/' + id + '/Engineer?source=CareerSite'})
const zPortal = records => '<title>Jobs at Lumiq</title><input id="pageJson" value="{}"><input id="moduleMeta" value="[]"><input id="jobs" value="' + JSON.stringify(records).replaceAll('"','&quot;') + '">'
const zDetail = record => '<title>Lumiq - Engineer</title><script>var jobs = JSON.parse(' + JSON.stringify(JSON.stringify([{...record, Job_Description:'Build reliable platforms at Lumiq with our engineering team.', Work_Experience:'3-5 years'}])) + ');</script>'
const runLumiq = (records, payload = {code:'success', data:records, info:{page_name:'Careers'}}) => lumiq.run({fetchText:async url => url === lumiq.CAREERS_PAGE_URL ? zHome : url === lumiq.CAREERS_PORTAL_URL ? zPortal(records) : zDetail(records.find(r=>r.$url===url)), fetchJson:async () => payload})

test('Lumiq follows the new official Zoho route and reconciles API IDs with the complete embedded board', async () => {
  const jobs = await runLumiq([zRecord('1'),zRecord('2','United Kingdom')])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.match(jobs[0].jobDescription, /reliable platforms/)
  assert.equal(jobs[0].sourceListingComplete, undefined)
})

test('Lumiq rejects truncated, duplicate, wrong-tenant and malformed inventory', async () => {
  const records=[zRecord('1'),zRecord('2')]
  for(const payload of [{code:'success',data:[records[0]],info:{page_name:'Careers'}},{code:'success',data:[records[0],records[0]],info:{page_name:'Careers'}},{code:'success',data:records,info:{page_name:'Careers',more_records:true}},{code:'success',data:[{...records[0],$url:'https://other.zohorecruit.in/jobs/Careers/1/Engineer'},records[1]],info:{page_name:'Careers'}}]) await assert.rejects(runLumiq(records,payload), /incomplete|invalid|tenant|pagination|duplicate/i)
  await assert.rejects(runLumiq([{...zRecord('1'),Country:null}]), /country|scope|invalid/i)
})

const setuHome = '<title>Careers at Setu - Fintech Jobs in India</title><link rel="canonical" href="https://setu.co/careers"><h1>Come work with us</h1><p>Help us build the financial infrastructure India runs on.</p><h2>Open roles</h2><p>Every role links straight through to our application portal.</p>'
const setuCard = (id,title='Engineer') => '<a href="https://pinelabsgroup.turbohire.co/get/' + id + '"><h3>' + title + '</h3><p>Engineering</p><p>Apply</p></a>'

test('Setu rejects malformed role cards and flags explicitly capped positive snapshots', async () => {
  await assert.rejects(setu.run({fetchText:async () => setuHome + setuCard('1') + setuCard('2','')}), /incomplete|malformed/i)
  const jobs=await setu.run({maxJobs:1,fetchText:async url=>url===setu.CAREERS_URL?setuHome+setuCard('1')+setuCard('2'):'<meta property="og:description" content="About Setu. Build financial infrastructure in India.">'})
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].sourceListingComplete,false)
})

const muviHome = '<title>Career - Muvi</title><link rel="canonical" href="https://www.muvi.com/career/"><a href="https://www.muvi.com/career/job-listings/">View Openings</a>'
const muviUrl = id => 'https://www.muvi.com/career/jobs/engineer-' + id
const muviCard = (id,location='Bhubaneswar') => '<div class="job-card"><a href="' + muviUrl(id) + '"><div class="job-card-inner"><div class="job-card-header"><h6>Engineer ' + id + '</h6></div><div class="job-card-tags"><span>3-5 Years</span><span>Engineer</span><span>1 Openings</span><span>' + location + '</span></div><p>Build video platforms with our engineering team.</p></div></a></div>'
const muviPage = (body,page=1) => '<title>Job Listings - Muvi</title>' + body + '<nav aria-label="Page navigation"><a class="page-link ' + (page===1?'active':'') + '" href="https://www.muvi.com/career/job-listings/">1</a><a class="page-link ' + (page===2?'active':'') + '" href="https://www.muvi.com/career/job-listings/page/2/">2</a></nav>'
const muviDetail = (id,location='Bhubaneswar') => '<title>Jobs - Muvi</title><h3 class="details-title">Engineer ' + id + '</h3><div class="location">' + location + '</div><div class="job-abt"><p>Build video platforms with Muvi and implement reliable engineering solutions.</p></div><form id="careerform"><input name="job_id" value="' + id + '"></form>'
const runMuvi = (pages,details={}) => muvi.run({fetchText:async url=>url===muvi.CAREERS_URL?muviHome:pages[url]??details[url]??(()=>{throw Error('Unexpected URL '+url)})()})
const m1='https://www.muvi.com/career/job-listings/',m2=m1+'page/2/'

test('Muvi accepts current category job URLs while retaining verified India scope', async () => {
  const currentUrl = 'https://www.muvi.com/career/job-listings/qa/automation-engineer-onsite-20260910144645/'
  const card = muviCard('158').replace(muviUrl('158'), currentUrl)
  const jobs = await muvi.run({fetchText: async url => {
    if (url === muvi.CAREERS_URL) return muviHome
    if (url === m1) return muviPage(card).replace(/<nav aria-label="Page navigation">[\s\S]*?<\/nav>/, '')
    if (url === currentUrl) return muviDetail('158')
    throw new Error('Unexpected URL ' + url)
  }})
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, 'muvientertainment-158')
  assert.equal(jobs[0].sourceUrl, currentUrl)
  assert.equal(jobs[0].country, 'India')
})

test('Muvi follows first-party pagination and retains only proven India roles with unknown remote scope marked partial', async () => {
  const jobs=await runMuvi({[m1]:muviPage(muviCard('1')+muviCard('2','Remote')),[m2]:muviPage(muviCard('3'),2)}, {[muviUrl('1')]:muviDetail('1'),[muviUrl('2')]:muviDetail('2','Remote'),[muviUrl('3')]:muviDetail('3')})
  assert.equal(jobs.length,2)
  assert.ok(jobs.every(j=>j.country==='India'&&j.sourceListingComplete===false))
  assert.ok(jobs.every(j=>j.jobDescription.includes('reliable engineering')))
})

test('Muvi rejects missing pages, repeated pages, unknown-only scope and malformed role cards', async () => {
  await assert.rejects(runMuvi({[m1]:muviPage(muviCard('1')),[m2]:muviPage(muviCard('1'))}), /pagination|duplicate|repeated/i)
  await assert.rejects(runMuvi({[m1]:muviPage(muviCard('1')),[m2]:muviPage('',2)}), /empty|incomplete/i)
  await assert.rejects(runMuvi({[m1]:muviPage(muviCard('1')+muviCard('2').replace('<h6>Engineer 2</h6>',''))}), /malformed|incomplete/i)
  await assert.rejects(runMuvi({[m1]:muviPage(muviCard('1','Remote')),[m2]:muviPage(muviCard('2','Remote'),2)}, {[muviUrl('1')]:muviDetail('1','Remote'),[muviUrl('2')]:muviDetail('2','Remote')}), /scope|India/i)
})

for(const [name,module] of [['SuryaLogix',surya],['Lumiq',lumiq],['Setu',setu],['Muvi',muvi]]) test(name+' propagates pre-aborted caller cancellation before requesting a page', async () => {
  const reason=new Error('Cancelled '+name)
  await assert.rejects(module.run({signal:AbortSignal.abort(reason),fetchPage:async()=>{throw Error('Should not fetch')},fetchText:async()=>{throw Error('Should not fetch')},fetchJson:async()=>{throw Error('Should not fetch')}}),error=>error===reason)
})

test('SuryaLogix and Setu reject an added unparsed hiring handoff beside valid roles', async () => {
  await assert.rejects(runSurya(suryaCareers + event + opening() + '<a href="https://jobs.lever.co/suryalogix/123">Apply</a>', '2026-09-11T00:00:00Z'), /handoff|incomplete/i)
  await assert.rejects(setu.run({fetchText:async () => setuHome + setuCard('1') + '<a href="https://other.turbohire.co/get/2"><h3>Other</h3><p>Apply</p></a>'}), /handoff|malformed|incomplete/i)
  assert.throws(()=>setu.extractJobsFromCsv('Role,Description,Link,Category,Sub-category\nEngineer,,https://pinelabsgroup.turbohire.co/get/1,Engineering,Payments\nBroken,,,,', 'Category,Description\nEngineering,Build services'), /malformed|incomplete/i)
})

test('Current SuryaLogix, Lumiq, Setu and Muvi catalog records match their verified live contracts', async () => {
  const {getScraperCatalog}=await import('../providers/index.js')
  for(const [source,platform] of [['suryalogix','first-party-careers-application-popup'],['lumiq','zohorecruit'],['setu','first-party-careers-plus-turbohire-links'],['muvientertainment','first-party-careers-pagination-plus-job-details']]) {
    const shared=getScraperCatalog().find(p=>p.source===source)
    const {default:local}=await import('../../scraper/'+source+'/catalog.js')
    assert.equal(local.atsPlatform,platform)
    for(const key of ['atsPlatform','verifiedOn','verifiedSurfaceSummary','paginationStrategy','extractionStrategy'])assert.equal(shared[key],local[key],source+' '+key)
    assert.equal(shared.verifiedOn,['muvientertainment','suryalogix'].includes(source)?'2026-10-09':'2026-09-13')
  }
})
