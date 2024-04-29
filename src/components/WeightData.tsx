import axios from 'axios';
type WeightData = {
  date: Date;
  weight: number;
};

let parseDate = (dateString: string): Date => {
  const year = parseInt(dateString.slice(0, 4), 10);
  const month = parseInt(dateString.slice(4, 6), 10) - 1;
  const day = parseInt(dateString.slice(6, 8), 10);

  return new Date(year, month, day);
}

const fetchInnerScanData = async (
  accessToken: string,
  date: string,
  tag: string
): Promise<WeightData[]> => {
  const url = 'https://corsproxy.io/?https://www.healthplanet.jp/status/innerscan.json';
  const params = new URLSearchParams();
  params.append('access_token', accessToken);
  params.append('date', date);
  params.append('tag', tag);
  try {
    let result: WeightData[] = [];
    const response = await axios.post(url, params);
    for (const record of response.data["data"].reverse()) {
      result.push({
        date: parseDate(record["date"]), 
        weight: Number(record["keydata"])
      }); 
    }
    return result;
  } catch (error) {
    console.error('Error fetching inner scan data:', error);
    throw error;
  }
};

// Why here?: => Because it is not significantly important information
const accessToken = '1713215418763/lRdcV5GuHjwvuJ9LiTW4Se0oCaDNNpA6CdVRvDh2';
const date = '1';
const tag = '6021';
const weightDataList: WeightData[] = await fetchInnerScanData(accessToken, date, tag)
export default weightDataList;
