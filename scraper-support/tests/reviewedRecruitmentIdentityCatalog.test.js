import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {getScraperCatalog,loadProviderExtensions,DEFAULT_PROVIDER_EXTENSION_DIR} from '../providers/index.js'

const loadOriginal = suffix => {
  const files = fs.readdirSync(DEFAULT_PROVIDER_EXTENSION_DIR).filter(file => file.endsWith(suffix))
  assert.equal(files.length, 1)
  return JSON.parse(fs.readFileSync(path.join(DEFAULT_PROVIDER_EXTENSION_DIR, files[0])))[0]
}
const discovery = JSON.parse(fs.readFileSync(path.join(DEFAULT_PROVIDER_EXTENSION_DIR, 'zzzz-official-surface-discovery.json')))
const catalog = getScraperCatalog()
const cases = [
  ['crestdatasystems', '-verified-discovery-adapters-00037.json', 'https://www.crestdata.ai/careers/open-positions/', 'crestdata.ai', 'Crest Data Systems'],
  ['credoai', '-verified-discovery-adapters-00038.json', 'https://www.credo.ai/company/jobs', 'credo.ai', 'Credo AI'],
]

for (const [source, suffix, careerPage, domain, companyName] of cases) test(source + ' keeps reviewed recruitment identity after discovery override precedence', () => {
  const original = loadOriginal(suffix), provider = catalog.find(row => row.source === source)
  assert.equal(provider.bindingEvidence.verified, true, 'Reviewed native recruitment identity must survive older discovery-only metadata')
  assert.equal(provider.officialBindingVerifiedAt, original.officialBindingVerifiedAt)
  for (const field of ['checkedAt', 'officialURL', 'matchedLinks', 'proofs', 'bindingMethod']) assert.deepEqual(provider.bindingEvidence[field], original.bindingEvidence[field])
  assert.equal(provider.bindingEvidence.runtimeInventoryQualified, false)
  assert.deepEqual(provider.bindingEvidence.discoveryEvidence, discovery.find(row => row.source === source).bindingEvidence)
  assert.equal(provider.bindingEvidence.metadataConsistencyRepair.id, 'reviewed-recruitment-identity-precedence-041')
  assert.equal(provider.bindingEvidence.metadataConsistencyRepair.newNativeObservation, false)
  assert.equal(provider.remediationStatus, 'implemented-local-offline-reviewed-ordinary-http-failed')
  assert.equal(provider.runtimeQualification, 'ordinary-http-failed-no-current-runtime-qualification')
  assert.equal(provider.companyCareerPage, careerPage)
  assert.equal(provider.companyDomain, domain)
  assert.equal(provider.companyName, companyName)
  assert.equal(provider.adapter, 'script')
})

test('reviewed identity does not activate an inventory snapshot or another registered employer', () => {
  for (const [source] of cases) {
    assert.equal(catalog.filter(row => row.source === source).length, 1)
    const provider = catalog.find(row => row.source === source)
    for (const field of ['verifiedOn', 'verifiedAt', 'verifiedPublicJobCount', 'verifiedIndiaJobCount']) assert.equal(provider[field], null)
    assert.equal(provider.verifiedInventoryStatus, 'unverified')
    assert.equal(provider.sourceScopeComplete, false)
    assert.equal(provider.zeroResultPolicy, 'evidence-required')
    assert.equal(provider.backfillMode, 'live-parser')
  }
  const overlays = loadProviderExtensions().filter(row => row.bindingEvidence?.metadataConsistencyRepair?.id === 'reviewed-recruitment-identity-precedence-041')
  if (!overlays.length) return // The two identity regressions above provide the pre-fix failure.
  assert.deepEqual(overlays.map(row => row.source), cases.map(([source]) => source))
  const allowed = new Set(['source', 'catalogOverride', 'bindingEvidence', 'officialBindingVerifiedAt', 'remediationStatus', 'runtimeQualification', 'verificationDisposition', 'verifiedSurfaceSummary'])
  for (const overlay of overlays) {
    assert.equal(overlay.catalogOverride, true)
    assert.ok(Object.keys(overlay).every(field => allowed.has(field)), 'Documentary identity repair must not override executable or decorated job fields')
  }
})
