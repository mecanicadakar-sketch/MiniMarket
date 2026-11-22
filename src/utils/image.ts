export interface ImageCompressOptions {
  maxWidth: number;
  maxHeight: number;
  maxChars: number;
  preferredType?: 'image/webp' | 'image/jpeg' | 'image/png';
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo leer la imagen seleccionada.'));
    };
    img.src = objectUrl;
  });
}

export async function compressImageToDataUrl(
  file: File,
  { maxWidth, maxHeight, maxChars, preferredType = 'image/webp' }: ImageCompressOptions
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Seleccioná un archivo de imagen válido (PNG, JPG o WebP).');
  }

  const img = await loadImageFromFile(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Tu navegador no permite procesar imágenes.');
  }

  let scale = Math.min(1, maxWidth / img.width, maxHeight / img.height);
  let quality = 0.84;

  for (let attempt = 0; attempt < 5; attempt++) {
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    let dataUrl = canvas.toDataURL(preferredType, quality);
    if (!dataUrl.startsWith(`data:${preferredType}`)) {
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }
    if (dataUrl.length <= maxChars) {
      return dataUrl;
    }

    quality = Math.max(0.45, quality - 0.12);
    scale *= 0.82;
  }

  throw new Error('La imagen es demasiado pesada. Probá con un archivo más liviano.');
}

/**
 * Scales and exports an uploaded image for the static top banner proportionally
 * without cropping edges so vertical and horizontal content stays intact.
 */
export async function fitTopBannerToDataUrl(
  file: File,
  maxChars = 240000
): Promise<string> {
  return compressImageToDataUrl(file, {
    maxWidth: 960,
    maxHeight: 320,
    maxChars,
  });
}
