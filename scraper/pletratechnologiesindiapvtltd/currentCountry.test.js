import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {extractPublicJobs} from './script.js'
const current=await fs.readFile(new URL('./fixtures/current-careers.html',import.meta.url),'utf8')
test('Pletra does not infer India for an unpublished role location',()=>{const jobs=extractPublicJobs(current);assert.equal(jobs.length,3);assert.equal(jobs.find(j=>j.title==='Business Development Manger').country,null);assert.equal(jobs.find(j=>j.title==='Salesforce Trainer').country,'India');assert.equal(jobs.find(j=>j.title==='Business Developement Intern').country,'Belgium')})
test('Pletra keeps an unknown title location unresolved',()=>{const jobs=extractPublicJobs(current.replace('Salesforce Trainer- Location- Pune','Salesforce Trainer- Location- Remote'));assert.equal(jobs.find(j=>j.title==='Salesforce Trainer').country,null)})
test('Pletra rejects incomplete published accordion cards',()=>{assert.throws(()=>extractPublicJobs(current.replace('Business Development Manger</a>','</a>')),/incomplete|title/i)})
