import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {parse} from 'acorn'
import * as source from './currentNativeFacts20261121.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
const common=Buffer.from(fixture.packets.find(p=>p.requestedURL.endsWith('/js/common.js?ver=1.0.3')).bodyBase64,'base64').toString('utf8')
const text=p=>Buffer.from(p.bodyBase64,'base64').toString('utf8'),find=pattern=>fixture.packets.find(p=>pattern.test(p.requestedURL)),constants=text(find(/\/js\/constants[.]js$/)),controller=text(find(/outside_job_apply_controller[.]js/)),entry=text(find(/\/tojo\/app\/job-apply\/(?:#|$)/)),listing=text(find(/\/job-listing\//))
test('actual current public bootstrap/controller protocol is accepted',()=>{assert.equal(source.readProtocol(constants,controller,source.readNativeEntry(entry),common).serviceBaseURL,'https://talentojo.kpit.com/service/')})
test('uncalled local service base decoy cannot authorize the controller endpoint',()=>{const ast=parse(constants,{ecmaVersion:'latest'}),n=ast.body.find(n=>n.type==='VariableDeclaration'&&n.declarations.some(d=>d.id.name==='service_base_url')),changed=constants.slice(0,n.start)+'function unusedNativeBase(){'+constants.slice(n.start,n.end)+'}'+constants.slice(n.end);assert.throws(()=>source.readProtocol(changed,controller,source.readNativeEntry(entry),common))})
test('native controller must register on the entry TOJO module',()=>{const changed=controller.replace("angular.module('TOJO')","angular.module('UnboundForeignModule')");assert.notEqual(changed,controller);assert.throws(()=>source.readProtocol(constants,changed,source.readNativeEntry(entry),common))})
test('an uncalled controller registration cannot supply native role GET authority',()=>{const ast=parse(controller,{ecmaVersion:'latest'}),n=ast.body.find(n=>n.type==='ExpressionStatement'&&n.expression?.callee?.property?.name==='controller'),changed=controller.slice(0,n.start)+'function unusedNativeController(){'+controller.slice(n.start,n.end)+'}'+controller.slice(n.end);assert.throws(()=>source.readProtocol(constants,changed,source.readNativeEntry(entry),common))})
test('the real injected HTTP service must bind the observed callback parameter',()=>{const changed=controller.replace("['$scope', '$http'","['$scope', '$unrelatedHttp'");assert.notEqual(changed,controller);assert.throws(()=>source.readProtocol(constants,changed,source.readNativeEntry(entry),common))})
test('native entry cannot bootstrap a different module while retaining script decoys',()=>{const changed=entry.replace('ng-app="TOJO"','ng-app="UnboundForeignModule"');assert.notEqual(changed,entry);assert.throws(()=>source.readNativeEntry(changed))})
test('explicit foreign country in the role workplace cannot qualify with India JSON country',()=>{const cards=source.readCards(listing),card=cards.find(c=>{const p=find(new RegExp('/service/jobs/'+c.nativeID+'$'));return p&&source.readRole(text(p),c).sourceRoleQualified}),p=JSON.parse(text(find(new RegExp('/service/jobs/'+card.nativeID+'$'))));p.job.location=['Munich, Germany'];try{const model=source.readRole(JSON.stringify(p),card);assert.equal(model.sourceRoleQualified,false)}catch(error){if(error instanceof assert.AssertionError)throw error}})

test('the actual controller cannot shadow its consumed global native service base',()=>{
 const changed=controller.replace('var job_id = $routeParams.job_id;', "var service_base_url='https://foreign-employer.example/service/';var job_id = $routeParams.job_id;")
 assert.notEqual(changed,controller)
 assert.throws(()=>source.readProtocol(constants,changed,source.readNativeEntry(entry),common),/base|shadow|binding/i)
})
