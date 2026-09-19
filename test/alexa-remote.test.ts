import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import AlexaRemote, { AlexaRemote as AlexaRemoteNamed } from '../src/alexa-remote/index.js';

describe('Vendored AlexaRemote Class & Fixes', () => {
  test('exports AlexaRemote as default and named export', () => {
    assert.strictEqual(AlexaRemote, AlexaRemoteNamed);
    const alexa = new AlexaRemote();
    assert.ok(alexa instanceof AlexaRemote);
  });

  test('defaults locale to en-US and amazonPage to amazon.com when unconfigured', () => {
    const alexa = new AlexaRemote();
    assert.strictEqual(alexa._locale, 'en-US');
    assert.strictEqual(alexa.baseUrl, 'alexa.amazon.com');
    assert.strictEqual(alexa._options.amazonPage, 'amazon.com');
  });

  test('announcement sequence command defaults title to "Alexa" instead of "ioBroker"', async () => {
    const alexa = new AlexaRemote();
    alexa.serialNumbers['TEST1234'] = {
      serialNumber: 'TEST1234',
      deviceType: 'TEST_TYPE',
      deviceOwnerCustomerId: 'CUST123',
      preferences: { locale: 'en-US' },
    };

    await new Promise<void>((resolve, reject) => {
      alexa.httpsGet = (url: string, callback: any, flags: any) => {
        try {
          assert.strictEqual(url, '/api/behaviors/preview');
          assert.strictEqual(flags.method, 'POST');
          const reqObj = JSON.parse(flags.data);
          const sequenceJson = JSON.parse(reqObj.sequenceJson);
          assert.strictEqual(sequenceJson['@type'], 'com.amazon.alexa.behaviors.model.Sequence');
          const startNode = sequenceJson.startNode;
          assert.strictEqual(startNode.type, 'AlexaAnnouncement');
          assert.strictEqual(startNode.operationPayload.content[0].display.title, 'Alexa');
          assert.strictEqual(startNode.operationPayload.content[0].locale, 'en-US');
          resolve();
        } catch (err) {
          reject(err);
        }
      };

      alexa.sendSequenceCommand('TEST1234', 'announcement', 'Hello world');
    });
  });

  test('routine media command wraps sequence in ParallelNode', async () => {
    const alexa = new AlexaRemote();
    alexa.serialNumbers['TEST1234'] = {
      serialNumber: 'TEST1234',
      deviceType: 'TEST_TYPE',
      deviceOwnerCustomerId: 'CUST123',
    };

    await new Promise<void>((resolve, reject) => {
      alexa.httpsGet = (url: string, callback: any, flags: any) => {
        if (url.includes('/api/behaviors/operation/validate')) {
          return callback(null, { result: 'VALID', operationPayload: { test: true } });
        }
        if (url.includes('/api/behaviors/preview')) {
          try {
            const reqObj = JSON.parse(flags.data);
            const seqJson = JSON.parse(reqObj.sequenceJson);
            assert.strictEqual(seqJson.startNode['@type'], 'com.amazon.alexa.behaviors.model.ParallelNode');
            assert.strictEqual(seqJson.startNode.nodesToExecute[0]['@type'], 'com.amazon.alexa.behaviors.model.OpaquePayloadOperationNode');
            resolve();
          } catch (err) {
            reject(err);
          }
        }
      };

      alexa.playMusicProvider('TEST1234', 'AMAZON_MUSIC', 'Jazz', () => {});
    });
  });

  test('getCustomerHistoryRecords queries /alexa-privacy/apd/rvh/customer-history-records with anti-csrf token', async () => {
    const alexa = new AlexaRemote();
    alexa.activityCsrfToken = 'test-token-123';
    alexa.activityCsrfTokenExpiry = Date.now() + 60000;

    await new Promise<void>((resolve, reject) => {
      alexa.httpsGet = (url: string, callback: any, flags: any) => {
        try {
          assert.ok(url.includes('/alexa-privacy/apd/rvh/customer-history-records'));
          assert.ok(url.includes('maxRecordSize=20'));
          assert.ok(url.includes('recordType=VOICE_HISTORY'));
          assert.strictEqual(flags.headers?.['anti-csrftoken-a2z'], 'test-token-123');
          resolve();
        } catch (err) {
          reject(err);
        }
      };

      alexa.getCustomerHistoryRecords({ maxRecordSize: 20 }, () => {});
    });
  });
});
