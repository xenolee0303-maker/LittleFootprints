import { Solar } from 'lunar-javascript';
import type { BaziPillar, BaziResult, BaziUnavailable, ChildProfile } from '@littlefootprints/shared';

const ELEMENTS = ['金', '木', '水', '火', '土'];

/** Computes the Four Pillars (八字), five-element distribution, zodiac, star
 *  sign and lunar date from the child's birth date/time. Pure calendar math
 *  via lunar-javascript — the interpretation layer is separate. */
export function computeBazi(profile: Pick<ChildProfile, 'birthDate' | 'birthTime'>): BaziResult | BaziUnavailable {
  if (!profile.birthDate) return { available: false, reason: 'no_birth_date' };

  const [y, m, d] = profile.birthDate.split('-').map(Number);
  const [hh = 12, mm = 0] = profile.birthTime
    ? profile.birthTime.split(':').map(Number)
    : [12, 0];
  const timeKnown = Boolean(profile.birthTime);

  const solar = Solar.fromYmdHms(y, m, d, hh, mm, 0);
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
  const dayWuXing = eightChar.getDayWuXing();

  return {
    available: true,
    solarDate: profile.birthDate,
    lunarDate: `${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    zodiac: lunar.getYearShengXiao(),
    xingZuo: solar.getXingZuo(),
    pillars,
    timeKnown,
    fiveElements: ELEMENTS.map((element) => ({ element, count: counts.get(element) ?? 0 })),
    dayMaster: dayWuXing.substring(0, 1),
    dayStem,
  };
}
