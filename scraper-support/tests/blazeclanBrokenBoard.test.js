import { registerCurrentRecruitmentContract } from './helpers/currentRecruitmentContract.js'
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CAREERS_URL,
  isBlazeclanApexTlsAltnameError,
  run,
} from '../../scraper/blazeclantechnologies/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const careers = 'Join us to grow your career by doing what you love to do and treading the path where you want to go. <a href="https://blazeclan.zohorecruit.in/jobs/Careers" class="cta-btn">Current Openings</a>'
const deadBoard = 'blazeclan.zohorecruit.in does not exist. Powered by Zoho'







// Current production extraction replaces the old always-empty contract.
registerCurrentRecruitmentContract('blazeclantechnologies', 'blazeclanBrokenBoard')
