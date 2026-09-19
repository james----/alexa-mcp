export interface RegistrationData {
    macDms?: {
        device_private_key?: string;
        adp_token?: string;
        [key: string]: unknown;
    };
    localCookie?: string;
    frc?: string;
    'map-md'?: string;
    deviceId?: string;
    deviceSerial?: string;
    refreshToken?: string;
    tokenDate?: number;
    amazonPage?: string;
    csrf?: string;
    deviceAppName?: string;
    dataVersion?: number | string;
    [key: string]: unknown;
}
export interface AuthData {
    cookie?: string | RegistrationData | null;
    formerRegistrationData?: RegistrationData | any;
    amazonPage?: string;
    authenticatedAt?: string;
    [key: string]: unknown;
}
export interface AlexaDevice {
    name?: string;
    accountName?: string;
    serialNumber: string;
    deviceType: string;
    deviceFamily: string;
    online: boolean;
    capabilities: string[];
    [key: string]: unknown;
}
export interface SmarthomeEntity {
    id?: string;
    entityId?: string;
    applianceId?: string;
    friendlyName?: string;
    friendlyDescription?: string;
    modelName?: string;
    manufacturerName?: string;
    aliases?: string[];
    entityType?: string;
    applianceTypes?: string[];
    capabilities?: unknown[];
    actions?: string[];
    connectedVia?: string;
    [key: string]: unknown;
}
export interface SmarthomeGroup {
    groupId: string;
    name: string;
    applianceIds: string[];
    devices?: unknown[];
    [key: string]: unknown;
}
export interface AlexaRoutine {
    automationId: string;
    name?: string;
    status?: string;
    triggers?: unknown[];
    sequence?: unknown;
    [key: string]: unknown;
}
export interface AlexaList {
    listId: string;
    name: string;
    type?: string;
    state?: string;
    version?: number;
    itemCount?: number;
    items?: AlexaListItem[];
    [key: string]: unknown;
}
export interface AlexaListItem {
    id: string;
    value: string;
    status: 'active' | 'completed' | string;
    updatedTime?: number;
    createdTime?: number;
    version?: number;
    [key: string]: unknown;
}
export type VolumeMap = Record<string, number | null>;
//# sourceMappingURL=alexa.d.ts.map