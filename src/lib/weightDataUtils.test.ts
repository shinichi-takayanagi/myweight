import { describe, expect, test } from 'vitest';
import moment from 'moment';
import {
  buildCorsProxyUrl,
  findOldestLatestMeasurementDate,
  formatRawResponsePreview,
  formatToApiDate,
  getFirstBytesHex,
  getHeaderValue,
  hasMeasurementData,
  isApiDateString,
  isLocalhostRuntime,
  isMeasurementKey,
  maskAccessToken,
  mergeMeasurementDataSets,
  mergeMeasurementSeries,
  normalizeHeaders,
  normalizeMeasurementDataSet,
  normalizeMeasurementSeries,
} from './weightDataUtils';

describe('formatToApiDate', () => {
  test('formats a moment as YYYYMMDDHHmmss', () => {
    const date = moment('2026-05-06T12:34:56');
    expect(formatToApiDate(date)).toBe('20260506123456');
  });

  test('pads single-digit month and day', () => {
    const date = moment('2026-01-03T01:02:03');
    expect(formatToApiDate(date)).toBe('20260103010203');
  });
});

describe('maskAccessToken', () => {
  test('masks long tokens keeping last 8 characters', () => {
    expect(maskAccessToken('abcdefghij123456')).toBe('***ij123456');
  });

  test('masks short tokens completely', () => {
    expect(maskAccessToken('short')).toBe('***');
  });

  test('masks exactly 8-char tokens completely', () => {
    expect(maskAccessToken('12345678')).toBe('***');
  });

  test('masks 9-char tokens keeping last 8', () => {
    expect(maskAccessToken('123456789')).toBe('***23456789');
  });
});

describe('isMeasurementKey', () => {
  test('recognises "weight"', () => {
    expect(isMeasurementKey('weight')).toBe(true);
  });

  test('recognises "bodyFat"', () => {
    expect(isMeasurementKey('bodyFat')).toBe(true);
  });

  test('rejects unknown keys', () => {
    expect(isMeasurementKey('height')).toBe(false);
    expect(isMeasurementKey('')).toBe(false);
  });
});

describe('normalizeMeasurementSeries', () => {
  test('returns empty array for non-array input', () => {
    expect(normalizeMeasurementSeries(null)).toEqual([]);
    expect(normalizeMeasurementSeries(undefined)).toEqual([]);
    expect(normalizeMeasurementSeries('string')).toEqual([]);
    expect(normalizeMeasurementSeries(42)).toEqual([]);
  });

  test('filters out invalid items', () => {
    expect(
      normalizeMeasurementSeries([
        { date: '2026/05/01', value: 75 },
        null,
        { date: 123, value: 75 },
        { date: '2026/05/02' },
        { date: '2026/05/03', value: 76 },
      ])
    ).toEqual([
      { date: '2026/05/01', value: 75 },
      { date: '2026/05/03', value: 76 },
    ]);
  });

  test('sorts by date', () => {
    expect(
      normalizeMeasurementSeries([
        { date: '2026/05/03', value: 76 },
        { date: '2026/05/01', value: 75 },
        { date: '2026/05/02', value: 74 },
      ])
    ).toEqual([
      { date: '2026/05/01', value: 75 },
      { date: '2026/05/02', value: 74 },
      { date: '2026/05/03', value: 76 },
    ]);
  });

  test('returns empty array for empty array input', () => {
    expect(normalizeMeasurementSeries([])).toEqual([]);
  });
});

describe('normalizeMeasurementDataSet', () => {
  test('returns empty data set for null/undefined', () => {
    expect(normalizeMeasurementDataSet(undefined)).toEqual({ weight: [], bodyFat: [] });
    expect(normalizeMeasurementDataSet(null as unknown as undefined)).toEqual({ weight: [], bodyFat: [] });
  });

  test('normalizes valid data', () => {
    expect(
      normalizeMeasurementDataSet({
        weight: [{ date: '2026/05/01', value: 75 }],
        bodyFat: [{ date: '2026/05/01', value: 24 }],
      })
    ).toEqual({
      weight: [{ date: '2026/05/01', value: 75 }],
      bodyFat: [{ date: '2026/05/01', value: 24 }],
    });
  });

  test('ignores unknown keys', () => {
    const result = normalizeMeasurementDataSet({
      weight: [{ date: '2026/05/01', value: 75 }],
      height: [{ date: '2026/05/01', value: 170 }],
    } as Record<string, unknown>);
    expect(result.weight).toEqual([{ date: '2026/05/01', value: 75 }]);
    expect(result.bodyFat).toEqual([]);
  });
});

describe('mergeMeasurementSeries', () => {
  test('merges two series deduplicating by date', () => {
    const base = [
      { date: '2026/05/01', value: 75 },
      { date: '2026/05/02', value: 76 },
    ];
    const next = [
      { date: '2026/05/02', value: 77 },
      { date: '2026/05/03', value: 78 },
    ];
    expect(mergeMeasurementSeries(base, next)).toEqual([
      { date: '2026/05/01', value: 75 },
      { date: '2026/05/02', value: 77 },
      { date: '2026/05/03', value: 78 },
    ]);
  });

  test('returns base when next is empty', () => {
    const base = [{ date: '2026/05/01', value: 75 }];
    expect(mergeMeasurementSeries(base, [])).toEqual(base);
  });

  test('returns next when base is empty', () => {
    const next = [{ date: '2026/05/01', value: 75 }];
    expect(mergeMeasurementSeries([], next)).toEqual(next);
  });
});

describe('mergeMeasurementDataSets', () => {
  test('merges weight and bodyFat series independently', () => {
    const base = {
      weight: [{ date: '2026/05/01', value: 75 }],
      bodyFat: [{ date: '2026/05/01', value: 24 }],
    };
    const next = {
      weight: [{ date: '2026/05/02', value: 76 }],
      bodyFat: [{ date: '2026/05/02', value: 23 }],
    };
    expect(mergeMeasurementDataSets(base, next)).toEqual({
      weight: [
        { date: '2026/05/01', value: 75 },
        { date: '2026/05/02', value: 76 },
      ],
      bodyFat: [
        { date: '2026/05/01', value: 24 },
        { date: '2026/05/02', value: 23 },
      ],
    });
  });
});

describe('findOldestLatestMeasurementDate', () => {
  test('returns null for empty data set', () => {
    expect(findOldestLatestMeasurementDate({ weight: [], bodyFat: [] })).toBeNull();
  });

  test('returns the only date when one series is empty', () => {
    const result = findOldestLatestMeasurementDate({
      weight: [{ date: '2026/05/03', value: 75 }],
      bodyFat: [],
    });
    expect(result?.format('YYYY/MM/DD')).toBe('2026/05/03');
  });

  test('returns the older of the two latest dates', () => {
    const result = findOldestLatestMeasurementDate({
      weight: [
        { date: '2026/05/01', value: 75 },
        { date: '2026/05/05', value: 76 },
      ],
      bodyFat: [
        { date: '2026/05/01', value: 24 },
        { date: '2026/05/03', value: 23 },
      ],
    });
    expect(result?.format('YYYY/MM/DD')).toBe('2026/05/03');
  });
});

describe('isApiDateString', () => {
  test('accepts 14-digit strings', () => {
    expect(isApiDateString('20260506123456')).toBe(true);
  });

  test('rejects non-14-digit strings', () => {
    expect(isApiDateString('2026050612345')).toBe(false);
    expect(isApiDateString('202605061234567')).toBe(false);
    expect(isApiDateString('')).toBe(false);
  });

  test('rejects non-string values', () => {
    expect(isApiDateString(12345678901234)).toBe(false);
    expect(isApiDateString(null)).toBe(false);
    expect(isApiDateString(undefined)).toBe(false);
  });
});

describe('hasMeasurementData', () => {
  test('returns false for empty data set', () => {
    expect(hasMeasurementData({ weight: [], bodyFat: [] })).toBe(false);
  });

  test('returns true when weight has data', () => {
    expect(
      hasMeasurementData({
        weight: [{ date: '2026/05/01', value: 75 }],
        bodyFat: [],
      })
    ).toBe(true);
  });

  test('returns true when bodyFat has data', () => {
    expect(
      hasMeasurementData({
        weight: [],
        bodyFat: [{ date: '2026/05/01', value: 24 }],
      })
    ).toBe(true);
  });
});

describe('getFirstBytesHex', () => {
  test('formats first bytes as hex string', () => {
    const buffer = new Uint8Array([0x7b, 0x22, 0x64, 0x61]).buffer;
    expect(getFirstBytesHex(buffer)).toBe('7b 22 64 61');
  });

  test('truncates to 16 bytes', () => {
    const bytes = new Uint8Array(20);
    bytes.fill(0xff);
    const hex = getFirstBytesHex(bytes.buffer);
    expect(hex.split(' ')).toHaveLength(16);
  });

  test('handles empty buffer', () => {
    expect(getFirstBytesHex(new ArrayBuffer(0))).toBe('');
  });
});

describe('buildCorsProxyUrl', () => {
  test('builds URL with target and header overrides', () => {
    const result = buildCorsProxyUrl('https://example.com/api', {
      accept: 'application/json',
      'content-type': 'text/plain',
    });
    expect(result).toContain('url=https');
    expect(result).toContain('example.com');
    expect(result).toContain('reqHeaders=accept');
    expect(result).toContain('reqHeaders=content-type');
  });

  test('encodes target URL as query parameter', () => {
    const result = buildCorsProxyUrl('https://www.healthplanet.jp/status/innerscan.json', {});
    const url = new URL(result);
    expect(url.searchParams.get('url')).toBe(
      'https://www.healthplanet.jp/status/innerscan.json'
    );
  });
});

describe('isLocalhostRuntime', () => {
  test('returns false when window is undefined', () => {
    expect(isLocalhostRuntime()).toBe(false);
  });
});

describe('formatRawResponsePreview', () => {
  test('formats string input', () => {
    expect(formatRawResponsePreview('hello')).toBe('hello');
  });

  test('truncates long strings to 2000 chars', () => {
    const longStr = 'x'.repeat(3000);
    expect(formatRawResponsePreview(longStr)).toHaveLength(2000);
  });

  test('formats ArrayBuffer input', () => {
    const buffer = new Uint8Array([0x7b]).buffer;
    expect(formatRawResponsePreview(buffer)).toContain('ArrayBuffer');
    expect(formatRawResponsePreview(buffer)).toContain('byteLength=1');
  });

  test('formats object input as JSON', () => {
    expect(formatRawResponsePreview({ key: 'value' })).toBe('{"key":"value"}');
  });
});

describe('getHeaderValue', () => {
  test('uses get method when available', () => {
    const headers = {
      get: (name: string) => name === 'content-type' ? 'application/json' : undefined,
    };
    expect(getHeaderValue(headers, 'content-type')).toBe('application/json');
  });

  test('falls back to direct property access', () => {
    const headers = { 'content-type': 'text/html' };
    expect(getHeaderValue(headers, 'content-type')).toBe('text/html');
  });
});

describe('normalizeHeaders', () => {
  test('returns empty object for undefined', () => {
    expect(normalizeHeaders(undefined)).toEqual({});
  });

  test('excludes function values from entries', () => {
    const headers = {
      'content-type': 'application/json',
      get: () => null,
    };
    const result = normalizeHeaders(headers);
    expect(result['content-type']).toBe('application/json');
    expect(result.get).toBeUndefined();
  });

  test('includes well-known headers via get()', () => {
    const map = new Map<string, string>([
      ['content-type', 'application/json'],
      ['content-encoding', 'gzip'],
    ]);
    const headers = {
      get: (name: string) => map.get(name),
    };
    const result = normalizeHeaders(headers);
    expect(result['content-type']).toBe('application/json');
    expect(result['content-encoding']).toBe('gzip');
  });
});
