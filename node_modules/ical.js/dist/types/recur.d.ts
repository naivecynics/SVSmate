export default Recur;
/**
 * Imports the 'weekDay' type from the "types.js" module
 */
export type weekDay = import("./types.js").weekDay;
/**
 * Imports the 'frequencyValues' type from the "types.js" module
 */
export type frequencyValues = import("./types.js").frequencyValues;
/**
 * This class represents the "recur" value type, used for example by RRULE. It provides methods to
 * calculate occurrences among others.
 *
 * @memberof ICAL
 */
declare class Recur {
    /**
     * Creates a new {@link ICAL.Recur} instance from the passed string.
     *
     * @param {String} string         The string to parse
     * @return {Recur}                The created recurrence instance
     */
    static fromString(string: string): Recur;
    /**
     * Creates a new {@link ICAL.Recur} instance using members from the passed
     * data object.
     *
     * @param {Object} aData                              An object with members of the recurrence
     * @param {frequencyValues=} aData.freq               The frequency value
     * @param {Number=} aData.interval                    The INTERVAL value
     * @param {weekDay=} aData.wkst                       The week start value
     * @param {Time=} aData.until                         The end of the recurrence set
     * @param {Number=} aData.count                       The number of occurrences
     * @param {Array.<Number>=} aData.bysecond            The seconds for the BYSECOND part
     * @param {Array.<Number>=} aData.byminute            The minutes for the BYMINUTE part
     * @param {Array.<Number>=} aData.byhour              The hours for the BYHOUR part
     * @param {Array.<String>=} aData.byday               The BYDAY values
     * @param {Array.<Number>=} aData.bymonthday          The days for the BYMONTHDAY part
     * @param {Array.<Number>=} aData.byyearday           The days for the BYYEARDAY part
     * @param {Array.<Number>=} aData.byweekno            The weeks for the BYWEEKNO part
     * @param {Array.<Number>=} aData.bymonth             The month for the BYMONTH part
     * @param {Array.<Number>=} aData.bysetpos            The positionals for the BYSETPOS part
     */
    static fromData(aData: {
        freq?: frequencyValues | undefined;
        interval?: number | undefined;
        wkst?: weekDay | undefined;
        until?: Time | undefined;
        count?: number | undefined;
        bysecond?: Array<number> | undefined;
        byminute?: Array<number> | undefined;
        byhour?: Array<number> | undefined;
        byday?: Array<string> | undefined;
        bymonthday?: Array<number> | undefined;
        byyearday?: Array<number> | undefined;
        byweekno?: Array<number> | undefined;
        bymonth?: Array<number> | undefined;
        bysetpos?: Array<number> | undefined;
    }): Recur;
    /**
     * Converts a recurrence string to a data object, suitable for the fromData
     * method.
     *
     * @private
     * @param {String} string     The string to parse
     * @param {Boolean} fmtIcal   If true, the string is considered to be an
     *                              iCalendar string
     * @return {Recur}            The recurrence instance
     */
    private static _stringToData;
    /**
     * Convert an ical representation of a day (SU, MO, etc..)
     * into a numeric value of that day.
     *
     * @param {String} string     The iCalendar day name
     * @param {weekDay=} aWeekStart
     *        The week start weekday, defaults to SUNDAY
     * @return {Number}           Numeric value of given day
     */
    static icalDayToNumericDay(string: string, aWeekStart?: weekDay | undefined): number;
    /**
     * Convert a numeric day value into its ical representation (SU, MO, etc..)
     *
     * @param {Number} num        Numeric value of given day
     * @param {weekDay=} aWeekStart
     *        The week start weekday, defaults to SUNDAY
     * @return {String}           The ICAL day value, e.g SU,MO,...
     */
    static numericDayToIcalDay(num: number, aWeekStart?: weekDay | undefined): string;
    /**
     * Create a new instance of the Recur class.
     *
     * @param {Object} data                               An object with members of the recurrence
     * @param {frequencyValues=} data.freq                The frequency value
     * @param {Number=} data.interval                     The INTERVAL value
     * @param {weekDay=} data.wkst                        The week start value
     * @param {Time=} data.until                          The end of the recurrence set
     * @param {Number=} data.count                        The number of occurrences
     * @param {Array.<Number>=} data.bysecond             The seconds for the BYSECOND part
     * @param {Array.<Number>=} data.byminute             The minutes for the BYMINUTE part
     * @param {Array.<Number>=} data.byhour               The hours for the BYHOUR part
     * @param {Array.<String>=} data.byday                The BYDAY values
     * @param {Array.<Number>=} data.bymonthday           The days for the BYMONTHDAY part
     * @param {Array.<Number>=} data.byyearday            The days for the BYYEARDAY part
     * @param {Array.<Number>=} data.byweekno             The weeks for the BYWEEKNO part
     * @param {Array.<Number>=} data.bymonth              The month for the BYMONTH part
     * @param {Array.<Number>=} data.bysetpos             The positionals for the BYSETPOS part
     */
    constructor(data: {
        freq?: frequencyValues | undefined;
        interval?: number | undefined;
        wkst?: weekDay | undefined;
        until?: Time | undefined;
        count?: number | undefined;
        bysecond?: Array<number> | undefined;
        byminute?: Array<number> | undefined;
        byhour?: Array<number> | undefined;
        byday?: Array<string> | undefined;
        bymonthday?: Array<number> | undefined;
        byyearday?: Array<number> | undefined;
        byweekno?: Array<number> | undefined;
        bymonth?: Array<number> | undefined;
        bysetpos?: Array<number> | undefined;
    });
    wrappedJSObject: this;
    /**
     * An object holding the BY-parts of the recurrence rule
     * @memberof ICAL.Recur
     * @typedef {Object} byParts
     * @property {Array.<Number>=} BYSECOND            The seconds for the BYSECOND part
     * @property {Array.<Number>=} BYMINUTE            The minutes for the BYMINUTE part
     * @property {Array.<Number>=} BYHOUR              The hours for the BYHOUR part
     * @property {Array.<String>=} BYDAY               The BYDAY values
     * @property {Array.<Number>=} BYMONTHDAY          The days for the BYMONTHDAY part
     * @property {Array.<Number>=} BYYEARDAY           The days for the BYYEARDAY part
     * @property {Array.<Number>=} BYWEEKNO            The weeks for the BYWEEKNO part
     * @property {Array.<Number>=} BYMONTH             The month for the BYMONTH part
     * @property {Array.<Number>=} BYSETPOS            The positionals for the BYSETPOS part
     */
    /**
     * An object holding the BY-parts of the recurrence rule
     * @type {byParts}
     */
    parts: {
        /**
         * The seconds for the BYSECOND part
         */
        BYSECOND?: Array<number> | undefined;
        /**
         * The minutes for the BYMINUTE part
         */
        BYMINUTE?: Array<number> | undefined;
        /**
         * The hours for the BYHOUR part
         */
        BYHOUR?: Array<number> | undefined;
        /**
         * The BYDAY values
         */
        BYDAY?: Array<string> | undefined;
        /**
         * The days for the BYMONTHDAY part
         */
        BYMONTHDAY?: Array<number> | undefined;
        /**
         * The days for the BYYEARDAY part
         */
        BYYEARDAY?: Array<number> | undefined;
        /**
         * The weeks for the BYWEEKNO part
         */
        BYWEEKNO?: Array<number> | undefined;
        /**
         * The month for the BYMONTH part
         */
        BYMONTH?: Array<number> | undefined;
        /**
         * The positionals for the BYSETPOS part
         */
        BYSETPOS?: Array<number> | undefined;
    };
    /**
     * The interval value for the recurrence rule.
     * @type {Number}
     */
    interval: number;
    /**
     * The week start day
     *
     * @type {weekDay}
     * @default ICAL.Time.MONDAY
     */
    wkst: weekDay;
    /**
     * The end of the recurrence
     * @type {?Time}
     */
    until: Time | null;
    /**
     * The maximum number of occurrences
     * @type {?Number}
     */
    count: number | null;
    /**
     * The frequency value.
     * @type {frequencyValues}
     */
    freq: frequencyValues;
    /**
     * The class identifier.
     * @constant
     * @type {String}
     * @default "icalrecur"
     */
    icalclass: string;
    /**
     * The type name, to be used in the jCal object.
     * @constant
     * @type {String}
     * @default "recur"
     */
    icaltype: string;
    /**
     * Create a new iterator for this recurrence rule. The passed start date
     * must be the start date of the event, not the start of the range to
     * search in.
     *
     * @example
     * let recur = comp.getFirstPropertyValue('rrule');
     * let dtstart = comp.getFirstPropertyValue('dtstart');
     * let iter = recur.iterator(dtstart);
     * for (let next = iter.next(); next; next = iter.next()) {
     *   if (next.compare(rangeStart) < 0) {
     *     continue;
     *   }
     *   console.log(next.toString());
     * }
     *
     * @param {Time} aStart        The item's start date
     * @return {RecurIterator}     The recurrence iterator
     */
    iterator(aStart: Time): RecurIterator;
    /**
     * Returns a clone of the recurrence object.
     *
     * @return {Recur}      The cloned object
     */
    clone(): Recur;
    /**
     * Checks if the current rule is finite, i.e. has a count or until part.
     *
     * @return {Boolean}        True, if the rule is finite
     */
    isFinite(): boolean;
    /**
     * Checks if the current rule has a count part, and not limited by an until
     * part.
     *
     * @return {Boolean}        True, if the rule is by count
     */
    isByCount(): boolean;
    /**
     * Adds a component (part) to the recurrence rule. This is not a component
     * in the sense of {@link ICAL.Component}, but a part of the recurrence
     * rule, i.e. BYMONTH.
     *
     * @param {String} aType            The name of the component part
     * @param {Array|String} aValue     The component value
     */
    addComponent(aType: string, aValue: any[] | string): void;
    /**
     * Sets the component value for the given by-part.
     *
     * @param {String} aType        The component part name
     * @param {Array} aValues       The component values
     */
    setComponent(aType: string, aValues: any[]): void;
    /**
     * Gets (a copy) of the requested component value.
     *
     * @param {String} aType        The component part name
     * @return {Array}              The component part value
     */
    getComponent(aType: string): any[];
    /**
     * Retrieves the next occurrence after the given recurrence id. See the
     * guide on {@tutorial terminology} for more details.
     *
     * NOTE: Currently, this method iterates all occurrences from the start
     * date. It should not be called in a loop for performance reasons. If you
     * would like to get more than one occurrence, you can iterate the
     * occurrences manually, see the example on the
     * {@link ICAL.Recur#iterator iterator} method.
     *
     * @param {Time} aStartTime        The start of the event series
     * @param {Time} aRecurrenceId     The date of the last occurrence
     * @return {Time}                  The next occurrence after
     */
    getNextOccurrence(aStartTime: Time, aRecurrenceId: Time): Time;
    /**
     * Sets up the current instance using members from the passed data object.
     *
     * @param {Object} data                               An object with members of the recurrence
     * @param {frequencyValues=} data.freq                The frequency value
     * @param {Number=} data.interval                     The INTERVAL value
     * @param {weekDay=} data.wkst                        The week start value
     * @param {Time=} data.until                          The end of the recurrence set
     * @param {Number=} data.count                        The number of occurrences
     * @param {Array.<Number>=} data.bysecond             The seconds for the BYSECOND part
     * @param {Array.<Number>=} data.byminute             The minutes for the BYMINUTE part
     * @param {Array.<Number>=} data.byhour               The hours for the BYHOUR part
     * @param {Array.<String>=} data.byday                The BYDAY values
     * @param {Array.<Number>=} data.bymonthday           The days for the BYMONTHDAY part
     * @param {Array.<Number>=} data.byyearday            The days for the BYYEARDAY part
     * @param {Array.<Number>=} data.byweekno             The weeks for the BYWEEKNO part
     * @param {Array.<Number>=} data.bymonth              The month for the BYMONTH part
     * @param {Array.<Number>=} data.bysetpos             The positionals for the BYSETPOS part
     */
    fromData(data: {
        freq?: frequencyValues | undefined;
        interval?: number | undefined;
        wkst?: weekDay | undefined;
        until?: Time | undefined;
        count?: number | undefined;
        bysecond?: Array<number> | undefined;
        byminute?: Array<number> | undefined;
        byhour?: Array<number> | undefined;
        byday?: Array<string> | undefined;
        bymonthday?: Array<number> | undefined;
        byyearday?: Array<number> | undefined;
        byweekno?: Array<number> | undefined;
        bymonth?: Array<number> | undefined;
        bysetpos?: Array<number> | undefined;
    }): void;
    /**
     * The jCal representation of this recurrence type.
     * @return {Object}
     */
    toJSON(): any;
    /**
     * The string representation of this recurrence rule.
     * @return {String}
     */
    toString(): string;
}
import Time from "./time.js";
import RecurIterator from "./recur_iterator.js";
//# sourceMappingURL=recur.d.ts.map