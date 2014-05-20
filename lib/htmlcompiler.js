/*jshint white: false, node: true, vars: true, indent: 4 */
(function (module, __dirname) {
    "use strict";

    var HTTP_SUCCESS = 200,
        HTTP_NOT_FOUND = 404,
        path = require("path"),
        async = require('async'),
        hbars = require("handlebars"),
        util = require("./util"),
        url = require("url"),
        fs = require("fs"),
        locate = util.locate,
        clone = util.clone,
        siteAssets = require('site-assets');

    function load(cache, file, cb, debug) {
        if (Object.prototype.toString.call(file) === '[object Function]') {
            return file(cb);
        }

        var cached = cache.files[file];

        if (cached) {
            return cb(undefined, cached);
        }

        debug("reading", file);

        fs.readFile(file, "utf-8", function (err, content) {
            if (err) {
                return cb(err);
            }

            cache.files[file] = content;

            return cb(undefined, content);
        });
    }

    function compileHtml(cache, mod, file, cb, statusCode, debug) {
        var cached = cache.templates[file];

        if (cached) {
            return cb(undefined, cached, statusCode);
        }

        locate(mod["public"], file, function (err, qfile) {
            if (err) {
                if (statusCode === HTTP_NOT_FOUND) {
                    return cb(err);
                }

                return compileHtml(cache, mod, "/404.html", cb, HTTP_NOT_FOUND, debug);
            }
            return load(cache, qfile, function (err, content) {
                if (err) {
                    return cb(err);
                }

                var template = hbars.compile(content);

                cache.templates[file] = template;

                return cb(undefined, mod, template, statusCode);
            }, debug);
        });
    }

    function compileSite(cache, mod, url, cb, debug) {
        var htmlFiles = mod.htmlFiles,
            rawHtml = [],
            idx = 0,
            templateFiles = mod.templateFiles,
            templateHtml = [],
            file;

        function loadHtmlFiles(cb) {
            console.log('******** file: ' + file);
            var pos = idx++;
            async.each(htmlFiles, function (file, callback) {
                load(cache, file, function (err, content) {
                    if (err) {
                        return callback(err);
                    }

                    rawHtml[pos] = content;
                    return callback();
                }, debug);
            }, cb);
        }

        function loadTemplateFiles(cb) {
            async.each(templateFiles, function (file, callback) {
                var name = path.basename(file, '.html');

                load(cache, file, function (err, content) {
                    if (err) {
                        return callback(err);
                    }

                    templateHtml.push({
                        name: name,
                        content: content
                    });
                    return callback();
                }, debug);
            }, cb);
        }

        async.parallel([
            loadHtmlFiles,
            loadTemplateFiles
        ], function (err) {
            if (err) {
                debug.error(err);
            }
            mod.htmlFiles = rawHtml;
            mod.templateFiles = templateHtml;
            return compileHtml(cache, mod, url.pathname, cb, undefined, debug);
        });
    }

    module.exports = function (module, debug) {
        return function (req, res, next) {
//            TODO: this is not cached.
            var cache = {
                    templates: {},
                    files: {}
                },
                parsed = url.parse(req.url, true, true);

            debug("url", req.url);

            if (!parsed.pathname || parsed.pathname === '/') {
                res.statusCode = 301;
                res.setHeader('Location', 'index.html');

                return res.end();
            }

            if (!parsed.pathname.match(/\.html$/)) {
                return next();
            }

            var mod = siteAssets.getModule(req, module);

            return compileSite(cache, mod, parsed, function (err, mod2, compiled, statusCode) {
                if (err) {
                    return next(err);
                }

                var finalMod = clone(mod2);

                if(process.env.NODE_ENV === "production") {
                    finalMod.trailingScripts = [ "js/compressed.js" ];
                }

                var result = compiled(finalMod);

                res.writeHead(statusCode || HTTP_SUCCESS, {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'text/html; charset=UTF-8'
                });

                return res.end(result);
            }, debug);
        };
    };
})(module, __dirname);
