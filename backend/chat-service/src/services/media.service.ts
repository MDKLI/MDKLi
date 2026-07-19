import { Client } from "minio";

const minioClient = new Client({
	endPoint: process.env.MINIO_ENDPOINT || "localhost",
	port: parseInt(process.env.MINIO_PORT || "9000"),
	useSSL: process.env.MINIO_USE_SSL === "true",
	accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
	secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
});

const bucketName = process.env.MINIO_BUCKET_NAME || "mdkli-media";

const getPublicEndpoint = (): { host: string; port: string } => {
	if (process.env.MINIO_PUBLIC_ENDPOINT) {
		return {
			host: process.env.MINIO_PUBLIC_ENDPOINT,
			port: process.env.MINIO_PUBLIC_PORT || process.env.MINIO_PORT || "9000",
		};
	}
	return { host: "localhost", port: "9000" };
};

// Per-type caps, enforced here server-side regardless of what the client dropdown claims.
// These are the actual gate; the frontend cap is only UX.
export const MEDIA_TYPE_LIMITS: Record<string, number> = {
	image: 10 * 1024 * 1024, // 10MB
	video: 50 * 1024 * 1024, // 50MB
	file: 20 * 1024 * 1024, // 20MB (pdf/doc/etc.)
	audio: 15 * 1024 * 1024, // 15MB
};

export class MediaService {
	static async initializeBucket() {
		try {
			const exists = await minioClient.bucketExists(bucketName);
			if (!exists) {
				await minioClient.makeBucket(bucketName);
				const policy = {
					Version: "2012-10-17",
					Statement: [
						{
							Effect: "Allow",
							Principal: "*",
							Action: ["s3:GetObject"],
							Resource: [`arn:aws:s3:::${bucketName}/*`],
						},
					],
				};
				await minioClient.setBucketPolicy(bucketName, JSON.stringify(policy));
			}
		} catch (error) {
			console.error("Error initializing MinIO bucket:", error);
		}
	}

	static validateSize(type: string, size: number): boolean {
		const limit = MEDIA_TYPE_LIMITS[type];
		if (!limit) return false;
		return size <= limit;
	}

	static async uploadFile(
		fileBuffer: Buffer,
		fileName: string,
		contentType: string,
		roomId: string,
	): Promise<string> {
		// Namespaced under chat/<roomId>/ so chat media doesn't collide with
		// auth-service's profile-photo uploads in the same shared bucket.
		const objectName = `chat/${roomId}/${Date.now()}-${fileName}`;

		await minioClient.putObject(
			bucketName,
			objectName,
			fileBuffer,
			fileBuffer.length,
			{
				"Content-Type": contentType,
			},
		);

		const { host, port } = getPublicEndpoint();
		return `${process.env.MINIO_USE_SSL === "true" ? "https" : "http"}://${host}:${port}/${bucketName}/${objectName}`;
	}

	static async deleteFile(fileUrl: string): Promise<void> {
		const objectName = fileUrl.split(`/${bucketName}/`)[1];
		if (objectName) {
			await minioClient.removeObject(bucketName, objectName);
		}
	}
}
