import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createAlexaServer } from '../src/index.js';
import type { AlexaClient } from '../src/alexa-client.js';

describe('Tools Registration & Execution', () => {
  const EXPECTED_TOOLS = [
    'alexa_list_devices',
    'alexa_list_smarthome_devices',
    'alexa_list_groups',
    'alexa_announce',
    'alexa_text_command',
    'alexa_set_volume',
    'alexa_get_volumes',
    'alexa_list_routines',
    'alexa_execute_routine',
    'alexa_list_lists',
    'alexa_get_list_items',
    'alexa_add_list_item',
    'alexa_do_not_disturb',
    'alexa_query_device',
    'alexa_speak',
    'alexa_speak_ssml',
    'alexa_update_group',
    'alexa_create_group',
    'alexa_delete_group',
    'alexa_smarthome_action',
    'alexa_play_music',
    'alexa_play_audible',
    'alexa_media_control',
    'alexa_set_equalizer',
    'alexa_set_reminder',
    'alexa_get_notifications',
    'alexa_set_alarm_volume',
    'alexa_play_sound',
    'alexa_curated_tts',
    'alexa_play_behavior',
    'alexa_fire_tv_control',
    'alexa_get_history',
  ];

  async function createTestClient(mockOverrides: Partial<Record<keyof AlexaClient, any>> = {}) {
    const mockClient = {
      getDevices: async () => [{ name: 'Kitchen Echo', serialNumber: 'ECHO123', online: true }],
      getSmarthomeDevices: async () => [{ id: 'light-1', friendlyName: 'Kitchen Light' }],
      getSmarthomeGroups: async () => [{ id: 'group-1', name: 'Kitchen' }],
      announce: async (serialNumber: string, message: string) => ({ sent: true, serialNumber, message }),
      textCommand: async (serialNumber: string, command: string) => ({ executed: true, serialNumber, command }),
      setVolume: async (serialNumber: string, volume: number) => ({ success: true, serialNumber, volume }),
      getAllDeviceVolumes: async () => ({ 'Kitchen Echo': 40 }),
      getRoutines: async () => [{ automationId: 'routine-1', utterance: 'good morning' }],
      executeRoutine: async (routine: any) => ({ started: true, routine }),
      getLists: async () => [{ id: 'list-1', name: 'Groceries' }],
      getListItems: async (listId: string) => [{ id: 'item-1', value: 'Milk' }],
      addListItem: async (listId: string, value: string) => ({ id: 'item-2', value }),
      setDoNotDisturb: async (serialNumber: string, enabled: boolean) => ({ dnd: enabled, serialNumber }),
      querySmarthomeDevices: async (entityIds: string[]) => ({ states: entityIds.map((id) => ({ id, power: 'ON' })) }),
      speak: async (serialNumber: string, text: string) => ({ spoken: true, serialNumber, text }),
      speakSSML: async (serialNumber: string, ssml: string) => ({ ssmlSpoken: true, serialNumber, ssml }),
      updateSmarthomeGroup: async (groupId: string, name: string, applianceIds: string[]) => ({ updated: true, groupId, name, applianceIds }),
      createSmarthomeGroup: async (name: string, applianceIds: string[]) => ({ created: true, name, applianceIds }),
      deleteSmarthomeGroup: async (groupId: string) => ({ deleted: true, groupId }),
      executeSmarthomeDeviceAction: async (entityIds: any, params: any, entityType: any) => ({ success: true, entityIds, params, entityType }),
      playMusic: async (serialNumber: string, searchPhrase: string, providerId?: string) => ({ success: true, serialNumber, searchPhrase, providerId }),
      playAudible: async (serialNumber: string, searchPhrase: string) => ({ success: true, serialNumber, searchPhrase }),
      mediaControl: async (serialNumber: string, action: string) => ({ success: true, serialNumber, action }),
      getEqualizer: async (serialNumber: string) => ({ bass: 0, midrange: 0, treble: 0 }),
      setEqualizer: async (serialNumber: string, bass: number, midrange: number, treble: number) => ({ success: true, serialNumber, bass, midrange, treble }),
      setReminder: async (serialNumber: string, text: string, timestamp: any) => ({ success: true, serialNumber, text, timestamp }),
      getNotifications: async (cached?: boolean) => [{ id: 'notif-1', type: 'Reminder', text: 'Water plants' }],
      setAlarmVolume: async (serialNumber: string, volume: number) => ({ success: true, serialNumber, volume }),
      playSound: async (serialNumber: string, soundId: string) => ({ success: true, serialNumber, soundId }),
      curatedTTS: async (serialNumber: string, category: string) => ({ success: true, serialNumber, category }),
      playBehavior: async (serialNumber: string, behavior: string) => ({ success: true, serialNumber, behavior }),
      fireTVControl: async (serialNumber: string, command: string) => ({ success: true, serialNumber, command }),
      getCustomerHistory: async (options?: any) => [{ recordId: 'rec-1', description: 'Alexa, turn on light' }],
      ...mockOverrides,
    } as unknown as AlexaClient;

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createAlexaServer(mockClient);
    await server.connect(serverTransport);

    const client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });
    await client.connect(clientTransport);

    return { client, mockClient };
  }

  test('registers exactly 32 MCP tools with descriptions and non-empty schemas', async () => {
    const { client } = await createTestClient();
    const result = await client.listTools();

    assert.equal(result.tools.length, 32);
    const registeredNames = result.tools.map((t) => t.name).sort();
    assert.deepEqual(registeredNames, [...EXPECTED_TOOLS].sort());

    for (const tool of result.tools) {
      assert.ok(tool.name, 'Tool must have a name');
      assert.ok(tool.description && tool.description.length > 5, `Tool ${tool.name} missing description`);
      assert.ok(tool.inputSchema, `Tool ${tool.name} missing inputSchema`);
      assert.equal(tool.inputSchema.type, 'object', `Tool ${tool.name} inputSchema must be object`);
    }
  });

  test('calls device and smart-home reading tools successfully', async () => {
    const { client } = await createTestClient();

    // 1. alexa_list_devices
    const devicesRes = await client.callTool({ name: 'alexa_list_devices', arguments: {} });
    assert.ok(!devicesRes.isError);
    assert.match((devicesRes.content[0] as any).text, /Kitchen Echo/);

    // 2. alexa_list_smarthome_devices
    const shDevicesRes = await client.callTool({ name: 'alexa_list_smarthome_devices', arguments: {} });
    assert.ok(!shDevicesRes.isError);
    assert.match((shDevicesRes.content[0] as any).text, /Kitchen Light/);

    // 3. alexa_list_groups
    const groupsRes = await client.callTool({ name: 'alexa_list_groups', arguments: {} });
    assert.ok(!groupsRes.isError);
    assert.match((groupsRes.content[0] as any).text, /group-1/);

    // 4. alexa_get_volumes
    const volRes = await client.callTool({ name: 'alexa_get_volumes', arguments: {} });
    assert.ok(!volRes.isError);
    assert.match((volRes.content[0] as any).text, /"Kitchen Echo": 40/);

    // 5. alexa_query_device
    const queryRes = await client.callTool({
      name: 'alexa_query_device',
      arguments: { entityIds: ['light-1'] },
    });
    assert.ok(!queryRes.isError);
    assert.match((queryRes.content[0] as any).text, /light-1/);
  });

  test('calls control and command tools successfully', async () => {
    const { client } = await createTestClient();

    // 6. alexa_announce
    const annRes = await client.callTool({
      name: 'alexa_announce',
      arguments: { serialNumber: 'ECHO123', message: 'Dinner is ready!' },
    });
    assert.ok(!annRes.isError);
    assert.match((annRes.content[0] as any).text, /Dinner is ready!/);

    // 7. alexa_text_command
    const cmdRes = await client.callTool({
      name: 'alexa_text_command',
      arguments: { serialNumber: 'ECHO123', command: 'turn off kitchen light' },
    });
    assert.ok(!cmdRes.isError);
    assert.match((cmdRes.content[0] as any).text, /turn off kitchen light/);

    // 8. alexa_set_volume
    const setVolRes = await client.callTool({
      name: 'alexa_set_volume',
      arguments: { serialNumber: 'ECHO123', volume: 65 },
    });
    assert.ok(!setVolRes.isError);
    assert.match((setVolRes.content[0] as any).text, /65/);

    // 9. alexa_do_not_disturb
    const dndRes = await client.callTool({
      name: 'alexa_do_not_disturb',
      arguments: { serialNumber: 'ECHO123', enabled: true },
    });
    assert.ok(!dndRes.isError);
    assert.match((dndRes.content[0] as any).text, /enabled/);

    // 10. alexa_speak
    const speakRes = await client.callTool({
      name: 'alexa_speak',
      arguments: { serialNumber: 'ECHO123', text: 'Hello world' },
    });
    assert.ok(!speakRes.isError);
    assert.match((speakRes.content[0] as any).text, /Hello world/);

    // 11. alexa_speak_ssml
    const ssmlRes = await client.callTool({
      name: 'alexa_speak_ssml',
      arguments: { serialNumber: 'ECHO123', ssml: '<speak><whisper>Quiet mode</whisper></speak>' },
    });
    assert.ok(!ssmlRes.isError);
    assert.match((ssmlRes.content[0] as any).text, /SSML spoken successfully/);
  });

  test('calls routine and list tools successfully', async () => {
    const { client } = await createTestClient();

    // 12. alexa_list_routines
    const routinesRes = await client.callTool({ name: 'alexa_list_routines', arguments: {} });
    assert.ok(!routinesRes.isError);
    assert.match((routinesRes.content[0] as any).text, /good morning/);

    // 13. alexa_execute_routine
    const execRoutineRes = await client.callTool({
      name: 'alexa_execute_routine',
      arguments: { routine: { automationId: 'routine-1' } },
    });
    assert.ok(!execRoutineRes.isError);
    assert.match((execRoutineRes.content[0] as any).text, /Routine executed successfully/);

    // 14. alexa_list_lists
    const listsRes = await client.callTool({ name: 'alexa_list_lists', arguments: {} });
    assert.ok(!listsRes.isError);
    assert.match((listsRes.content[0] as any).text, /Groceries/);

    // 15. alexa_get_list_items
    const listItemsRes = await client.callTool({
      name: 'alexa_get_list_items',
      arguments: { listId: 'list-1' },
    });
    assert.ok(!listItemsRes.isError);
    assert.match((listItemsRes.content[0] as any).text, /Milk/);

    // 16. alexa_add_list_item
    const addListItemRes = await client.callTool({
      name: 'alexa_add_list_item',
      arguments: { listId: 'list-1', value: 'Apples' },
    });
    assert.ok(!addListItemRes.isError);
    assert.match((addListItemRes.content[0] as any).text, /Apples/);
  });

  test('calls group mutation tools successfully', async () => {
    const { client } = await createTestClient();

    // 17. alexa_create_group
    const createGroupRes = await client.callTool({
      name: 'alexa_create_group',
      arguments: { name: 'Living Room', applianceIds: ['light-1'] },
    });
    assert.ok(!createGroupRes.isError);
    assert.match((createGroupRes.content[0] as any).text, /Living Room/);

    // 18. alexa_update_group
    const updateGroupRes = await client.callTool({
      name: 'alexa_update_group',
      arguments: { groupId: 'grp-1', name: 'Main Living Room', applianceIds: ['light-1'] },
    });
    assert.ok(!updateGroupRes.isError);
    assert.match((updateGroupRes.content[0] as any).text, /Main Living Room/);

    // 19. alexa_delete_group
    const deleteGroupRes = await client.callTool({
      name: 'alexa_delete_group',
      arguments: { groupId: 'grp-1' },
    });
    assert.ok(!deleteGroupRes.isError);
    assert.match((deleteGroupRes.content[0] as any).text, /deleted/);
  });

  test('calls smart-home action tool successfully (Category A)', async () => {
    const { client } = await createTestClient();

    // 20. alexa_smarthome_action
    const shActionRes = await client.callTool({
      name: 'alexa_smarthome_action',
      arguments: {
        entityId: 'light-1',
        action: 'turnOn',
      },
    });
    assert.ok(!shActionRes.isError);
    assert.match((shActionRes.content[0] as any).text, /Smart home action "turnOn" executed on light-1/);

    const shBrightnessRes = await client.callTool({
      name: 'alexa_smarthome_action',
      arguments: {
        entityId: 'light-1',
        action: 'setBrightness',
        value: 75,
      },
    });
    assert.ok(!shBrightnessRes.isError);
    assert.match((shBrightnessRes.content[0] as any).text, /Smart home action "setBrightness" executed on light-1/);
  });

  test('calls music and media playback tools successfully (Category B)', async () => {
    const { client } = await createTestClient();

    // 21. alexa_play_music
    const musicRes = await client.callTool({
      name: 'alexa_play_music',
      arguments: {
        serialNumber: 'ECHO123',
        searchPhrase: 'Kind of Blue',
        provider: 'SPOTIFY',
      },
    });
    assert.ok(!musicRes.isError);
    assert.match((musicRes.content[0] as any).text, /Kind of Blue/);

    // 22. alexa_play_audible
    const audibleRes = await client.callTool({
      name: 'alexa_play_audible',
      arguments: {
        serialNumber: 'ECHO123',
        searchPhrase: 'Project Hail Mary',
      },
    });
    assert.ok(!audibleRes.isError);
    assert.match((audibleRes.content[0] as any).text, /Project Hail Mary/);

    // 23. alexa_media_control
    const mediaRes = await client.callTool({
      name: 'alexa_media_control',
      arguments: {
        serialNumber: 'ECHO123',
        action: 'pause',
      },
    });
    assert.ok(!mediaRes.isError);
    assert.match((mediaRes.content[0] as any).text, /pause/);

    // 24. alexa_set_equalizer
    const eqRes = await client.callTool({
      name: 'alexa_set_equalizer',
      arguments: {
        serialNumber: 'ECHO123',
        bass: 2,
        midrange: 0,
        treble: 1,
      },
    });
    assert.ok(!eqRes.isError);
    assert.match((eqRes.content[0] as any).text, /Bass=2, Mid=0, Treble=1/);
  });

  test('calls reminder, alarm, and notification tools successfully (Category C)', async () => {
    const { client } = await createTestClient();

    // 25. alexa_set_reminder
    const remRes = await client.callTool({
      name: 'alexa_set_reminder',
      arguments: {
        serialNumber: 'ECHO123',
        text: 'Time to stretch',
        timestamp: '2026-09-12T18:00:00Z',
      },
    });
    assert.ok(!remRes.isError);
    assert.match((remRes.content[0] as any).text, /Time to stretch/);

    // 26. alexa_get_notifications
    const notifRes = await client.callTool({
      name: 'alexa_get_notifications',
      arguments: { type: 'Reminder' },
    });
    assert.ok(!notifRes.isError);
    assert.match((notifRes.content[0] as any).text, /Water plants/);

    // 27. alexa_set_alarm_volume
    const alarmVolRes = await client.callTool({
      name: 'alexa_set_alarm_volume',
      arguments: {
        serialNumber: 'ECHO123',
        volume: 80,
      },
    });
    assert.ok(!alarmVolRes.isError);
    assert.match((alarmVolRes.content[0] as any).text, /80%/);
  });

  test('calls routine behaviors, sound effects, and curated TTS tools successfully (Category D)', async () => {
    const { client } = await createTestClient();

    // 28. alexa_play_sound
    const soundRes = await client.callTool({
      name: 'alexa_play_sound',
      arguments: {
        serialNumber: 'ECHO123',
        soundId: 'amzn_sfx_doorbell_chime_01',
      },
    });
    assert.ok(!soundRes.isError);
    assert.match((soundRes.content[0] as any).text, /amzn_sfx_doorbell_chime_01/);

    // 29. alexa_curated_tts
    const ttsRes = await client.callTool({
      name: 'alexa_curated_tts',
      arguments: {
        serialNumber: 'ECHO123',
        category: 'goodmorning',
      },
    });
    assert.ok(!ttsRes.isError);
    assert.match((ttsRes.content[0] as any).text, /goodmorning/);

    // 30. alexa_play_behavior
    const behavRes = await client.callTool({
      name: 'alexa_play_behavior',
      arguments: {
        serialNumber: 'ECHO123',
        behavior: 'joke',
      },
    });
    assert.ok(!behavRes.isError);
    assert.match((behavRes.content[0] as any).text, /joke/);
  });

  test('calls Fire TV and history tools successfully (Categories E & F)', async () => {
    const { client } = await createTestClient();

    // 31. alexa_fire_tv_control
    const ftvRes = await client.callTool({
      name: 'alexa_fire_tv_control',
      arguments: {
        serialNumber: 'FIRETV123',
        command: 'navigateHome',
      },
    });
    assert.ok(!ftvRes.isError);
    assert.match((ftvRes.content[0] as any).text, /navigateHome/);

    // 32. alexa_get_history
    const histRes = await client.callTool({
      name: 'alexa_get_history',
      arguments: { limit: 5 },
    });
    assert.ok(!histRes.isError);
    assert.match((histRes.content[0] as any).text, /Alexa, turn on light/);
  });

  test('handles client errors gracefully with isError: true', async () => {
    const { client } = await createTestClient({
      getDevices: async () => {
        throw new Error('Amazon Alexa API authentication expired');
      },
      setVolume: async () => {
        throw new Error('Device Kitchen Echo unreachable');
      },
    });

    const devicesRes = await client.callTool({ name: 'alexa_list_devices', arguments: {} });
    assert.equal(devicesRes.isError, true);
    assert.match((devicesRes.content[0] as any).text, /Error: Amazon Alexa API authentication expired/);

    const volumeRes = await client.callTool({
      name: 'alexa_set_volume',
      arguments: { serialNumber: 'ECHO123', volume: 50 },
    });
    assert.equal(volumeRes.isError, true);
    assert.match((volumeRes.content[0] as any).text, /Error: Device Kitchen Echo unreachable/);
  });

  test('rejects out-of-range volume with validation error', async () => {
    const { client } = await createTestClient();

    const res = await client.callTool({
      name: 'alexa_set_volume',
      arguments: { serialNumber: 'ECHO123', volume: 150 },
    });

    assert.equal(res.isError, true);
    assert.match((res.content[0] as any).text, /Too big: expected number to be <=100/);
  });
});
