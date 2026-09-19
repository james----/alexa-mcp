import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AlexaClient } from './alexa-client.js';

/**
 * Register all 32 Alexa tools on the given McpServer instance.
 */
export function registerTools(server: McpServer, client: AlexaClient): void {
  // ============================================================
  // TOOL: List Echo Devices
  // ============================================================
  server.registerTool(
    'alexa_list_devices',
    {
      title: 'List Alexa Devices',
      description:
        'List all Amazon Echo devices in your account with their serial numbers, types, and online status.',
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const devices = await client.getDevices();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(devices, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // TOOL: List Smart Home Devices
  // ============================================================
  server.registerTool(
    'alexa_list_smarthome_devices',
    {
      title: 'List Smart Home Devices',
      description:
        'List all smart home devices registered in Alexa (lights, switches, sensors, etc).',
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const devices = await client.getSmarthomeDevices();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(devices, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // TOOL: List Smart Home Groups
  // ============================================================
  server.registerTool(
    'alexa_list_groups',
    {
      title: 'List Smart Home Groups',
      description:
        'List all smart home groups/rooms configured in Alexa. Shows which devices are assigned to each group.',
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const groups = await client.getSmarthomeGroups();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(groups, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // TOOL: Send Announcement
  // ============================================================
  server.registerTool(
    'alexa_announce',
    {
      title: 'Send Alexa Announcement',
      description:
        'Send a voice announcement to a specific Echo device. The message will be spoken aloud.',
      inputSchema: z.object({
        serialNumber: z
          .string()
          .describe(
            'Serial number of the Echo device (use alexa_list_devices to find it)'
          ),
        message: z.string().describe('The message to announce'),
      }),
    },
    async ({ serialNumber, message }: { serialNumber: string; message: string }) => {
      try {
        await client.announce(serialNumber, message);
        return {
          content: [
            {
              type: 'text',
              text: `Announcement sent: "${message}"`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // TOOL: Text Command (simulate voice)
  // ============================================================
  server.registerTool(
    'alexa_text_command',
    {
      title: 'Send Text Command to Alexa',
      description:
        'Send a text command to Alexa as if you spoke it. Example: "turn on the kitchen lights"',
      inputSchema: z.object({
        serialNumber: z
          .string()
          .describe('Serial number of the Echo device'),
        command: z
          .string()
          .describe('The text command, as if spoken to Alexa'),
      }),
    },
    async ({ serialNumber, command }: { serialNumber: string; command: string }) => {
      try {
        await client.textCommand(serialNumber, command);
        return {
          content: [
            {
              type: 'text',
              text: `Command sent: "${command}"`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // TOOL: Set Volume
  // ============================================================
  server.registerTool(
    'alexa_set_volume',
    {
      title: 'Set Device Volume',
      description: 'Set the volume of a specific Echo device (0-100).',
      inputSchema: z.object({
        serialNumber: z
          .string()
          .describe('Serial number of the Echo device'),
        volume: z
          .number()
          .min(0)
          .max(100)
          .describe('Volume level (0-100)'),
      }),
    },
    async ({ serialNumber, volume }: { serialNumber: string; volume: number }) => {
      try {
        await client.setVolume(serialNumber, volume);
        return {
          content: [
            {
              type: 'text',
              text: `Volume set to ${volume}%`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // TOOL: Get All Volumes
  // ============================================================
  server.registerTool(
    'alexa_get_volumes',
    {
      title: 'Get All Device Volumes',
      description: 'Get the current volume levels of all Echo devices.',
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const volumes = await client.getAllDeviceVolumes();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(volumes, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // TOOL: List Routines
  // ============================================================
  server.registerTool(
    'alexa_list_routines',
    {
      title: 'List Alexa Routines',
      description:
        'List all Alexa routines configured in the account. Shows routine names, triggers, and actions.',
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const routines = await client.getRoutines();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(routines, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // TOOL: Execute Routine
  // ============================================================
  server.registerTool(
    'alexa_execute_routine',
    {
      title: 'Execute Alexa Routine',
      description:
        'Execute an existing Alexa routine by providing its automation definition (from alexa_list_routines).',
      inputSchema: z.object({
        routine: z
          .any()
          .describe(
            'The full routine/automation object as returned by alexa_list_routines'
          ),
      }),
    },
    async ({ routine }: { routine: any }) => {
      try {
        await client.executeRoutine(routine);
        return {
          content: [
            {
              type: 'text',
              text: 'Routine executed successfully.',
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // TOOL: List Shopping/To-Do Lists
  // ============================================================
  server.registerTool(
    'alexa_list_lists',
    {
      title: 'List Alexa Lists',
      description:
        'Get all Alexa lists (shopping lists, to-do lists, custom lists).',
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const lists = await client.getLists();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(lists, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // TOOL: Get List Items
  // ============================================================
  server.registerTool(
    'alexa_get_list_items',
    {
      title: 'Get List Items',
      description: 'Get all items from a specific Alexa list.',
      inputSchema: z.object({
        listId: z
          .string()
          .describe(
            'The list ID (use alexa_list_lists to find it)'
          ),
      }),
    },
    async ({ listId }: { listId: string }) => {
      try {
        const items = await client.getListItems(listId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(items, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // TOOL: Add Item to List
  // ============================================================
  server.registerTool(
    'alexa_add_list_item',
    {
      title: 'Add Item to List',
      description: 'Add an item to an Alexa list (shopping, to-do, etc).',
      inputSchema: z.object({
        listId: z.string().describe('The list ID'),
        value: z.string().describe('The item text to add'),
      }),
    },
    async ({ listId, value }: { listId: string; value: string }) => {
      try {
        await client.addListItem(listId, value);
        return {
          content: [
            {
              type: 'text',
              text: `Added "${value}" to list.`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // TOOL: Do Not Disturb
  // ============================================================
  server.registerTool(
    'alexa_do_not_disturb',
    {
      title: 'Set Do Not Disturb',
      description: 'Enable or disable Do Not Disturb on a specific Echo device.',
      inputSchema: z.object({
        serialNumber: z
          .string()
          .describe('Serial number of the Echo device'),
        enabled: z
          .boolean()
          .describe('true to enable DND, false to disable'),
      }),
    },
    async ({ serialNumber, enabled }: { serialNumber: string; enabled: boolean }) => {
      try {
        await client.setDoNotDisturb(serialNumber, enabled);
        return {
          content: [
            {
              type: 'text',
              text: `Do Not Disturb ${enabled ? 'enabled' : 'disabled'}.`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // TOOL: Query Smart Home Device State
  // ============================================================
  server.registerTool(
    'alexa_query_device',
    {
      title: 'Query Smart Home Device',
      description:
        'Query the current state of one or more smart home devices (on/off, brightness, temperature, etc).',
      inputSchema: z.object({
        entityIds: z
          .array(z.string())
          .describe(
            'Array of smart home entity IDs to query (from alexa_list_smarthome_devices)'
          ),
      }),
    },
    async ({ entityIds }: { entityIds: string[] }) => {
      try {
        const result = await client.querySmarthomeDevices(entityIds);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // TOOL: Speak Text
  // ============================================================
  server.registerTool(
    'alexa_speak',
    {
      title: 'Speak Text',
      description:
        'Make Alexa speak plain text directly on a specific Echo device using native text-to-speech (no announcement chime).',
      inputSchema: z.object({
        serialNumber: z
          .string()
          .describe('Serial number of the Echo device (use alexa_list_devices to find it)'),
        text: z.string().describe('The text for Alexa to speak'),
      }),
    },
    async ({ serialNumber, text }: { serialNumber: string; text: string }) => {
      try {
        await client.speak(serialNumber, text);
        return {
          content: [
            {
              type: 'text',
              text: `Spoke: "${text}"`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // TOOL: Speak SSML
  // ============================================================
  server.registerTool(
    'alexa_speak_ssml',
    {
      title: 'Speak SSML',
      description:
        'Make Alexa speak using SSML (Speech Synthesis Markup Language) for advanced voice control.',
      inputSchema: z.object({
        serialNumber: z
          .string()
          .describe('Serial number of the Echo device'),
        ssml: z
          .string()
          .describe(
            'SSML content (e.g., "<speak>Hello <break time=\\"1s\\"/> World</speak>")'
          ),
      }),
    },
    async ({ serialNumber, ssml }: { serialNumber: string; ssml: string }) => {
      try {
        await client.speakSSML(serialNumber, ssml);
        return {
          content: [
            {
              type: 'text',
              text: 'SSML spoken successfully.',
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // TOOL: Update Smart Home Group
  // ============================================================
  server.registerTool(
    'alexa_update_group',
    {
      title: 'Update Smart Home Group',
      description:
        'Update an existing Alexa smart home group/room. Sets the name and full list of appliance IDs.',
      inputSchema: z.object({
        groupId: z
          .string()
          .describe('The group ID (from alexa_list_groups)'),
        name: z.string().describe('The group/room name'),
        applianceIds: z
          .array(z.string())
          .describe('Full list of appliance IDs to assign to this group'),
      }),
    },
    async ({
      groupId,
      name,
      applianceIds,
    }: {
      groupId: string;
      name: string;
      applianceIds: string[];
    }) => {
      try {
        await client.updateSmarthomeGroup(groupId, name, applianceIds);
        return {
          content: [
            {
              type: 'text',
              text: `Group "${name}" updated with ${applianceIds.length} devices.`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // TOOL: Create Smart Home Group
  // ============================================================
  server.registerTool(
    'alexa_create_group',
    {
      title: 'Create Smart Home Group',
      description:
        'Create a new Alexa smart home group/room with a name and optional list of appliance IDs.',
      inputSchema: z.object({
        name: z.string().describe('The group/room name'),
        applianceIds: z
          .array(z.string())
          .default([])
          .describe('List of appliance IDs to assign to this group'),
      }),
    },
    async ({ name, applianceIds }: { name: string; applianceIds: string[] }) => {
      try {
        await client.createSmarthomeGroup(name, applianceIds);
        return {
          content: [
            {
              type: 'text',
              text: `Group "${name}" created with ${applianceIds.length} devices.`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // TOOL: Delete Smart Home Group
  // ============================================================
  server.registerTool(
    'alexa_delete_group',
    {
      title: 'Delete Smart Home Group',
      description: 'Delete an Alexa smart home group/room.',
      inputSchema: z.object({
        groupId: z
          .string()
          .describe('The group ID to delete (from alexa_list_groups)'),
      }),
    },
    async ({ groupId }: { groupId: string }) => {
      try {
        await client.deleteSmarthomeGroup(groupId);
        return {
          content: [
            {
              type: 'text',
              text: 'Group deleted successfully.',
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // TOOL: Execute Smart Home Device Action (Category A)
  // ============================================================
  server.registerTool(
    'alexa_smarthome_action',
    {
      title: 'Execute Smart Home Device Action',
      description:
        'Control Alexa smart home devices directly (turn on/off, set brightness, set temperature, lock/unlock).',
      inputSchema: z.object({
        entityId: z
          .string()
          .describe('The smart home appliance/entity ID or group ID (from alexa_list_smarthome_devices)'),
        action: z
          .enum([
            'turnOn',
            'turnOff',
            'setBrightness',
            'setColor',
            'setColorTemperature',
            'setTargetTemperature',
            'setLockState',
          ])
          .describe('The action to perform'),
        value: z
          .union([z.string(), z.number()])
          .optional()
          .describe(
            'Value for the action: brightness (0-100), temperature in degrees, lock state ("LOCKED"/"UNLOCKED"), color Kelvin or name'
          ),
        entityType: z
          .enum(['APPLIANCE', 'GROUP'])
          .optional()
          .default('APPLIANCE')
          .describe('Entity type: "APPLIANCE" (individual device) or "GROUP" (smart home group)'),
      }),
    },
    async ({
      entityId,
      action,
      value,
      entityType,
    }: {
      entityId: string;
      action: string;
      value?: string | number;
      entityType?: 'APPLIANCE' | 'GROUP';
    }) => {
      try {
        let params: Record<string, any> = { action };
        if (action === 'setBrightness') {
          params.brightness = Number(value);
        } else if (action === 'setTargetTemperature') {
          params.targetTemperature = { value: Number(value) };
        } else if (action === 'setLockState') {
          params.lockState = String(value || 'LOCKED').toUpperCase();
        } else if (action === 'setColorTemperature') {
          params.colorTemperatureInKelvin = Number(value);
        } else if (action === 'setColor') {
          params.color = { name: String(value) };
        }

        const res = await client.executeSmarthomeDeviceAction(
          entityId,
          params,
          entityType || 'APPLIANCE'
        );
        return {
          content: [
            {
              type: 'text',
              text: `Smart home action "${action}" executed on ${entityId}: ${JSON.stringify(res, null, 2)}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // TOOL: Play Music (Category B)
  // ============================================================
  server.registerTool(
    'alexa_play_music',
    {
      title: 'Play Music via Streaming Provider',
      description:
        'Search and stream music on an Echo device from Amazon Music, Spotify, Apple Music, TuneIn, iHeartRadio, or Deezer.',
      inputSchema: z.object({
        serialNumber: z
          .string()
          .describe('Serial number of the Echo device (use alexa_list_devices to find it)'),
        searchPhrase: z
          .string()
          .describe('Song, artist, album, genre, or playlist to play'),
        provider: z
          .enum([
            'AMAZON_MUSIC',
            'SPOTIFY',
            'APPLE_MUSIC',
            'TUNEIN',
            'I_HEART_RADIO',
            'DEEZER',
          ])
          .optional()
          .default('AMAZON_MUSIC')
          .describe('Music service provider (default: AMAZON_MUSIC)'),
      }),
    },
    async ({
      serialNumber,
      searchPhrase,
      provider,
    }: {
      serialNumber: string;
      searchPhrase: string;
      provider?: string;
    }) => {
      try {
        await client.playMusic(serialNumber, searchPhrase, provider || 'AMAZON_MUSIC');
        return {
          content: [
            {
              type: 'text',
              text: `Playing "${searchPhrase}" via ${provider || 'AMAZON_MUSIC'} on ${serialNumber}.`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // TOOL: Play Audible (Category B)
  // ============================================================
  server.registerTool(
    'alexa_play_audible',
    {
      title: 'Play Audiobook via Audible',
      description: 'Play an audiobook from Audible on an Echo device.',
      inputSchema: z.object({
        serialNumber: z
          .string()
          .describe('Serial number of the Echo device (use alexa_list_devices to find it)'),
        searchPhrase: z.string().describe('Audiobook title or author name'),
      }),
    },
    async ({
      serialNumber,
      searchPhrase,
    }: {
      serialNumber: string;
      searchPhrase: string;
    }) => {
      try {
        await client.playAudible(serialNumber, searchPhrase);
        return {
          content: [
            {
              type: 'text',
              text: `Playing Audible audiobook "${searchPhrase}" on ${serialNumber}.`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // TOOL: Media Control (Category B)
  // ============================================================
  server.registerTool(
    'alexa_media_control',
    {
      title: 'Control Media Playback',
      description:
        'Control media playback (stop, pause, play, next, previous) on a specific Echo or all devices.',
      inputSchema: z.object({
        serialNumber: z
          .string()
          .describe(
            'Serial number of the Echo device (use alexa_list_devices to find it), or "all" to stop all'
          ),
        action: z
          .enum(['stop', 'pause', 'play', 'next', 'previous'])
          .describe('Media action to execute'),
      }),
    },
    async ({
      serialNumber,
      action,
    }: {
      serialNumber: string;
      action: 'stop' | 'pause' | 'play' | 'next' | 'previous';
    }) => {
      try {
        await client.mediaControl(serialNumber, action);
        return {
          content: [
            {
              type: 'text',
              text: `Media action "${action}" sent to ${serialNumber}.`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // TOOL: Set Equalizer (Category B)
  // ============================================================
  server.registerTool(
    'alexa_set_equalizer',
    {
      title: 'Set Device Equalizer',
      description:
        'Adjust bass, midrange, and treble levels on an Echo speaker (-6 to +6 dB).',
      inputSchema: z.object({
        serialNumber: z
          .string()
          .describe('Serial number of the Echo device (use alexa_list_devices to find it)'),
        bass: z.number().min(-6).max(6).describe('Bass level (-6 to +6)'),
        midrange: z.number().min(-6).max(6).describe('Midrange level (-6 to +6)'),
        treble: z.number().min(-6).max(6).describe('Treble level (-6 to +6)'),
      }),
    },
    async ({
      serialNumber,
      bass,
      midrange,
      treble,
    }: {
      serialNumber: string;
      bass: number;
      midrange: number;
      treble: number;
    }) => {
      try {
        await client.setEqualizer(serialNumber, bass, midrange, treble);
        return {
          content: [
            {
              type: 'text',
              text: `Equalizer on ${serialNumber} set: Bass=${bass}, Mid=${midrange}, Treble=${treble}.`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // TOOL: Set Reminder (Category C)
  // ============================================================
  server.registerTool(
    'alexa_set_reminder',
    {
      title: 'Set Spoken Reminder',
      description: 'Schedule a spoken reminder on an Echo device at a specific time.',
      inputSchema: z.object({
        serialNumber: z
          .string()
          .describe('Serial number of the Echo device (use alexa_list_devices to find it)'),
        text: z.string().describe('The reminder message for Alexa to speak'),
        timestamp: z
          .union([z.string(), z.number()])
          .describe(
            'Target time as ISO 8601 string (e.g. "2026-09-12T18:00:00") or epoch milliseconds'
          ),
      }),
    },
    async ({
      serialNumber,
      text,
      timestamp,
    }: {
      serialNumber: string;
      text: string;
      timestamp: string | number;
    }) => {
      try {
        await client.setReminder(serialNumber, text, timestamp);
        return {
          content: [
            {
              type: 'text',
              text: `Reminder "${text}" scheduled on ${serialNumber} for ${timestamp}.`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // TOOL: Get Notifications (Category C)
  // ============================================================
  server.registerTool(
    'alexa_get_notifications',
    {
      title: 'Get Alarms, Timers & Reminders',
      description:
        'List active alarms, timers, and reminders across all Echo devices in the account.',
      inputSchema: z.object({
        type: z
          .enum(['all', 'Alarm', 'Timer', 'Reminder'])
          .optional()
          .default('all')
          .describe('Filter notifications by type ("all", "Alarm", "Timer", "Reminder")'),
      }),
    },
    async ({ type }: { type?: string }) => {
      try {
        const res = await client.getNotifications();
        let notifications = res?.notifications || res || [];
        if (Array.isArray(notifications) && type && type !== 'all') {
          notifications = notifications.filter((n: any) => n.type === type);
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(notifications, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // TOOL: Set Alarm Volume (Category C)
  // ============================================================
  server.registerTool(
    'alexa_set_alarm_volume',
    {
      title: 'Set Alarm & Notification Volume',
      description:
        'Adjust alarm and notification volume level independently from media/music volume.',
      inputSchema: z.object({
        serialNumber: z
          .string()
          .describe('Serial number of the Echo device (use alexa_list_devices to find it)'),
        volume: z
          .number()
          .min(0)
          .max(100)
          .describe('Alarm volume percentage (0 to 100)'),
      }),
    },
    async ({ serialNumber, volume }: { serialNumber: string; volume: number }) => {
      try {
        await client.setAlarmVolume(serialNumber, volume);
        return {
          content: [
            {
              type: 'text',
              text: `Alarm volume for ${serialNumber} set to ${volume}%.`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // TOOL: Play Sound Effect (Category D)
  // ============================================================
  server.registerTool(
    'alexa_play_sound',
    {
      title: 'Play Built-in Sound Effect',
      description:
        'Play a built-in sound effect or chime on an Echo device (e.g. bells, doorbells, boings, applause, buzzers).',
      inputSchema: z.object({
        serialNumber: z
          .string()
          .describe('Serial number of the Echo device (use alexa_list_devices to find it)'),
        soundId: z
          .string()
          .describe(
            'Sound identifier (e.g. "amzn_sfx_doorbell_chime_01", "bell_01", "boing_01", "applause_01", "buzzer_01")'
          ),
      }),
    },
    async ({ serialNumber, soundId }: { serialNumber: string; soundId: string }) => {
      try {
        await client.playSound(serialNumber, soundId);
        return {
          content: [
            {
              type: 'text',
              text: `Sound "${soundId}" played on ${serialNumber}.`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // TOOL: Curated TTS (Category D)
  // ============================================================
  server.registerTool(
    'alexa_curated_tts',
    {
      title: 'Speak Curated Phrase',
      description:
        'Make Alexa speak a randomized built-in phrase from a curated category.',
      inputSchema: z.object({
        serialNumber: z
          .string()
          .describe('Serial number of the Echo device (use alexa_list_devices to find it)'),
        category: z
          .enum([
            'goodmorning',
            'goodnight',
            'compliments',
            'birthday',
            'goodbye',
            'confirmations',
            'iamhome',
          ])
          .describe('Curated speech category'),
      }),
    },
    async ({
      serialNumber,
      category,
    }: {
      serialNumber: string;
      category: string;
    }) => {
      try {
        await client.curatedTTS(serialNumber, category);
        return {
          content: [
            {
              type: 'text',
              text: `Curated speech (${category}) spoken on ${serialNumber}.`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // TOOL: Play Native Behavior (Category D)
  // ============================================================
  server.registerTool(
    'alexa_play_behavior',
    {
      title: 'Play Native Routine Behavior',
      description:
        'Trigger native routine behaviors like weather report, traffic update, flash briefing, jokes, fun facts, or stories.',
      inputSchema: z.object({
        serialNumber: z
          .string()
          .describe('Serial number of the Echo device (use alexa_list_devices to find it)'),
        behavior: z
          .enum([
            'weather',
            'traffic',
            'flashbriefing',
            'goodmorning',
            'funfact',
            'joke',
            'cleanup',
            'singasong',
            'tellstory',
            'calendarToday',
            'calendarTomorrow',
            'calendarNext',
          ])
          .describe('Routine behavior to trigger'),
      }),
    },
    async ({
      serialNumber,
      behavior,
    }: {
      serialNumber: string;
      behavior: string;
    }) => {
      try {
        await client.playBehavior(serialNumber, behavior);
        return {
          content: [
            {
              type: 'text',
              text: `Behavior "${behavior}" triggered on ${serialNumber}.`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // TOOL: Fire TV Control (Category E)
  // ============================================================
  server.registerTool(
    'alexa_fire_tv_control',
    {
      title: 'Control Fire TV Device',
      description:
        'Control a Fire TV or Fire TV Cube (turnOn, turnOff, pause, resume, navigateHome).',
      inputSchema: z.object({
        serialNumber: z
          .string()
          .describe(
            'Serial number of the Fire TV device (use alexa_list_devices to find it)'
          ),
        command: z
          .enum(['turnOn', 'turnOff', 'pause', 'resume', 'navigateHome'])
          .describe('Command to send to the Fire TV'),
      }),
    },
    async ({
      serialNumber,
      command,
    }: {
      serialNumber: string;
      command: 'turnOn' | 'turnOff' | 'pause' | 'resume' | 'navigateHome';
    }) => {
      try {
        await client.fireTVControl(serialNumber, command);
        return {
          content: [
            {
              type: 'text',
              text: `Fire TV command "${command}" executed on ${serialNumber}.`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // TOOL: Get Voice History Records (Category F)
  // ============================================================
  server.registerTool(
    'alexa_get_history',
    {
      title: 'Get Alexa Voice History',
      description:
        'Retrieve recent voice interaction history (what users said to Alexa, device used, timestamps).',
      inputSchema: z.object({
        limit: z
          .number()
          .optional()
          .default(10)
          .describe('Maximum number of history records to return (default: 10)'),
      }),
    },
    async ({ limit }: { limit?: number }) => {
      try {
        const records = await client.getCustomerHistory({ maxRecordSize: limit || 10 });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(records, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );
}
