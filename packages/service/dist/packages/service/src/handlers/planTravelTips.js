"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const travelTipsProvider_js_1 = require("../domain/travelTipsProvider.js");
const handler = async (event) => {
    return { travelTips: await (0, travelTipsProvider_js_1.getTravelTips)(event) };
};
exports.handler = handler;
