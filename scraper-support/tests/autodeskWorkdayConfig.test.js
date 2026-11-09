import assert from 'node:assert/strict'
import test from 'node:test'

import { getScraperCatalog } from '../providers/index.js'

test('Autodesk uses its external Workday board rather than the university board', () => {
  const provider = getScraperCatalog().find(({ source }) => source === 'autodesk')

  assert.equal(provider.baseUrl, 'https://autodesk.wd1.myworkdayjobs.com/en-US/Ext')
  assert.equal(provider.companyCareerPage, 'https://autodesk.wd1.myworkdayjobs.com/EXT')
  assert.equal(provider.boardIdentityVerified, true)
})
