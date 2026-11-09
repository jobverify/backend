import { registerCurrentRecruitmentContract } from './helpers/currentRecruitmentContract.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const sastasundarModule = await import('../../scraper/sastasundar/script.js').catch(() => ({}))

const {
  CAREERS_URL,
  COMPANY,
  DISPOSITION,
  OFFICIAL_BRAND,
  SOURCE,
  VERIFIED_SURFACE_SUMMARY,
  run,
} = sastasundarModule





// Current production extraction replaces the old always-empty contract.
registerCurrentRecruitmentContract('sastasundar', 'workbookBatch04Sastasundar')
