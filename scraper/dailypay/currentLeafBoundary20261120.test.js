import './currentCommonBoundary20261120.test.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {replay,feed} from './currentConfiguredBoard20261120.test.js'

async function held(change){let changed=false,error;try{await replay((q,u,n)=>{const old=JSON.stringify(q);change(q,u,n);changed ||= old!==JSON.stringify(q)})}catch(e){error=e}assert(changed,'Scoped semantic leaf mutation actually applied');assert(error,'Known adjacent same-role semantic facts cannot qualify zero');assert.equal(error.nativeContradiction,true);assert.equal(error.failureKind,'parser_or_contract_error')}
for(const tag of['p','div','section']){
 for(const[label,value]of[['Country','India'],['Employer','Other Employer'],['Posting status','withdrawn'],['Application URL','https://other.example/apply'],['Location','Bengaluru, India']])test('Scoped '+tag+'/'+tag+' leaf '+label+' constrains configured projection',()=>held(feed(r=>r.descriptionHtml='<section><'+tag+'>'+label+'</'+tag+'><'+tag+'>'+value+'</'+tag+'></section>')))
 test('Coherent scoped '+tag+'/'+tag+' employer pair remains valid',async()=>{const r=await replay(feed(r=>r.descriptionHtml='<section><'+tag+'>Employer</'+tag+'><'+tag+'>DailyPay</'+tag+'></section>'));assert.equal(r.evidence.status,'complete-inventory');assert.equal(r.audit.companyIndiaTotal,null)})
}

for(const owner of['article','root']){
 for(const[label,value]of[['Country','India'],['Employer','Other Employer'],['Posting status','withdrawn'],['Application URL','https://other.example/apply'],['Location','Bengaluru, India']])test('Actual criteria '+owner+' owner leaf '+label+' constrains configured projection',()=>held(feed(r=>r.descriptionHtml=(owner==='root'?'':'<'+owner+'>')+'<label>'+label+'</label><span>'+value+'</span>'+(owner==='root'?'':'</'+owner+'>'))))
 test('Coherent actual '+owner+' owner leaf employer remains valid',async()=>{const r=await replay(feed(r=>r.descriptionHtml=(owner==='root'?'':'<'+owner+'>')+'<label>Employer</label><span>DailyPay</span>'+(owner==='root'?'':'</'+owner+'>')));assert.equal(r.evidence.status,'complete-inventory');assert.equal(r.audit.companyIndiaTotal,null)})
}
