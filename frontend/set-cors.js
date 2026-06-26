import { Storage } from '@google-cloud/storage';

const storage = new Storage({ projectId: 'dermascan-a3090' });

const corsConfiguration = [
  {
    origin: ['http://localhost:5173'],
    method: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD'],
    responseHeader: ['Content-Type', 'Authorization', 'x-goog-meta-command', 'x-goog-meta-phrase'],
    maxAgeSeconds: 3600,
  },
];

async function configureBucketCors(bucketName) {
  try {
    console.log(`Trying bucket: ${bucketName}...`);
    await storage.bucket(bucketName).setCorsConfiguration(corsConfiguration);
    console.log(`🚀 Success: CORS configuration successfully bound to ${bucketName}`);
    return true;
  } catch (err) {
    console.error(`[-] Failed for ${bucketName}:`, err.message);
    return false;
  }
}

async function run() {
  const success1 = await configureBucketCors('dermascan-a3090.firebasestorage.app');
  const success2 = await configureBucketCors('dermascan-a3090.appspot.com');
  const success3 = await configureBucketCors('dermascan-a3090');
  if (!success1 && !success2 && !success3) {
    console.log("Could not configure CORS on any of the standard bucket names. listing buckets...");
    try {
      const [buckets] = await storage.getBuckets();
      console.log("Available buckets:");
      buckets.forEach(b => console.log(" - ", b.name));
    } catch (e) {
      console.error("Failed to list buckets:", e.message);
    }
  }
}

run();
