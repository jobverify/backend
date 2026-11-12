// Genuine retained-PDF models and restricted display initialization contracts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import {gunzipSync,inflateSync,deflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {registerHooks,syncBuiltinESMExports} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import http2 from 'node:http2';
import net from 'node:net';
import tls from 'node:tls';
import dgram from 'node:dgram';
import child from 'node:child_process';
import wt from 'node:worker_threads';

import test from 'node:test';

// Genuine model proofs use production initialization only. This test never
// assigns a geometry class for a model-reader invocation.
const backend=path.resolve(process.env.PDF_DISPLAY_TEST_BACKEND||fileURLToPath(new URL('../',import.meta.url)));
const self=fileURLToPath(import.meta.url),marker='--pdf-display-source';
const fixtureManifest={"readers":{"btlCurrent":{"path":"backend/scraper/btlindia/currentPdf.js","export":"readCurrentBtlPdf"},"btlLegacy":{"path":"backend/scraper/btlindia/nativePdf.js","export":"readNativePdf"},"nitara":{"path":"backend/scraper/nitaragormalonellp/nativePdf.js","export":"readNativePdf"},"bhel":{"path":"backend/scraper/bharatheavyelectricals/pdf20261107.js","export":"readBhelNativePdf"},"cdot":{"path":"backend/scraper/cdot/pdfDocument.js","export":"readPublishedPdf"},"logelite":{"path":"backend/scraper/logelite/pdfDocument.js","export":"readLogelitePDF"},"iprogrammer":{"path":"backend/scraper/iprogrammersolutions/employerAnnouncement.js","export":"parseNativeAnnouncementPdf"}},"moduleGraph":["backend/node_modules/entities/dist/decode-codepoint.js","backend/node_modules/entities/dist/decode.js","backend/node_modules/entities/dist/encode.js","backend/node_modules/entities/dist/escape.js","backend/node_modules/entities/dist/generated/decode-data-html.js","backend/node_modules/entities/dist/generated/encode-html.js","backend/node_modules/entities/dist/index.js","backend/node_modules/entities/dist/internal/decode-data-format.js","backend/scraper-support/shared/nativeJobPosting.js","backend/scraper-support/shared/rmkNativePairHtml.js","backend/scraper-support/utils/activeNativeHtml.js","backend/scraper-support/utils/visibleNativeHtml.js","backend/scraper/bharatheavyelectricals/pdf20261107.js","backend/scraper/bharatheavyelectricals/runtime20261107.js","backend/scraper/btlindia/currentErrors.js","backend/scraper/btlindia/currentPdf.js","backend/scraper/btlindia/nativePdf.js","backend/scraper/cdot/pdfDocument.js","backend/scraper/logelite/nativeModels.js","backend/scraper/logelite/pdfDocument.js","backend/scraper/logelite/pdfGraphicsReview.json","backend/scraper/nitaragormalonellp/nativePdf.js","backend/src/utils/jobSourceContent.js","backend/scraper/iprogrammersolutions/employerAnnouncement.js","backend/scraper-support/utils/inventoryEvidence.js"],"fixtures":{"btlCurrent":"backend/test/test-data/recruitmentGoal20261107/btl-current.json.gz","btlLegacy":"backend/scraper/btlindia/test-data/2026-10-31-native-packets.json.gz","nitara":"backend/scraper/nitaragormalonellp/test-data/2026-10-31-native-packets.json.gz","bhel":"backend/test/test-data/recruitmentGoal20261107/bhel-current-public-chain.json.gz","cdot":"backend/test/test-data/recruitmentGoal20261104/cdot-native-quality.json.gz","logelite":"backend/test/test-data/recruitmentGoal20261104/logelite-native-quality.json.gz","btlControlled":"backend/test/test-data/recruitmentGoal20261107/btl-controlled-pdf-boundaries.json.gz","iprogrammer":"backend/test/test-data/recruitmentGoal20261107/btl-current.json.gz"},"cohort":[{"family":"btlCurrent","fixture":"backend/test/test-data/recruitmentGoal20261107/btl-current.json.gz","selector":1,"controlled":false,"bodySHA256":"5343c94153f6b157cf95a095b2a6d927fe31c294524a24638de59291861dfc0a","declaredBodyBytes":121555},{"family":"btlCurrent","fixture":"backend/test/test-data/recruitmentGoal20261107/btl-current.json.gz","selector":2,"controlled":false,"bodySHA256":"dd086b366dd544583b8d7144a9eb97721f1f17b4adfb8185a59975bef51259e1","declaredBodyBytes":117241},{"family":"btlCurrent","fixture":"backend/test/test-data/recruitmentGoal20261107/btl-current.json.gz","selector":3,"controlled":false,"bodySHA256":"a04656df9045a5b60548d6674b4f7c7fb520a06ecc00ec0679ff0e3a699abd42","declaredBodyBytes":99274},{"family":"btlCurrent","fixture":"backend/test/test-data/recruitmentGoal20261107/btl-current.json.gz","selector":4,"controlled":false,"bodySHA256":"8073636cf852830ac40d554770fd1c60cf381ed8c91cca6eb017b10549654ee0","declaredBodyBytes":122627},{"family":"btlLegacy","fixture":"backend/scraper/btlindia/test-data/2026-10-31-native-packets.json.gz","selector":1,"controlled":false,"bodySHA256":"5343c94153f6b157cf95a095b2a6d927fe31c294524a24638de59291861dfc0a","declaredBodyBytes":121555},{"family":"btlLegacy","fixture":"backend/scraper/btlindia/test-data/2026-10-31-native-packets.json.gz","selector":2,"controlled":false,"bodySHA256":"dd086b366dd544583b8d7144a9eb97721f1f17b4adfb8185a59975bef51259e1","declaredBodyBytes":117241},{"family":"btlLegacy","fixture":"backend/scraper/btlindia/test-data/2026-10-31-native-packets.json.gz","selector":3,"controlled":false,"bodySHA256":"a04656df9045a5b60548d6674b4f7c7fb520a06ecc00ec0679ff0e3a699abd42","declaredBodyBytes":99274},{"family":"btlLegacy","fixture":"backend/scraper/btlindia/test-data/2026-10-31-native-packets.json.gz","selector":4,"controlled":false,"bodySHA256":"8073636cf852830ac40d554770fd1c60cf381ed8c91cca6eb017b10549654ee0","declaredBodyBytes":122627},{"family":"nitara","fixture":"backend/scraper/nitaragormalonellp/test-data/2026-10-31-native-packets.json.gz","selector":2,"controlled":false,"bodySHA256":"87e270dd0cbf8e94e3679c6df752dbea30f1bda6adec819245588bbbb78beaa4","declaredBodyBytes":223009},{"family":"nitara","fixture":"backend/scraper/nitaragormalonellp/test-data/2026-10-31-native-packets.json.gz","selector":3,"controlled":false,"bodySHA256":"617b0d8b488599a3842a407e946802b60d5adf2d58e8a0fbfc23981526b672a3","declaredBodyBytes":204704},{"family":"nitara","fixture":"backend/scraper/nitaragormalonellp/test-data/2026-10-31-native-packets.json.gz","selector":4,"controlled":false,"bodySHA256":"b873eb7d0710069f4cd228c91f968f1614a0d4cf8127734c0b10b64147777e89","declaredBodyBytes":222168},{"family":"nitara","fixture":"backend/scraper/nitaragormalonellp/test-data/2026-10-31-native-packets.json.gz","selector":5,"controlled":false,"bodySHA256":"2c34e014fcd503fad6e309c103440b711aabff1c2d2b6095cf57a234968da5e1","declaredBodyBytes":183315},{"family":"nitara","fixture":"backend/scraper/nitaragormalonellp/test-data/2026-10-31-native-packets.json.gz","selector":6,"controlled":false,"bodySHA256":"d27cceaebc25de6a86e89840042bb342b1c640c50e02dc5065aede88f578c0e0","declaredBodyBytes":249491},{"family":"bhel","fixture":"backend/test/test-data/recruitmentGoal20261107/bhel-current-public-chain.json.gz","selector":2,"controlled":false,"bodySHA256":"0c1c074d981ff750aafd0c93ccbc8070467f8f1be79c8c7d5c2f445b7981fc3f","declaredBodyBytes":248084},{"family":"bhel","fixture":"backend/test/test-data/recruitmentGoal20261107/bhel-current-public-chain.json.gz","selector":3,"controlled":false,"bodySHA256":"3b60f358dc451f15a1c7ca51fe9738b4f4ba100a57690900bd2c41c38d5277ad","declaredBodyBytes":164389},{"family":"bhel","fixture":"backend/test/test-data/recruitmentGoal20261107/bhel-current-public-chain.json.gz","selector":4,"controlled":false,"bodySHA256":"7fe2d0adc897190add10a9461c5f7f0445966e65a5990209b6d8027432bb36fe","declaredBodyBytes":173650},{"family":"cdot","fixture":"backend/test/test-data/recruitmentGoal20261104/cdot-native-quality.json.gz","selector":1,"controlled":false,"bodySHA256":"30d43da991a56ac9ef7be767686e9a330e851d40f76e8e72ec51e7b50c0726e5","declaredBodyBytes":430345},{"family":"logelite","fixture":"backend/test/test-data/recruitmentGoal20261104/logelite-native-quality.json.gz","selector":2,"controlled":false,"bodySHA256":"c227ecbdf98e289dd59487c75639c13dc576ee6e0ce1d5ff7a562df7c7899abd","declaredBodyBytes":102717},{"family":"logelite","fixture":"backend/test/test-data/recruitmentGoal20261104/logelite-native-quality.json.gz","selector":4,"controlled":false,"bodySHA256":"5e15efbe4c5c47a14268881e855b34112a5d393c61e8172ec32c3f158d9a6504","declaredBodyBytes":101925},{"family":"logelite","fixture":"backend/test/test-data/recruitmentGoal20261104/logelite-native-quality.json.gz","selector":6,"controlled":false,"bodySHA256":"3760152b70b8b007000cac70ad49fc4ec5e03f979a61e6dc48f759d7ef00e8f7","declaredBodyBytes":101004},{"family":"logelite","fixture":"backend/test/test-data/recruitmentGoal20261104/logelite-native-quality.json.gz","selector":8,"controlled":false,"bodySHA256":"6fc85becba109046d926d3c89c8e62cb95d69ac2513092578ae923ca4c60fcb4","declaredBodyBytes":101738},{"family":"logelite","fixture":"backend/test/test-data/recruitmentGoal20261104/logelite-native-quality.json.gz","selector":10,"controlled":false,"bodySHA256":"60f90d661e9ce18a9ec48ace3ff3fd000f9d6ced081ccb9b9bdb1030834ae480","declaredBodyBytes":101025},{"family":"logelite","fixture":"backend/test/test-data/recruitmentGoal20261104/logelite-native-quality.json.gz","selector":12,"controlled":false,"bodySHA256":"01047e37578b44a9832924f0bab4eca1d20f6c8545566d9fb05af0a3ad9e5862","declaredBodyBytes":92080},{"family":"btlCurrent","fixture":"backend/test/test-data/recruitmentGoal20261107/btl-controlled-pdf-boundaries.json.gz","selector":"extraMetadata","controlled":true,"bodySHA256":"bfe852b763eb3d0487d8902aec0e7b1ebcaaa224c6cdc05120f75406fc321dca","declaredBodyBytes":126660},{"family":"btlCurrent","fixture":"backend/test/test-data/recruitmentGoal20261107/btl-controlled-pdf-boundaries.json.gz","selector":"annotation","controlled":true,"bodySHA256":"7feec8473b231e2eb7cabfca1b54f082626511a64b81751b1f7fceaf878068db","declaredBodyBytes":126774},{"family":"btlCurrent","fixture":"backend/test/test-data/recruitmentGoal20261107/btl-controlled-pdf-boundaries.json.gz","selector":"formField","controlled":true,"bodySHA256":"9e52fec3bf2287736dddee4d90a1975a8eb1103505b6582ff7a3558242fc6f29","declaredBodyBytes":126877},{"family":"btlCurrent","fixture":"backend/test/test-data/recruitmentGoal20261107/btl-controlled-pdf-boundaries.json.gz","selector":"invisibleText","controlled":true,"bodySHA256":"b22f9d4e90ff70b133b8c423850af0358463c9585ff4b8013f2647969d966669","declaredBodyBytes":160522},{"family":"btlCurrent","fixture":"backend/test/test-data/recruitmentGoal20261107/btl-controlled-pdf-boundaries.json.gz","selector":"inlineWord","controlled":true,"bodySHA256":"02b83805496f4082180d7953a9842eb5022aaa64015edb0ff89f6962b4b4c6a7","declaredBodyBytes":1050},{"family":"iprogrammer","fixture":"backend/test/test-data/recruitmentGoal20261107/btl-current.json.gz","selector":1,"controlled":false,"bodySHA256":"5343c94153f6b157cf95a095b2a6d927fe31c294524a24638de59291861dfc0a","declaredBodyBytes":121555}],"originalDistinctPDFs":19,"originalReaderInvocations":23,"controlledBTLDerivatives":5};
fixtureManifest.moduleGraph.push('backend/scraper-support/shared/responseBodyDisposal.js');
const focusedScenarios=[{"family":"btlCurrent","selector":"1","control":"original","name":"genuine model btlCurrent 1","expectedStatus":"genuine-reader-completed"},{"family":"btlCurrent","selector":"2","control":"original","name":"genuine model btlCurrent 2","expectedStatus":"genuine-reader-completed"},{"family":"btlCurrent","selector":"3","control":"original","name":"genuine model btlCurrent 3","expectedStatus":"genuine-reader-completed"},{"family":"btlCurrent","selector":"4","control":"original","name":"genuine model btlCurrent 4","expectedStatus":"genuine-reader-completed"},{"family":"btlLegacy","selector":"1","control":"original","name":"genuine model btlLegacy 1","expectedStatus":"genuine-reader-completed"},{"family":"btlLegacy","selector":"2","control":"original","name":"genuine model btlLegacy 2","expectedStatus":"genuine-reader-completed"},{"family":"btlLegacy","selector":"3","control":"original","name":"genuine model btlLegacy 3","expectedStatus":"genuine-reader-completed"},{"family":"btlLegacy","selector":"4","control":"original","name":"genuine model btlLegacy 4","expectedStatus":"genuine-reader-completed"},{"family":"nitara","selector":"2","control":"original","name":"genuine model nitara 2","expectedStatus":"genuine-reader-completed"},{"family":"nitara","selector":"3","control":"original","name":"genuine model nitara 3","expectedStatus":"genuine-reader-completed"},{"family":"nitara","selector":"4","control":"original","name":"genuine model nitara 4","expectedStatus":"genuine-reader-completed"},{"family":"nitara","selector":"5","control":"original","name":"genuine model nitara 5","expectedStatus":"genuine-reader-completed"},{"family":"nitara","selector":"6","control":"original","name":"genuine model nitara 6","expectedStatus":"genuine-reader-completed"},{"family":"bhel","selector":"2","control":"original","name":"genuine model bhel 2","expectedStatus":"genuine-reader-completed"},{"family":"bhel","selector":"3","control":"original","name":"genuine model bhel 3","expectedStatus":"genuine-reader-completed"},{"family":"bhel","selector":"4","control":"original","name":"genuine model bhel 4","expectedStatus":"genuine-reader-completed"},{"family":"cdot","selector":"1","control":"original","name":"genuine model cdot 1","expectedStatus":"genuine-reader-completed"},{"family":"logelite","selector":"2","control":"original","name":"genuine model logelite 2","expectedStatus":"genuine-reader-completed"},{"family":"logelite","selector":"4","control":"original","name":"genuine model logelite 4","expectedStatus":"genuine-reader-completed"},{"family":"logelite","selector":"6","control":"original","name":"genuine model logelite 6","expectedStatus":"genuine-reader-completed"},{"family":"logelite","selector":"8","control":"original","name":"genuine model logelite 8","expectedStatus":"genuine-reader-completed"},{"family":"logelite","selector":"10","control":"original","name":"genuine model logelite 10","expectedStatus":"genuine-reader-completed"},{"family":"logelite","selector":"12","control":"original","name":"genuine model logelite 12","expectedStatus":"genuine-reader-completed"},{"family":"btlCurrent","selector":"extraMetadata","control":"btl-derivative","name":"genuine model btlCurrent extraMetadata","expectedStatus":"genuine-reader-completed"},{"family":"btlCurrent","selector":"annotation","control":"btl-derivative","name":"genuine model btlCurrent annotation","expectedStatus":"genuine-reader-completed"},{"family":"btlCurrent","selector":"formField","control":"btl-derivative","name":"genuine model btlCurrent formField","expectedStatus":"genuine-reader-completed"},{"family":"btlCurrent","selector":"invisibleText","control":"btl-derivative","name":"genuine model btlCurrent invisibleText","expectedStatus":"genuine-reader-completed"},{"family":"btlCurrent","selector":"inlineWord","control":"btl-derivative","name":"genuine model btlCurrent inlineWord","expectedStatus":"genuine-reader-completed"},{"family":"iprogrammer","selector":"1","control":"original","name":"genuine model iprogrammer 1","expectedStatus":"genuine-reader-completed"},{"family":"logelite","selector":"2","control":"logelite-pixel-mutation","name":"genuine Logelite decoded pixel mutation remains rejected","expectedStatus":"controlled-mutation-rejected-as-required"},{"family":"iprogrammer-import-cancel","selector":"null","control":"resolve","name":"iProgrammer optional display cancellation null late resolve","expectedStatus":"import-cancellation-contract-passed"},{"family":"iprogrammer-import-cancel","selector":"null","control":"reject","name":"iProgrammer optional display cancellation null late reject","expectedStatus":"import-cancellation-contract-passed"},{"family":"iprogrammer-import-cancel","selector":"false","control":"resolve","name":"iProgrammer optional display cancellation false late resolve","expectedStatus":"import-cancellation-contract-passed"},{"family":"iprogrammer-import-cancel","selector":"false","control":"reject","name":"iProgrammer optional display cancellation false late reject","expectedStatus":"import-cancellation-contract-passed"},{"family":"iprogrammer-import-cancel","selector":"zero","control":"resolve","name":"iProgrammer optional display cancellation zero late resolve","expectedStatus":"import-cancellation-contract-passed"},{"family":"iprogrammer-import-cancel","selector":"zero","control":"reject","name":"iProgrammer optional display cancellation zero late reject","expectedStatus":"import-cancellation-contract-passed"},{"family":"iprogrammer-import-cancel","selector":"empty","control":"resolve","name":"iProgrammer optional display cancellation empty late resolve","expectedStatus":"import-cancellation-contract-passed"},{"family":"iprogrammer-import-cancel","selector":"empty","control":"reject","name":"iProgrammer optional display cancellation empty late reject","expectedStatus":"import-cancellation-contract-passed"},{"family":"iprogrammer-import-cancel","selector":"frozen","control":"resolve","name":"iProgrammer optional display cancellation frozen late resolve","expectedStatus":"import-cancellation-contract-passed"},{"family":"iprogrammer-import-cancel","selector":"frozen","control":"reject","name":"iProgrammer optional display cancellation frozen late reject","expectedStatus":"import-cancellation-contract-passed"},{"family":"helper","selector":"preabort","control":"frozen","name":"shared display helper preabort","expectedStatus":"helper-contract-passed"},{"family":"helper","selector":"namespace","control":"frozen","name":"shared display helper namespace","expectedStatus":"helper-contract-passed"},{"family":"helper","selector":"existing","control":"frozen","name":"shared display helper existing","expectedStatus":"helper-contract-passed"},{"family":"helper","selector":"concurrent-existing","control":"frozen","name":"shared display helper concurrent-existing","expectedStatus":"helper-contract-passed"},{"family":"helper","selector":"cached-error","control":"frozen","name":"shared display helper cached-error","expectedStatus":"helper-contract-passed"},{"family":"helper","selector":"geometry-failure","control":"frozen","name":"shared display helper geometry-failure","expectedStatus":"helper-contract-passed"},{"family":"helper","selector":"missing-geometry","control":"frozen","name":"shared display helper missing-geometry","expectedStatus":"helper-contract-passed"},{"family":"helper","selector":"cancel-geometry-resolve","control":"null","name":"shared display helper cancel-geometry-resolve null","expectedStatus":"helper-contract-passed"},{"family":"helper","selector":"cancel-geometry-reject","control":"null","name":"shared display helper cancel-geometry-reject null","expectedStatus":"helper-contract-passed"},{"family":"helper","selector":"synchronous-abort","control":"null","name":"shared display helper synchronous-abort null","expectedStatus":"helper-contract-passed"},{"family":"helper","selector":"cancel-geometry-resolve","control":"false","name":"shared display helper cancel-geometry-resolve false","expectedStatus":"helper-contract-passed"},{"family":"helper","selector":"cancel-geometry-reject","control":"false","name":"shared display helper cancel-geometry-reject false","expectedStatus":"helper-contract-passed"},{"family":"helper","selector":"synchronous-abort","control":"false","name":"shared display helper synchronous-abort false","expectedStatus":"helper-contract-passed"},{"family":"helper","selector":"cancel-geometry-resolve","control":"zero","name":"shared display helper cancel-geometry-resolve zero","expectedStatus":"helper-contract-passed"},{"family":"helper","selector":"cancel-geometry-reject","control":"zero","name":"shared display helper cancel-geometry-reject zero","expectedStatus":"helper-contract-passed"},{"family":"helper","selector":"synchronous-abort","control":"zero","name":"shared display helper synchronous-abort zero","expectedStatus":"helper-contract-passed"},{"family":"helper","selector":"cancel-geometry-resolve","control":"empty","name":"shared display helper cancel-geometry-resolve empty","expectedStatus":"helper-contract-passed"},{"family":"helper","selector":"cancel-geometry-reject","control":"empty","name":"shared display helper cancel-geometry-reject empty","expectedStatus":"helper-contract-passed"},{"family":"helper","selector":"synchronous-abort","control":"empty","name":"shared display helper synchronous-abort empty","expectedStatus":"helper-contract-passed"},{"family":"helper","selector":"cancel-geometry-resolve","control":"frozen","name":"shared display helper cancel-geometry-resolve frozen","expectedStatus":"helper-contract-passed"},{"family":"helper","selector":"cancel-geometry-reject","control":"frozen","name":"shared display helper cancel-geometry-reject frozen","expectedStatus":"helper-contract-passed"},{"family":"helper","selector":"synchronous-abort","control":"frozen","name":"shared display helper synchronous-abort frozen","expectedStatus":"helper-contract-passed"},{"family":"helper","selector":"survivor-resolve","control":"frozen","name":"shared display helper survivor-resolve","expectedStatus":"helper-contract-passed"},{"family":"helper","selector":"survivor-reject","control":"frozen","name":"shared display helper survivor-reject","expectedStatus":"helper-contract-passed"}];
const dependencyPins=[{"path":"backend/node_modules/@napi-rs/canvas/geometry.js","bytes":19312,"sha256":"2e0ae365059fdb0424ddd2da8401e240a250c52b7efca68680996a99e804c1a1"},{"path":"backend/node_modules/@napi-rs/canvas/package.json","bytes":4800,"sha256":"0c1cf90f06d33ead24d20f86058ae54ba1a9795d73b601c8401a2bc96a35892a"},{"path":"backend/node_modules/pdfjs-dist/legacy/build/pdf.mjs","bytes":1032996,"sha256":"842284e0d1d439e60701e3355c2128cd3016ebebf14220e27f512467682aad66"},{"path":"backend/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs","bytes":2383409,"sha256":"b4e582882f5e811f4d1b7b511f68d9a0c3209141e6f68856f01408c5cc155131"},{"path":"backend/node_modules/pdfjs-dist/package.json","bytes":710,"sha256":"d7918934bf0ef5b18beed1bd2d9b49a04447de445c171305a2de082ccee369ed"}];
async function modelCase(family,selector,control='original'){
const root=path.resolve(backend,'..'),sha=b=>createHash('sha256').update(b).digest('hex');
const counters={unexpectedModuleAttempts:0,physicalNetworkAttempts:0,databaseModuleAttempts:0,browserModuleAttempts:0,childAttempts:0,workerAttempts:0,addonAttempts:0,writeAttempts:0,unexpectedNativeModuleAttempts:0,expectedOptionalRootResolutions:0,expectedOptionalRootPermissionDenials:0};
const eventLog=[],imports=[],warnings=[],assetReads=[];let phase='bootstrap';
globalThis.__pdfDisplayFailureReceipt=()=>({phase,counters,eventLog,warnings,imports,permissions:Object.fromEntries(['addons','worker','child','fs.write'].map(k=>[k,process.permission.has(k)])),DOMMatrixDefined:typeof globalThis.DOMMatrix!=='undefined'});
const denied=key=>(..._args)=>{counters[key]++;throw Error('Read-only proof forbids '+key);};
globalThis.fetch=denied('physicalNetworkAttempts');
for(const m of [http,https]){m.request=denied('physicalNetworkAttempts');m.get=denied('physicalNetworkAttempts');}
http2.connect=denied('physicalNetworkAttempts');net.connect=denied('physicalNetworkAttempts');net.createConnection=denied('physicalNetworkAttempts');net.Socket.prototype.connect=denied('physicalNetworkAttempts');tls.connect=denied('physicalNetworkAttempts');dgram.createSocket=denied('physicalNetworkAttempts');
if(globalThis.WebSocket)globalThis.WebSocket=class {constructor(){denied('physicalNetworkAttempts')();}};
if(globalThis.EventSource)globalThis.EventSource=class {constructor(){denied('physicalNetworkAttempts')();}};
for(const key of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])child[key]=denied('childAttempts');
wt.Worker=class {constructor(){denied('workerAttempts')();}};
process.dlopen=denied('addonAttempts');
for(const key of ['appendFile','appendFileSync','copyFile','copyFileSync','cp','cpSync','createWriteStream','ftruncate','ftruncateSync','link','linkSync','mkdir','mkdirSync','mkdtemp','mkdtempSync','rename','renameSync','rm','rmSync','rmdir','rmdirSync','symlink','symlinkSync','truncate','truncateSync','unlink','unlinkSync','write','writeSync','writeFile','writeFileSync','writev','writevSync'])if(typeof fs[key]==='function')fs[key]=denied('writeAttempts');
for(const key of ['appendFile','copyFile','cp','link','mkdir','mkdtemp','rename','rm','rmdir','symlink','truncate','unlink','writeFile'])if(typeof fsp[key]==='function')fsp[key]=denied('writeAttempts');
const originalOpen=fsp.open;fsp.open=(filename,flags,...rest)=>{if(flags!=='r'&&flags!==0&&flags!==undefined)return denied('writeAttempts')();return originalOpen(filename,flags,...rest);};
const originalOpenSync=fs.openSync;fs.openSync=(filename,flags,...rest)=>{if(flags!=='r'&&flags!==0&&flags!==undefined)return denied('writeAttempts')();return originalOpenSync(filename,flags,...rest);};
const readFile=fsp.readFile;fsp.readFile=async(filename,...args)=>{const value=await readFile(filename,...args);const p=filename instanceof URL?fileURLToPath(filename):String(filename);if(/[\\/]pdfjs-dist[\\/](?:standard_fonts|cmaps|wasm)[\\/]/.test(p)){const b=typeof value==='string'?Buffer.from(value):value;assetReads.push({path:p,bytes:b.length,sha256:sha(b)});}return value;};
syncBuiltinESMExports();
const canvasIndex=path.join(root,'backend/node_modules/@napi-rs/canvas/index.js'),geometryFile=path.join(root,'backend/node_modules/@napi-rs/canvas/geometry.js');
const expectedRootURL=pathToFileURL(canvasIndex).href;
const allowedReadPaths=readGrants().map(flag=>path.resolve(flag.slice('--allow-fs-read='.length)));
const admittedFile=filename=>allowedReadPaths.some(allowed=>filename===allowed||filename.startsWith(allowed+path.sep));
const expectedDenial=(e,location)=>{if(e?.code==='ERR_ACCESS_DENIED'&&(/@napi-rs[\\/]canvas[\\/]index\.js/.test(String(e.resource??e.message)))){counters.expectedOptionalRootPermissionDenials++;eventLog.push({kind:'expected-optional-root-permission-denial',location,code:e.code,permission:e.permission,resource:e.resource,message:e.message});return true;}return false;};
registerHooks({resolve(specifier,context,next){
 if(/(?:^|\/)(?:mongoose|mongodb|mysql|mysql2|pg|sequelize|prisma|knex)(?:\/|$)/i.test(specifier)){counters.databaseModuleAttempts++;throw Error('Database module forbidden');}
 if(/(?:playwright|puppeteer|selenium)(?:\/|$)/i.test(specifier)){counters.browserModuleAttempts++;throw Error('Browser module forbidden');}
 if(specifier==='@napi-rs/canvas'){counters.expectedOptionalRootResolutions++;assert.equal(process.permission.has('fs.read',canvasIndex),false);}
 if(/js-binding\.js|\.node(?:$|\?)/.test(specifier)){counters.unexpectedNativeModuleAttempts++;throw Error('Unreviewed native module requested');}
 try{const result=next(specifier,context);if(result.url.startsWith('file:')&&result.url!==expectedRootURL&&!admittedFile(fileURLToPath(result.url))){counters.unexpectedModuleAttempts++;throw Error('Unreviewed module requested: '+result.url);}imports.push({specifier,url:result.url,parentURL:context.parentURL??null});return result;}catch(e){expectedDenial(e,'resolve');throw e;}
},load(url,context,next){
 if(url===expectedRootURL)assert.equal(process.permission.has('fs.read',canvasIndex),false);
 if(/(?:js-binding\.js|\.node)(?:$|\?)/.test(url)){counters.unexpectedNativeModuleAttempts++;throw Error('Native module forbidden');}
 try{return next(url,context);}catch(e){expectedDenial(e,'load');throw e;}
}});
const warn=console.warn.bind(console);console.warn=(...args)=>{const text=args.map(String).join(' ');assert.ok(warnings.length<128);warnings.push({phase,message:text});warn(...args);};
const permissionSnapshot=()=>Object.fromEntries(['addons','worker','child','fs.write'].map(k=>[k,process.permission.has(k)]));
assert.deepEqual(permissionSnapshot(),{addons:false,worker:false,child:false,'fs.write':false});
assert.ok(process.execArgv.includes('--disallow-code-generation-from-strings'));
assert.equal(typeof globalThis.DOMMatrix,'undefined');assert.equal(typeof globalThis.Path2D,'undefined');assert.equal(typeof globalThis.ImageData,'undefined');
if(family==='helper')return await helperCase(selector,control,{root,counters,eventLog,warnings,imports,permissionSnapshot});
if(family==='iprogrammer-import-cancel')return await iprogrammerImportControl(selector,control,{root,counters,eventLog,warnings,imports,permissionSnapshot});
const manifest=fixtureManifest;
const source=manifest.readers[family];assert.ok(source,'Unknown unchanged reader');
const row=manifest.cohort.find(r=>r.family===family&&String(r.selector)===selector&&r.controlled===(control==='btl-derivative'));assert.ok(row,'Missing frozen cohort row');
const fixtureBytes=await fsp.readFile(path.join(root,row.fixture)),fixture=JSON.parse(gunzipSync(fixtureBytes));
const packet=row.controlled?fixture.cases[selector]:(fixture.packets??fixture.requests)[Number(selector)];
const originalBytes=Buffer.from(packet.bodyBase64??packet.body,'base64');assert.equal(sha(originalBytes),row.bodySHA256);assert.equal(originalBytes.length,row.declaredBodyBytes);assert.ok(originalBytes.length<5*1024*1024&&originalBytes.subarray(0,5).toString()==='%PDF-');
const pinManifest={files:dependencyPins};
const pin=async name=>{const b=await fsp.readFile(path.join(root,name)),p=pinManifest.files.find(p=>p.path===name);if(p)assert.equal(sha(b),p.sha256);return {path:name,bytes:b.length,sha256:sha(b),dependencyPinVerified:Boolean(p)};};
const pins=await Promise.all(['backend/node_modules/@napi-rs/canvas/geometry.js','backend/node_modules/@napi-rs/canvas/package.json','backend/node_modules/pdfjs-dist/package.json','backend/node_modules/pdfjs-dist/legacy/build/pdf.mjs','backend/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',source.path].map(pin));
phase='genuine-display-and-reader-import';const reader=await import(pathToFileURL(path.join(root,source.path)));assert.equal(typeof reader[source.export],'function');
const geometry=await import(pathToFileURL(geometryFile));assert.equal(geometry.DOMMatrix,geometry.default.DOMMatrix);
let bytes=originalBytes;
if(control==='logelite-pixel-mutation'){phase='controlled-actual-PDF-pixel-mutation';bytes=changedWatermarkPDF(originalBytes);assert.notEqual(sha(bytes),sha(originalBytes));}
const controller=new AbortController(),timeout=Object.assign(Error('Bounded genuine geometry characterization deadline'),{name:'TimeoutError'}),timer=setTimeout(()=>controller.abort(timeout),25000);
const started=performance.now();let result,error,readerCompleted=false,success=false,contracts={};
try{
 phase='unchanged-reader-decode';result=await reader[source.export](bytes,{signal:controller.signal});readerCompleted=true;
 assert.ok(control!=='logelite-pixel-mutation','Changed actual watermark must be rejected by unchanged guard');
 if(family==='iprogrammer')assert.equal(typeof result,'string');else assert.ok(result&&typeof result==='object');
 if(family==='btlCurrent'||family==='bhel'){
  assert.equal(result.pages,result.pageModels.length);assert.ok(result.text.length>30);assert.ok(result.pageModels.every(p=>p.textContent.items.length>0&&p.operatorList.fnArray.length===p.operatorList.argsArray.length));
  assert.equal(result.renderedCriteriaVisibilityQualified,false);assert.equal(result.publicationDateQualified,false);assert.equal(result.PDFJavaScriptActionsExecuted,false);
  contracts={fullPageTextGeometryOperatorsMetadataReturned:true,renderedCriteriaVisibilityQualified:false,publicationDateQualified:false,missingAPIs:result.missingAPIs,visibilityLimits:result.visibilityLimits};
  if(family==='btlCurrent'&&!row.controlled){
   const expected=fixture.independentOracle.documents.find(d=>d.bodySHA256===row.bodySHA256);assert.ok(expected);assert.equal(result.pageCount,expected.pageCount);
   const chars=s=>s.normalize('NFKC').replace(/\s+/g,'');
   for(let i=0;i<expected.pageCount;i++){assert.deepEqual(result.pageModels[i].view,expected.pages[i].cropBox);assert.equal(chars(result.pageModels[i].text),chars(expected.pages[i].text));assert.ok(result.pageModels[i].operatorList.fnArray.length>10);}
   for(const k of ['CreationDate','ModDate'])assert.equal(result.metadata.info[k],expected.metadata['/'+k]);contracts.independentCompleteTextGeometryAndCalendarAssertions=true;
  }
  if(row.controlled){
   const expected=packet.expected;
   if(selector==='extraMetadata')assert.equal(result.metadata.info.Custom.MandatoryCredential,expected.value);
   if(selector==='annotation')assert.ok(result.pageModels.flatMap(p=>p.annotations).some(a=>a.contentsObj?.str===expected.contents));
   if(selector==='formField')assert.ok(result.fieldObjects.mandatoryCredential.some(f=>f.value===expected.value));
   if(selector==='invisibleText')assert.ok(result.visibilityLimits.includes('invisible-text-rendering'));
   if(selector==='inlineWord'){assert.match(result.text,/Mandatory CPA certification/);assert.doesNotMatch(result.text,/Mand atory/);}
   contracts.retainedControlledBoundaryAsserted=selector;
  }
 }else if(family==='iprogrammer'){
  assert.ok(result.length>3000);assert.match(result,/BTL India/);
  const expected=fixture.independentOracle.documents.find(d=>d.bodySHA256===row.bodySHA256);assert.ok(expected);
  const chars=s=>s.normalize('NFKC').replace(/\s+/g,'');assert.equal(chars(result),chars(expected.pages.map(p=>p.text).join('\n')));
  contracts={genericParserOnlyOnRetainedBTLInput:true,completeTextMatchesIndependentBTLOracle:true,iProgrammerSourceOrJobBindingInvoked:false,sourceCountryOrCriteriaQualified:false};
 }else if(family==='btlLegacy'||family==='nitara'){
  assert.ok(Number.isSafeInteger(result.pages)&&result.pages>0&&result.text.length>30);assert.ok(Array.isArray(result.visibilityLimits));assert.equal(result.publicationDateQualified,false);contracts={genuineLegacyTextVisibilityMetadataReturned:true,publicationDateQualified:false,visibilityLimits:result.visibilityLimits};
 }else if(family==='cdot'){
  assert.equal(result.sha256,sha(bytes));assert.equal(result.pages.length,result.totalPages);assert.ok(result.pages.every(p=>p.text.length>30&&p.items.length>0));assert.equal(result.attachments,null);assert.equal(result.fields,null);assert.equal(result.actions,null);contracts={fullGenuineTextGeometryStylesAnnotationsMetadataAndNoFormsActionsGuards:true};
 }else if(family==='logelite'){
  const model=result.document;assert.ok(model);assert.equal(model.sha256,sha(bytes));assert.equal(model.pages.length,model.totalPages);
  const expected=fixture.pdfModels.find(m=>m.pdf.sha256===sha(bytes))?.pdf;assert.ok(expected);assert.equal(model.text,expected.text);assert.equal(model.totalPages,expected.totalPages);assert.deepEqual(model.metadata,expected.metadata);
  // The retained JSON oracle necessarily serializes typed arrays to index-key
  // records and omits undefined keys. Compare that exact stored representation;
  // never replace or mutate the live model used by the unchanged reader.
  for(let i=0;i<model.pages.length;i++)for(const key of ['number','width','height','text','items','styles','annotations'])assert.deepEqual(JSON.parse(JSON.stringify(model.pages[i][key])),expected.pages[i][key]);
  assert.ok(model.pages.every(p=>p.images.length>0&&p.graphicsOperations.length>0&&typeof p.graphicsSHA256==='string'));
  assert.equal(model.openAction,null);contracts={fullGenuineTextGeometryStylesAnnotationsAndMetadataMatchRetainedSerializedModel:true,unchangedPixelAndVectorGraphicsReviewGuardsPassed:true,images:model.pages.flatMap(p=>p.images),graphicsSHA256:model.pages.map(p=>p.graphicsSHA256),renderingPerformed:false};
 }
 success=true;
}catch(e){error=e;if(control==='logelite-pixel-mutation'){assert.match(String(e?.message),/new PDF artwork\/criteria image/);contracts={changedGenuineWatermarkRejectedByUnchangedGuard:true};}}
finally{clearTimeout(timer);}
if(error&&!(control==='logelite-pixel-mutation'&&contracts.changedGenuineWatermarkRejectedByUnchangedGuard))throw error;
phase='receipt-verification';
await new Promise(resolve=>setImmediate(resolve));
assert.equal(globalThis.DOMMatrix,geometry.default.DOMMatrix);assert.equal(typeof globalThis.Path2D,'undefined');assert.equal(typeof globalThis.ImageData,'undefined');
assert.deepEqual(permissionSnapshot(),{addons:false,worker:false,child:false,'fs.write':false});
for(const key of ['unexpectedModuleAttempts','physicalNetworkAttempts','databaseModuleAttempts','browserModuleAttempts','childAttempts','workerAttempts','addonAttempts','writeAttempts','unexpectedNativeModuleAttempts'])assert.equal(counters[key],0,key);
const activeResources=process.getActiveResourcesInfo();assert.ok(!activeResources.some(r=>['MessagePort','TCPWrap','TLSWrap','UDPSendWrap','ProcessWrap','FSEventWrap'].includes(r)));
let modelSummary=null;
if(typeof result==='string'){modelSummary={resultBytes:Buffer.byteLength(result),resultSHA256:sha(result),textBytes:Buffer.byteLength(result),textSHA256:sha(result),returnedValueType:'string'};}else if(result){const raw=JSON.stringify(result);assert.ok(Buffer.byteLength(raw)<=12*1024*1024);const model=result.document??result;modelSummary={resultBytes:Buffer.byteLength(raw),resultSHA256:sha(raw),pages:model.pageCount??model.totalPages??model.pages,textBytes:Buffer.byteLength(model.text??''),textSHA256:sha(model.text??''),pageModels:model.pageModels?.map(p=>({number:p.pageNumber,textBytes:Buffer.byteLength(p.text),textSHA256:sha(p.text),items:p.textContent.items.length,operators:p.operatorList.fnArray.length,annotations:p.annotations.length})),missingAPIs:model.missingAPIs??null};}
process.stdout.write(JSON.stringify({status:success?'genuine-reader-completed':control==='logelite-pixel-mutation'&&contracts.changedGenuineWatermarkRejectedByUnchangedGuard?'controlled-mutation-rejected-as-required':'unchanged-reader-held',readerCompleted,family,selector,control,fixture:{path:row.fixture,sha256:sha(fixtureBytes),originalPDFSHA256:sha(originalBytes),actualInputSHA256:sha(bytes),originalBytes:originalBytes.length,actualBytes:bytes.length},source,pins,geometry:{classIdentity:'globalThis.DOMMatrix === imported unchanged geometry.default.DOMMatrix',ImageDataAbsent:true,Path2DAbsent:true,canvasIndexReadable:process.permission.has('fs.read',canvasIndex),canvasRootNeverSuccessfullyLoaded:!imports.some(x=>x.url===expectedRootURL&&process.permission.has('fs.read',canvasIndex)),officialCanvasVersion:'1.0.3'},permissions:permissionSnapshot(),execArgv:process.execArgv,counters,eventLog,warnings,assetReads,imports,activeResources,contracts,modelSummary,error:error?{name:error?.name,message:String(error?.message??error),code:error?.code}:null,elapsedMs:Math.round(performance.now()-started),claims:{modelOnly:true,rendering:false,parserReplaced:false,externalGeometryAssignment:false,readerExtractionContractsUnchanged:true,sourceInventoryOrCountryOrCriteriaQualified:false}})+'\n');

if(!success&&!(control==='logelite-pixel-mutation'&&contracts.changedGenuineWatermarkRejectedByUnchangedGuard))process.exitCode=1;

}


// Failure/initialization controls only. The authored module has no parser API,
// returns no model and establishes no iProgrammer/provider facts.
async function iprogrammerImportControl(label,settlement,guard){
 const {getEventListeners}=await import('node:events');
 const reason=label==='frozen'?Object.freeze(Error('Authored frozen import caller')):({null:null,false:false,zero:0,empty:''})[label];
 const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
 const started=deferred(),late=deferred(),caller=new AbortController(),ordinary=Object.freeze(Error('Authored late optional display initialization rejection'));
 globalThis.__iprogrammerImportControl={started,late};
 registerHooks({resolve(specifier,context,next){return specifier==='pdfjs-dist/legacy/build/pdf.mjs'?{url:'iprogrammer-import-control:pending-display',shortCircuit:true}:next(specifier,context);},load(url,context,next){
  if(url==='iprogrammer-import-control:pending-display')return{format:'module',shortCircuit:true,source:'const control=globalThis.__iprogrammerImportControl;control.started.resolve();await control.late.promise;export const authoredInitializationControl=true;'};
  return next(url,context);
 }});
 const fixture=JSON.parse(gunzipSync(await fsp.readFile(path.join(guard.root,fixtureManifest.fixtures.btlCurrent))));
 const bytes=Buffer.from(fixture.packets[1].bodyBase64,'base64');
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'5343c94153f6b157cf95a095b2a6d927fe31c294524a24638de59291861dfc0a');
 const {parseNativeAnnouncementPdf}=await import(pathToFileURL(path.join(backend,'scraper/iprogrammersolutions/employerAnnouncement.js')));
 const pending=parseNativeAnnouncementPdf(bytes,{signal:caller.signal}).then(value=>({ok:true,value}),reason=>({ok:false,reason}));
 let exactBeforeRelease=false,timer,failure;
 try{
  await Promise.race([started.promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Independent watchdog: display import must enter')),1000);})]);clearTimeout(timer);
  caller.abort(reason);
  const result=await Promise.race([pending,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Independent watchdog: caller must settle before display module release')),750);})]);
  assert.equal(result.ok,false);assert.equal(result.reason,reason);exactBeforeRelease=true;
 }catch(error){failure=error;}
 finally{clearTimeout(timer);if(settlement==='reject')late.reject(ordinary);else late.resolve();await pending;await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));}
 assert.equal(getEventListeners(caller.signal,'abort').length,0);
 for(const [name,value]of Object.entries(guard.counters))if(!name.startsWith('expectedOptional'))assert.equal(value,0,name);
 const receipt={status:failure?'import-cancellation-contract-failed':'import-cancellation-contract-passed',label,settlement,exactBeforeRelease,
  guard:{counters:guard.counters,eventLog:guard.eventLog,warnings:guard.warnings,imports:guard.imports,permissions:guard.permissionSnapshot()},
  authoredInitializationOnly:true,abortListenersAfter:getEventListeners(caller.signal,'abort').length,parserAPIProvided:false,decodedModelsProvided:false,providerOrPublicationProof:false,
  error:failure?{name:failure.name,message:failure.message}:null};
 console.log(JSON.stringify(receipt));if(failure)process.exitCode=1;
}

// These initialization controls supply no parser, models or provider evidence.
async function helperCase(mode,label,guard){
 const {getEventListeners}=await import('node:events');
 const reasonFor=name=>name==='frozen'?Object.freeze(Error('Authored frozen helper caller')):({null:null,false:false,zero:0,empty:''})[name];
 const reflect=promise=>promise.then(value=>({ok:true,value}),reason=>({ok:false,reason}));
 const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
 const bounded=async promise=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Independent helper contract watchdog')),1000);})]);}finally{clearTimeout(timer);}};
 const geometryURL=pathToFileURL(path.join(backend,'node_modules/@napi-rs/canvas/geometry.js')).href;
 const displayURL=pathToFileURL(path.join(backend,'node_modules/pdfjs-dist/legacy/build/pdf.mjs')).href;
 const helperURL=pathToFileURL(path.join(backend,'scraper-support/shared/pdfDisplay.js')).href;
 const observed={geometryResolutions:0,displayResolutions:0,initializations:0};
 const late=deferred(),entered=deferred(),ordinary=Object.freeze(Error('Authored optional initialization failure'));
 let action,originalFailure,propertyInstalled=false;
 globalThis.__pdfDisplayHelperControl={late,entered,observed,action:()=>action?.()};
 const controlled=mode==='cancel-geometry-resolve'||mode==='cancel-geometry-reject'||mode==='survivor-resolve'||mode==='survivor-reject'||mode==='synchronous-abort';
 registerHooks({resolve(specifier,context,next){
  const owner=context.parentURL===helperURL;
  if(owner&&specifier==='@napi-rs/canvas/geometry.js'){
   observed.geometryResolutions++;
   if(mode==='geometry-failure')throw ordinary;
   if(mode==='missing-geometry'){
    try{return next('@napi-rs/canvas/codex-absent-geometry.js',context);}catch(error){originalFailure=error;throw error;}
   }
   if(mode==='concurrent-existing')action();
   if(controlled)return{url:'pdf-display-helper-control:geometry',shortCircuit:true};
  }
  if(owner&&specifier==='pdfjs-dist/legacy/build/pdf.mjs')observed.displayResolutions++;
  return next(specifier,context);
 },load(url,context,next){
  if(url==='pdf-display-helper-control:geometry')return{format:'module',shortCircuit:true,source:
   'const c=globalThis.__pdfDisplayHelperControl;c.observed.initializations++;c.action();c.entered.resolve();await c.late.promise;const real=await import('+JSON.stringify(geometryURL)+');export const DOMMatrix=real.DOMMatrix;export default real.default;'};
  return next(url,context);
 }});
 const {loadPdfDisplay}=await import(helperURL);
 assert.equal(typeof globalThis.DOMMatrix,'undefined');
 let details;
 try{
  if(mode==='preabort'){
   for(const name of ['null','false','zero','empty','frozen']){
    const caller=new AbortController(),reason=reasonFor(name);caller.abort(reason);
    const result=await loadPdfDisplay({signal:caller.signal}).then(value=>({ok:true,value}),reason=>({ok:false,reason}));
    assert.equal(result.ok,false);assert.equal(result.reason,reason);assert.equal(getEventListeners(caller.signal,'abort').length,0);
   }
   assert.equal(observed.geometryResolutions,0);assert.equal(observed.displayResolutions,0);assert.equal(typeof globalThis.DOMMatrix,'undefined');
   details={exactPreabortReasons:5,noOptionalInitialization:true};
  }else if(mode==='namespace'||mode==='existing'||mode==='concurrent-existing'){
   let official,writes=0,current;
   if(mode!=='namespace'){
    official=await import(geometryURL);
    if(mode==='existing')current=official.DOMMatrix;
    Object.defineProperty(globalThis,'DOMMatrix',{configurable:true,get:()=>current,set:value=>{writes++;current=value;}});propertyInstalled=true;
    action=()=>{Reflect.set(globalThis,'DOMMatrix',official.DOMMatrix);};
   }
   const actual=await loadPdfDisplay(),canonical=await import(displayURL);
   official??=await import(geometryURL);
   assert.equal(actual,canonical);assert.equal(actual.getDocument,canonical.getDocument);
   assert.equal(globalThis.DOMMatrix,official.DOMMatrix);
   if(mode==='existing'){assert.equal(writes,0);assert.equal(observed.geometryResolutions,0);}
   if(mode==='concurrent-existing'){assert.equal(writes,1);assert.equal(observed.geometryResolutions,1);}
   details={canonicalNamespaceIdentity:true,genuineOfficialClassIdentity:true,globalSetterWrites:writes,externalClassOnlyForRetentionControl:mode!=='namespace'};
  }else if(mode==='cached-error'){
   let raw,repeated;
   try{await import(displayURL);}catch(error){raw=error;}
   assert.ok(raw instanceof ReferenceError);assert.equal(raw.message,'DOMMatrix is not defined');
   try{await import(displayURL);}catch(error){repeated=error;}
   assert.equal(raw,repeated);
   const result=await reflect(loadPdfDisplay());assert.equal(result.ok,false);assert.equal(result.reason,raw);
   const again=await reflect(loadPdfDisplay());assert.equal(again.reason,raw);
   const official=await import(geometryURL);assert.equal(globalThis.DOMMatrix,official.DOMMatrix);
   details={originalCachedErrorIdentity:true,noCacheBypass:true,genuineGeometryStillInitialized:true};
  }else if(mode==='geometry-failure'||mode==='missing-geometry'){
   const caller=new AbortController(),result=await reflect(loadPdfDisplay({signal:caller.signal}));
   assert.equal(result.ok,false);assert.equal(result.reason,mode==='geometry-failure'?ordinary:originalFailure);
   if(mode==='missing-geometry')assert.equal(originalFailure?.code,'ERR_MODULE_NOT_FOUND');
   assert.equal(observed.displayResolutions,0);assert.equal(typeof globalThis.DOMMatrix,'undefined');
   assert.equal(getEventListeners(caller.signal,'abort').length,0);
   details={originalErrorIdentity:true,errorCode:result.reason?.code??null};
  }else if(controlled){
   const caller=new AbortController(),reason=reasonFor(label),peer=new AbortController();
   const synchronous=mode==='synchronous-abort',survivor=mode.startsWith('survivor-');
   if(synchronous){action=()=>caller.abort(reason);late.resolve();}
   const cancelled=reflect(loadPdfDisplay({signal:caller.signal}));
   const surviving=survivor?reflect(loadPdfDisplay({signal:peer.signal})):undefined;
   let result,peerResult;
   try{
    await bounded(entered.promise);
    if(!synchronous)caller.abort(reason);
    result=await bounded(cancelled);assert.equal(result.ok,false);assert.equal(result.reason,reason);
    assert.equal(getEventListeners(caller.signal,'abort').length,0);assert.equal(peer.signal.aborted,false);
   }finally{
    if(mode.endsWith('-reject'))late.reject(ordinary);else late.resolve();
    await bounded(cancelled);if(surviving)peerResult=await bounded(surviving);
    await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));
   }
   assert.equal(observed.initializations,1);
   if(survivor){
    if(mode.endsWith('-resolve')){assert.equal(peerResult.ok,true);assert.equal(peerResult.value,await import(displayURL));}
    else{assert.equal(peerResult.ok,false);assert.equal(peerResult.reason,ordinary);}
    assert.equal(getEventListeners(peer.signal,'abort').length,0);
   }else{assert.equal(typeof globalThis.DOMMatrix,'undefined');assert.equal(observed.displayResolutions,0);}
   details={exactCallerReason:true,settledBeforeRelease:true,sharedInitialization:observed.initializations,survivingCaller:survivor,peerSucceeded:peerResult?.ok??null};
  }else throw Error('Unknown helper control '+mode);
  for(const [name,value]of Object.entries(guard.counters))if(!name.startsWith('expectedOptional'))assert.equal(value,0,name);
  console.log(JSON.stringify({status:'helper-contract-passed',mode,label,details,observed,
   guard:{counters:guard.counters,eventLog:guard.eventLog,warnings:guard.warnings,imports:guard.imports,permissions:guard.permissionSnapshot()},
   authoredInitializationControlOnly:controlled||mode==='geometry-failure',parserAPIReplaced:false,decodedModelSupplied:false}));
 }finally{if(propertyInstalled)delete globalThis.DOMMatrix;}
}

function rewriteNativePDF(bytes,mutate){
 const input=bytes.toString('latin1'),matches=[...input.matchAll(/(\d+) (\d+) obj\b([\s\S]*?)endobj/g)],trailer=input.slice(input.lastIndexOf('trailer'),input.lastIndexOf('startxref'))
 assert.equal(matches.length,Number(/\/Size (\d+)/.exec(trailer)[1])-1)
 const objects=matches.map(match=>{
  const object=mutate(match[0],Number(match[1]))
  return {id:Number(match[1]),generation:Number(match[2]),bytes:Buffer.from(object+'\n','latin1')}
 })
 const parts=[Buffer.from(input.slice(0,matches[0].index),'latin1')],offsets=new Map();let offset=parts[0].length
 for(const object of objects){assert.equal(object.generation,0);offsets.set(object.id,offset);parts.push(object.bytes);offset+=object.bytes.length}
 const size=Math.max(...offsets.keys())+1,table=['xref','0 '+size,'0000000000 65535 f ']
 for(let id=1;id<size;id++)table.push(String(offsets.get(id)||0).padStart(10,'0')+' 00000 '+(offsets.has(id)?'n':'f')+' ')
 parts.push(Buffer.from(table.join('\n')+'\n'+trailer+'startxref\n'+offset+'\n%%EOF\n','latin1'));return Buffer.concat(parts)
}
function rewriteFlateStream(object,mutate){
 const stream=/stream\r?\n/.exec(object),size=Number(/\/Length (\d+)/.exec(object)[1]),start=stream.index+stream[0].length
 const packed=deflateSync(mutate(inflateSync(Buffer.from(object.slice(start,start+size),'latin1'))))
 return object.slice(0,start).replace(/\/Length \d+/,'/Length '+packed.length)+packed.toString('latin1')+object.slice(start+size)
}
function changedWatermarkPDF(bytes){
 let altered=false
 const result=rewriteNativePDF(bytes,object=>{if(!altered&&/\/Subtype\s*\/Image/.test(object)&&/\/ColorSpace\s*\/DeviceRGB/.test(object)){
  altered=true;return rewriteFlateStream(object,pixels=>{pixels[0]^=127;return pixels})
 }return object});assert.ok(altered);return result
}


function readGrants(){
 const root=path.resolve(backend,'..'),pdf=path.join(backend,'node_modules/pdfjs-dist');
 const files=[self,path.join(backend,'package.json'),path.join(backend,'node_modules/entities/package.json'),
  path.join(backend,'node_modules/@napi-rs/canvas/package.json'),path.join(backend,'node_modules/@napi-rs/canvas/geometry.js'),
  path.join(pdf,'package.json'),path.join(pdf,'legacy/build/pdf.mjs'),path.join(pdf,'legacy/build/pdf.worker.mjs'),
  path.join(pdf,'standard_fonts'),path.join(pdf,'cmaps'),path.join(pdf,'wasm'),
  path.join(backend,'scraper-support/shared/pdfDisplay.js'),
  ...fixtureManifest.moduleGraph.map(name=>path.join(root,name)),
  ...Object.values(fixtureManifest.fixtures).map(name=>path.join(root,name))];
 files.push(path.join(root,'package.json'));
 return [...new Set(files)].map(name=>'--allow-fs-read='+name);
}
if(process.argv.includes(marker)){
 const index=process.argv.indexOf(marker);
 try{await modelCase(...process.argv.slice(index+1));}
 catch(error){console.log(JSON.stringify({status:'genuine-reader-failed',error:{name:error?.name,message:String(error?.message??error),code:error?.code,resource:error?.resource,permission:error?.permission,stack:error?.stack},guard:globalThis.__pdfDisplayFailureReceipt?.(),externalGeometryAssignment:false}));process.exitCode=1;}
}else{
 for(const row of focusedScenarios){
  test(row.name,()=>{
   const environment={...process.env,NODE_OPTIONS:'',PDF_DISPLAY_TEST_BACKEND:backend};delete environment.NODE_TEST_CONTEXT;
   const args=['--permission','--disallow-code-generation-from-strings','--unhandled-rejections=strict',...readGrants(),self,marker,row.family,String(row.selector),row.control];
   const result=child.spawnSync(process.execPath,args,{cwd:path.resolve(backend,'..'),env:environment,encoding:'utf8',timeout:35000,windowsHide:true,maxBuffer:2*1024*1024});
   assert.equal(result.error,undefined,result.error?.message);assert.equal(result.status,0,result.stderr||result.stdout);
   const receipt=JSON.parse(result.stdout);assert.equal(receipt.status,row.expectedStatus);
   console.log('PDF_DISPLAY_CHILD '+JSON.stringify(receipt));
  });
 }
}
