import test from 'node:test'
import assert from 'node:assert/strict'
import {isNativeBareCityInPublicScope} from '../shared/nativeCityScope.js'
for(const [label,expected] of [['Mumbai',true],['Bangalore',true],['Bengaluru',true],[' Mumbai  ',true],['Mumbai - London',false],['Mumbai (London)',false],['Mumbai & London',false],['London',false],['Ghansoli',false],['constructor',false],['__proto__',false],[null,false],[0,false]]){
 test('whole native city scope: '+String(label),()=>assert.equal(isNativeBareCityInPublicScope(label),expected))
}
test('reviewed source district labels cannot expand the existing public location policy',()=>{
 assert.equal(isNativeBareCityInPublicScope('Central Delhi'),false)
 assert.equal(isNativeBareCityInPublicScope('Central Delhi',{extraLabels:['central delhi']}),true)
 assert.equal(isNativeBareCityInPublicScope('Mystery City',{extraLabels:['mystery city']}),false)
})
