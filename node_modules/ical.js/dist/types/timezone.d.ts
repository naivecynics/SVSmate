export default Timezone;
/**
 * Timezone representation.
 *
 * @example
 * var vcalendar;
 * var timezoneComp = vcalendar.getFirstSubcomponent('vtimezone');
 * var tzid = timezoneComp.getFirstPropertyValue('tzid');
 *
 * var timezone = new ICAL.Timezone({
 *   component: timezoneComp,
 *   tzid
 * });
 *
 * @memberof ICAL
 */
declare class Timezone {
    static _compare_change_fn(a: any, b: any): 0 | 1 | -1;
    /**
     * Convert the date/time from one zone to the next.
     *
     * @param {Time} tt                  The time to convert
     * @param {Timezone} from_zone       The source zone to convert from
     * @param {Timezone} to_zone         The target zone to convert to
     * @return {Time}                    The converted date/time object
     */
    static convert_time(tt: Time, from_zone: Timezone, to_zone: Timezone): Time;
    /**
     * Creates a new ICAL.Timezone instance from the passed data object.
     *
     * @param {Component|Object} aData options for class
     * @param {String|Component} aData.component
     *        If aData is a simple object, then this member can be set to either a
     *        string containing the component data, or an already parsed
     *        ICAL.Component
     * @param {String} aData.tzid      The timezone identifier
     * @param {String} aData.location  The timezone locationw
     * @param {String} aData.tznames   An alternative string representation of the
     *                                  timezone
     * @param {Number} aData.latitude  The latitude of the timezone
     * @param {Number} aData.longitude The longitude of the timezone
     */
    static fromData(aData: Component | any): Timezone;
    /**
     * The instance describing the UTC timezone
     * @type {Timezone}
     * @constant
     * @instance
     */
    static "__#2@#utcTimezone": Timezone;
    static get utcTimezone(): Timezone;
    /**
     * The instance describing the local timezone
     * @type {Timezone}
     * @constant
     * @instance
     */
    static "__#2@#localTimezone": Timezone;
    static get localTimezone(): Timezone;
    /**
     * Adjust a timezone change object.
     * @private
     * @param {Object} change     The timezone change object
     * @param {Number} days       The extra amount of days
     * @param {Number} hours      The extra amount of hours
     * @param {Number} minutes    The extra amount of minutes
     * @param {Number} seconds    The extra amount of seconds
     */
    private static adjust_change;
    static _minimumExpansionYear: number;
    static EXTRA_COVERAGE: number;
    /**
     * Creates a new ICAL.Timezone instance, by passing in a tzid and component.
     *
     * @param {Component|Object} data options for class
     * @param {String|Component} data.component
     *        If data is a simple object, then this member can be set to either a
     *        string containing the component data, or an already parsed
     *        ICAL.Component
     * @param {String} data.tzid      The timezone identifier
     * @param {String} data.location  The timezone locationw
     * @param {String} data.tznames   An alternative string representation of the
     *                                  timezone
     * @param {Number} data.latitude  The latitude of the timezone
     * @param {Number} data.longitude The longitude of the timezone
     */
    constructor(data: Component | any);
    wrappedJSObject: this;
    /**
     * Timezone identifier
     * @type {String}
     */
    tzid: string;
    /**
     * Timezone location
     * @type {String}
     */
    location: string;
    /**
     * Alternative timezone name, for the string representation
     * @type {String}
     */
    tznames: string;
    /**
     * The primary latitude for the timezone.
     * @type {Number}
     */
    latitude: number;
    /**
     * The primary longitude for the timezone.
     * @type {Number}
     */
    longitude: number;
    /**
     * The vtimezone component for this timezone.
     * @type {Component}
     */
    component: Component;
    /**
     * The year this timezone has been expanded to. All timezone transition
     * dates until this year are known and can be used for calculation
     *
     * @private
     * @type {Number}
     */
    private expandedUntilYear;
    /**
     * The class identifier.
     * @constant
     * @type {String}
     * @default "icaltimezone"
     */
    icalclass: string;
    /**
     * Sets up the current instance using members from the passed data object.
     *
     * @param {Component|Object} aData options for class
     * @param {String|Component} aData.component
     *        If aData is a simple object, then this member can be set to either a
     *        string containing the component data, or an already parsed
     *        ICAL.Component
     * @param {String} aData.tzid      The timezone identifier
     * @param {String} aData.location  The timezone locationw
     * @param {String} aData.tznames   An alternative string representation of the
     *                                  timezone
     * @param {Number} aData.latitude  The latitude of the timezone
     * @param {Number} aData.longitude The longitude of the timezone
     */
    fromData(aData: Component | any): this;
    changes: any[];
    /**
     * Finds the utcOffset the given time would occur in this timezone.
     *
     * @param {Time} tt         The time to check for
     * @return {Number}         utc offset in seconds
     */
    utcOffset(tt: Time): number;
    _findNearbyChange(change: any): number;
    _ensureCoverage(aYear: any): void;
    _expandComponent(aComponent: any, aYear: any, changes: any): any;
    /**
     * The string representation of this timezone.
     * @return {String}
     */
    toString(): string;
}
import Component from "./component.js";
import Time from "./time.js";
//# sourceMappingURL=timezone.d.ts.map