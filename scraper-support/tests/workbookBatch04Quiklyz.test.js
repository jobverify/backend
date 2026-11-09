import { registerCurrentRecruitmentContract } from './helpers/currentRecruitmentContract.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const quiklyzModule = await import('../../scraper/quiklyz/script.js').catch(() => ({}))

const {
  CAREERS_URL,
  COMPANY,
  DISPOSITION,
  OFFICIAL_BRAND,
  SOURCE,
  VERIFIED_SURFACE_SUMMARY,
  run,
} = quiklyzModule





// Current production extraction replaces the old always-empty contract.
registerCurrentRecruitmentContract('quiklyz', 'workbookBatch04Quiklyz')
