/*globals describe, it */
var expect = require('chai').expect;
var ps = require('../lib/parse-ps');
var paths = {
    p4_l1: 'test/fixtures/example-4pages-1link.ps',
    p3_l_mult: 'test/fixtures/example-3pages-mult-links.ps'
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

    describe('getDimensions', function (){
        it('should return dimension of PDF as a rectangle object', function () {
            return ps.parse(paths.p4_l1).then(function (d) {
                var dims = d.getDimensions();
                expect(dims.x).to.equal(0);
                expect(dims.y).to.equal(0);
                expect(dims.width).to.equal(612);
                expect(dims.height).to.equal(792);
            });
        });
    });

    describe('getPageTotals', function () {
        it('should return page totals', function () {
            return ps.parse(paths.p4_l1).then(function (d) {
                expect(d.getPageTotals()).to.equal(4);
            });
        });
    });

    describe('getCreationDate', function () {
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

    describe('getPageData', function () {
        it('should return null if the page number does not exist', function () {
            return ps.parse(paths.p4_l1).then(function (d) {
                var result = d.getPageData(100);
                expect(result).to.be.null;
            });
        });

        it('should include the object for a page with a link to another page', function () {
            return ps.parse(paths.p4_l1).then(function (d) {
                var result = d.getPageData(1);
                expect(result.links[0]).to.equal('obj_5');
            });
        });

        it('should include the multiple objects that link to other pages', function () {
            return ps.parse(paths.p3_l_mult).then(function (d) {
                var result = d.getPageData(3);
                expect(result.links.length).to.equal(3);
                expect(result.links[0]).to.equal('obj_15');
                expect(result.links[1]).to.equal('obj_16');
                expect(result.links[2]).to.equal('obj_17');
            });
        });
    });

    describe('getResourceData', function () {
        it('should return null if resource id does not exist', function () {
            return ps.parse(paths.p4_l1).then(function (d) {
                var result = d.getResourceData('bogusId');
                expect(result).to.be.null;
            });
        });

        it('should return null if a number is passed in', function () {
            return ps.parse(paths.p4_l1).then(function (d) {
                var result = d.getResourceData(1234);
                expect(result).to.be.null;
            });
        });

        it('should return a rect object that defines the hit area', function () {
            return ps.parse(paths.p3_l_mult).then(function (d) {
                //The rect we are querying should have to following values:
                //[199.6 482 412.4 404.8]
                var result = d.getResourceData('obj_11');
                expect(result.rect).to.exist;
                expect(result.rect.x).to.equal(200);
                expect(result.rect.y).to.equal(310);
                expect(result.rect.width).to.equal(212);
                expect(result.rect.height).to.equal(77);
            });
        });

        it('should return a destination object that links to a page', function () {
            return ps.parse(paths.p3_l_mult).then(function (d) {
                var dest_obj = 'obj_10';
                var result = d.getResourceData('obj_17');
                var destExistsInPages = false;
                expect(result.destination).to.exist;
                expect(result.destination).to.equal(dest_obj);

                //it should also be in the pages object
                Object.keys(d.DOM.pageObjects).forEach(function (curKey) {
                    if (d.DOM.pageObjects[curKey].objId === dest_obj) {
                        destExistsInPages = true;
                    }
                });

                expect(destExistsInPages).to.be.true;
            });
        });
    });

    describe('toJSON', function () {
        it('should return an object with a totalPages item', function () {
            return ps.parse(paths.p4_l1).then(function (d) {
                var result = d.toJSON();
                expect(result.totalPages).to.exist;
                expect(result.totalPages).to.equal(4);
            });
        });

        it('should return an object with a dimensions item', function () {
            return ps.parse(paths.p4_l1).then(function (d) {
                var result = d.toJSON();
                expect(result.dimensions).to.exist;
                expect(result.dimensions.x).to.equal(0);
                expect(result.dimensions.y).to.equal(0);
                expect(result.dimensions.width).to.equal(612);
                expect(result.dimensions.height).to.equal(792);
            });
        });

        it('should return an object with a pages array', function () {
            return ps.parse(paths.p3_l_mult).then(function (d) {
                var result = d.toJSON();
                expect(result.pages).to.exist;
                expect(result.pages.length).to.equal(3);

                //first page should have no links
                expect(result.pages[0].links.length).to.equal(0);
                //second page should have 1 link
                expect(result.pages[1].links.length).to.equal(1);
                //third page should have 3 links
                expect(result.pages[2].links.length).to.equal(3);

                //confirm the integrity of the link objects
                result.pages.forEach(function (curPageObj) {
                    if (curPageObj.links) {
                        curPageObj.links.forEach(function (curLinkObj) {
                            expect(curLinkObj.link).to.exist;
                            expect(curLinkObj.hitArea).to.exist;
                            expect(curLinkObj.hitArea.x).to.exist;
                            expect(curLinkObj.hitArea.y).to.exist;
                            expect(curLinkObj.hitArea.width).to.exist;
                            expect(curLinkObj.hitArea.height).to.exist;
                        });
                    }
                });
            });
        });
    });
});
