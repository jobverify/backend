import assert from 'node:assert/strict'
import test from 'node:test'
import {normalizeScrapedJob} from '../utils/normalizeScrapedJob.js'
import {generateFingerprint} from '../utils/saveToDB.js'
import {analyzePublishableJobs} from '../utils/publishableJobMetrics.js'
const roles=['Sr SAP ABAP Developer','Senior DevOps Engineer','Sr Software Sales Resource'].map((title,i)=>({title,company:'Tecnics Integration Technologies',location:'Hyderabad, India',city:'Hyderabad',country:'India',applyUrl:'mailto:careers@tecnics.com',sourceUrl:'https://tecnics.com/careers/',jobId:'role-'+i,requisitionId:'role-'+i}))
test('Email applications sharing a careers page retain distinct stable persistence identities',()=>{const eligible=analyzePublishableJobs(roles).eligibleJobs;assert.equal(eligible.length,3);const normalized=eligible.map(job=>normalizeScrapedJob(job));assert.equal(new Set(normalized.map(generateFingerprint)).size,3);assert.deepEqual(normalized.map(generateFingerprint),eligible.map(generateFingerprint));assert.deepEqual(normalized.map(job=>generateFingerprint(normalizeScrapedJob(job))),normalized.map(generateFingerprint))})
test('Email roles without requisition IDs remain distinct by their role title',()=>{const normalized=roles.map(({jobId,requisitionId,...job})=>normalizeScrapedJob(job));assert.equal(new Set(normalized.map(generateFingerprint)).size,3)})
test('Role-specific HTTP application URLs retain identity across title and requisition changes',()=>{const role={...roles[0],applyUrl:'https://tecnics.com/jobs/123'};assert.equal(generateFingerprint(normalizeScrapedJob(role)),generateFingerprint(normalizeScrapedJob({...role,title:'Updated title',jobId:'changed',requisitionId:'changed'})))})

test('Email applications supplied through link retain identity before and after normalization',()=>{const linked=roles.map(({applyUrl,...job})=>({...job,link:applyUrl}));assert.deepEqual(linked.map(generateFingerprint),linked.map(job=>generateFingerprint(normalizeScrapedJob(job))));assert.equal(new Set(linked.map(job=>generateFingerprint(normalizeScrapedJob(job)))).size,3)})
