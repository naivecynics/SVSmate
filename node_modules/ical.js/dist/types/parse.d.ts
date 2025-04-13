/**
 * Parses iCalendar or vCard data into a raw jCal object. Consult
 * documentation on the {@tutorial layers|layers of parsing} for more
 * details.
 *
 * @function ICAL.parse
 * @memberof ICAL
 * @variation function
 * @todo Fix the API to be more clear on the return type
 * @param {String} input      The string data to parse
 * @return {Object|Object[]}  A single jCal object, or an array thereof
 */
declare function parse(input: string): any | any[];
declare namespace parse {
    /**
     * Parse an iCalendar property value into the jCal for a single property
     *
     * @function ICAL.parse.property
     * @param {String} str
     *   The iCalendar property string to parse
     * @param {designSet=} designSet
     *   The design data to use for this property
     * @return {Object}
     *   The jCal Object containing the property
     */
    export function property(str: string, designSet?: import("./types.js").designSet): any;
    /**
     * Convenience method to parse a component. You can use ICAL.parse() directly
     * instead.
     *
     * @function ICAL.parse.component
     * @see ICAL.parse(function)
     * @param {String} str    The iCalendar component string to parse
     * @return {Object}       The jCal Object containing the component
     */
    export function component(str: string): any;
    export { ParserError };
    /**
     * Handles a single line of iCalendar/vCard, updating the state.
     *
     * @private
     * @function ICAL.parse._handleContentLine
     * @param {String} line          The content line to process
     * @param {parserState} state    The current state of the line parsing
     */
    export function _handleContentLine(line: string, state: import("./types.js").parserState): void;
    /**
     * Parse a value from the raw value into the jCard/jCal value.
     *
     * @private
     * @function ICAL.parse._parseValue
     * @param {String} value          Original value
     * @param {String} type           Type of value
     * @param {Object} designSet      The design data to use for this value
     * @return {Object} varies on type
     */
    export function _parseValue(value: string, type: string, designSet: any, structuredValue: any): any;
    /**
     * Parse parameters from a string to object.
     *
     * @function ICAL.parse._parseParameters
     * @private
     * @param {String} line           A single unfolded line
     * @param {Number} start         Position to start looking for properties
     * @param {Object} designSet      The design data to use for this property
     * @return {Object} key/value pairs
     */
    export function _parseParameters(line: string, start: number, designSet: any): any;
    /**
     * Internal helper for rfc6868. Exposing this on ICAL.parse so that
     * hackers can disable the rfc6868 parsing if the really need to.
     *
     * @function ICAL.parse._rfc6868Escape
     * @param {String} val        The value to escape
     * @return {String}           The escaped value
     */
    export function _rfc6868Escape(val: string): string;
    /**
     * Parse a multi value string. This function is used either for parsing
     * actual multi-value property's values, or for handling parameter values. It
     * can be used for both multi-value properties and structured value properties.
     *
     * @private
     * @function ICAL.parse._parseMultiValue
     * @param {String} buffer           The buffer containing the full value
     * @param {String} delim            The multi-value delimiter
     * @param {String} type             The value type to be parsed
     * @param {Array.<?>} result        The array to append results to, varies on value type
     * @param {String} innerMulti       The inner delimiter to split each value with
     * @param {designSet} designSet     The design data for this value
     * @return {?|Array.<?>}            Either an array of results, or the first result
     */
    export function _parseMultiValue(buffer: string, delim: string, type: string, result: any[], innerMulti: string, designSet: import("./types.js").designSet, structuredValue: any): any;
    /**
     * Process a complete buffer of iCalendar/vCard data line by line, correctly
     * unfolding content. Each line will be processed with the given callback
     *
     * @private
     * @function ICAL.parse._eachLine
     * @param {String} buffer                         The buffer to process
     * @param {function(?String, String)} callback    The callback for each line
     */
    export function _eachLine(buffer: string, callback: (arg0: string, arg1: string) => any): void;
}
export default parse;
/**
 * Imports the 'parserState' type from the "types.js" module
 */
export type parserState = import("./types.js").parserState;
/**
 * Imports the 'designSet' type from the "types.js" module
 */
export type designSet = import("./types.js").designSet;
/**
 * An error that occurred during parsing.
 *
 * @param {String} message        The error message
 * @memberof ICAL.parse
 * @extends {Error}
 */
declare class ParserError extends Error {
}
//# sourceMappingURL=parse.d.ts.map