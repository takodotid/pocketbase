// @ts-check

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
