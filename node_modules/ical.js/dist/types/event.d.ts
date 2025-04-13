export default Event;
/**
 * Imports the 'frequencyValues' type from the "types.js" module
 */
export type frequencyValues = import("./types.js").frequencyValues;
/**
 * Imports the 'occurrenceDetails' type from the "types.js" module
 */
export type occurrenceDetails = import("./types.js").occurrenceDetails;
/**
 * This lets typescript resolve our custom types in the
 * generated d.ts files (jsdoc typedefs are converted to typescript types).
 * Ignore prevents the typedefs from being documented more than once.
 * @ignore
 * @typedef {import("./types.js").frequencyValues} frequencyValues
 * Imports the 'frequencyValues' type from the "types.js" module
 * @typedef {import("./types.js").occurrenceDetails} occurrenceDetails
 * Imports the 'occurrenceDetails' type from the "types.js" module
 */
/**
 * ICAL.js is organized into multiple layers. The bottom layer is a raw jCal
 * object, followed by the component/property layer. The highest level is the
 * event representation, which this class is part of. See the
 * {@tutorial layers} guide for more details.
 *
 * @memberof ICAL
 */
declare class Event {
    static THISANDFUTURE: string;
    /**
     * Creates a new ICAL.Event instance.
     *
     * @param {Component=} component              The ICAL.Component to base this event on
     * @param {Object} [options]                  Options for this event
     * @param {Boolean=} options.strictExceptions  When true, will verify exceptions are related by
     *                                              their UUID
     * @param {Array<Component|Event>=} options.exceptions
     *          Exceptions to this event, either as components or events. If not
     *            specified exceptions will automatically be set in relation of
     *            component's parent
     */
    constructor(component?: Component | undefined, options?: {
        strictExceptions?: boolean | undefined;
        exceptions?: Array<Component | Event> | undefined;
    });
    component: Component;
    _rangeExceptionCache: any;
    /**
     * List of related event exceptions.
     *
     * @type {Event[]}
     */
    exceptions: Event[];
    rangeExceptions: any[];
    /**
     * When true, will verify exceptions are related by their UUID.
     *
     * @type {Boolean}
     */
    strictExceptions: boolean;
    /**
     * Relates a given event exception to this object.  If the given component
     * does not share the UID of this event it cannot be related and will throw
     * an exception.
     *
     * If this component is an exception it cannot have other exceptions
     * related to it.
     *
     * @param {Component|Event} obj       Component or event
     */
    relateException(obj: Component | Event): void;
    /**
     * Checks if this record is an exception and has the RANGE=THISANDFUTURE
     * value.
     *
     * @return {Boolean}        True, when exception is within range
     */
    modifiesFuture(): boolean;
    /**
     * Finds the range exception nearest to the given date.
     *
     * @param {Time} time   usually an occurrence time of an event
     * @return {?Event}     the related event/exception or null
     */
    findRangeException(time: Time): Event | null;
    /**
     * Returns the occurrence details based on its start time.  If the
     * occurrence has an exception will return the details for that exception.
     *
     * NOTE: this method is intend to be used in conjunction
     *       with the {@link ICAL.Event#iterator iterator} method.
     *
     * @param {Time} occurrence               time occurrence
     * @return {occurrenceDetails}            Information about the occurrence
     */
    getOccurrenceDetails(occurrence: Time): occurrenceDetails;
    /**
     * Builds a recur expansion instance for a specific point in time (defaults
     * to startDate).
     *
     * @param {Time=} startTime     Starting point for expansion
     * @return {RecurExpansion}    Expansion object
     */
    iterator(startTime?: Time | undefined): RecurExpansion;
    /**
     * Checks if the event is recurring
     *
     * @return {Boolean}        True, if event is recurring
     */
    isRecurring(): boolean;
    /**
     * Checks if the event describes a recurrence exception. See
     * {@tutorial terminology} for details.
     *
     * @return {Boolean}    True, if the event describes a recurrence exception
     */
    isRecurrenceException(): boolean;
    /**
     * Returns the types of recurrences this event may have.
     *
     * Returned as an object with the following possible keys:
     *
     *    - YEARLY
     *    - MONTHLY
     *    - WEEKLY
     *    - DAILY
     *    - MINUTELY
     *    - SECONDLY
     *
     * @return {Object.<frequencyValues, Boolean>}
     *          Object of recurrence flags
     */
    getRecurrenceTypes(): any;
    set uid(value: string);
    /**
     * The uid of this event
     * @type {String}
     */
    get uid(): string;
    set startDate(value: Time);
    /**
     * The start date
     * @type {Time}
     */
    get startDate(): Time;
    set endDate(value: Time);
    /**
     * The end date. This can be the result directly from the property, or the
     * end date calculated from start date and duration. Setting the property
     * will remove any duration properties.
     * @type {Time}
     */
    get endDate(): Time;
    set duration(value: Duration);
    /**
     * The duration. This can be the result directly from the property, or the
     * duration calculated from start date and end date. Setting the property
     * will remove any `dtend` properties.
     * @type {Duration}
     */
    get duration(): Duration;
    set location(value: string);
    /**
     * The location of the event.
     * @type {String}
     */
    get location(): string;
    /**
     * The attendees in the event
     * @type {Property[]}
     */
    get attendees(): Property[];
    set summary(value: string);
    /**
     * The event summary
     * @type {String}
     */
    get summary(): string;
    set description(value: string);
    /**
     * The event description.
     * @type {String}
     */
    get description(): string;
    set color(value: string);
    /**
     * The event color from [rfc7986](https://datatracker.ietf.org/doc/html/rfc7986)
     * @type {String}
     */
    get color(): string;
    set organizer(value: string);
    /**
     * The organizer value as an uri. In most cases this is a mailto: uri, but
     * it can also be something else, like urn:uuid:...
     * @type {String}
     */
    get organizer(): string;
    set sequence(value: number);
    /**
     * The sequence value for this event. Used for scheduling
     * see {@tutorial terminology}.
     * @type {Number}
     */
    get sequence(): number;
    set recurrenceId(value: Time);
    /**
     * The recurrence id for this event. See {@tutorial terminology} for details.
     * @type {Time}
     */
    get recurrenceId(): Time;
    /**
     * Set/update a time property's value.
     * This will also update the TZID of the property.
     *
     * TODO: this method handles the case where we are switching
     * from a known timezone to an implied timezone (one without TZID).
     * This does _not_ handle the case of moving between a known
     *  (by TimezoneService) timezone to an unknown timezone...
     *
     * We will not add/remove/update the VTIMEZONE subcomponents
     *  leading to invalid ICAL data...
     * @private
     * @param {String} propName     The property name
     * @param {Time} time           The time to set
     */
    private _setTime;
    _setProp(name: any, value: any): void;
    _firstProp(name: any): string | import("./binary.js").default | Duration | Time | import("./recur.js").default | import("./period.js").default | import("./utc_offset.js").default | import("./types.js").Geo;
    /**
     * The string representation of this event.
     * @return {String}
     */
    toString(): string;
}
import Component from "./component.js";
import Time from "./time.js";
import RecurExpansion from "./recur_expansion.js";
import Duration from "./duration.js";
import Property from "./property.js";
//# sourceMappingURL=event.d.ts.map