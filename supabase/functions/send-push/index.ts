import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { store_id, title, body, url, tag } = await req.json();
    if (!store_id || !title) {
      return new Response(JSON.stringify({ error: "store_id and title required" }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all push subscriptions for this store
    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("store_id", store_id);

    if (error || !subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY")!;

    // Import web-push compatible library for Deno
    // We'll use the Web Push protocol directly
    const payload = JSON.stringify({ title, body: body || "", url: url || "/", tag: tag || "default" });

    let sent = 0;
    const staleEndpoints: string[] = [];

    for (const sub of subs) {
      try {
        // Use simple fetch with VAPID to send push
        const response = await sendWebPush(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          vapidPublic,
          vapidPrivate
        );
        if (response.ok || response.status === 201) {
          sent++;
        } else if (response.status === 410 || response.status === 404) {
          staleEndpoints.push(sub.endpoint);
        }
      } catch (e) {
        console.error("Push send error:", e);
      }
    }

    // Clean up stale subscriptions
    if (staleEndpoints.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
    }

    return new Response(JSON.stringify({ sent, total: subs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: corsHeaders });
  }
});

// Minimal Web Push implementation using VAPID
async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<Response> {
  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;

  // Create VAPID JWT
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    aud: audience,
    exp: now + 3600,
    sub: "mailto:push@tasture.app",
  };

  const jwt = await createVapidJwt(header, claims, vapidPrivateKey);
  const vapidAuth = `vapid t=${jwt}, k=${vapidPublicKey}`;

  // Encrypt payload using Web Push encryption
  const encrypted = await encryptPayload(payload, subscription.keys.p256dh, subscription.keys.auth);

  return fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: vapidAuth,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
    },
    body: encrypted,
  });
}

function base64urlEncode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array {
  const padding = "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function createVapidJwt(header: object, claims: object, privateKeyBase64: string): Promise<string> {
  const headerB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const claimsB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(claims)));
  const unsignedToken = `${headerB64}.${claimsB64}`;

  const privateKeyRaw = base64urlDecode(privateKeyBase64);
  const key = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      d: base64urlEncode(privateKeyRaw),
      x: "", // Will be derived
      y: "",
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  ).catch(async () => {
    // Fallback: import as PKCS8
    const pkcs8 = buildPkcs8FromRaw(privateKeyRaw);
    return crypto.subtle.importKey("pkcs8", pkcs8.buffer as ArrayBuffer, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  });

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format
  const sigBytes = new Uint8Array(signature);
  const rawSig = derToRaw(sigBytes);

  return `${unsignedToken}.${base64urlEncode(rawSig)}`;
}

function buildPkcs8FromRaw(rawKey: Uint8Array): Uint8Array {
  // PKCS8 wrapper for EC P-256 private key
  const prefix = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01,
    0x01, 0x04, 0x20,
  ]);
  const result = new Uint8Array(prefix.length + rawKey.length);
  result.set(prefix);
  result.set(rawKey, prefix.length);
  return result;
}

function derToRaw(der: Uint8Array): Uint8Array {
  // If already raw (64 bytes), return as-is
  if (der.length === 64) return der;
  // Parse DER SEQUENCE of two INTEGERs
  const raw = new Uint8Array(64);
  let offset = 2; // skip SEQUENCE tag + length
  if (der[0] !== 0x30) return der; // not DER, return as-is
  
  // Read r
  if (der[offset] !== 0x02) return der;
  offset++;
  const rLen = der[offset++];
  const rStart = offset + (rLen > 32 ? rLen - 32 : 0);
  const rCopyLen = Math.min(rLen, 32);
  raw.set(der.subarray(rStart, rStart + rCopyLen), 32 - rCopyLen);
  offset += rLen;
  
  // Read s
  if (der[offset] !== 0x02) return der;
  offset++;
  const sLen = der[offset++];
  const sStart = offset + (sLen > 32 ? sLen - 32 : 0);
  const sCopyLen = Math.min(sLen, 32);
  raw.set(der.subarray(sStart, sStart + sCopyLen), 64 - sCopyLen);
  
  return raw;
}

async function encryptPayload(
  payload: string,
  p256dhBase64: string,
  authBase64: string
): Promise<Uint8Array> {
  const userPublicKey = base64urlDecode(p256dhBase64);
  const userAuth = base64urlDecode(authBase64);

  // Generate ephemeral key pair
  const localKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const localPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey("raw", localKeyPair.publicKey));

  // Import user public key
  const userKey = await crypto.subtle.importKey("raw", userPublicKey.buffer as ArrayBuffer, { name: "ECDH", namedCurve: "P-256" }, false, []);

  // ECDH shared secret
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: userKey }, localKeyPair.privateKey, 256));

  // HKDF for auth secret
  const authInfo = new TextEncoder().encode("Content-Encoding: auth\0");
  const ikm = await hkdf(userAuth, sharedSecret, authInfo, 32);

  // Key info for content encryption key
  const keyInfoBuf = new Uint8Array([
    ...new TextEncoder().encode("Content-Encoding: aes128gcm\0"),
  ]);
  const cek = await hkdf(concatBuffers(new TextEncoder().encode("Content-Encoding: aes128gcm\0")), ikm, new Uint8Array(0), 16);

  // Nonce info
  const nonce = await hkdf(concatBuffers(new TextEncoder().encode("Content-Encoding: nonce\0")), ikm, new Uint8Array(0), 12);

  // Build header for aes128gcm
  const rs = 4096;
  const idLen = localPublicKeyRaw.length;
  const header = new Uint8Array(16 + 4 + 1 + idLen);
  // Salt (random 16 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // Re-derive with proper salt
  const prk = await hkdfExtract(salt, ikm);
  const contentKey = await hkdfExpand(prk, new TextEncoder().encode("Content-Encoding: aes128gcm\0"), 16);
  const contentNonce = await hkdfExpand(prk, new TextEncoder().encode("Content-Encoding: nonce\0"), 12);

  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, rs, false);
  header[20] = idLen;
  header.set(localPublicKeyRaw, 21);

  // Encrypt
  const paddedPayload = concatBuffers(new TextEncoder().encode(payload), new Uint8Array([2])); // delimiter
  const key = await crypto.subtle.importKey("raw", contentKey.buffer as ArrayBuffer, { name: "AES-GCM" }, false, ["encrypt"]);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: contentNonce as ArrayBufferView }, key, paddedPayload));

  return concatBuffers(header, encrypted);
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const prk = await hkdfExtract(salt, ikm);
  return hkdfExpand(prk, info, length);
}

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  const rawKey = salt.length > 0 ? salt : new Uint8Array(32);
  const key = await crypto.subtle.importKey("raw", rawKey.buffer as ArrayBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, ikm.buffer as ArrayBuffer));
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", prk.buffer as ArrayBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const input = concatBuffers(info, new Uint8Array([1]));
  const output = new Uint8Array(await crypto.subtle.sign("HMAC", key, input.buffer as ArrayBuffer));
  return output.slice(0, length);
}

function concatBuffers(...buffers: Uint8Array[]): Uint8Array {
  const total = buffers.reduce((s, b) => s + b.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const buf of buffers) {
    result.set(buf, offset);
    offset += buf.length;
  }
  return result;
}
