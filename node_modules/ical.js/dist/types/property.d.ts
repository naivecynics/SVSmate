export default Property;
/**
 * Imports the 'designSet' type from the "types.js" module
 */
export type designSet = import("./types.js").designSet;
/**
 * Imports the 'Geo' type from the "types.js" module
 */
export type Geo = import("./types.js").Geo;
/**
 * This lets typescript resolve our custom types in the
 * generated d.ts files (jsdoc typedefs are converted to typescript types).
 * Ignore prevents the typedefs from being documented more than once.
 * @ignore
 * @typedef {import("./types.js").designSet} designSet
 * Imports the 'designSet' type from the "types.js" module
 * @typedef {import("./types.js").Geo} Geo
 * Imports the 'Geo' type from the "types.js" module
 */
/**
 * Provides a layer on top of the raw jCal object for manipulating a single property, with its
 * parameters and value.
 *
 * @memberof ICAL
 */
declare class Property {
    /**
     * Create an {@link ICAL.Property} by parsing the passed iCalendar string.
     *
     * @param {String} str            The iCalendar string to parse
     * @param {designSet=} designSet  The design data to use for this property
     * @return {Property}             The created iCalendar property
     */
    static fromString(str: string, designSet?: designSet | undefined): Property;
    /**
     * Creates a new ICAL.Property instance.
     *
     * It is important to note that mutations done in the wrapper directly mutate the jCal object used
     * to initialize.
     *
     * Can also be used to create new properties by passing the name of the property (as a String).
     *
     * @param {Array|String} jCal         Raw jCal representation OR the new name of the property
     * @param {Component=} parent         Parent component
     */
    constructor(jCal: any[] | string, parent?: Component | undefined);
    _parent: Component;
    jCal: any[];
    /**
     * The value type for this property
     * @type {String}
     */
    get type(): string;
    /**
     * The name of this property, in lowercase.
     * @type {String}
     */
    get name(): string;
    set parent(p: Component);
    /**
     * The parent component for this property.
     * @type {Component}
     */
    get parent(): Component;
    /**
     * The design set for this property, e.g. icalendar vs vcard
     *
     * @type {designSet}
     * @private
     */
    private get _designSet();
    /**
     * Updates the type metadata from the current jCal type and design set.
     *
     * @private
     */
    private _updateType;
    isDecorated: boolean;
    isMultiValue: boolean;
    isStructuredValue: boolean;
    /**
     * Hydrate a single value. The act of hydrating means turning the raw jCal
     * value into a potentially wrapped object, for example {@link ICAL.Time}.
     *
     * @private
     * @param {Number} index        The index of the value to hydrate
     * @return {?Object}             The decorated value.
     */
    private _hydrateValue;
    _values: any[];
    /**
     * Decorate a single value, returning its wrapped object. This is used by
     * the hydrate function to actually wrap the value.
     *
     * @private
     * @param {?} value         The value to decorate
     * @return {Object}         The decorated value
     */
    private _decorate;
    /**
     * Undecorate a single value, returning its raw jCal data.
     *
     * @private
     * @param {Object} value         The value to undecorate
     * @return {?}                   The undecorated value
     */
    private _undecorate;
    /**
     * Sets the value at the given index while also hydrating it. The passed
     * value can either be a decorated or undecorated value.
     *
     * @private
     * @param {?} value             The value to set
     * @param {Number} index        The index to set it at
     */
    private _setDecoratedValue;
    /**
     * Gets a parameter on the property.
     *
     * @param {String}        name   Parameter name (lowercase)
     * @return {Array|String}        Parameter value
     */
    getParameter(name: string): any[] | string;
    /**
     * Gets first parameter on the property.
     *
     * @param {String}        name   Parameter name (lowercase)
     * @return {String}        Parameter value
     */
    getFirstParameter(name: string): string;
    /**
     * Sets a parameter on the property.
     *
     * @param {String}       name     The parameter name
     * @param {Array|String} value    The parameter value
     */
    setParameter(name: string, value: any[] | string): void;
    /**
     * Removes a parameter
     *
     * @param {String} name     The parameter name
     */
    removeParameter(name: string): void;
    /**
     * Get the default type based on this property's name.
     *
     * @return {String}     The default type for this property
     */
    getDefaultType(): string;
    /**
     * Sets type of property and clears out any existing values of the current
     * type.
     *
     * @param {String} type     New iCAL type (see design.*.values)
     */
    resetType(type: string): void;
    /**
     * Finds the first property value.
     *
     * @return {Binary | Duration | Period |
     * Recur | Time | UtcOffset | Geo | string | null}         First property value
     */
    getFirstValue(): Binary | Duration | Period | Recur | Time | UtcOffset | import("./types.js").Geo | string | null;
    /**
     * Gets all values on the property.
     *
     * NOTE: this creates an array during each call.
     *
     * @return {Array}          List of values
     */
    getValues(): any[];
    /**
     * Removes all values from this property
     */
    removeAllValues(): void;
    /**
     * Sets the values of the property.  Will overwrite the existing values.
     * This can only be used for multi-value properties.
     *
     * @param {Array} values    An array of values
     */
    setValues(values: any[]): void;
    /**
     * Sets the current value of the property. If this is a multi-value
     * property, all other values will be removed.
     *
     * @param {String|Object} value     New property value.
     */
    setValue(value: string | any): void;
    /**
     * Returns the Object representation of this component. The returned object
     * is a live jCal object and should be cloned if modified.
     * @return {Object}
     */
    toJSON(): any;
    /**
     * The string representation of this component.
     * @return {String}
     */
    toICALString(): string;
}
import Component from "./component.js";
import Binary from "./binary.js";
import Duration from "./duration.js";
import Period from "./period.js";
import Recur from "./recur.js";
import Time from "./time.js";
import UtcOffset from "./utc_offset.js";
//# sourceMappingURL=property.d.ts.map