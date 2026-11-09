import { registerCurrentRecruitmentContract } from './helpers/currentRecruitmentContract.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const outgrowModule = await import('../../scraper/outgrow/script.js').catch(() => ({}))

const {
  CAREERS_URL,
  COMPANY,
  DISPOSITION,
  OFFICIAL_BRAND,
  SOURCE,
  VERIFIED_SURFACE_SUMMARY,
  run,
} = outgrowModule





// Current production extraction replaces the old always-empty contract.
registerCurrentRecruitmentContract('outgrow', 'workbookBatch04Outgrow')
