import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'
import * as spec from '../../scraper/specindia/script.js'
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('../../test/test-data/recruitmentGoal20261104/spec-current-native.json.gz', import.meta.url))))
test('SPEC current metadata no longer claims July verification', () => {
  assert.equal(spec.SOURCE, 'specindia');assert.equal(spec.COMPANY, 'SPEC INDIA')
  assert.equal(spec.PROVIDER_METADATA.verifiedOn, null)
})
test('SPEC registered path preserves all five native details, explicit office country and unknown formal IDs/dates', async () => {
  const provider = getScraperCatalog().find(row => row.source === 'specindia');let audit
  const jobs = await createCatalogScraper(provider).run({ fetchPage: async (url,init={}) => {
    const page = fixture.packets.find(p=>p.requestedURL===url&&p.method===(init.method||'GET')&&(p.body||null)===(init.body||null));assert.ok(page, url)
    return {...page,url,bodyBase64:Buffer.from(page.bodyText).toString('base64')}
  }, onAudit: value => { audit = value } })
  assert.equal(jobs.length, 5);assert.equal(audit.observations.length, 5)
  assert.ok(jobs.every(job => job.jobDescription && job.country === 'India' && job.postingDate === null && job.requisitionId === null))
  assert.ok(jobs.every(job=>job.jobId===null&&job.nativeCanonicalRoleURL===null&&!job.sourceDetailComplete&&!job.activeApplyVerified))
  assert.ok(jobs.every(job => job.sourceNativeCMSPostId && job.sourceNativeRoleIdentity.originalOpenGraphURLs[0] === job.sourceUrl))
})
