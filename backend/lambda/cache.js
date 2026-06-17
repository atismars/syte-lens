// Sytelens — DynamoDB verdict cache (Step 3).
//
// Table: sytelens-cache  PK: domain (string)  TTL attribute: ttl (epoch seconds).
// The @aws-sdk/* packages are provided by the Lambda Node.js 20 runtime, so they
// live in devDependencies — not bundled into the deploy artifact.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const TABLE = process.env.DYNAMODB_TABLE || "sytelens-cache";
const TTL_DAYS = 30;
const TTL_SECONDS = TTL_DAYS * 24 * 60 * 60;

// Bump when the verdict shape changes. Records from an older schema are treated
// as a miss (re-analyzed and overwritten), so the cache self-heals on upgrades.
const SCHEMA_VERSION = 3;

// DocumentClient marshals plain JS objects/arrays to DynamoDB types for us.
const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

/**
 * Look up a verdict by root domain. Returns the stored verdict object (with
 * cached:true and the stored analyzedAt) or null on miss / read error.
 * A read failure is non-fatal — the caller falls through to a live analysis.
 */
export async function getCached(domain) {
  try {
    const { Item } = await doc.send(
      new GetCommand({ TableName: TABLE, Key: { domain } })
    );
    if (!Item) return null;
    // Defensively honor TTL even if a sweep hasn't removed the row yet.
    if (Item.ttl && Item.ttl * 1000 < Date.now()) return null;
    // Old-schema records (missing newer fields) → treat as a miss to re-analyze.
    if (Item.schemaVersion !== SCHEMA_VERSION) return null;
    const { ttl, schemaVersion, ...verdict } = Item;
    return { ...verdict, cached: true };
  } catch (err) {
    console.error("[cache] get failed for", domain, err);
    return null;
  }
}

/**
 * Store a verdict under its root domain with a 30-day TTL. Returns true on
 * success, false on failure (failure is non-fatal — the verdict is still
 * returned to the caller, just not cached).
 */
export async function setCached(domain, verdict) {
  const ttl = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  try {
    await doc.send(
      new PutCommand({
        TableName: TABLE,
        Item: { domain, ttl, schemaVersion: SCHEMA_VERSION, ...verdict, analyzedAt: verdict.analyzedAt || new Date().toISOString() },
      })
    );
    return true;
  } catch (err) {
    console.error("[cache] put failed for", domain, err);
    return false;
  }
}
