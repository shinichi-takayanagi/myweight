import { describe, expect, test } from 'vitest';
import { getVisibleMedicationPeriods, rybelsusPeriods } from './medicationPeriods';
import { MeasurementData } from './measurementData';

describe('rybelsusPeriods', () => {
  test('defines four medication periods', () => {
    expect(rybelsusPeriods).toHaveLength(4);
  });

  test('first period is 3mg starting 2024/03/24', () => {
    expect(rybelsusPeriods[0]).toMatchObject({
      startDate: '2024/03/24',
      endDate: '2024/04/15',
      dose: '3mg',
    });
  });

  test('last period has no endDate', () => {
    expect(rybelsusPeriods[3].endDate).toBeUndefined();
  });
});

describe('getVisibleMedicationPeriods', () => {
  test('returns empty array when no data overlaps any period', () => {
    const data: MeasurementData[] = [
      { date: '2020/01/01', value: 75 },
      { date: '2020/01/02', value: 76 },
    ];
    expect(getVisibleMedicationPeriods(data)).toEqual([]);
  });

  test('returns empty array for empty data', () => {
    expect(getVisibleMedicationPeriods([])).toEqual([]);
  });

  test('returns matching period with correct x1/x2 boundaries', () => {
    const data: MeasurementData[] = [
      { date: '2024/03/25', value: 80 },
      { date: '2024/03/30', value: 79 },
      { date: '2024/04/10', value: 78 },
    ];
    const result = getVisibleMedicationPeriods(data);
    expect(result).toHaveLength(1);
    expect(result[0].dose).toBe('3mg');
    expect(result[0].x1).toBe('2024/03/25');
    expect(result[0].x2).toBe('2024/04/10');
  });

  test('returns multiple periods when data spans several', () => {
    const data: MeasurementData[] = [
      { date: '2024/03/25', value: 80 },
      { date: '2024/04/20', value: 79 },
      { date: '2024/09/25', value: 78 },
    ];
    const result = getVisibleMedicationPeriods(data);
    const doses = result.map(p => p.dose);
    expect(doses).toContain('3mg');
    expect(doses).toContain('7mg');
    expect(doses).toContain('14mg');
  });

  test('open-ended period includes all future data', () => {
    const data: MeasurementData[] = [
      { date: '2026/06/01', value: 75 },
      { date: '2026/07/01', value: 74 },
    ];
    const result = getVisibleMedicationPeriods(data);
    expect(result).toHaveLength(1);
    expect(result[0].dose).toBe('14mg');
    expect(result[0].x1).toBe('2026/06/01');
    expect(result[0].x2).toBe('2026/07/01');
  });

  test('single data point in a period sets x1 === x2', () => {
    const data: MeasurementData[] = [{ date: '2024/04/01', value: 80 }];
    const result = getVisibleMedicationPeriods(data);
    expect(result).toHaveLength(1);
    expect(result[0].x1).toBe('2024/04/01');
    expect(result[0].x2).toBe('2024/04/01');
  });
});
