import axios from 'axios';
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

export let measurementFetchError: string | null = null;

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

const parseDate = (dateString: string): string => {
  const year = parseInt(dateString.slice(0, 4), 10);
  const month = parseInt(dateString.slice(4, 6), 10) - 1;
  const day = parseInt(dateString.slice(6, 8), 10);
  return moment(new Date(year, month, day)).format('YYYY/MM/DD');
}
const formatToApiDate = (date: moment.Moment): string => {
  return date.format('YYYYMMDDHHmmss');
};

const MAX_DAYS_PER_REQUEST = 80; // Maximum days per API request

const metricByTag = new Map(measurementMetrics.map(metric => [metric.tag, metric]));

const createEmptyMeasurementDataSet = (): MeasurementDataSet => ({
  weight: [],
  bodyFat: [],
});

const maskAccessToken = (accessToken: string): string =>
  accessToken.length > 8 ? `***${accessToken.slice(-8)}` : '***';

const parseResponseData = (data: unknown): unknown => {
  if (typeof data !== 'string') {
    return data;
  }

  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
};

const formatRawResponsePreview = (data: unknown): string => {
  if (typeof data === 'string') {
    return data.slice(0, 2000);
  }

  try {
    return JSON.stringify(data).slice(0, 2000);
  } catch {
    return String(data).slice(0, 2000);
  }
};

const getHeaderValue = (
  headers: { get?: (name: string) => unknown; [key: string]: unknown },
  name: string
): unknown => {
  if (typeof headers.get === 'function') {
    return headers.get(name);
  }

  return headers[name];
};

const normalizeHeaders = (
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

const logHealthPlanetHeaders = (
  label: string,
  status: number | undefined,
  headers: { get?: (name: string) => unknown; [key: string]: unknown } | undefined
): void => {
  const contentType = headers ? getHeaderValue(headers, 'content-type') : undefined;
  const contentEncoding = headers ? getHeaderValue(headers, 'content-encoding') : undefined;

  console.error(label, {
    status,
    contentType,
    contentEncoding,
    headers: normalizeHeaders(headers),
  });
};

const fetchInnerScanDataSet = async (
  accessToken: string,
  from: string,
  to: string
): Promise<MeasurementDataSet> => {
  const healthPlanetUrl = 'https://www.healthplanet.jp/status/innerscan.json';
  const params = new URLSearchParams();
  params.append('access_token', accessToken);
  params.append('date', '1');
  params.append('tag', measurementMetrics.map(metric => metric.tag).join(','));
  params.append('from', from);
  params.append('to', to);
  const url = `https://corsproxy.io/?url=${healthPlanetUrl}`;

  try {
      console.error(
        '[HealthPlanet request debug]',
        JSON.stringify({
          transport: 'corsproxy.io',
          method: 'POST',
          healthPlanetUrl,
          proxyUrl: url,
          params: {
            access_token: maskAccessToken(accessToken),
            date: params.get('date'),
            tag: params.get('tag'),
            from: params.get('from'),
            to: params.get('to'),
          },
        })
      );
      const response = await axios.post(url, params);
      logHealthPlanetHeaders('[HealthPlanet headers]', response.status, response.headers);
      const responseData = parseResponseData(response.data);
      if (
        responseData &&
        typeof responseData === 'object' &&
        'error' in responseData
      ) {
        throw new Error(`CorsProxy error: ${JSON.stringify(responseData)}`);
      }
      console.error(
        '[HealthPlanet response debug]',
        JSON.stringify({
          status: response.status,
          dataType: typeof response.data,
          hasDataArray: Array.isArray((responseData as { data?: unknown })?.data),
          dataLength: Array.isArray((responseData as { data?: unknown[] })?.data)
            ? (responseData as { data: unknown[] }).data.length
            : null,
          rawResponsePreview: formatRawResponsePreview(response.data),
          responseKeys: responseData && typeof responseData === 'object'
            ? Object.keys(responseData)
            : [],
        })
      );
      const records = Array.isArray((responseData as { data?: unknown })?.data)
        ? (responseData as { data: Array<{ date: string; keydata: string; tag: string }> }).data
        : [];
      if (records.length === 0) {
          console.error(
            '[HealthPlanet raw response]',
            formatRawResponsePreview(response.data)
          );
          console.warn('No measurement records returned:', responseData);
          return createEmptyMeasurementDataSet();
      }

      const result = createEmptyMeasurementDataSet();
      for (const record of [...records].reverse()) {
          const metric = metricByTag.get(record.tag);
          if (!metric) {
            continue;
          }

          result[metric.key].push({
              date: parseDate(record.date),
              value: Number(record.keydata),
          });
      }
      return result;
  } catch (error) {
      console.error('Error fetching measurement data:', error);
      if (axios.isAxiosError(error)) {
          console.error(
            '[HealthPlanet axios error debug]',
            JSON.stringify({
              message: error.message,
              code: error.code,
              requestUrl: error.config?.url,
              method: error.config?.method,
              status: error.response?.status,
              statusText: error.response?.statusText,
              hasResponse: Boolean(error.response),
              hasRequest: Boolean(error.request),
            })
          );
          if (error.response) {
              logHealthPlanetHeaders(
                '[HealthPlanet error headers]',
                error.response.status,
                error.response.headers
              );
              console.error(`Status: ${error.response.status}, Data:`, error.response.data);
              console.error(
                '[HealthPlanet raw response]',
                formatRawResponsePreview(error.response.data)
              );
              if (error.response.status === 401 || `${error.response.data}`.includes('Error 401')) {
                  throw new Error("HealthPlanet authentication failed. Check the embedded access token.");
              }
          } else {
              console.error("Request failed:", error.message)
              throw new Error("Network Error: Could not connect to the server.");
          }

      }
      return createEmptyMeasurementDataSet();
  }
};

const fetchMeasurementDataSet = async (accessToken: string): Promise<MeasurementDataSet> => {
  const startDate = moment('20260401090000', 'YYYYMMDDHHmmss');
  const endDate = moment(); // Current date and time
  const allData = createEmptyMeasurementDataSet();

  let currentFrom = startDate.clone(); // Use clone() to avoid modifying the original startDate

  try {
    while (currentFrom.isBefore(endDate)) {
      // Calculate the 'to' date for this chunk (max 80 days)
      let currentTo = currentFrom.clone().add(MAX_DAYS_PER_REQUEST, 'days');

      // If currentTo goes past the overall endDate, adjust it
      if (currentTo.isAfter(endDate)) {
          currentTo = endDate.clone(); // Ensure we don't go past the end date
      }

      const fromStr = formatToApiDate(currentFrom);
      const toStr = formatToApiDate(currentTo);

      console.log(`Fetching measurement data from ${fromStr} to ${toStr}`); // Debugging log

      const chunkData = await fetchInnerScanDataSet(accessToken, fromStr, toStr);
      allData.weight = allData.weight.concat(chunkData.weight);
      allData.bodyFat = allData.bodyFat.concat(chunkData.bodyFat);

      // Set up the 'from' for the *next* chunk
      currentFrom = currentTo.clone().add(1, 'seconds'); // Start 1 second after the previous 'to'
    }
  } catch (error) {
    console.error('Stopped fetching measurement data:', error);
    measurementFetchError = error instanceof Error
      ? error.message
      : 'HealthPlanet data fetch failed.';
  }
  return allData;
};

const createFixtureSeries = (values: number[]): MeasurementData[] => {
  const startDate = moment('20260327000000', 'YYYYMMDDHHmmss');
  return values.map((value, index) => ({
    date: startDate.clone().add(index * 7, 'days').format('YYYY/MM/DD'),
    value,
  }));
};

const createFixtureMeasurementDataSet = (): MeasurementDataSet => ({
  weight: createFixtureSeries([78.2, 77.9, 77.4, 76.8, 76.5, 76.1, 75.8, 75.4]),
  bodyFat: createFixtureSeries([24.6, 24.2, 23.9, 23.5, 23.1, 22.9, 22.6, 22.3]),
});

const useFixtureData =
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('fixture') === 'success';

const accessToken = '1777887687936/aCcnps5M5hFTpJhxSIWYMv8bhelUpvjw04JnJKGw';
const measurementDataSet = useFixtureData
  ? createFixtureMeasurementDataSet()
  : await fetchMeasurementDataSet(accessToken);

export default measurementDataSet;
