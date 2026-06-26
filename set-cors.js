import { Storage } from '@google-cloud/storage';

// Initialize storage using your explicit project ID block
const storage = new Storage({ projectId: 'dermascan-a3090' });
const bucketName = 'dermascan-a3090.firebasestorage.app';

const corsConfiguration = [
  {
    origin: ['http://localhost:5173'],
    method: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD'],
    responseHeader: ['Content-Type', 'Authorization', 'x-goog-meta-command', 'x-goog-meta-phrase'],
    maxAgeSeconds: 3600,
  },
];

async function configureBucketCors() {
  await storage.bucket(bucketName).setCorsConfiguration(corsConfiguration);
  console.log(`🚀 Success: CORS configuration successfully bound to ${bucketName}`);
}

configureBucketCors().catch(console.error);