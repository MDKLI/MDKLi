import { Client } from "minio";

// Internal endpoint for backend→MinIO communication
const minioClient = new Client({
	endPoint: process.env.MINIO_ENDPOINT || "localhost",
	port: parseInt(process.env.MINIO_PORT || "9000", 10),
	useSSL: process.env.MINIO_USE_SSL === "true",
	accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
	secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
});

const bucketName = process.env.MINIO_BUCKET_NAME || "mdkli-media";

// Public endpoint for browser access (use localhost instead of internal hostname)
const getPublicEndpoint = (): { host: string; port: string } => {
	// If MINIO_PUBLIC_ENDPOINT is set, use that
	if (process.env.MINIO_PUBLIC_ENDPOINT) {
		return {
			host: process.env.MINIO_PUBLIC_ENDPOINT,
			port: process.env.MINIO_PUBLIC_PORT || process.env.MINIO_PORT || "9000",
		};
	}
	// Otherwise use localhost (since MinIO is exposed on host port 9000)
	return {
		host: "localhost",
		port: "9000",
	};
};

export class MediaService {
	static async initializeBucket() {
		try {
			const exists = await minioClient.bucketExists(bucketName);
			if (!exists) {
				await minioClient.makeBucket(bucketName);
				// Set bucket policy to allow public read
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

	static async uploadFile(
		fileBuffer: Buffer,
		fileName: string,
		contentType: string,
		folder: string = "",
	): Promise<string> {
		const objectName = folder ? `${folder}/${fileName}` : fileName;

		await minioClient.putObject(
			bucketName,
			objectName,
			fileBuffer,
			fileBuffer.length,
			{ "Content-Type": contentType },
		);

		// Return the public URL using public endpoint
		const { host, port } = getPublicEndpoint();
		return `${process.env.MINIO_USE_SSL === "true" ? "https" : "http"}://${host}:${port}/${bucketName}/${objectName}`;
	}

	static async deleteFile(fileUrl: string): Promise<void> {
		const objectName = fileUrl.split(`/${bucketName}/`)[1];
		if (objectName) {
			await minioClient.removeObject(bucketName, objectName);
		}
	}

	static getPublicUrl(objectName: string): string {
		const { host, port } = getPublicEndpoint();
		return `${process.env.MINIO_USE_SSL === "true" ? "https" : "http"}://${host}:${port}/${bucketName}/${objectName}`;
	}
}
