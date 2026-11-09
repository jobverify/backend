import assert from 'node:assert/strict'
import test from 'node:test'
import {hasOfficialPortalSignal} from './script.js'
const portal = '<meta property="og:url" content="https://prolifics.zohorecruit.in/jobs/Careers"><meta property="og:site_name" content="Prolifics Corporation Private Limited"><input id="pageJson"><input id="moduleMeta"><input id="meta"><input id="jobs">'+JSON.stringify({website:'https://prolifics.ai/',company_name:'Prolifics Corporation Private Limited',list_url:'https://prolifics.zohorecruit.in/jobs/Careers'})
test('Prolifics accepts its verified new official website domain in the exact Zoho portal',()=>{
 assert.equal(hasOfficialPortalSignal(portal),true)
 assert.equal(hasOfficialPortalSignal(portal.replace('https://prolifics.ai/','https://example.com/')),false)
 assert.equal(hasOfficialPortalSignal(portal.replaceAll('Prolifics Corporation Private Limited','Different Company')),false)
})
