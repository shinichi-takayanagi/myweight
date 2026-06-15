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

export const MAX_DAYS_PER_REQUEST = 80;

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

export const formatToApiDate = (date: moment.Moment): string => {
  return date.format('YYYYMMDDHHmmss');
};

export const isApiDateString = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{14}$/.test(value);

export const isMeasurementKey = (key: string): key is MeasurementKey =>
  measurementMetrics.some(metric => metric.key === key);

export const normalizeMeasurementSeries = (series: unknown): MeasurementData[] => {
  if (!Array.isArray(series)) {
    return [];
  }

  return series
    .filter((item): item is MeasurementData => {
      if (!item || typeof item !== 'object') {
        return false;
      }

      const record = item as { date?: unknown; value?: unknown };
      return typeof record.date === 'string' && typeof record.value === 'number';
    })
    .sort((a, b) => a.date.localeCompare(b.date));
};

export const normalizeMeasurementDataSet = (
  data: Partial<Record<string, unknown>> | null | undefined
): MeasurementDataSet => {
  const normalized = createEmptyMeasurementDataSet();

  if (!data || typeof data !== 'object') {
    return normalized;
  }

  for (const [key, series] of Object.entries(data)) {
    if (isMeasurementKey(key)) {
      normalized[key] = normalizeMeasurementSeries(series);
    }
  }

  return normalized;
};

export const mergeMeasurementSeries = (
  baseSeries: MeasurementData[],
  nextSeries: MeasurementData[]
): MeasurementData[] => {
  const byDate = new Map<string, MeasurementData>();

  for (const record of baseSeries) {
    byDate.set(record.date, record);
  }

  for (const record of nextSeries) {
    byDate.set(record.date, record);
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
};

export const mergeMeasurementDataSets = (
  baseDataSet: MeasurementDataSet,
  nextDataSet: MeasurementDataSet
): MeasurementDataSet => ({
  weight: mergeMeasurementSeries(baseDataSet.weight, nextDataSet.weight),
  bodyFat: mergeMeasurementSeries(baseDataSet.bodyFat, nextDataSet.bodyFat),
});

export const hasMeasurementData = (dataSet: MeasurementDataSet): boolean =>
  measurementMetrics.some(metric => dataSet[metric.key].length > 0);

export const findOldestLatestMeasurementDate = (dataSet: MeasurementDataSet): moment.Moment | null => {
  const latestDates = measurementMetrics
    .map(metric => {
      const series = dataSet[metric.key];
      return series[series.length - 1]?.date;
    })
    .filter((date): date is string => Boolean(date))
    .map(date => moment(date, 'YYYY/MM/DD', true))
    .filter(date => date.isValid());

  if (latestDates.length === 0) {
    return null;
  }

  return moment.min(latestDates);
};
