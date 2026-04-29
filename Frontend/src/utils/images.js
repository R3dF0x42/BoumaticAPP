export async function preparePhotoForUpload(file) {
  if (!file || !file.type?.startsWith("image/") || file.type === "image/gif") {
    return file;
  }

  const maxSize = 1600;
  const quality = 0.82;

  const image = await loadImage(file);
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));

  if (scale === 1 && file.size <= 900 * 1024) {
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });

  if (!blob) return file;

  const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now()
  });
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
