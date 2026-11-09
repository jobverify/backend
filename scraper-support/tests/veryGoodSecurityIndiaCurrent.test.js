import {fixture,replay,editHTML,editJSON,mutateNativePost} from '../native-sources/publicLeverChannels/fixtureReplay.js'
import {syntheticPaginatedVgs} from '../native-sources/publicLeverChannels/testSupport.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const vgs = await import('../../scraper/verygoodsecurityindia/script.js')

const careersHtml = `
  <html><head><title>Careers | VGS</title></head><body>
    <h1>It Takes Exceptional People to Build VGS</h1>
    <a href="#lever-jobs-container">View All Open Roles</a>
    <h2>What We Look For In Every Teammate</h2>
    <p>We're a remote-first company looking for passionate professionals.</p>
    <section class="lever-jobs"><div id="lever-jobs-container"></div>
      <h2>Discover Opportunities</h2></section>
  </body></html>
`

const boardHtml = `
  <html><head><title>VGS</title>
    <meta property="og:url" content="https://jobs.lever.co/verygoodsecurity">
  </head><body><h1>VGS</h1>
    <p>Location type</p><p>Location</p><p>Team</p><p>Work type</p>
    <a href="https://jobs.lever.co/verygoodsecurity/india-role">Apply</a>
    <a href="https://jobs.lever.co/verygoodsecurity/us-role">Apply</a>
    <p>Powered by Lever</p><img alt="Lever logo">
  </body></html>
`

const payload = [
  {
    id: 'india-role', text: 'Senior Software Engineer', country: 'IN',
    createdAt: 1789257600000,
    hostedUrl: 'https://jobs.lever.co/verygoodsecurity/india-role',
    applyUrl: 'https://jobs.lever.co/verygoodsecurity/india-role/apply',
    workplaceType: 'remote',
    categories: {
      team: 'R&D', department: 'Engineering', commitment: 'Full Time',
      location: 'Bengaluru, India', allLocations: ['Bengaluru, India'],
    },
    descriptionPlain: 'Build secure payments infrastructure.',
  },
  {
    id: 'us-role', text: 'Strategic Finance Manager', country: 'US',
    hostedUrl: 'https://jobs.lever.co/verygoodsecurity/us-role',
    applyUrl: 'https://jobs.lever.co/verygoodsecurity/us-role/apply',
    categories: { team: 'G&A', location: 'United States / Canada' },
  },
]

test('VGS current first-party careers and exact Lever surfaces are recognized', () => {
  assert.equal(vgs.LEVER_BOARD_URL, 'https://jobs.lever.co/verygoodsecurity')
  assert.equal(vgs.LEVER_API_URL, 'https://api.lever.co/v0/postings/verygoodsecurity?mode=json')
  assert.equal(vgs.DISPOSITION, 'verified-first-party-careers-plus-public-lever-api')
  assert.equal(vgs.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(vgs.hasOfficialLeverBoardSignal(boardHtml), true)
})

test('VGS maps only explicit India jobs from the Lever API', () => {
  const jobs = vgs.extractIndiaLeverJobs(payload)
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior Software Engineer', company: 'Very Good Security India',
    department: 'R&D', location: 'Bengaluru, India', city: 'Bengaluru',
    country: 'India', jobId: 'india-role', requisitionId: 'india-role',
    sourceUrl: 'https://jobs.lever.co/verygoodsecurity/india-role',
    applyUrl: 'https://jobs.lever.co/verygoodsecurity/india-role/apply',
    employmentType: 'Full Time', experienceRequired: null,
    minimumQualification: null, preferredQualification: null, requiredSkills: [],
    postingDate: '2026-09-13T00:00:00.000Z', closingDate: null,
    jobDescription: 'Build secure payments infrastructure.', remoteStatus: 'Remote',
  })
})

test("VGS run validates the actual current route chain and all original roles before India selection",async()=>{
   const r=replay(),jobs=await vgs.run(r.options),a=r.audits[0]
   assert.equal(a.observations.length,18);assert.equal(jobs.length,0)
   assert.ok(r.requests.includes('https://www.verygoodsecurity.com/careers/engineering'))
   assert.ok(r.requests.includes('https://api.lever.co/v0/postings/verygoodsecurity?group=team&mode=json'))
   assert.equal(a.closing.originalCurrentNativeRoutes.length,2);assert.equal(a.closing.publisherQualified,true)
   assert.equal(a.authoritativeIndiaFacetCount,null)
  
})

test('VGS fails closed on malformed Lever data', () => {
  assert.throws(() => vgs.extractIndiaLeverJobs({ jobs: [] }), /array/i)
})

test('VGS recognizes Poland as foreign in a verified Greece posting', () => {
  const foreign = {
    id: 'greece-poland-role', text: 'Security Engineer', country: 'GR',
    hostedUrl: 'https://jobs.lever.co/verygoodsecurity/greece-poland-role',
    applyUrl: 'https://jobs.lever.co/verygoodsecurity/greece-poland-role/apply',
    categories: { location: 'Greece', allLocations: ['Greece', 'Poland'] },
  }
  assert.deepEqual(vgs.extractIndiaLeverJobs([foreign]), [])
})
