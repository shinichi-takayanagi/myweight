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
import { getVisibleMedicationPeriods } from '../lib/medicationPeriods';

type ReferenceAreaLabelProps = {
  dose: string;
  color: string;
  viewBox?: {
    x?: number;
    y?: number;
    width?: number;
  };
};

const MedicationPeriodLabel = ({ dose, color, viewBox }: ReferenceAreaLabelProps) => {
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

const WeightChart = () => {
  const [selectedMetricKey, setSelectedMetricKey] = useState<MeasurementKey>('weight');
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
            onChange={event => setSelectedMetricKey(event.target.value as MeasurementKey)}
          >
            {measurementMetrics.map(metric => (
              <option key={metric.key} value={metric.key}>
                {metric.label}
              </option>
            ))}
          </select>
        </label>
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
            margin={{ top: 16, right: 18, left: 8, bottom: 72 }}
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
                label={<MedicationPeriodLabel dose={period.dose} color={period.labelColor} />}
              />
            ))}
            <XAxis
              dataKey="date"
              angle={-45}
              textAnchor="end"
              tick={{ fill: '#64748b', fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
            />
            <YAxis
              dataKey="value"
              domain={selectedMetric.domain}
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
              y={392}
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
