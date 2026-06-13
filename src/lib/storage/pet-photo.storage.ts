import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const maxSizeMb = Number(process.env.MAX_UPLOAD_FILE_SIZE_MB || 5);
const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];

export async function savePetPhoto(file: File | null): Promise<string | null> {
  if (!file || file.size === 0) {
    return null;
  }

  if (!allowedImageTypes.includes(file.type)) {
    throw new Error("Pet photo must be JPG, PNG, or WEBP.");
  }

  if (file.size > maxSizeMb * 1024 * 1024) {
    throw new Error(`Pet photo must not exceed ${maxSizeMb}MB.`);
  }

  const extension = getFileExtension(file.type);
  const fileName = `${randomUUID()}${extension}`;
  const folderName = "pets";

  // Store outside public/ — served via authenticated /api/files route
  const absoluteFolderPath = path.join(process.cwd(), "uploads", folderName);
  const absoluteFilePath = path.join(absoluteFolderPath, fileName);

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await mkdir(absoluteFolderPath, { recursive: true });
  await writeFile(absoluteFilePath, buffer);

  return `/api/files/${folderName}/${fileName}`;
}

function getFileExtension(mimeType: string) {
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  throw new Error("Unsupported file type.");
}
