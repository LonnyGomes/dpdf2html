/*globals describe, it */
var expect = require('chai').expect;
var ps = require('../lib/parse-ps');
var paths = {
    p4_l1: 'test/fixtures/example-4pages-1link.ps'
};

describe('parse', function () {
    it('should return error if postscript file does not exist', function () {
        return ps.parse('bogus_file_name.ps').then(function () {
            throw new Error('parse should not have resolved the promise!');
        }, function (err) {
            expect(typeof err).to.equal('string');
        });
    });

    it('should return an object', function () {
        return ps.parse(paths.p4_l1).then(function (d) {
            expect(typeof d).to.equal('object');
        });
    });

    it('should return dimension of PDF as a rectangle object', function () {
        return ps.parse(paths.p4_l1).then(function (d) {
            var dims = d.getDimensions();
            expect(dims.x).to.equal(0);
            expect(dims.y).to.equal(0);
            expect(dims.width).to.equal(612);
            expect(dims.height).to.equal(792);
        });
    });

    it('should return page totals', function () {
        return ps.parse(paths.p4_l1).then(function (d) {
            expect(d.getPageTotals()).to.equal(4);
        });
    });

    it('should return creation date as a Date object', function () {
        return ps.parse(paths.p4_l1).then(function (d) {
            var result = d.getCreationDate();
            expect(result.getFullYear()).to.equal(2016);
            expect(result.getMonth()).to.equal(8);
            expect(result.getDate()).to.equal(2);
            expect(result.getHours()).to.equal(9);
            expect(result.getMinutes()).to.equal(40);
            expect(result.getSeconds()).to.equal(38);
        });
    });
});
