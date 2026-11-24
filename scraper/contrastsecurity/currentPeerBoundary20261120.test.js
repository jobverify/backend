import test from 'node:test'
import assert from 'node:assert/strict'
import './currentSourceBoundary20261120.test.js'
import {replay,HOME,close,exact} from './currentConfiguredBoard20261120.test.js'
const own=change=>close(HOME,html=>{const model={'@context':'https://schema.org','@type':'WebPage',url:HOME,name:'Contrast Security Careers',publisher:{'@type':'Organization',name:'Contrast Security'}};change(model);return exact(html,'</head>','<script type="application/ld+json">'+JSON.stringify(model).replaceAll('<','\\u003c')+'</script></head>')})
async function held(change){await assert.rejects(replay(change),error=>error.nativeContradiction===true&&error.failureKind==='parser_or_contract_error')}
async function qualified(change){const result=await replay(change);assert.equal(result.jobs.length,0);assert.equal(result.assessment.zeroJobEvidence,'fetched-zero');assert.equal(result.assessment.runnerOutcome.success,true);assert.equal(result.audit.companyIndiaTotal,null);assert.equal(result.assessment.cleanupOptions.replaceExisting,false);return result}
test('Independent root Contrast: own WebPage identifier cannot identify another owned path',async()=>{await held(own(model=>model['@id']=HOME+'/other-source'))})
test('Independent root Contrast: nested Article WebPage identifier cannot identify another owned path',async()=>{await held(own(model=>{model['@type']='Article';model.mainEntityOfPage={'@type':'WebPage','@id':HOME+'/other-source'}}))})
test('Independent root Contrast: current same-source Article publication withdrawal is qualified',async()=>{await held(own(model=>{model['@type']='Article';model.isPublished=false}))})
test('Independent root Contrast: unrelated SVG title preserves the actual HTML publisher title',async()=>{await qualified(close(HOME,html=>exact(html,'</body>','<svg role="img"><title>Current careers illustration</title><path d="M0 0"></path></svg></body>')))})
export{own,held,qualified}
