/*jshint white: false, node: true, vars: true, indent: 4 */
(function (module, __dirname) {
    "use strict";

    var HTTP_SUCCESS = 200,
        uglifyjs = require("uglify-js"),
        util = require("./util"),
        url = require("url"),
        fs = require("fs"),
        jsp = uglifyjs.parser,
        pro = uglifyjs.uglify,
        locate = util.locate,
        locateSync = util.locateSync;

    function matchForJS(req) {
        var parsed = url.parse(req.url, true, true);

        console.log("Current parsed.pathname=" + parsed.pathname);

        return parsed.pathname === "/js/compressed.js";
    }

    function matchForCSS(req) {
        var parsed = url.parse(req.url, true, true);

        return parsed.pathname === "/css/compressed.css";
    }

    function load(module, script, cb) {
        return locate(module["public"], script, function (err, quaified) {
            if (err) {
                return cb(err);
            }

            return fs.readFile(quaified, "utf-8", cb);
        });
    }

    function loadSync(module, script) {
        var qualified = locateSync(module["public"], script);
        return fs.readFileSync(qualified, "utf-8");
    }

    function uglify(scripts,  cb) {
        var ast = jsp.parse(scripts);

        ast = pro.ast_mangle(ast);
        ast = pro.ast_squeeze(ast);

        return cb(undefined, pro.gen_code(ast));
    }

    module.exports = function (module, logger) {


        if(process.env.NODE_ENV !== "production") {
            logger("Running in development mode");
            return function(req, res, next) {
                next();
            };
        }

        logger("Running in production mode");


        var trailingScripts = module.trailingScripts;

        module.trailingScripts = [ "js/compressed.js" ];

        module.scriptCache = "";

        //We should lock (make synchronous calls) until we finish so that we don't run into a race condition where we aren't cached, but the user can request
        //Synchronous calls are good in startup situtations where you want pre-initialize steps!
        trailingScripts.forEach(function(script) {

                try {
                    var cachedScript = loadSync(module, script);
                    logger("adding script to compression: " + script);
                    module.scriptCache+= ("\n" + cachedScript);
                } catch(e) {
                    logger("While loading " + script + ": " + e.message);
                }
        });

        logger("starting compression...");
        var ast = jsp.parse(module.scriptCache);
        ast = pro.ast_mangle(ast);
        ast = pro.ast_squeeze(ast);
        module.scriptCache = pro.gen_code(ast);
        logger("compression complete");

        return function (req, res, next) {

                if(matchForJS(req)) {
                    res.writeHead(HTTP_SUCCESS, {
                        'Content-Type': 'application/json; charset=UTF-8',
                        'Content-Length': module.scriptCache.length + 3
                    });
                    res.end(module.scriptCache);
                } else if(matchForCSS(req)) {

                } else {
                    return next();
                }
        };
    };
})(module, __dirname);
