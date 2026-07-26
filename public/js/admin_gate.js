// ---- 관리자 전용 (admin mode) gate ----
//
// IMPORTANT, and stated plainly: this check runs in the browser, so it is a
// convenience gate for the game's owner, NOT a security boundary. Anyone who
// opens devtools can flip gameData.admin by hand. The point of hashing below is
// narrower but still worth it: the admin password never appears as plaintext in
// this repository, so publishing the source doesn't publish the password.
//
// The digest covers the normalised email AND the password together, so the email
// doubles as a salt and one comparison checks both fields.

// FIPS 180-4 round constants (first 32 bits of the fractional parts of the cube
// roots of the first 64 primes).
const SHA256_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

function sha256Rotr(x, n) {
    return ((x >>> n) | (x << (32 - n))) >>> 0;
}

// Synchronous SHA-256. Deliberately not crypto.subtle: that is async and only
// exists in a secure context, so it would silently break admin login whenever
// the game is opened over plain http (e.g. testing on a phone via a LAN IP).
// Verified byte-for-byte against Node's crypto in the test suite.
function sha256Hex(input) {
    const bytes = new TextEncoder().encode(input);
    const bitLen = bytes.length * 8;
    const padded = new Uint8Array((((bytes.length + 9) + 63) >> 6) << 6);
    padded.set(bytes);
    padded[bytes.length] = 0x80;
    const dv = new DataView(padded.buffer);
    dv.setUint32(padded.length - 8, Math.floor(bitLen / 4294967296), false);
    dv.setUint32(padded.length - 4, bitLen >>> 0, false);

    const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
               0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const w = new Uint32Array(64);
    for (let off = 0; off < padded.length; off += 64) {
        for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
        for (let i = 16; i < 64; i++) {
            const s0 = sha256Rotr(w[i - 15], 7) ^ sha256Rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
            const s1 = sha256Rotr(w[i - 2], 17) ^ sha256Rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
        }
        let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
        for (let i = 0; i < 64; i++) {
            const S1 = sha256Rotr(e, 6) ^ sha256Rotr(e, 11) ^ sha256Rotr(e, 25);
            const ch = (e & f) ^ (~e & g);
            const t1 = (hh + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
            const S0 = sha256Rotr(a, 2) ^ sha256Rotr(a, 13) ^ sha256Rotr(a, 22);
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const t2 = (S0 + maj) >>> 0;
            hh = g; g = f; f = e; e = (d + t1) >>> 0;
            d = c; c = b; b = a; a = (t1 + t2) >>> 0;
        }
        const next = [a, b, c, d, e, f, g, hh];
        for (let i = 0; i < 8; i++) h[i] = (h[i] + next[i]) >>> 0;
    }
    return h.map(x => x.toString(16).padStart(8, '0')).join('');
}

// sha256(normalisedEmail + NUL + password) for the one admin account.
const ADMIN_CREDENTIAL_DIGEST = 'ba3c09721cc101611506bc5f4a88c06a124582c43dffdcf1086eb38ef0d20d08';

function adminCredentialDigest(email, password) {
    // NUL separator so ("ab","c") can't collide with ("a","bc"). Built with
    // fromCharCode rather than a literal so this file stays pure ASCII (a raw
    // NUL byte would make git treat the source as binary).
    return sha256Hex(String(email || '').trim().toLowerCase() + String.fromCharCode(0) + String(password || ''));
}

function isAdminCredentialValid(email, password) {
    return adminCredentialDigest(email, password) === ADMIN_CREDENTIAL_DIGEST;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { sha256Hex, adminCredentialDigest, isAdminCredentialValid, ADMIN_CREDENTIAL_DIGEST };
}
