export default Duration;
/**
 * This class represents the "duration" value type, with various calculation
 * and manipulation methods.
 *
 * @memberof ICAL
 */
declare class Duration {
    /**
     * Returns a new ICAL.Duration instance from the passed seconds value.
     *
     * @param {Number} aSeconds       The seconds to create the instance from
     * @return {Duration}             The newly created duration instance
     */
    static fromSeconds(aSeconds: number): Duration;
    /**
     * Checks if the given string is an iCalendar duration value.
     *
     * @param {String} value      The raw ical value
     * @return {Boolean}          True, if the given value is of the
     *                              duration ical type
     */
    static isValueString(string: any): boolean;
    /**
     * Creates a new {@link ICAL.Duration} instance from the passed string.
     *
     * @param {String} aStr       The string to parse
     * @return {Duration}         The created duration instance
     */
    static fromString(aStr: string): Duration;
    /**
     * Creates a new ICAL.Duration instance from the given data object.
     *
     * @param {Object} aData                An object with members of the duration
     * @param {Number=} aData.weeks         Duration in weeks
     * @param {Number=} aData.days          Duration in days
     * @param {Number=} aData.hours         Duration in hours
     * @param {Number=} aData.minutes       Duration in minutes
     * @param {Number=} aData.seconds       Duration in seconds
     * @param {Boolean=} aData.isNegative   If true, the duration is negative
     * @return {Duration}                   The createad duration instance
     */
    static fromData(aData: {
        weeks?: number | undefined;
        days?: number | undefined;
        hours?: number | undefined;
        minutes?: number | undefined;
        seconds?: number | undefined;
        isNegative?: boolean | undefined;
    }): Duration;
    /**
     * Creates a new ICAL.Duration instance.
     *
     * @param {Object} data                 An object with members of the duration
     * @param {Number=} data.weeks          Duration in weeks
     * @param {Number=} data.days           Duration in days
     * @param {Number=} data.hours          Duration in hours
     * @param {Number=} data.minutes        Duration in minutes
     * @param {Number=} data.seconds        Duration in seconds
     * @param {Boolean=} data.isNegative    If true, the duration is negative
     */
    constructor(data: {
        weeks?: number | undefined;
        days?: number | undefined;
        hours?: number | undefined;
        minutes?: number | undefined;
        seconds?: number | undefined;
        isNegative?: boolean | undefined;
    });
    wrappedJSObject: this;
    /**
     * The weeks in this duration
     * @type {Number}
     * @default 0
     */
    weeks: number;
    /**
     * The days in this duration
     * @type {Number}
     * @default 0
     */
    days: number;
    /**
     * The days in this duration
     * @type {Number}
     * @default 0
     */
    hours: number;
    /**
     * The minutes in this duration
     * @type {Number}
     * @default 0
     */
    minutes: number;
    /**
     * The seconds in this duration
     * @type {Number}
     * @default 0
     */
    seconds: number;
    /**
     * The seconds in this duration
     * @type {Boolean}
     * @default false
     */
    isNegative: boolean;
    /**
     * The class identifier.
     * @constant
     * @type {String}
     * @default "icalduration"
     */
    icalclass: string;
    /**
     * The type name, to be used in the jCal object.
     * @constant
     * @type {String}
     * @default "duration"
     */
    icaltype: string;
    /**
     * Returns a clone of the duration object.
     *
     * @return {Duration}      The cloned object
     */
    clone(): Duration;
    /**
     * The duration value expressed as a number of seconds.
     *
     * @return {Number}             The duration value in seconds
     */
    toSeconds(): number;
    /**
     * Reads the passed seconds value into this duration object. Afterwards,
     * members like {@link ICAL.Duration#days days} and {@link ICAL.Duration#weeks weeks} will be set up
     * accordingly.
     *
     * @param {Number} aSeconds     The duration value in seconds
     * @return {Duration}           Returns this instance
     */
    fromSeconds(aSeconds: number): Duration;
    /**
     * Sets up the current instance using members from the passed data object.
     *
     * @param {Object} aData                An object with members of the duration
     * @param {Number=} aData.weeks         Duration in weeks
     * @param {Number=} aData.days          Duration in days
     * @param {Number=} aData.hours         Duration in hours
     * @param {Number=} aData.minutes       Duration in minutes
     * @param {Number=} aData.seconds       Duration in seconds
     * @param {Boolean=} aData.isNegative   If true, the duration is negative
     */
    fromData(aData: {
        weeks?: number | undefined;
        days?: number | undefined;
        hours?: number | undefined;
        minutes?: number | undefined;
        seconds?: number | undefined;
        isNegative?: boolean | undefined;
    }): void;
    /**
     * Resets the duration instance to the default values, i.e. PT0S
     */
    reset(): void;
    /**
     * Compares the duration instance with another one.
     *
     * @param {Duration} aOther             The instance to compare with
     * @return {Number}                     -1, 0 or 1 for less/equal/greater
     */
    compare(aOther: Duration): number;
    /**
     * Normalizes the duration instance. For example, a duration with a value
     * of 61 seconds will be normalized to 1 minute and 1 second.
     */
    normalize(): void;
    /**
     * The string representation of this duration.
     * @return {String}
     */
    toString(): string;
    /**
     * The iCalendar string representation of this duration.
     * @return {String}
     */
    toICALString(): string;
}
//# sourceMappingURL=duration.d.ts.map