export default ComponentParser;
/**
 * The ComponentParser is used to process a String or jCal Object,
 * firing callbacks for various found components, as well as completion.
 *
 * @example
 * var options = {
 *   // when false no events will be emitted for type
 *   parseEvent: true,
 *   parseTimezone: true
 * };
 *
 * var parser = new ICAL.ComponentParser(options);
 *
 * parser.onevent(eventComponent) {
 *   //...
 * }
 *
 * // ontimezone, etc...
 *
 * parser.oncomplete = function() {
 *
 * };
 *
 * parser.process(stringOrComponent);
 *
 * @memberof ICAL
 */
declare class ComponentParser {
    /**
     * Creates a new ICAL.ComponentParser instance.
     *
     * @param {Object=} options                   Component parser options
     * @param {Boolean} options.parseEvent        Whether events should be parsed
     * @param {Boolean} options.parseTimezeone    Whether timezones should be parsed
     */
    constructor(options?: any | undefined);
    /**
     * When true, parse events
     *
     * @type {Boolean}
     */
    parseEvent: boolean;
    /**
     * When true, parse timezones
     *
     * @type {Boolean}
     */
    parseTimezone: boolean;
    /**
     * Fired when parsing is complete
     * @callback
     */
    oncomplete: () => void;
    /**
     * Fired if an error occurs during parsing.
     *
     * @callback
     * @param {Error} err details of error
     */
    onerror: (err: any) => void;
    /**
     * Fired when a top level component (VTIMEZONE) is found
     *
     * @callback
     * @param {Timezone} component     Timezone object
     */
    ontimezone: (component: any) => void;
    /**
     * Fired when a top level component (VEVENT) is found.
     *
     * @callback
     * @param {Event} component    Top level component
     */
    onevent: (component: any) => void;
    /**
     * Process a string or parse ical object.  This function itself will return
     * nothing but will start the parsing process.
     *
     * Events must be registered prior to calling this method.
     *
     * @param {Component|String|Object} ical      The component to process,
     *        either in its final form, as a jCal Object, or string representation
     */
    process(ical: Component | string | any): void;
}
import Component from "./component.js";
//# sourceMappingURL=component_parser.d.ts.map