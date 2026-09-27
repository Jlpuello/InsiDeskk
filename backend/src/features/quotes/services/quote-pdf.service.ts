import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { PDF_PALETTE, drawDocumentFooter, drawDocumentHeader, drawHighlightBlock, drawMetaGrid } from '../../../shared/pdf/document-pdf.js';

export interface QuotePdfLineItem {
  concepto: string;
  cantidad: string;
  valorUnitario: string;
  porcentajeImpuesto: string;
  subtotal: string;
}

export interface QuotePdfData {
  quoteId: string;
  ticketTitulo: string;
  empresaNombre: string;
  razon: string;
  lineas: QuotePdfLineItem[];
  subtotal: string;
  impuestos: string;
  total: string;
  creadoPorNombre: string;
}

const COL_X = [0, 0.46, 0.6, 0.76, 0.88] as const; // fracciones del ancho del contenido

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

    drawDocumentHeader(doc, {
      eyebrow: 'Cotización / solicitud de cambio',
      title: data.ticketTitulo,
      ref: `COT-${data.quoteId.slice(0, 8).toUpperCase()}`,
      status: { label: 'Pendiente de aprobación', tone: 'warn' },
    });

    drawMetaGrid(doc, [
      { label: 'Empresa', value: data.empresaNombre },
      { label: 'Total', value: data.total },
    ]);

    drawHighlightBlock(doc, 'Razón / descripción técnica', data.razon);

    const marginLeft = doc.page.margins.left;
    const contentWidth = doc.page.width - marginLeft - doc.page.margins.right;
    const colX = COL_X.map((frac) => marginLeft + frac * contentWidth);
    const conceptWidth = colX[1] - colX[0] - 10;

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PDF_PALETTE.faint).text('DETALLE', marginLeft, doc.y, { characterSpacing: 0.5 });
    doc.moveDown(0.6);

    const headerY = doc.y;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(PDF_PALETTE.faint);
    doc.text('CONCEPTO', colX[0], headerY, { width: conceptWidth });
    doc.text('CANT.', colX[1], headerY, { width: colX[2] - colX[1] - 6 });
    doc.text('VALOR UNIT.', colX[2], headerY, { width: colX[3] - colX[2] - 6 });
    doc.text('IMP.', colX[3], headerY, { width: colX[4] - colX[3] - 6 });
    doc.text('SUBTOTAL', colX[4], headerY, { width: contentWidth - (colX[4] - marginLeft), align: 'right' });

    const rulerY = headerY + 14;
    doc.moveTo(marginLeft, rulerY).lineTo(marginLeft + contentWidth, rulerY).strokeColor(PDF_PALETTE.line).lineWidth(1).stroke();

    let y = rulerY + 8;
    doc.font('Helvetica').fontSize(9.5).fillColor(PDF_PALETTE.ink);
    for (const linea of data.lineas) {
      doc.text(linea.concepto, colX[0], y, { width: conceptWidth });
      doc.text(linea.cantidad, colX[1], y, { width: colX[2] - colX[1] - 6 });
      doc.text(linea.valorUnitario, colX[2], y, { width: colX[3] - colX[2] - 6 });
      doc.text(`${linea.porcentajeImpuesto}%`, colX[3], y, { width: colX[4] - colX[3] - 6 });
      doc.text(linea.subtotal, colX[4], y, { width: contentWidth - (colX[4] - marginLeft), align: 'right' });
      y = doc.y + 6;
    }

    doc.moveTo(marginLeft, y).lineTo(marginLeft + contentWidth, y).strokeColor(PDF_PALETTE.line).lineWidth(1).stroke();
    y += 10;

    const totalsWidth = 220;
    const totalsX = marginLeft + contentWidth - totalsWidth;
    doc.font('Helvetica').fontSize(10).fillColor(PDF_PALETTE.muted);
    doc.text(`Subtotal: ${data.subtotal}`, totalsX, y, { width: totalsWidth, align: 'right' });
    doc.text(`Impuestos: ${data.impuestos}`, totalsX, doc.y, { width: totalsWidth, align: 'right' });
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(PDF_PALETTE.ink).text(`Total: ${data.total}`, totalsX, doc.y, { width: totalsWidth, align: 'right' });

    doc.y = doc.y + 20;
    doc.x = marginLeft;
    drawDocumentFooter(doc, `Documento generado por ${data.creadoPorNombre}`, `Generado ${new Date().toLocaleDateString('es-ES')}`);

    doc.end();

    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}
