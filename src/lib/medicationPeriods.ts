import { MeasurementData } from './measurementData';

export type MedicationLine = {
  name: string;
  dose: string;
};

export type MedicationPeriod = {
  startDate: string;
  endDate?: string;
  dose: string;
  medications?: MedicationLine[];
  fill: string;
  labelColor: string;
};

export type VisibleMedicationPeriod = MedicationPeriod & {
  x1: string;
  x2: string;
};

export const rybelsusPeriods: MedicationPeriod[] = [
  {
    startDate: '2024/03/24',
    endDate: '2024/04/15',
    dose: '3mg',
    fill: '#fef3c7',
    labelColor: '#92400e',
  },
  {
    startDate: '2024/04/16',
    endDate: '2024/09/19',
    dose: '7mg',
    fill: '#dbeafe',
    labelColor: '#1d4ed8',
  },
  {
    startDate: '2024/09/20',
    endDate: '2025/05/10',
    dose: '14mg',
    fill: '#fee2e2',
    labelColor: '#b91c1c',
  },
  {
    startDate: '2026/05/16',
    dose: '14mg',
    medications: [
      { name: 'リベルサス', dose: '14mg' },
      { name: 'ダパグリフロジン', dose: '5mg' },
    ],
    fill: '#fee2e2',
    labelColor: '#b91c1c',
  },
];

export const getVisibleMedicationPeriods = (data: MeasurementData[]): VisibleMedicationPeriod[] => (
  rybelsusPeriods.flatMap(period => {
    const periodDates = data
      .filter(point => point.date >= period.startDate && (!period.endDate || point.date <= period.endDate))
      .map(point => point.date);

    if (periodDates.length === 0) {
      return [];
    }

    return [{
      ...period,
      x1: periodDates[0],
      x2: periodDates[periodDates.length - 1],
    }];
  })
);
