import express from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../auth';
import { requireProfileComplete } from '../profileCompletion';
import { canTransitionAppointmentStatus, validateAppointmentInput } from '../inputValidation';

const asyncRoute = (handler: (req: AuthedRequest, res: express.Response) => Promise<any>) =>
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    void handler(req as AuthedRequest, res).catch(next);
  };

function toPublicAppointment(appointment: any) {
  return {
    id: appointment.id,
    conversationId: appointment.conversationId,
    customerName: appointment.customerName,
    customerPhone: appointment.customerPhone,
    service: appointment.service,
    startsAt: appointment.startsAt.toISOString(),
    endsAt: appointment.endsAt.toISOString(),
    status: appointment.status,
    advanceAmount: appointment.advanceAmount == null ? null : Number(appointment.advanceAmount),
    advancePaymentMethod: appointment.advancePaymentMethod,
    advanceTransactionId: appointment.advanceTransactionId,
    notes: appointment.notes,
    createdAt: appointment.createdAt.toISOString(),
    updatedAt: appointment.updatedAt.toISOString(),
  };
}

export function createAppointmentsRouter(): express.Router {
  const router = express.Router();

  router.get('/api/appointments', requireAuth, requireProfileComplete, asyncRoute(async (req, res) => {
    const appointments = await prisma.appointment.findMany({
      where: { storeId: req.auth!.storeId },
      orderBy: { startsAt: 'asc' },
      take: 200,
    });
    res.json({ appointments: appointments.map(toPublicAppointment) });
  }));

  router.post('/api/appointments', requireAuth, requireProfileComplete, asyncRoute(async (req, res) => {
    const input = validateAppointmentInput(req.body);
    if (!input) return res.status(400).json({ error: 'Invalid appointment details.' });
    const conflict = await prisma.appointment.findFirst({
      where: {
        storeId: req.auth!.storeId,
        status: { in: ['REQUESTED', 'CONFIRMED'] },
        startsAt: { lt: input.endsAt },
        endsAt: { gt: input.startsAt },
      },
      select: { id: true },
    });
    if (conflict) return res.status(409).json({ error: 'This time overlaps an existing appointment.' });
    const appointment = await prisma.appointment.create({
      data: {
        storeId: req.auth!.storeId,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        service: input.service,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        advanceAmount: input.advanceAmount,
        advancePaymentMethod: input.advancePaymentMethod,
        advanceTransactionId: input.advanceTransactionId,
        notes: input.notes,
      },
    });
    res.status(201).json(toPublicAppointment(appointment));
  }));

  router.patch('/api/appointments/:id/status', requireAuth, requireProfileComplete, asyncRoute(async (req, res) => {
    const status = req.body?.status;
    if (!['REQUESTED', 'CONFIRMED', 'CANCELLED', 'COMPLETED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid appointment status.' });
    }
    const existing = await prisma.appointment.findFirst({ where: { id: req.params.id, storeId: req.auth!.storeId } });
    if (!existing) return res.status(404).json({ error: 'Appointment not found.' });
    if (!canTransitionAppointmentStatus(existing.status, status)) {
      return res.status(409).json({ error: `Cannot change a ${existing.status.toLowerCase()} appointment to ${status.toLowerCase()}.` });
    }
    const appointment = await prisma.appointment.update({ where: { id: existing.id }, data: { status } });
    res.json(toPublicAppointment(appointment));
  }));

  return router;
}