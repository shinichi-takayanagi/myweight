import moment from 'moment';
import { describe, expect, test } from 'vitest';
import {
  createEmptyMeasurementDataSet,
  createMeasurementDataSetFromRecords,
  findOldestLatestMeasurementDate,
  formatToApiDate,
  hasMeasurementData,
  isApiDateString,
  isMeasurementKey,
  MAX_DAYS_PER_REQUEST,
  measurementMetrics,
  mergeMeasurementDataSets,
  mergeMeasurementSeries,
  normalizeMeasurementDataSet,
  normalizeMeasurementSeries,
  parseHealthPlanetDate,
} from './measurementData';

describe('measurement data utilities', () => {
  test('defines supported HealthPlanet measurement metrics', () => {
    expect(measurementMetrics.map(metric => [metric.key, metric.tag])).toEqual([
      ['weight', '6021'],
      ['bodyFat', '6022'],
    ]);
  });

  test('creates an empty measurement data set', () => {
    expect(createEmptyMeasurementDataSet()).toEqual({
      weight: [],
      bodyFat: [],
    });
  });

  test('formats HealthPlanet date strings for chart display', () => {
    expect(parseHealthPlanetDate('20260506123456')).toBe('2026/05/06');
  });

  test('converts HealthPlanet records into chronological chart series by metric', () => {
    expect(
      createMeasurementDataSetFromRecords([
        { date: '20260503070000', keydata: '23.4', tag: '6022' },
        { date: '20260502070000', keydata: '75.1', tag: '6021' },
        { date: '20260501070000', keydata: '75.5', tag: '6021' },
        { date: '20260501070000', keydata: '999', tag: 'unknown' },
      ])
    ).toEqual({
      weight: [
        { date: '2026/05/01', value: 75.5 },
        { date: '2026/05/02', value: 75.1 },
      ],
      bodyFat: [{ date: '2026/05/03', value: 23.4 }],
    });
  });
});

describe('MAX_DAYS_PER_REQUEST', () => {
  test('is 80', () => {
    expect(MAX_DAYS_PER_REQUEST).toBe(80);
  });
});

describe('formatToApiDate', () => {
  test('formats a moment to YYYYMMDDHHmmss', () => {
    const date = moment('2026-05-06T12:34:56');
    expect(formatToApiDate(date)).toBe('20260506123456');
  });
});

describe('isApiDateString', () => {
  test('accepts a 14-digit string', () => {
    expect(isApiDateString('20260506123456')).toBe(true);
  });

  test('rejects a shorter string', () => {
    expect(isApiDateString('2026050612')).toBe(false);
  });

  test('rejects non-string values', () => {
    expect(isApiDateString(12345678901234)).toBe(false);
    expect(isApiDateString(null)).toBe(false);
    expect(isApiDateString(undefined)).toBe(false);
  });
});

describe('isMeasurementKey', () => {
  test('accepts known keys', () => {
    expect(isMeasurementKey('weight')).toBe(true);
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
  });

  test('filters out invalid records', () => {
    expect(normalizeMeasurementSeries([
      { date: '2026/05/01', value: 75.5 },
      { date: 123, value: 75.0 },
      null,
      { date: '2026/05/02' },
      { date: '2026/05/03', value: 74.8 },
    ])).toEqual([
      { date: '2026/05/01', value: 75.5 },
      { date: '2026/05/03', value: 74.8 },
    ]);
  });

  test('sorts by date', () => {
    expect(normalizeMeasurementSeries([
      { date: '2026/05/03', value: 74.8 },
      { date: '2026/05/01', value: 75.5 },
      { date: '2026/05/02', value: 75.0 },
    ])).toEqual([
      { date: '2026/05/01', value: 75.5 },
      { date: '2026/05/02', value: 75.0 },
      { date: '2026/05/03', value: 74.8 },
    ]);
  });
});

describe('normalizeMeasurementDataSet', () => {
  test('returns empty data set for null/undefined', () => {
    expect(normalizeMeasurementDataSet(null)).toEqual({ weight: [], bodyFat: [] });
    expect(normalizeMeasurementDataSet(undefined)).toEqual({ weight: [], bodyFat: [] });
  });

  test('normalizes known keys and ignores unknown keys', () => {
    expect(normalizeMeasurementDataSet({
      weight: [{ date: '2026/05/01', value: 75.5 }],
      bodyFat: [{ date: '2026/05/01', value: 24.0 }],
      height: [{ date: '2026/05/01', value: 170 }],
    })).toEqual({
      weight: [{ date: '2026/05/01', value: 75.5 }],
      bodyFat: [{ date: '2026/05/01', value: 24.0 }],
    });
  });
});

describe('mergeMeasurementSeries', () => {
  test('merges two series by date, preferring next on conflict', () => {
    const base = [
      { date: '2026/05/01', value: 75.5 },
      { date: '2026/05/02', value: 75.0 },
    ];
    const next = [
      { date: '2026/05/02', value: 74.9 },
      { date: '2026/05/03', value: 74.8 },
    ];
    expect(mergeMeasurementSeries(base, next)).toEqual([
      { date: '2026/05/01', value: 75.5 },
      { date: '2026/05/02', value: 74.9 },
      { date: '2026/05/03', value: 74.8 },
    ]);
  });

  test('handles empty series', () => {
    const data = [{ date: '2026/05/01', value: 75.5 }];
    expect(mergeMeasurementSeries([], data)).toEqual(data);
    expect(mergeMeasurementSeries(data, [])).toEqual(data);
  });
});

describe('mergeMeasurementDataSets', () => {
  test('merges both weight and bodyFat', () => {
    const base = {
      weight: [{ date: '2026/05/01', value: 75.5 }],
      bodyFat: [{ date: '2026/05/01', value: 24.0 }],
    };
    const next = {
      weight: [{ date: '2026/05/02', value: 75.0 }],
      bodyFat: [{ date: '2026/05/02', value: 23.8 }],
    };
    expect(mergeMeasurementDataSets(base, next)).toEqual({
      weight: [
        { date: '2026/05/01', value: 75.5 },
        { date: '2026/05/02', value: 75.0 },
      ],
      bodyFat: [
        { date: '2026/05/01', value: 24.0 },
        { date: '2026/05/02', value: 23.8 },
      ],
    });
  });
});

describe('hasMeasurementData', () => {
  test('returns false for empty data set', () => {
    expect(hasMeasurementData({ weight: [], bodyFat: [] })).toBe(false);
  });

  test('returns true if weight has data', () => {
    expect(hasMeasurementData({
      weight: [{ date: '2026/05/01', value: 75.5 }],
      bodyFat: [],
    })).toBe(true);
  });

  test('returns true if bodyFat has data', () => {
    expect(hasMeasurementData({
      weight: [],
      bodyFat: [{ date: '2026/05/01', value: 24.0 }],
    })).toBe(true);
  });
});

describe('findOldestLatestMeasurementDate', () => {
  test('returns null for empty data set', () => {
    expect(findOldestLatestMeasurementDate({ weight: [], bodyFat: [] })).toBeNull();
  });

  test('returns the oldest among the latest dates of each metric', () => {
    const result = findOldestLatestMeasurementDate({
      weight: [
        { date: '2026/05/01', value: 75.5 },
        { date: '2026/05/03', value: 75.0 },
      ],
      bodyFat: [
        { date: '2026/05/01', value: 24.0 },
        { date: '2026/05/02', value: 23.8 },
      ],
    });
    expect(result).not.toBeNull();
    expect(result!.format('YYYY/MM/DD')).toBe('2026/05/02');
  });

  test('returns date from only metric with data', () => {
    const result = findOldestLatestMeasurementDate({
      weight: [{ date: '2026/05/05', value: 74.0 }],
      bodyFat: [],
    });
    expect(result).not.toBeNull();
    expect(result!.format('YYYY/MM/DD')).toBe('2026/05/05');
  });
});
