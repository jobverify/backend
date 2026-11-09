import { registerCurrentRecruitmentContract } from './helpers/currentRecruitmentContract.js'
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  COMPANY,
  DISPOSITION,
  SOURCE,
  run,
} from '../../scraper/telioev/script.js'





// Current production extraction replaces the old always-empty contract.
registerCurrentRecruitmentContract('telioev', 'workbookBatch05TelioEV')
