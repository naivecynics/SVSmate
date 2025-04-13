export default RecurIterator;
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
 * An iterator for a single recurrence rule. This class usually doesn't have to be instanciated
 * directly, the convenience method {@link ICAL.Recur#iterator} can be used.
 *
 * @memberof ICAL
 */
declare class RecurIterator {
    static _indexMap: {
        BYSECOND: number;
        BYMINUTE: number;
        BYHOUR: number;
        BYDAY: number;
        BYMONTHDAY: number;
        BYYEARDAY: number;
        BYWEEKNO: number;
        BYMONTH: number;
        BYSETPOS: number;
    };
    static _expandMap: {
        SECONDLY: number[];
        MINUTELY: number[];
        HOURLY: number[];
        DAILY: number[];
        WEEKLY: number[];
        MONTHLY: number[];
        YEARLY: number[];
    };
    static UNKNOWN: number;
    static CONTRACT: number;
    static EXPAND: number;
    static ILLEGAL: number;
    /**
     * Creates a new ICAL.RecurIterator instance. The options object may contain additional members
     * when resuming iteration from a previous run.
     *
     * @param {Object} options                The iterator options
     * @param {Recur} options.rule            The rule to iterate.
     * @param {Time} options.dtstart          The start date of the event.
     * @param {Boolean=} options.initialized  When true, assume that options are
     *        from a previously constructed iterator. Initialization will not be
     *        repeated.
     */
    constructor(options: {
        rule: Recur;
        dtstart: Time;
        initialized?: boolean | undefined;
    });
    /**
     * True when iteration is finished.
     * @type {Boolean}
     */
    completed: boolean;
    /**
     * The rule that is being iterated
     * @type {Recur}
     */
    rule: Recur;
    /**
     * The start date of the event being iterated.
     * @type {Time}
     */
    dtstart: Time;
    /**
     * The last occurrence that was returned from the
     * {@link RecurIterator#next} method.
     * @type {Time}
     */
    last: Time;
    /**
     * The sequence number from the occurrence
     * @type {Number}
     */
    occurrence_number: number;
    /**
     * The indices used for the {@link ICAL.RecurIterator#by_data} object.
     * @type {Object}
     * @private
     */
    private by_indices;
    /**
     * If true, the iterator has already been initialized
     * @type {Boolean}
     * @private
     */
    private initialized;
    /**
     * The initializd by-data.
     * @type {Object}
     * @private
     */
    private by_data;
    /**
     * The expanded yeardays
     * @type {Array}
     * @private
     */
    private days;
    /**
     * The index in the {@link ICAL.RecurIterator#days} array.
     * @type {Number}
     * @private
     */
    private days_index;
    /**
     * Initialize the recurrence iterator from the passed data object. This
     * method is usually not called directly, you can initialize the iterator
     * through the constructor.
     *
     * @param {Object} options                The iterator options
     * @param {Recur} options.rule            The rule to iterate.
     * @param {Time} options.dtstart          The start date of the event.
     * @param {Boolean=} options.initialized  When true, assume that options are
     *        from a previously constructed iterator. Initialization will not be
     *        repeated.
     */
    fromData(options: {
        rule: Recur;
        dtstart: Time;
        initialized?: boolean | undefined;
    }): void;
    /**
     * Initialize the iterator
     * @private
     */
    private init;
    /**
     * Retrieve the next occurrence from the iterator.
     * @return {Time}
     */
    next(again?: boolean): Time;
    next_second(): number;
    increment_second(inc: any): void;
    next_minute(): number;
    increment_minute(inc: any): void;
    next_hour(): number;
    increment_hour(inc: any): void;
    next_day(): number;
    next_week(): number;
    /**
     * Normalize each by day rule for a given year/month.
     * Takes into account ordering and negative rules
     *
     * @private
     * @param {Number} year         Current year.
     * @param {Number} month        Current month.
     * @param {Array}  rules        Array of rules.
     *
     * @return {Array} sorted and normalized rules.
     *                 Negative rules will be expanded to their
     *                 correct positive values for easier processing.
     */
    private normalizeByMonthDayRules;
    /**
     * NOTES:
     * We are given a list of dates in the month (BYMONTHDAY) (23, etc..)
     * Also we are given a list of days (BYDAY) (MO, 2SU, etc..) when
     * both conditions match a given date (this.last.day) iteration stops.
     *
     * @private
     * @param {Boolean=} isInit     When given true will not increment the
     *                                current day (this.last).
     */
    private _byDayAndMonthDay;
    next_month(): number;
    next_weekday_by_week(): number;
    next_year(): 0 | 1;
    _nextByYearDay(): void;
    /**
     * @param dow (eg: '1TU', '-1MO')
     * @param {weekDay=} aWeekStart The week start weekday
     * @return [pos, numericDow] (eg: [1, 3]) numericDow is relative to aWeekStart
     */
    ruleDayOfWeek(dow: any, aWeekStart?: weekDay | undefined): any[];
    next_generic(aRuleType: any, aInterval: any, aDateAttr: any, aFollowingAttr: any, aPreviousIncr: any): number;
    increment_monthday(inc: any): void;
    increment_month(): void;
    increment_year(inc: any): void;
    increment_generic(inc: any, aDateAttr: any, aFactor: any, aNextIncrement: any): void;
    has_by_data(aRuleType: any): boolean;
    expand_year_days(aYear: any): number;
    expand_by_day(aYear: any): number[];
    is_day_in_byday(tt: any): 0 | 1;
    /**
     * Checks if given value is in BYSETPOS.
     *
     * @private
     * @param {Numeric} aPos position to check for.
     * @return {Boolean} false unless BYSETPOS rules exist
     *                   and the given value is present in rules.
     */
    private check_set_position;
    sort_byday_rules(aRules: any): void;
    check_contract_restriction(aRuleType: any, v: any): boolean;
    check_contracting_rules(): boolean;
    setup_defaults(aRuleType: any, req: any, deftime: any): any;
    /**
     * Convert iterator into a serialize-able object.  Will preserve current
     * iteration sequence to ensure the seamless continuation of the recurrence
     * rule.
     * @return {Object}
     */
    toJSON(): any;
}
import Recur from "./recur.js";
import Time from "./time.js";
//# sourceMappingURL=recur_iterator.d.ts.map