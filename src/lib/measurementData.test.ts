import { describe, expect, test } from 'vitest';
import {
  createEmptyMeasurementDataSet,
  createMeasurementDataSetFromRecords,
  measurementMetrics,
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
