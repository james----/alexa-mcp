import { EventEmitter } from 'node:events';
declare class AlexaRemote extends EventEmitter {
    [key: string]: any;
    serialNumbers: Record<string, any>;
    names: Record<string, any>;
    friendlyNames: Record<string, any>;
    lastAuthCheck: number | null;
    cookie: string | null;
    csrf: string | null;
    cookieData: any;
    ownerCustomerId: string | null;
    endpoints: any;
    baseUrl: string;
    authApiBearerToken: string | null;
    authApiBearerExpiry: number | null;
    activityCsrfToken: string | null;
    activityCsrfTokenExpiry: number | null;
    activityCsrfTokenReferer: string | null;
    lastVolumes: Record<string, any>;
    lastEqualizer: Record<string, any>;
    lastPushedActivity: Record<string, any>;
    activityUpdateQueue: any[];
    activityUpdateNotFoundCounter: number;
    _options: any;
    constructor();
    setCookie(_cookie: any): any;
    init(cookie: any, callback: any): void;
    prepare(callback: any): this;
    initNotifications(callback: any): any;
    initWakewords(callback: any): void;
    initDeviceState(callback: any): void;
    initBluetoothState(callback: any): void;
    stopProxyServer(callback: any): any;
    /** @deprecated */
    isWsMqttConnected(): any;
    isPushConnected(): any;
    /**
     * @deprecated
     */
    initWsMqttConnection(): void;
    simulateActivity(deviceSerialNumber: any, destinationUserId: any): void;
    initPushConnection(): void;
    getPushedActivities(): void;
    stop(): void;
    generateCookie(email: any, password: any, callback: any): void;
    refreshCookie(callback: any): void;
    getAuthApiBearerToken(callback: any): void;
    updateApiBearerToken(callback: any): any;
    httpsGetAuthApi(path: any, callback: any, flags?: {}): any;
    httpsGet(noCheck: any, path: any, callback: any, flags?: {}): void;
    httpsApiGet(path: any, callback: any, flags: any): any;
    httpsGetCall(path: any, callback: any, flags?: {}): void;
    checkAuthentication(callback: any): void;
    getEndpoints(callback: any): void;
    getDevices(callback: any): void;
    getCards(limit: any, beforeCreationTime: any, callback: any): void;
    getUsersMe(callback: any): void;
    getHousehold(callback: any): void;
    getMedia(serialOrName: any, callback: any): any;
    getPlayerInfo(serialOrName: any, callback: any): any;
    /** @deprecated Use getListsV2 instead */
    getLists(callback: any): void;
    getListsV2(callback: any): void;
    /** @deprecated Use getListV2 instead */
    getList(listId: any, callback: any): void;
    getListV2(listId: any, callback: any, limit: any): void;
    /**
     * Get items from a list.
     *
     * @param {String} listId List ID to retrieve items from
     * @param {Object} options Options to pass to the request
     * @param {number} options.limit Limit of items to retrieve
     * @param {function} callback
     *
     * @deprecated Use getListItemsV2 instead
     */
    getListItems(listId: any, options: any, callback: any): void;
    /**
     * Get items from a list with v2 API.
     *
     * @param {String} listId List ID to retrieve items from
     * @param {Object} options Options to pass to the request
     * @param {number} options.limit Limit of items to retrieve
     * @param {function} callback
     *
     */
    getListItemsV2(listId: any, options: any, callback: any): any;
    addListItem(listId: any, options: any, callback: any): void;
    updateListItem(listId: any, listItemId: any, options: any, callback: any): false | undefined;
    deleteListItem(listId: any, listItemId: any, options: any, callback: any): false | undefined;
    getWakeWords(callback: any): void;
    getReminders(cached: any, callback: any): void;
    getNotifications(cached: any, callback: any): void;
    getNotificationSounds(serialOrName: any, alertType: any, callback: any): any;
    getDeviceNotificationState(serialOrName: any, callback: any): any;
    setDeviceNotificationVolume(serialOrName: any, volumeLevel: any, callback: any): any;
    setDeviceNotificationDefaultSound(serialOrName: any, notificationType: any, soundId: any, callback: any): any;
    getDeviceNotificationDefaultSound(serialOrName: any, notificationType: any, callback: any): any;
    getAscendingAlarmState(serialOrName: any, callback: any): void;
    setDeviceAscendingAlarmState(serialOrName: any, ascendingAlarmEnabled: any, callback: any): any;
    getSkills(callback: any): void;
    getWholeHomeAudioGroups(callback: any): void;
    createNotificationObject(serialOrName: any, type: any, label: any, value: any, status: any, sound: any, recurring: any): {
        alarmTime: number;
        createdDate: number;
        type: any;
        deviceSerialNumber: any;
        deviceType: any;
        reminderLabel: any;
        timerLabel: any;
        sound: any;
        originalDate: string;
        originalTime: string;
        id: null;
        isRecurring: boolean;
        recurringPattern: null;
        timeZoneId: null;
        reminderIndex: null;
        isSaveInFlight: boolean;
        status: string;
    } | null;
    convertNotificationToV2(notification: any): any;
    parseValue4Notification(notification: any, value: any): any;
    createNotification(notification: any, callback: any): any;
    changeNotification(notification: any, value: any, callback: any): void;
    setNotification(notification: any, callback: any): void;
    setNotificationV2(notificationIndex: any, notification: any, callback: any): void;
    activateNotificationV2(notificationIndex: any, notification: any, callback: any): void;
    deactivateNotificationV2(notificationIndex: any, callback: any): void;
    deleteNotification(notification: any, callback: any): void;
    cancelNotification(notification: any, callback: any): void;
    getDoNotDisturb(callback: any): void;
    getDeviceStatusList(callback: any): void;
    getBluetooth(cached: any, callback: any): void;
    tuneinSearchRaw(query: any, callback: any): void;
    tuneinSearch(query: any, callback: any): void;
    setTunein(serialOrName: any, guideId: any, contentType: any, callback: any): any;
    _getCustomerHistoryRecords(options: any, callback: any): void;
    getCustomerHistoryRecords(options: any, callback: any): any;
    getAccount(includeActors: any, callback: any): void;
    getContacts(options: any, callback: any): void;
    getConversations(options: any, callback: any): void;
    connectBluetooth(serialOrName: any, btAddress: any, callback: any): any;
    disconnectBluetooth(serialOrName: any, btAddress: any, callback: any): any;
    setDoNotDisturb(serialOrName: any, enabled: any, callback: any): any;
    find(serialOrName: any): any;
    setAlarmVolume(serialOrName: any, volume: any, callback: any): any;
    sendCommand(serialOrName: any, command: any, value: any, callback: any): any;
    sendMessage(serialOrName: any, command: any, value: any, callback: any): any;
    createSequenceNode(command: any, value: any, serialOrName: any, overrideCustomerId: any): {
        '@type': string;
        operationPayload: {
            deviceType: string;
            deviceSerialNumber: string;
            locale: string;
            customerId: string;
        };
    } | null | undefined;
    buildSequenceNodeStructure(serialOrName: any, commands: any, sequenceType: any, overrideCustomerId: any): any;
    sendMultiSequenceCommand(serialOrName: any, commands: any, sequenceType: any, overrideCustomerId: any, callback: any): void;
    sendSequenceCommand(serialOrName: any, command: any, value: any, overrideCustomerId: any, callback: any): any;
    getAutomationRoutines(limit: any, callback: any): void;
    executeAutomationRoutine(serialOrName: any, routine: any, callback: any): any;
    /**
     * Get  the Skill catalog that can be used for routines
     *
     * @param catalogId string defaults to "Root"
     * @param limit number defaults to 100
     * @param callback response callback
     */
    getRoutineSkillCatalog(catalogId: any, limit: any, callback: any): void;
    getMusicProviders(callback: any): void;
    playMusicProvider(serialOrName: any, providerId: any, searchPhrase: any, callback: any): any;
    playAudible(serialOrName: any, searchPhrase: any, callback: any): any;
    sendTextMessage(conversationId: any, text: any, callback: any): void;
    deleteConversation(conversationId: any, lastMessageId: any, callback: any): void;
    setReminder(serialOrName: any, timestamp: any, label: any, callback: any): void;
    getHomeGroup(callback: any): void;
    getDevicePreferences(serialOrName: any, callback: any): void;
    setDevicePreferences(serialOrName: any, preferences: any, callback: any): any;
    getDeviceWifiDetails(serialOrName: any, callback: any): any;
    getAllDeviceVolumes(callback: any): void;
    /** @deprecated Use getSmarthomeDevicesV2 instead */
    getSmarthomeDevices(callback: any): void;
    getSmarthomeDevicesV2(callback: any): void;
    getSmarthomeGroups(callback: any): void;
    getSmarthomeEntities(callback: any): void;
    getFireTVEntities(callback: any): void;
    getSmarthomeBehaviourActionDefinitions(callback: any): void;
    getRoutineSoundList(callback: any): void;
    renameDevice(serialOrName: any, newName: any, callback: any): any;
    deleteSmarthomeDevice(smarthomeDevice: any, callback: any): void;
    setEnablementForSmarthomeDevice(smarthomeDevice: any, enabled: any, callback: any): void;
    deleteSmarthomeGroup(smarthomeGroup: any, callback: any): void;
    deleteAllSmarthomeDevices(callback: any): void;
    discoverSmarthomeDevice(callback: any): void;
    querySmarthomeDevices(toQuery: any, entityType: any, maxTimeout: any, callback: any): void;
    executeSmarthomeDeviceAction(entityIds: any, parameters: any, entityType: any, callback: any): void;
    unpaireBluetooth(serialOrName: any, btAddress: any, callback: any): any;
    deleteDevice(serialOrName: any, callback: any): any;
    getDeviceSettings(serialOrName: any, settingName: any, callback: any): any;
    setDeviceSettings(serialOrName: any, settingName: any, value: any, callback: any): any;
    getConnectedSpeakerOptionSetting(serialOrName: any, callback: any): void;
    setConnectedSpeakerOptionSetting(serialOrName: any, speakerType: any, callback: any): void;
    getAttentionSpanSetting(serialOrName: any, callback: any): void;
    setAttentionSpanSetting(serialOrName: any, enabled: any, callback: any): void;
    getAlexaGesturesSetting(serialOrName: any, callback: any): void;
    setAlexaGesturesSetting(serialOrName: any, enabled: any, callback: any): void;
    getDisplayPowerSetting(serialOrName: any, callback: any): void;
    setDisplayPowerSetting(serialOrName: any, enabled: any, callback: any): void;
    getAdaptiveBrightnessSetting(serialOrName: any, callback: any): void;
    setAdaptiveBrightnessSetting(serialOrName: any, enabled: any, callback: any): void;
    getClockTimeFormatSetting(serialOrName: any, callback: any): void;
    setClockTimeFormatSetting(serialOrName: any, format: any, callback: any): void;
    getBrightnessSetting(serialOrName: any, callback: any): void;
    setBrightnessSetting(serialOrName: any, brightness: any, callback: any): any;
    /**
     * Response:
     * {
     * 	"enabled": true
     * }
     */
    getEqualizerEnabled(serialOrName: any, callback: any): any;
    /**
     * Response:
     * {
     * 	"max": 6,
     * 	"min": -6
     * }
     */
    getEqualizerRange(serialOrName: any, callback: any): any;
    /**
     * Response:
     * {
     * 	"bass": 0,
     * 	"mid": 0,
     * 	"treble": 0
     * }
     */
    getEqualizerSettings(serialOrName: any, callback: any): any;
    setEqualizerSettings(serialOrName: any, bass: any, midrange: any, treble: any, callback: any): any;
    /**
     * Response:
     * {
     * 	"ports": [{
     * 		"direction": "OUTPUT",
     * 		"id": "aux0",
     * 		"inputActivity": null,
     * 		"isEnabled": false,
     * 		"isPlugged": false
     * 	}]
     * }
     */
    getAuxControllerState(serialOrName: any, callback: any): any;
    setAuxControllerPortDirection(serialOrName: any, direction: any, port: any, callback: any): any;
    getPlayerQueue(serialOrName: any, size: any, callback: any): any;
}
export { AlexaRemote };
export default AlexaRemote;
//# sourceMappingURL=alexa-remote.d.ts.map