// @ts-check
/// <reference path="../node_modules/pocketbase-jsvm/index.d.ts" />

/**
 * A utility function that safely executes a function and returns either the result or an error
 *
 * @template T, E
 * @param {() => T} fn - Function to execute safely
 * @returns {[T, null] | [null, E]} - Tuple with either [result, null] or [null, error]
 */
module.exports.tryCatch = (fn) => {
    try {
        return [fn(), null];
    } catch (error) {
        return [null, error];
    }
};

/**
 * Convert an IP address in the format "x.x.x.x" to an integer
 *
 * @param {string} ip IP address in the format "x.x.x.x"
 * @returns {number} The integer representation of the IP address
 */
module.exports.ipToInt = (ip) => {
    return ip.split(".").reduce((int, octet) => (int << 8) + parseInt(octet, 10), 0) >>> 0;
};

/**
 * Convert an integer to an IP address in the format "x.x.x.x"
 *
 * @param {number} int Number representation of the IP address
 * @returns {string} The IP address in the format "x.x.x.x"
 */
module.exports.intToIp = (int) => {
    return [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join(".");
};

/**
 * Get the first and last IP address in a CIDR range
 *
 * @param {string} cidr IP block in CIDR notation (e.g. "192.168.1.0/24")
 * @returns {string[]} An array with the first and last IP address in the CIDR range
 */
module.exports.cidrToRange = (cidr) => {
    const [ip, bits] = cidr.split("/");
    const ipInt = this.ipToInt(ip);
    const mask = ~(2 ** (32 - Number(bits)) - 1) >>> 0;
    const network = ipInt & mask;
    const broadcast = network | (~mask >>> 0);
    return [this.intToIp(network), this.intToIp(broadcast)];
};

/**
 * Check if an IP address is in a CIDR range
 *
 * @param {string} ip IP address in the format "x.x.x.x"
 * @param {string} cidr IP block in CIDR notation (e.g. "192.168.1.0/24")
 * @returns {boolean} True if the IP address is in the CIDR range, false otherwise
 */
module.exports.ipInCidr = (ip, cidr) => {
    const ipInt = this.ipToInt(ip);
    const [rangeStart, rangeEnd] = this.cidrToRange(cidr).map(this.ipToInt);
    return ipInt >= rangeStart && ipInt <= rangeEnd;
};
