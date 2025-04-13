export default Binary;
/**
 * Represents the BINARY value type, which contains extra methods for encoding and decoding.
 *
 * @memberof ICAL
 */
declare class Binary {
    /**
     * Creates a binary value from the given string.
     *
     * @param {String} aString        The binary value string
     * @return {Binary}               The binary value instance
     */
    static fromString(aString: string): Binary;
    /**
     * Creates a new ICAL.Binary instance
     *
     * @param {String} aValue     The binary data for this value
     */
    constructor(aValue: string);
    value: string;
    /**
     * The type name, to be used in the jCal object.
     * @default "binary"
     * @constant
     */
    icaltype: string;
    /**
     * Base64 decode the current value
     *
     * @return {String}         The base64-decoded value
     */
    decodeValue(): string;
    /**
     * Encodes the passed parameter with base64 and sets the internal
     * value to the result.
     *
     * @param {String} aValue      The raw binary value to encode
     */
    setEncodedValue(aValue: string): void;
    _b64_encode(data: any): any;
    _b64_decode(data: any): any;
    /**
     * The string representation of this value
     * @return {String}
     */
    toString(): string;
}
//# sourceMappingURL=binary.d.ts.map