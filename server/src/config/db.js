import mongoose from 'mongoose';
import dns from 'dns';

const isSrvLookupError = (error) =>
  /querySrv|queryTxt|ECONNREFUSED.*_mongodb\._tcp|ETIMEOUT/i.test(error.message) &&
  process.env.MONGO_URI?.startsWith('mongodb+srv://');

const connectOnce = (mongoUri) =>
  mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000
  });

export const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.warn('[MongoDB] MONGO_URI is not set. Running in memory-only mode.');
    return;
  }

  console.log('[MongoDB] Attempting connection to MongoDB Atlas...');
  try {
    const conn = await connectOnce(mongoUri);
    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}`);
    return;
  } catch (error) {
    // mongodb+srv:// requires a DNS SRV record lookup, which goes through Node's
    // c-ares resolver (dns.getServers()) rather than the OS resolver used by
    // normal HTTP requests. On some networks (VPNs, local DNS proxies that aren't
    // running) that resolver is misconfigured even though the OS resolver works
    // fine. Retry once against public DNS resolvers before giving up.
    if (isSrvLookupError(error)) {
      console.warn(`[MongoDB] SRV DNS lookup failed via configured resolver (${dns.getServers().join(', ')}). Retrying with public DNS...`);
      const previousServers = dns.getServers();
      try {
        dns.setServers(['1.1.1.1', '8.8.8.8']);
        const conn = await connectOnce(mongoUri);
        console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host} (via fallback DNS).`);
        return;
      } catch (retryError) {
        dns.setServers(previousServers);
        console.warn(`[MongoDB] Warning - Connection failed after DNS fallback (${retryError.message}).`);
      }
    } else {
      console.warn(`[MongoDB] Warning - Connection failed (${error.message}).`);
    }
    console.warn('[MongoDB] Server will continue running in in-memory vector store mode.');
  }
};
