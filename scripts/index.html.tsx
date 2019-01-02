import { readFileSync } from "fs";
import { resolve } from "path";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { sri } from "./sri";

const isProduction = process.env.NODE_ENV === "production";
const useCDN = process.env.USE_CDN === "USE_CDN";

const jsdelivr = "https://cdn.jsdelivr.net";
const nodeModules = "../node_modules/";

const libUrl = (
    name: string,
    prodPath: string,
    devPath?: string,
): {
    src: string;
    integrity?: string;
    crossOrigin?: "anonymous";
} => {
    if (useCDN) {
        const version = (() => {
            const v = process.env[
                "npm_package_dependencies_" + name.replace(/[\-\.]/g, "_")
            ]!;

            return v[0] === "~" || v[0] === "^" ? v.slice(1) : v;
        })();

        const src = `${jsdelivr}/npm/${name}@${version}${prodPath}`;
        const integrity = sri(
            resolve(__dirname, `../node_modules/${name}${prodPath}`),
        );
        return { src, integrity, crossOrigin: "anonymous" };
    } else {
        return { src: `${nodeModules}${name}${devPath || prodPath}` };
    }
};

const appUrl = (
    path: string,
): {
    src: string;
    integrity?: string;
    crossOrigin?: "anonymous";
} => {
    const name = process.env.npm_package_name!;
    if (useCDN) {
        const version = process.env.npm_package_version!;
        const src = new URL(
            resolve("/npm", `${name}@${version}`, "build", path),
            `${jsdelivr}`,
        ).href;
        const integrity = sri(resolve(__dirname, "../build", path));
        return { src, integrity, crossOrigin: "anonymous" };
    } else {
        return { src: path };
    }
};

const Html = () => (
    <html>
        <head>
            <meta charSet="utf-8" />
            <title>LRC Maker</title>
            <meta
                name="description"
                content="LRC Maker｜The easiest way to create cool LRC files by yourself. 灯里的歌词滚动姬｜迄今为止最易用的歌词制作工具"
            />
            <meta
                name="keywords"
                content="lrc maker,lrc generate,歌词制作,歌词滚动"
            />
            <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
            <meta name="renderer" content="webkit" />
            <meta
                name="viewport"
                content="width=device-width, initial-scale=1"
            />
            <meta name="google" content="notranslate" />

            <link
                rel="apple-touch-icon"
                sizes="180x180"
                href="./favicons/apple-touch-icon.png"
            />
            <link
                rel="icon"
                type="image/png"
                href="./favicons/favicon-32x32.png"
                sizes="32x32"
            />
            <link
                rel="icon"
                type="image/png"
                href="./favicons/favicon-16x16.png"
                sizes="16x16"
            />
            <link rel="manifest" href="./site.webmanifest" />
            <link
                rel="mask-icon"
                href="./favicons/safari-pinned-tab.svg"
                color="#ff4081"
            />
            <link rel="shortcut icon" href="./favicons/favicon.ico" />

            <meta name="application-name" content="灯里的歌词滚动姬" />
            <meta name="msapplication-TileColor" content="#ffffff" />
            <meta name="theme-color" content="#ffffff" />
            <meta
                name="msapplication-config"
                content="./favicons/browserconfig.xml"
            />
            <meta
                name="apple-mobile-web-app-title"
                content="灯里的歌词滚动姬"
            />
            <link
                rel="stylesheet"
                {...(() => {
                    if (isProduction) {
                        const { src: href, integrity, crossOrigin } = appUrl(
                            "./index.css",
                        );
                        return { href, integrity, crossOrigin };
                    }

                    return { href: "../src/index.css" };
                })()}
            />
            <script
                {...libUrl(
                    "react",
                    "/umd/react.production.min.js",
                    "/umd/react.development.js",
                )}
            />
            <script
                {...libUrl(
                    "react-dom",
                    "/umd/react-dom.production.min.js",
                    "/umd/react-dom.development.js",
                )}
            />
            <script {...appUrl("./polyfill.js")} type="module" async />
            <script {...appUrl("./components/app.js")} type="module" />
        </head>
        <body>
            <div className="app-container" />
            <script
                dangerouslySetInnerHTML={{
                    __html: readFileSync(__dirname + "/sw.register.js", {
                        encoding: "utf8",
                    }).replace(/\s*[\r\n]+\s*|\s*\/\/.*/g, " "),
                }}
            />
        </body>
    </html>
);

process.stdout.write("<!DOCTYPE html>" + renderToStaticMarkup(<Html />));