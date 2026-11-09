import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  extractPublicRoles,
  hasOfficialCareersPageSignal,
  run,
} from '../../scraper/filo/script.js'

const currentEmptyHtml = `
  <html lang="en-US"><head>
    <link rel="canonical" href="https://askfilo.com/careers">
    <title>Job Opportunities At Filo. Check For Recent Career Options</title>
  </head><body>
    <h1>Career at Filo</h1><h3>JOIN OUR TEAM</h3>
    <p>Departments</p><option>All Departments</option>
    <footer>© Copyright Filo EdTech INC. 2025</footer>
    <script id="__NEXT_DATA__" type="application/json">{
      "props":{
        "userCountryCode":"GR",
        "pageProps":{
          "countryCode":"GR",
          "data":[{"departmentId":0,"departmentName":"All Departments","jobs":[]}]
        }
      },
      "page":"/careers"
    }</script>
  </body></html>
`

test('Filo accepts the current explicit empty department-array payload', async () => {
  assert.equal(hasOfficialCareersPageSignal(currentEmptyHtml), true)
  assert.deepEqual(extractPublicRoles(currentEmptyHtml), [])
  const jobs = await run({
    fetchText: async (url) => {
      assert.equal(url, CAREERS_URL)
      return currentEmptyHtml
    },
  })
  assert.deepEqual(jobs, [])
})

const listing = (id, title, slug) => ({ id, jobTitle: title, slug })
const departments = [
  { departmentId: 0, departmentName: 'All Departments', jobs: [
    listing(18, 'Internship- Academic Content Research', 'internship-academic-content-research-60'),
    listing(45, 'Manager- Government Partnerships (Maharshtra)', 'manager-government-partnerships-maharshtra-42'),
    listing(44, 'Manager- Government Partnerships (Maharshtra)', 'manager-government-partnerships-maharshtra-56'),
  ] },
  { departmentId: 8, departmentName: 'Academics', jobs: [
    listing(18, 'Internship- Academic Content Research', 'internship-academic-content-research-60'),
  ] },
  { departmentId: 22, departmentName: 'Sales', jobs: [
    listing(45, 'Manager- Government Partnerships (Maharshtra)', 'manager-government-partnerships-maharshtra-42'),
    listing(44, 'Manager- Government Partnerships (Maharshtra)', 'manager-government-partnerships-maharshtra-56'),
  ] },
]
const currentHtml = currentEmptyHtml.replace(
  '"countryCode":"GR",\n          "data":[{"departmentId":0,"departmentName":"All Departments","jobs":[]}]',
  `"countryCode":"US",\n          "data":${JSON.stringify(departments)}`,
)
const detailUrl = (slug) => `${CAREERS_URL}/${Buffer.from(slug).toString('base64')}`
const detailHtml = (listingEntry, departmentId, location, applyId) => `
  <html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: { pageProps: { data: {
      id: listingEntry.id,
      department_id: departmentId,
      job_title: listingEntry.jobTitle,
      job_description: `# ${listingEntry.jobTitle}\n\n- **Job Location:** ${location}  \n- **Experience:** 0-1 Years  \n- **Job Type:** Full-time\n\nA real role description.`,
      apply_link: `https://filorians.tools.findfilo.com/hiring/apply/${applyId}`,
      is_deleted: false,
      slug: listingEntry.slug,
      location: '',
      created_at: '2026-09-25T07:53:09Z',
    } } },
  })}</script></html>
`

test('Filo publishes current India roles and collapses repeated IDs with the same application', async () => {
  const roles = extractPublicRoles(currentHtml)
  assert.equal(roles.length, 3)
  const requestedUrls = []
  const jobs = await run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === CAREERS_URL) return currentHtml
      for (const group of departments.slice(1)) {
        for (const entry of group.jobs) {
          if (url === detailUrl(entry.slug)) {
            return detailHtml(entry, group.departmentId, entry.id === 18 ? 'Gurgaon' : 'Maharasthra', entry.id === 18 ? 33 : 58)
          }
        }
      }
      throw new Error(`Unexpected Filo URL: ${url}`)
    },
    now: () => '2026-10-03T00:00:00.000Z',
  })
  assert.equal(requestedUrls.length, 4)
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs.map((job) => job.country), ['India', 'India'])
  assert.deepEqual(jobs.map((job) => job.location), ['Gurgaon', 'Maharasthra'])
  assert.equal(jobs[0].jobId, '18')
  assert.equal(jobs[0].sourceUrl, detailUrl(departments[1].jobs[0].slug))
  assert.equal(jobs[0].applyUrl, 'https://filorians.tools.findfilo.com/hiring/apply/33')
  assert.equal(jobs[0].experienceRequired, '0-1 Years')
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.equal(jobs[0].postingDate, '2026-09-25')
})

test('Filo fails closed on mismatched current details or ambiguous location', async () => {
  const first = departments[1].jobs[0]
  for (const badDetail of [
    detailHtml({ ...first, jobTitle: 'Different role' }, 8, 'Gurgaon', 33),
    detailHtml(first, 8, 'Unknown', 33),
  ]) {
    await assert.rejects(run({
      fetchText: async (url) => url === CAREERS_URL ? currentHtml : badDetail,
    }), /current role detail|India location/i)
  }
})

test('Filo accepts the current published Jammu and Kashmir role without inventing a city', async () => {
  const { readFile } = await import('node:fs/promises')
  const { extractCurrentRoleDetails } = await import('../../scraper/filo/script.js')
  const html = await readFile(new URL('./fixtures/filo/jammu-kashmir-role-20261009.html', import.meta.url), 'utf8')
  const detail = extractCurrentRoleDetails(html, { id: 49, departmentId: 22, slug: 'manager-government-partnerships-jammu-and-kashmir-30', title: 'Manager- Government Partnerships( Jammu and Kashmir)' })
  assert.equal(detail.location, 'Jammu and Kashmir')
  assert.equal(detail.city, null)
  assert.equal(detail.applyUrl, 'https://filorians.tools.findfilo.com/hiring/apply/62')
  assert.ok(detail.jobDescription.length > 1000)
})
