/** Compresión y reescalado de imágenes antes de subir a Storage */

export const IMAGE_CONFIG = {
  maxWidth: 1280,
  maxHeight: 1280,
  quality: 0.82,
  maxBytes: 800 * 1024,
  minQuality: 0.5,
  maxInputBytes: 15 * 1024 * 1024,
  outputType: "image/jpeg",
};

function fitDimensions(srcW, srcH, maxW, maxH) {
  let width = srcW;
  let height = srcH;

  if (width <= maxW && height <= maxH) {
    return { width, height };
  }

  const ratio = Math.min(maxW / width, maxH / height);
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo comprimir la imagen"))),
      type,
      quality
    );
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Reescala y comprime una imagen. Devuelve JPEG optimizado para el huerto.
 */
export async function compressImageFile(file, options = {}) {
  const cfg = { ...IMAGE_CONFIG, ...options };

  if (!file.type.startsWith("image/")) {
    throw new Error(`"${file.name}" no es una imagen válida.`);
  }

  if (file.size > cfg.maxInputBytes) {
    throw new Error(`"${file.name}" supera el máximo de ${formatBytes(cfg.maxInputBytes)}.`);
  }

  const bitmap = await createImageBitmap(file);
  const originalWidth = bitmap.width;
  const originalHeight = bitmap.height;
  const { width, height } = fitDimensions(originalWidth, originalHeight, cfg.maxWidth, cfg.maxHeight);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  let quality = cfg.quality;
  let blob = await canvasToBlob(canvas, cfg.outputType, quality);

  while (blob.size > cfg.maxBytes && quality > cfg.minQuality) {
    quality -= 0.08;
    blob = await canvasToBlob(canvas, cfg.outputType, quality);
  }

  if (blob.size > cfg.maxBytes) {
    throw new Error(
      `"${file.name}" sigue siendo demasiado grande tras comprimir (${formatBytes(blob.size)}). Prueba con otra foto.`
    );
  }

  const dataUrl = await blobToDataUrl(blob);
  const baseName = file.name.replace(/\.[^.]+$/i, "");

  return {
    dataUrl,
    mimeType: blob.type,
    filename: `${baseName}.jpg`,
    width,
    height,
    bytes: blob.size,
    originalBytes: file.size,
    originalWidth,
    originalHeight,
  };
}

export { formatBytes };
