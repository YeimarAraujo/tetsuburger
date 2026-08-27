const MAX_DIMENSION = 1000;
const QUALITY = 0.82;

export async function compressImage(file: File): Promise<File> {
  // Only compress images, skip if already small enough
  if (file.size < 100 * 1024 && file.type === "image/webp") {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  let { width, height } = bitmap;

  // Resize if too large
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob(
      (b) => resolve(b!),
      "image/webp",
      QUALITY
    );
  });

  bitmap.close();

  return new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), {
    type: "image/webp",
  });
}
