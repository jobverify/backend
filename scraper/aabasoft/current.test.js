import assert from 'node:assert/strict'
import test from 'node:test'

import { createAabasoftScraper, CURRENT_CAREERS_URL } from './script.js'

const home = '<html><head><title>Software Development Company Kerala, India | Aabasoft</title></head><body><a href="/in-en/join-our-team/">Join Our Team</a><p>Aabasoft Technologies India Private Limited</p></body></html>'
const careers = '<html><head><title>Join Us to Grow, Innovate and make an Impact. | Aabasoft</title></head><body><input type="hidden" name="pageGuid" value="dc238df7-50a0-42d8-b8d6-b6405817ba82"><div id="jobsGrid"></div><strong>0</strong> Jobs Found <h3>Official Communication</h3></body></html>'
const role = (guid, title, city) => ({
  guid, contentType: 'careerDetails', name: title,
  properties: {
    cdVacancyTitle: { value: title },
    cdJobLocation: { value: [{ name: city }] },
    cdDepartment: { value: [{ name: 'Engineering' }] },
    cdJobType: { value: [{ name: 'Full Time' }] },
    cdPostedDate: { value: '09/09/2026' },
    cdExperience: { value: '2 years' },
    cdDescription: { value: { markup: '<p>Build software.</p>' } },
  },
})
const guid = 'dc238df7-50a0-42d8-b8d6-b6405817ba82'
const pages = [
  { success: true, parent: { guid, name: 'Job Openings' }, pagination: { page: 1, pageSize: 1, totalItems: 2, totalPages: 2 }, items: [role('11111111-1111-4111-8111-111111111111', 'React Developer', 'Kochi')] },
  { success: true, parent: { guid, name: 'Job Openings' }, pagination: { page: 2, pageSize: 1, totalItems: 2, totalPages: 2 }, items: [role('22222222-2222-4222-8222-222222222222', 'Flutter Developer', 'Kannur')] },
]

test('Aabasoft reads the complete current browser API inventory despite the initial zero placeholder', async () => {
  const requested = []
  const jobs = await createAabasoftScraper({ currentPageSize: 1 }).run({
    fetchText: async (url) => url === CURRENT_CAREERS_URL ? careers : home,
    fetchCurrentPage: async (page, pageGuid) => { requested.push([page, pageGuid]); return pages[page - 1] },
    now: () => '2026-10-03T00:00:00.000Z',
  })
  assert.deepEqual(requested, [[1, guid], [2, guid]])
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs.map((job) => job.location), ['Kochi, India', 'Kannur, India'])
  assert.equal(jobs[0].sourceUrl, 'https://aabasoft.com/in-en/join-our-team/react-developer')
})

test('Aabasoft fails closed when a browser API page is missing', async () => {
  await assert.rejects(createAabasoftScraper({ currentPageSize: 1 }).run({
    fetchText: async (url) => url === CURRENT_CAREERS_URL ? careers : home,
    fetchCurrentPage: async (page) => page === 1 ? pages[0] : { ...pages[1], items: [] },
  }), /inventory/i)
})
