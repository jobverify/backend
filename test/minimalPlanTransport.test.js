import test from 'node:test';
import assert from 'node:assert/strict';
import {minimalPlanTransport} from '../rewriting/minimalPlanTransport.js';

const schema={properties:{categories:{minItems:2,items:[{enum:[1,9]},{enum:[5,9]}]},overviewFactId:{enum:[0,1]}}};
test('numeric transport recovers the same fact-plan fields without generating object keys',()=>{
 const messages=[{role:'system',content:'Organize the facts.'},{role:'user',content:'Quoted input'}];
 const transport=minimalPlanTransport(schema,messages);
 assert.deepEqual(transport.decode([1,9,5]),{overviewFactId:1,categories:[9,5]});
 assert.equal(messages[0].content,'Organize the facts.');
 assert.match(transport.messages[0].content,/\[overviewFactId, category0/);
 assert.equal(transport.grammar,'root ::= "[" ("0" | "1") "," ("1" | "9") "," ("5" | "9") "]"\n');
});
test('no unknown facts and no overview produce a minimal null array',()=>{
 const transport=minimalPlanTransport({properties:{categories:{minItems:0,items:{}},overviewFactId:{type:'null'}}},[{role:'system',content:'Organize'}]);
 assert.equal(transport.grammar,'root ::= "[" ("null") "]"\n');
 assert.deepEqual(transport.decode([null]),{overviewFactId:null,categories:[]});
});
test('malformed, extra, missing and out-of-range values cannot become accepted plans',()=>{
 const transport=minimalPlanTransport(schema,[{role:'system',content:'Organize'}]);
 for(const value of [null,{},[0],[0,1,5,9],['0',1,5],[8,1,5],[0,4,5],[0,1,null]])assert.equal(transport.decode(value),null);
});
