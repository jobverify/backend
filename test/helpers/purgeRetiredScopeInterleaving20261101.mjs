import path from 'node:path'
import {registerHooks} from 'node:module'
import {pathToFileURL} from 'node:url'

// Deterministic test-only interleavings. The production CLI has no test seam.
// Refuse use outside a uniquely named temporary loopback test database.
if (!/^mongodb:\/\/127\.0\.0\.1:\d+\/purge_scope_20261101_/.test(process.env.MONGO_URI || '')) {
  throw Error('Purge scope fixture requires an explicit owned loopback Mongo URI')
}
const backend=path.resolve(import.meta.dirname,'../..')
const dbURL=pathToFileURL(path.join(backend,'db/db.js')).href
const models=new Map(['Job','User','ScraperStatus','ScraperRun'].map(name=>[pathToFileURL(path.join(backend,'src/models/'+name+'.js')).href,name]))
const probe="\n// Test-only deterministic interleaving, loaded only in this explicit temp DB.\nif (process.env.PURGE_RACE_KIND) {\n  const fixtureModel = __FIXTURE_MODEL__\n  const fixtureState = globalThis[Symbol.for('purge.scope.fixture.race')] ||= { done: false }\n  const fixtureRace = async () => {\n    if (fixtureState.done) return\n    const uri = process.env.MONGO_URI\n    if (!/^mongodb:\\/\\/127\\.0\\.0\\.1:\\d+\\/purge_scope_20261101_/.test(uri || '')) throw Error('Race fixture requires owned loopback database')\n    fixtureState.done = true\n    const fixtureMongoose = (await import('mongoose')).default\n    const db = fixtureMongoose.connection.db\n    const id = new fixtureMongoose.Types.ObjectId(process.env.PURGE_RACE_TARGET)\n    if (process.env.PURGE_RACE_KIND === 'history-peer') {\n      const collection = db.collection('scraperruns'), current = await collection.findOne({ _id: id })\n      current.sources[process.env.PURGE_RACE_PEER_KEY].jobsFound = 37\n      current.sources['new-peer'] = { success: true, jobsFound: 2 }\n      await collection.updateOne({ _id: id }, { $set: { sources: current.sources, overall: { totalJobs: 40, sourcesSucceeded: 3, sourcesFailed: 0 } } })\n    } else {\n      await db.collection(process.env.PURGE_RACE_KIND === 'job-source' ? 'jobs' : 'scraperstatuses').updateOne({ _id: id }, { $set: { source: process.env.PURGE_RACE_PEER } })\n    }\n    process.stderr.write('PURGE_RACE_EXECUTED\\n')\n  }\n  if (process.env.PURGE_RACE_KIND === 'history-peer' && '__FIXTURE_MODEL__' === 'ScraperRun') {\n    const fixtureBulkWrite = fixtureModel.collection.bulkWrite.bind(fixtureModel.collection)\n    fixtureModel.collection.bulkWrite = async (...args) => { await fixtureRace();return fixtureBulkWrite(...args) }\n  } else if (process.env.PURGE_RACE_KIND !== 'history-peer') {\n    for (const method of ['updateMany', 'deleteMany', 'findOneAndDelete']) {\n      const fixtureOriginal = fixtureModel[method].bind(fixtureModel)\n      fixtureModel[method] = (...args) => {\n        const query = fixtureOriginal(...args), fixtureExec = query.exec.bind(query)\n        query.exec = async (...execution) => { await fixtureRace();return fixtureExec(...execution) }\n        return query\n      }\n    }\n  }\n}\n"
registerHooks({
  resolve(specifier,context,next){
    const result=next(specifier,context)
    if(result.url===dbURL&&process.env.PURGE_OBSERVE_DB_IMPORT==='1')process.stderr.write('PURGE_DB_IMPORT_OBSERVED\n')
    return result
  },
  load(url,context,next){
    const result=next(url,context)
    if(process.env.PURGE_RACE_KIND&&models.has(url))return{...result,source:Buffer.from(result.source).toString('utf8')+probe.replaceAll('__FIXTURE_MODEL__',models.get(url))}
    return result
  },
})
