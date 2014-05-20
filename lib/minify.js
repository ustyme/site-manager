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
        locateSync = util.locateSync,
        siteAssets = require('site-assets'),
        async = require('async'),
        cache = {};
//    var http = require('http');
    var request = require('request');

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

    function uglify(scripts, cb) {
        var ast = jsp.parse(scripts);

        ast = pro.ast_mangle(ast);
        ast = pro.ast_squeeze(ast);

        return cb(undefined, pro.gen_code(ast));
    }

    module.exports = function (module, logger) {


        if (process.env.NODE_ENV !== "production") {
            logger("Running in development mode");
            return function (req, res, next) {
                next();
            };
        }

        logger("Running in production mode");

        return function (req, res, next) {


            function responseWrite(filteredMod) {
                res.writeHead(HTTP_SUCCESS, {
                    'Content-Type': 'application/json; charset=UTF-8',
                    'Content-Length': filteredMod.scriptCache.length + 3
                });
                res.end(filteredMod.scriptCache);
            }

            if (matchForJS(req)) {

                var filteredMod = siteAssets.getModule(req, module);
                var scriptCache = filteredMod.scriptCache;

                if (!scriptCache) {

                    var trailingScripts = filteredMod.trailingScripts;
                    var concatScripts = '';

                    async.each( trailingScripts, function (script, addScriptCB) {

                        var isURI = /\b(http)/.test(script);

                        if(isURI) {
                            request(script, function (error, response, body) {
                                if (error) {
                                    addScriptCB(error);
                                } else if (response.statusCode == 200) {
                                    console.log(body) // Print the google web page.
                                    concatScripts += ("\n" + body);
                                    addScriptCB();
                                } else {
                                    addScriptCB();
                                }
                            });
                        } else {
                            try {
                                var cachedScript = loadSync(module, script);
                                logger.debug("adding script to compression: " + script);
                                concatScripts += ("\n" + cachedScript);
                            } catch (e) {
                                logger.error("While loading " + script + ": " + e.message);
                            }
                            addScriptCB();
                        }


                    }, function(err) {
                        if(err) {
                            logger.error(err);
                        } else {
                            logger("starting compression...");
                            var ast = jsp.parse(concatScripts);
                            ast = pro.ast_mangle(ast);
                            ast = pro.ast_squeeze(ast);
                            filteredMod.scriptCache = pro.gen_code(ast);

                            siteAssets.setModule(req, filteredMod);
                            logger("compression complete");
                            responseWrite(filteredMod);
                        }
                    });
                } else {
                    responseWrite(filteredMod);
                }

            } else if (matchForCSS(req)) {

            } else {
                return next();
            }
        };
    };
})(module, __dirname);
