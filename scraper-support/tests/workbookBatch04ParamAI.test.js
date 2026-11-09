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
} from '../../scraper/paramai/script.js'





// Current production extraction replaces the old always-empty contract.
registerCurrentRecruitmentContract('paramai', 'workbookBatch04ParamAI')
