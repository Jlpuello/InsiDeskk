import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { drawDocumentFooter, drawDocumentHeader, drawHighlightBlock, drawMetaGrid, drawSignatureLedger } from '../../../shared/pdf/document-pdf.js';

export interface ActaPdfData {
  actaId: string;
  actividadTitulo: string;
  actividadDescripcion?: string | null;
  empresaNombre: string;
  tipo: string;
  fechaCompletada: Date | null;
  contenido: string;
  firmaNombre: string;
  firmaImagenPath: string;
  firmadoEn: Date;
  creadoPorNombre: string;
  // Línea de membrete (razón social · NIT · teléfono · email de quien opera
  // la instancia) — ver formatIssuerLine. null/undefined si Configuración →
  // Organización todavía no está cargada, en cuyo caso el footer se ve igual
  // que antes de este campo.
  organizacion?: string | null;
}

// pdfkit escribe en streaming — hay que esperar el evento 'finish' del
// write stream para saber que el archivo quedó completo en disco antes de
// que el llamador intente leerlo (ej. para adjuntarlo a un email).
export async function generateActaPdf(data: ActaPdfData, outputPath: string): Promise<void> {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    drawDocumentHeader(doc, {
      eyebrow: 'Acta de entrega',
      title: data.actividadTitulo,
      ref: `ACT-${data.actaId.slice(0, 8).toUpperCase()}`,
      status: { label: 'Firmada', tone: 'good' },
    });

    drawMetaGrid(doc, [
      { label: 'Empresa', value: data.empresaNombre },
      { label: 'Tipo', value: data.tipo },
      ...(data.fechaCompletada ? [{ label: 'Completada', value: data.fechaCompletada.toLocaleString('es-ES') }] : []),
    ]);

    if (data.actividadDescripcion) {
      drawHighlightBlock(doc, 'Descripción', data.actividadDescripcion);
    }
    drawHighlightBlock(doc, 'Trabajo realizado', data.contenido);

    drawSignatureLedger(doc, {
      imagePath: data.firmaImagenPath,
      name: data.firmaNombre,
      role: 'Firmó la entrega',
      date: data.firmadoEn.toLocaleString('es-ES'),
    });

    drawDocumentFooter(
      doc,
      `Documento generado por ${data.creadoPorNombre}`,
      `Generado ${new Date().toLocaleDateString('es-ES')}`,
      data.organizacion,
    );

    doc.end();

    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}
