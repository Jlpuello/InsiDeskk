import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';

export interface ActaPdfData {
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

    doc.fontSize(18).text('Acta de Entrega', { align: 'center' });
    doc.moveDown(0.5);
    doc
      .fontSize(9)
      .fillColor('#666666')
      .text(`Generado el ${new Date().toLocaleString('es-ES')}`, { align: 'center' });
    doc.moveDown(2);

    doc.fillColor('#000000').fontSize(11);
    doc.text(`Empresa: ${data.empresaNombre}`);
    doc.text(`Actividad: ${data.actividadTitulo}`);
    doc.text(`Tipo: ${data.tipo}`);
    if (data.fechaCompletada) {
      doc.text(`Completada: ${data.fechaCompletada.toLocaleString('es-ES')}`);
    }
    doc.moveDown();

    if (data.actividadDescripcion) {
      doc.fontSize(11).text('Descripción', { underline: true });
      doc.fontSize(11).text(data.actividadDescripcion);
      doc.moveDown();
    }

    doc.fontSize(11).text('Resumen del trabajo realizado', { underline: true });
    doc.fontSize(11).text(data.contenido);
    doc.moveDown(2);

    doc.fontSize(11).text('Firma', { underline: true });
    doc.moveDown(0.5);
    try {
      doc.image(data.firmaImagenPath, { width: 200 });
    } catch {
      doc.fontSize(9).fillColor('#999999').text('(no se pudo incrustar la imagen de la firma)');
    }
    doc
      .fontSize(10)
      .fillColor('#000000')
      .text(`${data.firmaNombre} — ${data.firmadoEn.toLocaleString('es-ES')}`);
    doc.moveDown(2);

    doc
      .fontSize(9)
      .fillColor('#999999')
      .text(`Documento generado por ${data.creadoPorNombre}`);

    doc.end();

    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}
