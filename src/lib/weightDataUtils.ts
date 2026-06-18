import moment from 'moment';
import {
  createEmptyMeasurementDataSet,
  MeasurementData,
  MeasurementDataSet,
  MeasurementKey,
  measurementMetrics,
} from './measurementData';

export const formatToApiDate = (date: moment.Moment): string => {
  return date.format('YYYYMMDDHHmmss');
};

export const maskAccessToken = (accessToken: string): string =>
  accessToken.length > 8 ? `***${accessToken.slice(-8)}` : '***';

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

export type StaticMeasurementDataFile = {
  generatedAt?: string;
  coverage?: {
    from?: string;
    to?: string;
  };
  data?: Partial<Record<MeasurementKey, unknown>>;
};

export const normalizeMeasurementDataSet = (
  data: StaticMeasurementDataFile['data']
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

export const isApiDateString = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{14}$/.test(value);

export const hasMeasurementData = (dataSet: MeasurementDataSet): boolean =>
  measurementMetrics.some(metric => dataSet[metric.key].length > 0);

export const getFirstBytesHex = (data: ArrayBuffer): string => {
  return Array.from(new Uint8Array(data).slice(0, 16))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join(' ');
};

export const buildCorsProxyUrl = (
  targetUrl: string,
  corsProxyRequestHeaderOverrides: Record<string, string>
): string => {
  const url = new URL('https://corsproxy.io/');
  url.searchParams.set('url', targetUrl);
  for (const [header, value] of Object.entries(corsProxyRequestHeaderOverrides)) {
    url.searchParams.append('reqHeaders', `${header}:${value}`);
  }
  return url.toString();
};

export const isLocalhostRuntime = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
};

export const formatRawResponsePreview = (data: unknown): string => {
  if (data instanceof ArrayBuffer) {
    return `[ArrayBuffer byteLength=${data.byteLength}, firstBytes=${getFirstBytesHex(data)}]`;
  }

  if (typeof data === 'string') {
    return data.slice(0, 2000);
  }

  try {
    return JSON.stringify(data).slice(0, 2000);
  } catch {
    return String(data).slice(0, 2000);
  }
};

export const getHeaderValue = (
  headers: { get?: (name: string) => unknown; [key: string]: unknown },
  name: string
): unknown => {
  if (typeof headers.get === 'function') {
    return headers.get(name);
  }

  return headers[name];
};

export const normalizeHeaders = (
  headers: { get?: (name: string) => unknown; [key: string]: unknown } | undefined
): Record<string, unknown> => {
  if (!headers) {
    return {};
  }

  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value !== 'function') {
      normalized[key] = value;
    }
  }

  for (const headerName of [
    'content-type',
    'content-encoding',
    'cf-ray',
    'server',
    'access-control-allow-origin',
    'access-control-allow-methods',
    'access-control-allow-headers',
  ]) {
    const value = getHeaderValue(headers, headerName);
    if (value !== undefined && value !== null) {
      normalized[headerName] = value;
    }
  }

  return normalized;
};
