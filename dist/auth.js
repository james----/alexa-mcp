/**
 * Authentication script for Alexa MCP Server.
 * Run this once to authenticate with Amazon.
 *
 * Usage:
 *   npm run auth   # Interactive browser-proxy login
 *
 * Amazon requires a real browser login: the resulting session must be paired with a
 * device registration (macDms) that only the proxy flow can mint. A pasted cookie
 * alone is NOT sufficient — device registration requires macDms.
 */
import Alexa from './alexa-remote/index.js';
import { writeFileSync, mkdirSync, existsSync, rmSync, openSync, closeSync, fsyncSync, renameSync, statSync, chmodSync, unlinkSync, } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { exec } from 'node:child_process';
import { createRequire } from 'node:module';
const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
function resolveAuthDir() {
    const envDir = process.env.ALEXA_MCP_AUTH_DIR;
    if (envDir) {
        return envDir.startsWith('~/') ? join(homedir(), envDir.slice(2)) : envDir;
    }
    return join(__dirname, '..', '.auth-data');
}
const AUTH_DIR = resolveAuthDir();
const AUTH_FILE = join(AUTH_DIR, 'auth.json');
const PROXY_PORT = (() => {
    const raw = process.env.ALEXA_PROXY_PORT;
    if (raw === undefined || raw === '')
        return 3457;
    const port = Number(raw);
    // parseInt would turn "auto" into NaN and 0 into a random bound port, both of which
    // desynchronise the URL we print (and shell out to `open`) from what is actually bound.
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        console.error(`Invalid ALEXA_PROXY_PORT: "${raw}". Expected an integer between 1 and 65535.`);
        process.exit(1);
    }
    return port;
})();
const AMAZON_PAGE = process.env.ALEXA_AMAZON_PAGE || 'amazon.com';
const ACCEPT_LANGUAGE = process.env.ALEXA_ACCEPT_LANGUAGE || 'en-US';
const PROXY_LANGUAGE = process.env.ALEXA_PROXY_LANGUAGE || 'en_US';
/**
 * Ensure the credential directory exists and is owner-only.
 *
 * mkdirSync's `mode` applies only to directories it actually creates, so an existing
 * world-readable directory keeps its permissions. Tighten it explicitly.
 */
function ensureSecureAuthDir() {
    mkdirSync(AUTH_DIR, { recursive: true, mode: 0o700 });
    try {
        if ((statSync(AUTH_DIR).mode & 0o077) !== 0)
            chmodSync(AUTH_DIR, 0o700);
    }
    catch {
        // Non-fatal: the file itself is still written 0600.
    }
}
ensureSecureAuthDir();
// alexa-cookie2 persists frc/map-md/deviceId to a "former data store". By default that
// lands inside node_modules/, which npm install silently reverts. Keep it beside the
// credentials instead. Note the upstream read/write asymmetry (proxy.js:116 vs :121):
// it GUARDS on this path but READS the packaged default, so a leftover copy there would
// still win — hence the one-time legacy cleanup below.
const FORMER_DATA_STORE = join(AUTH_DIR, 'formerDataStore.json');
/**
 * Persist credentials atomically and owner-only.
 *
 * writeFileSync+chmodSync left a window where the file existed at the umask default
 * (typically 0644), and a crash mid-write truncated live credentials. Instead:
 *   - unique temp name + 'wx' (O_CREAT|O_EXCL): guarantees WE created the file, so the
 *     0600 mode always applies (a plain 'w' silently keeps a pre-existing looser mode,
 *     and would happily follow a symlink planted at a predictable path);
 *   - a per-process/per-call suffix so two savers (two MCP instances sharing one
 *     ALEXA_MCP_AUTH_DIR, or a server saving while "npm run auth" runs) cannot write
 *     through each other's fd or rename a path the other already consumed;
 *   - fsync before rename, and unlink the temp file if anything throws.
 */
let saveSeq = 0;
function saveAuthFile(authData) {
    ensureSecureAuthDir();
    const tmp = `${AUTH_FILE}.${process.pid}.${++saveSeq}.tmp`;
    let fd;
    try {
        fd = openSync(tmp, 'wx', 0o600);
        try {
            writeFileSync(fd, JSON.stringify(authData, null, 2), 'utf8');
            fsyncSync(fd);
        }
        finally {
            closeSync(fd);
            fd = undefined;
        }
        renameSync(tmp, AUTH_FILE);
    }
    catch (err) {
        try {
            if (fd !== undefined)
                closeSync(fd);
        }
        catch {
            // already closed
        }
        try {
            unlinkSync(tmp);
        }
        catch {
            // never created, or already renamed
        }
        throw err;
    }
}
runProxyAuth();
/**
 * Interactive proxy mode.
 */
function runProxyAuth() {
    // 1. One-time migration: older versions of this script wrote alexa-cookie2's former
    //    data store inside node_modules. Because proxy.js reads the packaged default even
    //    when formerDataStorePath is set, a leftover copy there would resurrect stale
    //    frc/map-md/deviceId values. Remove it once; we now keep our own beside auth.json.
    try {
        const legacyStore = join(dirname(require.resolve('alexa-cookie2')), 'lib', 'formerDataStore.json');
        if (existsSync(legacyStore)) {
            rmSync(legacyStore, { force: true });
        }
    }
    catch {
        // Not fatal — a read-only node_modules just means the default stays put.
    }
    // 2. Intercept and patch http-proxy-middleware to resolve browser reload loops
    try {
        const hpm = require('http-proxy-middleware');
        const origCreate = hpm.createProxyMiddleware;
        hpm.createProxyMiddleware = function (context, options) {
            if (options) {
                // Strip Domain attribute completely.
                // Safari on macOS and modern Chrome reject cookies with Domain=localhost or Domain=127.0.0.1.
                // Stripping the Domain attribute turns them into host-only cookies, which browsers reliably persist.
                options.cookieDomainRewrite = { '*': '' };
                // Wrap router to prevent host-header mismatch from misrouting signin requests to alexa.amazon.com
                const origRouter = options.router;
                options.router = function (req) {
                    const url = req.originalUrl || req.url || '';
                    const referer = req.headers.referer || '';
                    // Normalize host to 127.0.0.1:PROXY_PORT so proxy.js's closure check (req.headers.host === _options.proxyOwnIp:_options.proxyPort) always succeeds
                    req.headers.host = `127.0.0.1:${PROXY_PORT}`;
                    // Normalize referer if it uses localhost so proxy.js's internal referer checks pass
                    if (req.headers.referer && req.headers.referer.includes('localhost:')) {
                        req.headers.referer = req.headers.referer.replace(/localhost:/g, '127.0.0.1:');
                    }
                    // Direct path routing
                    if (url.startsWith(`/www.${AMAZON_PAGE}/`) || url === `/www.${AMAZON_PAGE}`) {
                        return `https://www.${AMAZON_PAGE}`;
                    }
                    if (url.startsWith(`/alexa.${AMAZON_PAGE}/`) || url === `/alexa.${AMAZON_PAGE}`) {
                        return `https://alexa.${AMAZON_PAGE}`;
                    }
                    // Referer-based routing
                    if (referer.includes(`/www.${AMAZON_PAGE}/`)) {
                        return `https://www.${AMAZON_PAGE}`;
                    }
                    if (referer.includes(`/alexa.${AMAZON_PAGE}/`)) {
                        return `https://alexa.${AMAZON_PAGE}`;
                    }
                    // Initial sign-in request
                    if (url === '/' || url === '') {
                        if (typeof origRouter === 'function') {
                            return origRouter(req);
                        }
                    }
                    // Default fallback for any auth/sign-in paths (/ap/signin, /ap/cvf, /ap/mfa, etc.)
                    return `https://www.${AMAZON_PAGE}`;
                };
                // Intercept onProxyReq to strip Brotli/Zstandard and normalize referer/origin
                const origOnProxyReq = options.onProxyReq;
                options.onProxyReq = function (proxyReq, req, res) {
                    if (typeof proxyReq.setHeader === 'function') {
                        // Force gzip/deflate so http-proxy-response-rewrite can decompress and rewrite response bodies
                        proxyReq.setHeader('accept-encoding', 'gzip, deflate');
                        // Normalize referer so Amazon sees valid Amazon origin
                        const referer = proxyReq.getHeader('referer');
                        if (referer) {
                            const fixedReferer = referer
                                .replace(/http:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0):[0-9]+\/www\./gi, 'https://www.')
                                .replace(/http:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0):[0-9]+\/alexa\./gi, 'https://alexa.')
                                .replace(/http:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0):[0-9]+\/?$/gi, `https://www.${AMAZON_PAGE}/`);
                            proxyReq.setHeader('referer', fixedReferer);
                        }
                        // Normalize origin
                        const origin = proxyReq.getHeader('origin');
                        if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
                            proxyReq.setHeader('origin', `https://www.${AMAZON_PAGE}`);
                        }
                    }
                    if (typeof origOnProxyReq === 'function') {
                        return origOnProxyReq.apply(this, arguments);
                    }
                };
                // Intercept onProxyRes to safely handle redirects and strip Domain/Secure
                const origOnProxyRes = options.onProxyRes;
                options.onProxyRes = function (proxyRes, req, res) {
                    // Safeguard location header for maplanding success detection
                    if (!proxyRes.headers.location && proxyRes.socket?.parser?.outgoing?.path?.includes('/ap/maplanding')) {
                        proxyRes.headers.location = proxyRes.socket.parser.outgoing.path;
                    }
                    // Strip Domain and Secure attributes to guarantee valid host-only cookies
                    if (proxyRes && proxyRes.headers && proxyRes.headers['set-cookie']) {
                        proxyRes.headers['set-cookie'] = proxyRes.headers['set-cookie'].map((c) => c.replace(/;\s*Domain=[^;]+/gi, '').replace(/;\s*Secure/gi, ''));
                    }
                    if (typeof origOnProxyRes === 'function') {
                        return origOnProxyRes.apply(this, arguments);
                    }
                };
            }
            return origCreate.call(this, context, options);
        };
    }
    catch {
        // If wrapping fails, proceed with standard proxy
    }
    const alexa = new Alexa();
    console.log('');
    console.log('=== Alexa MCP Server - Authentication ===');
    console.log('');
    alexa.init({
        cookie: '',
        proxyOnly: true,
        proxyOwnIp: '127.0.0.1',
        proxyPort: PROXY_PORT,
        // Loopback only. '::' would bind every interface, exposing the login proxy —
        // which carries live Amazon session cookies — to the whole LAN. The URL printed
        // below (and auto-opened) is 127.0.0.1, so IPv4 loopback is all that is needed.
        proxyListenBind: '127.0.0.1',
        formerDataStorePath: FORMER_DATA_STORE,
        amazonPage: AMAZON_PAGE,
        acceptLanguage: ACCEPT_LANGUAGE,
        amazonPageProxyLanguage: PROXY_LANGUAGE,
        useWsMqtt: false,
        proxyLogLevel: 'warn',
    }, (err) => {
        // The callback fires TWICE in proxyOnly mode:
        // 1st: with an error containing "Please open..." (proxy is ready)
        // 2nd: with null error after successful auth (cookie obtained)
        if (err) {
            const msg = err.message || String(err);
            // Expected "proxy ready" message
            if (msg.includes('Please open') || msg.includes('browser')) {
                const authUrl = `http://127.0.0.1:${PROXY_PORT}`;
                console.log('Proxy ready. Open this URL in your browser:');
                console.log('');
                console.log(`  ${authUrl}`);
                console.log('');
                console.log('Sign in with your Amazon account.');
                console.log('Waiting for authentication...');
                console.log('');
                // Attempt to open browser automatically on macOS
                if (process.platform === 'darwin') {
                    exec(`open ${authUrl}`, () => { });
                }
                return;
            }
            // Some accounts complete the cookie capture but fail the post-auth
            // device-registration step. If we got the cookie, persist it anyway —
            // the MCP server only needs the cookie to make API calls.
            if (alexa.cookie) {
                // Check BEFORE writing. The server hard-requires a device registration
                // (macDms), so a cookie without one is unusable — and saving it would replace a
                // previously working auth.json with credentials that cannot start the server.
                // Losing a good session to a failed re-auth is far worse than saving nothing.
                if (!alexa.cookieData) {
                    console.error('');
                    console.error(`Post-auth notice: ${msg}`);
                    console.error('');
                    console.error('The login completed, but Amazon did not return a device');
                    console.error('registration (macDms), which this server requires.');
                    if (existsSync(AUTH_FILE)) {
                        console.error('');
                        console.error(`Your existing ${AUTH_FILE} was left untouched.`);
                    }
                    console.error('');
                    console.error('Re-run "npm run auth" and complete the browser login fully.');
                    setTimeout(() => process.exit(1), 1000);
                    return;
                }
                saveAuthFile({
                    cookie: alexa.cookie,
                    formerRegistrationData: alexa.cookieData,
                    amazonPage: AMAZON_PAGE,
                    authenticatedAt: new Date().toISOString(),
                });
                console.log('');
                console.log(`Post-auth notice: ${msg}`);
                console.log('Cookie and device registration captured successfully.');
                console.log(`Credentials saved to: ${AUTH_FILE}`);
                setTimeout(() => process.exit(0), 1000);
                return;
            }
            // Real error without cookie
            console.error('Error during authentication:', msg);
            console.error('');
            console.error('If the browser loops on the login page, try a clean profile or a');
            console.error('different browser, then re-run "npm run auth".');
            console.error('');
            process.exit(1);
        }
        // Success! Cookie obtained
        saveAuthFile({
            cookie: alexa.cookie,
            formerRegistrationData: alexa.cookieData,
            amazonPage: AMAZON_PAGE,
            authenticatedAt: new Date().toISOString(),
        });
        console.log('');
        console.log('Authentication successful!');
        console.log(`Credentials saved to: ${AUTH_FILE}`);
        console.log('');
        console.log('You can now close this process with Ctrl+C.');
        console.log('');
        setTimeout(() => process.exit(0), 2000);
    });
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\nClosing...');
        process.exit(0);
    });
}
//# sourceMappingURL=auth.js.map