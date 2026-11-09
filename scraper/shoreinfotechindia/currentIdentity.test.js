import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {hasOfficialHomepageSignal,hasOfficialContactSignal} from './script.js'
const home=await fs.readFile(new URL('./fixtures/current-home.html',import.meta.url),'utf8'),contact=await fs.readFile(new URL('./fixtures/current-contact.html',import.meta.url),'utf8')
test('Shore accepts current digital-services identity and operations contact title',()=>{assert.equal(hasOfficialHomepageSignal(home),true);assert.equal(hasOfficialContactSignal(contact),true)})
test('Shore retains exact employer and Hyderabad identity',()=>{assert.equal(hasOfficialHomepageSignal(home.replaceAll('Shore Group','Other Group')),false);assert.equal(hasOfficialContactSignal(contact.replaceAll('Hyderabad, India','New York, US')),false)})
