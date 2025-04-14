/**
 * Convert a full jCal/jCard array into a iCalendar/vCard string.
 *
 * @function ICAL.stringify
 * @variation function
 * @param {Array} jCal    The jCal/jCard document
 * @return {String}       The stringified iCalendar/vCard document
 */
declare function stringify(jCal: any[]): string;
declare namespace stringify {
    /**
     * Converts an jCal component array into a ICAL string.
     * Recursive will resolve sub-components.
     *
     * Exact component/property order is not saved all
     * properties will come before subcomponents.
     *
     * @function ICAL.stringify.component
     * @param {Array} component
     *        jCal/jCard fragment of a component
     * @param {designSet} designSet
     *        The design data to use for this component
     * @return {String}       The iCalendar/vCard string
     */
    function component(component: any[], designSet: import("./types.js").designSet): string;
    /**
     * Converts a single jCal/jCard property to a iCalendar/vCard string.
     *
     * @function ICAL.stringify.property
     * @param {Array} property
     *        jCal/jCard property array
     * @param {designSet} designSet
     *        The design data to use for this property
     * @param {Boolean} noFold
     *        If true, the line is not folded
     * @return {String}       The iCalendar/vCard string
     */
    function property(property: any[], designSet: import("./types.js").designSet, noFold: boolean): string;
    /**
     * Handles escaping of property values that may contain:
     *
     *    COLON (:), SEMICOLON (;), or COMMA (,)
     *
     * If any of the above are present the result is wrapped
     * in double quotes.
     *
     * @function ICAL.stringify.paramPropertyValue
     * @param {String} value      Raw property value
     * @param {boolean} force     If value should be escaped even when unnecessary
     * @return {String}           Given or escaped value when needed
     */
    function paramPropertyValue(value: string, force: boolean): string;
    /**
     * Converts an array of ical values into a single
     * string based on a type and a delimiter value (like ",").
     *
     * @function ICAL.stringify.multiValue
     * @param {Array} values      List of values to convert
     * @param {String} delim      Used to join the values (",", ";", ":")
     * @param {String} type       Lowecase ical value type
     *        (like boolean, date-time, etc..)
     * @param {?String} innerMulti If set, each value will again be processed
     *        Used for structured values
     * @param {designSet} designSet
     *        The design data to use for this property
     *
     * @return {String}           iCalendar/vCard string for value
     */
    function multiValue(values: any[], delim: string, type: string, innerMulti: string, designSet: import("./types.js").designSet, structuredValue: any): string;
    /**
     * Processes a single ical value runs the associated "toICAL" method from the
     * design value type if available to convert the value.
     *
     * @function ICAL.stringify.value
     * @param {String|Number} value       A formatted value
     * @param {String} type               Lowercase iCalendar/vCard value type
     *  (like boolean, date-time, etc..)
     * @return {String}                   iCalendar/vCard value for single value
     */
    function value(value: string | number, type: string, designSet: any, structuredValue: any): string;
    /**
     * Internal helper for rfc6868. Exposing this on ICAL.stringify so that
     * hackers can disable the rfc6868 parsing if the really need to.
     *
     * @param {String} val        The value to unescape
     * @return {String}           The escaped value
     */
    function _rfc6868Unescape(val: string): string;
}
export default stringify;
/**
 * Imports the 'designSet' type from the "types.js" module
 */
export type designSet = import("./types.js").designSet;
//# sourceMappingURL=stringify.d.ts.map