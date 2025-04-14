export default design;
/**
 * Imports the 'designSet' type from the "types.js" module
 */
export type designSet = import("./types.js").designSet;
declare namespace design {
    export let strict: boolean;
    export { icalSet as defaultSet };
    export let defaultType: string;
    export let components: any;
    export { icalSet as icalendar };
    export { vcardSet as vcard };
    export { vcard3Set as vcard3 };
    export function getDesignSet(componentName: string): import("./types.js").designSet;
}
/**
 * iCalendar design set
 * @type {designSet}
 */
declare let icalSet: designSet;
/**
 * vCard 4.0 design set
 * @type {designSet}
 */
declare let vcardSet: designSet;
/**
 * vCard 3.0 design set
 * @type {designSet}
 */
declare let vcard3Set: designSet;
//# sourceMappingURL=design.d.ts.map