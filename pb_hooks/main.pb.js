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

        if (["debug", "info", "warn", "error"].indexOf(json.level) === -1) {
            return e.badRequestError("Log level must be one of: debug, info, warn, error.", json.level);
        }

        if (!json.message || typeof json.message !== "string") {
            return e.badRequestError("Log message must be a string.", json.message);
        }

        if (!json.data || typeof json.data !== "object" || Array.isArray(json.data)) {
            return e.badRequestError("Log data must be an object.", json.data);
        }

        if (Object.keys(json.data).length === 0) {
            return e.badRequestError("Log data must not be empty.", json.data);
        }

        const entries = Object.entries(json.data).flat();

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
    const identity = e.requestInfo().body?.identity;

    if (!identity) {
        return e.badRequestError("Missing identity field.", identity);
    }

    const [collection, error] = tryCatch(() => e.app.findCachedCollectionByNameOrId(e.request?.pathValue("collection") || ""));

    if (error !== null || !collection?.isAuth()) {
        return e.notFoundError("Missing or invalid auth collection context.", error);
    }

    const identityField = e.requestInfo().body?.identityField || "email";
    const ipsField = e.requestInfo().body?.ipsField || "ips";
    const requestIp = e.realIP();

    const [record, recordError] = tryCatch(() => e.app.findFirstRecordByFilter(collection, `${identityField}='${identity}' && ${ipsField} ~ '${requestIp}'`));

    if (recordError !== null || !record) {
        return e.unauthorizedError("Invalid identity or IP address.", recordError);
    }

    const [token, tokenErr] = tryCatch(() => record.newAuthToken());

    if (tokenErr !== null) {
        return e.internalServerError("Failed to create auth token.", tokenErr);
    }

    return $apis.recordAuthResponse(e, record, "", requestIp);
});
