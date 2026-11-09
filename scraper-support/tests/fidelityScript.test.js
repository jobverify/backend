import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import assert from 'node:assert/strict'
import test from 'node:test'

const loadFidelityModule = async () => {
  try {
    return await import('../../scraper/fidelity/script.js')
  } catch {
    assert.fail('Expected Fidelity scraper module at ../../scraper/fidelity/script.js')
  }
}

const jobsXml = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<source>
  <publisher>Fidelity Investments Careers</publisher>
  <publisherUrl>https://jobs.fidelity.com</publisherUrl>
  <lastBuildDate>Tue, 07 Jul 2026 23:02:46 GMT</lastBuildDate>
  <job>
    <title><![CDATA[Software Engineer]]></title>
    <date><![CDATA[Tue, 07 Jul 2026 00:00:00 GMT]]></date>
    <requisitionid><![CDATA[2128596]]></requisitionid>
    <referencenumber><![CDATA[2128596]]></referencenumber>
    <apijobid><![CDATA[2128596]]></apijobid>
    <url><![CDATA[https://jobs.fidelity.com/in/jobs/2128596/software-engineer/]]></url>
    <company><![CDATA[Fidelity Investments]]></company>
    <city><![CDATA[Bangalore]]></city>
    <state><![CDATA[Karnātaka]]></state>
    <country><![CDATA[IN]]></country>
    <postalcode><![CDATA[560045]]></postalcode>
    <description><![CDATA[
      <h3>Job Description:</h3>
      <p>Build agentic SDLC platforms for next generation engineering enablement.</p>
      <p>Required Skills &amp; Experience (Must have)</p>
      <ul>
        <li>Multi-agent orchestration</li>
        <li>Prompt engineering</li>
      </ul>
    ]]></description>
    <jobtype><![CDATA[Regular]]></jobtype>
    <category><![CDATA[Technology]]></category>
    <remotetype><![CDATA[]]></remotetype>
  </job>
  <job>
    <title><![CDATA[Principal Network Engineer]]></title>
    <date><![CDATA[Wed, 24 Jun 2026 00:00:00 GMT]]></date>
    <requisitionid><![CDATA[2130302]]></requisitionid>
    <referencenumber><![CDATA[2130302]]></referencenumber>
    <apijobid><![CDATA[2130302]]></apijobid>
    <url><![CDATA[https://jobs.fidelity.com/in/jobs/2130302/principal-network-engineer/]]></url>
    <company><![CDATA[Fidelity Investments]]></company>
    <city><![CDATA[Bangalore]]></city>
    <state><![CDATA[Karnātaka]]></state>
    <country><![CDATA[IN]]></country>
    <description><![CDATA[
      <p>You will be part of a dynamic global team responsible for the 24x7 engineering and operational support of Fidelity's network perimeter.</p>
    ]]></description>
    <jobtype><![CDATA[Regular]]></jobtype>
    <category><![CDATA[Technology]]></category>
  </job>
  <job>
    <title><![CDATA[Principal Network Engineer]]></title>
    <date><![CDATA[Wed, 24 Jun 2026 00:00:00 GMT]]></date>
    <requisitionid><![CDATA[2130302]]></requisitionid>
    <referencenumber><![CDATA[2130302A]]></referencenumber>
    <apijobid><![CDATA[2130302]]></apijobid>
    <url><![CDATA[https://jobs.fidelity.com/in/jobs/2130302/principal-network-engineer/]]></url>
    <company><![CDATA[Fidelity Investments]]></company>
    <city><![CDATA[Chennai]]></city>
    <state><![CDATA[Tamil Nādu]]></state>
    <country><![CDATA[IN]]></country>
    <description><![CDATA[
      <p>You will be part of a dynamic global team responsible for the 24x7 engineering and operational support of Fidelity's network perimeter.</p>
    ]]></description>
    <jobtype><![CDATA[Regular]]></jobtype>
    <category><![CDATA[Technology]]></category>
  </job>
</source>`

test('extractJobsFromFeed parses the official Fidelity India RSS feed and merges duplicate multi-location roles', async () => {
  const fidelity = await loadFidelityModule()

  assert.equal(
    fidelity.JOBS_XML_URL,
    'https://jobs.fidelity.com/in/jobs/xml/?rss=true',
  )

  const jobs = fidelity.extractJobsFromFeed(jobsXml)

  assert.equal(jobs.length, 2)

  assert.equal(jobs[0].title, 'Software Engineer')
  assert.equal(jobs[0].company, 'Fidelity Investments')
  assert.equal(jobs[0].department, 'Technology')
  assert.equal(jobs[0].location, 'Bangalore, Karnataka, India')
  assert.equal(jobs[0].city, 'Bangalore')
  assert.equal(jobs[0].state, 'Karnataka')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].jobId, '2128596')
  assert.equal(jobs[0].requisitionId, '2128596')
  assert.equal(
    jobs[0].sourceUrl,
    'https://jobs.fidelity.com/in/jobs/2128596/software-engineer/',
  )
  assert.equal(
    jobs[0].applyUrl,
    'https://jobs.fidelity.com/in/jobs/2128596/software-engineer/',
  )
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.deepEqual(jobs[0].requiredSkills, [
    'Multi-agent orchestration',
    'Prompt engineering',
  ])
  assert.equal(jobs[0].postingDate, '2026-07-07T00:00:00.000Z')
  assert.match(jobs[0].jobDescription, /agentic SDLC platforms/i)

  assert.equal(jobs[1].title, 'Principal Network Engineer')
  assert.equal(jobs[1].jobId, '2130302')
  assert.equal(jobs[1].requisitionId, '2130302')
  assert.equal(
    jobs[1].location,
    'Bangalore, Karnataka, India; Chennai, Tamil Nadu, India',
  )
  assert.equal(jobs[1].city, 'Bangalore')
  assert.equal(jobs[1].state, 'Karnataka')
  assert.equal(jobs[1].country, 'India')
  assert.equal(
    jobs[1].sourceUrl,
    'https://jobs.fidelity.com/in/jobs/2130302/principal-network-engineer/',
  )
})

const nativeOptions=(change=()=>{})=>{const f=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/fidelity/fixtures/runtime-native-20261021.json.gz',import.meta.url)))),used=new Set();return{now:f.checkedAt,fetchPage:async url=>{const at=f.packets.findIndex((p,i)=>!used.has(i)&&p.url===url);assert.ok(at>=0,'Uncaptured request '+url);used.add(at);const p=structuredClone(f.packets[at]);change(p);return{status:p.status,url:p.finalURL,body:p.body}}}}
test('ordinary Fidelity runtime reconciles current identity,board,feed,full details and stable final inventory',async()=>{const fidelity=await loadFidelityModule(),o=nativeOptions(),jobs=await fidelity.createFidelityScraper().run(o);assert.equal(jobs.length,14);assert.ok(jobs.every(j=>j.source==='fidelity'&&j.company==='Fidelity Investments'&&j.scrapedAt===o.now&&j.sourceDetailComplete&&!j.sourceListingComplete))})
