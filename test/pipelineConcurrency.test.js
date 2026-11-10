import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { fileURLToPath } from 'node:url';
import PipelineConfiguration from '../src/models/PipelineConfiguration.js';
import PipelineRun from '../src/models/PipelineRun.js';
import { createPipeline, failPipeline } from '../src/pipeline/execution.js';
import { defaultConfiguration, directConfiguration } from '../src/pipeline/policy.js';
import { scraperRunEnvironment, standaloneScraperEnvironment } from '../src/pipeline/scraperConcurrency.js';

test('saved concurrency overrides every pipeline origin and remains a run snapshot', {timeout:300000}, async t=>{
  const mongo=await MongoMemoryServer.create({binary:{version:'8.2.6',downloadDir:fileURLToPath(new URL('../.cache/mongodb-binaries/',import.meta.url))}});
  t.after(async()=>{await mongoose.disconnect();await mongo.stop();});
  await mongoose.connect(mongo.getUri());
  const oldConcurrency=process.env.SCRAPER_CONCURRENCY;
  process.env.SCRAPER_CONCURRENCY='2';
  t.after(()=>{if(oldConcurrency===undefined)delete process.env.SCRAPER_CONCURRENCY;else process.env.SCRAPER_CONCURRENCY=oldConcurrency;});
  assert.deepEqual(await standaloneScraperEnvironment(),{SCRAPER_CONCURRENCY:'2'});
  await PipelineConfiguration.create({_id:'global',stages:defaultConfiguration().stages,scraperConcurrency:7});
  assert.deepEqual(await standaloneScraperEnvironment(),{SCRAPER_CONCURRENCY:'7'});
  for(const [origin,target] of [['admin','local'],['admin','github'],['scheduler','github'],['github','github']]) {
    const run=await createPipeline({configuration:directConfiguration('scraper'),origin,target});
    assert.equal(run.scraperConcurrency,7);
    await PipelineConfiguration.updateOne({_id:'global'},{$set:{scraperConcurrency:3}});
    assert.equal((await PipelineRun.findById(run._id).lean()).scraperConcurrency,7);
    assert.deepEqual(await scraperRunEnvironment(run),{SCRAPER_CONCURRENCY:'7'});
    assert.deepEqual(await standaloneScraperEnvironment(run._id),{SCRAPER_CONCURRENCY:'7'});
    await failPipeline(run._id,'cancelled','Test finished');
    await PipelineConfiguration.updateOne({_id:'global'},{$set:{scraperConcurrency:7}});
  }
});
