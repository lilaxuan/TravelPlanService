import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateCosts } from '../domain/costEstimator.js';

test('estimateCosts returns total greater than zero', () => {
  const summary = estimateCosts({
    flights: [{ provider: 'x', title: 'x', bookingUrl: 'https://a', estimatedPrice: 100 }],
    hotels: [{ provider: 'x', title: 'x', bookingUrl: 'https://a', totalEstimatedPrice: 300 }],
    carRentals: [{ provider: 'x', title: 'x', bookingUrl: 'https://a', estimatedPrice: 50 }],
    restaurants: [{ provider: 'x', title: 'x', bookingUrl: 'https://a' }]
  });
  assert.equal(summary.total > 0, true);
});
