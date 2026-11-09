import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { getScraperCatalog } from '../providers/index.js'

test('companyAliases maps RNTBC to the Renault Nissan Technology and Business Centre scraper', () => {
  assert.equal(companyAliases.RNTBC, 'renaultnissantechnology')
})

test('companyAliases maps Brane Enterprises(NSL Hub) to the NSLHUB (Brane) scraper', () => {
  assert.equal(companyAliases['Brane Enterprises(NSL Hub)'], 'nslhubbrane')
})

test('companyAliases maps SBD India to the SBD Automotive scraper', () => {
  assert.equal(companyAliases['SBD India'], 'sbdautomotive')
})

test('companyAliases maps White Matrix to the WhiteMatrix scraper', () => {
  assert.equal(companyAliases['White Matrix'], 'whitematrix')
})

test('companyAliases maps Quotient Technology to the Neptune Retail Solutions scraper', () => {
  assert.equal(companyAliases['Quotient Technology'], 'neptuneretailsolutions')
})

test('companyAliases maps the ZF India legal entities to the ZF Group scraper', () => {
  assert.equal(companyAliases['ZF Commercial Vehicle Control Systems India Limited'], 'zf')
  assert.equal(companyAliases['ZF Wind Power Coimbatore Private Limited'], 'zf')
})

test('companyAliases maps the expanded VECV company row to the VE Commercial Vehicles scraper', () => {
  assert.equal(companyAliases['VECV (Volvo Eicher Commercial Vehicles)'], 'vecv')
})

test('companyAliases maps GE to the GE Aerospace scraper', () => {
  assert.equal(companyAliases.GE, 'geaerospace')
})

test('companyAliases maps Urjanet to the Arcadia scraper', () => {
  assert.equal(companyAliases.Urjanet, 'arcadia')
})

test('generateCompanyCoverageReport resolves RNTBC and Brane Enterprises(NSL Hub) through the alias map', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'RNTBC,\nBrane Enterprises(NSL Hub),\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['RNTBC', 'renaultnissantechnology', 'Renault Nissan Technology and Business Centre'],
      ['Brane Enterprises(NSL Hub)', 'nslhubbrane', 'NSLHUB (Brane)'],
    ],
  )
})

test('generateCompanyCoverageReport resolves SBD India through the SBD Automotive provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'SBD India,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['SBD India', 'sbdautomotive', 'SBD Automotive']],
  )
})

test('generateCompanyCoverageReport resolves White Matrix through the WhiteMatrix provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'White Matrix,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['White Matrix', 'whitematrix', 'WhiteMatrix']],
  )
})

test('generateCompanyCoverageReport resolves Quotient Technology through the Neptune Retail Solutions provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Quotient Technology,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Quotient Technology', 'neptuneretailsolutions', 'Neptune Retail Solutions']],
  )
})

test('generateCompanyCoverageReport resolves the ZF India legal entities through the ZF Group provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'ZF Commercial Vehicle Control Systems India Limited,\nZF Wind Power Coimbatore Private Limited,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['ZF Commercial Vehicle Control Systems India Limited', 'zf', 'ZF Group'],
      ['ZF Wind Power Coimbatore Private Limited', 'zf', 'ZF Group'],
    ],
  )
})

test('generateCompanyCoverageReport resolves the expanded VECV company row through the VE Commercial Vehicles provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'VECV (Volvo Eicher Commercial Vehicles),\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['VECV (Volvo Eicher Commercial Vehicles)', 'vecv', 'VE Commercial Vehicles']],
  )
})

test('generateCompanyCoverageReport resolves GE through the GE Aerospace provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'GE,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['GE', 'geaerospace', 'GE Aerospace']],
  )
})

test('generateCompanyCoverageReport resolves Urjanet through the Arcadia provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Urjanet,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Urjanet', 'arcadia', 'Arcadia']],
  )
})
