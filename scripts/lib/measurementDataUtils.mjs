export const measurementMetrics = [
  { key: 'weight', tag: '6021' },
  { key: 'bodyFat', tag: '6022' },
];

export const metricByTag = new Map(measurementMetrics.map(metric => [metric.tag, metric]));

export const MAX_DAYS_PER_REQUEST = 80;

export const parseApiDate = dateString => {
  const year = dateString.slice(0, 4);
  const month = dateString.slice(4, 6);
  const day = dateString.slice(6, 8);
  return `${year}/${month}/${day}`;
};

export const createEmptyMeasurementDataSet = () => ({
  weight: [],
  bodyFat: [],
});

export const isApiDateString = value =>
  typeof value === 'string' && /^\d{14}$/.test(value);

export const hasMeasurementData = dataSet =>
  measurementMetrics.some(metric => dataSet[metric.key].length > 0);

const isValidMeasurementRecord = record =>
  record &&
  typeof record === 'object' &&
  typeof record.date === 'string' &&
  typeof record.value === 'number';

export const normalizeMeasurementSeries = series => {
  if (!Array.isArray(series)) {
    return [];
  }

  return series
    .filter(isValidMeasurementRecord)
    .sort((a, b) => a.date.localeCompare(b.date));
};

export const normalizeMeasurementDataSet = data => {
  const normalized = createEmptyMeasurementDataSet();

  if (!data || typeof data !== 'object') {
    return normalized;
  }

  for (const metric of measurementMetrics) {
    normalized[metric.key] = normalizeMeasurementSeries(data[metric.key]);
  }

  return normalized;
};

export const mergeMeasurementSeries = (baseSeries, nextSeries) => {
  const byDate = new Map();

  for (const record of baseSeries) {
    byDate.set(record.date, record);
  }

  for (const record of nextSeries) {
    byDate.set(record.date, record);
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
};

export const mergeMeasurementDataSets = (baseDataSet, nextDataSet) => ({
  weight: mergeMeasurementSeries(baseDataSet.weight, nextDataSet.weight),
  bodyFat: mergeMeasurementSeries(baseDataSet.bodyFat, nextDataSet.bodyFat),
});

export const createMeasurementDataSetFromRecords = records => {
  const result = createEmptyMeasurementDataSet();

  for (const record of [...records].reverse()) {
    const metric = metricByTag.get(record.tag);
    if (!metric) {
      continue;
    }

    result[metric.key].push({
      date: parseApiDate(record.date),
      value: Number(record.keydata),
    });
  }

  return result;
};

const parseChartDate = dateString => {
  const [year, month, day] = dateString.split('/').map(Number);
  return new Date(year, month - 1, day);
};

export const findOldestLatestMeasurementDate = dataSet => {
  const latestDates = measurementMetrics
    .map(metric => {
      const series = dataSet[metric.key];
      return series[series.length - 1]?.date;
    })
    .filter(Boolean)
    .map(parseChartDate)
    .filter(date => !Number.isNaN(date.getTime()));

  if (latestDates.length === 0) {
    return null;
  }

  return new Date(Math.min(...latestDates.map(date => date.getTime())));
};
