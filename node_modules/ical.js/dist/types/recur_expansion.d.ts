export default RecurExpansion;
/**
 * Primary class for expanding recurring rules.  Can take multiple rrules, rdates, exdate(s) and
 * iterate (in order) over each next occurrence.
 *
 * Once initialized this class can also be serialized saved and continue iteration from the last
 * point.
 *
 * NOTE: it is intended that this class is to be used with {@link ICAL.Event} which handles recurrence
 * exceptions.
 *
 * @example
 * // assuming event is a parsed ical component
 * var event;
 *
 * var expand = new ICAL.RecurExpansion({
 *   component: event,
 *   dtstart: event.getFirstPropertyValue('dtstart')
 * });
 *
 * // remember there are infinite rules so it is a good idea to limit the scope of the iterations
 * // then resume later on.
 *
 * // next is always an ICAL.Time or null
 * var next;
 *
 * while (someCondition && (next = expand.next())) {
 *   // do something with next
 * }
 *
 * // save instance for later
 * var json = JSON.stringify(expand);
 *
 * //...
 *
 * // NOTE: if the component's properties have changed you will need to rebuild the class and start
 * // over. This only works when the component's recurrence info is the same.
 * var expand = new ICAL.RecurExpansion(JSON.parse(json));
 *
 * @memberof ICAL
 */
declare class RecurExpansion {
    /**
     * Creates a new ICAL.RecurExpansion instance.
     *
     * The options object can be filled with the specified initial values. It can also contain
     * additional members, as a result of serializing a previous expansion state, as shown in the
     * example.
     *
     * @param {Object} options
     *        Recurrence expansion options
     * @param {Time} options.dtstart
     *        Start time of the event
     * @param {Component=} options.component
     *        Component for expansion, required if not resuming.
     */
    constructor(options: {
        dtstart: Time;
        component?: Component | undefined;
    });
    /**
     * Array of rdate instances.
     *
     * @type {Time[]}
     * @private
     */
    private ruleDates;
    /**
     * Array of exdate instances.
     *
     * @type {Time[]}
     * @private
     */
    private exDates;
    /**
     * True when iteration is fully completed.
     * @type {Boolean}
     */
    complete: boolean;
    /**
     * Array of rrule iterators.
     *
     * @type {RecurIterator[]}
     * @private
     */
    private ruleIterators;
    /**
     * Current position in ruleDates array.
     * @type {Number}
     * @private
     */
    private ruleDateInc;
    /**
     * Current position in exDates array
     * @type {Number}
     * @private
     */
    private exDateInc;
    /**
     * Current negative date.
     *
     * @type {Time}
     * @private
     */
    private exDate;
    /**
     * Current additional date.
     *
     * @type {Time}
     * @private
     */
    private ruleDate;
    /**
     * Start date of recurring rules.
     *
     * @type {Time}
     */
    dtstart: Time;
    /**
     * Last expanded time
     *
     * @type {Time}
     */
    last: Time;
    /**
     * Initialize the recurrence expansion from the data object. The options
     * object may also contain additional members, see the
     * {@link ICAL.RecurExpansion constructor} for more details.
     *
     * @param {Object} options
     *        Recurrence expansion options
     * @param {Time} options.dtstart
     *        Start time of the event
     * @param {Component=} options.component
     *        Component for expansion, required if not resuming.
     */
    fromData(options: {
        dtstart: Time;
        component?: Component | undefined;
    }): void;
    /**
     * Retrieve the next occurrence in the series.
     * @return {Time}
     */
    next(): Time;
    /**
     * Converts object into a serialize-able format. This format can be passed
     * back into the expansion to resume iteration.
     * @return {Object}
     */
    toJSON(): any;
    /**
     * Extract all dates from the properties in the given component. The
     * properties will be filtered by the property name.
     *
     * @private
     * @param {Component} component             The component to search in
     * @param {String} propertyName             The property name to search for
     * @return {Time[]}                         The extracted dates.
     */
    private _extractDates;
    /**
     * Initialize the recurrence expansion.
     *
     * @private
     * @param {Component} component    The component to initialize from.
     */
    private _init;
    /**
     * Advance to the next exdate
     * @private
     */
    private _nextExDay;
    /**
     * Advance to the next rule date
     * @private
     */
    private _nextRuleDay;
    /**
     * Find and return the recurrence rule with the most recent event and
     * return it.
     *
     * @private
     * @return {?RecurIterator}    Found iterator.
     */
    private _nextRecurrenceIter;
}
import Time from "./time.js";
import Component from "./component.js";
//# sourceMappingURL=recur_expansion.d.ts.map