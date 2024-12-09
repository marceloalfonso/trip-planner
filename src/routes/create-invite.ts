import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import { env } from '../env';
import ClientError from '../errors/client-error';
import dayjs from '../lib/dayjs';
import getMailClient from '../lib/mail';
import prisma from '../lib/prisma';

async function createInvite(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/trips/:tripId/invite',
    {
      schema: {
        params: z.object({
          tripId: z.string().uuid(),
        }),
        body: z.object({
          email: z.string().email(),
        }),
      },
    },
    async (request) => {
      const { tripId } = request.params;
      const { email } = request.body;

      const trip = await prisma.trips.findUnique({
        where: {
          id: tripId,
        },
      });

      if (!trip) {
        throw new ClientError('Trip not found.');
      }

      const participant = await prisma.participants.create({
        data: {
          email,
          trip_id: tripId,
        },
      });

      const formattedStartDate = dayjs(trip.starts_at).format('LL');
      const formattedEndDate = dayjs(trip.ends_at).format('LL');

      const mail = await getMailClient();

      const confirmationLink = `${env.API_BASE_URL}/participants/${participant.id}/confirm`;

      const message = await mail.sendMail({
        from: {
          name: 'Equipe plann.er',
          address: 'equipe@plann.er',
        },
        to: participant.email,
        subject: `Confirme sua presença na viagem para ${trip.destination} em ${formattedStartDate}`,
        html: `
          <div style="font-family: sans-serif; font-size: 16px; line-height: 1.6;">
            <p>
              Você foi convidado(a) para participar de uma viagem para <strong>${trip.destination}</strong> 
              nas datas de <strong>${formattedStartDate} a ${formattedEndDate}</strong>.
            </p>
            <p>Para confirmar sua presença na viagem, clique no link abaixo:</p>
            <p><a href="${confirmationLink}">Confirmar presença</a></p>
            <p>Caso você não saiba do que se trata este e-mail, apenas ignore-o.</p>
          </div>
        `.trim(),
      });

      console.log(nodemailer.getTestMessageUrl(message));

      return { participantId: participant.id };
    }
  );
}

export default createInvite;