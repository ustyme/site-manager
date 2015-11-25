(function () {
    "use strict";

    var fs = require('fs'),
        util = require('./util'),
        hbars = require("handlebars"),
        siteAssets = require('site-assets'),
        crypto = require('crypto'),
        util = require("./util");

    function md5(str){
        return crypto
            .createHash('md5')
            .update(str)
            .digest('hex');
    }

    module.exports = function (mod, options, logger) {

        if(mod.appCacheDate) {
            mod.date = (new Date(mod.appCacheDate)).toString();
        } else {
            mod.date = (new Date()).toString();
        }

        return function (req, res, next) {
            if (!req.url.match(/\.(appcache)$/)) {
                return next();
            }

            return util.locate(mod["public"], "manifest.appcache", function (err, manifestFile) {
                if (err) {
                    return cb(err);
                }

                return fs.readFile(manifestFile, "utf-8", function (err, content) {
                    if (err) {
                        throw err;
                    }

                    var filteredMod = siteAssets.getModule(req, mod);

                    var finalMod = util.clone(filteredMod);
                    if(process.env.NODE_ENV === "production") {
                        finalMod.trailingScripts = [ "js/compressed.js" ];
//                    filteredMod.stylesheets = ["css/compressed.css"];
                    }

                    var template = hbars.compile(content),
                        body = template(finalMod),
                        control = 'NO-CACHE';

                    res.writeHead(200, {
                        'Content-Type': 'text/cache-manifest',
                        'Content-Length': body.length,
                        'ETag': '"' + md5(body) + '"',
                        'Cache-Control': control
                    });
                    return res.end(body);
                });
            });
        };
    };
})();
