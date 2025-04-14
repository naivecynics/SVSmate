export default Period;
/**
 * Imports the 'occurrenceDetails' type from the "types.js" module
 */
export type jCalComponent = import("./types.js").jCalComponent;
/**
 * This lets typescript resolve our custom types in the
 * generated d.ts files (jsdoc typedefs are converted to typescript types).
 * Ignore prevents the typedefs from being documented more than once.
 * @ignore
 * @typedef {import("./types.js").jCalComponent} jCalComponent
 * Imports the 'occurrenceDetails' type from the "types.js" module
 */
/**
 * This class represents the "period" value type, with various calculation and manipulation methods.
 *
 * @memberof ICAL
 */
declare class Period {
    /**
     * Creates a new {@link ICAL.Period} instance from the passed string.
     *
     * @param {String} str            The string to parse
     * @param {Property} prop         The property this period will be on
     * @return {Period}               The created period instance
     */
    static fromString(str: string, prop: Property): Period;
    /**
     * Creates a new {@link ICAL.Period} instance from the given data object.
     * The passed data object cannot contain both and end date and a duration.
     *
     * @param {Object} aData                  An object with members of the period
     * @param {Time=} aData.start             The start of the period
     * @param {Time=} aData.end               The end of the period
     * @param {Duration=} aData.duration      The duration of the period
     * @return {Period}                       The period instance
     */
    static fromData(aData: {
        start?: Time | undefined;
        end?: Time | undefined;
        duration?: Duration | undefined;
    }): Period;
    /**
     * Returns a new period instance from the given jCal data array. The first
     * member is always the start date string, the second member is either a
     * duration or end date string.
     *
     * @param {jCalComponent} aData           The jCal data array
     * @param {Property} aProp                The property this jCal data is on
     * @param {Boolean} aLenient              If true, data value can be both date and date-time
     * @return {Period}                       The period instance
     */
    static fromJSON(aData: import("./types.js").jCalComponent, aProp: Property, aLenient: boolean): Period;
    /**
     * Creates a new ICAL.Period instance. The passed data object cannot contain both and end date and
     * a duration.
     *
     * @param {Object} aData                  An object with members of the period
     * @param {Time=} aData.start             The start of the period
     * @param {Time=} aData.end               The end of the period
     * @param {Duration=} aData.duration      The duration of the period
     */
    constructor(aData: {
        start?: Time | undefined;
        end?: Time | undefined;
        duration?: Duration | undefined;
    });
    wrappedJSObject: this;
    /**
     * The start of the period
     * @type {Time}
     */
    start: Time;
    /**
     * The end of the period
     * @type {Time}
     */
    end: Time;
    /**
     * The duration of the period
     * @type {Duration}
     */
    duration: Duration;
    /**
     * The class identifier.
     * @constant
     * @type {String}
     * @default "icalperiod"
     */
    icalclass: string;
    /**
     * The type name, to be used in the jCal object.
     * @constant
     * @type {String}
     * @default "period"
     */
    icaltype: string;
    /**
     * Returns a clone of the duration object.
     *
     * @return {Period}      The cloned object
     */
    clone(): Period;
    /**
     * Calculates the duration of the period, either directly or by subtracting
     * start from end date.
     *
     * @return {Duration}      The calculated duration
     */
    getDuration(): Duration;
    /**
     * Calculates the end date of the period, either directly or by adding
     * duration to start date.
     *
     * @return {Time}          The calculated end date
     */
    getEnd(): Time;
    /**
     * The string representation of this period.
     * @return {String}
     */
    toString(): string;
    /**
     * The jCal representation of this period type.
     * @return {Object}
     */
    toJSON(): any;
    /**
     * The iCalendar string representation of this period.
     * @return {String}
     */
    toICALString(): string;
}
import Time from "./time.js";
import Duration from "./duration.js";
import Property from "./property.js";
//# sourceMappingURL=period.d.ts.map