# tizen-mux

The official Mux Data SDK for Samsung Tizen applications

## SDK Overview

Mux Data supports applications built for Samsung Tizen TVs using JavaScript and Tizen's [AVPlay API](https://developer.samsung.com/tv/develop/api-references/samsung-product-api-references/avplay-api). For integration instructions in your application, see our documentation here: https://docs.mux.com/docs/integration-guide-tizen.

If you run into any issues, don't hesitate to get in touch by creating an issue in this repo, or [reaching out to us directly](mailto:help@mux.com).

## Application Support

Applications for Tizen-based TVs can be written in C++, JavaScript, and Microsoft .NET. Currently, Mux Data only supports applications written in JavaScript. As such, when you craete your application using the Tizen Studio, you must choose "Web Application".

Get in touch if you need Mux to integrate with your native applications written in other languages on Samsung TVs.

## Directory Layout

```
  - app
    - tizenPlayer - Sample Tizen application using AVPlay
  - scripts - deployment scripts
  - src
    - index.js - Mux integration
    - entry.js - packaging file
```

## Sample Application

A sample demo application is provided in the `app/tizenPlayer` directory, which implements a player and basic player controls for play, stop, pause, resume, fast-forward, and rewind. This sample application is also integrated with Mux Data, showing the integration steps necessary. See our [integration guide](https://docs.mux.com/docs/integration-guide-tizen) for more detailed information on integration.

## Mux Data Integration

The Mux Data integration, which uses `mux-embed` (the core Mux JavaScript SDK), is comprised of the scripts within the `src` directory. The integration itself is written usein ES6 and various other dependenciees, managed via `yarn`. This is then compiled and minified using Webpack, and hosted via https://src.litix.io/tizen/[major_version]/tizen-mux.js.

* http://localhost:8080/index.html
* http://localhost:8080/ads.html

## Release Notes

### Current Release

#### v0.1.0

  - Initial SDK released
