import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-15T00:00:00.000Z'
const JOBS_PAGE_URL = 'https://jobs.fidelity.com/in/jobs/'
const JOBS_XML_URL = 'https://jobs.fidelity.com/in/jobs/xml/?rss=true'
const DETAIL_URL = 'https://jobs.fidelity.com/in/jobs/2130684/principal-network-engineer/'

const jobsPageHtml = `
<!doctype html>
<html lang="en-IN">
  <head>
    <title>Search Jobs - Find the right match for your skills and location. | Fidelity Careers</title>
    <link rel="canonical" href="https://jobs.fidelity.com/in/jobs/" />
  </head>
  <body>
    <nav>
      <a href="/in/life-at-fidelity-india/">Life at Fidelity India</a>
      <a href="https://talentcommunity.fidelity.com/">Join our talent network</a>
    </nav>
    <main>
      <h1>Search Jobs</h1>
      <p>Find the right match for your skills and location.</p>
      <label>Location Select Location Bangalore Chennai</label>
      <div>Company registered office in India: Fidelity Business Services India Pvt. Ltd.</div>
    </main>
  </body>
</html>
`

const cloudflareChallengeHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Just a moment...</title>
    <meta name="robots" content="noindex,nofollow">
  </head>
  <body>
    <p>jobs.fidelity.com</p>
    <p>Enable JavaScript and cookies to continue</p>
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" defer></script>
    <h1>Please wait while we verify your browser</h1>
  </body>
</html>
`

const jobsXml = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<source>
  <publisher>Fidelity Investments Careers</publisher>
  <publisherUrl>https://jobs.fidelity.com</publisherUrl>
  <lastBuildDate>Tue, 14 Jul 2026 21:07:52 GMT</lastBuildDate>
  <job>
    <title><![CDATA[Lead Software Engineer]]></title>
    <date><![CDATA[Tue, 14 Jul 2026 00:00:00 GMT]]></date>
    <requisitionid><![CDATA[2131693]]></requisitionid>
    <referencenumber><![CDATA[2131693]]></referencenumber>
    <apijobid><![CDATA[2131693]]></apijobid>
    <url><![CDATA[https://jobs.fidelity.com/in/jobs/2131693/lead-software-engineer/]]></url>
    <company><![CDATA[Fidelity Investments]]></company>
    <city><![CDATA[Bangalore]]></city>
    <state><![CDATA[Karnātaka]]></state>
    <country><![CDATA[IN]]></country>
    <description><![CDATA[
      <h3>Job Description:</h3>
      <p><strong>Job Title: </strong>Lead – Software Engineering</p>
      <p><strong>The Team</strong></p>
      <p>Fidelity's Workplace Investing Reporting and Analytics chapter is seeking a Senior PowerBI Developer.</p>
      <p><strong>The Expertise You Have</strong></p>
      <ul>
        <li>Bachelor’s Degree in Computer Science / similar technical subject area and or equivalent experience</li>
        <li>5+ years of experience as a Power BI Developer with a strong portfolio of built reports, dashboards, and visualizations.</li>
      </ul>
      <p><strong>The Skills You Bring</strong></p>
      <ul>
        <li>Strong problem solving &amp; collaboration skills</li>
        <li>Excellent communication skills required</li>
      </ul>
      <p><strong>Location</strong>: Bangalore</p>
      <p><strong>Shift timings</strong>: 11:00 am - 8:00pm</p>
    ]]></description>
    <jobtype><![CDATA[Regular]]></jobtype>
    <category><![CDATA[Technology]]></category>
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
      <h3>Job Description:</h3>
      <p><strong>Job Title</strong> – <strong>Principal Network Engineer</strong></p>
      <p><strong>The Purpose of This Role</strong></p>
      <p>As Principal Network Engineer in the Network Security Engineering team you will be responsible for engineering and management of network security infrastructure for Fidelity Investments globally.</p>
      <p><strong>The Skills that are Key to this role</strong></p>
      <ul>
        <li>Strong knowledge and working experience with Juniper SRX, Check Point and Cisco Firepower security appliances</li>
        <li>Strong knowledge of Cisco Nexus, ASR and Catalyst routing and switching platforms</li>
      </ul>
      <p><strong>Location:</strong> Bangalore</p>
      <p><strong>Shift timings</strong>: 2 PM to 11 PM</p>
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
      <h3>Job Description:</h3>
      <p><strong>Job Title</strong> – <strong>Principal Network Engineer</strong></p>
      <p><strong>The Purpose of This Role</strong></p>
      <p>As Principal Network Engineer in the Network Security Engineering team you will be responsible for engineering and management of network security infrastructure for Fidelity Investments globally.</p>
      <p><strong>The Skills that are Key to this role</strong></p>
      <ul>
        <li>Strong knowledge and working experience with Juniper SRX, Check Point and Cisco Firepower security appliances</li>
        <li>Strong knowledge of Cisco Nexus, ASR and Catalyst routing and switching platforms</li>
      </ul>
      <p><strong>Location:</strong> Chennai</p>
      <p><strong>Shift timings</strong>: 2 PM to 11 PM</p>
    ]]></description>
    <jobtype><![CDATA[Regular]]></jobtype>
    <category><![CDATA[Technology]]></category>
  </job>
</source>`

const loadModule = async () => {
  try {
    return await import('../../scraper/fedilityinvestments/script.js')
  } catch {
    assert.fail('Expected Fedility Investments scraper module at ../../scraper/fedilityinvestments/script.js')
  }
}

test('historical spelling exports canonical employer and current guarded helpers; challenge is diagnostic only',async()=>{const m=await loadModule(),f=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/fidelity/fixtures/native-20261021.json.gz',import.meta.url))));assert.equal(m.SOURCE,'fedilityinvestments');assert.equal(m.CANONICAL_SOURCE,'fidelity');assert.equal(m.COMPANY,'Fidelity Investments');assert.equal(m.VERIFIED_ON,null);assert.equal(m.JOBS_PAGE_URL,JOBS_PAGE_URL);assert.equal(m.JOBS_XML_URL,JOBS_XML_URL);assert.equal(m.hasOfficialJobsPageSignal(f.board),true);assert.equal(m.hasOfficialJobsPageSignal(cloudflareChallengeHtml),false);assert.equal(m.hasCloudflareChallengePageSignal(cloudflareChallengeHtml),true);assert.equal(m.hasOfficialJobsFeedSignal(f.feed,{now:f.checkedAt}),true)})

test('extractJobsFromFeed parses the verified Fidelity India XML feed and merges duplicate multi-location roles', async () => {
  const fedilityInvestments = await loadModule()
  const jobs = fedilityInvestments.extractJobsFromFeed(jobsXml)

  assert.equal(jobs.length, 2)

  assert.deepEqual(jobs[0], {
    title: 'Lead Software Engineer',
    company: 'Fidelity Investments',
    department: 'Technology',
    location: 'Bangalore, Karnataka, India',
    city: 'Bangalore',
    state: 'Karnataka',
    country: 'India',
    jobId: '2131693',
    requisitionId: '2131693',
    sourceUrl: 'https://jobs.fidelity.com/in/jobs/2131693/lead-software-engineer/',
    applyUrl: 'https://jobs.fidelity.com/in/jobs/2131693/lead-software-engineer/',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Bachelor’s Degree in Computer Science / similar technical subject area and or equivalent experience',
      '5+ years of experience as a Power BI Developer with a strong portfolio of built reports, dashboards, and visualizations.',
      'Strong problem solving & collaboration skills',
      'Excellent communication skills required',
    ],
    postingDate: '2026-07-14T00:00:00.000Z',
    closingDate: null,
    jobDescription: "Job Description: Job Title: Lead - Software Engineering The Team Fidelity's Workplace Investing Reporting and Analytics chapter is seeking a Senior PowerBI Developer. The Expertise You Have Bachelor’s Degree in Computer Science / similar technical subject area and or equivalent experience 5+ years of experience as a Power BI Developer with a strong portfolio of built reports, dashboards, and visualizations. The Skills You Bring Strong problem solving & collaboration skills Excellent communication skills required Location: Bangalore Shift timings: 11:00 am - 8:00pm",
  })

  assert.deepEqual(jobs[1], {
    title: 'Principal Network Engineer',
    company: 'Fidelity Investments',
    department: 'Technology',
    location: 'Bangalore, Karnataka, India; Chennai, Tamil Nadu, India',
    city: 'Bangalore',
    state: 'Karnataka',
    country: 'India',
    jobId: '2130302',
    requisitionId: '2130302',
    sourceUrl: 'https://jobs.fidelity.com/in/jobs/2130302/principal-network-engineer/',
    applyUrl: 'https://jobs.fidelity.com/in/jobs/2130302/principal-network-engineer/',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Strong knowledge and working experience with Juniper SRX, Check Point and Cisco Firepower security appliances',
      'Strong knowledge of Cisco Nexus, ASR and Catalyst routing and switching platforms',
    ],
    postingDate: '2026-06-24T00:00:00.000Z',
    closingDate: null,
    jobDescription: 'Job Description: Job Title - Principal Network Engineer The Purpose of This Role As Principal Network Engineer in the Network Security Engineering team you will be responsible for engineering and management of network security infrastructure for Fidelity Investments globally. The Skills that are Key to this role Strong knowledge and working experience with Juniper SRX, Check Point and Cisco Firepower security appliances Strong knowledge of Cisco Nexus, ASR and Catalyst routing and switching platforms Location: Bangalore Shift timings: 2 PM to 11 PM',
  })
})

const nativeOptions=(change=()=>{})=>{const f=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/fidelity/fixtures/runtime-native-20261021.json.gz',import.meta.url)))),used=new Set();return{now:f.checkedAt,fetchPage:async url=>{const at=f.packets.findIndex((p,i)=>!used.has(i)&&p.url===url);assert.ok(at>=0,'Uncaptured request '+url);used.add(at);const p=structuredClone(f.packets[at]);change(p);return{status:p.status,url:p.finalURL,body:p.body}}}}
test('historical spelling delegates native extraction and preserves canonical source/company on all14 roles',async()=>{const m=await loadModule(),o=nativeOptions(),jobs=await m.createFedilityInvestmentsScraper().run(o);assert.equal(jobs.length,14);assert.ok(jobs.every(j=>j.source==='fidelity'&&j.company==='Fidelity Investments'&&j.scrapedAt===o.now&&j.sourceDetailComplete&&!j.sourceListingComplete))})

test('current runtime rejects challenge and changed native publisher rather than inheriting historical14',async()=>{const m=await loadModule();for(const change of [p=>{p.body=cloudflareChallengeHtml},p=>{if(p.url.includes('/xml/'))p.body=p.body.replace('Fidelity Investments Careers','Other Careers')}])await assert.rejects(m.createFedilityInvestmentsScraper().run(nativeOptions(change)))})
