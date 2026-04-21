"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tripLengthInDays = tripLengthInDays;
function tripLengthInDays(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = Math.max(0, end.getTime() - start.getTime());
    return Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}
