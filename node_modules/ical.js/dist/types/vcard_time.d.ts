export default VCardTime;
/**
 * Describes a vCard time, which has slight differences to the ICAL.Time.
 * Properties can be null if not specified, for example for dates with
 * reduced accuracy or truncation.
 *
 * Note that currently not all methods are correctly re-implemented for
 * VCardTime. For example, comparison will have undefined results when some
 * members are null.
 *
 * Also, normalization is not yet implemented for this class!
 *
 * @memberof ICAL
 * @extends {ICAL.Time}
 */
declare class VCardTime {
    /**
     * Returns a new ICAL.VCardTime instance from a date and/or time string.
     *
     * @param {String} aValue     The string to create from
     * @param {String} aIcalType  The type for this instance, e.g. date-and-or-time
     * @return {VCardTime}        The date/time instance
     */
    static fromDateAndOrTimeString(aValue: string, aIcalType: string): VCardTime;
    /**
     * Creates a new ICAL.VCardTime instance.
     *
     * @param {Object} data                           The data for the time instance
     * @param {Number=} data.year                     The year for this date
     * @param {Number=} data.month                    The month for this date
     * @param {Number=} data.day                      The day for this date
     * @param {Number=} data.hour                     The hour for this date
     * @param {Number=} data.minute                   The minute for this date
     * @param {Number=} data.second                   The second for this date
     * @param {Timezone|UtcOffset} zone               The timezone to use
     * @param {String} icaltype                       The type for this date/time object
     */
    constructor(data: {
        year?: number | undefined;
        month?: number | undefined;
        day?: number | undefined;
        hour?: number | undefined;
        minute?: number | undefined;
        second?: number | undefined;
    }, zone: Timezone | UtcOffset, icaltype: string);
    /**
     * The type name, to be used in the jCal object.
     * @type {String}
     * @default "date-and-or-time"
     */
    icaltype: string;
    /**
     * The class identifier.
     * @constant
     * @type {String}
     * @default "vcardtime"
     */
    icalclass: string;
    /**
     * Returns a clone of the vcard date/time object.
     *
     * @return {VCardTime}     The cloned object
     */
    clone(): VCardTime;
    _normalize(): this;
    /**
     * @inheritdoc
     */
    utcOffset(...args: any[]): any;
    /**
     * Returns an RFC 6350 compliant representation of this object.
     *
     * @return {String}         vcard date/time string
     */
    toICALString(): string;
    /**
     * The string representation of this date/time, in jCard form
     * (including : and - separators).
     * @return {String}
     */
    toString(): string;
}
import Timezone from "./timezone.js";
import UtcOffset from "./utc_offset.js";
//# sourceMappingURL=vcard_time.d.ts.map