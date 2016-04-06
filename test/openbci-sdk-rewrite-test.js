var sinon = require('sinon');
var chai = require('chai'),
    should = chai.should(),
    expect = chai.expect,
    openBCIBoard = require('../openBCIBoard.rewrite'),
    OpenBCISample = openBCIBoard.OpenBCISample,
    k = OpenBCISample.k;

var chaiAsPromised = require("chai-as-promised");
var sinonChai = require("sinon-chai");
chai.use(chaiAsPromised);
chai.use(sinonChai);

describe('openBCIsdk', function() {
    before(function(done) {
        ourBoard = new openBCIBoard.OpenBCIBoard();
        done()
    });
    describe('simulator', function() {
        it('does not need promise', function() {
            return ourBoard.connect('OpenBCISimulator');
        })
        xit('pause works', function() {
            ourBoard.connect('OpenBCISimulator');
            console.log(ourBoard.pause);
            ourBoard.pause();
        })
    })

});

