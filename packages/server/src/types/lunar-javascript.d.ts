declare module 'lunar-javascript' {
  export interface EightChar {
    getYear(): string;
    getMonth(): string;
    getDay(): string;
    getTime(): string;
    getYearGan(): string;
    getYearZhi(): string;
    getYearWuXing(): string;
    getMonthWuXing(): string;
    getDayWuXing(): string;
    getTimeWuXing(): string;
    getYearNaYin(): string;
    getMonthNaYin(): string;
    getDayNaYin(): string;
    getTimeNaYin(): string;
    getDayGan(): string;
    getYun(gender: number): Yun;
  }

  export interface Yun {
    getStartYear(): number;
    getStartMonth(): number;
    getStartDay(): number;
    getDaYun(): Array<{ getGanZhi(): string; getStartAge(): number; getEndAge(): number; getStartYear(): number; getEndYear(): number }>;
  }

  export interface Lunar {
    getEightChar(): EightChar;
    getYearShengXiao(): string;
    getYearInChinese(): string;
    getMonthInChinese(): string;
    getDayInChinese(): string;
  }

  export interface Solar {
    getLunar(): Lunar;
    getXingZuo(): string;
  }

  export const Solar: {
    fromYmdHms(y: number, m: number, d: number, h: number, minute: number, s: number): Solar;
    fromYmd(y: number, m: number, d: number): Solar;
  };
}
