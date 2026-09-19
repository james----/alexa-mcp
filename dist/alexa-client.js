import Alexa from './alexa-remote/index.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync, openSync, closeSync, fsyncSync, renameSync, statSync, chmodSync, unlinkSync, } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
const __dirname = dirname(fileURLToPath(import.meta.url));
export function resolveAuthDir() {
    const envDir = process.env.ALEXA_MCP_AUTH_DIR;
    if (envDir) {
        return envDir.startsWith('~/') ? join(homedir(), envDir.slice(2)) : envDir;
    }
    return join(__dirname, '..', '.auth-data');
}
/**
 * Ensure the credential directory exists and is owner-only.
 *
 * mkdirSync's `mode` applies only to directories it actually creates, so an existing
 * world-readable directory (e.g. one made before this hardening, or by an older version)
 * keeps its permissions. Tighten it explicitly.
 */
export function ensureSecureAuthDir(authDir = resolveAuthDir()) {
    mkdirSync(authDir, { recursive: true, mode: 0o700 });
    try {
        if ((statSync(authDir).mode & 0o077) !== 0)
            chmodSync(authDir, 0o700);
    }
    catch {
        // Non-fatal: the file itself is still written 0600.
    }
}
export class AlexaClient {
    alexa;
    initialized;
    _initPromise;
    _saveSeq = 0;
    constructor() {
        this.alexa = new Alexa();
        this.initialized = false;
        // Concurrent tool calls both await init(); without a memo they would race, and the
        // attempt-2 fallback could swap this.alexa out from under a caller that already
        // resolved against the previous instance.
        this._initPromise = null;
    }
    init() {
        if (this.initialized)
            return Promise.resolve();
        if (!this._initPromise) {
            this._initPromise = this._doInit().finally(() => {
                this._initPromise = null;
            });
        }
        return this._initPromise;
    }
    async _doInit() {
        const savedAuth = this._loadAuth();
        if (!savedAuth) {
            throw new Error('No authentication data found. Run "npm run auth" first to authenticate with Amazon.');
        }
        const reg = savedAuth.formerRegistrationData;
        // The client requires macDms. Without it, init()
        // re-enters itself forever instead of failing. Fail fast and clearly instead.
        const regUsable = !!(reg &&
            typeof reg.localCookie === 'string' &&
            (reg.dataVersion === 2 || reg.dataVersion === '2') &&
            reg.macDms &&
            reg.macDms.adp_token &&
            reg.macDms.device_private_key);
        if (!regUsable || !reg) {
            throw new Error('Saved auth has no usable device registration (macDms). Run "npm run auth" to re-authenticate.');
        }
        const baseOptions = {
            proxyOwnIp: '127.0.0.1',
            proxyPort: 0,
            amazonPage: process.env.ALEXA_AMAZON_PAGE || savedAuth.amazonPage || 'amazon.com',
            acceptLanguage: process.env.ALEXA_ACCEPT_LANGUAGE || 'en-US',
            amazonPageProxyLanguage: process.env.ALEXA_PROXY_LANGUAGE || 'en_US',
            useWsMqtt: false,
            cookieRefreshInterval: 4 * 24 * 60 * 60 * 1000, // 4 days
        };
        // Attempt 1 — normal behaviour. Hand the client the registration OBJECT (it
        // carries .localCookie) instead of the cookie string: setCookie's object branch
        // is the only one that sets this.cookieData, which is the only source of _options.macDms.
        // Under 24h this takes the "reuse the saved cookie" fast path; past 24h the client
        // still refreshes automatically.
        try {
            await this._initOnce(savedAuth, reg, { ...baseOptions, cookie: reg });
        }
        catch {
            // Attempt 2 — the refresh path failed (e.g. POST api.amazon.com/auth/register ->
            // 400 InvalidToken). The client discards the still-valid cookie on that failure
            // and falls through to a browser login. Retry once on a clean instance with tokenDate bumped IN MEMORY ONLY, which forces the fast path and uses the saved cookie as-is.
            // Retire the losing instance before swapping it out. If attempt 1 lost to the 30s
            // watchdog rather than an init error, its init() is still in flight; when it later
            // completes it would arm its own refresh timer and write stale credentials over
            // attempt 2's. `_retired` makes its late callback a no-op.
            this._retire(this.alexa);
            this.alexa = new Alexa();
            await this._initOnce(savedAuth, reg, {
                ...baseOptions,
                cookie: { ...reg, tokenDate: Date.now() },
            });
        }
        this._patchAlexaRemote(this.alexa, baseOptions.acceptLanguage);
        this.initialized = true;
    }
    /** Legacy patch helper retained as no-op; all fixes are natively integrated into vendored AlexaRemote. */
    _patchAlexaRemote(_alexa, _defaultLocale = 'en-US') {
        // No-op: vendored AlexaRemote natively handles dynamic device locale,
        // ParallelNode sequence wrapping, and customer history records.
    }
    /** Neutralize an AlexaRemote instance whose init() may still be in flight. */
    _retire(alexa) {
        if (!alexa)
            return;
        alexa._retired = true;
        try {
            if (alexa.cookieRefreshTimeout) {
                clearTimeout(alexa.cookieRefreshTimeout);
                alexa.cookieRefreshTimeout = null;
            }
            if (typeof alexa.stop === 'function')
                alexa.stop();
        }
        catch {
            // Best effort — a retired instance is ignored either way.
        }
    }
    _initOnce(savedAuth, reg, options) {
        const alexa = this.alexa;
        // Captured BEFORE init(): the client overwrites options.cookie with the cookie string.
        //
        // Identity comparison does NOT work here. alexa-cookie2 refreshes by MUTATING the
        // registration object in place and handing the same reference back
        // (alexa-cookie.js finishCookieRefresh -> callback(null, loginData)), so
        // `cookieData !== passed` is always false. tokenDate is the reliable signal: a genuine
        // refresh stamps it with Date.now(), so it differs from whatever we passed in.
        const passedTokenDate = options.cookie && typeof options.cookie === 'object'
            ? options.cookie.tokenDate
            : undefined;
        // This server runs over stdio and can never complete a browser login. Block the proxy
        // fallback (alexa-remote.js:213-222) so a dead cookie surfaces as an actionable error
        // instead of silently starting a local proxy and hanging.
        alexa.generateCookie = (_email, _password, cb) => cb(new Error('Authentication expired. Run "npm run auth" to re-authenticate.'));
        // Intercept preview requests to ensure target locale is configured dynamically.
        const origHttpsGet = alexa.httpsGet.bind(alexa);
        alexa.httpsGet = (url, callback, flags) => {
            if (url === '/api/behaviors/preview' && flags && typeof flags.data === 'string') {
                try {
                    const reqObj = JSON.parse(flags.data);
                    if (reqObj.sequenceJson) {
                        const locale = options.acceptLanguage || 'en-US';
                        reqObj.sequenceJson = reqObj.sequenceJson.replace(/"locale":"de-DE"/g, `"locale":"${locale}"`);
                        flags.data = JSON.stringify(reqObj);
                    }
                }
                catch {
                    // ignore parsing error
                }
            }
            return origHttpsGet(url, callback, flags);
        };
        return new Promise((resolve, reject) => {
            let settled = false;
            const timeout = setTimeout(() => {
                if (settled)
                    return;
                settled = true;
                reject(new Error('Connection timeout after 30s'));
            }, 30000);
            alexa.init(options, (err) => {
                clearTimeout(timeout);
                if (err) {
                    if (alexa._retired)
                        return;
                    if (!settled) {
                        settled = true;
                        reject(err.message && err.message.includes('Cookie')
                            ? new Error('Authentication expired. Run "npm run auth" to re-authenticate.')
                            : err);
                        return;
                    }
                    // Late failure: the 4-day refresh re-init failed on a long-running server.
                    // Nothing is awaiting this promise any more, so swallowing it would wedge the
                    // client permanently. Drop `initialized` so the next tool call re-runs init()
                    // (including the attempt-2 fallback) instead of failing opaquely forever.
                    this.initialized = false;
                    process.stderr.write(`alexa-mcp: scheduled session refresh failed: ${err.message}\n`);
                    return;
                }
                // A superseded instance must not write anything.
                if (alexa._retired)
                    return;
                // Persist only a GENUINE refresh. If tokenDate is unchanged, nothing was refreshed
                // and `reg` (untouched on disk) is authoritative — this is what keeps attempt 2's
                // in-memory tokenDate bump from ever reaching the file.
                const fresh = alexa.cookieData;
                const refreshed = !!(fresh &&
                    fresh.tokenDate &&
                    fresh.tokenDate !== passedTokenDate);
                if (alexa.cookie) {
                    try {
                        this._saveAuth({
                            cookie: refreshed ? alexa.cookie : reg.localCookie,
                            formerRegistrationData: refreshed ? fresh : reg,
                            amazonPage: savedAuth.amazonPage,
                            authenticatedAt: refreshed
                                ? new Date().toISOString()
                                : savedAuth.authenticatedAt,
                        });
                    }
                    catch (saveErr) {
                        // A read-only or full disk must not turn a SUCCESSFUL authentication into a
                        // hung promise or an uncaught exception that kills the stdio server. The
                        // in-memory session is valid; we simply could not cache it.
                        process.stderr.write(`alexa-mcp: could not persist refreshed credentials: ${saveErr.message}\n`);
                    }
                }
                if (!settled) {
                    settled = true;
                    resolve();
                }
                // The client re-invokes this callback after cookieRefreshInterval to re-init.
                // The settled guard makes that save-only.
            });
        });
    }
    // --- Device Management ---
    async getDevices() {
        await this.init();
        return new Promise((resolve, reject) => {
            this.alexa.getDevices((err, result) => {
                if (err)
                    return reject(err);
                const devices = (result?.devices || []).map((d) => ({
                    accountName: d.accountName,
                    name: d.accountName,
                    serialNumber: d.serialNumber,
                    deviceType: d.deviceType,
                    deviceFamily: d.deviceFamily,
                    online: d.online,
                    capabilities: d.capabilities,
                }));
                resolve(devices);
            });
        });
    }
    // --- Smart Home ---
    async getSmarthomeDevices() {
        await this.init();
        return new Promise((resolve, reject) => {
            this.alexa.getSmarthomeDevicesV2((err, result) => {
                if (err)
                    return reject(err);
                resolve(result);
            });
        });
    }
    async getSmarthomeGroups() {
        await this.init();
        return new Promise((resolve, reject) => {
            this.alexa.getSmarthomeGroups((err, result) => {
                if (err)
                    return reject(err);
                resolve(result);
            });
        });
    }
    async querySmarthomeDevices(entityIds) {
        await this.init();
        return new Promise((resolve, reject) => {
            this.alexa.querySmarthomeDevices(entityIds, (err, result) => {
                if (err)
                    return reject(err);
                resolve(result);
            });
        });
    }
    // --- Device Resolution ---
    resolveSerialNumber(serialOrName) {
        if (!serialOrName)
            return serialOrName;
        if (typeof serialOrName === 'string' && serialOrName.toLowerCase() === 'all')
            return 'all';
        if (this.alexa && typeof this.alexa.find === 'function') {
            const dev = this.alexa.find(serialOrName);
            if (dev && dev.serialNumber) {
                return dev.serialNumber;
            }
        }
        return serialOrName;
    }
    // --- Announcements ---
    async announce(serialNumber, message) {
        await this.init();
        const target = this.resolveSerialNumber(serialNumber);
        return new Promise((resolve, reject) => {
            this.alexa.sendSequenceCommand(target, 'announcement', message, (err) => {
                if (err)
                    return reject(err);
                resolve({ success: true });
            });
        });
    }
    async speak(serialNumber, text) {
        await this.init();
        const target = this.resolveSerialNumber(serialNumber);
        return new Promise((resolve, reject) => {
            this.alexa.sendSequenceCommand(target, 'speak', text, (err) => {
                if (err)
                    return reject(err);
                resolve({ success: true });
            });
        });
    }
    async speakSSML(serialNumber, ssml) {
        await this.init();
        const target = this.resolveSerialNumber(serialNumber);
        return new Promise((resolve, reject) => {
            this.alexa.sendSequenceCommand(target, 'ssml', ssml, (err) => {
                if (err)
                    return reject(err);
                resolve({ success: true });
            });
        });
    }
    async textCommand(serialNumber, text) {
        await this.init();
        const target = this.resolveSerialNumber(serialNumber);
        return new Promise((resolve, reject) => {
            this.alexa.sendSequenceCommand(target, 'textCommand', text, (err) => {
                if (err)
                    return reject(err);
                resolve({ success: true });
            });
        });
    }
    // --- Volume ---
    async setVolume(serialNumber, volume) {
        await this.init();
        const target = this.resolveSerialNumber(serialNumber);
        return new Promise((resolve, reject) => {
            this.alexa.sendSequenceCommand(target, 'volume', volume, (err) => {
                if (err)
                    return reject(err);
                resolve({ success: true });
            });
        });
    }
    async getAllDeviceVolumes() {
        await this.init();
        return new Promise((resolve, reject) => {
            this.alexa.getAllDeviceVolumes((err, result) => {
                if (err)
                    return reject(err);
                resolve(result);
            });
        });
    }
    // --- Routines ---
    async getRoutines() {
        await this.init();
        return new Promise((resolve, reject) => {
            this.alexa.getAutomationRoutines((err, result) => {
                if (err)
                    return reject(err);
                resolve(result);
            });
        });
    }
    async executeRoutine(routine) {
        await this.init();
        return new Promise((resolve, reject) => {
            this.alexa.executeAutomationRoutine(routine, (err) => {
                if (err)
                    return reject(err);
                resolve({ success: true });
            });
        });
    }
    // --- Lists ---
    async getLists() {
        await this.init();
        return new Promise((resolve, reject) => {
            this.alexa.getListsV2((err, result) => {
                if (err)
                    return reject(err);
                resolve(result);
            });
        });
    }
    async getListItems(listId) {
        await this.init();
        return new Promise((resolve, reject) => {
            this.alexa.getListItemsV2(listId, (err, result) => {
                if (err)
                    return reject(err);
                resolve(result);
            });
        });
    }
    async addListItem(listId, value) {
        await this.init();
        return new Promise((resolve, reject) => {
            this.alexa.addListItem(listId, value, (err, result) => {
                if (err)
                    return reject(err);
                resolve(result);
            });
        });
    }
    // --- Group Management ---
    _enrichCookie() {
        const cookie = this.alexa.cookie;
        if (!cookie || typeof cookie !== 'string')
            return;
        const cookies = {};
        cookie.split(';').forEach((c) => {
            const [name, ...rest] = c.trim().split('=');
            cookies[name] = rest.join('=');
        });
        let enriched = cookie;
        // Add at-main/ubid-main aliases for regional cookies (required for write ops)
        for (const suffix of ['acbmx', 'acbus', 'acbde', 'acbuk', 'acbjp', 'acbin']) {
            if (cookies[`at-${suffix}`] && !cookies['at-main']) {
                enriched += `; at-main=${cookies[`at-${suffix}`]}`;
            }
            if (cookies[`ubid-${suffix}`] && !cookies['ubid-main']) {
                enriched += `; ubid-main=${cookies[`ubid-${suffix}`]}`;
            }
        }
        this.alexa.cookie = enriched;
    }
    async createSmarthomeGroup(name, applianceIds) {
        await this.init();
        this._enrichCookie();
        return new Promise((resolve, reject) => {
            const flags = {
                method: 'POST',
                data: JSON.stringify({
                    name,
                    type: 'SPACE',
                    applianceIds: applianceIds || [],
                }),
            };
            this.alexa.httpsGet('/api/phoenix/group', (err, result) => {
                if (err)
                    return reject(err);
                resolve(result);
            }, flags);
        });
    }
    async updateSmarthomeGroup(groupId, name, applianceIds) {
        await this.init();
        this._enrichCookie();
        return new Promise((resolve, reject) => {
            const flags = {
                method: 'PUT',
                data: JSON.stringify({
                    name,
                    applianceIds: applianceIds || [],
                }),
            };
            this.alexa.httpsGet(`/api/phoenix/group/${groupId}`, (err, result) => {
                if (err)
                    return reject(err);
                resolve(result);
            }, flags);
        });
    }
    async deleteSmarthomeGroup(groupId) {
        await this.init();
        this._enrichCookie();
        return new Promise((resolve, reject) => {
            this.alexa.deleteSmarthomeGroup(groupId, (err, result) => {
                if (err)
                    return reject(err);
                resolve(result);
            });
        });
    }
    // --- Bluetooth ---
    async getBluetoothDevices() {
        await this.init();
        return new Promise((resolve, reject) => {
            this.alexa.getBluetoothDevices((err, result) => {
                if (err)
                    return reject(err);
                resolve(result);
            });
        });
    }
    // --- Do Not Disturb ---
    async setDoNotDisturb(serialNumber, enabled) {
        await this.init();
        const target = this.resolveSerialNumber(serialNumber);
        return new Promise((resolve, reject) => {
            this.alexa.sendSequenceCommand(target, 'deviceDoNotDisturb', enabled, (err) => {
                if (err)
                    return reject(err);
                resolve({ success: true });
            });
        });
    }
    // --- Smart Home Actions ---
    async executeSmarthomeDeviceAction(entityIds, parameters, entityType = 'APPLIANCE') {
        await this.init();
        return new Promise((resolve, reject) => {
            this.alexa.executeSmarthomeDeviceAction(entityIds, parameters, entityType, (err, result) => {
                if (err)
                    return reject(err);
                resolve(result || { success: true });
            });
        });
    }
    // --- Music & Media Playback ---
    async playMusic(serialOrName, searchPhrase, providerId = 'AMAZON_MUSIC') {
        await this.init();
        const target = this.resolveSerialNumber(serialOrName);
        const upperProvider = providerId.toUpperCase();
        return new Promise((resolve, reject) => {
            this.alexa.playMusicProvider(target, upperProvider, searchPhrase, (err, res) => {
                if (err) {
                    const providerMap = {
                        SPOTIFY: 'spotify',
                        AMAZON_MUSIC: 'amazon music',
                        APPLE_MUSIC: 'apple music',
                        TUNEIN: 'tunein',
                        I_HEART_RADIO: 'iheartradio',
                        DEEZER: 'deezer',
                    };
                    const providerName = providerMap[upperProvider] || providerId.toLowerCase();
                    const command = `play ${searchPhrase} on ${providerName}`;
                    return this.textCommand(target, command).then(resolve).catch(reject);
                }
                resolve({ success: true });
            });
        });
    }
    async playAudible(serialOrName, searchPhrase) {
        await this.init();
        const target = this.resolveSerialNumber(serialOrName);
        return new Promise((resolve, reject) => {
            this.alexa.playAudible(target, searchPhrase, (err, res) => {
                if (err) {
                    return this.textCommand(target, `play ${searchPhrase} on audible`).then(resolve).catch(reject);
                }
                resolve({ success: true });
            });
        });
    }
    async getMusicProviders() {
        await this.init();
        return new Promise((resolve, reject) => {
            this.alexa.getMusicProviders((err, res) => {
                if (err)
                    return reject(err);
                resolve(res || []);
            });
        });
    }
    async getPlayerInfo(serialOrName) {
        await this.init();
        const target = this.resolveSerialNumber(serialOrName);
        const dev = this.alexa.find(target);
        let parent = '';
        if (dev && dev.parentClusters && dev.parentClusters[0]) {
            const parentDev = this.alexa.find(dev.parentClusters[0]);
            if (parentDev) {
                parent = `&lemurId=${parentDev.serialNumber}&lemurDeviceType=${parentDev.deviceType}`;
            }
        }
        return new Promise((resolve, reject) => {
            const url = `/api/np/player?deviceSerialNumber=${dev?.serialNumber || target}&deviceType=${dev?.deviceType || ''}&screenWidth=1392&_=%t${parent}`;
            this.alexa.httpsGet(url, (err, res) => {
                if (err)
                    return reject(err);
                resolve(res);
            });
        });
    }
    async getMediaState(serialOrName) {
        await this.init();
        const target = this.resolveSerialNumber(serialOrName);
        return new Promise((resolve, reject) => {
            this.alexa.getMedia(target, (err, res) => {
                if (err)
                    return reject(err);
                resolve(res);
            });
        });
    }
    async mediaControl(serialOrName, action) {
        await this.init();
        const target = this.resolveSerialNumber(serialOrName);
        if (action === 'stop') {
            return new Promise((resolve, reject) => {
                const cmd = target.toLowerCase() === 'all' ? 'deviceStopAll' : 'deviceStop';
                this.alexa.sendSequenceCommand(target, cmd, '', (err) => {
                    if (err)
                        return reject(err);
                    resolve({ success: true });
                });
            });
        }
        return new Promise((resolve, reject) => {
            this.alexa.sendCommand(target, action, '', (err) => {
                if (err) {
                    this.alexa.sendSequenceCommand(target, 'textCommand', action, (err2) => {
                        if (err2)
                            return reject(err2);
                        resolve({ success: true });
                    });
                }
                else {
                    resolve({ success: true });
                }
            });
        });
    }
    async getEqualizer(serialOrName) {
        await this.init();
        const target = this.resolveSerialNumber(serialOrName);
        return new Promise((resolve, reject) => {
            this.alexa.getEqualizerSettings(target, (err, result) => {
                if (err)
                    return reject(err);
                resolve(result);
            });
        });
    }
    async setEqualizer(serialOrName, bass, midrange, treble) {
        await this.init();
        const target = this.resolveSerialNumber(serialOrName);
        return new Promise((resolve, reject) => {
            this.alexa.setEqualizerSettings(target, bass, midrange, treble, (err) => {
                if (err)
                    return reject(err);
                resolve({ success: true });
            });
        });
    }
    // --- Reminders, Alarms & Notifications ---
    async setReminder(serialOrName, text, timestamp) {
        await this.init();
        const target = this.resolveSerialNumber(serialOrName);
        const timeMs = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
        return new Promise((resolve, reject) => {
            this.alexa.setReminder(target, timeMs, text, (err) => {
                if (err)
                    return reject(err);
                resolve({ success: true });
            });
        });
    }
    async getNotifications(cached = false) {
        await this.init();
        return new Promise((resolve, reject) => {
            this.alexa.getNotifications(cached, (err, result) => {
                if (err)
                    return reject(err);
                resolve(result);
            });
        });
    }
    async setAlarmVolume(serialOrName, volume) {
        await this.init();
        const target = this.resolveSerialNumber(serialOrName);
        return new Promise((resolve, reject) => {
            this.alexa.setAlarmVolume(target, volume, (err) => {
                if (err)
                    return reject(err);
                resolve({ success: true });
            });
        });
    }
    // --- Sequence Behaviors & Sounds ---
    async playSound(serialOrName, soundId) {
        await this.init();
        const target = this.resolveSerialNumber(serialOrName);
        return new Promise((resolve, reject) => {
            this.alexa.sendSequenceCommand(target, 'sound', soundId, (err) => {
                if (err)
                    return reject(err);
                resolve({ success: true });
            });
        });
    }
    async curatedTTS(serialOrName, category) {
        await this.init();
        const target = this.resolveSerialNumber(serialOrName);
        return new Promise((resolve, reject) => {
            this.alexa.sendSequenceCommand(target, 'curatedtts', category, (err) => {
                if (err)
                    return reject(err);
                resolve({ success: true });
            });
        });
    }
    async playBehavior(serialOrName, behavior) {
        await this.init();
        const target = this.resolveSerialNumber(serialOrName);
        return new Promise((resolve, reject) => {
            this.alexa.sendSequenceCommand(target, behavior, '', (err) => {
                if (err)
                    return reject(err);
                resolve({ success: true });
            });
        });
    }
    // --- Fire TV Controls ---
    async fireTVControl(serialOrName, command) {
        await this.init();
        const target = this.resolveSerialNumber(serialOrName);
        const cmdMap = {
            turnOn: 'fireTVTurnOn',
            turnOff: 'fireTVTurnOff',
            pause: 'fireTVPauseVideo',
            resume: 'fireTVResumeVideo',
            navigateHome: 'fireTVNavigateHome',
        };
        const seqCmd = cmdMap[command] || command;
        return new Promise((resolve, reject) => {
            this.alexa.sendSequenceCommand(target, seqCmd, '', (err) => {
                if (err)
                    return reject(err);
                resolve({ success: true });
            });
        });
    }
    // --- Voice History Records ---
    async getCustomerHistory(options = { maxRecordSize: 10 }) {
        await this.init();
        return new Promise((resolve, reject) => {
            this.alexa.getCustomerHistoryRecords(options, (err, result) => {
                if (err)
                    return reject(err);
                resolve(result);
            });
        });
    }
    // --- Auth helpers ---
    get authDir() {
        return resolveAuthDir();
    }
    get authFile() {
        return join(this.authDir, 'auth.json');
    }
    resolveAuthDir() {
        return this.authDir;
    }
    _loadAuth() {
        if (!existsSync(this.authFile))
            return null;
        try {
            return JSON.parse(readFileSync(this.authFile, 'utf8'));
        }
        catch {
            return null;
        }
    }
    /**
     * Persist credentials atomically and owner-only.
     */
    _saveAuth(data) {
        ensureSecureAuthDir(this.authDir);
        const authFile = this.authFile;
        const tmp = `${authFile}.${process.pid}.${(this._saveSeq = (this._saveSeq || 0) + 1)}.tmp`;
        let fd;
        try {
            fd = openSync(tmp, 'wx', 0o600);
            try {
                writeFileSync(fd, JSON.stringify(data, null, 2), 'utf8');
                fsyncSync(fd);
            }
            finally {
                closeSync(fd);
                fd = undefined;
            }
            renameSync(tmp, authFile);
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
}
//# sourceMappingURL=alexa-client.js.map