import path from 'node:path';
import { activityRepository } from '../repositories/activity.repository.js';
import { actaRepository } from '../repositories/acta.repository.js';
import { AppError, NotFoundError } from '../../../shared/utils/error.handler.js';
import { assertOwnCompanyOrAdmin } from '../../../shared/security/tenant-scope.js';
import { generateActaPdf } from './acta-pdf.service.js';
import { NotificationService } from '../../notifications/services/notification.service.js';
import { assertCanManageActivity } from './activity.service.js';
import { platformSettingsService } from '../../settings/services/platform-settings.service.js';
import { formatIssuerLine } from '../../../shared/pdf/document-pdf.js';

const notificationService = new NotificationService();

export class ActaService {
  // Solo se puede generar un acta de una actividad completada — es
  // literalmente el documento que certifica que el trabajo terminó, no
  // tendría sentido emitirlo antes. El "qué se hizo" NO se vuelve a pedir
  // acá — se reusa actividad.resultado, que ya quedó registrado como
  // requisito para completar (ver ActivityService.changeStatus). El acta
  // es sobre la firma/entrega formal, no sobre documentar el trabajo.
  async createActa(actividadId: string, input: { firmaNombre: string; firmaImagenPath: string; creadoPorId: string }) {
    const actividad = await activityRepository.findById(actividadId);
    if (!actividad) throw new NotFoundError('Actividad');
    assertOwnCompanyOrAdmin(actividad.empresaId);
    assertCanManageActivity(actividad);

    if (actividad.estado !== 'completada') {
      throw new AppError('La actividad debe estar completada antes de generar el acta', 422);
    }
    if (!actividad.resultado) {
      // No debería pasar (completar ya exige resultado), pero por si una
      // actividad vieja quedó completada antes de este cambio.
      throw new AppError('La actividad no tiene un resultado registrado', 422);
    }

    const existing = await actaRepository.findByActivityId(actividadId);
    if (existing) throw new AppError('Esta actividad ya tiene un acta generada', 422);

    const firmadoEn = new Date();
    const acta = await actaRepository.create({
      actividad: { connect: { id: actividadId } },
      contenido: actividad.resultado,
      firmaNombre: input.firmaNombre,
      firmaImagen: input.firmaImagenPath,
      firmadoEn,
      creadoPor: { connect: { id: input.creadoPorId } },
    });

    // firmaImagenPath es la ruta RELATIVA servida por el endpoint autenticado
    // (ver ActivityController.getSignature) — para leer el archivo real del
    // disco hay que reconstruir la ruta absoluta a partir de su nombre.
    const absoluteSignaturePath = path.join(
      process.cwd(),
      'uploads',
      'actas',
      actividadId,
      path.basename(input.firmaImagenPath),
    );
    const pdfPath = path.join(process.cwd(), 'uploads', 'actas', actividadId, `acta-${acta.id}.pdf`);
    const organizacion = formatIssuerLine(await platformSettingsService.getOrganizationPublic());

    await generateActaPdf(
      {
        actaId: acta.id,
        actividadTitulo: actividad.titulo,
        actividadDescripcion: actividad.descripcion,
        empresaNombre: actividad.empresa.nombre,
        tipo: actividad.tipo,
        fechaCompletada: actividad.fechaCompletada,
        contenido: actividad.resultado,
        firmaNombre: input.firmaNombre,
        firmaImagenPath: absoluteSignaturePath,
        firmadoEn,
        creadoPorNombre: acta.creadoPor?.nombre ?? 'Sistema',
        organizacion,
      },
      pdfPath,
    );

    return actaRepository.update(acta.id, { pdfPath });
  }

  // Espera la confirmación real del envío (ver
  // NotificationService.queueEmailAndWait) antes de marcar el acta como
  // enviada — si el provider falla (o no está configurado), esto tira y el
  // acta queda tal cual estaba, no como "enviada" fantasma.
  async sendByEmail(actaId: string, to: string) {
    const acta = await actaRepository.findById(actaId);
    if (!acta) throw new NotFoundError('Acta');
    assertOwnCompanyOrAdmin(acta.actividad.empresaId);
    if (!acta.pdfPath) throw new AppError('El acta todavía no tiene un PDF generado', 422);

    try {
      await notificationService.queueEmailAndWait({
        to,
        subject: `Acta de entrega — ${acta.actividad.titulo}`,
        body: `<p>Se adjunta el acta de entrega correspondiente a la actividad <strong>${acta.actividad.titulo}</strong>.</p>`,
        attachments: [{ filename: `acta-${acta.id}.pdf`, path: acta.pdfPath }],
      });
    } catch (err) {
      throw new AppError(`No se pudo enviar el correo: ${(err as Error).message}`, 502);
    }

    return actaRepository.update(actaId, { enviadoA: to, enviadoEn: new Date() });
  }
}

export const actaService = new ActaService();
