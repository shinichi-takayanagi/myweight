import { access, mkdir, writeFile } from 'node:fs/promises';

const ACCESS_TOKEN = '1777887687936/aCcnps5M5hFTpJhxSIWYMv8bhelUpvjw04JnJKGw';
const MAX_DAYS_PER_REQUEST = 80;
const HEALTH_PLANET_LOOKBACK_DAYS = 45;

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

const fetchMeasurementDataSet = async () => {
  const endDate = new Date();
  let currentFrom = addDays(endDate, -HEALTH_PLANET_LOOKBACK_DAYS);
  const allData = createEmptyMeasurementDataSet();

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
  const measurementDataSet = await fetchMeasurementDataSet();

  const output = {
    generatedAt: new Date().toISOString(),
    data: measurementDataSet,
  };

  await mkdir('public', { recursive: true });
  await writeFile('public/measurement-data.json', `${JSON.stringify(output, null, 2)}\n`);

  console.log(
    `Exported measurement data: weight=${output.data.weight.length}, bodyFat=${output.data.bodyFat.length}`
  );
} catch (error) {
  try {
    await access('public/measurement-data.json');
    console.warn(`HealthPlanet export failed; using existing public/measurement-data.json. ${error}`);
  } catch {
    throw error;
  }
}
