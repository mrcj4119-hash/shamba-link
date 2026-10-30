import { v2 as cloudinary } from "cloudinary";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "./config/env.js";

const usingCloudinary = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);

if (usingCloudinary) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

async function saveMedia(
  buffer: Buffer,
  extension: string,
  resourceType: "image" | "video" | "raw",
  folder = "shamba-link/diagnoses",
): Promise<{ url: string; delete: () => Promise<void> }> {
  if (usingCloudinary) {
    const uploaded = await new Promise<{ public_id: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: resourceType,
          type: "authenticated",
          use_filename: false,
          unique_filename: true,
          overwrite: false,
        },
        (error, result) => {
          if (error) reject(error);
          else if (!result) reject(new Error("Cloudinary returned no upload result."));
          else resolve({ public_id: result.public_id });
        },
      );
      stream.end(buffer);
    });
    return {
      url: cloudinary.url(uploaded.public_id, {
        secure: true,
        type: "authenticated",
        sign_url: true,
        resource_type: resourceType,
        ...(resourceType !== "image" ? { format: extension } : {}),
      }),
      delete: async () => {
        await cloudinary.uploader.destroy(uploaded.public_id, {
          resource_type: resourceType,
          type: "authenticated",
        });
      },
    };
  }

  if (env.NODE_ENV === "production") {
    throw new Error("Production media storage is not configured.");
  }
  const directory = path.resolve(process.cwd(), env.UPLOAD_DIR);
  await mkdir(directory, { recursive: true });
  const filename = `${randomUUID()}.${extension}`;
  await writeFile(path.join(directory, filename), buffer, { flag: "wx" });
  return {
    url: `/uploads/${filename}`,
    delete: async () => {
      const { unlink } = await import("node:fs/promises");
      await unlink(path.join(directory, filename));
    },
  };
}

export function saveDiagnosisImage(
  buffer: Buffer,
  extension: string,
): Promise<{ url: string; delete: () => Promise<void> }> {
  return saveMedia(buffer, extension, "image");
}

export function saveDiagnosisVideo(
  buffer: Buffer,
  extension: "mp4" | "webm",
): Promise<{ url: string; delete: () => Promise<void> }> {
  return saveMedia(buffer, extension, "video");
}

export function saveExpertDocument(
  buffer: Buffer,
  extension: "jpg" | "png" | "pdf",
): Promise<{ url: string; delete: () => Promise<void> }> {
  return saveMedia(
    buffer,
    extension,
    extension === "pdf" ? "raw" : "image",
    "shamba-link/expert-documents",
  );
}

export function saveCaseAudio(
  buffer: Buffer,
  extension: "mp4" | "webm",
): Promise<{ url: string; delete: () => Promise<void> }> {
  return saveMedia(buffer, extension, "video", "shamba-link/case-audio");
}
