import { z } from 'zod';
import { planRoadBikeRoute } from '../../routing/routePlanner.js';

const schema = z.object({
  start: z.object({ lat: z.number(), lon: z.number() }),
  end: z.object({ lat: z.number(), lon: z.number() }),
  options: z.object({
    avoidHighSpeed: z.boolean().optional(),
    avoidLowSpeedUrban: z.boolean().optional(),
    preferCycleways: z.boolean().optional(),
    avoidUnpaved: z.boolean().optional(),
    bboxBufferKm: z.number().positive().optional(),
    segmentLengthMeters: z.number().positive().optional(),
    allowFallback: z.boolean().optional(),
  }).optional(),
});

export async function postRoadBikeRoute(req: { body: unknown }, res: any) {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
  try {
    const result = await planRoadBikeRoute(parsed.data);
    return res.json(result);
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    if (msg.includes('OSRM')) return res.status(503).json({ error: 'OSRM unavailable', detail: msg });
    if (msg.includes('Overpass')) return res.status(503).json({ error: 'Overpass unavailable', detail: msg, hint: 'Set options.allowFallback=true to continue with OSRM-only scoring.' });
    return res.status(500).json({ error: 'Route planning failed', detail: msg });
  }
}
