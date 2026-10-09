export type WeatherThemeName = 'sun' | 'cloudy' | 'rain' | 'storm' | 'night';

export type WeatherTheme = {
  name: WeatherThemeName;
  label: string;
  background: string;
  text: string;
  mutedText: string;
  cloud: string;
  subcard: string;
  caution: string;
};

const themes: Record<WeatherThemeName, WeatherTheme> = {
  sun: {
    name: 'sun',
    label: 'แดดจัด',
    background: 'linear-gradient(135deg, #FAC775 0%, #F8D99B 55%, #F6C56D 100%)',
    text: '#412402',
    mutedText: '#704817',
    cloud: '#FFFFFF',
    subcard: 'rgba(255,255,255,.48)',
    caution: 'แดดแรง · รังสี UV สูง ควรทาครีมกันแดด สวมหมวก และดื่มน้ำบ่อย ๆ',
  },
  cloudy: {
    name: 'cloudy',
    label: 'มีเมฆ',
    background: 'linear-gradient(135deg, #B5D4F4 0%, #D9EAFB 52%, #A9CCEF 100%)',
    text: '#042C53',
    mutedText: '#315B7D',
    cloud: '#FFFFFF',
    subcard: 'rgba(255,255,255,.5)',
    caution: 'ท้องฟ้าครึ้ม · เหมาะกับกิจกรรมกลางแจ้ง แต่พกร่มพับไว้เผื่อฝนตกก็ดี',
  },
  rain: {
    name: 'rain',
    label: 'ฝนตก',
    background: 'linear-gradient(145deg, #185FA5 0%, #124B85 55%, #0C447C 100%)',
    text: '#E6F1FB',
    mutedText: '#C6DDF2',
    cloud: '#0C447C',
    subcard: 'rgba(255,255,255,.14)',
    caution: 'ควรระวัง · มีฝนตกหรือโอกาสฝนสูง ควรเตรียมอุปกรณ์กันฝนและตรวจสอบประกาศในพื้นที่',
  },
  storm: {
    name: 'storm',
    label: 'พายุฝนฟ้าคะนอง',
    background: 'linear-gradient(145deg, #3C3489 0%, #302B73 55%, #26215C 100%)',
    text: '#EEEDFE',
    mutedText: '#D5D2F3',
    cloud: '#26215C',
    subcard: 'rgba(255,255,255,.13)',
    caution: 'เตือนภัย · เสี่ยงฟ้าผ่าและลมกระโชกแรง งดกิจกรรมทางน้ำ และหลีกเลี่ยงพื้นที่โล่งแจ้ง',
  },
  night: {
    name: 'night',
    label: 'กลางคืน',
    background: 'linear-gradient(145deg, #042C53 0%, #073B69 58%, #092B50 100%)',
    text: '#E6F1FB',
    mutedText: '#C6DDF2',
    cloud: '#153E68',
    subcard: 'rgba(255,255,255,.14)',
    caution: 'อากาศเย็นสบาย · ท้องฟ้าโปร่ง เหมาะกับการเดินเล่นริมชายหาดยามค่ำ',
  },
};

type WeatherThemeInput = {
  weatherCode?: number | null;
  isDay?: number | boolean | null;
  precipitation?: number | null;
  condition?: 'clear' | 'cloudy' | 'rain' | 'thunderstorm' | string | null;
};

export function getWeatherTheme({
  weatherCode,
  isDay,
  precipitation = 0,
  condition,
}: WeatherThemeInput): WeatherTheme {
  const code = typeof weatherCode === 'number' ? weatherCode : null;
  const dayValue = typeof isDay === 'boolean' ? Number(isDay) : isDay;
  const isStorm = code !== null
    ? [95, 96, 99].includes(code)
    : condition === 'thunderstorm' || Boolean(condition && /thunder|storm/i.test(condition));
  const isRain = (precipitation ?? 0) > 0 || (code !== null
    ? (code >= 51 && code <= 67) || (code >= 80 && code <= 82)
    : condition === 'rain' || Boolean(condition && /rain|shower/i.test(condition)));

  if (isStorm) return themes.storm;
  if (isRain) return themes.rain;
  if (dayValue === 0) return themes.night;
  if (code !== null) {
    if ([0, 1].includes(code)) return themes.sun;
    if ([2, 3, 45, 48].includes(code)) return themes.cloudy;
    return themes.cloudy;
  }
  if (condition === 'clear' || condition === 'sunny' || condition === 'sun') return themes.sun;
  return themes.cloudy;
}
