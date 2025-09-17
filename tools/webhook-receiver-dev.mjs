#!/usr/bin/env node

import express from 'express';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PORT = 8787;
const ENDPOINT = '/alerts';
const TIMESTAMP_SKEW_TOLERANCE = 5 * 60 * 1000; // 5 minutes in milliseconds
const IDEMPOTENCY_DB_PATH = path.join(__dirname, '..', 'tmp', 'webhook-events.json');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const app = express();

// Middleware to capture raw body for signature verification
app.use(ENDPOINT, express.raw({ type: 'application/json' }));

// Helper function to verify HMAC signature
function verifySignature(secret, signature, timestamp, body) {
  const message = `${timestamp}.${body}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

// Helper function to check timestamp skew
function isTimestampValid(timestamp) {
  const now = Date.now();
  const webhookTime = new Date(timestamp).getTime();
  const skew = Math.abs(now - webhookTime);
  
  return skew <= TIMESTAMP_SKEW_TOLERANCE;
}

// Helper function to load idempotency database
async function loadIdempotencyDB() {
  try {
    const data = await fs.readFile(IDEMPOTENCY_DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // Create directory if it doesn't exist
    await fs.mkdir(path.dirname(IDEMPOTENCY_DB_PATH), { recursive: true });
    return {};
  }
}

// Helper function to save idempotency database
async function saveIdempotencyDB(db) {
  await fs.writeFile(IDEMPOTENCY_DB_PATH, JSON.stringify(db, null, 2));
}

// Helper function to check for duplicate events
async function isDuplicateEvent(eventId) {
  const db = await loadIdempotencyDB();
  return db[eventId] !== undefined;
}

// Helper function to record event
async function recordEvent(eventId, timestamp) {
  const db = await loadIdempotencyDB();
  db[eventId] = { timestamp, received_at: new Date().toISOString() };
  await saveIdempotencyDB(db);
}

// Helper function to generate event ID from payload
function generateEventId(payload) {
  const key = `${payload.run_id}-${payload.occurred_at}-${JSON.stringify(payload.alerts)}`;
  return crypto.createHash('sha256').update(key).digest('hex').substring(0, 16);
}

// Main webhook endpoint
app.post(ENDPOINT, async (req, res) => {
  const startTime = Date.now();
  
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}📨 Webhook Received${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  
  // Extract headers
  const signature = req.headers['x-ghostgauge-signature'];
  const timestamp = req.headers['x-ghostgauge-timestamp'];
  const contentType = req.headers['content-type'];
  const userAgent = req.headers['user-agent'];
  
  console.log(`${colors.yellow}Headers:${colors.reset}`);
  console.log(`  X-GhostGauge-Signature: ${signature || colors.red + 'MISSING' + colors.reset}`);
  console.log(`  X-GhostGauge-Timestamp: ${timestamp || colors.red + 'MISSING' + colors.reset}`);
  console.log(`  Content-Type: ${contentType}`);
  console.log(`  User-Agent: ${userAgent}`);
  
  // Parse payload
  let payload;
  try {
    payload = JSON.parse(req.body.toString());
  } catch (error) {
    console.log(`${colors.red}❌ Invalid JSON payload${colors.reset}`);
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  
  console.log(`\n${colors.yellow}Payload:${colors.reset}`);
  console.log(JSON.stringify(payload, null, 2));
  
  // Generate event ID for idempotency
  const eventId = generateEventId(payload);
  console.log(`\n${colors.yellow}Event ID:${colors.reset} ${eventId}`);
  
  // Check for duplicate events
  if (await isDuplicateEvent(eventId)) {
    console.log(`${colors.yellow}⚠️  Duplicate event detected - ignoring${colors.reset}`);
    return res.status(200).json({ status: 'ignored', reason: 'duplicate' });
  }
  
  // Validate required headers
  if (!signature || !timestamp) {
    console.log(`${colors.red}❌ Missing required headers${colors.reset}`);
    return res.status(400).json({ error: 'Missing X-GhostGauge-Signature or X-GhostGauge-Timestamp' });
  }
  
  // Check timestamp validity
  if (!isTimestampValid(timestamp)) {
    console.log(`${colors.red}❌ Timestamp too old or too far in future${colors.reset}`);
    return res.status(400).json({ error: 'Invalid timestamp' });
  }
  
  // Get secrets from environment
  const activeSecret = process.env.ALERT_WEBHOOK_SECRET_ACTIVE;
  const nextSecret = process.env.ALERT_WEBHOOK_SECRET_NEXT;
  
  console.log(`\n${colors.yellow}Secrets:${colors.reset}`);
  console.log(`  ALERT_WEBHOOK_SECRET_ACTIVE: ${activeSecret ? colors.green + 'SET' + colors.reset : colors.red + 'NOT SET' + colors.reset}`);
  console.log(`  ALERT_WEBHOOK_SECRET_NEXT: ${nextSecret ? colors.green + 'SET' + colors.reset : colors.red + 'NOT SET' + colors.reset}`);
  
  // Verify signature with active secret
  let verificationResult = null;
  if (activeSecret && verifySignature(activeSecret, signature, timestamp, req.body)) {
    verificationResult = 'active';
    console.log(`${colors.green}✅ Signature verified with ACTIVE secret${colors.reset}`);
  } else if (nextSecret && verifySignature(nextSecret, signature, timestamp, req.body)) {
    verificationResult = 'next';
    console.log(`${colors.green}✅ Signature verified with NEXT secret${colors.reset}`);
  } else {
    console.log(`${colors.red}❌ Signature verification failed${colors.reset}`);
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Record event for idempotency
  await recordEvent(eventId, timestamp);
  
  // Calculate processing time
  const processingTime = Date.now() - startTime;
  
  console.log(`\n${colors.green}✅ Webhook processed successfully${colors.reset}`);
  console.log(`  Verification: ${colors.bright}${verificationResult}${colors.reset}`);
  console.log(`  Processing time: ${processingTime}ms`);
  console.log(`  Event ID: ${eventId}`);
  
  // Log alerts summary
  if (payload.alerts && payload.alerts.length > 0) {
    console.log(`\n${colors.yellow}Alerts Summary:${colors.reset}`);
    payload.alerts.forEach((alert, index) => {
      console.log(`  ${index + 1}. ${alert.type} - ${alert.direction || 'N/A'}`);
    });
  }
  
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
  
  res.status(200).json({
    status: 'success',
    verification: verificationResult,
    event_id: eventId,
    processing_time_ms: processingTime
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`${colors.bright}${colors.green}🚀 Webhook Test Receiver Started${colors.reset}`);
  console.log(`${colors.cyan}Listening on: http://localhost:${PORT}${ENDPOINT}${colors.reset}`);
  console.log(`${colors.yellow}Health check: http://localhost:${PORT}/health${colors.reset}`);
  console.log(`${colors.magenta}Press Ctrl+C to stop${colors.reset}\n`);
  
  // Display environment info
  console.log(`${colors.yellow}Environment:${colors.reset}`);
  console.log(`  ALERT_WEBHOOK_SECRET_ACTIVE: ${process.env.ALERT_WEBHOOK_SECRET_ACTIVE ? colors.green + 'SET' + colors.reset : colors.red + 'NOT SET' + colors.reset}`);
  console.log(`  ALERT_WEBHOOK_SECRET_NEXT: ${process.env.ALERT_WEBHOOK_SECRET_NEXT ? colors.green + 'SET' + colors.reset : colors.red + 'NOT SET' + colors.reset}`);
  console.log(`  Timestamp skew tolerance: ±${TIMESTAMP_SKEW_TOLERANCE / 1000}s`);
  console.log(`  Idempotency DB: ${IDEMPOTENCY_DB_PATH}\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}Shutting down webhook receiver...${colors.reset}`);
  process.exit(0);
});
