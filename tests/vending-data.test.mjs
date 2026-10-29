import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseVendingData, writeVendingData } from '../src/pages/gamedata/vendingData.ts';

test('changing selections preserves unrelated sections, extension fields and unknown IDs', () => {
    const before = parseVendingData('{"staff":{"note":"keep"},"vending":{"HandItems":[9999],"Animates":false,"extension":"keep"}}');
    assert.ok(before);
    assert.deepEqual(before.handItems, [9999]);
    assert.equal(before.animates, false);
    const after = JSON.parse(writeVendingData(before, [...before.handItems, 1128]));
    assert.deepEqual(after, { staff: { note: 'keep' }, vending: { extension: 'keep', handItems: [9999, 1128], animates: false } });
});

test('new vending configuration uses the runtime animation default', () => {
    const data = parseVendingData('');
    assert.ok(data);
    assert.equal(data.animates, true);
    assert.deepEqual(JSON.parse(writeVendingData(data, [1128])).vending, { handItems: [1128], animates: true });
});

test('editing animation preserves repeated IDs and their existing selection weights', () => {
    const data = parseVendingData('{"vending":{"handItems":[3,3,4]}}');
    assert.ok(data);
    assert.deepEqual(JSON.parse(writeVendingData(data, data.handItems, false)).vending.handItems, [3, 3, 4]);
});

test('invalid JSON or section data requires explicit correction', () => {
    for (const raw of ['{', '[]', 'null', '{"vending":null}', '{"vending":"invalid"}', '{"vending":{"handItems":[0]}}', '{"vending":{"handItems":["1128"]}}', '{"vending":{"handItems":null}}', '{"vending":{"animates":null}}'])
        assert.equal(parseVendingData(raw), null, raw);
});

test('structured editing refuses to round unrelated numeric data', () => {
    for (const value of ['9007199254740993', '0.1234567890123456789', '1e400'])
        assert.equal(parseVendingData(`{"custom":${value}}`), null);
    for (const value of ['1.0', '1e20', '"9007199254740993"'])
        assert.ok(parseVendingData(`{"custom":${value}}`));
});
