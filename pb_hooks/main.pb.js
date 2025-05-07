// @ts-check
/// <reference path="../node_modules/pocketbase-jsvm/index.d.ts" />

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

        switch (json.level) {
            case "debug":
                $app.logger().debug(json.message, ...Object.entries(json.data).flat());
                break;

            case "info":
                $app.logger().info(json.message, ...Object.entries(json.data).flat());
                break;

            case "warn":
                $app.logger().warn(json.message, ...Object.entries(json.data).flat());
                break;

            case "error":
                $app.logger().error(json.message, ...Object.entries(json.data).flat());
                break;

            default:
                return e.badRequestError("Unknown log level.", json.level);
        }

        e.noContent(201);
    },
    $apis.requireSuperuserAuth(),
    $apis.skipSuccessActivityLog()
);
