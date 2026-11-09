import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CAREERS_URL,
  HOMEPAGE_URL,
  createLifeSignsScraper,
  extractVerifiedOpenRoles,
  fetchOpenRoles,
  hasOfficialHomepageSignal,
  hasOfficialCareersSignal,
} from './script.js'

const home = {
  status: 200, url: HOMEPAGE_URL,
  title: 'AI Patient Monitoring System, Ambulance to Home | Lifesigns',
  text: 'AI-powered patient monitoring. Predictive intelligence and continuous monitoring.',
  links: ['/careers/'],
}
const careers = {
  status: 200, url: CAREERS_URL,
  title: 'Careers at Lifesigns | Challenge convention | Lifesigns',
  text: 'We challenge convention. See open roles. Explore our open roles. Didn’t see the role you’re looking for? Leave a message.',
}
const item = (slug = 'junior-video-editor', title = 'Junior Video Editor') => ({
  id: `wix-${slug}`,
  dataCollectionId: 'OpenRoles',
  data: {
    slug, title, location: 'Chennai', employmentType: 'Full-Time',
    _publishDate: '2026-09-15T00:00:00.000Z',
    body: { nodes: [{ type: 'PARAGRAPH', nodes: [{ type: 'TEXT', textData: { text: 'Edit product videos.' } }] }] },
  },
})
const detail = (slug = 'junior-video-editor', title = 'Junior Video Editor') => ({
  status: 200, url: `https://www.lifesigns.us/careers/${slug}/`, title: `${title} | Lifesigns`,
})

test('LifeSigns accepts the current official pages and extracts a role from the public feed', () => {
  assert.equal(hasOfficialHomepageSignal(home), true)
  assert.equal(hasOfficialCareersSignal(careers), true)
  const jobs = extractVerifiedOpenRoles(careers, [item()], { '/careers/junior-video-editor/': detail() })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceUrl, detail().url)
  assert.equal(jobs[0].location, null)
  assert.equal(jobs[0].country, null)
  assert.equal(jobs[0].nativeGeographyQualified, false)
  assert.equal(jobs[0].rawNativeWorkplaceEvidence.roleLocation, 'Chennai')
  assert.equal(jobs[0].jobDescription, 'Edit product videos.')
  assert.equal(jobs[0].requisitionId, 'wix-junior-video-editor')
})

test('LifeSigns rejects incomplete pagination, duplicate roles, and mismatched detail pages', async () => {
  const token = { ok: true, json: async () => ({ access_token: 'test-token' }) }
  const incomplete = { ok: true, json: async () => ({ dataItems: [item()], pagingMetadata: { hasNext: true } }) }
  await assert.rejects(fetchOpenRoles(async (url) => url.includes('/oauth2/token') ? token : incomplete), /incomplete/)
  assert.throws(() => extractVerifiedOpenRoles(careers, [item(), item()], { '/careers/junior-video-editor/': detail() }), /duplicate/)
  assert.throws(() => extractVerifiedOpenRoles(careers, [item()], { '/careers/junior-video-editor/': detail('junior-video-editor', 'Other Role') }), /detail page drifted/)
})

test('LifeSigns run uses the live role inventory rather than a pinned list', async () => {
  const role = item('new-role', 'New Role')
  const requested = []
  const jobs = await createLifeSignsScraper().run({
    fetchRoleItems: async () => [role],
    fetchPageSnapshot: async (url) => {
      requested.push(url)
      if (url === HOMEPAGE_URL) return home
      if (url === CAREERS_URL) return careers
      if (url === 'https://www.lifesigns.us/careers/new-role/') return detail('new-role', 'New Role')
      throw new Error(`Unexpected URL: ${url}`)
    },
  })
  assert.deepEqual(requested, [HOMEPAGE_URL, CAREERS_URL, 'https://www.lifesigns.us/careers/new-role/'])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'New Role')
  assert.equal(jobs[0].source, 'lifesigns')
})
