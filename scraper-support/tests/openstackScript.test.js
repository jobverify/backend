import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <title>Open Source Cloud Computing Infrastructure - OpenStack</title>
    <p>An OpenInfra Foundation Project</p>
    <h1>The Most Widely Deployed Open Source Cloud Software in the World</h1>
    <p>OpenStack is developed by the community. For the community.</p>
  </body>
</html>
`

const JOBS_BOARD_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <title>GitJobs</title>
    <h1>Discover Open Source job opportunities</h1>
    <p>Jobs from foundation members</p>
    <p>OPENINFRA</p>
  </body>
</html>
`

const BROKEN_JOBS_BOARD_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Careers</h1>
    <p>Apply now to join OpenStack.</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/openstack/script.js')
  } catch {
    assert.fail('Expected OpenStack scraper module at ../../scraper/openstack/script.js')
  }
}

test('OpenStack scraper constants stay pinned to the verified Saturday, July 25, 2026 project surfaces', async () => {
  const openstack = await loadModule()

  assert.equal(openstack.SOURCE, 'openstack')
  assert.equal(openstack.COMPANY, 'OpenStack')
  assert.equal(openstack.VERIFIED_ON, '2026-07-25')
  assert.equal(openstack.HOMEPAGE_URL, 'https://www.openstack.org/')
  assert.equal(openstack.JOBS_BOARD_URL, 'https://www.openstack.org/community/jobs')
  assert.equal(openstack.hasOpenSourceProjectHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(openstack.hasCommunityJobsBoardSignal(JOBS_BOARD_HTML), true)
  assert.equal(openstack.hasCommunityJobsBoardSignal(BROKEN_JOBS_BOARD_HTML), false)
})

test('OpenStack returns [] while the verified public jobs surface remains a community jobs board', async () => {
  const openstack = await loadModule()
  const requestedUrls = []

  const jobs = await openstack.createOpenStackScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === openstack.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === openstack.JOBS_BOARD_URL) return JOBS_BOARD_HTML
      throw new Error(`Unexpected OpenStack URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    openstack.HOMEPAGE_URL,
    openstack.JOBS_BOARD_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('OpenStack fails closed when the verified homepage or community jobs board changes materially', async () => {
  const openstack = await loadModule()

  await assert.rejects(
    openstack.createOpenStackScraper().run({
      fetchText: async () => JOBS_BOARD_HTML,
    }),
    /homepage changed materially/i,
  )

  await assert.rejects(
    openstack.createOpenStackScraper().run({
      fetchText: async (url) => (url === openstack.HOMEPAGE_URL ? HOMEPAGE_HTML : BROKEN_JOBS_BOARD_HTML),
    }),
    /community jobs board changed materially/i,
  )
})
