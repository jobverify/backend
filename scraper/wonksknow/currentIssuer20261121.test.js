import assert from 'node:assert/strict';
import test from 'node:test';
import {qualifyIssuerProse} from './currentScope20261121.js';
import {originalPacket,originalText,selectedFragment} from './fixtures/currentReplay20261121.js';
const observations=originalPacket.responses.filter(record=>record.phase==='opening'&&record.resource==='actual-declared-public-role').map(record=>{
 const {parsed,owner}=selectedFragment(originalText(record),record.url),children=owner.children.filter(child=>typeof child!=='string'),label=children.findIndex(node=>parsed.text(node)==='JOB DESCRIPTION');assert(label>=0);
 return{title:parsed.text(children[0]).replace(/\s*APPLY FOR THIS JOB\s*$/i,''),description:parsed.text(children[label+1])};
}).filter(role=>/, a subsidiary of Wonksknow LLC USA,/i.test(role.description));
assert.equal(observations.length,5);
for(const role of observations)test('genuine own issuer apposition qualifies '+role.title,()=>{assert.doesNotThrow(()=>qualifyIssuerProse(role.description));});
test('foreign employer apposition cannot borrow the Wonksknow parent name',()=>{assert.throws(()=>qualifyIssuerProse('Other Employer, a subsidiary of Wonksknow LLC USA, is looking for an engineer for its own team.'));});
