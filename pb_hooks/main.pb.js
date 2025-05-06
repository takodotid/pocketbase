/// <reference path="../node_modules/pocketbase-jsvm/index.d.ts" />

routerAdd("POST", "/api/logs", (e) => {
    const x = $apis.requireAuth("_superusers");

    const xx = x(e);
    let name = e.request.pathValue("name");

    return e.json(200, { message: "Hello " + name });
});
