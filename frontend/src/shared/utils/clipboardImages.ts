// Extrae archivos de imagen de un evento de pegado (Ctrl+V) — usado para que
// un técnico pueda pegar una captura de pantalla directo en el campo de texto
// en vez de tener que guardarla y subirla a mano con el selector de archivo.
export function extractImageFiles(clipboardData: DataTransfer | null): File[] {
  if (!clipboardData) return [];
  const files: File[] = [];
  for (const item of Array.from(clipboardData.items)) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  return files;
}
