import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {gunzipSync} from 'node:zlib'

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const {mapPeopleStrongPairRole: map} = await import(pathToFileURL(path.join(backend, 'scraper-support/shared/peopleStrongNativePair20261027.js')))
const packets = JSON.parse(gunzipSync(fs.readFileSync(path.join(backend, 'scraper/amararajaenergymobility/test-data/native-20261103.json.gz'))))
const packet = part => {
  const value = packets.find(row => row.url.includes(part))
  assert.ok(value)
  return value
}
const detailPacket = packet('/v2?part=')
const original = {
  listing: JSON.parse(packet('jobs/v1?offset=0').bodyText).response[0],
  detail: JSON.parse(detailPacket.bodyText).response,
  organization: JSON.parse(packet('organizationDetails').bodyText).response,
}
const fields = ['minSalary', 'maxSalary', 'minBudgetSalary', 'maxBudgetSalary', 'currency', 'ctcRange', 'CTCRange']
const invoke = models => map('amararajaenergymobility', models.listing, models.detail, models.organization, {
  organizationRequestJobCode: models.listing.jobCode,
  now: detailPacket.completedAt,
})
const clean = () => {
  const models = structuredClone(original)
  for (const model of Object.values(models)) for (const field of fields) delete model[field]
  return models
}

test('dated native pay carriers and full models survive without changing employer or inventing normalization', () => {
  const models = structuredClone(original), role = invoke(models)
  assert.equal(original.listing.jobCode, 'P-8543')
  assert.equal(detailPacket.completedAt, '2026-11-02T20:26:43.148Z')
  assert.deepEqual(role.sourceNativeOriginalModels, original)
  assert.equal(role.sourceNativeCompensation.original.detail.minSalary, '300000')
  assert.equal(role.sourceNativeCompensation.original.organization.maxSalary, 600000)
  assert.equal(role.sourceNativeCompensation.original.organization.ctcRange, '3,00,000 - 6,00,000')
  assert.equal(role.sourceNativeCompensation.normalized, null)
  assert.equal(role.sourceNativeCompensation.qualified, true)
  assert.equal(role.sourceDetailComplete, true)
  assert.equal(role.nativeRoleCompany, 'Mangal Industries Limited')
  assert.equal(role.targetEmployer, false)
  assert.equal(role.country, 'India')
  models.detail.minSalary = '1'
  models.organization.workSiteHierarchy[0].orgUnitName = 'changed after mapping'
  assert.deepEqual(role.sourceNativeOriginalModels, original)
  assert.equal(role.sourceNativeCompensation.original.detail.minSalary, '300000')
})

for (const [minimum, maximum] of [['minSalary', 'maxSalary'], ['minBudgetSalary', 'maxBudgetSalary']]) {
  for (const [minOwner, maxOwner] of [['listing', 'detail'], ['detail', 'organization'], ['organization', 'listing']]) {
    test(`split inverted ${minimum}/${maximum} in ${minOwner}/${maxOwner} holds the role with all originals retained`, () => {
      const models = clean()
      models[minOwner][minimum] = '700000'
      models[maxOwner][maximum] = 600000
      const role = invoke(models)
      assert.equal(role.sourceDetailComplete, false)
      assert.equal(role.sourceDetailStatus, 'partial')
      assert.equal(role.sourceNativeCompensation.qualified, false)
      assert.ok(role.sourceNativeCompensation.issues.some(issue => issue.reason === 'original-native-compensation-range-inverted'))
      assert.deepEqual(role.sourceNativeOriginalModels, models)
    })
  }
}

test('valid split bounds agree across numeric representations and preserve exact native types', () => {
  const models = clean()
  models.listing.minSalary = '0300000.00'
  models.detail.maxSalary = 600000
  models.organization.minSalary = 300000
  const role = invoke(models)
  assert.equal(role.sourceNativeCompensation.qualified, true)
  assert.equal(role.sourceDetailComplete, true)
  assert.equal(role.sourceNativeCompensation.original.listing.minSalary, '0300000.00')
  assert.equal(role.sourceNativeCompensation.original.organization.minSalary, 300000)
  assert.equal(role.sourceNativeCompensation.normalized, null)
})

test('salary and budget ranges retain their distinct native meanings', () => {
  const models = clean()
  models.listing.minSalary = '700000'
  models.detail.maxBudgetSalary = '0'
  const role = invoke(models)
  assert.equal(role.sourceNativeCompensation.qualified, true)
  assert.equal(role.sourceDetailComplete, true)
})

test('same-key disagreement holds the role rather than choosing a preferred carrier', () => {
  const models = clean()
  models.listing.minSalary = '300000'
  models.detail.minSalary = '400000'
  const role = invoke(models)
  assert.equal(role.sourceNativeCompensation.qualified, false)
  assert.equal(role.sourceDetailComplete, false)
  assert.deepEqual(role.sourceNativeOriginalModels, models)
})

test('absent pay retains completeness without generating pay fields', () => {
  const role = invoke(clean())
  assert.deepEqual(role.sourceNativeCompensation.original, {listing: {}, detail: {}, organization: {}})
  assert.equal(role.sourceNativeCompensation.status, 'absent')
  assert.equal(role.sourceNativeCompensation.normalized, null)
  assert.equal(role.sourceDetailComplete, true)
})
