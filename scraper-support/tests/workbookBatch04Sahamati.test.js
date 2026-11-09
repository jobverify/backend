import { registerCurrentRecruitmentContract } from './helpers/currentRecruitmentContract.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const sahamatiModule = await import('../../scraper/sahamati/script.js').catch(() => ({}))

const {
  CAREERS_URL,
  COMPANY,
  DISPOSITION,
  OFFICIAL_BRAND,
  SOURCE,
  VERIFIED_SURFACE_SUMMARY,
  run,
} = sahamatiModule





// Current production extraction replaces the old always-empty contract.
registerCurrentRecruitmentContract('sahamati', 'workbookBatch04Sahamati')
