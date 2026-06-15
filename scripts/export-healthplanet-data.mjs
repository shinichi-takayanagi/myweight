import { access, mkdir, readFile, writeFile } from 'node:fs/promises';

const ACCESS_TOKEN = '1777887687936/aCcnps5M5hFTpJhxSIWYMv8bhelUpvjw04JnJKGw';
const MAX_DAYS_PER_REQUEST = 80;
const HEALTH_PLANET_LOOKBACK_DAYS = 45;
const OUTPUT_PATH = 'public/measurement-data.json';
const DEFAULT_COVERAGE_FROM = '20240327000000';

const measurementMetrics = [
  { key: 'weight', tag: '6021' },
  { key: 'bodyFat', tag: '6022' },
];

const metricByTag = new Map(measurementMetrics.map(metric => [metric.tag, metric]));

const parseApiDate = dateString => {
  const year = dateString.slice(0, 4);
  const month = dateString.slice(4, 6);
  const day = dateString.slice(6, 8);
  return `${year}/${month}/${day}`;
};

const formatToApiDate = date => {
  const pad = value => `${value}`.padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const addSeconds = (date, seconds) => {
  const next = new Date(date);
  next.setSeconds(next.getSeconds() + seconds);
  return next;
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const createEmptyMeasurementDataSet = () => ({
  weight: [],
  bodyFat: [],
});

const createEmptyLoadedMeasurementData = () => ({
  dataSet: createEmptyMeasurementDataSet(),
  coverage: {
    from: null,
    to: null,
  },
});

const isApiDateString = value => typeof value === 'string' && /^\d{14}$/.test(value);

const hasMeasurementData = dataSet => measurementMetrics.some(metric => dataSet[metric.key].length > 0);

const isValidMeasurementRecord = record => (
  record &&
  typeof record === 'object' &&
  typeof record.date === 'string' &&
  typeof record.value === 'number'
);

const normalizeMeasurementSeries = series => {
  if (!Array.isArray(series)) {
    return [];
  }

  return series
    .filter(isValidMeasurementRecord)
    .sort((a, b) => a.date.localeCompare(b.date));
};

const normalizeMeasurementDataSet = data => {
  const normalized = createEmptyMeasurementDataSet();

  if (!data || typeof data !== 'object') {
    return normalized;
  }

  for (const metric of measurementMetrics) {
    normalized[metric.key] = normalizeMeasurementSeries(data[metric.key]);
  }

  return normalized;
};

const mergeMeasurementSeries = (baseSeries, nextSeries) => {
  const byDate = new Map();

  for (const record of baseSeries) {
    byDate.set(record.date, record);
  }

  for (const record of nextSeries) {
    byDate.set(record.date, record);
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
};

const mergeMeasurementDataSets = (baseDataSet, nextDataSet) => ({
  weight: mergeMeasurementSeries(baseDataSet.weight, nextDataSet.weight),
  bodyFat: mergeMeasurementSeries(baseDataSet.bodyFat, nextDataSet.bodyFat),
});

const parseChartDate = dateString => {
  const [year, month, day] = dateString.split('/').map(Number);
  return new Date(year, month - 1, day);
};

const findOldestLatestMeasurementDate = dataSet => {
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

const loadExistingMeasurementDataSet = async () => {
  try {
    const file = await readFile(OUTPUT_PATH, 'utf8');
    const parsed = JSON.parse(file);
    const dataSet = normalizeMeasurementDataSet(parsed.data);
    return {
      dataSet,
      coverage: {
        from: isApiDateString(parsed.coverage?.from) ? parsed.coverage.from : null,
        to: hasMeasurementData(dataSet) && isApiDateString(parsed.coverage?.to)
          ? parsed.coverage.to
          : null,
      },
    };
  } catch (error) {
    console.warn(`Existing measurement data was not loaded; starting fresh. ${error}`);
    return createEmptyLoadedMeasurementData();
  }
};

const getFetchStartDate = existingData => {
  if (existingData.coverage.to) {
    return addSeconds(parseApiDateTime(existingData.coverage.to), 1);
  }

  const { dataSet: existingDataSet } = existingData;
  const latestExistingDate = findOldestLatestMeasurementDate(existingDataSet);

  if (!latestExistingDate) {
    return addDays(new Date(), -HEALTH_PLANET_LOOKBACK_DAYS);
  }

  const nextDate = addDays(latestExistingDate, 1);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
};

const parseApiDateTime = value => new Date(
  Number(value.slice(0, 4)),
  Number(value.slice(4, 6)) - 1,
  Number(value.slice(6, 8)),
  Number(value.slice(8, 10)),
  Number(value.slice(10, 12)),
  Number(value.slice(12, 14))
);

const fetchInnerScanDataSet = async (from, to) => {
  const params = new URLSearchParams();
  params.append('access_token', ACCESS_TOKEN);
  params.append('date', '1');
  params.append('tag', measurementMetrics.map(metric => metric.tag).join(','));
  params.append('from', from);
  params.append('to', to);

  let response;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    response = await fetch('https://www.healthplanet.jp/status/innerscan.json', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    if (response.ok) {
      break;
    }

    if (attempt < 3) {
      await sleep(750 * attempt);
    }
  }

  if (!response?.ok) {
    throw new Error(`HealthPlanet request failed: ${response.status}`);
  }

  const data = await response.json();
  const records = Array.isArray(data.data) ? data.data : [];
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

const fetchMeasurementDataSet = async existingData => {
  const endDate = new Date();
  let currentFrom = getFetchStartDate(existingData);
  const allData = createEmptyMeasurementDataSet();

  if (currentFrom > endDate) {
    return allData;
  }

  while (currentFrom < endDate) {
    let currentTo = addDays(currentFrom, MAX_DAYS_PER_REQUEST);

    if (currentTo > endDate) {
      currentTo = new Date(endDate);
    }

    const chunkData = await fetchInnerScanDataSet(
      formatToApiDate(currentFrom),
      formatToApiDate(currentTo)
    );

    allData.weight = allData.weight.concat(chunkData.weight);
    allData.bodyFat = allData.bodyFat.concat(chunkData.bodyFat);
    currentFrom = addSeconds(currentTo, 1);
  }

  return allData;
};

try {
  const existingData = await loadExistingMeasurementDataSet();
  const fetchedDataSet = await fetchMeasurementDataSet(existingData);
  const measurementDataSet = mergeMeasurementDataSets(existingData.dataSet, fetchedDataSet);

  const output = {
    generatedAt: new Date().toISOString(),
    coverage: {
      from: existingData.coverage.from ?? DEFAULT_COVERAGE_FROM,
      to: formatToApiDate(new Date()),
    },
    data: measurementDataSet,
  };

  await mkdir('public', { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);

  console.log(
    `Exported measurement data: weight=${output.data.weight.length}, bodyFat=${output.data.bodyFat.length}`
  );
} catch (error) {
  try {
    await access(OUTPUT_PATH);
    console.error(`HealthPlanet export failed; using existing ${OUTPUT_PATH}. ${error}`);
    process.exitCode = 1;
  } catch {
    throw error;
  }
}
