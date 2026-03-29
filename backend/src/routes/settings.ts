import { Router, Request, Response, NextFunction } from 'express';
import { getSetting, setSetting, deleteSetting } from '../models/Setting';
import { cfEnabled } from '../services/CurseForgeClient';

const router = Router();

// Keys that are allowed to be managed via this route
const ALLOWED_KEYS = new Set(['curseforge_api_key']);

// Keys whose values should be masked in GET responses
const SECRET_KEYS = new Set(['curseforge_api_key']);

router.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      curseforge_api_key_set: !!getSetting('curseforge_api_key'),
      curseforge_enabled: cfEnabled(),
    },
  });
});

router.put('/:key', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key } = req.params;
    if (!ALLOWED_KEYS.has(key)) {
      res.status(400).json({ success: false, error: { message: `Unknown setting: ${key}` } });
      return;
    }
    const { value } = req.body as { value?: string };
    if (value === undefined || value === null) {
      res.status(400).json({ success: false, error: { message: 'value is required' } });
      return;
    }
    if (value === '') {
      deleteSetting(key);
    } else {
      setSetting(key, value);
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
