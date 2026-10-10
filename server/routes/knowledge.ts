import express from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../auth';
import { requireProfileComplete } from '../profileCompletion';
import { validateKnowledgeInput } from '../inputValidation';

const asyncRoute = (handler: (req: AuthedRequest, res: express.Response) => Promise<any>) =>
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    void handler(req as AuthedRequest, res).catch(next);
  };

function toPublicDocument(document: { id: string; title: string; body: string; enabled: boolean; createdAt: Date; updatedAt: Date }) {
  return {
    id: document.id,
    title: document.title,
    body: document.body,
    enabled: document.enabled,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

export function createKnowledgeRouter(): express.Router {
  const router = express.Router();

  router.get('/api/knowledge', requireAuth, requireProfileComplete, asyncRoute(async (req: AuthedRequest, res) => {
    const documents = await prisma.knowledgeDocument.findMany({
      where: { storeId: req.auth!.storeId },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ documents: documents.map(toPublicDocument) });
  }));

  router.post('/api/knowledge', requireAuth, requireProfileComplete, asyncRoute(async (req: AuthedRequest, res) => {
    const validated = validateKnowledgeInput(req.body);
    if (!validated) return res.status(400).json({ error: 'Invalid knowledge document.' });
    const document = await prisma.knowledgeDocument.create({
      data: {
        storeId: req.auth!.storeId,
        title: validated.title,
        body: validated.body,
        enabled: validated.enabled ?? true,
      },
    });
    res.status(201).json(toPublicDocument(document));
  }));

  router.patch('/api/knowledge/:id', requireAuth, requireProfileComplete, asyncRoute(async (req: AuthedRequest, res) => {
    const existing = await prisma.knowledgeDocument.findFirst({ where: { id: req.params.id, storeId: req.auth!.storeId } });
    if (!existing) return res.status(404).json({ error: 'Knowledge document not found.' });
    const validated = validateKnowledgeInput(req.body, true);
    if (!validated) return res.status(400).json({ error: 'Invalid knowledge document.' });
    const document = await prisma.knowledgeDocument.update({
      where: { id: existing.id },
      data: {
        ...(validated.title ? { title: validated.title } : {}),
        ...(validated.body ? { body: validated.body } : {}),
        ...(validated.enabled !== undefined ? { enabled: validated.enabled } : {}),
      },
    });
    res.json(toPublicDocument(document));
  }));

  router.delete('/api/knowledge/:id', requireAuth, requireProfileComplete, asyncRoute(async (req: AuthedRequest, res) => {
    const existing = await prisma.knowledgeDocument.findFirst({ where: { id: req.params.id, storeId: req.auth!.storeId }, select: { id: true } });
    if (!existing) return res.status(404).json({ error: 'Knowledge document not found.' });
    await prisma.knowledgeDocument.delete({ where: { id: existing.id } });
    res.sendStatus(204);
  }));

  return router;
}