import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  Tooltip,
  XAxis,
  YAxis,
  Brush,
  ResponsiveContainer,
} from 'recharts';
import measurementDataSet, { measurementFetchError } from './WeightData';
import { MeasurementKey, measurementMetrics } from '../lib/measurementData';
import { getVisibleMedicationPeriods, MedicationLine } from '../lib/medicationPeriods';

type ReferenceAreaLabelProps = {
  dose: string;
  medications?: MedicationLine[];
  color: string;
  viewBox?: {
    x?: number;
    y?: number;
    width?: number;
  };
};

const MedicationPeriodLabel = ({ dose, medications, color, viewBox }: ReferenceAreaLabelProps) => {
  if (
    !viewBox
    || typeof viewBox.x !== 'number'
    || typeof viewBox.y !== 'number'
    || typeof viewBox.width !== 'number'
  ) {
    return null;
  }

  const x = viewBox.x + viewBox.width / 2;
  const y = viewBox.y + 16;

  if (medications && medications.length > 0) {
    return (
      <text
        x={x}
        y={y}
        fill={color}
        fontSize={11}
        fontWeight={700}
        pointerEvents="none"
        textAnchor="middle"
      >
        {medications.map((med, i) => (
          <tspan key={i} x={x} dy={i === 0 ? 0 : '1.2em'}>
            {med.name}（{med.dose}）
          </tspan>
        ))}
      </text>
    );
  }

  return (
    <text
      x={x}
      y={y}
      fill={color}
      fontSize={12}
      fontWeight={700}
      pointerEvents="none"
      textAnchor="middle"
    >
      <tspan x={x}>リベルサス</tspan>
      <tspan x={x} dy="1.2em">{dose}</tspan>
    </text>
  );
};

const parseAxisBound = (input: string): number | null => {
  if (input.trim() === '') {
    return null;
  }
  const value = Number(input);
  return Number.isFinite(value) ? value : null;
};

const WeightChart = () => {
  const [selectedMetricKey, setSelectedMetricKey] = useState<MeasurementKey>('weight');
  const [yMinInput, setYMinInput] = useState('');
  const [yMaxInput, setYMaxInput] = useState('');
  const selectedMetric = useMemo(
    () => measurementMetrics.find(metric => metric.key === selectedMetricKey) ?? measurementMetrics[0],
    [selectedMetricKey]
  );
  const selectedData = useMemo(
    () => measurementDataSet[selectedMetric.key] ?? [],
    [selectedMetric.key]
  );
  const visibleMedicationPeriods = useMemo(
    () => getVisibleMedicationPeriods(selectedData),
    [selectedData]
  );
  const latestData = selectedData[selectedData.length - 1];
  const yDomain = useMemo<[number | 'auto', number | 'auto']>(() => {
    const min = parseAxisBound(yMinInput);
    const max = parseAxisBound(yMaxInput);
    if (min !== null && max !== null && min >= max) {
      return selectedMetric.domain;
    }
    return [min ?? selectedMetric.domain[0], max ?? selectedMetric.domain[1]];
  }, [yMinInput, yMaxInput, selectedMetric.domain]);

  const handleMetricChange = (key: MeasurementKey) => {
    setSelectedMetricKey(key);
    setYMinInput('');
    setYMaxInput('');
  };

  return (
    <section className="chart-panel" aria-label="HealthPlanet measurement chart">
      <div className="panel-header">
        <div>
          <p className="eyebrow">HealthPlanet Trend</p>
          <h2>{selectedMetric.label}の推移</h2>
        </div>
        <label className="metric-select">
          <span>表示データ</span>
          <select
            value={selectedMetricKey}
            onChange={event => handleMetricChange(event.target.value as MeasurementKey)}
          >
            {measurementMetrics.map(metric => (
              <option key={metric.key} value={metric.key}>
                {metric.label}
              </option>
            ))}
          </select>
        </label>
        <div className="axis-range">
          <span>縦軸レンジ（{selectedMetric.unit}）</span>
          <div className="axis-range-inputs">
            <input
              type="number"
              inputMode="decimal"
              placeholder="auto"
              aria-label="縦軸の最小値"
              value={yMinInput}
              onChange={event => setYMinInput(event.target.value)}
            />
            <span aria-hidden="true">〜</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="auto"
              aria-label="縦軸の最大値"
              value={yMaxInput}
              onChange={event => setYMaxInput(event.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="summary-row">
        <div>
          <span className="summary-label">Latest</span>
          <strong>
            {latestData ? latestData.value.toFixed(1) : '-'}
            <small>{selectedMetric.unit}</small>
          </strong>
        </div>
        <div>
          <span className="summary-label">Records</span>
          <strong>{selectedData.length}</strong>
        </div>
        <div>
          <span className="summary-label">Updated</span>
          <strong>{latestData?.date ?? '-'}</strong>
        </div>
      </div>

      <div className="chart-area">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={selectedData}
            margin={{ top: 16, right: 18, left: 8, bottom: 48 }}
          >
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 6" vertical={false} />
            {visibleMedicationPeriods.map(period => (
              <ReferenceArea
                key={`rybelsus-${period.dose}-${period.x1}-${period.x2}`}
                x1={period.x1}
                x2={period.x2}
                fill={period.fill}
                fillOpacity={0.52}
                strokeOpacity={0}
                label={<MedicationPeriodLabel dose={period.dose} medications={period.medications} color={period.labelColor} />}
              />
            ))}
            <XAxis
              dataKey="date"
              angle={-90}
              textAnchor="end"
              tick={{ fill: '#64748b', fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
              height={80}
            />
            <YAxis
              dataKey="value"
              domain={yDomain}
              allowDataOverflow
              tick={{ fill: '#64748b', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={48}
              unit={selectedMetric.unit}
            />
            <Line
              type="monotone"
              dataKey="value"
              name={`${selectedMetric.label} (${selectedMetric.unit})`}
              stroke={selectedMetric.color}
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 0, fill: selectedMetric.color }}
            />
            <Legend verticalAlign="top" height={36} iconType="circle" />
            <Tooltip
              formatter={value => [`${Number(value).toFixed(1)} ${selectedMetric.unit}`, selectedMetric.label]}
              labelFormatter={label => `${label}`}
              contentStyle={{
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                boxShadow: '0 18px 45px rgba(15, 23, 42, 0.12)',
              }}
            />
            <Brush
              className="TimeLineChart-brush"
              dataKey="date"
              stroke={selectedMetric.color}
              travellerWidth={10}
              height={28}
            />
          </LineChart>
        </ResponsiveContainer>
        {selectedData.length === 0 && (
          <div className="empty-chart" role="status">
            <strong>データを表示できませんでした</strong>
            <span>
              {measurementFetchError
                ? 'HealthPlanet の認証に失敗しました。埋め込み TOKEN が有効か確認してください。'
                : 'HealthPlanet の API レスポンスを確認してください。'}
            </span>
          </div>
        )}
      </div>
    </section>
  );
};

export default WeightChart;
