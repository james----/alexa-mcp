import { AuthData, AlexaDevice, SmarthomeGroup, VolumeMap } from './types/alexa.js';
export declare function resolveAuthDir(): string;
/**
 * Ensure the credential directory exists and is owner-only.
 *
 * mkdirSync's `mode` applies only to directories it actually creates, so an existing
 * world-readable directory (e.g. one made before this hardening, or by an older version)
 * keeps its permissions. Tighten it explicitly.
 */
export declare function ensureSecureAuthDir(authDir?: string): void;
export declare class AlexaClient {
    alexa: any;
    initialized: boolean;
    private _initPromise;
    private _saveSeq;
    constructor();
    init(): Promise<void>;
    private _doInit;
    /** Legacy patch helper retained as no-op; all fixes are natively integrated into vendored AlexaRemote. */
    private _patchAlexaRemote;
    /** Neutralize an AlexaRemote instance whose init() may still be in flight. */
    private _retire;
    private _initOnce;
    getDevices(): Promise<AlexaDevice[]>;
    getSmarthomeDevices(): Promise<any>;
    getSmarthomeGroups(): Promise<SmarthomeGroup[]>;
    querySmarthomeDevices(entityIds: string[]): Promise<any>;
    resolveSerialNumber(serialOrName: string): string;
    announce(serialNumber: string, message: string): Promise<{
        success: boolean;
    }>;
    speak(serialNumber: string, text: string): Promise<{
        success: boolean;
    }>;
    speakSSML(serialNumber: string, ssml: string): Promise<{
        success: boolean;
    }>;
    textCommand(serialNumber: string, text: string): Promise<{
        success: boolean;
    }>;
    setVolume(serialNumber: string, volume: number): Promise<{
        success: boolean;
    }>;
    getAllDeviceVolumes(): Promise<VolumeMap>;
    getRoutines(): Promise<any>;
    executeRoutine(routine: any): Promise<{
        success: boolean;
    }>;
    getLists(): Promise<any>;
    getListItems(listId: string): Promise<any>;
    addListItem(listId: string, value: string): Promise<any>;
    private _enrichCookie;
    createSmarthomeGroup(name: string, applianceIds?: string[]): Promise<any>;
    updateSmarthomeGroup(groupId: string, name: string, applianceIds: string[]): Promise<any>;
    deleteSmarthomeGroup(groupId: string): Promise<any>;
    getBluetoothDevices(): Promise<any>;
    setDoNotDisturb(serialNumber: string, enabled: boolean): Promise<{
        success: boolean;
    }>;
    executeSmarthomeDeviceAction(entityIds: string | string[], parameters: Record<string, any>, entityType?: 'APPLIANCE' | 'GROUP'): Promise<any>;
    playMusic(serialOrName: string, searchPhrase: string, providerId?: string): Promise<{
        success: boolean;
    }>;
    playAudible(serialOrName: string, searchPhrase: string): Promise<{
        success: boolean;
    }>;
    getMusicProviders(): Promise<any[]>;
    getPlayerInfo(serialOrName: string): Promise<any>;
    getMediaState(serialOrName: string): Promise<any>;
    mediaControl(serialOrName: string, action: 'stop' | 'pause' | 'play' | 'next' | 'previous'): Promise<{
        success: boolean;
    }>;
    getEqualizer(serialOrName: string): Promise<any>;
    setEqualizer(serialOrName: string, bass: number, midrange: number, treble: number): Promise<{
        success: boolean;
    }>;
    setReminder(serialOrName: string, text: string, timestamp: number | string): Promise<{
        success: boolean;
    }>;
    getNotifications(cached?: boolean): Promise<any>;
    setAlarmVolume(serialOrName: string, volume: number): Promise<{
        success: boolean;
    }>;
    playSound(serialOrName: string, soundId: string): Promise<{
        success: boolean;
    }>;
    curatedTTS(serialOrName: string, category: string): Promise<{
        success: boolean;
    }>;
    playBehavior(serialOrName: string, behavior: string): Promise<{
        success: boolean;
    }>;
    fireTVControl(serialOrName: string, command: 'turnOn' | 'turnOff' | 'pause' | 'resume' | 'navigateHome'): Promise<{
        success: boolean;
    }>;
    getCustomerHistory(options?: {
        maxRecordSize?: number;
    }): Promise<any>;
    get authDir(): string;
    get authFile(): string;
    resolveAuthDir(): string;
    _loadAuth(): AuthData | null;
    /**
     * Persist credentials atomically and owner-only.
     */
    _saveAuth(data: AuthData): void;
}
//# sourceMappingURL=alexa-client.d.ts.map