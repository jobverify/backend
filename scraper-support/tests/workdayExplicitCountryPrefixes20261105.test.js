import test from 'node:test'
import assert from 'node:assert/strict'
import {explicitWorkdayCountryScope,explicitWorkdayAdditionalCountryScope} from '../myworkday/countryInventoryProof.js'
for(const label of['Brazil - Rio De Janeiro','Ecuador - Quito','Mexico - Monterrey','Brazil - Sao Paulo','Peru - Lima',
 'Colombia - Bogota','Turkey - Istanbul','Ireland - Dublin','US \u2013 AZ \u2013 Phoenix \u2013 Remote'])
 test('full native additional worksite names its foreign country: '+label,()=>assert.equal(explicitWorkdayAdditionalCountryScope(label),'foreign'))
for(const label of['Gurgaon','Bengaluru','Dickinson, ND','Anchorage, AK','Global','EMEA','India / United States',
 'Brazil - India','US - Phoenix, India','IN \u2013 Indianapolis','BR \u2013 Patna','Unknown - Brazil'])
 test('unqualified or conflicting native labels remain unresolved: '+label,()=>assert.equal(explicitWorkdayAdditionalCountryScope(label),null))
test('new native additional-location country spelling support does not change listing selection',()=>{
 assert.equal(explicitWorkdayCountryScope('Brazil - Sao Paulo'),null)
 assert.equal(explicitWorkdayCountryScope('US \u2013 AZ \u2013 Phoenix \u2013 Remote'),null)
 assert.equal(explicitWorkdayCountryScope('India'),'india')
 assert.equal(explicitWorkdayAdditionalCountryScope('India'),'india')
})
