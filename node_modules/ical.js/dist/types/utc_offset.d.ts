export default UtcOffset;
/**
 * This class represents the "utc-offset" value type, with various calculation and manipulation
 * methods.
 *
 * @memberof ICAL
 */
declare class UtcOffset {
    /**
     * Creates a new {@link ICAL.UtcOffset} instance from the passed string.
     *
     * @param {String} aString    The string to parse
     * @return {Duration}         The created utc-offset instance
     */
    static fromString(aString: string): Duration;
    /**
     * Creates a new {@link ICAL.UtcOffset} instance from the passed seconds
     * value.
     *
     * @param {Number} aSeconds       The number of seconds to convert
     */
    static fromSeconds(aSeconds: number): UtcOffset;
    /**
     * Creates a new ICAL.UtcOffset instance.
     *
     * @param {Object} aData          An object with members of the utc offset
     * @param {Number=} aData.hours   The hours for the utc offset
     * @param {Number=} aData.minutes The minutes in the utc offset
     * @param {Number=} aData.factor  The factor for the utc-offset, either -1 or 1
     */
    constructor(aData: {
        hours?: number | undefined;
        minutes?: number | undefined;
        factor?: number | undefined;
    });
    /**
     * The hours in the utc-offset
     * @type {Number}
     */
    hours: number;
    /**
     * The minutes in the utc-offset
     * @type {Number}
     */
    minutes: number;
    /**
     * The sign of the utc offset, 1 for positive offset, -1 for negative
     * offsets.
     * @type {Number}
     */
    factor: number;
    /**
     * The type name, to be used in the jCal object.
     * @constant
     * @type {String}
     * @default "utc-offset"
     */
    icaltype: string;
    /**
     * Returns a clone of the utc offset object.
     *
     * @return {UtcOffset}     The cloned object
     */
    clone(): UtcOffset;
    /**
     * Sets up the current instance using members from the passed data object.
     *
     * @param {Object} aData          An object with members of the utc offset
     * @param {Number=} aData.hours   The hours for the utc offset
     * @param {Number=} aData.minutes The minutes in the utc offset
     * @param {Number=} aData.factor  The factor for the utc-offset, either -1 or 1
     */
    fromData(aData: {
        hours?: number | undefined;
        minutes?: number | undefined;
        factor?: number | undefined;
    }): void;
    /**
     * Sets up the current instance from the given seconds value. The seconds
     * value is truncated to the minute. Offsets are wrapped when the world
     * ends, the hour after UTC+14:00 is UTC-12:00.
     *
     * @param {Number} aSeconds         The seconds to convert into an offset
     */
    fromSeconds(aSeconds: number): this;
    /**
     * Convert the current offset to a value in seconds
     *
     * @return {Number}                 The offset in seconds
     */
    toSeconds(): number;
    /**
     * Compare this utc offset with another one.
     *
     * @param {UtcOffset} other             The other offset to compare with
     * @return {Number}                     -1, 0 or 1 for less/equal/greater
     */
    compare(other: UtcOffset): number;
    _normalize(): void;
    /**
     * The iCalendar string representation of this utc-offset.
     * @return {String}
     */
    toICALString(): string;
    /**
     * The string representation of this utc-offset.
     * @return {String}
     */
    toString(): string;
}
import Duration from "./duration.js";
//# sourceMappingURL=utc_offset.d.ts.map