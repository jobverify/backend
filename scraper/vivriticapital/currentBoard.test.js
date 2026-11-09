import assert from 'node:assert/strict'
import test from 'node:test'
import {hasOfficialAboutSignal,hasExplicitDarwinboxEmptyInventory} from './script.js'
const about='<title>Vivriti Group | financial solutions</title><h1>Vivriti Means Progress</h1><p>Vivriti Next is the operating &amp; holding company of mid-market focused Vivriti Group</p><p>Vivriti Capital Limited (VCL) and Vivriti Asset Management (VAM)</p>'
test('Vivriti accepts the current holding-company structure while retaining exact group identity',()=>{assert.equal(hasOfficialAboutSignal(about),true);assert.equal(hasOfficialAboutSignal(about.replaceAll('Vivriti','Another')),false)})

test('Vivriti distinguishes an explicit tenant vacancy statement from blank, foreign and populated pages',()=>{const empty='<title>Vivriti</title><p>There are no current job openings</p>';assert.equal(hasExplicitDarwinboxEmptyInventory(empty),true);assert.equal(hasExplicitDarwinboxEmptyInventory('<title>Vivriti</title><body>Vivriti -</body>'),false);assert.equal(hasExplicitDarwinboxEmptyInventory(empty.replace('Vivriti','Another')),false);assert.equal(hasExplicitDarwinboxEmptyInventory(empty+'<a href="/jobs/123">Engineer</a>'),false)})
