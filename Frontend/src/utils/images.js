export async function preparePhotoForUpload(file) {
  if (!file || !file.type?.startsWith("image/") || file.type === "image/gif") {
    return file;
  }

  const maxSize = 1280;
  const maxBytes = 1200 * 1024;
  const qualities = [0.78, 0.68, 0.58];

  let image;
  try {
    image = await loadImage(file);
  } catch {
    return file;
  }

  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));

  if (scale === 1 && file.size <= maxBytes && file.type === "image/jpeg") {
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let blob = null;
  for (const quality of qualities) {
    blob = await canvasToBlob(canvas, quality);
    if (blob && blob.size <= maxBytes) break;
  }

  if (!blob) return file;

  const baseName = sanitizePhotoBaseName(file.name.replace(/\.[^.]+$/, "") || "photo");
  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now()
  });
}

export function buildUploadUrl(apiOrigin, filenameOrPath) {
  if (!filenameOrPath) return "";

  const cleanOrigin = String(apiOrigin || "").replace(/\/+$/, "");
  const rawPath = String(filenameOrPath).startsWith("/uploads/")
    ? String(filenameOrPath)
    : `/uploads/${filenameOrPath}`;
  const encodedPath = rawPath
    .split("/")
    .map((part) => (part ? encodeURIComponent(part) : part))
    .join("/");

  return `${cleanOrigin}${encodedPath}`;
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });
}

function sanitizePhotoBaseName(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "photo";
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image illisible."));
    };
    image.src = url;
  });
}
