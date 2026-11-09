import {
  getPublicCompanyByKey,
  listPublicCompanies,
} from "../services/companyDirectoryService.js";
import { createPublicResponseCache } from '../utils/publicResponseCache.js';
import { logOperationalError } from '../utils/operationalLog.js';

const PUBLIC_CACHE_HEADER = "no-store";
const cached = createPublicResponseCache();
const visibility = req => req.siteSettings?.experiencedJobsEnabled !== false;

export const getCompanies = async (req, res) => {
  try {
    res.set("Cache-Control", PUBLIC_CACHE_HEADER);
    const key = JSON.stringify(['list', visibility(req), req.query.q || '', req.query.page || 1, req.query.limit || 24]);
    const data = await cached(key, () => listPublicCompanies({
      query: req.query.q,
      page: req.query.page,
      limit: req.query.limit,
      siteSettings: req.siteSettings,
    }));

    return res.status(200).json({
      code: 200,
      success: true,
      data,
    });
  } catch (error) {
    logOperationalError('company_list', error, { requestId: req.requestId, statusCode: 500 });
    return res.status(500).json({
      code: 500,
      success: false,
      message: "Server error while loading companies",
    });
  }
};

export const getCompanyByKey = async (req, res) => {
  try {
    res.set("Cache-Control", PUBLIC_CACHE_HEADER);
    const key = JSON.stringify(['detail', visibility(req), req.params.companyKey]);
    const data = await cached(key, () => getPublicCompanyByKey({
      companyKey: req.params.companyKey,
      siteSettings: req.siteSettings,
    }));

    if (!data) {
      return res.status(404).json({
        code: 404,
        success: false,
        message: "Company not found",
      });
    }

    return res.status(200).json({
      code: 200,
      success: true,
      data,
    });
  } catch (error) {
    logOperationalError('company_detail', error, { requestId: req.requestId, statusCode: 500 });
    return res.status(500).json({
      code: 500,
      success: false,
      message: "Server error while loading company",
    });
  }
};

