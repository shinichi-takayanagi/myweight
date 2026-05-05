import moment from 'moment';

export type MeasurementKey = 'weight' | 'bodyFat';

export type MeasurementMetric = {
  key: MeasurementKey;
  label: string;
  shortLabel: string;
  tag: string;
  unit: string;
  color: string;
  domain: [number | 'auto', number | 'auto'];
};

export type MeasurementData = {
  date: string;
  value: number;
};

export type MeasurementDataSet = Record<MeasurementKey, MeasurementData[]>;

export type HealthPlanetMeasurementRecord = {
  date: string;
  keydata: string;
  tag: string;
};

export const measurementMetrics: MeasurementMetric[] = [
  {
    key: 'weight',
    label: '体重',
    shortLabel: 'Weight',
    tag: '6021',
    unit: 'kg',
    color: '#2563eb',
    domain: [70, 'auto'],
  },
  {
    key: 'bodyFat',
    label: '体脂肪率',
    shortLabel: 'Body Fat',
    tag: '6022',
    unit: '%',
    color: '#0f766e',
    domain: ['auto', 'auto'],
  },
];

const metricByTag = new Map(measurementMetrics.map(metric => [metric.tag, metric]));

export const createEmptyMeasurementDataSet = (): MeasurementDataSet => ({
  weight: [],
  bodyFat: [],
});

export const parseHealthPlanetDate = (dateString: string): string => {
  const year = parseInt(dateString.slice(0, 4), 10);
  const month = parseInt(dateString.slice(4, 6), 10) - 1;
  const day = parseInt(dateString.slice(6, 8), 10);
  return moment(new Date(year, month, day)).format('YYYY/MM/DD');
};

export const createMeasurementDataSetFromRecords = (
  records: HealthPlanetMeasurementRecord[]
): MeasurementDataSet => {
  const result = createEmptyMeasurementDataSet();

  for (const record of [...records].reverse()) {
    const metric = metricByTag.get(record.tag);
    if (!metric) {
      continue;
    }

    result[metric.key].push({
      date: parseHealthPlanetDate(record.date),
      value: Number(record.keydata),
    });
  }

  return result;
};
