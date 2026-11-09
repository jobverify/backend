import assert from 'node:assert/strict'
import test from 'node:test'
import { registerCurrentRecruitmentContract } from './helpers/currentRecruitmentContract.js'

import {
  CAREERS_URL,
  CONTACT_EMAIL,
} from '../../scraper/techjockey/script.js'

test('Techjockey retains its official careers and contact metadata', () => {
  assert.equal(CAREERS_URL, 'https://www.techjockey.com/company/careers')
  assert.equal(CONTACT_EMAIL, 'career@techjockey.com')
})

registerCurrentRecruitmentContract('techjockey', 'workbook batch 05')
