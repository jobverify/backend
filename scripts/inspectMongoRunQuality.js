import mongoose from 'mongoose'
import connectDB from '../db/db.js'

await connectDB()

try {
  const db = mongoose.connection.db
  const jobs = db.collection('jobs')
  const collectionStats = await db.command({ collStats: 'jobs', scale: 1024 * 1024 })

  const [activeQuality] = await jobs.aggregate([
    { $match: { status: 'active' } },
    {
      $group: {
        _id: null,
        activeJobs: { $sum: 1 },
        missingTitle: {
          $sum: { $cond: [{ $eq: [{ $trim: { input: { $ifNull: ['$title', ''] } } }, ''] }, 1, 0] },
        },
        missingCompany: {
          $sum: { $cond: [{ $eq: [{ $trim: { input: { $ifNull: ['$company', ''] } } }, ''] }, 1, 0] },
        },
        missingLocation: {
          $sum: { $cond: [{ $eq: [{ $trim: { input: { $ifNull: ['$location', ''] } } }, ''] }, 1, 0] },
        },
        missingApplyUrl: {
          $sum: { $cond: [{ $eq: [{ $trim: { input: { $ifNull: ['$applyUrl', ''] } } }, ''] }, 1, 0] },
        },
        publicIndia: { $sum: { $cond: [{ $eq: ['$isPublicIndia', true] }, 1, 0] } },
        distinctSources: { $addToSet: '$source' },
        distinctCompanies: { $addToSet: '$company' },
      },
    },
    {
      $project: {
        _id: 0,
        activeJobs: 1,
        missingTitle: 1,
        missingCompany: 1,
        missingLocation: 1,
        missingApplyUrl: 1,
        publicIndia: 1,
        distinctSourceCount: { $size: '$distinctSources' },
        distinctCompanyCount: { $size: '$distinctCompanies' },
      },
    },
  ]).toArray()

  const duplicateFingerprints = await jobs.aggregate([
    { $match: { fingerprint: { $type: 'string', $ne: '' } } },
    { $group: { _id: '$fingerprint', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    {
      $group: {
        _id: null,
        duplicateGroups: { $sum: 1 },
        extraDocuments: { $sum: { $subtract: ['$count', 1] } },
      },
    },
    { $project: { _id: 0, duplicateGroups: 1, extraDocuments: 1 } },
  ]).toArray()

  const topCompaniesByDocumentSize = await jobs.aggregate([
    {
      $group: {
        _id: '$company',
        jobs: { $sum: 1 },
        activeJobs: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        bytes: { $sum: { $bsonSize: '$$ROOT' } },
      },
    },
    { $sort: { bytes: -1 } },
    { $limit: 15 },
    {
      $project: {
        _id: 0,
        company: '$_id',
        jobs: 1,
        activeJobs: 1,
        megabytes: { $round: [{ $divide: ['$bytes', 1048576] }, 2] },
        averageKilobytesPerJob: {
          $round: [{ $divide: [{ $divide: ['$bytes', '$jobs'] }, 1024] }, 1],
        },
      },
    },
  ]).toArray()

  console.log(JSON.stringify({
    inspectedAt: new Date().toISOString(),
    jobsCollection: {
      documents: collectionStats.count,
      logicalDocumentMB: collectionStats.size,
      allocatedStorageMB: collectionStats.storageSize,
      totalIndexMB: collectionStats.totalIndexSize,
    },
    activeQuality,
    duplicateFingerprints: duplicateFingerprints[0] ?? { duplicateGroups: 0, extraDocuments: 0 },
    topCompaniesByDocumentSize,
  }, null, 2))
} finally {
  await mongoose.disconnect()
}
