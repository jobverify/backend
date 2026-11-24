import { getWhatsAppDigest } from '../services/whatsappDigest.js';

export async function getAdminWhatsAppDigest(req, res, next) {
  res.set('Cache-Control', 'private, no-store');
  try {
    res.json({ success: true, data: await getWhatsAppDigest(req.query) });
  } catch (error) {
    next(error);
  }
}
