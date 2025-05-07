// @ts-check

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
    /** @type {typeof import("./utils")} */
    const { ipInCidr, tryCatch } = require(`${__hooks}/utils.js`);

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
    const [ips, ipsError] = tryCatch(() => JSON.parse(record.getString(json.ipsField)));

    if (ipsError !== null || !Array.isArray(ips)) {
        return e.unauthorizedError("Invalid IP list format.", ipsError);
    }

    // Iterate over the IP list and check if the request IP is in the list
    // or if the request IP is in the CIDR range of the list
    let found = false;

    for (const ip of ips) {
        if (typeof ip !== "string") {
            return e.unauthorizedError("Invalid IP address on the record.", ip);
        }

        if (ip.includes("/") && ipInCidr(requestIp, ip)) {
            found = true;
            break;
        } else if (ip === requestIp) {
            found = true;
            break;
        }
    }

    if (!found) {
        return e.unauthorizedError("Request IP not found in the record.", requestIp);
    }

    return $apis.recordAuthResponse(e, record, "", {
        identity: json.identity,
        requestIp,
    });
});
