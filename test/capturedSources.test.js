import test from 'node:test';
import assert from 'node:assert/strict';
import {capturedSourceNames} from '../rewriting/capturedSources.js';
test('resolved checkpoint names cover providers whose catalog name field was absent',()=>{
 const checkpoint={mode:'dry-run',status:'complete',completedCount:2,totalSources:2,catalogSources:['abb','axissecurities']};
 assert.deepEqual(capturedSourceNames(checkpoint),['abb','axissecurities']);
});
test('incomplete, live or unnamed capture scopes cannot authorize a description run',()=>{
 const valid={mode:'dry-run',status:'complete',completedCount:2,totalSources:2,catalogSources:['abb','axissecurities']};
 for(const changes of [{mode:'live'},{status:'running'},{completedCount:1},{catalogSources:['abb',null]},{catalogSources:['abb','abb']}])assert.throws(()=>capturedSourceNames({...valid,...changes}));
});
