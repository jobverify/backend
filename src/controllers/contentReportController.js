import { randomUUID } from 'node:crypto';
import ContentReport from '../models/ContentReport.js';
import { normalizeContentReport, normalizeReportReview, reportDeadline, reportListQuery } from '../services/contentReportPolicy.js';

const referenceIsValid = value => typeof value === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);
const fail = (res, error) => res.status(error.statusCode || 503).json({ success: false,
  message: error.statusCode ? error.message : 'Reports are temporarily unavailable. Retry or email jobverify.in@gmail.com.' });

export function createContentReportHandlers({ Report = ContentReport, now = () => new Date() } = {}) {
  return {
    submit: async (req, res) => {
      try {
        const notice = normalizeContentReport(req.body);
        const receivedAt = now();
        const row = await Report.create({ ...notice, _id: randomUUID(), receivedAt, dueAt: reportDeadline(receivedAt), status: 'received', revision: 0 });
        return res.status(201).json({ success: true, data: { reference: row._id, receivedAt: row.receivedAt, dueAt: row.dueAt },
          message: 'Your report has been recorded. Keep this reference for follow-up or an appeal.' });
      } catch (error) { return fail(res, error); }
    },
    list: async (req, res) => {
      try {
        const { page, limit, status } = reportListQuery(req.query);
        const filter = status === 'all' ? {} : status === 'open' ? { status: { $in: ['received', 'reviewing'] } } : { status };
        const [total, rows] = await Promise.all([Report.countDocuments(filter),
          Report.find(filter).sort({ dueAt: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean()]);
        return res.json({ success: true, data: rows, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
      } catch (error) { return fail(res, error); }
    },
    review: async (req, res) => {
      try {
        if (!referenceIsValid(req.params.reference)) return res.status(400).json({ success: false, message: 'Invalid report reference.' });
        const current = await Report.findById(req.params.reference).select('category revision').lean();
        if (!current) return res.status(404).json({ success: false, message: 'Report not found.' });
        const review = normalizeReportReview(req.body, current.category);
        if (current.revision !== review.expectedRevision) return res.status(409).json({ success: false, message: 'This report changed. Reload it before saving.' });
        const at = now();
        const row = await Report.findOneAndUpdate({ _id: current._id, revision: review.expectedRevision }, {
          $set: { status: review.status }, $inc: { revision: 1 },
          $push: { history: { actor: req.user._id, at, status: review.status, notes: review.notes, copiesChecked: review.copiesChecked } },
        }, { new: true, runValidators: true }).lean();
        if (!row) return res.status(409).json({ success: false, message: 'This report changed. Reload it before saving.' });
        return res.json({ success: true, data: row });
      } catch (error) { return fail(res, error); }
    },
  };
}
export const contentReportHandlers = createContentReportHandlers();
