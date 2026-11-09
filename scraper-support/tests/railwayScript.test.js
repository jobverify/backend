import assert from 'node:assert/strict'
import test from 'node:test'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Railway</title>
  </head>
  <body>
    <main>
      <h1>Redefine the future of infrastructure</h1>
      <p>See open positions</p>
      <a href="/careers/infra-platform">
        <p>Senior Infra Engineer: Platform</p>
        <p>Remote (anywhere)</p>
      </a>
      <a href="/careers/platform-engineer-storage">
        <p>Senior Infra Engineer: Storage</p>
        <p>Remote (anywhere)</p>
      </a>
      <a href="/careers/platform-engineer-instrumentation">
        <p>Senior Infra Engineer: Observability</p>
        <p>Remote (anywhere)</p>
      </a>
      <a href="/careers/dc-engineer">
        <p>Senior Infra Engineer: Datacenters</p>
        <p>Remote (anywhere)</p>
      </a>
    </main>
  </body>
</html>
`

const remoteRoleChurnCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Railway</title>
  </head>
  <body>
    <main>
      <h1>Redefine the future of infrastructure</h1>
      <p>See open positions</p>
      <a href="/careers/platform-engineer-orchestration">
        <p>Senior Infra Engineer: Orchestration</p>
        <p>Remote (anywhere)</p>
      </a>
      <a href="/careers/systems-engineer">
        <p>Senior Infra Engineer: Compute</p>
        <p>Remote (anywhere)</p>
      </a>
      <a href="/careers/product-marketer">
        <p>Senior Product Marketer</p>
        <p>Remote (anywhere)</p>
      </a>
      <a href="/careers/brand-designer-web">
        <p>Brand Designer - Web Experience</p>
        <p>Remote (anywhere)</p>
      </a>
    </main>
  </body>
</html>
`

const loadRailwayModule = async () => {
  try {
    return await import('../../scraper/railway/script.js')
  } catch {
    assert.fail('Expected Railway scraper module at ../../scraper/railway/script.js')
  }
}

test('Railway pins the verified first-party careers page and same-domain role links', async () => {
  const railway = await loadRailwayModule()

  assert.equal(railway.SOURCE, 'railway')
  assert.equal(railway.COMPANY, 'Railway')
  assert.equal(railway.COMPANY_DOMAIN, 'railway.com')
  assert.equal(railway.CAREERS_URL, 'https://railway.com/careers')
  assert.equal(railway.VERIFIED_AT, '2026-10-03')
  assert.equal(railway.hasVerifiedCareersPageSignal(careersHtml), true)
  assert.deepEqual(railway.extractRoleSummaries(careersHtml), [
    {
      title: 'Senior Infra Engineer: Platform',
      location: 'Remote (anywhere)',
      url: 'https://railway.com/careers/infra-platform',
    },
    {
      title: 'Senior Infra Engineer: Storage',
      location: 'Remote (anywhere)',
      url: 'https://railway.com/careers/platform-engineer-storage',
    },
    {
      title: 'Senior Infra Engineer: Observability',
      location: 'Remote (anywhere)',
      url: 'https://railway.com/careers/platform-engineer-instrumentation',
    },
    {
      title: 'Senior Infra Engineer: Datacenters',
      location: 'Remote (anywhere)',
      url: 'https://railway.com/careers/dc-engineer',
    },
  ])
})

test('Railway accepts same-domain remote role title churn while the India slice remains empty', async () => {
  const railway = await loadRailwayModule()

  assert.equal(railway.hasVerifiedCareersPageSignal(remoteRoleChurnCareersHtml), true)
  assert.deepEqual(railway.extractRoleSummaries(remoteRoleChurnCareersHtml), [
    {
      title: 'Senior Infra Engineer: Orchestration',
      location: 'Remote (anywhere)',
      url: 'https://railway.com/careers/platform-engineer-orchestration',
    },
    {
      title: 'Senior Infra Engineer: Compute',
      location: 'Remote (anywhere)',
      url: 'https://railway.com/careers/systems-engineer',
    },
    {
      title: 'Senior Product Marketer',
      location: 'Remote (anywhere)',
      url: 'https://railway.com/careers/product-marketer',
    },
    {
      title: 'Brand Designer - Web Experience',
      location: 'Remote (anywhere)',
      url: 'https://railway.com/careers/brand-designer-web',
    },
  ])

  const jobs = await railway.createRailwayScraper().run({
    fetchText: async () => remoteRoleChurnCareersHtml,
  })

  assert.deepEqual(jobs, [])
})

test('Railway returns an honest empty array while the verified first-party roles stay outside India', async () => {
  const railway = await loadRailwayModule()
  const requestedUrls = []

  const jobs = await railway.createRailwayScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, [railway.CAREERS_URL])
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 4)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
})

test('Railway fails closed when the verified careers surface drifts or the India slice changes', async () => {
  const railway = await loadRailwayModule()

  await assert.rejects(
    railway.createRailwayScraper().run({
      fetchText: async () => '<html><title>Unexpected</title></html>',
    }),
    /careers page/i,
  )

  await assert.rejects(
    railway.createRailwayScraper().run({
      fetchText: async () => careersHtml.replace('Remote (anywhere)', 'Bengaluru, India'),
    }),
    /india slice/i,
  )
})
