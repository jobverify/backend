import { registerCurrentRecruitmentContract } from './helpers/currentRecruitmentContract.js'
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  COMPANY,
  DISPOSITION,
  OFFICIAL_BRAND,
  SOURCE,
  VERIFIED_SURFACE_SUMMARY,
  run,
} from '../../scraper/workindia/script.js'



test('WorkIndia retains source identity and records extraction without a static inventory claim', () => {
  assert.equal(SOURCE, 'workindia')
  assert.equal(COMPANY, 'WorkIndia')
  assert.equal(OFFICIAL_BRAND, 'WorkIndia')
  assert.equal(CAREERS_URL, 'https://www.workindia.in/')
  assert.equal(DISPOSITION, 'runtime-verified-recruitment')
  assert.match(
    VERIFIED_SURFACE_SUMMARY,
    /Current extraction is implemented/i,
  )
  assert.match(
    VERIFIED_SURFACE_SUMMARY,
    /inventories remain unverified/i,
  )
})

// Production extraction supersedes the former unconditional-empty contract.
registerCurrentRecruitmentContract('workindia', 'workbookBatch06WorkIndia.test.js')
