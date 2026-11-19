import assert from 'node:assert/strict'
import test from 'node:test'
import * as source from './script.js'

test('Svaya uses its independent robotics employer and own candidate surface',()=>{
 assert.equal(source.SOURCE,'svayarobotics')
 assert.equal(source.COMPANY,'Svaya Robotics')
 assert.equal(source.COMPANY_DOMAIN,'svayarobotics.com')
 assert.equal(source.CAREERS_URL,'https://svayarobotics.com/careers/')
 assert.equal(source.ATS_PLATFORM,'official-company-careers')
 assert.equal(typeof source.createSvayaRoboticsScraper().run,'function')
})

test('Paninian and Svayatt portal pages cannot be relabelled as Svaya Robotics jobs',()=>{
 const unrelated='<html><head><title>Home | Paninian Svayatt Portal</title><link rel="canonical" href="https://www.svayatt.co.in/"></head><body><h1>Paninian Aerospace</h1><a href="mailto:careers_india@paninian.com">Apply</a></body></html>'
 assert.throws(()=>source.readSvayaHomepage(unrelated),/native careers/i)
 assert.throws(()=>source.readSvayaListing(unrelated),/native careers/i)
})
