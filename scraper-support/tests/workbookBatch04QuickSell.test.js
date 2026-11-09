import { registerCurrentRecruitmentContract } from './helpers/currentRecruitmentContract.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const quickSellModule = await import('../../scraper/quicksell/script.js').catch(() => ({}))

const {
  CAREERS_URL,
  COMPANY,
  DISPOSITION,
  OFFICIAL_BRAND,
  SOURCE,
  VERIFIED_SURFACE_SUMMARY,
  run,
} = quickSellModule





// Current production extraction replaces the old always-empty contract.
registerCurrentRecruitmentContract('quicksell', 'workbookBatch04QuickSell')
