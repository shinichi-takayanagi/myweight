import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
  Brush,
  ResponsiveContainer,
} from 'recharts';
import weightDataList from './WeightData';

const WeightChart = () => (
  <ResponsiveContainer width={900} height={500}>
    <LineChart
      data={weightDataList}
      margin={{top: 5, right: 5, left: 5, bottom: 150}}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="date" angle={-90} textAnchor="end"/>
      <YAxis dataKey="weight" domain={[70, 'auto']} />
      <Line type="monotone" dataKey="weight" stroke="#8884d8" strokeWidth={3}/>
      <Legend verticalAlign="top" height={36}/>
      <Tooltip formatter = {value => value} />
      <Brush
        className="TimeLineChart-brush"
        dataKey="date"
        stroke="#8884d8"
        y={400}
      />
    </LineChart>
  </ResponsiveContainer>
);

export default WeightChart;