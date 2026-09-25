import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';

export interface QuotePdfLineItem {
  concepto: string;
  cantidad: string;
  valorUnitario: string;
  porcentajeImpuesto: string;
  subtotal: string;
}

export interface QuotePdfData {
  ticketTitulo: string;
  empresaNombre: string;
  razon: string;
  lineas: QuotePdfLineItem[];
  subtotal: string;
  impuestos: string;
  total: string;
  creadoPorNombre: string;
}

// Se genera UNA vez al enviar la cotización a aprobación (adjunto del correo,
// y descargable después vía GET /quotes/:id/pdf) — muestra el detalle
// económico para que el aprobador revise antes de firmar. No incluye la
// firma/IP/timestamp de la resolución: esa evidencia queda en el detalle de
// la cotización dentro de la app, no hace falta un segundo PDF "firmado" para
// cumplir la trazabilidad que se pidió.
export async function generateQuotePdf(data: QuotePdfData, outputPath: string): Promise<void> {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    doc.fontSize(18).text('Cotización / Solicitud de Cambio', { align: 'center' });
    doc.moveDown(0.5);
    doc
      .fontSize(9)
      .fillColor('#666666')
      .text(`Generado el ${new Date().toLocaleString('es-ES')}`, { align: 'center' });
    doc.moveDown(2);

    doc.fillColor('#000000').fontSize(11);
    doc.text(`Empresa: ${data.empresaNombre}`);
    doc.text(`Ticket: ${data.ticketTitulo}`);
    doc.moveDown();

    doc.fontSize(11).text('Razón / descripción técnica', { underline: true });
    doc.fontSize(11).text(data.razon);
    doc.moveDown();

    doc.fontSize(11).text('Detalle', { underline: true });
    doc.moveDown(0.5);
    const colX = [50, 220, 300, 380, 460];
    doc.fontSize(9).fillColor('#666666');
    doc.text('Concepto', colX[0], doc.y, { continued: false });
    doc.text('Cantidad', colX[1], doc.y - 11);
    doc.text('Valor unit.', colX[2], doc.y - 11);
    doc.text('Impuesto', colX[3], doc.y - 11);
    doc.text('Subtotal', colX[4], doc.y - 11);
    doc.moveDown(0.5);

    doc.fillColor('#000000').fontSize(10);
    for (const linea of data.lineas) {
      const y = doc.y;
      doc.text(linea.concepto, colX[0], y, { width: 160 });
      doc.text(linea.cantidad, colX[1], y);
      doc.text(linea.valorUnitario, colX[2], y);
      doc.text(`${linea.porcentajeImpuesto}%`, colX[3], y);
      doc.text(linea.subtotal, colX[4], y);
      doc.moveDown(0.3);
    }
    doc.moveDown();

    doc.fontSize(11);
    doc.text(`Subtotal: ${data.subtotal}`, { align: 'right' });
    doc.text(`Impuestos: ${data.impuestos}`, { align: 'right' });
    doc.fontSize(13).text(`Total: ${data.total}`, { align: 'right' });
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
