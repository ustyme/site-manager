(function () {
    "use strict";

    var fs = require('fs'),
        util = require('./util'),
        hbars = require("handlebars"),
        siteAssets = require('site-assets'),
        crypto = require('crypto'),
        util = require("./util"),
        clone = util.clone;

    function md5(str){
        return crypto
            .createHash('md5')
            .update(str)
            .digest('hex');
    }

    module.exports = function (mod, options, logger) {

        var props = util.clone(mod);

        if(props.appCacheDate) {
            props.date = new Date(props.appCacheDate);
        } else {
            props.date = new Date();
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

                    var filteredMod = siteAssets.getModule(req, props);

                    var finalMod = clone(filteredMod);

                    if(process.env.NODE_ENV === "production") {
                        finalMod.trailingScripts = [ "js/compressed.js" ];
//                    finalMod.stylesheets = ["css/compressed.css"];
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
