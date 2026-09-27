// Anatomía de "documento formal" compartida entre acta-pdf.service.ts y
// quote-pdf.service.ts (antes cada uno maquetaba a mano su propio layout de
// texto plano) — mismos tokens de color/tipografía que la tarjeta in-app
// (ver frontend/src/shared/components/document/DocumentCard.tsx) para que
// cerrar un caso se sienta como un solo sistema, de la app al PDF.
//
// pdfkit no tiene acceso a Google Fonts (solo las 14 fuentes estándar de
// PDF) — Times-Bold aporta el mismo aire "serif, documento oficial" que
// Fraunces cumple en la app, sin necesitar embeber archivos de fuente.
export const PDF_PALETTE = {
  navy: '#0b1f45',
  brandLight: '#a9bdf0',
  brand: '#1d4ed8',
  ink: '#0f172a',
  muted: '#5b6b82',
  faint: '#8b97a8',
  line: '#dde3ec',
  white: '#ffffff',
  good: '#0f7a4d',
  goodBg: '#e2f5eb',
  warn: '#a15c07',
  warnBg: '#fbeed4',
} as const;

type PDFDoc = PDFKit.PDFDocument;

export interface DocumentStatus {
  label: string;
  tone: 'good' | 'warn';
}

export interface DocumentField {
  label: string;
  value: string;
}

const HEADER_HEIGHT = 96;

// Franja superior a todo el ancho de la página (no respeta el margen — un
// header que corta antes del borde no se lee como membrete). Todo lo demás
// sí respeta el margen del documento.
export function drawDocumentHeader(
  doc: PDFDoc,
  opts: { eyebrow: string; title: string; ref?: string; status?: DocumentStatus },
): void {
  const pageWidth = doc.page.width;
  const marginLeft = doc.page.margins.left;
  const marginRight = doc.page.margins.right;
  const contentWidth = pageWidth - marginLeft - marginRight;

  doc.rect(0, 0, pageWidth, HEADER_HEIGHT).fill(PDF_PALETTE.navy);

  doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .fillColor(PDF_PALETTE.brandLight)
    .text(opts.eyebrow.toUpperCase(), marginLeft, 24, { characterSpacing: 0.6 });

  if (opts.status) {
    const tone = opts.status.tone === 'good' ? { bg: PDF_PALETTE.goodBg, fg: PDF_PALETTE.good } : { bg: PDF_PALETTE.warnBg, fg: PDF_PALETTE.warn };
    doc.font('Helvetica-Bold').fontSize(8.5);
    const pillWidth = doc.widthOfString(opts.status.label) + 22;
    const pillX = pageWidth - marginRight - pillWidth;
    doc.roundedRect(pillX, 19, pillWidth, 17, 8.5).fill(tone.bg);
    doc.fillColor(tone.fg).text(opts.status.label, pillX + 11, 23.5);
  }

  const titleWidth = opts.ref ? contentWidth - 120 : contentWidth;
  doc.font('Times-Bold').fontSize(18).fillColor(PDF_PALETTE.white).text(opts.title, marginLeft, 42, { width: titleWidth });

  if (opts.ref) {
    doc
      .font('Courier')
      .fontSize(9)
      .fillColor(PDF_PALETTE.brandLight)
      .text(opts.ref, pageWidth - marginRight - 110, HEADER_HEIGHT - 24, { width: 110, align: 'right' });
  }

  doc.y = HEADER_HEIGHT + 24;
  doc.x = marginLeft;
}

// Grilla de 2 columnas de campos "Etiqueta / Valor" — reemplaza las líneas
// sueltas "Empresa: X" / "Ticket: Y" que tenían los dos PDF originales.
export function drawMetaGrid(doc: PDFDoc, fields: DocumentField[], columns = 2): void {
  const marginLeft = doc.page.margins.left;
  const contentWidth = doc.page.width - marginLeft - doc.page.margins.right;
  const colWidth = contentWidth / columns;
  const rowHeight = 34;
  const startY = doc.y;

  fields.forEach((field, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = marginLeft + col * colWidth;
    const y = startY + row * rowHeight;

    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(PDF_PALETTE.faint)
      .text(field.label.toUpperCase(), x, y, { width: colWidth - 14, characterSpacing: 0.5 });
    doc.font('Helvetica').fontSize(11).fillColor(PDF_PALETTE.ink).text(field.value, x, y + 11, { width: colWidth - 14 });
  });

  const rows = Math.ceil(fields.length / columns);
  const gridBottom = startY + rows * rowHeight + 6;
  doc
    .moveTo(marginLeft, gridBottom)
    .lineTo(doc.page.width - doc.page.margins.right, gridBottom)
    .strokeColor(PDF_PALETTE.line)
    .lineWidth(1)
    .stroke();

  doc.y = gridBottom + 18;
  doc.x = marginLeft;
}

// Bloque destacado (riel de color a la izquierda) para el contenido que
// realmente importa — la resolución de un ticket, el trabajo hecho en una
// actividad, la razón de una cotización — antes indistinguible del resto del
// texto plano.
export function drawHighlightBlock(doc: PDFDoc, label: string, text: string): void {
  const marginLeft = doc.page.margins.left;
  const contentWidth = doc.page.width - marginLeft - doc.page.margins.right;
  const textX = marginLeft + 14;
  const textWidth = contentWidth - 14;
  const startY = doc.y;

  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PDF_PALETTE.brand).text(label.toUpperCase(), textX, startY, { width: textWidth, characterSpacing: 0.5 });
  doc.font('Helvetica').fontSize(11).fillColor(PDF_PALETTE.ink).text(text, textX, startY + 14, { width: textWidth, lineGap: 2 });

  const endY = doc.y;
  doc.rect(marginLeft, startY, 3, endY - startY).fill(PDF_PALETTE.brand);

  doc.y = endY + 18;
  doc.x = marginLeft;
}

// Caja tipo "acta" para la firma — antes era una imagen suelta con el
// nombre al lado, ahora se lee como un documento firmado (imagen + nombre +
// rol + fecha, con un borde propio).
export function drawSignatureLedger(doc: PDFDoc, opts: { imagePath: string; name: string; role: string; date: string }): void {
  const marginLeft = doc.page.margins.left;
  const contentWidth = doc.page.width - marginLeft - doc.page.margins.right;
  const boxHeight = 66;
  const startY = doc.y;
  const imgW = 110;
  const imgH = 44;
  const imgX = marginLeft + 14;
  const imgY = startY + (boxHeight - imgH) / 2;

  doc.roundedRect(marginLeft, startY, contentWidth, boxHeight, 6).dash(3, { space: 2 }).strokeColor(PDF_PALETTE.line).lineWidth(1).stroke();
  doc.undash();

  try {
    doc.image(opts.imagePath, imgX, imgY, { fit: [imgW, imgH] });
  } catch {
    doc.font('Helvetica').fontSize(8).fillColor(PDF_PALETTE.faint).text('(firma no disponible)', imgX, imgY + 18, { width: imgW });
  }

  const textX = imgX + imgW + 18;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(PDF_PALETTE.ink).text(opts.name, textX, startY + 12);
  doc.font('Helvetica').fontSize(9).fillColor(PDF_PALETTE.muted).text(opts.role, textX, startY + 28);
  doc.font('Courier').fontSize(8.5).fillColor(PDF_PALETTE.faint).text(opts.date, textX, startY + 42);

  doc.y = startY + boxHeight + 18;
  doc.x = marginLeft;
}

// Franja de pie — sigue el flujo del contenido (no fija al pie físico de la
// página) a propósito: estos son documentos de una sola página, cortos, y
// fijarla en la posición absoluta arriesgaría a superponerse con contenido
// largo.
export function drawDocumentFooter(doc: PDFDoc, left: string, right?: string): void {
  const marginLeft = doc.page.margins.left;
  const marginRight = doc.page.margins.right;
  const pageWidth = doc.page.width;
  const y = doc.y + 4;

  doc.moveTo(marginLeft, y).lineTo(pageWidth - marginRight, y).strokeColor(PDF_PALETTE.line).lineWidth(1).stroke();
  doc.font('Helvetica').fontSize(8).fillColor(PDF_PALETTE.faint);
  doc.text(left, marginLeft, y + 10);
  if (right) {
    doc.text(right, pageWidth - marginRight - 220, y + 10, { width: 220, align: 'right' });
  }
}
