import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {hasOfficialExploreJobsSignal} from '../scraper/apexon/script.js'
const source=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/native-production.json.gz',import.meta.url)))).sources.find(s=>s.source==='apexon'),html=source.requests.find(q=>q.requestedURL==='https://www.apexon.com/explore-jobs/').text,titles=[...html.matchAll(/<title[^>]*>[\s\S]*?<\/title>/gi)].map(m=>m[0])
test('Apexon retained original authored job-search and SEO titles together establish the owned listing page',()=>{assert.equal(titles.length,2);assert.equal(hasOfficialExploreJobsSignal(html),true)})
test('Apexon the supported USA primary title remains company identity rather than job-country proof with its native SEO title',()=>{assert.equal(hasOfficialExploreJobsSignal(html.replace('Openings in India - Apexon','Openings in USA - Apexon')),true)})
test('Apexon a foreign first document title cannot acquire employer identity from a later trusted title',()=>{for(const changed of[html.replace(titles[0],'<title>Foreign employer</title>'),html.replace(titles[0],'<title>Foreign employer</title>').replace(titles[1],titles[0]),html.replace(titles[0],'<title>Foreign employer</title>').replace('</head>',titles[0]+'</head>')])assert.equal(hasOfficialExploreJobsSignal(changed),false)})
test('Apexon a trusted title inside an inert template cannot mask a foreign active head title',()=>{const changed=html.replace(titles[0],'<template>'+titles[0]+'</template>').replace(titles[1],'<title>Foreign employer</title>');assert.equal(hasOfficialExploreJobsSignal(changed),false)})
