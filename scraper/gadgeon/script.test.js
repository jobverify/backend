import assert from 'node:assert/strict'
import test from 'node:test'

const loadGadgeonModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Gadgeon scraper module at ./script.js')
  }
}

const pageData = {
  url: 'https://www.gadgeon.com/joinus/',
  title: 'Join Us | Gadgeon',
  text: 'Current Openings',
  jobs: [
    {
      title: 'Embedded Software Engineer',
      location: 'Kochi, India',
      experienceRequired: '3-5 years',
      department: 'Engineering',
    },
  ],
}

test('Gadgeon listing-only collectors retain observations without inventing a posting identity', async () => {
  const gadgeon = await loadGadgeonModule()
  const requestedUrls = []
  const audits = []

  const jobs = await gadgeon.createGadgeonScraper({ maxJobs: 1 }).run({
    collectPageDataImpl: async (url) => {
      requestedUrls.push(url)
      return pageData
    },
    onAudit: audit => audits.push(audit),
  })

  assert.deepEqual(requestedUrls, [gadgeon.CAREERS_PAGE_URL])
  assert.equal(jobs.length, 0)
  assert.equal(audits[0].observations.length, 1)
  assert.equal(audits[0].observations[0].original.title, 'Embedded Software Engineer')
  assert.equal(audits[0].observations[0].country, null)
})
