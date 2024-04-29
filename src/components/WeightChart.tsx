import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
  Brush,
} from 'recharts';
import moment from 'moment';
import weightDataList from './WeightData';

let formatXAxis = (tickItem: Date): string => {
  return moment(tickItem).format('MM/DD')
}

const WeightChart = () => (
  <div className="container">
    <LineChart
      width={700}
      height={500}
      data={weightDataList}
      margin={{top: 5, right: 5, left: 5, bottom: 5}}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="date" tickFormatter={formatXAxis} />
      <YAxis dataKey="weight" domain={[70, 'auto']} />
      <Line type="monotone" dataKey="weight" stroke="#8884d8" strokeWidth={3}/>
      <Legend verticalAlign="top" height={36}/>
      <Brush
        className="TimeLineChart-brush"
        dataKey="date"
        stroke="#8884d8"
      />
      <Tooltip />
    </LineChart>
  </div>
);

export default WeightChart;