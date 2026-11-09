import assert from 'node:assert/strict'
import test from 'node:test'

const loadCloudThatModule = async () => {
  try {
    return await import('../../scraper/cloudthat/script.js')
  } catch {
    return null
  }
}

test('CloudThat exports provider metadata that is ready to be wired into the shared scraper catalog', async () => {
  const cloudthat = await loadCloudThatModule()
  assert.ok(cloudthat)

  assert.deepEqual(cloudthat.PROVIDER_METADATA, {
    source: 'cloudthat',
    companyName: 'CloudThat',
    companyCareerPage: 'https://cloudthat.keka.com/careers',
    companyDomain: 'cloudthat.com',
    adapter: 'script',
    atsPlatform: 'keka-embed-api',
    modulePath: '../../scraper/cloudthat/script.js',
    dryRunFile: 'cloudthat/jobs.json',
  })
})
