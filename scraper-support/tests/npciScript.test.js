import { makeZohoFixture, zohoFixtureOptions } from './fixtures/zohoNativeOptions.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const loadNpciModule = async () => {
  try {
    return await import('../../scraper/npci/script.js')
  } catch {
    assert.fail('Expected NPCI scraper module at ../../scraper/npci/script.js')
  }
}

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs at NPCI</title>
    <meta property="og:url" content="https://careers.npci.org.in/jobs/Careers">
  </head>
  <body>
    <input type="hidden" id="pageJson" value="{&quot;portalName&quot;:&quot;Careers&quot;}">
    <input type="hidden" id="moduleMeta" value="[{&quot;api_name&quot;:&quot;Job_Openings&quot;}]">
    <input type="hidden" id="jobs" value="[
      {&#34;Posting_Title&#34;:&#34;Lead Platform Engineer&#34;,&#34;Job_Description&#34;:&#34;Build resilient payments platform services.&#34;,&#34;Work_Experience&#34;:&#34;6 - 10 years&#34;,&#34;Job_Type&#34;:&#34;Full Time&#34;,&#34;Department&#34;:&#34;Technology&#34;,&#34;Country&#34;:&#34;India&#34;,&#34;State&#34;:&#34;Maharashtra&#34;,&#34;City&#34;:&#34;Mumbai&#34;,&#34;Job_Location&#34;:&#34;Mumbai, Maharashtra, India&#34;,&#34;id&#34;:&#34;730000000123456&#34;,&#34;Publish&#34;:true,&#34;Keep_on_Career_Site&#34;:true},
      {&#34;Posting_Title&#34;:&#34;Regional Operations Lead&#34;,&#34;Job_Description&#34;:&#34;Coordinate non-India operations.&#34;,&#34;Work_Experience&#34;:&#34;8 - 12 years&#34;,&#34;Job_Type&#34;:&#34;Full Time&#34;,&#34;Department&#34;:&#34;Operations&#34;,&#34;Country&#34;:&#34;Singapore&#34;,&#34;State&#34;:&#34;Singapore&#34;,&#34;City&#34;:&#34;Singapore&#34;,&#34;Job_Location&#34;:&#34;Singapore&#34;,&#34;id&#34;:&#34;730000000123457&#34;,&#34;Publish&#34;:true,&#34;Keep_on_Career_Site&#34;:true},
      {&#34;Posting_Title&#34;:&#34;Closed India Role&#34;,&#34;Job_Description&#34;:&#34;Should not be listed.&#34;,&#34;Work_Experience&#34;:&#34;3 - 5 years&#34;,&#34;Job_Type&#34;:&#34;Full Time&#34;,&#34;Department&#34;:&#34;Risk&#34;,&#34;Country&#34;:&#34;India&#34;,&#34;State&#34;:&#34;Karnataka&#34;,&#34;City&#34;:&#34;Bengaluru&#34;,&#34;Job_Location&#34;:&#34;Bengaluru, Karnataka, India&#34;,&#34;id&#34;:&#34;730000000123458&#34;,&#34;Publish&#34;:false,&#34;Keep_on_Career_Site&#34;:false}
    ]">
  </body>
</html>
`

const currentPortalHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Openings at NPCI</title>
    <meta property="og:url" content="https://careers.npci.org.in/jobs/Careers">
  </head>
  <body>
    <input type="hidden" id="pageJson" value="{&quot;portalName&quot;:&quot;Careers&quot;}">
    <input type="hidden" id="moduleMeta" value="[{&quot;api_name&quot;:&quot;Job_Openings&quot;}]">
    <input type="hidden" value="[
      {&#34;Posting_Title&#34;:&#34;Lead Platform Engineer&#34;,&#34;Job_Description&#34;:&#34;Build resilient payments platform services.&#34;,&#34;Work_Experience&#34;:&#34;6 - 10 years&#34;,&#34;Job_Type&#34;:&#34;Full Time&#34;,&#34;Department&#34;:&#34;Technology&#34;,&#34;Country&#34;:&#34;India&#34;,&#34;State&#34;:&#34;Maharashtra&#34;,&#34;City&#34;:&#34;Mumbai&#34;,&#34;Job_Location&#34;:&#34;Mumbai, Maharashtra, India&#34;,&#34;id&#34;:&#34;730000000123456&#34;,&#34;Publish&#34;:true,&#34;Keep_on_Career_Site&#34;:true}
    ]">
  </body>
</html>
`

test('NPCI constants and official portal signal stay pinned to the verified careers page', async () => {
  const npci = await loadNpciModule()

  assert.equal(npci.CAREERS_PORTAL_URL, 'https://careers.npci.org.in/jobs/Careers')
  assert.equal(npci.COMPANY, 'National Payments Corporation of India')
  assert.equal(npci.SOURCE, 'npci')
  assert.equal(npci.hasOfficialPortalSignal(careersHtml), true)
  assert.equal(npci.hasOfficialPortalSignal(currentPortalHtml), true)
})

test('extractIndiaJobs reads embedded NPCI openings and filters out closed or non-India roles', async () => {
  const npci = await loadNpciModule()

  assert.deepEqual(npci.extractIndiaJobs(careersHtml), [
    {
      title: 'Lead Platform Engineer',
      company: 'National Payments Corporation of India',
      department: 'Technology',
      location: 'Mumbai, Maharashtra, India',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      jobId: '730000000123456',
      requisitionId: '730000000123456',
      sourceUrl: 'https://careers.npci.org.in/jobs/Careers/730000000123456/Lead-Platform-Engineer?source=CareerSite',
      applyUrl: 'https://careers.npci.org.in/jobs/Careers/730000000123456/Lead-Platform-Engineer?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: '6 - 10 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Build resilient payments platform services.',
    },
  ])

  assert.deepEqual(npci.extractIndiaJobs(currentPortalHtml), [
    {
      title: 'Lead Platform Engineer',
      company: 'National Payments Corporation of India',
      department: 'Technology',
      location: 'Mumbai, Maharashtra, India',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      jobId: '730000000123456',
      requisitionId: '730000000123456',
      sourceUrl: 'https://careers.npci.org.in/jobs/Careers/730000000123456/Lead-Platform-Engineer?source=CareerSite',
      applyUrl: 'https://careers.npci.org.in/jobs/Careers/730000000123456/Lead-Platform-Engineer?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: '6 - 10 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Build resilient payments platform services.',
    },
  ])
})

test('NPCI factory reads full native NPCI-entity details and decorates runner fields', async () => {
  const npci = await loadNpciModule(), data = makeZohoFixture('npci')
  const jobs = await npci.createNpciScraper({ maxJobs: 1 }).run(zohoFixtureOptions(data))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'npci')
  assert.equal(jobs[0].nativeEmployerEntity, 'NPCI')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].link, data.details[data.rows[0].id].$appy_url)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})
