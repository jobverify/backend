import { registerCurrentRecruitmentContract } from './helpers/currentRecruitmentContract.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const piramalESwasthyaModule = await import('../../scraper/piramaleswasthya/script.js').catch(
  () => ({}),
)

const {
  CAREERS_URL,
  COMPANY,
  DISPOSITION,
  OFFICIAL_BRAND,
  SOURCE,
  VERIFIED_SURFACE_SUMMARY,
  run,
} = piramalESwasthyaModule





// Current production extraction replaces the old always-empty contract.
registerCurrentRecruitmentContract('piramaleswasthya', 'workbookBatch04PiramalESwasthya')
