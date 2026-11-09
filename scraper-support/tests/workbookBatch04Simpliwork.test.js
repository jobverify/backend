import { registerCurrentRecruitmentContract } from './helpers/currentRecruitmentContract.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const simpliworkModule = await import('../../scraper/simpliwork/script.js').catch(() => ({}))

const {
  CAREERS_URL,
  COMPANY,
  DISPOSITION,
  OFFICIAL_BRAND,
  SOURCE,
  VERIFIED_SURFACE_SUMMARY,
  run,
} = simpliworkModule





// Current production extraction replaces the old always-empty contract.
registerCurrentRecruitmentContract('simpliwork', 'workbookBatch04Simpliwork')
