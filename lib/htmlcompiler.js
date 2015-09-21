/*jshint white: false, node: true, vars: true, indent: 4 */
(function (module, __dirname) {
    "use strict";

    var HTTP_SUCCESS = 200,
        async = require('async'),
        util = require("./util"),
        url = require("url"),
        fs = require("fs"),
        clone = util.clone,
        siteAssets = require('site-assets');

    module.exports = function (module, debug) {

        return function (req, res, next) {
            var parsed = url.parse(req.url, true, true);

            debug("url: ", req.url);

            var isMobile = !!req.headers['user-agent'].match(/Mobile/);

            if ((!parsed.pathname || parsed.pathname === '/') && !isMobile) {

                //console.log('!!!!!!!! setHeader location to index.html');
                res.statusCode = 301;
                res.setHeader('Location', 'index.html');

                return res.end();
            }

            if (!parsed.pathname.match(/\.html$/)) {
                return next();
            }

            var mod = siteAssets.getModule(req, module);

            function compileSiteStep(cb) {
                siteAssets.compileSite(mod, debug, function(err) {
                    cb(err);
                });
            }

            function compileHtmlStep(cb) {
                siteAssets.compileHtml(mod, parsed.pathname, undefined, debug, function(err, mod2, compiled, statusCode) {
                    cb(err, mod2, compiled, statusCode);
                });
            }

            async.waterfall([
                compileSiteStep,
                compileHtmlStep
            ], function(err, mod2, compiled, statusCode) {
                if(err) {
                    debug.error(err);
                    return next(err);
                }
                var finalMod = clone(mod2);

                if(process.env.NODE_ENV === "production") {
                    finalMod.trailingScripts = [ "js/compressed.js" ];
//                    finalMod.stylesheets = ["css/compressed.css"];
                }

                var result = compiled(finalMod);

                res.writeHead(statusCode || HTTP_SUCCESS, {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'text/html; charset=UTF-8'
                });

                return res.end(result);
            });
        };
    };
})(module, __dirname);
