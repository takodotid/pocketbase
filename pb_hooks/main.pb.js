// @ts-check
/// <reference path="../node_modules/pocketbase-jsvm/index.d.ts" />

/**
 * A utility function that safely executes a function and returns either the result or an error
 *
 * @template T, E
 * @param {() => T} fn - Function to execute safely
 * @returns {[T, null] | [null, E]} - Tuple with either [result, null] or [null, error]
 */
function tryCatch(fn) {
    try {
        return [fn(), null];
    } catch (error) {
        return [null, error];
    }
}

/**
 * Convert an IP address in the format "x.x.x.x" to an integer
 *
 * @param {string} ip IP address in the format "x.x.x.x"
 * @returns {number} The integer representation of the IP address
 */
function ipToInt(ip) {
    return ip.split(".").reduce((int, octet) => (int << 8) + parseInt(octet, 10), 0) >>> 0;
}

/**
 * Convert an integer to an IP address in the format "x.x.x.x"
 *
 * @param {number} int Number representation of the IP address
 * @returns {string} The IP address in the format "x.x.x.x"
 */
function intToIp(int) {
    return [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join(".");
}

/**
 * Get the first and last IP address in a CIDR range
 *
 * @param {string} cidr IP block in CIDR notation (e.g. "192.168.1.0/24")
 * @returns {string[]} An array with the first and last IP address in the CIDR range
 */
function cidrToRange(cidr) {
    const [ip, bits] = cidr.split("/");
    const ipInt = ipToInt(ip);
    const mask = ~(2 ** (32 - Number(bits)) - 1) >>> 0;
    const network = ipInt & mask;
    const broadcast = network | (~mask >>> 0);
    return [intToIp(network), intToIp(broadcast)];
}

/**
 * Check if an IP address is in a CIDR range
 *
 * @param {string} ip IP address in the format "x.x.x.x"
 * @param {string} cidr IP block in CIDR notation (e.g. "192.168.1.0/24")
 * @returns {boolean} True if the IP address is in the CIDR range, false otherwise
 */
function ipInCidr(ip, cidr) {
    const ipInt = ipToInt(ip);
    const [rangeStart, rangeEnd] = cidrToRange(cidr).map(ipToInt);
    return ipInt >= rangeStart && ipInt <= rangeEnd;
}

/**
 * Allow superuser to send logs to the PocketBase server
 *
 * @route POST /api/logs
 * @body {string} level - The log level (debug, info, warn, error)
 * @body {string} message - The log message
 * @body {object} data - The log data (must be a non-empty object)
 */
routerAdd(
    "POST",
    "/api/logs",
    (e) => {
        const json = e.requestInfo().body;

        // Check if the `level` is valid
        if (["debug", "info", "warn", "error"].indexOf(json.level) === -1) {
            return e.badRequestError("Log level must be one of: debug, info, warn, error.", json.level);
        }

        // Check if the `message` is a string
        if (!json.message || typeof json.message !== "string") {
            return e.badRequestError("Log message must be a string.", json.message);
        }

        // Check if the `data` is a non-empty object
        if (!json.data || typeof json.data !== "object" || Array.isArray(json.data)) {
            return e.badRequestError("Log data must be an object.", json.data);
        }

        if (Object.keys(json.data).length === 0) {
            return e.badRequestError("Log data must not be empty.", json.data);
        }

        // Flatten the data entries into a single array of key-value pairs
        const entries = Object.entries(json.data).flat();

        // Log the message
        switch (json.level) {
            case "debug":
                e.app.logger().debug(json.message, ...entries);
                break;

            case "info":
                e.app.logger().info(json.message, ...entries);
                break;

            case "warn":
                e.app.logger().warn(json.message, ...entries);
                break;

            case "error":
                e.app.logger().error(json.message, ...entries);
                break;

            default:
                return e.badRequestError("Unknown log level.", json.level);
        }

        // Return 201 empty response, this to reduce the response size
        // since the log endpoint is mostly requested a lot
        // In short: save bandwidth and time
        e.noContent(201);
    },
    $apis.requireSuperuserAuth(),
    $apis.skipSuccessActivityLog()
);

/**
 * Allow authentication with IP address to auth collection
 * The collection must have `ips` JSON field and must be an array of strings.
 *
 * You can also define a custom field name for the IPs field by passing `ipsField` in the request body.
 * The default field name is `ips`.
 *
 * This method of authentication will check if the identity (username or email) exists in the collection
 * and if the IP address of the request is in the `ips` field of the record of the same identity.
 *
 * The IP is get from the configured trusted proxy headers in the dashboard settings.
 *
 * Useful for allowing access to an application in the same network without exposing any credentials.
 *
 * @route POST /api/collections/{collection}/auth-with-ip
 * @path {string} collection - ID or name of the auth collection
 * @body {string} identity - Auth record username or email address
 * @body {string?} identityField (optional) - A specific identity field to use (by default `email`)
 * @body {string?} ipsField (optional) - A specific field name to use for the IPs (by default `ips`)
 */
routerAdd("POST", "/api/collections/{collection}/auth-with-ip", (e) => {
    const json = e.requestInfo().body;
    json.identityField ||= "email";
    json.ipsField ||= "ips";

    // Check if the `identity` is a string
    if (!json.identity || typeof json.identity !== "string") {
        return e.badRequestError("Missing `identity` field.", json.identity);
    }

    // Check if the `identityField` is a string
    if (typeof json.identityField !== "string") {
        return e.badRequestError("Invalid `identityField` field.", json.identityField);
    }

    // Check if the `ipsField` is a string
    if (typeof json.ipsField !== "string") {
        return e.badRequestError("Invalid `ipsField` field.", json.ipsField);
    }

    // Check if the collection is valid
    const collectionName = e.request?.pathValue("collection") || "";
    const [collection, error] = tryCatch(() => e.app.findCachedCollectionByNameOrId(collectionName));

    if (error !== null || !collection?.isAuth()) {
        return e.notFoundError("Missing or invalid auth collection context.", error);
    }

    // Check if the `identityField` appears in the collection fields
    if (!collection.fields.find((f) => f.getName() === json.identityField)) {
        return e.badRequestError(`The collection does not have a field named "${json.identityField}".`, json.identityField);
    }

    // Check if the `ipsField` appears in the collection fields
    if (!collection.fields.find((f) => f.getName() === json.ipsField)) {
        return e.badRequestError(`The collection does not have a field named "${json.ipsField}".`, json.ipsField);
    }

    // Fetch the record by the identity field
    const [record, recordError] = tryCatch(() => e.app.findFirstRecordByData(collection, json.identityField, json.identity));

    if (recordError !== null || !record) {
        return e.unauthorizedError("Invalid identity.", recordError);
    }

    // Fetch the IP list from the found record, and check if the IP list format is valid
    const requestIp = e.realIP();
    const ips = record.get(json.ipsField);

    if (!ips || !Array.isArray(ips)) {
        return e.unauthorizedError("Invalid IP address on the record.", ips);
    }

    // Iterate over the IP list and check if the request IP is in the list
    // or if the request IP is in the CIDR range of the list
    let found = false;

    for (const ip of ips) {
        if (ip.includes("/") && ipInCidr(requestIp, ip)) {
            found = true;
            break;
        } else if (ip === requestIp) {
            found = true;
            break;
        }
    }

    if (!found) {
        return e.unauthorizedError("IP address not found in the record.", requestIp);
    }

    return $apis.recordAuthResponse(e, record, "", requestIp);
});
