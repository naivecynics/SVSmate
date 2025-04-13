/**
 * Helper functions used in various places within ical.js
 * @module ICAL.helpers
 */
/**
 * Compiles a list of all referenced TZIDs in all subcomponents and
 * removes any extra VTIMEZONE subcomponents. In addition, if any TZIDs
 * are referenced by a component, but a VTIMEZONE does not exist,
 * an attempt will be made to generate a VTIMEZONE using ICAL.TimezoneService.
 *
 * @param {Component} vcal     The top-level VCALENDAR component.
 * @return {Component}         The ICAL.Component that was passed in.
 */
export function updateTimezones(vcal: Component): Component;
/**
 * Checks if the given type is of the number type and also NaN.
 *
 * @param {Number} number     The number to check
 * @return {Boolean}          True, if the number is strictly NaN
 */
export function isStrictlyNaN(number: number): boolean;
/**
 * Parses a string value that is expected to be an integer, when the valid is
 * not an integer throws a decoration error.
 *
 * @param {String} string     Raw string input
 * @return {Number}           Parsed integer
 */
export function strictParseInt(string: string): number;
/**
 * Creates or returns a class instance of a given type with the initialization
 * data if the data is not already an instance of the given type.
 *
 * @example
 * var time = new ICAL.Time(...);
 * var result = ICAL.helpers.formatClassType(time, ICAL.Time);
 *
 * (result instanceof ICAL.Time)
 * // => true
 *
 * result = ICAL.helpers.formatClassType({}, ICAL.Time);
 * (result isntanceof ICAL.Time)
 * // => true
 *
 *
 * @param {Object} data       object initialization data
 * @param {Object} type       object type (like ICAL.Time)
 * @return {?}                An instance of the found type.
 */
export function formatClassType(data: any, type: any): unknown;
/**
 * Identical to indexOf but will only match values when they are not preceded
 * by a backslash character.
 *
 * @param {String} buffer         String to search
 * @param {String} search         Value to look for
 * @param {Number} pos            Start position
 * @return {Number}               The position, or -1 if not found
 */
export function unescapedIndexOf(buffer: string, search: string, pos: number): number;
/**
 * Find the index for insertion using binary search.
 *
 * @param {Array} list            The list to search
 * @param {?} seekVal             The value to insert
 * @param {function(?,?)} cmpfunc The comparison func, that can
 *                                  compare two seekVals
 * @return {Number}               The insert position
 */
export function binsearchInsert(list: any[], seekVal: unknown, cmpfunc: (arg0: unknown, arg1: unknown) => any): number;
/**
 * Clone the passed object or primitive. By default a shallow clone will be
 * executed.
 *
 * @param {*} aSrc            The thing to clone
 * @param {Boolean=} aDeep    If true, a deep clone will be performed
 * @return {*}                The copy of the thing
 */
export function clone(aSrc: any, aDeep?: boolean | undefined): any;
/**
 * Performs iCalendar line folding. A line ending character is inserted and
 * the next line begins with a whitespace.
 *
 * @example
 * SUMMARY:This line will be fold
 *  ed right in the middle of a word.
 *
 * @param {String} aLine      The line to fold
 * @return {String}           The folded line
 */
export function foldline(aLine: string): string;
/**
 * Pads the given string or number with zeros so it will have at least two
 * characters.
 *
 * @param {String|Number} data    The string or number to pad
 * @return {String}               The number padded as a string
 */
export function pad2(data: string | number): string;
/**
 * Truncates the given number, correctly handling negative numbers.
 *
 * @param {Number} number     The number to truncate
 * @return {Number}           The truncated number
 */
export function trunc(number: number): number;
/**
 * Poor-man's cross-browser object extension. Doesn't support all the
 * features, but enough for our usage. Note that the target's properties are
 * not overwritten with the source properties.
 *
 * @example
 * var child = ICAL.helpers.extend(parent, {
 *   "bar": 123
 * });
 *
 * @param {Object} source     The object to extend
 * @param {Object} target     The object to extend with
 * @return {Object}           Returns the target.
 */
export function extend(source: any, target: any): any;
import Component from "./component.js";
//# sourceMappingURL=helpers.d.ts.map