import axios from 'axios';
import brotliPromise from 'brotli-dec-wasm';
import moment from 'moment';
import {
  createEmptyMeasurementDataSet,
  createMeasurementDataSetFromRecords,
  MeasurementData,
  MeasurementDataSet,
  measurementMetrics,
} from '../lib/measurementData';
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
  maskAccessToken,
  mergeMeasurementDataSets,
  normalizeHeaders,
  normalizeMeasurementDataSet,
  StaticMeasurementDataFile,
} from '../lib/weightDataUtils';

export let measurementFetchError: string | null = null;

const MAX_DAYS_PER_REQUEST = 80; // Maximum days per API request
const LOCAL_HEALTH_PLANET_LOOKBACK_DAYS = 45;
const GITHUB_PAGES_HEALTH_PLANET_START_DATE = '20240327000000';
const STATIC_MEASUREMENT_DATA_PATH = `${import.meta.env.BASE_URL}measurement-data.json`;
const FORM_URLENCODED_CONTENT_TYPE = 'application/x-www-form-urlencoded;charset=UTF-8';

const browserRequestHeaders: Record<string, string> = {
  Accept: 'application/json',
  'Content-Type': FORM_URLENCODED_CONTENT_TYPE,
};

const corsProxyRequestHeaderOverrides: Record<string, string> = {
  accept: 'application/json',
  'content-type': FORM_URLENCODED_CONTENT_TYPE,
  'accept-encoding': 'identity',
};

type LoadedStaticMeasurementData = {
  dataSet: MeasurementDataSet;
  coveredTo: string | null;
};

const createEmptyLoadedStaticMeasurementData = (): LoadedStaticMeasurementData => ({
  dataSet: createEmptyMeasurementDataSet(),
  coveredTo: null,
});

const loadStaticMeasurementData = async (): Promise<LoadedStaticMeasurementData> => {
  try {
    const response = await fetch(STATIC_MEASUREMENT_DATA_PATH, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      console.warn(`Static measurement data was not loaded: ${response.status}`);
      return createEmptyLoadedStaticMeasurementData();
    }

    const data = (await response.json()) as StaticMeasurementDataFile;
    const dataSet = normalizeMeasurementDataSet(data.data);
    const coveredTo = hasMeasurementData(dataSet) && isApiDateString(data.coverage?.to)
      ? data.coverage.to
      : null;
    console.log(
      `Loaded static measurement data: weight=${dataSet.weight.length}, bodyFat=${dataSet.bodyFat.length}`
    );
    return { dataSet, coveredTo };
  } catch (error) {
    console.warn('Static measurement data was not loaded:', error);
    return createEmptyLoadedStaticMeasurementData();
  }
};

type ParsedHealthPlanetResponse = {
  data: unknown;
  decodedFormat: string;
  decodedTextPreview: string;
  decodeAttempts: Array<{ format: string; ok: boolean; message?: string }>;
  firstBytesHex?: string;
  byteLength?: number;
};

const parseJsonText = (text: string): unknown => {
  return JSON.parse(text);
};

const decodeUtf8 = (data: BufferSource): string => {
  return new TextDecoder('utf-8').decode(data);
};

const decompressArrayBuffer = async (
  data: ArrayBuffer,
  format: string
): Promise<ArrayBuffer> => {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('DecompressionStream is not available in this browser.');
  }

  const stream = new Blob([data]).stream().pipeThrough(
    new DecompressionStream(format as CompressionFormat)
  );
  return new Response(stream).arrayBuffer();
};

const decompressBrotliArrayBuffer = async (data: ArrayBuffer): Promise<Uint8Array> => {
  const brotli = await brotliPromise;
  return brotli.decompress(new Uint8Array(data));
};

const parseResponseData = async (data: unknown): Promise<ParsedHealthPlanetResponse> => {
  if (typeof data !== 'string') {
    if (!(data instanceof ArrayBuffer)) {
      return {
        data,
        decodedFormat: 'native',
        decodedTextPreview: formatRawResponsePreview(data),
        decodeAttempts: [],
      };
    }

    const decodeAttempts: ParsedHealthPlanetResponse['decodeAttempts'] = [];
    const byteLength = data.byteLength;
    const firstBytesHex = getFirstBytesHex(data);

    try {
      const text = decodeUtf8(data);
      const parsedData = parseJsonText(text);
      decodeAttempts.push({ format: 'identity', ok: true });
      return {
        data: parsedData,
        decodedFormat: 'identity',
        decodedTextPreview: text.slice(0, 2000),
        decodeAttempts,
        firstBytesHex,
        byteLength,
      };
    } catch (error) {
      decodeAttempts.push({
        format: 'identity',
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    for (const format of ['gzip', 'deflate', 'deflate-raw']) {
      try {
        const decompressed = await decompressArrayBuffer(data, format);
        const text = decodeUtf8(decompressed);
        const parsedData = parseJsonText(text);
        decodeAttempts.push({ format, ok: true });
        return {
          data: parsedData,
          decodedFormat: format,
          decodedTextPreview: text.slice(0, 2000),
          decodeAttempts,
          firstBytesHex,
          byteLength,
        };
      } catch (error) {
        decodeAttempts.push({
          format,
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    try {
      const decompressed = await decompressBrotliArrayBuffer(data);
      const text = decodeUtf8(decompressed);
      const parsedData = parseJsonText(text);
      decodeAttempts.push({ format: 'br-wasm', ok: true });
      return {
        data: parsedData,
        decodedFormat: 'br-wasm',
        decodedTextPreview: text.slice(0, 2000),
        decodeAttempts,
        firstBytesHex,
        byteLength,
      };
    } catch (error) {
      decodeAttempts.push({
        format: 'br-wasm',
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    const fallbackText = decodeUtf8(data);
    return {
      data: fallbackText,
      decodedFormat: 'unparsed-binary',
      decodedTextPreview: fallbackText.slice(0, 2000),
      decodeAttempts,
      firstBytesHex,
      byteLength,
    };
  }

  try {
    return {
      data: parseJsonText(data),
      decodedFormat: 'string-json',
      decodedTextPreview: data.slice(0, 2000),
      decodeAttempts: [{ format: 'string-json', ok: true }],
    };
  } catch (error) {
    console.warn(
      'HealthPlanet response string could not be parsed as JSON:',
      error instanceof Error ? error.message : error
    );
    return {
      data,
      decodedFormat: 'string-unparsed',
      decodedTextPreview: data.slice(0, 2000),
      decodeAttempts: [{ format: 'string-json', ok: false }],
    };
  }
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

const getHealthPlanetFallbackStartDateString = (): string => {
  return isLocalhostRuntime()
    ? formatToApiDate(moment().subtract(LOCAL_HEALTH_PLANET_LOOKBACK_DAYS, 'days'))
    : GITHUB_PAGES_HEALTH_PLANET_START_DATE;
};

const getHealthPlanetStartDateString = (
  staticMeasurementData: LoadedStaticMeasurementData
): string | null => {
  if (staticMeasurementData.coveredTo) {
    const nextDate = moment(staticMeasurementData.coveredTo, 'YYYYMMDDHHmmss', true)
      .add(1, 'second');

    if (nextDate.isAfter(moment())) {
      return null;
    }

    return formatToApiDate(nextDate);
  }

  const { dataSet: staticDataSet } = staticMeasurementData;
  const latestStaticDate = findOldestLatestMeasurementDate(staticDataSet);
  const fallbackStartDateString = getHealthPlanetFallbackStartDateString();

  if (!latestStaticDate) {
    return fallbackStartDateString;
  }

  const nextDate = latestStaticDate.clone().add(1, 'day').startOf('day');
  const now = moment();

  if (nextDate.isAfter(now)) {
    return null;
  }

  return formatToApiDate(nextDate);
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
  const url = buildCorsProxyUrl(healthPlanetUrl, corsProxyRequestHeaderOverrides);

  try {
      console.error(
        '[HealthPlanet request debug]',
        JSON.stringify({
          transport: 'corsproxy.io',
          method: 'POST',
          healthPlanetUrl,
          proxyUrl: url,
          headers: browserRequestHeaders,
          corsProxyRequestHeaderOverrides,
          forbiddenBrowserHeaders: ['Accept-Encoding'],
          params: {
            access_token: maskAccessToken(accessToken),
            date: params.get('date'),
            tag: params.get('tag'),
            from: params.get('from'),
            to: params.get('to'),
          },
        })
      );
      const response = await axios.post(url, params, {
        headers: browserRequestHeaders,
        responseType: 'arraybuffer',
        transformResponse: data => data,
      });
      logHealthPlanetHeaders('[HealthPlanet headers]', response.status, response.headers);
      const parsedResponse = await parseResponseData(response.data);
      const responseData = parsedResponse.data;
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
          byteLength: parsedResponse.byteLength,
          firstBytesHex: parsedResponse.firstBytesHex,
          decodedFormat: parsedResponse.decodedFormat,
          decodedTextPreview: parsedResponse.decodedTextPreview,
          decodeAttempts: parsedResponse.decodeAttempts,
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
      if (
        parsedResponse.decodedFormat === 'unparsed-binary' ||
        parsedResponse.decodedFormat === 'string-unparsed'
      ) {
          console.error(
            '[HealthPlanet raw response]',
            formatRawResponsePreview(response.data)
          );
          throw new Error(
            `HealthPlanet response could not be decoded (format: ${parsedResponse.decodedFormat}).`
          );
      }
      const records = Array.isArray((responseData as { data?: unknown })?.data)
        ? (responseData as { data: Array<{ date: string; keydata: string; tag: string }> }).data
        : [];
      if (records.length === 0) {
          console.warn('No measurement records returned for this period:', { from, to });
          return createEmptyMeasurementDataSet();
      }

      return createMeasurementDataSetFromRecords(records);
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
              throw new Error(
                `HealthPlanet request failed with status ${error.response.status}.`
              );
          } else {
              throw new Error("Network Error: Could not connect to the server.");
          }

      }
      throw error instanceof Error
        ? error
        : new Error('Unexpected error during HealthPlanet fetch.');
  }
};

const fetchMeasurementDataSet = async (
  accessToken: string,
  staticMeasurementData: LoadedStaticMeasurementData
): Promise<MeasurementDataSet> => {
  const startDateString = getHealthPlanetStartDateString(staticMeasurementData);

  if (!startDateString) {
    console.log('Static measurement data is already up to date; skipping HealthPlanet fetch.');
    return staticMeasurementData.dataSet;
  }

  const startDate = moment(startDateString, 'YYYYMMDDHHmmss');
  const endDate = moment(); // Current date and time
  const allData = createEmptyMeasurementDataSet();

  let currentFrom = startDate.clone(); // Use clone() to avoid modifying the original startDate

  try {
    console.log(
      `HealthPlanet fetch starts at ${startDateString} (${isLocalhostRuntime() ? 'localhost' : 'production'})`
    );

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
  return mergeMeasurementDataSets(staticMeasurementData.dataSet, allData);
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

const accessToken = import.meta.env.VITE_HEALTHPLANET_ACCESS_TOKEN ?? '';
const measurementDataSet = useFixtureData
  ? createFixtureMeasurementDataSet()
  : await fetchMeasurementDataSet(accessToken, await loadStaticMeasurementData());

export default measurementDataSet;
