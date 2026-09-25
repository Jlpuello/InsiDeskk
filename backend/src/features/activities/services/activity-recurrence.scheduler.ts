import { CronJob } from 'cron';
import { env } from '../../../config/env.js';
import { logger } from '../../../shared/utils/logger.js';
import { eventEmitter } from '../../../shared/events/event.emitter.js';
import { activityTemplateRepository } from '../repositories/activity-template.repository.js';
import { activityRepository } from '../repositories/activity.repository.js';
import { shouldGenerateToday } from './activity-recurrence.util.js';

let job: CronJob | null = null;

// Mismo patrón que shared/backup/backup.service.ts (CronJob de la librería
// "cron", singleton a nivel de módulo). Corre una vez al día por defecto
// (ACTIVIDADES_CRON) y revisa todas las plantillas activas.
export const activityRecurrenceScheduler = {
  start(): void {
    if (job) return;

    job = new CronJob(env.actividadesCron, () => {
      void activityRecurrenceScheduler.run();
    });
    job.start();

    logger.info(`Scheduler de actividades recurrentes iniciado (cron: "${env.actividadesCron}")`);
  },

  async run(): Promise<void> {
    const now = new Date();
    const plantillas = await activityTemplateRepository.findAllActive();

    for (const plantilla of plantillas) {
      if (!shouldGenerateToday(plantilla, now)) continue;

      try {
        const actividad = await activityRepository.create({
          titulo: plantilla.titulo,
          descripcion: plantilla.descripcion,
          tipo: plantilla.tipo,
          empresa: { connect: { id: plantilla.empresaId } },
          ...(plantilla.usuarioAsignadoId && {
            usuarioAsignado: { connect: { id: plantilla.usuarioAsignadoId } },
          }),
          ...(plantilla.dispositivoId && { dispositivo: { connect: { id: plantilla.dispositivoId } } }),
          plantilla: { connect: { id: plantilla.id } },
          fechaPlaneada: now,
        });

        // Se actualiza recién si la creación fue exitosa — si algo falla acá
        // arriba, la próxima corrida del cron lo vuelve a intentar en vez de
        // marcar el período como "ya generado" sin haberlo generado.
        await activityTemplateRepository.update(plantilla.id, { ultimaGeneracion: now });

        // Mismo evento que ActivityService.create() — el listener de
        // notifications no distingue si la actividad nació de una plantilla o
        // se creó a mano.
        if (plantilla.usuarioAsignadoId) {
          await eventEmitter.emit('activity.assigned', {
            actividadId: actividad.id,
            usuarioAsignadoId: plantilla.usuarioAsignadoId,
            titulo: actividad.titulo,
          });
        }

        logger.info(`Actividad generada desde plantilla "${plantilla.titulo}" (${plantilla.id})`);
      } catch (err) {
        logger.error(`Error generando actividad desde plantilla ${plantilla.id}: ${(err as Error).message}`);
      }
    }
  },

  stop(): void {
    if (job) {
      job.stop();
      job = null;
      logger.info('Scheduler de actividades recurrentes detenido');
    }
  },
};
