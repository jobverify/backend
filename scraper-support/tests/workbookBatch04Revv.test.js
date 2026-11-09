import { registerCurrentRecruitmentContract } from './helpers/currentRecruitmentContract.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const revvModule = await import('../../scraper/revv/script.js').catch(() => ({}))

const {
  CAREERS_URL,
  COMPANY,
  DISPOSITION,
  OFFICIAL_BRAND,
  SOURCE,
  VERIFIED_SURFACE_SUMMARY,
  run,
} = revvModule





// Current production extraction replaces the old always-empty contract.
registerCurrentRecruitmentContract('revv', 'workbookBatch04Revv')
