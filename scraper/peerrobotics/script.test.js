import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {readCurrentPeerEmployer,readCurrentPeerNotion} from './currentNative20261117.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-20261117.json.gz',import.meta.url))))
const body=url=>Buffer.from(fixture.requests.find(row=>row.url===url).bodyBase64,'base64').toString()
const home=body('https://www.peerrobotics.ai/'),company=body('https://www.peerrobotics.ai/company'),shell=body('https://careers.peerrobotics.ai/')
test('Peer Robotics source-backed employer model binds own graph, active navigation, hiring section and careers-domain handoff',()=>{
 const model=readCurrentPeerEmployer(home,company)
 assert.equal(model.employerName,'Peer Robotics');assert.equal(model.careersPage,'https://careers.peerrobotics.ai/')
 assert.equal(model.nativeHandoff.children[0].children[0],'View roles');assert.ok(model.nativeHiringText.includes('Our team is growing fast'))
 assert.equal(model.wholeNativeHiringSection.tag,'section');assert.equal(model.homeStructuredData[0]['@graph'][0].url,'https://www.peerrobotics.ai/')
 for(const changed of [company.replace('https://careers.peerrobotics.ai/','https://foreign.invalid/'),company.replace('id="w-node-b20c3a40','hidden id="w-node-b20c3a40')])assert.throws(()=>readCurrentPeerEmployer(home,changed),/handoff/i)
})
test('Peer Robotics retains complete actual Notion shell and declarations while its page UUID remains a page binding rather than a vacancy identity',()=>{
 const model=readCurrentPeerNotion(shell)
 assert.equal(model.bootData,null);assert.equal(model.bootRecordMapUnavailable,true);assert.equal(model.requiredRedirectMetadata.requiresRedirect,false)
 assert.equal(model.programDeclarations.filter(row=>row.attributes.src).length,11);assert.equal(model.nativeAsyncDeclarations.length,8)
 assert.equal(model.rawHTML,shell);assert.equal(model.wholeNativeShell.tag,'html');assert.equal(model.publicDataRequestQualified,false)
 assert.equal(model.pageIDIsVacancyID,false);assert.equal(model.nativeInventoryQualified,false)
 assert.equal(readCurrentPeerNotion(shell.replaceAll('b30048b0-5440-4c6c-aab1-765de1669686','aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).requiredRedirectMetadata.pageId,'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
})
test('Peer Robotics literal Notion binding rejects duplicate/executable/redirect/foreign-client and unavailable-bootstrap changes without executing publisher code',()=>{
 for(const changed of [shell.replace('"requiresRedirect":false','"requiresRedirect":true'),shell.replace('window.__notion_boot_data=null','window.__notion_boot_data={"recordMap":{}}'),shell.replace('"pageId":"b30048b0-5440-4c6c-aab1-765de1669686"','"pageId":"b30048b0-5440-4c6c-aab1-765de1669686","pageId":"different"'),shell.replace('"requiredRedirectMetadata",{','"requiredRedirectMetadata",globalThis.PEER_TEST_EXECUTED={'),shell.replace('src="/_assets/app-','src="https://foreign.invalid/app-')])assert.throws(()=>readCurrentPeerNotion(changed))
 assert.equal(globalThis.PEER_TEST_EXECUTED,undefined)
})
