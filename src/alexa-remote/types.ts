    export type InitOptions =
        | string
        | Partial<{
        cookie: string;
        email: string;
        password: string;
        proxyOnly: boolean;
        proxyOwnIp: string;
        proxyPort: number;
        proxyLogLevel: string;
        bluetooth: boolean;
        logger: (...args: any[]) => void;
        alexaServiceHost: string;
        userAgent: string;
        apiUserAgentPostfix: string
        deviceAppName: string;
        acceptLanguage: string;
        amazonPage: string;
        /** @deprecated */
        useWsMqtt: boolean;
        usePushConnection: boolean;
        cookieRefreshInterval: number;
        macDms: {
            device_private_key: string;
            adp_token: string;
        };
        formerRegistrationData: {
            macDms: {
                device_private_key: string;
                adp_token: string;
            };
            localCookie: string;
            frc: string;
            "map-md": string;
            "deviceId": string;
            "deviceSerial": string;
            "refreshToken": string;
            "tokenDate": number;
            "amazonPage": string;
            "csrf": string;
            "deviceAppName": string;
            dataVersion: number | undefined;
        }
    }>;

    export type AppDevice = {
        deviceAccountId: string;
        deviceType: string;
        serialNumber: string;
    };

    export type Serial = {
        accountName: string;
        appDeviceList: AppDevice[];
        capabilities: string[];
        charging: string;
        deviceAccountId: string;
        deviceFamily: string;
        deviceOwnerCustomerId: string;
        deviceType: string;
        deviceTypeFriendlyName: string;
        essid: string;
        language: string;
        macAddress: string;
        online: boolean;
        postalCode: string;
        registrationId: string;
        remainingBatteryLevel: string;
        serialNumber: string;
        softwareVersion: string;
        isControllable: boolean;
        hasMusicPlayer: boolean;
        isMultiroomDevice: boolean;
        isMultiroomMember: boolean;
        wakeWord: string;
    };

    export type CallbackWithError = (err?: Error) => void;

    export type CallbackWithErrorAndBody = <T>(err?: Error, body?: T) => void;

    export type SerialOrName = Serial | string;

    export type SerialOrNameOrArray = SerialOrName | SerialOrName[]

    export type Value = string | number | boolean;

    export type SequenceValue = Value | {
        title: string
        text: string
    };

    export type Sound = {
        displayName: string;
        folder: string;
        id: string;
        providerId: string;
        sampleUrl: string;
    };

    export type Status = "ON" | "OFF";

    export type Notification = Partial<{
        alarmTime: number;
        createdDate: number;
        deferredAtTime: number | null;
        deviceSerialNumber: string;
        deviceType: string;
        geoLocationTriggerData: string | null;
        id: string;
        musicAlarmId: string | null;
        musicEntity: string | null;
        notificationIndex: string;
        originalDate: string;
        originalTime: string;
        provider: string | null;
        recurringPattern: string | null;
        remainingTime: number;
        reminderLabel: string | null;
        sound: Sound;
        status: Status;
        timeZoneId: string | null;
        timerLabel: string | null;
        triggerTime: number;
        type: string;
        version: string;
        rRuleData: {
            byMonthDays: string[],
            byMonths: string[],
            byWeekDays: string[],
            flexibleRecurringPatternType: 'EVERY_X_WEEKS' | 'EVERY_X_MONTHS' | 'EVERY_X_DAYS' | 'EVERY_X_YEARS' | 'X_TIMES_A_WEEK' | 'X_TIMES_A_MONTH' | 'X_TIMES_A_DAY' | 'X_TIMES_A_YEAR',
            frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | null,
            intervals: number[],
            nextTriggerTimes: string[],
            notificationTimes: string[],
            offset: number[],
            recurEndDate: string | null,
            recurEndTime: string | null,
            recurStartDate: string | null,
            recurStartTime: string | null,
            recurrenceRules: string[]
        },
    }>;

    type NotificationV2 = Partial<{
        trigger: {
            scheduledTime: string,
            recurrence: {
                freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
                byDay: string[],
                byMonth: string[],
                interval: number
            }
        },
        endpointId: string,
        assets: [{
            type: string,
            assetId: string
        }],
        extensions: []
    }>;

    type GetContactsOptions = Partial<{
        includePreferencesByLevel: string;
        includeNonAlexaContacts: boolean;
        includeHomeGroupMembers: boolean;
        bulkImportOnly: boolean;
        includeBlockStatus: boolean;
        dedupeMode: string;
        homeGroupId: string;
    }>;

    export type ListItemOptions = Partial<{
        completed: string;
        listIds: string;
        version: string;
        value: string;
    }>;

    export type GetCustomerHistoryRecordsOptions = {
        startTime: number;
        endTime: number;
        recordType: string;
        maxRecordSize: number;
    };

    export type GetConversationsOptions = Partial<{
        latest: boolean;
        includeHomegroup: boolean;
        unread: boolean;
        modifiedSinceDate: string;
        includeUserName: boolean;
    }>;

    export type GetAuthenticationDetails = {
        authenticated: boolean;
        canAccessPrimeMusicContent: boolean;
        customerEmail: string;
        customerId: string;
        customerName: string;
    };

    export type SmartHomeDeviceQueryEntry = {
        entityId: string;
        entityType: 'APPLIANCE' | 'ENTITY' | 'GROUP'
        properties?: {
            namespace: string; // aka interfaceName aka "Alexa.PowerController"
            name: string; // e.g. "powerState"
            instance?: string;
        }[]
    }

    export type MessageCommands =
        | "play"
        | "pause"
        | "next"
        | "previous"
        | "forward"
        | "rewind"
        | "volume"
        | "shuffle"
        | "repeat"
        | "jump";

    export type SequenceNodeCommand =
        | "weather"
        | "traffic"
        | "flashbriefing"
        | "goodmorning"
        | "funfact"
        | "joke"
        | "cleanup"
        | "singasong"
        | "tellstory"
        | "calendarToday"
        | "calendarTomorrow"
        | "calendarNext"
        | "textCommand"
        | "curatedtts"
        | "volume"
        | "deviceStop"
        | "deviceStopAll"
        | "deviceDoNotDisturb"
        | "deviceDoNotDisturbAll"
        | "speak"
        | "skill"
        | "notification"
        | "announcement"
        | "ssml"
        | "fireTVTurnOn"
        | "fireTVTurnOff"
        | "fireTVTurnOnOff"
        | "fireTVPauseVideo"
        | "fireTVResumeVideo"
        | "fireTVNavigateHome";

    export type SequenceType = "SerialNode" | "ParallelNode";

    export type EntityType = "APPLIANCE" | "GROUP";

    export type SequenceNodeDetails = {
        command: SequenceNodeCommand;
        value: SequenceValue;
        device?: SerialOrNameOrArray;
    }

    export type MultiSequenceCommand = SequenceNodeDetails | {
        sequencetype: SequenceType;
        nodes: MultiSequenceCommand[];
    };
