import { Solar } from 'lunar-javascript';
import type { BaziPillar, BaziResult, BaziUnavailable, ChildProfile } from '@littlefootprints/shared';

const ELEMENTS = ['金', '木', '水', '火', '土'];

// Major city longitudes for true-solar-time correction (Beijing time = UTC+8, 120°E).
const CITY_LONGITUDES: Record<string, number> = {
  '北京': 116.41, '上海': 121.47, '广州': 113.26, '深圳': 114.06, '成都': 104.07,
  '重庆': 106.55, '杭州': 120.16, '南京': 118.78, '武汉': 114.30, '西安': 108.94,
  '沈阳': 123.43, '哈尔滨': 126.53, '天津': 117.20, '郑州': 113.65, '长沙': 112.94,
  '昆明': 102.71, '拉萨': 91.11, '乌鲁木齐': 87.62, '兰州': 103.83, '青岛': 120.38,
  '大连': 121.62, '厦门': 118.09, '福州': 119.30, '南宁': 108.37, '贵阳': 106.63,
  '银川': 106.28, '西宁': 101.78, '海口': 110.32, '太原': 112.55, '石家庄': 114.51,
  '合肥': 117.28, '南昌': 115.89, '长春': 125.32, '呼和浩特': 111.65, '香港': 114.17,
  '澳门': 113.55, '台北': 121.52,
};

function longitudeOffsetMinutes(place: string | null | undefined): number | null {
  if (!place) return null;
  for (const [city, lon] of Object.entries(CITY_LONGITUDES)) {
    if (place.includes(city)) return Math.round((lon - 120) * 4);
  }
  return null;
}

const STEM_ELEMENTS: Record<string, string> = {
  '甲': '木', '乙': '木', '丙': '火', '丁': '火',
  '戊': '土', '己': '土', '庚': '金', '辛': '金',
  '壬': '水', '癸': '水',
};

/** Computes the Four Pillars (八字), five-element distribution, DaYun table,
 *  zodiac, star sign and lunar date from the child's birth info. Pure calendar
 *  math via lunar-javascript; true-solar-time longitude correction applied
 *  when the birth city is recognized. Interpretation is a separate layer. */
export function computeBazi(profile: Pick<ChildProfile, 'birthDate' | 'birthTime' | 'birthPlace' | 'gender'>): BaziResult | BaziUnavailable {
  if (!profile.birthDate) return { available: false, reason: 'no_birth_date' };

  const [y, m, d] = profile.birthDate.split('-').map(Number);
  const [hh = 12, mm = 0] = profile.birthTime
    ? profile.birthTime.split(':').map(Number)
    : [12, 0];
  const timeKnown = Boolean(profile.birthTime);

  // True solar time: local mean solar time differs from Beijing time by ~4 min
  // per degree of longitude from 120°E. (Equation-of-time drift ±16 min is not
  // applied — acceptable approximation for pillar determination.)
  const offsetMinutes = longitudeOffsetMinutes(profile.birthPlace);
  const corrected = new Date(y, m - 1, d, hh, mm + (offsetMinutes ?? 0));
  const trueSolarTime = offsetMinutes === null || !timeKnown
    ? null
    : `${String(corrected.getHours()).padStart(2, '0')}:${String(corrected.getMinutes()).padStart(2, '0')}`;

  const solar = Solar.fromYmdHms(
    corrected.getFullYear(),
    corrected.getMonth() + 1,
    corrected.getDate(),
    corrected.getHours(),
    corrected.getMinutes(),
    0,
  );
  const lunar = solar.getLunar();
  const eightChar = lunar.getEightChar();

  const pillars: BaziPillar[] = [
    { pillar: '年', ganZhi: eightChar.getYear(), wuXing: eightChar.getYearWuXing(), naYin: eightChar.getYearNaYin() },
    { pillar: '月', ganZhi: eightChar.getMonth(), wuXing: eightChar.getMonthWuXing(), naYin: eightChar.getMonthNaYin() },
    { pillar: '日', ganZhi: eightChar.getDay(), wuXing: eightChar.getDayWuXing(), naYin: eightChar.getDayNaYin() },
  ];
  if (timeKnown) {
    pillars.push({ pillar: '时', ganZhi: eightChar.getTime(), wuXing: eightChar.getTimeWuXing(), naYin: eightChar.getTimeNaYin() });
  }

  const counts = new Map<string, number>(ELEMENTS.map((element) => [element, 0]));
  for (const pillar of pillars) {
    for (const char of pillar.wuXing.split('')) {
      if (counts.has(char)) counts.set(char, (counts.get(char) ?? 0) + 1);
    }
  }

  const dayStem = eightChar.getDayGan();

  // DaYun (十年大运) requires gender (阳年男顺排/阴年女逆排) and a known hour
  // for accurate 起运 distance to the solar term.
  const daYun: BaziResult['daYun'] = [];
  let qiYun: string | null = null;
  if (timeKnown && profile.gender && profile.gender !== 'unspecified') {
    const yun = eightChar.getYun(profile.gender === 'male' ? 1 : 0);
    qiYun = `出生后 ${yun.getStartYear()} 年 ${yun.getStartMonth()} 个月起运`;
    const thisYear = new Date().getFullYear();
    for (const dy of yun.getDaYun()) {
      daYun.push({
        ganZhi: dy.getGanZhi(),
        startAge: dy.getStartAge(),
        endAge: dy.getEndAge(),
        startYear: dy.getStartYear(),
        endYear: dy.getEndYear(),
        current: thisYear >= dy.getStartYear() && thisYear <= dy.getEndYear(),
      });
    }
  }

  return {
    available: true,
    solarDate: profile.birthDate,
    birthPlace: profile.birthPlace ?? null,
    trueSolarTime,
    trueSolarApplied: offsetMinutes !== null && offsetMinutes !== 0 && timeKnown,
    lunarDate: `${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    zodiac: lunar.getYearShengXiao(),
    xingZuo: solar.getXingZuo(),
    pillars,
    timeKnown,
    fiveElements: ELEMENTS.map((element) => ({ element, count: counts.get(element) ?? 0 })),
    dayMaster: STEM_ELEMENTS[dayStem] ?? '',
    dayStem,
    qiYun,
    daYun,
  };
}
