export default Component;
/**
 * Imports the 'designSet' type from the "types.js" module
 */
export type designSet = import("./types.js").designSet;
/**
 * Imports the 'Geo' type from the "types.js" module
 */
export type Geo = import("./types.js").Geo;
/**
 * Wraps a jCal component, adding convenience methods to add, remove and update subcomponents and
 * properties.
 *
 * @memberof ICAL
 */
declare class Component {
    /**
     * Create an {@link ICAL.Component} by parsing the passed iCalendar string.
     *
     * @param {String} str        The iCalendar string to parse
     */
    static fromString(str: string): Component;
    /**
     * Creates a new Component instance.
     *
     * @param {Array|String} jCal         Raw jCal component data OR name of new
     *                                      component
     * @param {Component=} parent     Parent component to associate
     */
    constructor(jCal: any[] | string, parent?: Component | undefined);
    jCal: any[];
    parent: Component;
    /**
     * A cache of hydrated time zone objects which may be used by consumers, keyed
     * by time zone ID.
     *
     * @type {Map}
     * @private
     */
    private _timezoneCache;
    /**
     * Hydrated properties are inserted into the _properties array at the same
     * position as in the jCal array, so it is possible that the array contains
     * undefined values for unhydrdated properties. To avoid iterating the
     * array when checking if all properties have been hydrated, we save the
     * count here.
     *
     * @type {Number}
     * @private
     */
    private _hydratedPropertyCount;
    /**
     * The same count as for _hydratedPropertyCount, but for subcomponents
     *
     * @type {Number}
     * @private
     */
    private _hydratedComponentCount;
    /**
     * @private
     */
    private _components;
    /**
     * @private
     */
    private _properties;
    /**
     * The name of this component
     *
     * @type {String}
     */
    get name(): string;
    /**
     * The design set for this component, e.g. icalendar vs vcard
     *
     * @type {designSet}
     * @private
     */
    private get _designSet();
    /**
     * @private
     */
    private _hydrateComponent;
    /**
     * @private
     */
    private _hydrateProperty;
    /**
     * Finds first sub component, optionally filtered by name.
     *
     * @param {String=} name        Optional name to filter by
     * @return {?Component}     The found subcomponent
     */
    getFirstSubcomponent(name?: string | undefined): Component | null;
    /**
     * Finds all sub components, optionally filtering by name.
     *
     * @param {String=} name            Optional name to filter by
     * @return {Component[]}       The found sub components
     */
    getAllSubcomponents(name?: string | undefined): Component[];
    /**
     * Returns true when a named property exists.
     *
     * @param {String} name     The property name
     * @return {Boolean}        True, when property is found
     */
    hasProperty(name: string): boolean;
    /**
     * Finds the first property, optionally with the given name.
     *
     * @param {String=} name        Lowercase property name
     * @return {?Property}     The found property
     */
    getFirstProperty(name?: string | undefined): Property | null;
    /**
     * Returns first property's value, if available.
     *
     * @param {String=} name                    Lowercase property name
     * @return {Binary | Duration | Period |
     * Recur | Time | UtcOffset | Geo | string | null}         The found property value.
     */
    getFirstPropertyValue(name?: string | undefined): Binary | Duration | Period | Recur | Time | UtcOffset | import("./types.js").Geo | string | null;
    /**
     * Get all properties in the component, optionally filtered by name.
     *
     * @param {String=} name        Lowercase property name
     * @return {Property[]}    List of properties
     */
    getAllProperties(name?: string | undefined): Property[];
    /**
     * @private
     */
    private _removeObjectByIndex;
    /**
     * @private
     */
    private _removeObject;
    /**
     * @private
     */
    private _removeAllObjects;
    /**
     * Adds a single sub component.
     *
     * @param {Component} component        The component to add
     * @return {Component}                 The passed in component
     */
    addSubcomponent(component: Component): Component;
    /**
     * Removes a single component by name or the instance of a specific
     * component.
     *
     * @param {Component|String} nameOrComp    Name of component, or component
     * @return {Boolean}                            True when comp is removed
     */
    removeSubcomponent(nameOrComp: Component | string): boolean;
    /**
     * Removes all components or (if given) all components by a particular
     * name.
     *
     * @param {String=} name            Lowercase component name
     */
    removeAllSubcomponents(name?: string | undefined): void;
    /**
     * Adds an {@link ICAL.Property} to the component.
     *
     * @param {Property} property      The property to add
     * @return {Property}              The passed in property
     */
    addProperty(property: Property): Property;
    /**
     * Helper method to add a property with a value to the component.
     *
     * @param {String}               name         Property name to add
     * @param {String|Number|Object} value        Property value
     * @return {Property}                    The created property
     */
    addPropertyWithValue(name: string, value: string | number | any): Property;
    /**
     * Helper method that will update or create a property of the given name
     * and sets its value. If multiple properties with the given name exist,
     * only the first is updated.
     *
     * @param {String}               name         Property name to update
     * @param {String|Number|Object} value        Property value
     * @return {Property}                    The created property
     */
    updatePropertyWithValue(name: string, value: string | number | any): Property;
    /**
     * Removes a single property by name or the instance of the specific
     * property.
     *
     * @param {String|Property} nameOrProp     Property name or instance to remove
     * @return {Boolean}                            True, when deleted
     */
    removeProperty(nameOrProp: string | Property): boolean;
    /**
     * Removes all properties associated with this component, optionally
     * filtered by name.
     *
     * @param {String=} name        Lowercase property name
     * @return {Boolean}            True, when deleted
     */
    removeAllProperties(name?: string | undefined): boolean;
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
    toString(): string;
    /**
     * Retrieve a time zone definition from the component tree, if any is present.
     * If the tree contains no time zone definitions or the TZID cannot be
     * matched, returns null.
     *
     * @param {String} tzid     The ID of the time zone to retrieve
     * @return {Timezone}  The time zone corresponding to the ID, or null
     */
    getTimeZoneByID(tzid: string): Timezone;
}
import Property from "./property.js";
import Binary from "./binary.js";
import Duration from "./duration.js";
import Period from "./period.js";
import Recur from "./recur.js";
import Time from "./time.js";
import UtcOffset from "./utc_offset.js";
import Timezone from "./timezone.js";
//# sourceMappingURL=component.d.ts.map