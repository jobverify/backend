import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Job from '../src/models/Job.js';
import { buildRewriteInput } from '../src/services/jobDescriptionPolicy.js';
import { classifySavedJobs } from '../scripts/classifySavedJobs.js';
import { postScrapeInput } from '../src/services/postScrapeClassification.js';

test('classification consumes published rewrites, invalidates caches and rejects concurrent rewrite edits',{timeout:300000},async t=>{
 const mongo=await MongoMemoryServer.create({binary:{version:'8.2.6',downloadDir:fileURLToPath(new URL('../.cache/mongodb-binaries/',import.meta.url))}});
 await mongoose.connect(mongo.getUri());t.after(async()=>{await mongoose.disconnect();await mongo.stop();});
 const seeded=await Job.create({title:'Engineer',company:'Pipeline Test Company',fingerprint:'pipeline-test-only',status:'active',sourceEmploymentType:'Full time',
   sourceDescription:'Original employer responsibilities: Build reliable services. Requirements: Minimum 3 years of professional experience.'});
 const initial=seeded.toObject();const sourceHash=buildRewriteInput(initial).inputHash;
 await Job.updateOne({_id:seeded._id},{$set:{sourceContentHash:sourceHash,description:'Rewritten responsibilities: Build reliable services. Requirements: Minimum 3 years of professional experience.',
  descriptionRewrite:{status:'published',inputHash:sourceHash,policyVersion:'test-v1',publishedAt:new Date('2026-10-18T00:00:00Z')}}});
 // Real rewriting adds metadata through dotted updates after the initial queue document.
 // Whole-subdocument equality must not depend on MongoDB's stored field order.
 await Job.updateOne({_id:seeded._id},{$set:{'descriptionRewrite.attemptedAt':new Date('2026-10-18T00:00:00Z'),
   'descriptionRewrite.durationMs':10,'descriptionRewrite.modelRevision':'test-model','descriptionRewrite.runtimeTag':'test-runtime'}});
 const now=()=>new Date('2026-10-18T12:00:00Z');let calls=0;
 const prediction={modelLabel:'Full-time Experienced',fullDescriptionCovered:true,windows:1,scores:{'Full-time Experienced':.97,'Full-time Fresher':.01,Intern:.01,Contract:.01}};
 const worker={classify:async input=>{calls++;assert.equal(input.descriptionOrigin,'rewrite');assert.match(input.body,/Rewritten responsibilities/);return prediction;}};
 assert.equal((await classifySavedJobs({worker,mode:'policy',now})).completed,1);
 const first=await Job.findById(seeded._id).lean();assert.equal(first.jobType,'Full-time Experienced');
 assert.equal((await classifySavedJobs({worker,mode:'policy',now})).cached,1);assert.equal(calls,1);
 await Job.updateOne({_id:seeded._id},{$set:{description:'Rewritten responsibilities: Build reliable systems. Requirements: Minimum 3 years of professional experience.'}});
 assert.notEqual(postScrapeInput(first,{now:now()}).inputHash,postScrapeInput(await Job.findById(seeded._id).lean(),{now:now()}).inputHash);
 const stale=await classifySavedJobs({mode:'policy',now,worker:{classify:async input=>{
  assert.equal(input.descriptionOrigin,'rewrite');
  await Job.updateOne({_id:seeded._id},{$set:{'descriptionRewrite.policyVersion':'test-v2'}});
  return prediction;
 }}});
 assert.equal(stale.stale,1);assert.equal((await Job.findById(seeded._id).lean()).postClassification.status,'failed');
 await Job.updateOne({_id:seeded._id},{$set:{'descriptionRewrite.status':'skipped'}});
 assert.equal((await classifySavedJobs({mode:'policy',now,worker:{classify:async input=>{
  assert.equal(input.descriptionOrigin,'source');assert.match(input.body,/Original employer/);return prediction;
 }}})).completed,1);
});
