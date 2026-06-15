import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  createEmptyMeasurementDataSet,
  createMeasurementDataSetFromRecords,
  findOldestLatestMeasurementDate,
  hasMeasurementData,
  isApiDateString,
  MAX_DAYS_PER_REQUEST,
  measurementMetrics,
  mergeMeasurementDataSets,
  normalizeMeasurementDataSet,
} from './lib/measurementDataUtils.mjs';

const ACCESS_TOKEN = '1777887687936/aCcnps5M5hFTpJhxSIWYMv8bhelUpvjw04JnJKGw';
const HEALTH_PLANET_LOOKBACK_DAYS = 45;
const OUTPUT_PATH = 'public/measurement-data.json';
const DEFAULT_COVERAGE_FROM = '20240327000000';

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

const createEmptyLoadedMeasurementData = () => ({
  dataSet: createEmptyMeasurementDataSet(),
  coverage: {
    from: null,
    to: null,
  },
});

const parseApiDateTime = value => new Date(
  Number(value.slice(0, 4)),
  Number(value.slice(4, 6)) - 1,
  Number(value.slice(6, 8)),
  Number(value.slice(8, 10)),
  Number(value.slice(10, 12)),
  Number(value.slice(12, 14))
);

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
  return createMeasurementDataSetFromRecords(records);
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
    console.warn(`HealthPlanet export failed; using existing ${OUTPUT_PATH}. ${error}`);
  } catch {
    throw error;
  }
}
