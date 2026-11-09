import assert from 'node:assert/strict'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { getScraperCatalog } from '../providers/index.js'

test('Meidatek should be handled by the existing MediaTek provider via central alias mapping, not a duplicate provider', () => {
  const mediatek = getScraperCatalog().find((item) => item.source === 'mediatek')
  const exactNameProvider = getScraperCatalog().find((item) => item.source === 'meidatek')

  assert.ok(mediatek)
  assert.equal(mediatek.adapter, 'script')
  assert.equal(mediatek.companyName, 'MediaTek')
  assert.equal(mediatek.atsPlatform, 'nextjs-trpc-job-api')
  assert.equal(mediatek.companyCareerPage, 'https://careers.mediatek.com/en/jobs')
  assert.equal(mediatek.jobsApiUrl, 'https://careers.mediatek.com/api/trpc/job.getJobs')
  assert.equal(mediatek.verifiedOn, '2026-08-03')
  assert.equal(mediatek.verifiedPublicJobCount, 24)
  assert.equal(exactNameProvider, undefined)

  const report = generateCompanyCoverageReport({
    csvText: 'Meidatek\n',
    catalog: getScraperCatalog(),
    aliasMap: {
      Meidatek: 'mediatek',
    },
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Meidatek', 'mediatek', 'MediaTek']],
  )
})

test('Meidatek should not introduce a second local runner when the existing MediaTek scraper is already runnable', async () => {
  const mediatek = getScraperCatalog().find((item) => item.source === 'mediatek')
  const module = await import(pathToFileURL(mediatek.modulePath).href)

  assert.ok(mediatek)
  assert.match(mediatek.modulePath, /mediatek[\\/]script\.js$/i)
  assert.equal(typeof module.run, 'function')
})
