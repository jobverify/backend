import assert from 'node:assert/strict'
import test from 'node:test'
import {SOURCE,COMPANY_NAME,CAREER_PAGE_URL,createRevatureScraper} from './script.js'
test('registered Revature entrypoint retains company identity and metadata-aware factory',()=>{assert.equal(SOURCE,'revature');assert.equal(COMPANY_NAME,'Revature');assert.equal(CAREER_PAGE_URL,'https://www.revature.com/');assert.equal(typeof createRevatureScraper().run,'function')})
