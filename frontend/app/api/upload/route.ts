import { createHash, randomBytes } from "node:crypto";
import { request } from "node:https";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const FOLDER = "fayfort";

const cloudinary = (() => {
  const match = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(
    process.env.CLOUDINARY_URL ?? "",
  );
  if (!match) return null;
  return { apiKey: match[1], apiSecret: match[2], cloudName: match[3] };
})();

/**
 * Authenticated media upload. Accepts a single image/* or video/* file and
 * pushes it to Cloudinary with a server-side signed request, returning the
 * secure URL plus metadata so callers can store just the URL. Images go to
 * the image upload endpoint, videos to the video endpoint.
 *
 * The request is made with node:https rather than the global fetch: fetch's
 * Happy Eyeballs connection logic can time out on hosts whose DNS advertises
 * a mix of unreachable IPv6 and IPv4 records, so we connect IPv4-first with
 * an IPv6 fallback (matching curl -4/-6 behaviour).
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Sign in to upload media." }, { status: 401 });
  }
  if (!cloudinary) {
    return Response.json({ error: "Upload is not configured." }, { status: 503 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file provided." }, { status: 400 });
  }

  const kind = file.type.startsWith("image/")
    ? "image"
    : file.type.startsWith("video/")
      ? "video"
      : null;
  if (!kind) {
    return Response.json({ error: "Only image or video files are allowed." }, { status: 400 });
  }
  const max = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (file.size > max) {
    const label =
      kind === "image" ? "Image must be 5 MB or smaller." : "Video must be 25 MB or smaller.";
    return Response.json({ error: label }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const params = `folder=${FOLDER}&timestamp=${timestamp}`;
  const signature = createHash("sha1")
    .update(`${params}${cloudinary.apiSecret}`)
    .digest("hex");

  const fields = [
    { name: "api_key", value: cloudinary.apiKey },
    { name: "timestamp", value: timestamp },
    { name: "folder", value: FOLDER },
    { name: "signature", value: signature },
  ];
  const multipart = buildMultipart(fields, {
    name: safeFilename(file.name),
    type: file.type,
    data: buffer,
  });

  const resource = kind === "image" ? "image" : "video";
  const data = await uploadToCloudinary(cloudinary.cloudName, resource, multipart);
  if (!data.ok || !data.payload?.secure_url) {
    return Response.json({ error: "Upload failed. Try again shortly." }, { status: 502 });
  }

  return Response.json({
    ok: true,
    url: data.payload.secure_url,
    publicId: data.payload.public_id,
    width: data.payload.width,
    height: data.payload.height,
    format: data.payload.format,
    kind,
  });
}

type UploadedFile = { name: string; type: string; data: Buffer };

function buildMultipart(
  fields: Array<{ name: string; value: string }>,
  file: UploadedFile,
): { body: Buffer; contentType: string } {
  const boundary = `----fayfort${randomBytes(16).toString("hex")}`;
  const chunks: Buffer[] = [];
  const push = (text: string) => chunks.push(Buffer.from(text));

  for (const field of fields) {
    push(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${field.name}"\r\n\r\n` +
        `${field.value}\r\n`,
    );
  }
  push(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${file.name}"\r\n` +
      `Content-Type: ${file.type}\r\n\r\n`,
  );
  chunks.push(file.data);
  push(`\r\n--${boundary}--\r\n`);

  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

function safeFilename(name: string): string {
  const sanitized = name.replace(/[^\w.\-\u0080-\uFFFF]+/g, "_");
  return sanitized === "" ? "upload" : sanitized;
}

type CloudinaryResponse = {
  ok: boolean;
  payload?: {
    secure_url?: string;
    public_id?: string;
    width?: number;
    height?: number;
    format?: string;
  };
};

async function uploadToCloudinary(
  cloudName: string,
  resource: "image" | "video",
  multipart: { body: Buffer; contentType: string },
): Promise<CloudinaryResponse> {
  const families: Array<4 | 6> = [4, 6];
  for (const family of families) {
    try {
      const response = await postToCloudinary(cloudName, resource, multipart, family);
      return response;
    } catch {
      // fall through to the next address family
    }
  }
  return { ok: false };
}

function postToCloudinary(
  cloudName: string,
  resource: "image" | "video",
  multipart: { body: Buffer; contentType: string },
  family: 4 | 6,
): Promise<CloudinaryResponse> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: `api.cloudinary.com`,
        path: `/v1_1/${cloudName}/${resource}/upload`,
        method: "POST",
        family,
        headers: {
          "Content-Type": multipart.contentType,
          "Content-Length": multipart.body.length,
        },
        timeout: 20000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let payload: CloudinaryResponse["payload"];
          try {
            payload = JSON.parse(text) as CloudinaryResponse["payload"];
          } catch {
            payload = undefined;
          }
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300 && payload?.secure_url) {
            resolve({ ok: true, payload });
          } else {
            resolve({ ok: false });
          }
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.write(multipart.body);
    req.end();
  });
}