import mongoose from 'mongoose'
import connectDB from '../db/db.js'

await connectDB()

try {
  const db = mongoose.connection.db
  const jobs = db.collection('jobs')
  const databaseStats = await db.command({ dbStats: 1, scale: 1024 * 1024 })
  const stats = await db.command({ collStats: 'jobs', scale: 1024 * 1024 })
  const usage = await jobs.aggregate([{ $indexStats: {} }]).toArray()
  const byStatus = await jobs.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        bytes: { $sum: { $bsonSize: '$$ROOT' } },
        oldest: { $min: '$lastSeenAt' },
        newest: { $max: '$lastSeenAt' },
      },
    },
    { $sort: { count: -1 } },
  ]).toArray()
  const expiredOlderThanDays = {}
  for (const days of [1, 3, 7, 14, 30]) {
    expiredOlderThanDays[days] = await jobs.countDocuments({
      status: 'expired',
      lastSeenAt: { $lt: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
    })
  }

  console.log(JSON.stringify({
    database: {
      dataMB: databaseStats.dataSize,
      indexMB: databaseStats.indexSize,
      logicalMB: databaseStats.dataSize + databaseStats.indexSize,
      storageMB: databaseStats.storageSize,
    },
    byStatus,
    expiredOlderThanDays,
    indexes: Object.entries(stats.indexSizes || {})
      .map(([name, sizeMB]) => ({
        name,
        sizeMB,
        ops: usage.find((entry) => entry.name === name)?.accesses?.ops ?? null,
        since: usage.find((entry) => entry.name === name)?.accesses?.since ?? null,
      }))
      .sort((left, right) => right.sizeMB - left.sizeMB),
  }, null, 2))
} finally {
  await mongoose.disconnect()
}
