import axios from 'axios';
import moment from 'moment';
type WeightData = {
  date: String;
  weight: number;
};

let parseDate = (dateString: string): string => {
  const year = parseInt(dateString.slice(0, 4), 10);
  const month = parseInt(dateString.slice(4, 6), 10) - 1;
  const day = parseInt(dateString.slice(6, 8), 10);
  return moment(new Date(year, month, day)).format('YYYY/MM/DD');
}
const formatToApiDate = (date: moment.Moment): string => {
  return date.format('YYYYMMDDHHmmss');
};

const TAG_WEIGHT = '6021';
const MAX_DAYS_PER_REQUEST = 80; // Maximum days per API request

const fetchInnerScanData = async (
  accessToken: string,
  from: string,
  to: string
): Promise<WeightData[]> => {
  const url = 'https://corsproxy.io/?https://www.healthplanet.jp/status/innerscan.json';
  const params = new URLSearchParams();
  params.append('access_token', accessToken);
  params.append('date', '1');
  params.append('tag', TAG_WEIGHT);
  params.append('from', from);
  params.append('to', to);

  try {
      const response = await axios.post(url, params);
      const result: WeightData[] = [];
      for (const record of response.data.data.reverse()) {
          result.push({
              date: parseDate(record.date),
              weight: Number(record.keydata),
          });
      }
      return result;
  } catch (error) {
      console.error('Error fetching inner scan data:', error);
      if (axios.isAxiosError(error)) {
          if (error.response) {
              console.error(`Status: ${error.response.status}, Data:`, error.response.data);
              if (error.response.status === 401) {
                  throw new Error("Unauthorized: Invalid access token.");
              }
          } else {
              console.error("Request failed:", error.message)
              throw new Error("Network Error: Could not connect to the server.");
          }

      }
      throw error;
  }
};

const fetchAllWeightData = async (accessToken: string): Promise<WeightData[]> => {
  const startDate = moment('20240327000000', 'YYYYMMDDHHmmss');
  const endDate = moment(); // Current date and time
  let allData: WeightData[] = [];

  let currentFrom = startDate.clone(); // Use clone() to avoid modifying the original startDate

  while (currentFrom.isBefore(endDate)) {
      // Calculate the 'to' date for this chunk (max 80 days)
      let currentTo = currentFrom.clone().add(MAX_DAYS_PER_REQUEST, 'days');

      // If currentTo goes past the overall endDate, adjust it
      if (currentTo.isAfter(endDate)) {
          currentTo = endDate.clone(); // Ensure we don't go past the end date
      }

      const fromStr = formatToApiDate(currentFrom);
      const toStr = formatToApiDate(currentTo);

      console.log(`Fetching data from ${fromStr} to ${toStr}`); // Debugging log

      const chunkData = await fetchInnerScanData(accessToken, fromStr, toStr);
      allData = allData.concat(chunkData); // Accumulate results

      // Set up the 'from' for the *next* chunk
      currentFrom = currentTo.clone().add(1, 'seconds'); // Start 1 second after the previous 'to'
  }

  return allData;
};

const accessToken = '1713215418763/lRdcV5GuHjwvuJ9LiTW4Se0oCaDNNpA6CdVRvDh2';
const weightDataList: WeightData[] = await fetchAllWeightData(accessToken)
export default weightDataList;
