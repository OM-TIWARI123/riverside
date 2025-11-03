import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';

// Initialize S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Upload file to S3
 * @param {string} filePath - Local file path
 * @param {string} s3Key - S3 object key (path in bucket)
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} - Public URL of uploaded file
 */
export async function uploadToS3(filePath, s3Key, contentType = 'video/mp4') {
  try {
    console.log(`📤 Uploading to S3: ${s3Key}`);
    
    // Read file
    const fileContent = fs.readFileSync(filePath);
    const fileStats = fs.statSync(filePath);
    
    console.log(`📊 File size: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);
    
    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: s3Key,
      Body: fileContent,
      ContentType: contentType,
      ServerSideEncryption: 'AES256',
      Metadata: {
        uploadedAt: new Date().toISOString(),
      }
    });
    
    await s3Client.send(command);
    
    // Generate public URL
    const s3Url = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
    
    console.log(`✅ Successfully uploaded to S3`);
    console.log(`🔗 URL: ${s3Url}`);
    
    return s3Url;
  } catch (error) {
    console.error('❌ S3 upload failed:', error);
    throw new Error(`Failed to upload to S3: ${error.message}`);
  }
}

/**
 * Generate signed URL for private video access
 * @param {string} s3Key - S3 object key
 * @param {number} expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns {Promise<string>} - Signed URL
 */
export async function generateSignedUrl(s3Key, expiresIn = 3600) {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: s3Key,
    });
    
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    
    console.log(`🔗 Generated signed URL for: ${s3Key} (expires in ${expiresIn}s)`);
    return signedUrl;
  } catch (error) {
    console.error('❌ Failed to generate signed URL:', error);
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
}

/**
 * Delete file from S3
 * @param {string} s3Key - S3 object key
 */
export async function deleteFromS3(s3Key) {
  try {
    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: s3Key,
    });
    
    await s3Client.send(command);
    
    console.log(`🗑️ Deleted from S3: ${s3Key}`);
  } catch (error) {
    console.error('❌ Failed to delete from S3:', error);
    throw new Error(`Failed to delete from S3: ${error.message}`);
  }
}

/**
 * Check if file exists in S3
 * @param {string} s3Key - S3 object key
 * @returns {Promise<boolean>}
 */
export async function fileExistsInS3(s3Key) {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: s3Key,
    });
    
    await s3Client.send(command);
    return true;
  } catch (error) {
    if (error.name === 'NoSuchKey') {
      return false;
    }
    throw error;
  }
}

export default {
  uploadToS3,
  generateSignedUrl,
  deleteFromS3,
  fileExistsInS3,
};
