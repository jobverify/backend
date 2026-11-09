import { registerCurrentRecruitmentContract } from './helpers/currentRecruitmentContract.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const optymyzeIndiaModule = await import('../../scraper/optymyzeindia/script.js').catch(() => ({}))

const {
  CAREERS_URL,
  COMPANY,
  DISPOSITION,
  OFFICIAL_BRAND,
  SOURCE,
  VERIFIED_SURFACE_SUMMARY,
  run,
} = optymyzeIndiaModule





// Current production extraction replaces the old always-empty contract.
registerCurrentRecruitmentContract('optymyzeindia', 'workbookBatch04OptymyzeIndia')
