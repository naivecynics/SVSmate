export default Time;
/**
 * Imports the 'weekDay' type from the "types.js" module
 */
export type weekDay = import("./types.js").weekDay;
/**
 * This lets typescript resolve our custom types in the
 * generated d.ts files (jsdoc typedefs are converted to typescript types).
 * Ignore prevents the typedefs from being documented more than once.
 *
 * @ignore
 * @typedef {import("./types.js").weekDay} weekDay
 * Imports the 'weekDay' type from the "types.js" module
 */
/**
 * @classdesc
 * iCalendar Time representation (similar to JS Date object).  Fully
 * independent of system (OS) timezone / time.  Unlike JS Date, the month
 * January is 1, not zero.
 *
 * @example
 * var time = new ICAL.Time({
 *   year: 2012,
 *   month: 10,
 *   day: 11
 *   minute: 0,
 *   second: 0,
 *   isDate: false
 * });
 *
 *
 * @memberof ICAL
*/
declare class Time {
    static _dowCache: {};
    static _wnCache: {};
    /**
     * Returns the days in the given month
     *
     * @param {Number} month      The month to check
     * @param {Number} year       The year to check
     * @return {Number}           The number of days in the month
     */
    static daysInMonth(month: number, year: number): number;
    /**
     * Checks if the year is a leap year
     *
     * @param {Number} year       The year to check
     * @return {Boolean}          True, if the year is a leap year
     */
    static isLeapYear(year: number): boolean;
    /**
     * Create a new ICAL.Time from the day of year and year. The date is returned
     * in floating timezone.
     *
     * @param {Number} aDayOfYear     The day of year
     * @param {Number} aYear          The year to create the instance in
     * @return {Time}                 The created instance with the calculated date
     */
    static fromDayOfYear(aDayOfYear: number, aYear: number): Time;
    /**
     * Returns a new ICAL.Time instance from a date string, e.g 2015-01-02.
     *
     * @deprecated                Use {@link ICAL.Time.fromDateString} instead
     * @param {String} str        The string to create from
     * @return {Time}             The date/time instance
     */
    static fromStringv2(str: string): Time;
    /**
     * Returns a new ICAL.Time instance from a date string, e.g 2015-01-02.
     *
     * @param {String} aValue     The string to create from
     * @return {Time}             The date/time instance
     */
    static fromDateString(aValue: string): Time;
    /**
     * Returns a new ICAL.Time instance from a date-time string, e.g
     * 2015-01-02T03:04:05. If a property is specified, the timezone is set up
     * from the property's TZID parameter.
     *
     * @param {String} aValue         The string to create from
     * @param {Property=} prop        The property the date belongs to
     * @return {Time}                 The date/time instance
     */
    static fromDateTimeString(aValue: string, prop?: Property | undefined): Time;
    /**
     * Returns a new ICAL.Time instance from a date or date-time string,
     *
     * @param {String} aValue         The string to create from
     * @param {Property=} prop        The property the date belongs to
     * @return {Time}                 The date/time instance
     */
    static fromString(aValue: string, aProperty: any): Time;
    /**
     * Creates a new ICAL.Time instance from the given Javascript Date.
     *
     * @param {?Date} aDate             The Javascript Date to read, or null to reset
     * @param {Boolean} [useUTC=false]  If true, the UTC values of the date will be used
     */
    static fromJSDate(aDate: Date | null, useUTC?: boolean): Time;
    /**
     * Creates a new ICAL.Time instance from the the passed data object.
     *
     * @param {Object} aData            Time initialization
     * @param {Number=} aData.year      The year for this date
     * @param {Number=} aData.month     The month for this date
     * @param {Number=} aData.day       The day for this date
     * @param {Number=} aData.hour      The hour for this date
     * @param {Number=} aData.minute    The minute for this date
     * @param {Number=} aData.second    The second for this date
     * @param {Boolean=} aData.isDate   If true, the instance represents a date
     *                                    (as opposed to a date-time)
     * @param {Timezone=} aZone         Timezone this position occurs in
     */
    static fromData: (aData: {
        year?: number | undefined;
        month?: number | undefined;
        day?: number | undefined;
        hour?: number | undefined;
        minute?: number | undefined;
        second?: number | undefined;
        isDate?: boolean | undefined;
    }, aZone?: Timezone | undefined) => Time;
    /**
     * Creates a new ICAL.Time instance from the current moment.
     * The instance is “floating” - has no timezone relation.
     * To create an instance considering the time zone, call
     * ICAL.Time.fromJSDate(new Date(), true)
     * @return {Time}
     */
    static now(): Time;
    /**
     * Returns the date on which ISO week number 1 starts.
     *
     * @see Time#weekNumber
     * @param {Number} aYear                  The year to search in
     * @param {weekDay=} aWeekStart           The week start weekday, used for calculation.
     * @return {Time}                         The date on which week number 1 starts
     */
    static weekOneStarts(aYear: number, aWeekStart?: weekDay | undefined): Time;
    /**
     * Get the dominical letter for the given year. Letters range from A - G for
     * common years, and AG to GF for leap years.
     *
     * @param {Number} yr           The year to retrieve the letter for
     * @return {String}             The dominical letter.
     */
    static getDominicalLetter(yr: number): string;
    static "__#1@#epochTime": any;
    /**
     * January 1st, 1970 as an ICAL.Time.
     * @type {Time}
     * @constant
     * @instance
     */
    static get epochTime(): Time;
    static _cmp_attr(a: any, b: any, attr: any): 0 | 1 | -1;
    /**
     * The days that have passed in the year after a given month. The array has
     * two members, one being an array of passed days for non-leap years, the
     * other analog for leap years.
     * @example
     * var isLeapYear = ICAL.Time.isLeapYear(year);
     * var passedDays = ICAL.Time.daysInYearPassedMonth[isLeapYear][month];
     * @type {Array.<Array.<Number>>}
     */
    static daysInYearPassedMonth: Array<Array<number>>;
    static SUNDAY: number;
    static MONDAY: number;
    static TUESDAY: number;
    static WEDNESDAY: number;
    static THURSDAY: number;
    static FRIDAY: number;
    static SATURDAY: number;
    /**
     * The default weekday for the WKST part.
     * @constant
     * @default ICAL.Time.MONDAY
     */
    static DEFAULT_WEEK_START: number;
    /**
     * Creates a new ICAL.Time instance.
     *
     * @param {Object} data           Time initialization
     * @param {Number=} data.year     The year for this date
     * @param {Number=} data.month    The month for this date
     * @param {Number=} data.day      The day for this date
     * @param {Number=} data.hour     The hour for this date
     * @param {Number=} data.minute   The minute for this date
     * @param {Number=} data.second   The second for this date
     * @param {Boolean=} data.isDate  If true, the instance represents a date (as
     *                                  opposed to a date-time)
     * @param {Timezone} zone         timezone this position occurs in
     */
    constructor(data: {
        year?: number | undefined;
        month?: number | undefined;
        day?: number | undefined;
        hour?: number | undefined;
        minute?: number | undefined;
        second?: number | undefined;
        isDate?: boolean | undefined;
    }, zone: Timezone);
    wrappedJSObject: this;
    _time: any;
    /**
     * The class identifier.
     * @constant
     * @type {String}
     * @default "icaltime"
     */
    icalclass: string;
    _cachedUnixTime: any;
    /**
     * The type name, to be used in the jCal object. This value may change and
     * is strictly defined by the {@link ICAL.Time#isDate isDate} member.
     * @type {String}
     * @default "date-time"
     */
    get icaltype(): string;
    /**
     * The timezone for this time.
     * @type {Timezone}
     */
    zone: Timezone;
    /**
     * Internal uses to indicate that a change has been made and the next read
     * operation must attempt to normalize the value (for example changing the
     * day to 33).
     *
     * @type {Boolean}
     * @private
     */
    private _pendingNormalization;
    /**
     * Returns a clone of the time object.
     *
     * @return {Time}              The cloned object
     */
    clone(): Time;
    /**
     * Reset the time instance to epoch time
     */
    reset(): void;
    /**
     * Reset the time instance to the given date/time values.
     *
     * @param {Number} year             The year to set
     * @param {Number} month            The month to set
     * @param {Number} day              The day to set
     * @param {Number} hour             The hour to set
     * @param {Number} minute           The minute to set
     * @param {Number} second           The second to set
     * @param {Timezone} timezone       The timezone to set
     */
    resetTo(year: number, month: number, day: number, hour: number, minute: number, second: number, timezone: Timezone): void;
    /**
     * Set up the current instance from the Javascript date value.
     *
     * @param {?Date} aDate             The Javascript Date to read, or null to reset
     * @param {Boolean} [useUTC=false]  If true, the UTC values of the date will be used
     */
    fromJSDate(aDate: Date | null, useUTC?: boolean): this;
    year: number;
    month: number;
    day: any;
    hour: any;
    minute: any;
    second: any;
    /**
     * Sets up the current instance using members from the passed data object.
     *
     * @param {Object} aData            Time initialization
     * @param {Number=} aData.year      The year for this date
     * @param {Number=} aData.month     The month for this date
     * @param {Number=} aData.day       The day for this date
     * @param {Number=} aData.hour      The hour for this date
     * @param {Number=} aData.minute    The minute for this date
     * @param {Number=} aData.second    The second for this date
     * @param {Boolean=} aData.isDate   If true, the instance represents a date
     *                                    (as opposed to a date-time)
     * @param {Timezone=} aZone         Timezone this position occurs in
     */
    fromData(aData: {
        year?: number | undefined;
        month?: number | undefined;
        day?: number | undefined;
        hour?: number | undefined;
        minute?: number | undefined;
        second?: number | undefined;
        isDate?: boolean | undefined;
    }, aZone?: Timezone | undefined): this;
    isDate: boolean;
    /**
     * Calculate the day of week.
     * @param {weekDay=} aWeekStart
     *        The week start weekday, defaults to SUNDAY
     * @return {weekDay}
     */
    dayOfWeek(aWeekStart?: weekDay | undefined): weekDay;
    /**
     * Calculate the day of year.
     * @return {Number}
     */
    dayOfYear(): number;
    /**
     * Returns a copy of the current date/time, rewound to the start of the
     * week. The resulting ICAL.Time instance is of icaltype date, even if this
     * is a date-time.
     *
     * @param {weekDay=} aWeekStart
     *        The week start weekday, defaults to SUNDAY
     * @return {Time}      The start of the week (cloned)
     */
    startOfWeek(aWeekStart?: weekDay | undefined): Time;
    /**
     * Returns a copy of the current date/time, shifted to the end of the week.
     * The resulting ICAL.Time instance is of icaltype date, even if this is a
     * date-time.
     *
     * @param {weekDay=} aWeekStart
     *        The week start weekday, defaults to SUNDAY
     * @return {Time}      The end of the week (cloned)
     */
    endOfWeek(aWeekStart?: weekDay | undefined): Time;
    /**
     * Returns a copy of the current date/time, rewound to the start of the
     * month. The resulting ICAL.Time instance is of icaltype date, even if
     * this is a date-time.
     *
     * @return {Time}      The start of the month (cloned)
     */
    startOfMonth(): Time;
    /**
     * Returns a copy of the current date/time, shifted to the end of the
     * month.  The resulting ICAL.Time instance is of icaltype date, even if
     * this is a date-time.
     *
     * @return {Time}      The end of the month (cloned)
     */
    endOfMonth(): Time;
    /**
     * Returns a copy of the current date/time, rewound to the start of the
     * year. The resulting ICAL.Time instance is of icaltype date, even if
     * this is a date-time.
     *
     * @return {Time}      The start of the year (cloned)
     */
    startOfYear(): Time;
    /**
     * Returns a copy of the current date/time, shifted to the end of the
     * year.  The resulting ICAL.Time instance is of icaltype date, even if
     * this is a date-time.
     *
     * @return {Time}      The end of the year (cloned)
     */
    endOfYear(): Time;
    /**
     * First calculates the start of the week, then returns the day of year for
     * this date. If the day falls into the previous year, the day is zero or negative.
     *
     * @param {weekDay=} aFirstDayOfWeek
     *        The week start weekday, defaults to SUNDAY
     * @return {Number}     The calculated day of year
     */
    startDoyWeek(aFirstDayOfWeek?: weekDay | undefined): number;
    /**
     * Get the dominical letter for the current year. Letters range from A - G
     * for common years, and AG to GF for leap years.
     *
     * @param {Number} yr           The year to retrieve the letter for
     * @return {String}             The dominical letter.
     */
    getDominicalLetter(): string;
    /**
     * Finds the nthWeekDay relative to the current month (not day).  The
     * returned value is a day relative the month that this month belongs to so
     * 1 would indicate the first of the month and 40 would indicate a day in
     * the following month.
     *
     * @param {Number} aDayOfWeek   Day of the week see the day name constants
     * @param {Number} aPos         Nth occurrence of a given week day values
     *        of 1 and 0 both indicate the first weekday of that type. aPos may
     *        be either positive or negative
     *
     * @return {Number} numeric value indicating a day relative
     *                   to the current month of this time object
     */
    nthWeekDay(aDayOfWeek: number, aPos: number): number;
    /**
     * Checks if current time is the nth weekday, relative to the current
     * month.  Will always return false when rule resolves outside of current
     * month.
     *
     * @param {weekDay} aDayOfWeek                 Day of week to check
     * @param {Number} aPos                        Relative position
     * @return {Boolean}                           True, if it is the nth weekday
     */
    isNthWeekDay(aDayOfWeek: weekDay, aPos: number): boolean;
    /**
     * Calculates the ISO 8601 week number. The first week of a year is the
     * week that contains the first Thursday. The year can have 53 weeks, if
     * January 1st is a Friday.
     *
     * Note there are regions where the first week of the year is the one that
     * starts on January 1st, which may offset the week number. Also, if a
     * different week start is specified, this will also affect the week
     * number.
     *
     * @see Time.weekOneStarts
     * @param {weekDay} aWeekStart                  The weekday the week starts with
     * @return {Number}                             The ISO week number
     */
    weekNumber(aWeekStart: weekDay): number;
    /**
     * Adds the duration to the current time. The instance is modified in
     * place.
     *
     * @param {Duration} aDuration         The duration to add
     */
    addDuration(aDuration: Duration): void;
    /**
     * Subtract the date details (_excluding_ timezone).  Useful for finding
     * the relative difference between two time objects excluding their
     * timezone differences.
     *
     * @param {Time} aDate     The date to subtract
     * @return {Duration}      The difference as a duration
     */
    subtractDate(aDate: Time): Duration;
    /**
     * Subtract the date details, taking timezones into account.
     *
     * @param {Time} aDate  The date to subtract
     * @return {Duration}   The difference in duration
     */
    subtractDateTz(aDate: Time): Duration;
    /**
     * Compares the ICAL.Time instance with another one.
     *
     * @param {Duration} aOther        The instance to compare with
     * @return {Number}                     -1, 0 or 1 for less/equal/greater
     */
    compare(other: any): number;
    /**
     * Compares only the date part of this instance with another one.
     *
     * @param {Duration} other              The instance to compare with
     * @param {Timezone} tz                 The timezone to compare in
     * @return {Number}                     -1, 0 or 1 for less/equal/greater
     */
    compareDateOnlyTz(other: Duration, tz: Timezone): number;
    /**
     * Convert the instance into another timezone. The returned ICAL.Time
     * instance is always a copy.
     *
     * @param {Timezone} zone      The zone to convert to
     * @return {Time}              The copy, converted to the zone
     */
    convertToZone(zone: Timezone): Time;
    /**
     * Calculates the UTC offset of the current date/time in the timezone it is
     * in.
     *
     * @return {Number}     UTC offset in seconds
     */
    utcOffset(): number;
    /**
     * Returns an RFC 5545 compliant ical representation of this object.
     *
     * @return {String} ical date/date-time
     */
    toICALString(): string;
    /**
     * The string representation of this date/time, in jCal form
     * (including : and - separators).
     * @return {String}
     */
    toString(): string;
    /**
     * Converts the current instance to a Javascript date
     * @return {Date}
     */
    toJSDate(): Date;
    _normalize(): this;
    /**
     * Adjust the date/time by the given offset
     *
     * @param {Number} aExtraDays       The extra amount of days
     * @param {Number} aExtraHours      The extra amount of hours
     * @param {Number} aExtraMinutes    The extra amount of minutes
     * @param {Number} aExtraSeconds    The extra amount of seconds
     * @param {Number=} aTime           The time to adjust, defaults to the
     *                                    current instance.
     */
    adjust(aExtraDays: number, aExtraHours: number, aExtraMinutes: number, aExtraSeconds: number, aTime?: number | undefined): this;
    /**
     * Sets up the current instance from unix time, the number of seconds since
     * January 1st, 1970.
     *
     * @param {Number} seconds      The seconds to set up with
     */
    fromUnixTime(seconds: number): void;
    /**
     * Converts the current instance to seconds since January 1st 1970.
     *
     * @return {Number}         Seconds since 1970
     */
    toUnixTime(): number;
    /**
     * Converts time to into Object which can be serialized then re-created
     * using the constructor.
     *
     * @example
     * // toJSON will automatically be called
     * var json = JSON.stringify(mytime);
     *
     * var deserialized = JSON.parse(json);
     *
     * var time = new ICAL.Time(deserialized);
     *
     * @return {Object}
     */
    toJSON(): any;
}
import Timezone from "./timezone.js";
import Duration from "./duration.js";
import Property from "./property.js";
//# sourceMappingURL=time.d.ts.map