export default TimezoneService;
declare namespace TimezoneService {
    const count: number;
    function reset(): void;
    function _hard_reset(): void;
    function has(tzid: string): boolean;
    function get(tzid: string): Timezone;
    function register(timezone: Timezone | Component, name?: string): void;
    function remove(tzid: string): Timezone;
}
import Timezone from "./timezone.js";
import Component from "./component.js";
//# sourceMappingURL=timezone_service.d.ts.map