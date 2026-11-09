import test from 'node:test';import assert from 'node:assert/strict';
import {parseTrialOptions,assertTrialResume} from '../rewriting/trialControl.js';
test('trial paths and CPU threads are bounded; Mongo/live flags cannot enter the launcher',()=>{
 assert.deepEqual(parseTrialOptions(['--run-dir','trial','--resume','--rewrite-directory','rewrites-v2','--model-threads','4']),{runDir:'trial',resume:true,outputName:'rewrites-v2',threads:4});
 for(const args of [['--run-dir','trial','--model-threads','20'],['--run-dir','trial','--rewrite-directory','../live'],['--run-dir','trial','--live'],['--run-dir']])assert.throws(()=>parseTrialOptions(args));
});
test('resume requires a dry checkpoint, the same catalog, a dead owner and no resource stop',()=>{
 const base={prior:{status:'interrupted',mongoWrites:0},checkpoint:{mode:'dry-run'},previousCatalog:[{source:'a'}],catalog:[{source:'a'}],ownerAlive:false};
 assert.doesNotThrow(()=>assertTrialResume(base));
 for(const patch of [{ownerAlive:true},{prior:{status:'resource_stopped',mongoWrites:0}},{prior:{status:'monitor_error',mongoWrites:0}},{checkpoint:{mode:'live'}},{catalog:[{source:'b'}]}])assert.throws(()=>assertTrialResume({...base,...patch}));
});
